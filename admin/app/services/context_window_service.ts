import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import os from 'node:os'
import KVStore from '#models/kv_store'
import { OllamaService } from '#services/ollama_service'
import { SystemService } from '#services/system_service'
import {
  UNKNOWN_BACKEND_CONTEXT,
  UNREPORTED_BACKEND_CONTEXT,
  computeKvBytesPerToken,
  estimateKvBytesPerToken,
  inferenceMemoryBudget,
  parseParameterBillions,
  parseUserContextCap,
  resolveContextWindow,
  selectAvailableBytes,
  type ContextWindowDecision,
} from '../utils/context_window.js'

/**
 * Process-wide on purpose. These services are constructed per request, so a
 * map on the instance would be empty on the next turn and would make
 * invalidate() a no-op. Ollama reloads a model whenever num_ctx changes, so
 * the decision has to outlive the request that first computed it, and has to
 * be droppable when a setting that feeds it changes.
 */
const contextWindowDecisions = new Map<string, Promise<ContextWindowDecision>>()
let cachedAvailableBytes: Promise<number | undefined> | null = null

/** Drop memoized decisions. ContextWindowService.invalidate() calls this. */
export function invalidateContextWindowCache(): void {
  contextWindowDecisions.clear()
  cachedAvailableBytes = null
}

/**
 * Decides how large a context window each chat model gets, and then holds that
 * answer still.
 *
 * The "holds it still" part is the whole point. Ollama unloads and reloads a
 * model whenever a request asks for a different `num_ctx` than the loaded
 * instance — so a window that grew with the conversation would stall a turn and
 * throw away the KV cache exactly when the conversation got interesting. The
 * decision is therefore made once per model and memoized for the process
 * lifetime; it is a property of (model, hardware), not of the current prompt.
 *
 * Inputs, in decreasing order of authority:
 *   - the user's cap (`ai.contextWindow`), which can only lower the result
 *   - the model's trained context length, from /api/show `model_info`
 *   - what the hardware can actually afford, from the exact per-token KV cost in
 *     the GGUF metadata against detected VRAM, a share of system RAM, or the
 *     configured memory of a remote Ollama host
 */
@inject()
export class ContextWindowService {
  constructor(
    private ollamaService: OllamaService,
    private systemService: SystemService
  ) {}

  /**
   * The context window to request for `model`. Memoized — repeat calls within a
   * process return the identical number, which is what keeps the model loaded.
   */
  async windowFor(model: string): Promise<number> {
    return (await this.decisionFor(model)).contextWindow
  }

  async decisionFor(model: string): Promise<ContextWindowDecision> {
    const cached = contextWindowDecisions.get(model)
    if (cached) return cached

    const pending = this._resolve(model).catch((error) => {
      logger.warn(
        `[ContextWindow] Falling back to ${UNKNOWN_BACKEND_CONTEXT} for ${model}: ${error instanceof Error ? error.message : error}`
      )
      return { contextWindow: UNKNOWN_BACKEND_CONTEXT, limitedBy: 'default' as const }
    })
    contextWindowDecisions.set(model, pending)
    // Non-Ollama backends decide the size when they load the model (LM Studio: just-in-time, by
    // this very request; the user can reload it with another size), so ask again next turn.
    pending.then((d: ContextWindowDecision) => {
      if (d.stable === false) contextWindowDecisions.delete(model)
    })
    return pending
  }

