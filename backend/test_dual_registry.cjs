const http = require('http');

function postJson(path, payload, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(
      'http://localhost:5000' + path,
      { method: 'POST', headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    http.get(
      'http://localhost:5000' + path,
      { headers: { Authorization: 'Bearer ' + token } },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        });
      }
    ).on('error', reject);
  });
}

async function run() {
  const loginRes = await postJson('/api/auth/login', {
    email: 'souvik@pocketprint.io',
    password: 'Password123!',
  });
  const token = loginRes.data.token;
  const user = loginRes.data.user;

  console.log('1. User logged in:', user.name, user.id);

  // Register Android USB Gateway
  console.log('\n2. Registering Android Phone Gateway...');
  const pairCodeRes = await postJson('/api/devices/pair-code', {}, token);
  const code = pairCodeRes.data.pairingCode;

  const pairRes = await postJson('/api/devices/pair', {
    pairingCode: code,
    deviceId: 'dev-android-pixel-01',
    deviceName: 'Google Pixel 8 Pro (Android USB Gateway)',
  });
  console.log('Pair response:', pairRes.status, pairRes.data.device.name);

  // Register Printer attached to Android Gateway via USB OTG
  console.log('\n3. Registering Canon PIXMA MG2570S on Android USB OTG...');
  const printerRes = await postJson(
    '/api/printers',
    {
      deviceId: 'dev-android-pixel-01',
      name: 'Canon PIXMA MG2570S (USB OTG)',
      manufacturer: 'Canon',
      model: 'Canon PIXMA MG2570S',
      gatewayType: 'ANDROID_USB',
      connectionType: 'USB_OTG',
      driverIdentifier: 'CanonPixmaBackend',
      status: 'READY',
      isOnline: true,
    },
    token
  );
  console.log('Printer created:', printerRes.status, printerRes.data.printer.name);

  // Now list both gateways and printers
  console.log('\n4. Verifying Dual-Gateway Registry...');
  const devices = await getJson('/api/devices', token);
  console.log('Gateways in registry:');
  devices.data.devices.forEach((d) => {
    console.log(` - [${d.gatewayType || 'UNKNOWN'}] ${d.name} (Online: ${d.isOnline})`);
  });

  const printers = await getJson('/api/printers', token);
  console.log('\nPrinters in registry:');
  printers.data.printers.forEach((p) => {
    console.log(` - [${p.gatewayType}] ${p.name} | Connection: ${p.connectionType} | Driver: ${p.driverIdentifier} (Status: ${p.status})`);
  });
}

run().catch(console.error);
