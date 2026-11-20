import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { DataStore } from '../db/store.js';
import { verifyToken } from '../utils/auth.js';
import { AuthTokenPayload, DeviceTokenPayload, PrintJob, JobStatus } from '../types/index.js';

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 15000,
  });

  const store = DataStore.getInstance();

  io.use((socket: Socket, next) => {
    const auth = socket.handshake.auth;
    const token = auth.token;
    const role = auth.role;

    // Allow pairing room listeners without full credentials
    if (role === 'pairing' || auth.pairingSessionId) {
      (socket as any).pairingSessionId = auth.pairingSessionId;
      return next();
    }

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    if (role === 'device') {
      const payload = verifyToken<DeviceTokenPayload>(token);
      if (payload && payload.deviceId) {
        // Verify device is not revoked
        if (store.isDeviceRevoked(payload.deviceId)) {
          return next(new Error('Device authorization revoked'));
        }
        (socket as any).device = payload;
        return next();
      }
      return next(new Error('Device authentication failed: Invalid token'));
    } else {
      const payload = verifyToken<AuthTokenPayload>(token);
      if (payload && (payload.userId || payload.workspaceId)) {
        (socket as any).user = payload;
        return next();
      }
      return next(new Error('User or workspace authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userPayload = (socket as any).user as AuthTokenPayload | undefined;
    const devicePayload = (socket as any).device as DeviceTokenPayload | undefined;
    const pairingSessionId = (socket as any).pairingSessionId as string | undefined;

    // Join pairing room if requested
    if (pairingSessionId) {
      const pairingRoom = `pairing:${pairingSessionId}`;
      socket.join(pairingRoom);
      console.log(`[Socket] Client joined pairing room: ${pairingRoom}`);
    }

    socket.on('pairing:join', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        const pairingRoom = `pairing:${data.sessionId}`;
        socket.join(pairingRoom);
        console.log(`[Socket] Explicit pairing:join -> ${pairingRoom}`);
      }
    });

    if (userPayload) {
      const scopeId = userPayload.workspaceId || userPayload.userId;
      const userRoom = `user:${scopeId}`;
      const wsRoom = `workspace:${scopeId}`;
      socket.join(userRoom);
      socket.join(wsRoom);
      console.log(`[Socket] Client connected: ${userPayload.email || userPayload.name} -> joined ${userRoom}`);
    }

    if (devicePayload) {
      const deviceRoom = `device:${devicePayload.deviceId}`;
      socket.join(deviceRoom);
      const scopeId = devicePayload.workspaceId || devicePayload.userId;
      if (scopeId) {
        socket.join(`workspace:${scopeId}`);
      }

      const isWindows = devicePayload.deviceId.includes('laptop') || devicePayload.deviceId.includes('win');
      const defaultGwType = isWindows ? 'WINDOWS_HOST' : 'ANDROID_USB';
      console.log(`[Socket] Gateway connected: ${devicePayload.deviceId} (${defaultGwType}) -> joined ${deviceRoom}`);

      // Handle Gateway / Device Registration
      socket.on('device:register', (data: any) => {
        console.log(`[Socket] Gateway registered:`, data);
        const gwType = data.gatewayType || defaultGwType;
        store.updateDeviceOnline(devicePayload.deviceId, true, {
          name: data.name || (gwType === 'WINDOWS_HOST' ? 'Windows Laptop Gateway' : 'Android Gateway Phone'),
          gatewayType: gwType,
          isPrinterConnected: !!data.isPrinterConnected,
          printerModel: data.printerModel || null,
          printerVid: data.printerVid || null,
          printerPid: data.printerPid || null,
          activeBackend: data.activeBackend || (gwType === 'WINDOWS_HOST' ? 'Windows USB Spooler' : 'CanonPixmaBackend'),
          batteryPercent: data.batteryPercent !== undefined ? data.batteryPercent : 100,
        });

        const dev = store.findDeviceById(devicePayload.deviceId);
        if (dev) {
          const targetRoom = dev.workspaceId ? `workspace:${dev.workspaceId}` : `user:${dev.userId}`;
          io?.to(targetRoom).emit('device:status_change', {
            deviceId: dev.id,
            isOnline: true,
            gatewayType: dev.gatewayType,
            isPrinterConnected: dev.isPrinterConnected,
            printerModel: dev.printerModel,
            batteryPercent: dev.batteryPercent,
          });
        }
      });

      // Handle Printer Status Announcement
      socket.on('printer:status', (data: any) => {
        console.log(`[Socket] Printer status received for ${data.id || data.name}:`, data);
        if (data.id) {
          const printer = store.upsertPrinter({
            id: data.id,
            deviceId: devicePayload.deviceId,
            userId: devicePayload.userId,
            workspaceId: devicePayload.workspaceId,
            name: data.name || 'Canon PIXMA MG2570S',
            manufacturer: data.manufacturer || 'Canon',
            model: data.model || 'Canon PIXMA MG2570S',
            gatewayType: data.gatewayType || defaultGwType,
            connectionType: data.connectionType || (defaultGwType === 'WINDOWS_HOST' ? 'USB' : 'USB_OTG'),
            driverIdentifier: data.driverIdentifier || (defaultGwType === 'WINDOWS_HOST' ? 'Canon MG2500 series Printer' : 'CanonPixmaBackend'),
            compatibilityStatus: data.compatibilityStatus || 'COMPATIBLE',
            isOnline: data.isOnline !== undefined ? data.isOnline : true,
            status: data.status || 'READY',
            lastSeenAt: Date.now(),
            capabilities: data.capabilities || {
              color: true,
              duplex: false,
              dpi: [300, 600],
              paperSizes: ['A4', 'LETTER'],
            },
            createdAt: Date.now(),
          });

          const dev = store.findDeviceById(devicePayload.deviceId);
          const targetRoom = dev?.workspaceId ? `workspace:${dev.workspaceId}` : `user:${dev?.userId}`;
          io?.to(targetRoom).emit('printer:update', printer);
        }
      });

      // Handle Heartbeat
      socket.on('device:heartbeat', (data: any) => {
        store.updateDeviceOnline(devicePayload.deviceId, true, {
          batteryPercent: data?.batteryPercent !== undefined ? data.batteryPercent : 100,
          isPrinterConnected: data?.isPrinterConnected !== undefined ? data.isPrinterConnected : true,
          printerModel: data?.printerModel || undefined,
        });
      });

      // Handle Job Status Updates from Gateway
      socket.on('job:status_update', (data: {
        jobId: string;
        status: JobStatus;
        progressPercent: number;
        message?: string;
        isSimulated?: boolean;
      }) => {
        console.log(`[Socket] Job status update: ${data.jobId} -> ${data.status} (${data.progressPercent}%)`);
        const updated = store.updatePrintJobStatus(
          data.jobId,
          data.status,
          data.progressPercent,
          data.message,
          data.isSimulated
        );

        if (updated) {
          const targetRoom = updated.workspaceId ? `workspace:${updated.workspaceId}` : `user:${updated.userId}`;
          io?.to(targetRoom).emit('job:update', {
            jobId: updated.id,
            status: updated.status,
            progressPercent: updated.progressPercent,
            errorMessage: updated.errorMessage,
            isSimulated: updated.isSimulated,
            event: {
              status: data.status,
              progressPercent: data.progressPercent,
              message: data.message,
              isSimulated: data.isSimulated,
              timestamp: Date.now(),
            },
          });
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Device disconnected: ${devicePayload.deviceId}`);
        store.updateDeviceOnline(devicePayload.deviceId, false);
        const dev = store.findDeviceById(devicePayload.deviceId);
        if (dev) {
          const targetRoom = dev.workspaceId ? `workspace:${dev.workspaceId}` : `user:${dev.userId}`;
          io?.to(targetRoom).emit('device:status_change', {
            deviceId: dev.id,
            isOnline: false,
          });
        }
      });
    }
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

export function broadcastToPairingSession(sessionId: string, event: string, data: any): void {
  if (!io) return;
  const room = `pairing:${sessionId}`;
  console.log(`[Socket] Emitting ${event} to room ${room}`);
  io.to(room).emit(event, data);
}

export function broadcastToScope(scopeId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`workspace:${scopeId}`).emit(event, data);
  io.to(`user:${scopeId}`).emit(event, data);
}

export function broadcastDeviceRevoked(deviceId: string): void {
  if (!io) return;
  io.to(`device:${deviceId}`).emit('device:revoked', { deviceId });
}

export function dispatchJobToDevice(job: PrintJob): boolean {
  if (!io) return false;
  const deviceRoom = `device:${job.deviceId}`;
  console.log(`[Socket] Emitting job:incoming to ${deviceRoom} for job ${job.id}`);
  io.to(deviceRoom).emit('job:incoming', job);
  return true;
}

export function dispatchCancelToDevice(deviceId: string, jobId: string): boolean {
  if (!io) return false;
  const deviceRoom = `device:${deviceId}`;
  io.to(deviceRoom).emit('job:cancel', jobId);
  return true;
}
