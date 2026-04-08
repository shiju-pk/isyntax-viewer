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
      '@workers': path.resolve(__dirname, 'src/workers'),
      '@cache': path.resolve(__dirname, 'src/cache'),
      '@requestPool': path.resolve(__dirname, 'src/requestPool'),
      '@segmentation': path.resolve(__dirname, 'src/segmentation'),
      '@overlay-engine': path.resolve(__dirname, 'src/overlay-engine'),
      '@gsps-engine': path.resolve(__dirname, 'src/gsps-engine'),
      '@cad-marker-engine': path.resolve(__dirname, 'src/cad-marker-engine'),
      '@presentation-state': path.resolve(__dirname, 'src/presentation-state'),
      '@screen-overlay': path.resolve(__dirname, 'src/screen-overlay'),
      '@cine': path.resolve(__dirname, 'src/cine'),
      '@viewport-sync': path.resolve(__dirname, 'src/viewport-sync'),
      '@save-state': path.resolve(__dirname, 'src/save-state'),
      '@domain': path.resolve(__dirname, 'src/core/domain'),
      '@adapters': path.resolve(__dirname, 'src/adapters'),
      '@capabilities': path.resolve(__dirname, 'src/core/capabilities'),
      '@config': path.resolve(__dirname, 'src/core/config'),
      '@errors': path.resolve(__dirname, 'src/core/errors'),
      '@logging': path.resolve(__dirname, 'src/core/logging'),
      '@hanging-protocol': path.resolve(__dirname, 'src/hanging-protocol'),
    },
  },
  server: {
    port: 5173,
  },
})
