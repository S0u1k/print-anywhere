import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';
import { getFirebaseAuth } from '../services/firebaseAdmin.js';

const uuidv4 = () => crypto.randomUUID();
import {
  generateGuestToken,
  generateRecoveryKey,
  hashSecret,
} from '../utils/auth.js';
import { requireSessionAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const router = Router();
const store = DataStore.getInstance();

/**
 * POST /api/guest/workspaces
 * Creates a private, cryptographically secured Guest Workspace without requiring email or password.
 * Optionally binds a Firebase Anonymous Auth UID if available.
 */
router.post('/workspaces', async (req: Request, res: Response) => {
  try {
    const workspaceId = `ws-guest-${uuidv4().substring(0, 10)}`;
    const workspaceName = req.body.name || `Guest Workspace (${workspaceId.slice(-6)})`;
    const firebaseToken = req.body.firebaseToken || (req.headers['x-firebase-token'] as string);

    let firebaseUid: string | undefined;
    if (firebaseToken) {
      try {
        const auth = getFirebaseAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(firebaseToken);
          firebaseUid = decoded.uid;
        }
      } catch (fbErr: any) {
        console.warn('[Guest Auth] Firebase token verification skipped:', fbErr.message);
      }
    }

    // Generate cryptographic keys
    const recoveryKey = generateRecoveryKey();
    const recoveryKeyHash = hashSecret(recoveryKey);
    const ownershipKey = uuidv4();
    const ownershipKeyHash = hashSecret(ownershipKey);

    const workspace = store.createGuestWorkspace({
      id: workspaceId,
      name: workspaceName,
      ownershipKeyHash,
      recoveryKeyHash,
      pairedDeviceIds: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days retention
    });

    const token = generateGuestToken(workspaceId, workspaceName);

    res.status(201).json({
      message: 'Guest workspace initialized successfully',
      token,
      recoveryKey, // Emitted once for the user to securely backup
      workspace: {
        id: workspace.id,
        name: workspace.name,
        pairedDeviceIds: workspace.pairedDeviceIds,
        createdAt: workspace.createdAt,
        firebaseUid,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create guest workspace', message: err.message });
  }
});

/**
 * POST /api/guest/workspaces/recover
 * Restores access to an existing Guest Workspace using its recovery key.
 */
router.post('/workspaces/recover', (req: Request, res: Response) => {
  const { recoveryKey } = req.body;
  if (!recoveryKey || typeof recoveryKey !== 'string') {
    res.status(400).json({ error: 'Recovery key is required' });
    return;
  }

  const recoveryKeyHash = hashSecret(recoveryKey.trim());
  const workspace = store.findGuestWorkspaceByRecoveryHash(recoveryKeyHash);

  if (!workspace) {
    res.status(404).json({ error: 'Invalid recovery key or workspace not found' });
    return;
  }

  const token = generateGuestToken(workspace.id, workspace.name);
  store.updateGuestWorkspace(workspace.id, { lastActiveAt: Date.now() });

  res.json({
    message: 'Guest workspace successfully recovered',
    token,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      pairedDeviceIds: workspace.pairedDeviceIds,
      createdAt: workspace.createdAt,
    },
  });
});

/**
 * GET /api/guest/workspaces/current
 * Returns metadata and active paired devices for the current session.
 */
router.get('/workspaces/current', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const scopeId = req.workspaceId!;
  const workspace = store.findGuestWorkspaceById(scopeId);

  if (!workspace && !req.user?.userId) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const devices = store.findDevicesByScope(scopeId);
  const printers = store.findPrintersByScope(scopeId);

  res.json({
    workspaceId: scopeId,
    name: workspace ? workspace.name : `Account Workspace (${req.user?.email})`,
    isGuest: req.isGuest || false,
    pairedDevices: devices,
    printers,
    createdAt: workspace ? workspace.createdAt : Date.now(),
  });
});

export default router;
