import request from 'supertest';
import { app } from '../src/server.js';
import fs from 'fs';
import path from 'path';

describe('PocketPrint Bridge Cloud Relay API Tests', () => {
  let userToken: string;
  let userId: string;
  let testDeviceId: string;
  let pairingCode: string;
  let samplePdfPath: string;

  beforeAll(() => {
    // Create a temporary valid PDF file (%PDF-1.4 header)
    samplePdfPath = path.join(__dirname, 'test_sample.pdf');
    const validPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
    );
    fs.writeFileSync(samplePdfPath, validPdfBuffer);
  });

  afterAll(() => {
    if (fs.existsSync(samplePdfPath)) {
      fs.unlinkSync(samplePdfPath);
    }
  });

  test('1. Health check returns status 200 and ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('PocketPrint Bridge');
  });

  test('2. Register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Test Engineer',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
    userToken = res.body.token;
    userId = res.body.user.id;
  });

  test('3. Duplicate user registration should fail with 409', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'User 1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'User 2' });

    expect(res.status).toBe(409);
  });

  test('4. Login with correct credentials returns token', async () => {
    const email = `login-${Date.now()}@example.com`;
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'mypassword', name: 'Login User' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'mypassword' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('5. Generate device pairing code', async () => {
    const res = await request(app)
      .post('/api/devices/pair-code')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pairingCode).toBeDefined();
    expect(res.body.pairingCode.length).toBe(6);
    pairingCode = res.body.pairingCode;
  });

  test('6. Complete device pairing using pairing code', async () => {
    testDeviceId = `android-${Date.now()}`;
    const res = await request(app)
      .post('/api/devices/pair')
      .send({
        pairingCode,
        deviceId: testDeviceId,
        deviceName: 'Pixel 7 Gateway',
      });

    expect(res.status).toBe(200);
    expect(res.body.device).toBeDefined();
    expect(res.body.device.id).toBe(testDeviceId);
    expect(res.body.deviceToken).toBeDefined();
  });

  test('7. Reject non-PDF file upload', async () => {
    const fakeTextPath = path.join(__dirname, 'fake.txt');
    fs.writeFileSync(fakeTextPath, 'Not a pdf document');

    const res = await request(app)
      .post('/api/jobs/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .field('deviceId', testDeviceId)
      .attach('file', fakeTextPath);

    fs.unlinkSync(fakeTextPath);
    // Should be rejected by file filter or magic byte check
    expect([400, 500]).toContain(res.status);
  });

  test('8. Upload valid PDF and create print job', async () => {
    const res = await request(app)
      .post('/api/jobs/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .field('deviceId', testDeviceId)
      .field('copies', '2')
      .field('paperSize', 'A4')
      .field('colorMode', 'COLOR')
      .attach('file', samplePdfPath);

    expect(res.status).toBe(201);
    expect(res.body.job).toBeDefined();
    expect(res.body.job.id).toBeDefined();
    expect(['QUEUED', 'SENT_TO_DEVICE']).toContain(res.body.job.status);
    expect(res.body.job.options.copies).toBe(2);

    const jobId = res.body.job.id;

    // Test query job
    const queryRes = await request(app)
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(queryRes.status).toBe(200);
    expect(queryRes.body.job.id).toBe(jobId);

    // Test cancel job
    const cancelRes = await request(app)
      .post(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.jobId).toBe(jobId);
  });
});
