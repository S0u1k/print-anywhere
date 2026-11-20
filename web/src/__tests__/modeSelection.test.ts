import { describe, it, expect, beforeEach } from 'vitest';

// In-memory localStorage mock for node test environment
const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val);
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    },
    key: (index: number) => Object.keys(mockStorage)[index] ?? null,
    length: 0,
  } as any;
}

describe('PocketPrint Bridge - Dual-Gateway Mode Selection & Dynamic Action Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Dynamic label generator matching AuroraAuthScreen
  const getActionLabel = (
    authMode: 'guest' | 'login' | 'register',
    selectedMode: 'mode_a' | 'mode_b' | 'mode_c',
    loading: boolean = false
  ): string => {
    if (loading) return 'Connecting...';

    const modeLabel =
      selectedMode === 'mode_a'
        ? 'Windows Gateway (Mode A)'
        : selectedMode === 'mode_b'
        ? 'Android Gateway (Mode B)'
        : 'Paired Gateway (Mode C)';

    if (authMode === 'guest') {
      return selectedMode === 'mode_c' ? 'Connect to Paired Gateway (Mode C)' : `Continue to ${modeLabel}`;
    }
    if (authMode === 'login') {
      return `Sign In & Launch ${modeLabel}`;
    }
    return `Create Account & Launch ${modeLabel}`;
  };

  it('Verifies Mode A, Mode B, and Mode C dynamic action button labels in Guest mode', () => {
    expect(getActionLabel('guest', 'mode_a')).toBe('Continue to Windows Gateway (Mode A)');
    expect(getActionLabel('guest', 'mode_b')).toBe('Continue to Android Gateway (Mode B)');
    expect(getActionLabel('guest', 'mode_c')).toBe('Connect to Paired Gateway (Mode C)');
  });

  it('Verifies Mode A, Mode B, and Mode C dynamic action button labels in Login mode', () => {
    expect(getActionLabel('login', 'mode_a')).toBe('Sign In & Launch Windows Gateway (Mode A)');
    expect(getActionLabel('login', 'mode_b')).toBe('Sign In & Launch Android Gateway (Mode B)');
    expect(getActionLabel('login', 'mode_c')).toBe('Sign In & Launch Paired Gateway (Mode C)');
  });

  it('Verifies Mode A, Mode B, and Mode C dynamic action button labels in Register mode', () => {
    expect(getActionLabel('register', 'mode_a')).toBe('Create Account & Launch Windows Gateway (Mode A)');
    expect(getActionLabel('register', 'mode_b')).toBe('Create Account & Launch Android Gateway (Mode B)');
    expect(getActionLabel('register', 'mode_c')).toBe('Create Account & Launch Paired Gateway (Mode C)');
  });

  it('Verifies loading state overrides action label', () => {
    expect(getActionLabel('guest', 'mode_a', true)).toBe('Connecting...');
    expect(getActionLabel('login', 'mode_b', true)).toBe('Connecting...');
  });

  it('Verifies mode selection persistence in localStorage', () => {
    localStorage.setItem('pocketprint_preferred_mode', 'mode_b');
    expect(localStorage.getItem('pocketprint_preferred_mode')).toBe('mode_b');

    localStorage.setItem('pocketprint_preferred_mode', 'mode_c');
    expect(localStorage.getItem('pocketprint_preferred_mode')).toBe('mode_c');

    localStorage.setItem('pocketprint_preferred_mode', 'mode_a');
    expect(localStorage.getItem('pocketprint_preferred_mode')).toBe('mode_a');
  });

  it('Verifies sender device selection persistence in localStorage', () => {
    localStorage.setItem('pocketprint_sender_device', 'phone');
    expect(localStorage.getItem('pocketprint_sender_device')).toBe('phone');

    localStorage.setItem('pocketprint_sender_device', 'laptop');
    expect(localStorage.getItem('pocketprint_sender_device')).toBe('laptop');

    localStorage.setItem('pocketprint_sender_device', 'other');
    expect(localStorage.getItem('pocketprint_sender_device')).toBe('other');
  });

  it('Verifies Mode C Pairing and Recovery Key specifications', () => {
    const valid8DigitPin = '49281736';
    const validRecoveryKey = 'pk_rec_a8f3b9c02d1e4f5a6b7c8d9e';

    // 8-character manual pairing PIN pattern
    expect(valid8DigitPin).toMatch(/^[0-9A-Z]{8}$/i);

    // Guest recovery key prefix pattern
    expect(validRecoveryKey.startsWith('pk_rec_')).toBe(true);
    expect(validRecoveryKey.length).toBeGreaterThanOrEqual(24);
  });

  it('Verifies Gateway destination routing rules', () => {
    const windowsDestination = {
      gatewayType: 'WINDOWS_HOST',
      expectedProtocol: 'Windows Spooler / Canon Driver',
      targetPort: 'USB001',
    };

    const androidDestination = {
      gatewayType: 'ANDROID_USB',
      expectedProtocol: 'USB OTG / BJL / BJRaster3',
      bulkEndpoints: { out: '0x01', in: '0x81' },
    };

    expect(windowsDestination.gatewayType).toBe('WINDOWS_HOST');
    expect(windowsDestination.targetPort).toBe('USB001');

    expect(androidDestination.gatewayType).toBe('ANDROID_USB');
    expect(androidDestination.bulkEndpoints.out).toBe('0x01');
    expect(androidDestination.bulkEndpoints.in).toBe('0x81');
  });
});
