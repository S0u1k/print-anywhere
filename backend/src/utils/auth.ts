import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthTokenPayload, DeviceTokenPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'pocketprint-dev-secret-key-32chars-minimum-len';
const JWT_EXPIRES_IN = '7d';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function generateUserToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateGuestToken(workspaceId: string, name?: string): string {
  return jwt.sign(
    {
      workspaceId,
      userId: workspaceId,
      email: `guest-${workspaceId.slice(0, 8)}@pocketprint.local`,
      name: name || 'Guest User',
      role: 'guest',
      isGuest: true,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function generateDeviceToken(payload: DeviceTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '90d' });
}

export function generateExpiringDownloadToken(jobId: string, expiresInMinutes: number = 60): string {
  return jwt.sign({ jobId, purpose: 'download' }, JWT_SECRET, {
    expiresIn: `${expiresInMinutes}m`,
  });
}

export function verifyToken<T>(token: string): T | null {
  try {
    return jwt.verify(token, JWT_SECRET) as T;
  } catch (e) {
    return null;
  }
}

/**
 * Canonical normalization for pairing codes:
 * Converts to uppercase, strips all whitespace, hyphens, em-dashes, and non-alphanumeric characters.
 */
export function normalizePairingCode(code: string | undefined | null): string {
  if (!code || typeof code !== 'string') return '';
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

/**
 * Generates an 8-character manual pairing code in XXXX-XXXX format.
 * Omits ambiguous characters (0, O, 1, I, L) for error-free manual typing.
 */
export function generatePairingCode(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  const randomBytes = crypto.randomBytes(8);
  for (let i = 0; i < 4; i++) {
    part1 += chars[randomBytes[i] % chars.length];
    part2 += chars[randomBytes[i + 4] % chars.length];
  }
  return `${part1}-${part2}`;
}

/**
 * Generates a high-entropy single-use cryptographic token for QR payloads.
 */
export function generateQrToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a recovery key for a Guest Workspace.
 */
export function generateRecoveryKey(): string {
  return `pk_rec_${crypto.randomBytes(16).toString('hex')}`;
}
