import http from 'http';
import { app } from './app.js';
import { initSocketServer } from './socket/index.js';
import { DataStore } from './db/store.js';

const server = http.createServer(app);

// Initialize Socket.IO Server for real-time LAN/local fallback
initSocketServer(server);

// Periodic File Retention Cleanup
const store = DataStore.getInstance();
setInterval(() => {
  const cleaned = store.cleanExpiredFiles();
  if (cleaned > 0) {
    console.log(`[Retention] Cleaned up ${cleaned} expired print file(s).`);
  }
}, 30 * 60 * 1000); // Every 30 minutes

const PORT = parseInt(process.env.PORT || '5000', 10);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` PocketPrint Bridge Relay Server running on port ${PORT}`);
    console.log(` Local URL:   http://localhost:${PORT}`);
    console.log(` Health:      http://localhost:${PORT}/api/health`);
    console.log(` WebSocket:   ws://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

export { server, app };
