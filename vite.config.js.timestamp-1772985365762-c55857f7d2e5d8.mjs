// vite.config.js
import { defineConfig } from "file:///C:/Users/Morgan/Desktop/ecomcookpit-main%20(1)/scalor/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Morgan/Desktop/ecomcookpit-main%20(1)/scalor/node_modules/@vitejs/plugin-react/dist/index.js";
import compression from "file:///C:/Users/Morgan/Desktop/ecomcookpit-main%20(1)/scalor/node_modules/vite-plugin-compression/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic"
    }),
    // Gzip compression (production only)
    process.env.NODE_ENV === "production" && compression({
      verbose: false,
      disable: false,
      threshold: 1024,
      algorithm: "gzip",
      ext: ".gz"
    }),
    // Brotli compression (production only) — 20-30% smaller than gzip
    process.env.NODE_ENV === "production" && compression({
      verbose: false,
      disable: false,
      threshold: 1024,
      algorithm: "brotliCompress",
      ext: ".br"
    })
  ].filter(Boolean),
  base: "/",
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false
      },
      "/socket.io": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    // Speed up dev server
    middlewareMode: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 5173
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    cssCodeSplit: true,
    cssMinify: "esbuild",
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("react-dom") || id.includes("/react/")) return "react-core";
          if (id.includes("react-router")) return "react-router";
          if (id.includes("axios") || id.includes("socket.io") || id.includes("engine.io") || id.includes("component-emitter")) return "network";
          if (id.includes("lucide-react")) return "ui-icons";
          if (id.includes("react-markdown")) return "markdown";
          if (id.includes("xlsx") || id.includes("papaparse")) return "excel";
          if (id.includes("posthog")) return "analytics";
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split("/").pop().split(".")[0] : "chunk";
          return `chunks/[name].[hash].js`;
        },
        entryFileNames: "[name].[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split(".");
          const ext = info[info.length - 1];
          if (/png|jpe?g|gif|svg|webp/i.test(ext)) {
            return `assets/images/[name].[hash][extname]`;
          } else if (/woff|woff2|ttf|otf|eot/.test(ext)) {
            return `assets/fonts/[name].[hash][extname]`;
          } else if (ext === "css") {
            return `assets/css/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        },
        // Optimize imports
        globals: {
          __DEV__: JSON.stringify(process.env.NODE_ENV !== "production")
        }
      },
      // External dependencies (don't bundle)
      external: [],
      input: {
        main: "index.html"
      }
    },
    chunkSizeWarningLimit: 500
  },
  publicDir: "public",
  // Optimize resolver
  resolve: {
    alias: {
      "@": "/src"
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"]
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    supported: {
      bigint: true,
      "top-level-await": true
    }
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "axios",
      "socket.io-client"
    ],
    exclude: ["ecomcookpit-shared"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNb3JnYW5cXFxcRGVza3RvcFxcXFxlY29tY29va3BpdC1tYWluICgxKVxcXFxzY2Fsb3JcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXE1vcmdhblxcXFxEZXNrdG9wXFxcXGVjb21jb29rcGl0LW1haW4gKDEpXFxcXHNjYWxvclxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvTW9yZ2FuL0Rlc2t0b3AvZWNvbWNvb2twaXQtbWFpbiUyMCgxKS9zY2Fsb3Ivdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IGNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJ1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KHtcbiAgICAgIGpzeFJ1bnRpbWU6ICdhdXRvbWF0aWMnLFxuICAgIH0pLFxuICAgIC8vIEd6aXAgY29tcHJlc3Npb24gKHByb2R1Y3Rpb24gb25seSlcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ3Byb2R1Y3Rpb24nICYmIGNvbXByZXNzaW9uKHtcbiAgICAgIHZlcmJvc2U6IGZhbHNlLFxuICAgICAgZGlzYWJsZTogZmFsc2UsXG4gICAgICB0aHJlc2hvbGQ6IDEwMjQsXG4gICAgICBhbGdvcml0aG06ICdnemlwJyxcbiAgICAgIGV4dDogJy5neidcbiAgICB9KSxcbiAgICAvLyBCcm90bGkgY29tcHJlc3Npb24gKHByb2R1Y3Rpb24gb25seSkgXHUyMDE0IDIwLTMwJSBzbWFsbGVyIHRoYW4gZ3ppcFxuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgJiYgY29tcHJlc3Npb24oe1xuICAgICAgdmVyYm9zZTogZmFsc2UsXG4gICAgICBkaXNhYmxlOiBmYWxzZSxcbiAgICAgIHRocmVzaG9sZDogMTAyNCxcbiAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgIGV4dDogJy5icidcbiAgICB9KVxuICBdLmZpbHRlcihCb29sZWFuKSxcbiAgYmFzZTogJy8nLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiA1MTczLFxuICAgIG9wZW46IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwODAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgIH0sXG4gICAgICAnL3NvY2tldC5pbyc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDo4MDgwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZVxuICAgICAgfVxuICAgIH0sXG4gICAgLy8gU3BlZWQgdXAgZGV2IHNlcnZlclxuICAgIG1pZGRsZXdhcmVNb2RlOiBmYWxzZSxcbiAgICBobXI6IHtcbiAgICAgIHByb3RvY29sOiAnd3MnLFxuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICBwb3J0OiA1MTczXG4gICAgfVxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIHNvdXJjZW1hcDogZmFsc2UsXG4gICAgbWluaWZ5OiAnZXNidWlsZCcsXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcbiAgICBjc3NDb2RlU3BsaXQ6IHRydWUsXG4gICAgY3NzTWluaWZ5OiAnZXNidWlsZCcsXG4gICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLFxuICAgIG1vZHVsZVByZWxvYWQ6IHsgcG9seWZpbGw6IGZhbHNlIH0sXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIC8vIENvcmUgUmVhY3QgXHUyMDE0IGNhY2hlZCBsb25nLXRlcm0sIH4xNDBLQlxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QtZG9tJykgfHwgaWQuaW5jbHVkZXMoJy9yZWFjdC8nKSkgcmV0dXJuICdyZWFjdC1jb3JlJztcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3JlYWN0LXJvdXRlcicpKSByZXR1cm4gJ3JlYWN0LXJvdXRlcic7XG4gICAgICAgICAgLy8gTmV0d29yayBcdTIwMTQgbG9hZGVkIHdoZW4gYXBwIG5lZWRzIEFQSVxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnYXhpb3MnKSB8fCBpZC5pbmNsdWRlcygnc29ja2V0LmlvJykgfHwgaWQuaW5jbHVkZXMoJ2VuZ2luZS5pbycpIHx8IGlkLmluY2x1ZGVzKCdjb21wb25lbnQtZW1pdHRlcicpKSByZXR1cm4gJ25ldHdvcmsnO1xuICAgICAgICAgIC8vIEljb25zIFx1MjAxNCBsb2FkZWQgb24gZGVtYW5kIHdpdGggcGFnZXNcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpKSByZXR1cm4gJ3VpLWljb25zJztcbiAgICAgICAgICAvLyBIZWF2eSBsaWJzIFx1MjAxNCBvbmx5IGxvYWRlZCBieSBzcGVjaWZpYyBwYWdlc1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygncmVhY3QtbWFya2Rvd24nKSkgcmV0dXJuICdtYXJrZG93bic7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCd4bHN4JykgfHwgaWQuaW5jbHVkZXMoJ3BhcGFwYXJzZScpKSByZXR1cm4gJ2V4Y2VsJztcbiAgICAgICAgICAvLyBBbmFseXRpY3MgXHUyMDE0IGRlZmVycmVkLCBub24tY3JpdGljYWxcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3Bvc3Rob2cnKSkgcmV0dXJuICdhbmFseXRpY3MnO1xuICAgICAgICB9LFxuICAgICAgICAvLyBPcHRpbWl6ZSBjaHVuayBuYW1pbmdcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6IChjaHVua0luZm8pID0+IHtcbiAgICAgICAgICBjb25zdCBmYWNhZGVNb2R1bGVJZCA9IGNodW5rSW5mby5mYWNhZGVNb2R1bGVJZCA/IGNodW5rSW5mby5mYWNhZGVNb2R1bGVJZC5zcGxpdCgnLycpLnBvcCgpLnNwbGl0KCcuJylbMF0gOiAnY2h1bmsnO1xuICAgICAgICAgIHJldHVybiBgY2h1bmtzL1tuYW1lXS5baGFzaF0uanNgO1xuICAgICAgICB9LFxuICAgICAgICBlbnRyeUZpbGVOYW1lczogJ1tuYW1lXS5baGFzaF0uanMnLFxuICAgICAgICBhc3NldEZpbGVOYW1lczogKGFzc2V0SW5mbykgPT4ge1xuICAgICAgICAgIGNvbnN0IGluZm8gPSBhc3NldEluZm8ubmFtZS5zcGxpdCgnLicpO1xuICAgICAgICAgIGNvbnN0IGV4dCA9IGluZm9baW5mby5sZW5ndGggLSAxXTtcbiAgICAgICAgICBpZiAoL3BuZ3xqcGU/Z3xnaWZ8c3ZnfHdlYnAvaS50ZXN0KGV4dCkpIHtcbiAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL2ltYWdlcy9bbmFtZV0uW2hhc2hdW2V4dG5hbWVdYDtcbiAgICAgICAgICB9IGVsc2UgaWYgKC93b2ZmfHdvZmYyfHR0ZnxvdGZ8ZW90Ly50ZXN0KGV4dCkpIHtcbiAgICAgICAgICAgIHJldHVybiBgYXNzZXRzL2ZvbnRzL1tuYW1lXS5baGFzaF1bZXh0bmFtZV1gO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZXh0ID09PSAnY3NzJykge1xuICAgICAgICAgICAgcmV0dXJuIGBhc3NldHMvY3NzL1tuYW1lXS5baGFzaF1bZXh0bmFtZV1gO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYGFzc2V0cy9bbmFtZV0uW2hhc2hdW2V4dG5hbWVdYDtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gT3B0aW1pemUgaW1wb3J0c1xuICAgICAgICBnbG9iYWxzOiB7XG4gICAgICAgICAgX19ERVZfXzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJylcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIC8vIEV4dGVybmFsIGRlcGVuZGVuY2llcyAoZG9uJ3QgYnVuZGxlKVxuICAgICAgZXh0ZXJuYWw6IFtdLFxuICAgICAgaW5wdXQ6IHtcbiAgICAgICAgbWFpbjogJ2luZGV4Lmh0bWwnXG4gICAgICB9XG4gICAgfSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMCxcbiAgfSxcbiAgcHVibGljRGlyOiAncHVibGljJyxcbiAgLy8gT3B0aW1pemUgcmVzb2x2ZXJcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6ICcvc3JjJ1xuICAgIH0sXG4gICAgZXh0ZW5zaW9uczogWycubWpzJywgJy5qcycsICcudHMnLCAnLmpzeCcsICcudHN4JywgJy5qc29uJ11cbiAgfSxcbiAgZXNidWlsZDoge1xuICAgIGRyb3A6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFtdLFxuICAgIHN1cHBvcnRlZDoge1xuICAgICAgYmlnaW50OiB0cnVlLFxuICAgICAgJ3RvcC1sZXZlbC1hd2FpdCc6IHRydWVcbiAgICB9XG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICdyZWFjdCcsXG4gICAgICAncmVhY3QtZG9tJyxcbiAgICAgICdyZWFjdC1kb20vY2xpZW50JyxcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcbiAgICAgICdheGlvcycsXG4gICAgICAnc29ja2V0LmlvLWNsaWVudCdcbiAgICBdLFxuICAgIGV4Y2x1ZGU6IFsnZWNvbWNvb2twaXQtc2hhcmVkJ11cbiAgfVxufSlcblxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VixTQUFTLG9CQUFvQjtBQUN0WCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFHeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLE1BQ0osWUFBWTtBQUFBLElBQ2QsQ0FBQztBQUFBO0FBQUEsSUFFRCxRQUFRLElBQUksYUFBYSxnQkFBZ0IsWUFBWTtBQUFBLE1BQ25ELFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULFdBQVc7QUFBQSxNQUNYLFdBQVc7QUFBQSxNQUNYLEtBQUs7QUFBQSxJQUNQLENBQUM7QUFBQTtBQUFBLElBRUQsUUFBUSxJQUFJLGFBQWEsZ0JBQWdCLFlBQVk7QUFBQSxNQUNuRCxTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxXQUFXO0FBQUEsTUFDWCxXQUFXO0FBQUEsTUFDWCxLQUFLO0FBQUEsSUFDUCxDQUFDO0FBQUEsRUFDSCxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDWixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsTUFDTjtBQUFBLElBQ0Y7QUFBQTtBQUFBLElBRUEsZ0JBQWdCO0FBQUEsSUFDaEIsS0FBSztBQUFBLE1BQ0gsVUFBVTtBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1I7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixjQUFjO0FBQUEsSUFDZCxXQUFXO0FBQUEsSUFDWCxzQkFBc0I7QUFBQSxJQUN0QixlQUFlLEVBQUUsVUFBVSxNQUFNO0FBQUEsSUFDakMsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBRWYsY0FBSSxHQUFHLFNBQVMsV0FBVyxLQUFLLEdBQUcsU0FBUyxTQUFTLEVBQUcsUUFBTztBQUMvRCxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUV4QyxjQUFJLEdBQUcsU0FBUyxPQUFPLEtBQUssR0FBRyxTQUFTLFdBQVcsS0FBSyxHQUFHLFNBQVMsV0FBVyxLQUFLLEdBQUcsU0FBUyxtQkFBbUIsRUFBRyxRQUFPO0FBRTdILGNBQUksR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBRXhDLGNBQUksR0FBRyxTQUFTLGdCQUFnQixFQUFHLFFBQU87QUFDMUMsY0FBSSxHQUFHLFNBQVMsTUFBTSxLQUFLLEdBQUcsU0FBUyxXQUFXLEVBQUcsUUFBTztBQUU1RCxjQUFJLEdBQUcsU0FBUyxTQUFTLEVBQUcsUUFBTztBQUFBLFFBQ3JDO0FBQUE7QUFBQSxRQUVBLGdCQUFnQixDQUFDLGNBQWM7QUFDN0IsZ0JBQU0saUJBQWlCLFVBQVUsaUJBQWlCLFVBQVUsZUFBZSxNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUUsTUFBTSxHQUFHLEVBQUUsQ0FBQyxJQUFJO0FBQzVHLGlCQUFPO0FBQUEsUUFDVDtBQUFBLFFBQ0EsZ0JBQWdCO0FBQUEsUUFDaEIsZ0JBQWdCLENBQUMsY0FBYztBQUM3QixnQkFBTSxPQUFPLFVBQVUsS0FBSyxNQUFNLEdBQUc7QUFDckMsZ0JBQU0sTUFBTSxLQUFLLEtBQUssU0FBUyxDQUFDO0FBQ2hDLGNBQUksMEJBQTBCLEtBQUssR0FBRyxHQUFHO0FBQ3ZDLG1CQUFPO0FBQUEsVUFDVCxXQUFXLHlCQUF5QixLQUFLLEdBQUcsR0FBRztBQUM3QyxtQkFBTztBQUFBLFVBQ1QsV0FBVyxRQUFRLE9BQU87QUFDeEIsbUJBQU87QUFBQSxVQUNUO0FBQ0EsaUJBQU87QUFBQSxRQUNUO0FBQUE7QUFBQSxRQUVBLFNBQVM7QUFBQSxVQUNQLFNBQVMsS0FBSyxVQUFVLFFBQVEsSUFBSSxhQUFhLFlBQVk7QUFBQSxRQUMvRDtBQUFBLE1BQ0Y7QUFBQTtBQUFBLE1BRUEsVUFBVSxDQUFDO0FBQUEsTUFDWCxPQUFPO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUjtBQUFBLElBQ0Y7QUFBQSxJQUNBLHVCQUF1QjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxXQUFXO0FBQUE7QUFBQSxFQUVYLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUs7QUFBQSxJQUNQO0FBQUEsSUFDQSxZQUFZLENBQUMsUUFBUSxPQUFPLE9BQU8sUUFBUSxRQUFRLE9BQU87QUFBQSxFQUM1RDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTSxRQUFRLElBQUksYUFBYSxlQUFlLENBQUMsV0FBVyxVQUFVLElBQUksQ0FBQztBQUFBLElBQ3pFLFdBQVc7QUFBQSxNQUNULFFBQVE7QUFBQSxNQUNSLG1CQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUztBQUFBLE1BQ1A7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Y7QUFBQSxJQUNBLFNBQVMsQ0FBQyxvQkFBb0I7QUFBQSxFQUNoQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
