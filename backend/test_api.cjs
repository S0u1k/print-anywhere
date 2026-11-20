const http = require('http');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      'http://localhost:5000' + path,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
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
  console.log('1. Logging in as souvik@pocketprint.io...');
  const loginRes = await postJson('/api/auth/login', {
    email: 'souvik@pocketprint.io',
    password: 'Password123!',
  });
  console.log('Login status:', loginRes.status);
  const token = loginRes.data.token;
  console.log('Token acquired:', token ? 'YES' : 'NO');

  console.log('\n2. Fetching /api/devices...');
  const devicesRes = await getJson('/api/devices', token);
  console.log('Devices:', JSON.stringify(devicesRes.data, null, 2));

  console.log('\n3. Fetching /api/printers...');
  const printersRes = await getJson('/api/printers', token);
  console.log('Printers:', JSON.stringify(printersRes.data, null, 2));
}

run().catch(console.error);
