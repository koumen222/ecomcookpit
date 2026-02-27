import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Fast refresh for optimized dev experience
      jsxImportSource: 'react',
      babel: {
        plugins: [
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }]
        ]
      }
    }),
    // Gzip + brotli compression (only in production)
    process.env.NODE_ENV === 'production' && compression({
      verbose: true,
      disable: false,
      threshold: 1024,
      algorithm: 'gzip',
      ext: '.gz'
    })
  ].filter(Boolean),
  base: '/',
  server: {
    port: 5173,
    open: true,
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
    // Speed up dev server
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
    reportCompressedSize: false,
    // Optimized for modern bundlers
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2
      },
      mangle: true
    },
    rollupOptions: {
      output: {
        // Improved chunking strategy
        manualChunks: {
          // Core React runtime
          'react-core': ['react', 'react-dom', 'react-router-dom'],
          
          // Network utilities
          'network': ['axios', 'socket.io-client'],
          
          // UI components
          'ui-icons': ['react-icons', 'lucide-react'],
          
          // Large dependencies
          'markdown': ['react-markdown'],
          'excel': ['xlsx', 'papaparse'],
          
          // Vendor bundle (everything else)
          'vendor': [
            'posthog-js',
            '@socket.io/component-emitter',
            'engine.io-client'
          ]
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
      // External dependencies (don't bundle)
      external: [],
      input: {
        main: 'index.html'
      }
    },
    chunkSizeWarningLimit: 1000,
    lib: undefined
  },
  publicDir: 'public',
  // Optimize resolver
  resolve: {
    alias: {
      '@': '/src'
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  // Module optimization
  ssr: undefined,
  // Esbuild options
  esbuild: {
    supported: {
      bigint: true,
      'top-level-await': true
    }
  },
  // Optimize deps
  optimizeDeps: {
    // Pre-bundle frequently used deps
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'socket.io-client'
    ],
    // Exclude problematic deps
    exclude: ['ecomcookpit-shared']
  }
})

