import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';

const uuidv4 = () => crypto.randomUUID();
import {
  generatePairingCode,
  generateQrToken,
  generateDeviceToken,
  generateRecoveryKey,
  hashSecret,
  verifyToken,
  normalizePairingCode,
} from '../utils/auth.js';
import {
  broadcastToPairingSession,
  broadcastToScope,
} from '../socket/index.js';
import {
  PairingSession,
  DeviceSummary,
  AuthTokenPayload,
  GatewayType,
  DeviceRole,
  DeviceType,
} from '../types/index.js';

const router = Router();
const store = DataStore.getInstance();

const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutes expiry
const MAX_CLAIM_ATTEMPTS = 5;

/**
 * Helper to extract or dynamically create an ownership workspace for pairing
 */
function resolveOrCreateWorkspace(req: Request): { scopeId: string; isNewGuest: boolean; recoveryKey?: string } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyToken<AuthTokenPayload>(authHeader.split(' ')[1]);
    if (payload && (payload.workspaceId || payload.userId)) {
      return { scopeId: payload.workspaceId || payload.userId!, isNewGuest: false };
    }
  }

  // If no session provided, generate a fresh Guest Workspace
  const workspaceId = `ws-guest-${uuidv4().substring(0, 10)}`;
  const recoveryKey = generateRecoveryKey();
  const recoveryKeyHash = hashSecret(recoveryKey);
  const ownershipKey = uuidv4();
  const ownershipKeyHash = hashSecret(ownershipKey);

  store.createGuestWorkspace({
    id: workspaceId,
    name: `Guest Workspace (${workspaceId.slice(-6)})`,
    ownershipKeyHash,
    recoveryKeyHash,
    pairedDeviceIds: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });

  return { scopeId: workspaceId, isNewGuest: true, recoveryKey };
}

/**
 * POST /api/pairing/sessions
 * Initiates a new bidirectional pairing session (creates QR payload & 8-digit manual code).
 */
