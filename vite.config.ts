/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // a cena 3D (three.js) é um pedaço grande de propósito, mas só baixa quando um jardim abre
    chunkSizeWarningLimit: 1000,
  },
  test: {
    // testes do front em src/, testes do banco em supabase/tests/
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts'],
  },
})
