import request from 'supertest';
import { app } from '../src/server.js';
import { normalizePairingCode } from '../src/utils/auth.js';
import { store } from '../src/db/store.js';

describe('Bidirectional Pairing & Distributed State Tests', () => {
  test('1. normalizePairingCode strips hyphens, spaces, special chars and converts to uppercase', () => {
    expect(normalizePairingCode('abcd-1234')).toBe('ABCD1234');
    expect(normalizePairingCode('  AB 12 - cd 34  ')).toBe('AB12CD34');
    expect(normalizePairingCode('ABCD—1234')).toBe('ABCD1234'); // em-dash
    expect(normalizePairingCode('ab-cd-ef-12')).toBe('ABCDEF12');
    expect(normalizePairingCode('')).toBe('');
    expect(normalizePairingCode(undefined as any)).toBe('');
  });

  test('2. Generate bidirectional pairing session', async () => {
    const res = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-init-1',
        initiatorDeviceName: 'Pixel 8 Phone',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.pairingCode).toBeDefined();
    expect(res.body.pairingCode.length).toBe(9); // Format: XXXX-XXXX
    expect(res.body.qrPayload).toBeDefined();
  });

  test('3. Claim pairing code with lowercase, spaces, and hyphens (canonical normalization)', async () => {
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-init-2',
        initiatorDeviceName: 'Pixel 8 Phone',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    const rawCode = initRes.body.pairingCode; // e.g. "7492-8163"
    const mungedCode = `  ${rawCode.toLowerCase().replace('-', ' - ')}  `; // e.g. "  7492 - 8163  "

    const claimRes = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: mungedCode,
        claimerDeviceId: 'laptop-claim-2',
        claimerDeviceName: 'Dell XPS 15',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.sessionId).toBe(initRes.body.sessionId);
    expect(claimRes.body.status).toBe('CLAIMED');
  });

  test('4. Reject conflicting gateway roles (two ANDROID_GATEWAY devices)', async () => {
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-init-3',
        initiatorDeviceName: 'Pixel 8 Phone',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    const claimRes = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: initRes.body.pairingCode,
        claimerDeviceId: 'phone-claim-3',
        claimerDeviceName: 'Galaxy S23',
        claimerDeviceType: 'PHONE',
        claimerOs: 'Android 14',
        claimerGatewayRole: 'ANDROID_GATEWAY', // Conflict!
      });

    expect(claimRes.status).toBe(400);
    expect(claimRes.body.code).toBe('PAIRING_DEVICE_ROLE_INVALID');
  });

  test('5. Non-existent pairing code returns 404 with PAIRING_CODE_NOT_FOUND', async () => {
    const res = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: 'ZZZZ-9999',
        claimerDeviceId: 'laptop-99',
        claimerDeviceName: 'ThinkPad',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PAIRING_CODE_NOT_FOUND');
    expect(res.body.message).toContain('Pairing code not found');
  });

  test('6. Expired pairing session returns 410 with PAIRING_CODE_EXPIRED', async () => {
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-init-expired',
        initiatorDeviceName: 'Old Phone',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 12',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    const sessionId = initRes.body.sessionId;
    // Manually expire the session in store
    store.updatePairingSession(sessionId, { expiresAt: Date.now() - 5000 });

    const claimRes = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: initRes.body.pairingCode,
        claimerDeviceId: 'laptop-claim-exp',
        claimerDeviceName: 'Laptop',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });

    expect(claimRes.status).toBe(410);
    expect(claimRes.body.code).toBe('PAIRING_CODE_EXPIRED');
  });

  test('7. Complete full mutual pairing handshake: Create -> Claim -> Approve -> Poll Status', async () => {
    // 1. Device A creates session
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-flow',
        initiatorDeviceName: 'Pixel Gateway',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });
    const sessionId = initRes.body.sessionId;
    const code = initRes.body.pairingCode;

    // 2. Device B claims code
    const claimRes = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: code,
        claimerDeviceId: 'laptop-flow',
        claimerDeviceName: 'Surface Laptop',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });
    expect(claimRes.status).toBe(200);
    expect(claimRes.body.status).toBe('CLAIMED');

    // 3. Device A approves
    const approveRes = await request(app)
      .post(`/api/pairing/sessions/${sessionId}/approve`)
      .send({ approved: true });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('COMPLETED');
    expect(approveRes.body.initiatorToken).toBeDefined();
    expect(approveRes.body.claimerToken).toBeDefined();

    // 4. Device B polls status
    const statusRes = await request(app)
      .get(`/api/pairing/sessions/${sessionId}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('COMPLETED');
    expect(statusRes.body.claimerToken).toBeDefined();
    expect(statusRes.body.initiatorToken).toBeDefined();

    // 5. Subsequent claim on completed code returns 409 PAIRING_CODE_ALREADY_USED
    const repeatClaimRes = await request(app)
      .post('/api/pairing/code/claim')
      .send({
        pairingCode: code,
        claimerDeviceId: 'third-device',
        claimerDeviceName: 'Intruder',
        claimerDeviceType: 'PHONE',
        claimerOs: 'Android 14',
        claimerGatewayRole: 'CONTROLLER',
      });
    expect(repeatClaimRes.status).toBe(409);
    expect(repeatClaimRes.body.code).toBe('PAIRING_CODE_ALREADY_USED');
  });
});