router.post('/sessions', (req: Request, res: Response) => {
  try {
    const {
      initiatorDeviceId,
      initiatorDeviceName,
      initiatorDeviceType,
      initiatorOs,
      initiatorGatewayRole,
      printerModel,
    } = req.body;

    if (!initiatorDeviceId || !initiatorDeviceName) {
      res.status(400).json({ error: 'initiatorDeviceId and initiatorDeviceName are required' });
      return;
    }

    const { scopeId, isNewGuest, recoveryKey } = resolveOrCreateWorkspace(req);
    const sessionId = `pair-${uuidv4().substring(0, 8)}`;
    const pairingCode = generatePairingCode();
    const qrToken = generateQrToken();

    const initiator: DeviceSummary = {
      deviceId: initiatorDeviceId,
      name: initiatorDeviceName,
      deviceType: (initiatorDeviceType as DeviceType) || 'LAPTOP',
      os: initiatorOs || 'Windows 11',
      role: (initiatorGatewayRole as DeviceRole) || 'CONTROLLER',
      gatewayType: initiatorGatewayRole === 'WINDOWS_GATEWAY' ? 'WINDOWS_HOST' : initiatorGatewayRole === 'ANDROID_GATEWAY' ? 'ANDROID_USB' : undefined,
      printerModel: printerModel || null,
    };

    const session: PairingSession = {
      id: sessionId,
      pairingCode,
      qrToken,
      workspaceId: scopeId.startsWith('ws-') ? scopeId : undefined,
      userId: !scopeId.startsWith('ws-') ? scopeId : undefined,
      initiatorDevice: initiator,
      status: 'PENDING',
      attempts: 0,
      maxAttempts: MAX_CLAIM_ATTEMPTS,
      expiresAt: Date.now() + SESSION_TTL_MS,
      createdAt: Date.now(),
    };

    store.createPairingSession(session);

    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;

    res.status(201).json({
      message: 'Pairing session initialized',
      sessionId,
      pairingCode,
      qrToken,
      expiresAt: session.expiresAt,
      workspaceId: scopeId,
      isNewGuest,
      recoveryKey: recoveryKey || null,
      qrPayload: {
        sessionId,
        qrToken,
        pairingCode,
        serverUrl,
        initiatorName: initiator.name,
        initiatorType: initiator.deviceType,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create pairing session', message: err.message });
  }
});

/**
 * Common claim handling logic
 */
function handleClaim(
  session: PairingSession,
  body: any,
  res: Response
) {
  const now = Date.now();

  // Expiration check
  if (now > session.expiresAt || session.status === 'EXPIRED') {
    session.status = 'EXPIRED';
    store.updatePairingSession(session.id, { status: 'EXPIRED' });
    res.status(410).json({
      error: 'This pairing code has expired. Generate a new code on the other device.',
      code: 'PAIRING_CODE_EXPIRED',
    });
    return;
  }

  // Attempt limit check
  session.attempts++;
  if (session.attempts > session.maxAttempts) {
    session.status = 'EXPIRED';
    store.updatePairingSession(session.id, { status: 'EXPIRED' });
    res.status(429).json({
      error: 'Too many invalid attempts. Session terminated.',
      code: 'PAIRING_ATTEMPTS_EXCEEDED',
    });
    return;
  }

  // Already claimed or completed check
  if (session.status === 'COMPLETED') {
    res.status(409).json({
      error: 'This code has already been used. Generate a new pairing code.',
      code: 'PAIRING_CODE_ALREADY_USED',
    });
    return;
  }

  if (session.status !== 'PENDING') {
    res.status(400).json({
      error: `Session is not pending (current status: ${session.status})`,
      code: 'PAIRING_CODE_INVALID',
    });
    return;
  }

  // Code or QR token match check (Canonical normalization)
  const providedCode = normalizePairingCode(body.pairingCode);
  const expectedCode = normalizePairingCode(session.pairingCode);
  const providedQrToken = body.qrToken?.trim();

  const codeMatches = providedCode && providedCode === expectedCode;
  const qrMatches = providedQrToken && providedQrToken === session.qrToken;

  if (!codeMatches && !qrMatches) {
    store.updatePairingSession(session.id, { attempts: session.attempts });
    res.status(403).json({
      error: 'Invalid pairing code or QR token',
      code: 'PAIRING_CODE_INVALID',
      remainingAttempts: session.maxAttempts - session.attempts,
    });
    return;
  }

  // Device Role compatibility validation (Section 7)
  const initiatorRole = session.initiatorDevice.role;
  const claimerRole = (body.claimerGatewayRole as DeviceRole) || 'CONTROLLER';

  if (
    (initiatorRole === 'ANDROID_GATEWAY' && claimerRole === 'ANDROID_GATEWAY') ||
    (initiatorRole === 'WINDOWS_GATEWAY' && claimerRole === 'WINDOWS_GATEWAY')
  ) {
    res.status(400).json({
      error: 'Conflicting device roles: Two devices cannot both claim the same gateway role in one pairing session.',
      code: 'PAIRING_DEVICE_ROLE_INVALID',
    });
    return;
  }

  const claimer: DeviceSummary = {
    deviceId: body.claimerDeviceId || `dev-${Date.now().toString().slice(-6)}`,
    name: body.claimerDeviceName || 'PocketPrint Client',
    deviceType: (body.claimerDeviceType as DeviceType) || 'PHONE',
    os: body.claimerOs || 'Android',
    role: claimerRole,
    gatewayType: claimerRole === 'WINDOWS_GATEWAY' ? 'WINDOWS_HOST' : claimerRole === 'ANDROID_GATEWAY' ? 'ANDROID_USB' : undefined,
    printerModel: body.printerModel || null,
  };

  const updated = store.updatePairingSession(session.id, {
    status: 'CLAIMED',
    claimerDevice: claimer,
  });

  // Notify initiator's live UI via WebSocket
  broadcastToPairingSession(session.id, 'pairing:claimed', {
    sessionId: session.id,
    initiator: session.initiatorDevice,
    claimer,
  });

  res.json({
    message: 'Pairing code accepted. Awaiting mutual approval.',
    sessionId: session.id,
    status: 'CLAIMED',
    initiator: session.initiatorDevice,
    claimer,
  });
}

/**
 * POST /api/pairing/sessions/:id/claim
 * Joiner claims session using Session ID + code/qrToken.
 */
router.post('/sessions/:id/claim', async (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  const session = await store.findPairingSessionByIdAsync(sessionId);

  if (!session) {
    res.status(404).json({
      error: 'Pairing session not found',
      code: 'PAIRING_CODE_NOT_FOUND',
    });
    return;
  }

  handleClaim(session, req.body, res);
});

/**
 * POST /api/pairing/code/claim
 * Direct manual code claim endpoint without requiring prior knowledge of session ID (Flow C and Flow D).
 */
router.post('/code/claim', async (req: Request, res: Response) => {
  const { pairingCode } = req.body;
  if (!pairingCode) {
    res.status(400).json({
      error: 'pairingCode is required',
      code: 'PAIRING_CODE_INVALID',
    });
    return;
  }

  const session = await store.findPairingSessionByCodeAsync(pairingCode);
  if (!session) {
    res.status(404).json({
      error: 'Pairing code not found or invalid',
      code: 'PAIRING_CODE_NOT_FOUND',
      message: 'Pairing code not found. Generate a new code on the other device and try again.',
    });
    return;
  }

  handleClaim(session, req.body, res);
});

/**
 * POST /api/pairing/sessions/:id/approve
 * Initiator approves or rejects the claimed pairing request.
 */
router.post('/sessions/:id/approve', async (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  const { approved } = req.body;
  const session = await store.findPairingSessionByIdAsync(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Pairing session not found', code: 'PAIRING_CODE_NOT_FOUND' });
    return;
  }

  if (session.status !== 'CLAIMED' || !session.claimerDevice) {
    res.status(400).json({ error: 'Session is not currently in CLAIMED status', code: 'PAIRING_CODE_INVALID' });
    return;
  }

  if (approved === false) {
    store.updatePairingSession(sessionId, { status: 'CANCELLED' });
    broadcastToPairingSession(sessionId, 'pairing:cancelled', {
      sessionId,
      reason: 'Pairing request was declined by the initiator device.',
    });
    res.json({ message: 'Pairing declined', status: 'CANCELLED' });
    return;
  }

  const scopeId = session.workspaceId || session.userId!;
  const isGuest = !!session.workspaceId;

  // 1. Register Initiator Device
  const initDev = store.upsertDevice({
    id: session.initiatorDevice.deviceId,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    name: session.initiatorDevice.name,
    deviceType: session.initiatorDevice.deviceType,
    gatewayType: session.initiatorDevice.gatewayType,
    roles: [session.initiatorDevice.role],
    isOnline: true,
    isPrinterConnected: !!session.initiatorDevice.printerModel,
    printerModel: session.initiatorDevice.printerModel ?? null,
    printerVid: session.initiatorDevice.gatewayType ? '0x04A9' : null,
    printerPid: session.initiatorDevice.gatewayType ? '0x176D' : null,
    activeBackend: session.initiatorDevice.gatewayType === 'WINDOWS_HOST' ? 'Windows Canon Driver' : session.initiatorDevice.gatewayType === 'ANDROID_USB' ? 'CanonPixmaBackend' : 'Web Controller',
    batteryPercent: 100,
    osVersion: session.initiatorDevice.os,
    lastSeenAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 2. Register Claimer Device
  const claimDev = store.upsertDevice({
    id: session.claimerDevice.deviceId,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    name: session.claimerDevice.name,
    deviceType: session.claimerDevice.deviceType,
    gatewayType: session.claimerDevice.gatewayType,
    roles: [session.claimerDevice.role],
    isOnline: true,
    isPrinterConnected: !!session.claimerDevice.printerModel,
    printerModel: session.claimerDevice.printerModel ?? null,
    printerVid: session.claimerDevice.gatewayType ? '0x04A9' : null,
    printerPid: session.claimerDevice.gatewayType ? '0x176D' : null,
    activeBackend: session.claimerDevice.gatewayType === 'WINDOWS_HOST' ? 'Windows Canon Driver' : session.claimerDevice.gatewayType === 'ANDROID_USB' ? 'CanonPixmaBackend' : 'Web Controller',
    batteryPercent: 100,
    osVersion: session.claimerDevice.os,
    lastSeenAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // 3. Bind to Guest Workspace if applicable
  if (isGuest) {
    store.addDeviceToGuestWorkspace(scopeId, initDev.id);
    store.addDeviceToGuestWorkspace(scopeId, claimDev.id);
  }

  // 4. Generate independent, distinct device tokens
  const initiatorToken = generateDeviceToken({
    deviceId: initDev.id,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    role: 'device',
    gatewayType: initDev.gatewayType,
    deviceRole: session.initiatorDevice.role,
  });

  const claimerToken = generateDeviceToken({
    deviceId: claimDev.id,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    role: 'device',
    gatewayType: claimDev.gatewayType,
    deviceRole: session.claimerDevice.role,
  });

  // 5. Store cryptographic credential hashes
  store.createDeviceCredential({
    id: `cred-${initDev.id}`,
    deviceId: initDev.id,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    tokenHash: hashSecret(initiatorToken),
    role: session.initiatorDevice.role,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    isRevoked: false,
  });

  store.createDeviceCredential({
    id: `cred-${claimDev.id}`,
    deviceId: claimDev.id,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    tokenHash: hashSecret(claimerToken),
    role: session.claimerDevice.role,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    isRevoked: false,
  });

  // 6. Complete Session & Notify via WebSocket and Persistent Sync
  store.updatePairingSession(sessionId, {
    status: 'COMPLETED',
    completedAt: Date.now(),
    initiatorToken,
    claimerToken,
    workspaceId: scopeId,
  });

  broadcastToPairingSession(sessionId, 'pairing:completed', {
    sessionId,
    workspaceId: scopeId,
    initiatorDevice: initDev,
    claimerDevice: claimDev,
    initiatorToken,
    claimerToken,
  });

  broadcastToScope(scopeId, 'workspace:device_paired', {
    initiator: initDev,
    claimer: claimDev,
  });

  res.json({
    message: 'Pairing approved and completed successfully',
    status: 'COMPLETED',
    workspaceId: scopeId,
    initiatorDevice: initDev,
    claimerDevice: claimDev,
    initiatorToken,
    claimerToken,
  });
});

/**
 * GET /api/pairing/sessions/:id/status
 * Polls status for clients without active WebSocket connection.
 */
router.get('/sessions/:id/status', async (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  const session = await store.findPairingSessionByIdAsync(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Pairing session not found', code: 'PAIRING_CODE_NOT_FOUND' });
    return;
  }

  // Auto-expire check
  if (Date.now() > session.expiresAt && session.status === 'PENDING') {
    session.status = 'EXPIRED';
    store.updatePairingSession(sessionId, { status: 'EXPIRED' });
  }

  res.json({
    sessionId: session.id,
    status: session.status,
    expiresAt: session.expiresAt,
    workspaceId: session.workspaceId,
    initiator: session.initiatorDevice,
    claimer: session.claimerDevice || null,
    initiatorToken: session.initiatorToken || null,
    claimerToken: session.claimerToken || null,
    completedAt: session.completedAt || null,
  });
});

/**
 * POST /api/pairing/sessions/:id/cancel
 * Manually cancels a pairing session.
 */
router.post('/sessions/:id/cancel', async (req: Request, res: Response) => {
  const sessionId = String(req.params.id);
  const session = await store.findPairingSessionByIdAsync(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Pairing session not found', code: 'PAIRING_CODE_NOT_FOUND' });
    return;
  }

  store.updatePairingSession(sessionId, { status: 'CANCELLED' });
  broadcastToPairingSession(sessionId, 'pairing:cancelled', {
    sessionId,
    reason: 'Pairing was cancelled by the user.',
  });

  res.json({ message: 'Session cancelled', status: 'CANCELLED' });
});

export default router;
