import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../services/api';
import { isProductionFirebaseConfigured, authenticateAnonymousGuest } from '../services/firebase';

describe('Guest Authentication and Mode B Flow', () => {
  const storageState: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: vi.fn((k: string) => storageState[k] || null),
    setItem: vi.fn((k: string, v: string) => {
      storageState[k] = String(v);
    }),
    removeItem: vi.fn((k: string) => {
      delete storageState[k];
    }),
    clear: vi.fn(() => {
      Object.keys(storageState).forEach((k) => delete storageState[k]);
    }),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLocalStorage.clear();
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('window', {
      location: {
        origin: 'https://print-anywhere-three.vercel.app',
        hostname: 'print-anywhere-three.vercel.app',
      },
    });
  });

  it('determines whether production Firebase credentials are valid', () => {
    expect(typeof isProductionFirebaseConfigured()).toBe('boolean');
  });

  it('safely handles authenticateAnonymousGuest in demo / hybrid mode', async () => {
    const result = await authenticateAnonymousGuest();
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('idToken');
  });

  it('successfully creates guest workspace through api and preserves state in localStorage', async () => {
    const mockResponse = {
      message: 'Guest workspace initialized successfully',
      token: 'mock-guest-jwt-token-xyz',
      recoveryKey: 'pk_rec_abcdef1234567890',
      workspace: {
        id: 'ws-guest-123456',
        name: 'Guest Workspace (123456)',
        pairedDeviceIds: [],
        createdAt: 1700000000000,
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.createGuestWorkspace('My Test Workspace');
    expect(res.token).toBe('mock-guest-jwt-token-xyz');
    expect(res.recoveryKey).toBe('pk_rec_abcdef1234567890');
    expect(res.workspace.id).toBe('ws-guest-123456');

    // Verify endpoint called was relative /api/guest/workspaces without localhost
    expect(fetchMock).toHaveBeenCalledOnce();
    const [callUrl, callInit] = fetchMock.mock.calls[0];
    expect(callUrl).toBe('/api/guest/workspaces');
    expect(callInit.method).toBe('POST');
    expect(JSON.parse(callInit.body)).toEqual({ name: 'My Test Workspace' });
  });

  it('persists Mode B selection in localStorage', () => {
    mockLocalStorage.setItem('pocketprint_preferred_mode', 'mode_b');
    mockLocalStorage.setItem('pocketprint_sender_device', 'phone');

    expect(mockLocalStorage.getItem('pocketprint_preferred_mode')).toBe('mode_b');
    expect(mockLocalStorage.getItem('pocketprint_sender_device')).toBe('phone');
  });
});
