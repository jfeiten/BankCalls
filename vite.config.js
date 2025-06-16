import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/customers': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/list_customers': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/update_customer_prediction': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/predictions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  }
}); 