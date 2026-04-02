import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require('./package.json');

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
      '@tools': path.resolve(__dirname, 'src/tools'),
    },
  },
  server: {
    port: 5173,
  },
})
