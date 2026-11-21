/**
 * PocketPrint Bridge - QR Payload Parser and Validator
 * Validates, normalizes, and decodes QR codes for secure device pairing.
 */

export interface QrParsedPayload {
  valid: boolean;
  type: 'JSON_SESSION' | 'URL_PAIRING' | 'RAW_CODE' | 'INVALID';
  sessionId?: string;
  qrToken?: string;
  pairingCode?: string;
  serverUrl?: string;
  initiatorName?: string;
  initiatorType?: string;
  error?: string;
}

/**
 * Normalizes an 8-character pairing code by stripping whitespace, hyphens, and non-alphanumeric characters.
 */
export function normalizeCode(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
}

/**
 * Validates whether a normalized string is a valid 8-character pairing code.
 */
export function isValidPairingCodeFormat(code: string): boolean {
  const norm = normalizeCode(code);
  return norm.length === 8 && /^[A-Z0-9]{8}$/.test(norm);
}

/**
 * Parses and validates an arbitrary string scanned from a QR code.
 * Supports PocketPrint JSON payloads, URL links with pairing params, and raw 8-character codes.
 */
export function parseAndValidateQrPayload(raw: string | undefined | null): QrParsedPayload {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return {
      valid: false,
      type: 'INVALID',
      error: 'Empty or invalid QR code scanned.',
    };
  }

  const trimmed = raw.trim();

  // 1. Check if payload is PocketPrint JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        const sessionId = typeof parsed.sessionId === 'string' ? parsed.sessionId.trim() : undefined;
        const qrToken = typeof parsed.qrToken === 'string' ? parsed.qrToken.trim() : undefined;
        const pairingCode = typeof parsed.pairingCode === 'string' ? parsed.pairingCode.trim() : undefined;

        if (sessionId && (qrToken || pairingCode)) {
          return {
            valid: true,
            type: 'JSON_SESSION',
            sessionId,
            qrToken,
            pairingCode: pairingCode ? normalizeCode(pairingCode) : undefined,
            serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl.trim() : undefined,
            initiatorName: typeof parsed.initiatorName === 'string' ? parsed.initiatorName.trim() : undefined,
            initiatorType: typeof parsed.initiatorType === 'string' ? parsed.initiatorType.trim() : undefined,
          };
        }
      }
    } catch {
      // Not valid JSON, continue to URL and raw code checks
    }
  }

  // 2. Check if payload is a URL containing pairing parameters
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const codeParam =
        url.searchParams.get('pair') ||
        url.searchParams.get('code') ||
        url.searchParams.get('pairingCode');
      const sessionParam = url.searchParams.get('session') || url.searchParams.get('sessionId');
      const tokenParam = url.searchParams.get('token') || url.searchParams.get('qrToken');

      if (codeParam && isValidPairingCodeFormat(codeParam)) {
        return {
          valid: true,
          type: 'URL_PAIRING',
          sessionId: sessionParam || undefined,
          qrToken: tokenParam || undefined,
          pairingCode: normalizeCode(codeParam),
          serverUrl: url.origin,
        };
      }

      // If it's a URL with session parameter
      if (sessionParam && tokenParam) {
        return {
          valid: true,
          type: 'URL_PAIRING',
          sessionId: sessionParam,
          qrToken: tokenParam,
          serverUrl: url.origin,
        };
      }

      return {
        valid: false,
        type: 'INVALID',
        error: 'Unrecognized URL. This QR code does not contain PocketPrint pairing data.',
      };
    } catch {
      // Invalid URL syntax
    }
  }

  // 3. Check if payload is a raw 8-character pairing code (e.g. "ABCD-1234" or "ABCD1234")
  const norm = normalizeCode(trimmed);
  if (norm.length === 8 && /^[A-Z0-9]{8}$/.test(norm)) {
    return {
      valid: true,
      type: 'RAW_CODE',
      pairingCode: norm,
    };
  }

  return {
    valid: false,
    type: 'INVALID',
    error: 'Invalid QR Code. Please scan a PocketPrint Bridge pairing QR code.',
  };
}
