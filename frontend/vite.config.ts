import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/chatbot': 'http://localhost:8000',
      '/pipeline1': 'http://localhost:8000',
      '/pipeline2': 'http://localhost:8000',
      '/test': 'http://localhost:8000',
    }
  }
})
