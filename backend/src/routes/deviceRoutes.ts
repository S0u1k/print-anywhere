import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';
import { requireSessionAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { generateDeviceToken } from '../utils/auth.js';
import { broadcastDeviceRevoked, broadcastToScope } from '../socket/index.js';

const uuidv4 = () => crypto.randomUUID();

const router = Router();
const store = DataStore.getInstance();

// List devices for current session scope (account or guest workspace)
router.get('/', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const scopeId = req.workspaceId!;
  const devices = store.findDevicesByScope(scopeId);
  res.json({ devices });
});

// Generate Pairing Code (Legacy endpoint preserved for backwards compatibility)
router.post('/pair-code', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const scopeId = req.workspaceId!;

  store.createPairingSession({
    id: `pair-${uuidv4().substring(0, 8)}`,
    pairingCode,
    qrToken: uuidv4(),
    userId: !req.isGuest ? scopeId : undefined,
    workspaceId: req.isGuest ? scopeId : undefined,
    initiatorDevice: {
      deviceId: `dev-web-${Date.now().toString().slice(-6)}`,
      name: 'PocketPrint Web Controller',
      deviceType: 'LAPTOP',
      os: 'Web Browser',
      role: 'CONTROLLER',
    },
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    expiresAt,
    createdAt: Date.now(),
  });

  const serverUrl = process.env.RELAY_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const qrPayload = JSON.stringify({
    pairingCode,
    serverUrl,
    userId: scopeId,
    expiresAt,
  });

  res.json({
    pairingCode,
    qrPayload,
    expiresAt,
    serverUrl,
  });
});

const pairDeviceSchema = z.object({
  pairingCode: z.string().min(6),
  deviceId: z.string().min(3),
  deviceName: z.string().min(2).optional(),
  gatewayType: z.enum(['WINDOWS_HOST', 'ANDROID_USB']).optional(),
});

// Complete Device Pairing (Legacy endpoint preserved)
router.post('/pair', async (req: Request, res: Response) => {
  try {
    const parse = pairDeviceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const { pairingCode, deviceId, deviceName, gatewayType } = parse.data;
    const session = store.findPairingSessionByCode(pairingCode);

    if (!session) {
      res.status(400).json({ error: 'Invalid or expired pairing code' });
      return;
    }

    const scopeId = session.workspaceId || session.userId!;
    const isGuest = !!session.workspaceId;

    store.markPairingSessionUsed(pairingCode, deviceId);

    const deviceToken = generateDeviceToken({
      deviceId,
      userId: !isGuest ? scopeId : undefined,
      workspaceId: isGuest ? scopeId : undefined,
      role: 'device',
      gatewayType: gatewayType || 'ANDROID_USB',
    });

    const device = store.upsertDevice({
      id: deviceId,
      userId: !isGuest ? scopeId : undefined,
      workspaceId: isGuest ? scopeId : undefined,
      name: deviceName || (gatewayType === 'WINDOWS_HOST' ? 'Windows Laptop Gateway' : 'Android Gateway Phone'),
      gatewayType: gatewayType || 'ANDROID_USB',
      roles: [gatewayType === 'WINDOWS_HOST' ? 'WINDOWS_GATEWAY' : 'ANDROID_GATEWAY'],
      deviceToken,
      isOnline: true,
      isPrinterConnected: true,
      printerModel: gatewayType === 'WINDOWS_HOST' ? 'Canon MG2500 series Printer' : 'Canon PIXMA MG2570S',
      printerVid: '0x04A9',
      printerPid: '0x176D',
      activeBackend: gatewayType === 'WINDOWS_HOST' ? 'Windows Canon Driver' : 'CanonPixmaBackend',
      batteryPercent: 100,
      lastSeenAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    res.status(200).json({
      message: 'Device paired successfully',
      device,
      deviceToken,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Device pairing failed', message: e.message });
  }
});

// Rename Device
router.patch('/:id', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const deviceId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Device name is required' });
    return;
  }

  const device = store.findDeviceById(deviceId);
  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Device not found or not owned by user' });
    return;
  }

  device.name = name.trim();
  device.updatedAt = Date.now();
  store.upsertDevice(device);

  res.json({ message: 'Device updated successfully', device });
});

// Revoke Device Access
router.post('/:id/revoke', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const deviceId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const device = store.findDeviceById(deviceId);

  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Device not found or not owned in current workspace' });
    return;
  }

  store.revokeDevice(deviceId);
  broadcastDeviceRevoked(deviceId);
  broadcastToScope(scopeId, 'device:revoked', { deviceId });

  res.json({
    message: `Device ${device.name} (${deviceId}) authorization revoked successfully`,
    revoked: true,
    deviceId,
  });
});

// Delete / Unpair device
router.delete('/:id', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const deviceId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const device = store.findDeviceById(deviceId);

  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Device not found or not owned in current workspace' });
    return;
  }

  store.revokeDevice(deviceId);
  store.deleteDevice(deviceId);
  broadcastDeviceRevoked(deviceId);
  broadcastToScope(scopeId, 'device:removed', { deviceId });

  res.json({ message: 'Device unpaired and deleted successfully' });
});

export default router;
