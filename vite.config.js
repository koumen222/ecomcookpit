import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('axios') || id.includes('date-fns')) {
              return 'utils';
            }
            if (id.includes('react-icons') || id.includes('lucide')) {
              return 'icons';
            }
            return 'vendor';
          }
          
          // App chunks
          if (id.includes('/src/components/')) {
            return 'components';
          }
          if (id.includes('/src/pages/') || id.includes('/src/screens/')) {
            return 'pages';
          }
          if (id.includes('/src/services/') || id.includes('/src/contexts/')) {
            return 'app-logic';
          }
        }
      }
    },
    chunkSizeWarningLimit: 800
  },
  publicDir: 'public'
})