  private async _resolve(model: string): Promise<ContextWindowDecision> {
    const [info, userCapRaw] = await Promise.all([
      this.ollamaService.getModelInfo(model),
      KVStore.getValue('ai.contextWindow'),
    ])
    const userCap = parseUserContextCap(userCapRaw)

    // No /api/show means a non-Ollama backend, which sets its context when it loads the model
    // and ignores anything we send. Budget against what it reports having loaded (LM Studio,
    // llama.cpp) — never above it, or the backend truncates the prompt silently — and against a
    // conservative default when it reports nothing.
    if (!info.contextLength && !info.rawModelInfo) {
      const served = await this.ollamaService.getServedContextLength(model)
      const decision: ContextWindowDecision =
        served !== undefined
          ? userCap !== undefined && userCap < served
            ? { contextWindow: userCap, limitedBy: 'user', stable: false }
            : { contextWindow: served, limitedBy: 'model', stable: false }
          : {
              contextWindow: userCap ?? UNREPORTED_BACKEND_CONTEXT,
              limitedBy: userCap !== undefined ? 'user' : 'default',
              stable: false,
            }
      logger.info(
        `[ContextWindow] ${model}: ${served !== undefined ? `backend reports ${served} loaded` : 'backend reports no context size'}, budgeting at ${decision.contextWindow}`
      )
      return decision
    }

    const kvBytesPerToken =
      computeKvBytesPerToken(info.rawModelInfo) ??
      estimateKvBytesPerToken(parseParameterBillions(info.parameterSize, model))

    const decision = resolveContextWindow({
      modelMaxCtx: info.contextLength,
      modelfileNumCtx: info.modelfileNumCtx,
      kvBytesPerToken,
      availableBytes: await this.getAvailableBytes(),
      modelBytes: await this._modelBytes(model),
      userCap,
    })

    logger.info(
      `[ContextWindow] ${model}: ${decision.contextWindow} tokens (limited by ${decision.limitedBy}; ` +
        `${(kvBytesPerToken / 1024).toFixed(0)} KiB/token KV` +
        `${decision.affordableTokens !== undefined ? `, ~${decision.affordableTokens} affordable` : ''})`
    )
    return decision
  }

  /**
   * Memory available for inference, in bytes.
   *
   * Prefers the VRAM figure Ollama itself reports at startup — it is the number
   * that actually governs whether a window fits, and it already accounts for
   * whichever device Ollama chose. Falls back to a conservative share of system
   * RAM for CPU-only hosts, which is the low end of the hardware NOMAD targets
   * and precisely where getting this wrong hurts most.
   *
   * Public because the recommended-model list (#1477) budgets against the same
   * figure; the arithmetic itself lives in `inferenceMemoryBudget`.
   *
   * A remote URL skips the GPU probe and host RAM: they describe this NOMAD host,
   * not the machine running the model, and using them pins every window to the
   * floor. `ai.remoteOllamaMemoryGB` is the ceiling then; unset means no ceiling (#1547).
   */
  async getAvailableBytes(): Promise<number | undefined> {
    if (!cachedAvailableBytes) {
      cachedAvailableBytes = (async () => {
        const [remoteUrl, remoteMemoryGb] = await Promise.all([
          KVStore.getValue('ai.remoteOllamaUrl'),
          KVStore.getValue('ai.remoteOllamaMemoryGB'),
        ])
        if (remoteUrl?.trim()) {
          return selectAvailableBytes({
            remoteOllamaUrl: remoteUrl,
            remoteOllamaMemoryGB: remoteMemoryGb,
          })
        }

        let vramMiB: number | undefined
        try {
          const compute = await this.systemService.getOllamaInferenceComputeFromLogs()
          vramMiB = compute?.vramMiB
        } catch (error) {
          logger.debug(
            `[ContextWindow] GPU probe failed, assuming CPU inference: ${error instanceof Error ? error.message : error}`
          )
        }
        // CPU inference shares host RAM with MySQL, Redis, Qdrant and every other
        // container on the box, so claim only a modest slice of it.
        return inferenceMemoryBudget(vramMiB, os.totalmem())
      })()
    }
    return cachedAvailableBytes
  }

  private async _modelBytes(model: string): Promise<number | undefined> {
    try {
      const models = await this.ollamaService.getModels(true)
      return models.find((m) => m.name === model)?.size || undefined
    } catch {
      return undefined
    }
  }

  /** Drop memoized decisions — call when the backend, the user's cap, or the remote host changes. */
  invalidate(): void {
    invalidateContextWindowCache()
  }
}
