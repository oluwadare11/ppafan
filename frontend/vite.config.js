/* eslint-env node */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Maintain empty alias configuration as per original setup
    },
  },
  optimizeDeps: {
    include: ['xlsx'],
  },
  define: {
    // Empty API URL in dev to use proxy, full URL in prod
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || ''
    ),
    'import.meta.env.VITE_FRONTEND_URL': JSON.stringify(
      process.env.VITE_FRONTEND_URL || 'http://localhost:5173'
    ),
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow external connections for subdomain testing
    open: false, // Don't auto-open, we'll use specific URLs
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        ws: true, // WebSocket support
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying:', req.method, req.url);
          });
        }
      },
      // Proxy uploads for logo and media files
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable source maps in production for smaller builds
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        // Code splitting for better caching and faster initial load
        manualChunks: {
          // Core React - rarely changes
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'vendor-ui': ['@heroicons/react', 'lucide-react', 'react-icons'],
          // Charts - large, lazy load
          'vendor-charts': ['recharts', 'chart.js', 'react-chartjs-2'],
          // PDF/Export - large, only needed for exports
          'vendor-pdf': ['xlsx', 'file-saver'],
          // Utilities
          'vendor-utils': ['axios', 'lodash'],
        },
      },
    },
    // Increase chunk size warning limit since we're splitting intentionally
    chunkSizeWarningLimit: 600,
  },
  css: {
    preprocessorOptions: {
      css: {
        charset: false,
      },
    },
  },
});
