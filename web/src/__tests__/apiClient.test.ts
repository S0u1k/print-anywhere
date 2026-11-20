import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  getApiBaseUrl,
  generateCorrelationId,
  ApiError,
} from '../services/apiClient';

describe('apiClient and Base URL Resolution', () => {
  const originalEnv = import.meta.env.VITE_API_URL;
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

  afterEach(() => {
    import.meta.env.VITE_API_URL = originalEnv;
  });

  it('resolves to /api when in browser and no explicit VITE_API_URL is set', () => {
    delete (import.meta.env as any).VITE_API_URL;
    const url = getApiBaseUrl();
    expect(url).toBe('/api');
  });

  it('respects explicit VITE_API_URL if configured', () => {
    (import.meta.env as any).VITE_API_URL = 'https://custom-relay.example.com/api/';
    const url = getApiBaseUrl();
    expect(url).toBe('https://custom-relay.example.com/api');
  });

  it('generates unique correlation IDs', () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it('attaches x-correlation-id and authorization headers', async () => {
    mockLocalStorage.setItem('pocketprint_token', 'test-jwt-token-123');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/health');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [callUrl, callInit] = fetchMock.mock.calls[0];
    expect(callUrl).toContain('/api/health');
    const headers = callInit.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token-123');
    expect(headers.get('x-correlation-id')).toBeTruthy();
  });

  it('classifies network failures (TypeError: Failed to fetch) as NETWORK_ERROR with friendly message', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/guest/workspaces')).rejects.toThrowError(ApiError);

    try {
      await apiClient.get('/guest/workspaces');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.userFriendlyMessage).toContain('Unable to reach PocketPrint Cloud Relay');
      expect(err.correlationId).toBeTruthy();
    }
  });

  it('classifies timeout AbortError as REQUEST_TIMEOUT', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    const fetchMock = vi.fn().mockRejectedValue(abortErr);
    vi.stubGlobal('fetch', fetchMock);

    try {
      await apiClient.get('/slow-endpoint', { timeoutMs: 100 });
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('REQUEST_TIMEOUT');
      expect(err.userFriendlyMessage).toContain('timed out');
    }
  });

  it('properly classifies HTTP 400, 401, 403, 404, 429, 500 error responses', async () => {
    const testCases: Array<{ status: number; expectedCode: string }> = [
      { status: 400, expectedCode: 'HTTP_400' },
      { status: 401, expectedCode: 'HTTP_401' },
      { status: 403, expectedCode: 'HTTP_403' },
      { status: 404, expectedCode: 'HTTP_404' },
      { status: 429, expectedCode: 'HTTP_429' },
      { status: 500, expectedCode: 'HTTP_500' },
      { status: 503, expectedCode: 'HTTP_503' },
    ];

    for (const { status, expectedCode } of testCases) {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ error: `Server error with code ${status}` }),
      });
      vi.stubGlobal('fetch', fetchMock);

      try {
        await apiClient.get(`/test-${status}`);
        expect.fail(`Expected status ${status} to throw`);
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.code).toBe(expectedCode);
        expect(err.status).toBe(status);
        expect(err.userFriendlyMessage).toContain(`Server error with code ${status}`);
      }
    }
  });

  it('handles HTML error response bodies without throwing JSON parsing exceptions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html><body>Bad Gateway</body></html>',
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await apiClient.get('/html-error');
      expect.fail('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe('HTTP_500');
      expect(err.status).toBe(502);
      expect(err.userFriendlyMessage).toBeTruthy();
    }
  });
});
