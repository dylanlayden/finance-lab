import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://dylanlayden.github.io/finance-lab/
export default defineConfig({
  base: '/finance-lab/',
  plugins: [react()],
})
