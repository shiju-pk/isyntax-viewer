import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@transport': path.resolve(__dirname, 'src/transport'),
      '@parsers': path.resolve(__dirname, 'src/parsers'),
      '@codecs': path.resolve(__dirname, 'src/codecs'),
      '@dicom': path.resolve(__dirname, 'src/dicom'),
      '@imaging': path.resolve(__dirname, 'src/imaging'),
      '@rendering': path.resolve(__dirname, 'src/rendering'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@presentation': path.resolve(__dirname, 'src/presentation'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
