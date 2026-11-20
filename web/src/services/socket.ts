import { io, Socket } from 'socket.io-client';
import { PrintJob, PrintJobEvent } from '../types';

let socket: Socket | null = null;

/**
 * Dynamically resolves the Socket.IO URL.
 * Prevents connecting to localhost:5000 on mobile Android browsers.
 */
export function getSocketUrl(): string {
  const envSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.trim()) {
    return envSocketUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    // On local machine dev, use local port 5000
    if (isLocalhost) {
      return 'http://localhost:5000';
    }

    // On production or remote clients, connect to same-origin
    return window.location.origin;
  }

  return 'http://localhost:5000';
}

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: { token, role: 'user' },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 3000,
    timeout: 10000,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to Cloud Relay as User');
  });

  socket.on('connect_error', (err) => {
    // Graceful log for serverless or network restricted environments
    console.warn('[Socket] Real-time connection degraded (falling back to polling):', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected from Cloud Relay:', reason);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('[Socket] Disconnected manually');
  }
}

export function subscribeToJobUpdates(callback: (data: { job: PrintJob; event: PrintJobEvent }) => void) {
  socket?.on('job:updated', callback);
  return () => {
    socket?.off('job:updated', callback);
  };
}

export function subscribeToDeviceStatus(callback: (data: { deviceId: string; isOnline: boolean }) => void) {
  socket?.on('device:status_change', callback);
  return () => {
    socket?.off('device:status_change', callback);
  };
}

export function subscribeToDeviceTelemetry(callback: (data: any) => void) {
  socket?.on('device:telemetry', callback);
  return () => {
    socket?.off('device:telemetry', callback);
  };
}

export function subscribeToPrinterUpdates(callback: (data: { printer?: any; printers?: any[] }) => void) {
  const onSingle = (data: any) => callback(data);
  const onList = (data: any) => callback(data);
  socket?.on('printer:update', onSingle);
  socket?.on('printer:list_update', onList);
  return () => {
    socket?.off('printer:update', onSingle);
    socket?.off('printer:list_update', onList);
  };
}
