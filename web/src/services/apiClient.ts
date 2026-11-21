/**
 * PocketPrint Bridge - Centralized API Client & Network Error Handler
 * Ensures reliable, secure communication across desktop, Android mobile browsers, and serverless backends.
 */

export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'CORS_ERROR'
  | 'HTTP_400'
  | 'HTTP_401'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_429'
  | 'HTTP_500'
  | 'HTTP_503'
  | 'REQUEST_TIMEOUT'
  | 'FIREBASE_AUTH_ERROR'
  | 'FIREBASE_PERMISSION_ERROR'
  | 'WORKSPACE_CREATION_ERROR';

export interface ApiErrorOptions {
  code: ApiErrorCode;
  status?: number;
  url: string;
  correlationId?: string;
  durationMs?: number;
  userFriendlyMessage: string;
  sanitizedDetails?: any;
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status?: number;
  public readonly url: string;
  public readonly correlationId: string;
  public readonly durationMs?: number;
  public readonly userFriendlyMessage: string;
  public readonly sanitizedDetails?: any;

  constructor(options: ApiErrorOptions) {
    super(options.userFriendlyMessage);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.url = options.url;
    this.correlationId = options.correlationId || generateCorrelationId();
    this.durationMs = options.durationMs;
    this.userFriendlyMessage = options.userFriendlyMessage;
    this.sanitizedDetails = options.sanitizedDetails;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Generate a unique correlation ID for end-to-end tracing without exposing user secrets.
 */
export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Dynamically resolves the API Base URL.
 * - Prioritizes VITE_API_URL environment variable if provided.
 * - In any browser environment (Vercel production or local dev), uses relative '/api'.
 *   This avoids hardcoding localhost:5000 on mobile devices and eliminates Mixed Content/CORS issues.
 * - Falls back to 'http://localhost:5000/api' for Node/CLI runtimes.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (
    envUrl &&
    typeof envUrl === 'string' &&
    envUrl.trim() &&
    envUrl !== 'undefined'
  ) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    // In browser: use relative path '/api'. Same origin ensures HTTPS, no Mixed Content, no CORS blocks.
    return '/api';
  }

  return 'http://localhost:5000/api';
}

/**
 * Get authorization headers including token and correlation ID.
 */
export function getAuthHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('pocketprint_token') : null;
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  correlationId?: string;
}

/**
 * Centralized fetch wrapper with timeout, correlation ID, safe JSON parsing,
 * and robust error classification.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = base.startsWith('http') || base.startsWith('/') ? `${base}${cleanEndpoint}` : `/${base}${cleanEndpoint}`;

  const correlationId = options.correlationId || generateCorrelationId();
  const timeoutMs = options.timeoutMs ?? 15000;
  const startTime = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = getAuthHeaders(options.headers);
  headers.set('x-correlation-id', correlationId);

  // If body is FormData, delete Content-Type so browser can set boundary automatically
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const durationMs = Date.now() - startTime;

    // Handle non-2xx HTTP responses
    if (!response.ok) {
      let errorBody: any = null;
      let rawText = '';
      try {
        rawText = await response.text();
        errorBody = JSON.parse(rawText);
      } catch {
        errorBody = { raw: rawText.slice(0, 200) };
      }

      const serverMessage = errorBody?.message || errorBody?.error;
      let errorCode: ApiErrorCode = 'HTTP_500';
      let userFriendlyMessage = 'A server error occurred. Please try again.';

      switch (response.status) {
        case 400:
          errorCode = 'HTTP_400';
          userFriendlyMessage = serverMessage || 'Invalid request. Please verify your input.';
          break;
        case 401:
          errorCode = 'HTTP_401';
          userFriendlyMessage = serverMessage || 'Your session has expired. Please sign in or restore your workspace.';
          break;
        case 403:
          errorCode = 'HTTP_403';
          userFriendlyMessage = serverMessage || 'You do not have permission to perform this action.';
          break;
        case 404:
          errorCode = 'HTTP_404';
          userFriendlyMessage = serverMessage || 'The requested resource was not found on the server.';
          break;
        case 429:
          errorCode = 'HTTP_429';
          userFriendlyMessage = serverMessage || 'Too many requests. Please slow down and try again.';
          break;
        case 503:
          errorCode = 'HTTP_503';
          userFriendlyMessage = serverMessage || 'Cloud Relay service is temporarily unavailable. Please retry.';
          break;
        default:
          errorCode = 'HTTP_500';
          userFriendlyMessage = serverMessage || `Server error (${response.status}). Please try again shortly.`;
      }

      throw new ApiError({
        code: errorCode,
        status: response.status,
        url: fullUrl,
        correlationId,
        durationMs,
        userFriendlyMessage,
        sanitizedDetails: typeof errorBody === 'object' ? errorBody : undefined,
      });
    }

    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Parse JSON safely
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text as unknown as T;
    }
  } catch (err: any) {
    clearTimeout(timer);
    const durationMs = Date.now() - startTime;

    // Already classified ApiError
    if (err instanceof ApiError) {
      throw err;
    }

    // Handle Abort / Timeout
    if (err.name === 'AbortError') {
      throw new ApiError({
        code: 'REQUEST_TIMEOUT',
        url: fullUrl,
        correlationId,
        durationMs,
        userFriendlyMessage: 'Connection timed out while reaching PocketPrint Cloud Relay. Please check your network and retry.',
      });
    }

    // Handle Network failure (e.g. TypeError: Failed to fetch)
    const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const userFriendlyMessage = isOffline
      ? 'You appear to be offline. Please check your device internet connection.'
      : 'Unable to reach PocketPrint Cloud Relay. Please check your network connection and try again.';

    throw new ApiError({
      code: 'NETWORK_ERROR',
      url: fullUrl,
      correlationId,
      durationMs,
      userFriendlyMessage,
      sanitizedDetails: {
        rawMessage: err.message,
        isOffline,
      },
    });
  }
}

export const apiClient = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = any>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
