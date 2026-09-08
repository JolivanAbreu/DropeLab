import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    // smoke.test.mjs na raiz é um script manual de fluxo completo contra o
    // backend real (rodado via `npx vite-node smoke.test.mjs`), não um
    // teste unitário — restringe a descoberta automática só à pasta src/.
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
})
