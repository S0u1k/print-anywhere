import { describe, it, expect } from 'vitest';
import {
  parseAndValidateQrPayload,
  normalizeCode,
  isValidPairingCodeFormat,
} from '../utils/qrPayloadParser';

describe('QR Payload Parser and Validator Suite', () => {
  it('1. correctly normalizes pairing codes with hyphens, spaces, and lowercase', () => {
    expect(normalizeCode('7492-8163')).toBe('74928163');
    expect(normalizeCode('  ab 12 - cd 34  ')).toBe('AB12CD34');
    expect(normalizeCode('ABCD—1234')).toBe('ABCD1234');
    expect(normalizeCode('')).toBe('');
  });

  it('2. validates 8-character pairing code format', () => {
    expect(isValidPairingCodeFormat('7492-8163')).toBe(true);
    expect(isValidPairingCodeFormat('ABCD1234')).toBe(true);
    expect(isValidPairingCodeFormat('1234')).toBe(false); // too short
    expect(isValidPairingCodeFormat('1234567890')).toBe(false); // too long
  });

  it('3. successfully parses standard PocketPrint JSON QR payload', () => {
    const jsonPayload = JSON.stringify({
      sessionId: 'pair-74928163',
      qrToken: 'tok-abc-1234567890abcdef',
      pairingCode: '7492-8163',
      serverUrl: 'https://print-anywhere-three.vercel.app',
      initiatorName: 'Pixel 8 Phone',
      initiatorType: 'PHONE',
    });

    const res = parseAndValidateQrPayload(jsonPayload);
    expect(res.valid).toBe(true);
    expect(res.type).toBe('JSON_SESSION');
    expect(res.sessionId).toBe('pair-74928163');
    expect(res.qrToken).toBe('tok-abc-1234567890abcdef');
    expect(res.pairingCode).toBe('74928163');
    expect(res.initiatorName).toBe('Pixel 8 Phone');
  });

  it('4. successfully parses PocketPrint URL QR payload with query parameters', () => {
    const urlPayload = 'https://print-anywhere-three.vercel.app/?pair=7492-8163&session=pair-9999&token=tok-999';
    const res = parseAndValidateQrPayload(urlPayload);
    expect(res.valid).toBe(true);
    expect(res.type).toBe('URL_PAIRING');
    expect(res.pairingCode).toBe('74928163');
    expect(res.sessionId).toBe('pair-9999');
    expect(res.qrToken).toBe('tok-999');
  });

  it('5. successfully parses raw 8-character pairing codes (XXXX-XXXX format)', () => {
    const rawCode = '83HQ-MMQ4';
    const res = parseAndValidateQrPayload(rawCode);
    expect(res.valid).toBe(true);
    expect(res.type).toBe('RAW_CODE');
    expect(res.pairingCode).toBe('83HQMMQ4');
  });

  it('6. safely rejects empty or whitespace-only QR data', () => {
    expect(parseAndValidateQrPayload('')?.valid).toBe(false);
    expect(parseAndValidateQrPayload('   ')?.valid).toBe(false);
    expect(parseAndValidateQrPayload(null)?.valid).toBe(false);
  });

  it('7. safely rejects unrelated non-PocketPrint URLs', () => {
    const unrelatedUrl = 'https://google.com/search?q=printers';
    const res = parseAndValidateQrPayload(unrelatedUrl);
    expect(res.valid).toBe(false);
    expect(res.type).toBe('INVALID');
    expect(res.error).toContain('does not contain PocketPrint pairing data');
  });

  it('8. safely rejects arbitrary random strings or malformed JSON', () => {
    const randomText = 'Just some random text or wifi password';
    const res = parseAndValidateQrPayload(randomText);
    expect(res.valid).toBe(false);
    expect(res.type).toBe('INVALID');
    expect(res.error).toContain('Invalid QR Code');
  });
});
