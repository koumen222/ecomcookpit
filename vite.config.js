import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

// Version du build — injectée au build-time, lue côté client pour détecter
// les deploys et éviter les ChunkLoadError qui suivent.
const BUILD_VERSION =
  process.env.BUILD_VERSION ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GIT_COMMIT ||
  String(Date.now());

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    // Gzip compression (production only)
    process.env.NODE_ENV === 'production' && compression({
      verbose: false,
      disable: false,
      threshold: 1024,
      algorithm: 'gzip',
      ext: '.gz'
    }),
    // Brotli compression (production only) — 20-30% smaller than gzip
    process.env.NODE_ENV === 'production' && compression({
      verbose: false,
      disable: false,
      threshold: 1024,
      algorithm: 'brotliCompress',
      ext: '.br'
    })
  ].filter(Boolean),
  base: '/',
  server: {
    port: 5173,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    middlewareMode: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    reportCompressedSize: false,
    modulePreload: true,
    // Aggressive optimization for mobile
    assetsInlineLimit: 4096, // Inline small assets
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React — cached long-term, ~140KB
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-core';
          if (id.includes('react-router')) return 'react-router';
          // Network — loaded when app needs API
          if (id.includes('axios') || id.includes('socket.io') || id.includes('engine.io') || id.includes('component-emitter')) return 'network';
          // Icons — loaded on demand with pages
          if (id.includes('lucide-react')) return 'ui-icons';
          // Heavy libs — only loaded by specific pages
          if (id.includes('react-markdown')) return 'markdown';
          if (id.includes('xlsx') || id.includes('papaparse')) return 'excel';
          // Analytics — deferred, non-critical
          if (id.includes('posthog')) return 'analytics';
          // Date handling — moment is heavy, use smaller alternatives
          if (id.includes('moment')) return 'date-libs';
          // Utility libraries
          if (id.includes('lodash') || id.includes('underscore')) return 'utils';
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop().split('.')[0] : 'chunk';
          return `chunks/[name].[hash].js`;
        },
        entryFileNames: '[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp/i.test(ext)) {
            return `assets/images/[name].[hash][extname]`;
          } else if (/woff|woff2|ttf|otf|eot/.test(ext)) {
            return `assets/fonts/[name].[hash][extname]`;
          } else if (ext === 'css') {
            return `assets/css/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        },
        // Optimize imports
        globals: {
          __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production')
        }
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false
      },
      // External dependencies (don't bundle)
      external: [],
      input: {
        main: 'index.html'
      }
    },
    chunkSizeWarningLimit: 500,
  },
  publicDir: 'public',
  // Optimize resolver
  resolve: {
    alias: {
      '@': '/src'
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    supported: {
      bigint: true,
      'top-level-await': true
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'axios',
      'socket.io-client'
    ],
    exclude: ['ecomcookpit-shared']
  }
})

