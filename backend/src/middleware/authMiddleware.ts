import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';
import { AuthTokenPayload, DeviceTokenPayload } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
  device?: DeviceTokenPayload;
  isGuest?: boolean;
  workspaceId?: string;
}

/**
 * Middleware that authenticates either a registered account user OR a guest workspace session.
 * Guarantees that the requester belongs to an authenticated ownership scope.
 */
export function requireSessionAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken<AuthTokenPayload>(token);

  if (!payload || (!payload.userId && !payload.workspaceId)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    return;
  }

  req.user = payload;
  req.isGuest = !!payload.isGuest;
  req.workspaceId = payload.workspaceId || payload.userId;
  next();
}

// Alias for backwards compatibility with existing route handlers
export const requireUserAuth = requireSessionAuth;

/**
 * Middleware that authenticates a paired device using its dedicated device token.
 */
export function requireDeviceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (req.headers['x-device-token'] as string);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing device credentials' });
    return;
  }

  const payload = verifyToken<DeviceTokenPayload>(token);
  if (!payload || !payload.deviceId) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired device token' });
    return;
  }

  req.device = payload;
  req.workspaceId = payload.workspaceId || payload.userId;
  next();
}
