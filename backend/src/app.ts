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

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser agents, curl, mobile apps, or same-origin requests with undefined origin
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://print-anywhere-three.vercel.app',
      'https://print-anywhere-souvik-s-projects4.vercel.app',
      'https://print-anywhere.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5000',
      'capacitor://localhost',
      'http://localhost',
    ];

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }

    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-device-token',
    'x-correlation-id',
    'x-firebase-token',
  ],
  exposedHeaders: ['x-correlation-id'],
};

// Middleware
app.use(cors(corsOptions));
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
