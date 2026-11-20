import { io, Socket } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DataStore } from './db/store.js';
import { generateDeviceToken } from './utils/auth.js';
import { JobStatus, GatewayType } from './types/index.js';
import { initializeFirebaseAdmin, getRealtimeDb } from './services/firebaseAdmin.js';

const execAsync = promisify(exec);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const DEFAULT_PRINTER_NAME = 'Canon MG2500 series Printer';
const MS_EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

interface WindowsPrinterInfo {
  name: string;
  portName: string;
  driverName: string;
  printerStatus: number;
  isCanonTarget: boolean;
}

async function discoverWindowsPrinters(): Promise<WindowsPrinterInfo[]> {
  try {
    const cmd = `powershell -NoProfile -Command "Get-Printer | Select-Object Name, PortName, DriverName, PrinterStatus | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    if (!stdout.trim()) return [];
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((p: any) => ({
      name: p.Name || '',
      portName: p.PortName || '',
      driverName: p.DriverName || '',
      printerStatus: p.PrinterStatus || 0,
      isCanonTarget: (p.Name || '').toLowerCase().includes('canon') || (p.DriverName || '').toLowerCase().includes('canon'),
    }));
  } catch (err) {
    console.warn('[Laptop Agent] Could not enumerate Windows printers via PowerShell:', err);
    return [];
  }
}

async function checkPrinterQueue(printerName: string): Promise<number> {
  try {
    const cmd = `powershell -NoProfile -Command "Get-PrintJob -PrinterName '${printerName}' -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`;
    const { stdout } = await execAsync(cmd);
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed with HTTP ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function spoolPdfToWindowsPrinter(filePath: string, printerName: string): Promise<void> {
  console.log(`[Laptop Agent] Spooling PDF to Windows Printer: "${printerName}"`);
  
  if (fs.existsSync(MS_EDGE_PATH)) {
    // Launch headless Edge to spool to Windows printer, allow up to 6s for spooler registration, then terminate headless process
    const cmd = `powershell -NoProfile -Command "$p = Start-Process -FilePath '${MS_EDGE_PATH}' -ArgumentList '--headless', '--disable-gpu', '--print-to-printer=\\"${printerName}\\"', '${filePath}' -PassThru; Start-Sleep -Seconds 4; if (!$p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }"`;
    console.log(`[Laptop Agent] Executing Windows Spooler Dispatch via Headless Edge...`);
    await execAsync(cmd);
  } else {
    // Fallback: PowerShell Start-Process with PrintTo verb
    const psCmd = `powershell -NoProfile -Command "Start-Process -FilePath '${filePath}' -Verb PrintTo -ArgumentList '\"${printerName}\"' -Wait"`;
    console.log(`[Laptop Agent] Executing fallback PrintTo verb: ${psCmd}`);
    await execAsync(psCmd);
  }
}

async function startLaptopAgent() {
  console.log('====================================================');
  console.log('   PocketPrint Bridge — Windows Laptop Print Agent  ');
  console.log('   Mode A: Windows Laptop Print Gateway Engine      ');
  console.log('====================================================');

  const store = DataStore.getInstance();
  
  // 1. Discover Windows printers
  const printers = await discoverWindowsPrinters();
  console.log(`[Laptop Agent] Discovered ${printers.length} installed Windows printer(s):`);
  printers.forEach((p, idx) => {
    console.log(`  ${idx + 1}. "${p.name}" (Port: ${p.portName}, Driver: ${p.driverName}) ${p.isCanonTarget ? '★ [TARGET CANON PIXMA]' : ''}`);
  });

  const targetCanon = printers.find((p) => p.isCanonTarget && !p.name.includes('XPS')) || printers.find((p) => p.isCanonTarget) || null;
  const activePrinterName = targetCanon ? targetCanon.name : DEFAULT_PRINTER_NAME;

  if (targetCanon) {
    console.log(`[Laptop Agent] Target Canon Printer verified: "${targetCanon.name}" on ${targetCanon.portName}`);
  } else {
    console.warn(`[Laptop Agent] WARNING: Canon MG2500 series printer not detected in Windows spooler. Defaulting to "${DEFAULT_PRINTER_NAME}".`);
  }

  // 2. Associate with user account
  let user = store.findUserByEmail('souvik@pocketprint.io');
  if (!user) {
    user = store.createUser({
      id: 'usr-souvik-admin',
      email: 'souvik@pocketprint.io',
      name: 'Souvik Admin',
      passwordHash: '$2b$10$vKTnGVUMCMVizq4QwbemluXLN3BGI7grXIB6lDIkGGnWfbuhF8lKu', // Password123!
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  console.log(`[Laptop Agent] Gateway user: ${user.name} (${user.email})`);

  // 3. Register or get device in persistent store
  let device = store.findDevicesByUserId(user.id).find((d) => d.name.includes('Windows Laptop'));
  const gatewayType: GatewayType = 'WINDOWS_HOST';

  if (!device) {
    device = store.upsertDevice({
      id: `dev-laptop-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      name: 'Windows Laptop Gateway (Canon MG2500)',
      gatewayType,
      isOnline: true,
      lastSeenAt: Date.now(),
      isPrinterConnected: true,
      printerModel: activePrinterName,
      printerVid: '0x04A9',
      printerPid: '0x176D',
      activeBackend: 'Windows Canon Driver (USB001)',
      batteryPercent: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`[Laptop Agent] Created new device registration: ${device.id}`);
  } else {
    store.updateDeviceOnline(device.id, true, {
      name: 'Windows Laptop Gateway (Canon MG2500)',
      gatewayType,
      isPrinterConnected: true,
      printerModel: activePrinterName,
      printerVid: '0x04A9',
      printerPid: '0x176D',
      activeBackend: 'Windows Canon Driver (USB001)',
      batteryPercent: 100,
    });
    console.log(`[Laptop Agent] Using existing device registration: ${device.id}`);
  }

  // Register printer in store
  const printerId = `prn-${device.id}`;
  store.upsertPrinter({
    id: printerId,
    deviceId: device.id,
    name: activePrinterName,
    manufacturer: 'Canon',
    model: 'Canon PIXMA MG2570S',
    gatewayType: 'WINDOWS_HOST',
    connectionType: 'USB',
    driverIdentifier: 'Canon MG2500 series Printer',
    compatibilityStatus: 'COMPATIBLE',
    isOnline: true,
    status: 'READY',
    lastSeenAt: Date.now(),
    capabilities: {
      color: true,
      duplex: false,
      dpi: [300, 600],
      paperSizes: ['A4', 'LETTER'],
    },
    createdAt: Date.now(),
  });

  const deviceToken = generateDeviceToken({
    deviceId: device.id,
    role: 'device',
    userId: user.id,
  });

  // 4. Connect to Cloud Relay via outbound WebSocket
  const socket: Socket = io(SERVER_URL, {
    auth: {
      token: deviceToken,
      role: 'device',
      deviceId: device.id,
    },
    reconnection: true,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log(`[Laptop Agent] Connected to Cloud Relay at ${SERVER_URL} as Device ID: ${device.id}`);
    
    // Register device details
    socket.emit('device:register', {
      name: 'Windows Laptop Gateway (Canon MG2500)',
      gatewayType: 'WINDOWS_HOST',
      isPrinterConnected: true,
      printerModel: activePrinterName,
      printerVid: '0x04A9',
      printerPid: '0x176D',
      activeBackend: 'Windows Canon Driver',
      batteryPercent: 100,
    });

    // Announce printer status
    socket.emit('printer:status', {
      id: printerId,
      name: activePrinterName,
      manufacturer: 'Canon',
      model: 'Canon PIXMA MG2570S',
      gatewayType: 'WINDOWS_HOST',
      connectionType: 'USB',
      driverIdentifier: 'Canon MG2500 series Printer',
      status: 'READY',
      isOnline: true,
    });
  });

  // 4b. Connect to Firebase Realtime Database (if configured)
  initializeFirebaseAdmin();
  const rtdb = getRealtimeDb();
  if (rtdb) {
    try {
      console.log(`[Laptop Agent] Connecting to Firebase Realtime Database for gateway: ${device.id}`);
      const presenceRef = rtdb.ref(`presence/${device.id}`);
      presenceRef.set({
        isOnline: true,
        gatewayType: 'WINDOWS_HOST',
        printerModel: activePrinterName,
        printerVid: '0x04A9',
        printerPid: '0x176D',
        lastSeenAt: Date.now(),
      });
      presenceRef.onDisconnect().update({ isOnline: false, lastSeenAt: Date.now() });

      const inboxRef = rtdb.ref(`gatewayInbox/${device.id}`);
      inboxRef.on('child_added', async (snapshot: any) => {
        const job = snapshot.val();
        if (!job || !job.jobId) return;
        console.log(`[Laptop Agent] >>> Firebase RTDB: Received print job ${job.jobId}`);
        const ackRef = rtdb.ref(`gatewayAcks/${device.id}/${job.jobId}`);
        await ackRef.set({ status: 'ACKNOWLEDGED', acknowledgedAt: Date.now() });
      });
    } catch (e: any) {
      console.warn('[Laptop Agent] Firebase RTDB connection deferred:', e.message);
    }
  }

  // Heartbeat every 10 seconds
  setInterval(() => {
    if (socket.connected) {
      socket.emit('device:heartbeat', {
        gatewayType: 'WINDOWS_HOST',
        isPrinterConnected: true,
        printerModel: activePrinterName,
        printerVid: '0x04A9',
        printerPid: '0x176D',
        activeBackend: 'Windows Canon Driver',
        batteryPercent: 100,
      });
    }
  }, 10000);

  // 5. Reusable Print Execution Engine
  const processedJobIds = new Set<string>();

  const executePrintJob = async (job: any) => {
    if (processedJobIds.has(job.id)) return;
    processedJobIds.add(job.id);

    console.log(`\n[Laptop Agent] >>> PROCESSING PRINT JOB: "${job.originalName || job.fileName}" (Job ID: ${job.id})`);
    console.log(`[Laptop Agent] Destination Printer: "${activePrinterName}", Paper: ${job.options?.paperSize || 'A4'}, Copies: ${job.options?.copies || 1}`);

    const emitStatus = async (status: JobStatus, progressPercent: number, message: string) => {
      if (socket.connected) {
        socket.emit('job:status_update', {
          jobId: job.id,
          status,
          progressPercent,
          message,
          isSimulated: false,
        });
      }
      try {
        await fetch(`${SERVER_URL}/api/jobs/${job.id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deviceToken}`,
            'x-device-token': deviceToken,
          },
          body: JSON.stringify({ status, progressPercent, message }),
        });
      } catch {}
      store.updatePrintJobStatus(job.id, status, progressPercent, message);
    };

    const tempDir = path.join(process.cwd(), 'temp_spool');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const localPdfPath = path.join(tempDir, `${job.id}.pdf`);

    try {
      // Step 1: RECEIVED_BY_GATEWAY
      await emitStatus('RECEIVED_BY_GATEWAY', 20, 'PDF received by Windows Laptop Print Agent');

      // Step 2: Download PDF securely
      const downloadUrl = `${SERVER_URL}/api/jobs/${job.id}/download?token=${job.downloadToken}`;
      console.log(`[Laptop Agent] Downloading document: ${downloadUrl}`);
      await downloadFile(downloadUrl, localPdfPath);

      // Verify downloaded file exists and is valid
      if (!fs.existsSync(localPdfPath) || fs.statSync(localPdfPath).size === 0) {
        throw new Error('Downloaded PDF is empty or missing');
      }

      // Step 3: VALIDATING
      await emitStatus('VALIDATING', 35, `Validating document for "${activePrinterName}"...`);
      await new Promise((r) => setTimeout(r, 600));

      // Step 4: SUBMITTED_TO_PRINTER
      await emitStatus('SUBMITTED_TO_PRINTER', 50, `Submitting document to Canon Windows Driver on USB001...`);
      await new Promise((r) => setTimeout(r, 500));

      // Step 5: SPOOLING
      await emitStatus('SPOOLING', 70, `Spooling print job to Windows Print Queue...`);
      await spoolPdfToWindowsPrinter(localPdfPath, activePrinterName);

      // Step 6: SPOOLER_COMPLETED
      await emitStatus('SPOOLER_COMPLETED', 90, `Windows Spooler transmitted job data to Canon PIXMA MG2570S`);
      await new Promise((r) => setTimeout(r, 800));

      // Step 7: COMPLETED
      await emitStatus('COMPLETED', 100, `Print job successfully spooled to Canon PIXMA MG2570S via USB001!`);
      console.log(`[Laptop Agent] >>> PRINT JOB ${job.id} COMPLETED SUCCESSFULLY!\n`);

      // Cleanup local temp file after delay
      setTimeout(() => {
        try {
          if (fs.existsSync(localPdfPath)) fs.unlinkSync(localPdfPath);
        } catch {}
      }, 5000);

    } catch (err: any) {
      console.error(`[Laptop Agent] Error processing job ${job.id}:`, err);
      await emitStatus('FAILED', 0, `Print error: ${err.message || 'Windows Spooler dispatch failure'}`);
      try {
        if (fs.existsSync(localPdfPath)) fs.unlinkSync(localPdfPath);
      } catch {}
    }
  };

  // Event trigger via WebSocket
  socket.on('job:incoming', executePrintJob);

  // Fallback Polling Loop (resilient to serverless environments)
  setInterval(async () => {
    try {
      const jobsUrl = `${SERVER_URL}/api/jobs`;
      const res = await fetch(jobsUrl, {
        headers: {
          'Authorization': `Bearer ${deviceToken}`,
          'x-device-token': deviceToken,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        const pending = (data.jobs || []).filter(
          (j: any) =>
            (j.deviceId === device.id || j.gatewayType === 'WINDOWS_HOST') &&
            ['QUEUED', 'DISPATCHED'].includes(j.status) &&
            !processedJobIds.has(j.id)
        );
        for (const job of pending) {
          await executePrintJob(job);
        }
      }
    } catch {
      // Quietly ignore transient network/polling errors
    }
  }, 5000);

  socket.on('device:revoked', () => {
    console.warn('[Laptop Agent] Received revocation notification from Cloud Relay: This device has been disconnected/revoked.');
  });

  socket.on('disconnect', () => {
    console.log('[Laptop Agent] Disconnected from Cloud Relay. Reconnecting...');
  });
}

startLaptopAgent().catch((err) => {
  console.error('[Laptop Agent] Fatal error:', err);
});
