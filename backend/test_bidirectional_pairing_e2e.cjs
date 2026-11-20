/**
 * PocketPrint Bridge - Bidirectional Pairing & Guest Workspace E2E Verification Suite
 */

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

const results = [];
function record(testName, passed, details = '') {
  results.push({ testName, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark} | ${testName} ${details ? '– ' + details : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log(' POCKETPRINT BRIDGE — BIDIRECTIONAL PAIRING & GUEST MODE E2E');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------
    // TEST 1: Health Check
    // -------------------------------------------------------------
    const health = await request({ path: '/api/health' });
    record('Cloud Relay Health Check', health.status === 200 && health.data.status === 'ok', `status: ${health.status}`);

    // -------------------------------------------------------------
    // TEST 2: Account Mode Authentication (Register if fresh DB)
    // -------------------------------------------------------------
    let loginRes = await request(
      { path: '/api/auth/login', method: 'POST' },
      { email: 'souvik@pocketprint.io', password: 'Password123!' }
    );
    if (loginRes.status !== 200) {
      await request(
        { path: '/api/auth/register', method: 'POST' },
        { name: 'Souvik Admin', email: 'souvik@pocketprint.io', password: 'Password123!' }
      );
      loginRes = await request(
        { path: '/api/auth/login', method: 'POST' },
        { email: 'souvik@pocketprint.io', password: 'Password123!' }
      );
    }
    const accountToken = loginRes.data?.token;
    const accountUser = loginRes.data?.user;
    record('Account Login (Souvik Admin)', loginRes.status === 200 && !!accountToken, `userId: ${accountUser?.id}`);

    // Ensure account has a registered device for isolation comparison
    if (accountToken) {
      await request(
        {
          path: '/api/devices',
          method: 'POST',
          headers: { Authorization: `Bearer ${accountToken}` },
        },
        {
          name: 'Souvik Dedicated Office PC',
          deviceType: 'LAPTOP',
          gatewayRole: 'WINDOWS_GATEWAY',
        }
      );
    }

    // -------------------------------------------------------------
    // TEST 3: Guest Workspace Creation & Recovery Key
    // -------------------------------------------------------------
    const guestCreate = await request({ path: '/api/guest/workspaces', method: 'POST' }, {});
    const guestData = guestCreate.data;
    const workspaceId = guestData.workspace?.id;
    const guestToken = guestData.token;
    const recoveryKey = guestData.recoveryKey;
    const isRecKeyValid = recoveryKey?.startsWith('pk_rec_');

    record(
      'Guest Workspace Creation',
      guestCreate.status === 201 && isRecKeyValid && !!guestToken && !!workspaceId,
      `workspaceId: ${workspaceId}, recoveryKey: ${recoveryKey?.substring(0, 16)}...`
    );

    // -------------------------------------------------------------
    // TEST 4: Guest Workspace Recovery via Recovery Key
    // -------------------------------------------------------------
    const guestRecover = await request(
      { path: '/api/guest/workspaces/recover', method: 'POST' },
      { recoveryKey }
    );
    record(
      'Guest Workspace Recovery',
      guestRecover.status === 200 && guestRecover.data.workspace?.id === workspaceId,
      `recoveredId: ${guestRecover.data?.workspace?.id}`
    );

    // -------------------------------------------------------------
    // TEST 5: Flow A — Laptop Initiates QR Session -> Phone Claims via QR -> Mutual Approval
    // -------------------------------------------------------------
    const flowASession = await request(
      {
        path: '/api/pairing/sessions',
        method: 'POST',
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      {
        initiatorDeviceId: 'dev-laptop-fl-a',
        initiatorDeviceName: 'Living Room Laptop',
        initiatorDeviceType: 'LAPTOP',
        initiatorGatewayRole: 'WINDOWS_GATEWAY',
        printerModel: 'Canon PIXMA MG2570S',
      }
    );
    const sessionIdA = flowASession.data.sessionId;
    const qrTokenA = flowASession.data.qrToken || flowASession.data.qrPayload?.qrToken;
    const codeA = flowASession.data.pairingCode;
    const is8Char = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(codeA);

    record(
      'Flow A: Session Creation (QR + 8-Char Code)',
      flowASession.status === 201 && !!qrTokenA && is8Char,
      `sessionId: ${sessionIdA}, code: ${codeA}`
    );

    // Remote Phone claims session via QR Token
    const flowAClaim = await request(
      { path: `/api/pairing/sessions/${sessionIdA}/claim`, method: 'POST' },
      {
        qrToken: qrTokenA,
        claimerDeviceId: 'dev-phone-fl-a',
        claimerDeviceName: 'Pixel 8 Pro Mobile',
        claimerDeviceType: 'PHONE',
        claimerGatewayRole: 'ANDROID_GATEWAY',
      }
    );
    record(
      'Flow A: Phone Claims QR Session',
      flowAClaim.status === 200 && flowAClaim.data.status === 'CLAIMED',
      `status: ${flowAClaim.data?.status}`
    );

    // Laptop approves mutual pairing
    const flowAApprove = await request(
      {
        path: `/api/pairing/sessions/${sessionIdA}/approve`,
        method: 'POST',
      },
      { approved: true }
    );
    const flACreds = flowAApprove.data;
    record(
      'Flow A: Mutual Approval & Credential Issuance',
      flowAApprove.status === 200 &&
        flowAApprove.data.status === 'COMPLETED' &&
        !!flACreds.initiatorToken &&
        !!flACreds.claimerToken,
      `initiator: ${flACreds.initiatorDevice?.id}, claimer: ${flACreds.claimerDevice?.id}`
    );

    // -------------------------------------------------------------
    // TEST 6: Flow B — Phone Initiates QR Session -> Laptop Claims -> Phone Approves
    // -------------------------------------------------------------
    const flowBSession = await request(
      {
        path: '/api/pairing/sessions',
        method: 'POST',
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      {
        initiatorDeviceId: 'dev-phone-fl-b',
        initiatorDeviceName: 'Samsung S24 OTG Gateway',
        initiatorDeviceType: 'PHONE',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      }
    );
    const sessionIdB = flowBSession.data.sessionId;
    const qrTokenB = flowBSession.data.qrToken || flowBSession.data.qrPayload?.qrToken;

    const flowBClaim = await request(
      { path: `/api/pairing/sessions/${sessionIdB}/claim`, method: 'POST' },
      {
        qrToken: qrTokenB,
        claimerDeviceId: 'dev-laptop-fl-b',
        claimerDeviceName: 'Work Dell Latitude',
        claimerDeviceType: 'LAPTOP',
        claimerGatewayRole: 'WINDOWS_GATEWAY',
      }
    );

    const flowBApprove = await request(
      {
        path: `/api/pairing/sessions/${sessionIdB}/approve`,
        method: 'POST',
      },
      { approved: true }
    );
    record(
      'Flow B: Phone Initiates QR -> Laptop Claims -> Approved',
      flowBApprove.status === 200 && flowBApprove.data.status === 'COMPLETED',
      `sessionId: ${sessionIdB}`
    );

    // -------------------------------------------------------------
    // TEST 7: Flow C — Laptop Initiates 8-Digit Code -> Phone Claims via Code
    // -------------------------------------------------------------
    const flowCSession = await request(
      {
        path: '/api/pairing/sessions',
        method: 'POST',
        headers: { Authorization: `Bearer ${accountToken}` },
      },
      {
        initiatorDeviceId: 'dev-hp-win-c',
        initiatorDeviceName: 'HP Pavilion Windows Host',
        initiatorDeviceType: 'LAPTOP',
        initiatorGatewayRole: 'WINDOWS_GATEWAY',
      }
    );
    const codeC = flowCSession.data.pairingCode;
    const sessionIdC = flowCSession.data.sessionId;

    const flowCClaim = await request(
      { path: '/api/pairing/code/claim', method: 'POST' },
      {
        pairingCode: codeC,
        claimerDeviceId: 'dev-oneplus-c',
        claimerDeviceName: 'OnePlus 11',
        claimerDeviceType: 'PHONE',
        claimerGatewayRole: 'CONTROLLER',
      }
    );

    const flowCApprove = await request(
      {
        path: `/api/pairing/sessions/${sessionIdC}/approve`,
        method: 'POST',
      },
      { approved: true }
    );
    record(
      'Flow C: Laptop 8-Digit Code -> Phone Claim -> Approved',
      flowCClaim.status === 200 && flowCApprove.status === 200,
      `code: ${codeC}`
    );

    // -------------------------------------------------------------
    // TEST 8: Flow D — Phone Initiates 8-Digit Code -> Laptop Claims via Code
    // -------------------------------------------------------------
    const flowDSession = await request(
      {
        path: '/api/pairing/sessions',
        method: 'POST',
        headers: { Authorization: `Bearer ${accountToken}` },
      },
      {
        initiatorDeviceId: 'dev-pixel7-d',
        initiatorDeviceName: 'Pixel 7 OTG',
        initiatorDeviceType: 'PHONE',
        initiatorGatewayRole: 'ANDROID_GATEWAY',
      }
    );
    const codeD = flowDSession.data.pairingCode;
    const sessionIdD = flowDSession.data.sessionId;

    const flowDClaim = await request(
      { path: '/api/pairing/code/claim', method: 'POST' },
      {
        pairingCode: codeD,
        claimerDeviceId: 'dev-asus-win-d',
        claimerDeviceName: 'Asus ZenBook',
        claimerDeviceType: 'LAPTOP',
        claimerGatewayRole: 'WINDOWS_GATEWAY',
      }
    );

    const flowDApprove = await request(
      {
        path: `/api/pairing/sessions/${sessionIdD}/approve`,
        method: 'POST',
      },
      { approved: true }
    );
    record(
      'Flow D: Phone 8-Digit Code -> Laptop Claim -> Approved',
      flowDClaim.status === 200 && flowDApprove.status === 200,
      `code: ${codeD}`
    );

    // -------------------------------------------------------------
    // TEST 9: Security — Rate Limit Lockout after 5 Failed Attempts
    // -------------------------------------------------------------
    const rateLimitSession = await request(
      {
        path: '/api/pairing/sessions',
        method: 'POST',
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      {
        initiatorDeviceId: 'dev-sec-rl',
        initiatorDeviceName: 'Security Test Host',
        initiatorDeviceType: 'LAPTOP',
      }
    );
    const rlSessionId = rateLimitSession.data.sessionId;

    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      const failClaim = await request(
        { path: `/api/pairing/sessions/${rlSessionId}/claim`, method: 'POST' },
        { qrToken: 'invalid_token_attempt_' + i }
      );
      if (failClaim.status === 429) {
        rateLimited = true;
        break;
      }
    }
    record(
      'Security: 5-Attempt Rate-Limit Lockout',
      rateLimited,
      'Session locked out with HTTP 429'
    );

    // -------------------------------------------------------------
    // TEST 10: Security — Device Revocation
    // -------------------------------------------------------------
    const revokeRes = await request(
      {
        path: `/api/devices/dev-laptop-fl-a/revoke`,
        method: 'POST',
        headers: { Authorization: `Bearer ${guestToken}` },
      },
      {}
    );
    record(
      'Security: Device Revocation API',
      revokeRes.status === 200 && revokeRes.data.revoked === true,
      `deviceId: dev-laptop-fl-a`
    );

    // -------------------------------------------------------------
    // TEST 11: Scope Isolation (Guest vs. Account)
    // -------------------------------------------------------------
    const guestDevices = await request({
      path: '/api/devices',
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    const accountDevices = await request({
      path: '/api/devices',
      headers: { Authorization: `Bearer ${accountToken}` },
    });

    const guestList = guestDevices.data?.devices || [];
    const accountList = accountDevices.data?.devices || [];
    const guestIds = guestList.map((d) => d.id);
    const accountIds = accountList.map((d) => d.id);
    const overlapping = guestIds.filter((id) => accountIds.includes(id));

    record(
      'Workspace Isolation (Guest vs Account)',
      guestDevices.status === 200 &&
        accountDevices.status === 200 &&
        guestList.length > 0 &&
        accountList.length > 0 &&
        overlapping.length === 0,
      `Guest count: ${guestIds.length}, Account count: ${accountIds.length}, Overlap: ${overlapping.length}`
    );

    // -------------------------------------------------------------
    // TEST 12: PDF Magic Bytes & Hash Validation in Print Dispatch
    // -------------------------------------------------------------
    // dev-phone-fl-a was paired in guest workspace during Flow A
    const boundary = '----WebKitFormBoundaryE2ETest7MA4YWxkTrZu0gW';
    const fakePdfBytes = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n185\n%%EOF'
    );

    const postParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nGuest Invoice E2E Test\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="deviceId"\r\n\r\ndev-phone-fl-a\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="paperSize"\r\n\r\nA4\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="invoice_test.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
    ];
    const postEnd = `\r\n--${boundary}--\r\n`;

    const fullPayload = Buffer.concat([
      Buffer.from(postParts.join('')),
      fakePdfBytes,
      Buffer.from(postEnd),
    ]);

    const jobSubmit = await request(
      {
        path: '/api/jobs',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${guestToken}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      },
      fullPayload
    );

    const job = jobSubmit.data?.job;
    const hasSha256 = !!job?.fileHash && job.fileHash.length === 64;
    const hasDownloadToken = !!jobSubmit.data?.downloadToken;

    record(
      'Print Job Dispatch (%PDF- Magic Bytes & SHA-256)',
      jobSubmit.status === 201 && hasSha256 && hasDownloadToken,
      `jobId: ${job?.id}, sha256: ${job?.fileHash?.substring(0, 16)}...`
    );

    // -------------------------------------------------------------
    // TEST 13: Single-Use HMAC Download Token & Replay Prevention
    // -------------------------------------------------------------
    if (job?.id && jobSubmit.data?.downloadToken) {
      const dlToken = jobSubmit.data.downloadToken;
      // First download -> should succeed
      const dl1 = await request({
        path: `/api/jobs/${job.id}/download?token=${dlToken}`,
        method: 'GET',
      });
      const firstPass = dl1.status === 200 && dl1.data.toString().startsWith('%PDF-');

      // Second download with same token -> MUST BE REJECTED WITH 403
      const dl2 = await request({
        path: `/api/jobs/${job.id}/download?token=${dlToken}`,
        method: 'GET',
      });
      const replayRejected = dl2.status === 403;

      record(
        'Security: Single-Use Download Token Replay Rejection',
        firstPass && replayRejected,
        `First call: ${dl1.status}, Second call: ${dl2.status} (Forbidden Replay Rejected)`
      );
    }

    console.log('\n================================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.length - passedCount;
    console.log(` SUMMARY: ${passedCount}/${results.length} TESTS PASSED (${failedCount} failed)`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during E2E verification:', err);
    process.exit(1);
  }
}

run();
