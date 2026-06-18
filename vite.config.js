import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    // Warn when any chunk exceeds this size (in KB)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — always needed, loaded first
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Charts only downloaded when analytics/daily-cost pages open
          'chart-vendor': ['recharts'],
          // PDF export — only downloaded when user clicks Export PDF
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          // Excel export — only downloaded when user clicks Export Excel
          'excel-vendor': ['xlsx'],
          // Icon library — medium sized, separate from main
          'icons-vendor': ['lucide-react'],
        },
      },
    },
  },
});