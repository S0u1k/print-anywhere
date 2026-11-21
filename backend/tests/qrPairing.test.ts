import request from 'supertest';
import { app } from '../src/server.js';
import { DataStore } from '../src/db/store.js';

describe('QR Scanner Backend Token Validation & Claim Tests', () => {
  const store = DataStore.getInstance();

  test('1. Claim pairing session using QR token and Session ID', async () => {
    // 1. Device A generates QR code session
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-qr-test-1',
        initiatorDeviceName: 'Pixel 8 Android',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    expect(initRes.status).toBe(201);
    const sessionId = initRes.body.sessionId;
    const qrToken = initRes.body.qrToken;
    expect(sessionId).toBeDefined();
    expect(qrToken).toBeDefined();

    // 2. Device B scans QR code and claims using QR token
    const claimRes = await request(app)
      .post(`/api/pairing/sessions/${sessionId}/claim`)
      .send({
        qrToken,
        claimerDeviceId: 'laptop-qr-test-1',
        claimerDeviceName: 'Windows 11 Surface',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.status).toBe('CLAIMED');
    expect(claimRes.body.sessionId).toBe(sessionId);
    expect(claimRes.body.initiator.role).toBe('ANDROID_GATEWAY');
    expect(claimRes.body.claimer.role).toBe('CONTROLLER');
  });

  test('2. Reject QR claim with invalid or corrupted QR token', async () => {
    // 1. Generate session
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-qr-test-2',
        initiatorDeviceName: 'Pixel 8 Android',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    const sessionId = initRes.body.sessionId;

    // 2. Attempt claim with fake QR token
    const claimRes = await request(app)
      .post(`/api/pairing/sessions/${sessionId}/claim`)
      .send({
        qrToken: 'fake-corrupted-qr-token-12345',
        claimerDeviceId: 'laptop-fake',
        claimerDeviceName: 'Hacker Device',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Linux',
        claimerGatewayRole: 'CONTROLLER',
      });

    expect(claimRes.status).toBe(403);
    expect(claimRes.body.code).toBe('PAIRING_CODE_INVALID');
  });

  test('3. Full QR pairing flow: Create QR -> Scan Claim -> Approve -> Verify Completion', async () => {
    // 1. Create QR session
    const initRes = await request(app)
      .post('/api/pairing/sessions')
      .send({
        initiatorDeviceId: 'phone-full-flow',
        initiatorDeviceName: 'Pixel 8 Phone',
        initiatorDeviceType: 'PHONE',
        initiatorOs: 'Android 14',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      });

    const sessionId = initRes.body.sessionId;
    const qrToken = initRes.body.qrToken;

    // 2. Claim via QR token
    const claimRes = await request(app)
      .post(`/api/pairing/sessions/${sessionId}/claim`)
      .send({
        qrToken,
        claimerDeviceId: 'laptop-full-flow',
        claimerDeviceName: 'Dell XPS 15',
        claimerDeviceType: 'LAPTOP',
        claimerOs: 'Windows 11',
        claimerGatewayRole: 'CONTROLLER',
      });
    expect(claimRes.status).toBe(200);

    // 3. Approve
    const approveRes = await request(app)
      .post(`/api/pairing/sessions/${sessionId}/approve`)
      .send({ approved: true });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('COMPLETED');
    expect(approveRes.body.claimerToken).toBeDefined();
    expect(approveRes.body.initiatorToken).toBeDefined();

    // 4. Poll status
    const statusRes = await request(app).get(`/api/pairing/sessions/${sessionId}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('COMPLETED');
    expect(statusRes.body.claimerToken).toBeDefined();
  });
});
