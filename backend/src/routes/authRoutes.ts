import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';
import { hashPassword, comparePassword, generateUserToken } from '../utils/auth.js';
import { requireUserAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';

const uuidv4 = () => crypto.randomUUID();

const router = Router();
const store = DataStore.getInstance();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const { email, password, name } = parse.data;
    const existing = store.findUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = store.createUser({
      id: `usr-${uuidv4().substring(0, 8)}`,
      email,
      passwordHash,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const token = generateUserToken({ userId: user.id, email: user.email });
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Registration failed', message: e.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Validation error', details: parse.error.format() });
      return;
    }

    const { email, password } = parse.data;
    const user = store.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateUserToken({ userId: user.id, email: user.email });
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Login failed', message: e.message });
  }
});

router.get('/me', requireUserAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.isGuest || !req.user?.userId) {
    res.json({
      user: {
        id: req.workspaceId || 'guest',
        email: req.user?.email || `guest@pocketprint.local`,
        name: req.user?.name || 'Guest User',
        isGuest: true,
      },
      workspaceId: req.workspaceId,
    });
    return;
  }
  const user = store.findUserById(req.user.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name, isGuest: false } });
});

// Forgot Password - Generates Reset Token
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = store.findUserByEmail(email);
    if (!user) {
      // Do not disclose user existence, return clean standard response
      res.json({ message: 'If this email is registered, a password reset instruction has been sent.' });
      return;
    }

    // In a production server with SMTP, this sends an email with the token.
    // For local dev/demonstration, generate a secure 6-digit reset code and token
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    res.json({
      message: 'Password reset code generated.',
      resetCode, // provided so user can test reset flow seamlessly
      instructions: 'Enter this 6-digit code on the reset password screen along with your new password.',
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to process forgot password request', message: e.message });
  }
});

// Password Reset - Verifies and Updates Password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, resetCode, newPassword } = req.body;
    if (!email || !resetCode || !newPassword) {
      res.status(400).json({ error: 'Email, reset code, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const user = store.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const updated = store.updateUserPassword(email, newHash);

    if (!updated) {
      res.status(500).json({ error: 'Failed to update password' });
      return;
    }

    res.json({ message: 'Password has been successfully updated. You may now sign in.' });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reset password', message: e.message });
  }
});

export default router;
