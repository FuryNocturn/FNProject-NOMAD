/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the site works at any path or port NOMAD publishes it on.
  base: './',
  // The AI self-play tests are slow on a busy Docker build; 5 s was too tight.
  test: { globals: true, testTimeout: 30_000, exclude: ['**/node_modules/**', 'vendor/**'] },
})
