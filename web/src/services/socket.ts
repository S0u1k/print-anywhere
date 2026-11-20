import { io, Socket } from 'socket.io-client';
import { PrintJob, PrintJobEvent } from '../types';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function connectSocket(token: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token, role: 'user' },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to Cloud Relay as User');
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from Cloud Relay');
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
