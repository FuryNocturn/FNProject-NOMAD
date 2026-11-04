import { type RefObject, useEffect, useRef } from 'react'

/**
 * Shared pieces for the canvas action games: a requestAnimationFrame loop that
 * only runs while `running`, held keys, and pausing when the tab is hidden.
 */

/** Calls `tick(dt)` every frame while `running`; dt in seconds, capped so a slow frame cannot tunnel. */
export function useGameLoop(running: boolean, tick: (dt: number) => void) {
  const ref = useRef(tick)
  ref.current = tick
  useEffect(() => {
    if (!running) return
    let id = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      ref.current(dt)
      id = requestAnimationFrame(frame)
    }
    id = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(id)
  }, [running])
}

/** Runs `pause` when the tab is hidden or the window loses focus. */
export function usePauseWhenHidden(pause: () => void) {
  const ref = useRef(pause)
  ref.current = pause
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) ref.current()
    }
    const onBlur = () => ref.current()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}

/** Keys currently held down (by `KeyboardEvent.key`, lower-cased). `onPress` sees each new press. */
export function useHeldKeys(capture: string[], onPress?: (key: string) => void): RefObject<Set<string>> {
  const held = useRef(new Set<string>())
  const press = useRef(onPress)
  press.current = onPress
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLSelectElement) return
      const k = e.key.toLowerCase()
      if (!capture.includes(k)) return
      e.preventDefault()
      if (!held.current.has(k)) press.current?.(k)
      held.current.add(k)
    }
    const up = (e: KeyboardEvent) => held.current.delete(e.key.toLowerCase())
    const clear = () => held.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
    // The key list is fixed per game, so the listeners are set once.
  }, [])
  return held
}

/** Pointer position in canvas units (the canvas is scaled by CSS). */
export function canvasPoint(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }) {
  const r = canvas.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height }
}

/** -1, 0 or 1 from held left/right keys. */
export const axis = (held: Set<string>, neg = ['arrowleft', 'a'], pos = ['arrowright', 'd']) =>
  (pos.some((k) => held.has(k)) ? 1 : 0) - (neg.some((k) => held.has(k)) ? 1 : 0)
