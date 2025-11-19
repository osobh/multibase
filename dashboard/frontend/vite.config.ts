import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Read dynamic port configuration from environment
// These are set by launch.sh in frontend/.env
const FRONTEND_PORT = parseInt(process.env.VITE_PORT || '5173', 10);
const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    cors: true,
    allowedHosts: ['mission.smartpi.ai', 'localhost', '192.168.1.3', 'host.docker.internal'],
    // HMR configuration for nginx reverse proxy
    // Browser auto-detects host, connects via WSS on port 443
    // Server binds locally, nginx proxies WebSocket connections
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true
      },
      '/socket.io': {
        target: BACKEND_URL,
        ws: true
      }
    }
  }
});
