import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const target = (env.VITE_API_BASE_URL || 'http://localhost:3010').replace(/\/+$/, '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    plugins: [react()],
    base,
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/uploads': { target, changeOrigin: true }
      }
    }
  };
});
