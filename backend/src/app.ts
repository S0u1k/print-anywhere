import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import guestRoutes from './routes/guestRoutes.js';
import pairingRoutes from './routes/pairingRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import printerRoutes from './routes/printerRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import { initializeFirebaseAdmin } from './services/firebaseAdmin.js';

dotenv.config();

// Initialize Firebase Admin on startup
initializeFirebaseAdmin();

export const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'PocketPrint Bridge Cloud Relay',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/jobs', jobRoutes);

export default app;
