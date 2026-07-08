import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — changes rarely, long cache lifetime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charts — large, only needed on analytics/scorecard pages
          'vendor-charts': ['recharts'],
          // Radix UI — UI primitives, changes with design updates
          'vendor-radix': [
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
          // Icons — large icon set
          'vendor-icons': ['lucide-react'],
          // State + utilities
          'vendor-utils': ['zustand', 'axios', 'sonner', 'clsx', 'tailwind-merge', 'class-variance-authority', 'date-fns'],
          // xlsx — only used in ESG Input CSV export, isolate it
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
});
