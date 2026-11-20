import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';

const uuidv4 = () => crypto.randomUUID();
import {
  requireSessionAuth,
  requireSessionOrDeviceAuth,
  AuthenticatedRequest,
} from '../middleware/authMiddleware.js';
import {
  generateExpiringDownloadToken,
  verifyToken,
} from '../utils/auth.js';
import { dispatchJobToDevice, dispatchCancelToDevice } from '../socket/index.js';
import { dispatchJobToGatewayInbox } from '../services/firebaseAdmin.js';
import { PrintJob, PrintOptions } from '../types/index.js';

const router = Router();
const store = DataStore.getInstance();

const UPLOAD_DIR = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  ? path.join('/tmp', 'uploads')
  : path.join(process.cwd(), 'uploads');

try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[Storage] Read-only filesystem detected, uploads directory deferred to writable path');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${uuidv4().substring(0, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are supported'));
    }
  },
});

// Replay protection: Single-use download token store
const usedDownloadTokens = new Set<string>();

const handleUpload = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF file uploaded' });
      return;
    }

    const scopeId = req.workspaceId!;
    let { deviceId, printerId, copies, pageRange, paperSize, orientation, colorMode, dpi } = req.body;
    let targetPrinter = null;
    if (printerId) {
      targetPrinter = store.findPrinterById(printerId);
      if (targetPrinter) {
        deviceId = targetPrinter.deviceId;
      }
    }

    if (!deviceId) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Target deviceId or printerId is required' });
      return;
    }

    // Verify session owns target device
    const device = store.findDeviceById(deviceId);
    if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
      fs.unlinkSync(req.file.path);
      res.status(403).json({ error: 'Device not found or not accessible in current workspace' });
      return;
    }

    const gatewayType =
      targetPrinter?.gatewayType ||
      device.gatewayType ||
      (device.name.includes('Windows') ? 'WINDOWS_HOST' : 'ANDROID_USB');

    // Validate PDF magic bytes (%PDF-)
    const buffer = Buffer.alloc(5);
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, buffer, 0, 5, 0);
    fs.closeSync(fd);

    if (buffer.toString('utf-8', 0, 5) !== '%PDF-') {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'Uploaded file is not a valid PDF document (magic bytes mismatch)' });
      return;
    }

    // Compute SHA-256
    const fileBytes = fs.readFileSync(req.file.path);
    const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');

    const jobId = `job-${uuidv4().substring(0, 8)}`;
    const downloadToken = generateExpiringDownloadToken(jobId, 60);

    const printOptions: PrintOptions = {
      copies: parseInt(copies || '1', 10) || 1,
      pageRange: pageRange || 'ALL',
      paperSize: paperSize === 'LETTER' ? 'LETTER' : 'A4',
      orientation: orientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT',
      colorMode: colorMode === 'MONOCHROME' ? 'MONOCHROME' : 'COLOR',
      dpi: parseInt(dpi || '300', 10) || 300,
    };

    const isGuest = req.isGuest || false;

    const job: PrintJob = {
      id: jobId,
      userId: !isGuest ? scopeId : undefined,
      workspaceId: isGuest ? scopeId : undefined,
      deviceId,
      gatewayType,
      printerId: targetPrinter ? targetPrinter.id : undefined,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      downloadToken,
      fileHash: sha256,
      status: 'QUEUED',
      options: printOptions,
      totalPages: 1,
      progressPercent: 0,
      errorMessage: null,
      isSimulated: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    store.createPrintJob(job);
    store.createFileMetadata({
      id: `file-${uuidv4().substring(0, 8)}`,
      jobId,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      sha256,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    // Dispatch job to gateway over WebSocket if device is online
    if (device.isOnline) {
      dispatchJobToDevice(job);
      const gwLabel = gatewayType === 'WINDOWS_HOST' ? 'Windows Laptop Print Agent' : 'Android USB Gateway';
      store.updatePrintJobStatus(job.id, 'DISPATCHED', 10, `Dispatched to ${gwLabel}`);
    }

    // Also dispatch to Firebase Realtime Database Gateway Inbox
    dispatchJobToGatewayInbox(deviceId, job.id, {
      workspaceId: scopeId,
      deviceId,
      fileName: job.fileName,
      originalName: job.originalName,
      fileSize: job.fileSize,
      fileHash: job.fileHash,
      downloadUrl: `/api/jobs/${job.id}/download?token=${downloadToken}`,
      options: job.options,
    }).catch(() => {});

    res.status(201).json({
      message: 'Print job created and queued',
      job,
      downloadToken,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to process print job', message: e.message });
  }
};

router.post('/upload', requireSessionAuth, upload.single('file'), handleUpload);
router.post('/', requireSessionAuth, upload.single('file'), handleUpload);

// List jobs for current session (account or guest workspace) or paired gateway device
router.get('/', requireSessionOrDeviceAuth, (req: AuthenticatedRequest, res: Response) => {
  const scopeId = req.workspaceId;
  let jobs = scopeId ? store.findPrintJobsByScope(scopeId) : [];
  if (req.device?.deviceId) {
    const deviceJobs = store.findPrintJobsByDeviceId(req.device.deviceId);
    const jobMap = new Map();
    jobs.forEach((j) => jobMap.set(j.id, j));
    deviceJobs.forEach((j) => jobMap.set(j.id, j));
    jobs = Array.from(jobMap.values()).sort((a, b) => b.createdAt - a.createdAt);
  }
  res.json({ jobs });
});

// Get job by ID with timeline events
router.get('/:id', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const jobId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const job = store.findPrintJobById(jobId);

  if (!job || (job.userId !== scopeId && job.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const events = store.getEventsForJob(jobId);
  const metadata = store.findFileMetadataByJobId(jobId);

  res.json({
    job,
    events,
    fileMetadata: metadata || null,
  });
});

// Cancel Job
router.post('/:id/cancel', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const jobId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const job = store.findPrintJobById(jobId);

  if (!job || (job.userId !== scopeId && job.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status === 'COMPLETED' || job.status === 'FAILED') {
    res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    return;
  }

  store.updatePrintJobStatus(job.id, 'CANCELLED', job.progressPercent, 'Cancelled by user');
  dispatchCancelToDevice(job.deviceId, job.id);

  res.json({ message: 'Job cancelled successfully', jobId: job.id });
});

// Retry Failed Job
router.post('/:id/retry', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const jobId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const job = store.findPrintJobById(jobId);

  if (!job || (job.userId !== scopeId && job.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const device = store.findDeviceById(job.deviceId);
  const updated = store.updatePrintJobStatus(job.id, 'QUEUED', 0, 'Job queued for retry');

  if (device && device.isOnline && updated) {
    dispatchJobToDevice(updated);
    store.updatePrintJobStatus(job.id, 'DISPATCHED', 10, 'Dispatched to gateway');
  }

  res.json({ message: 'Job re-queued', job: updated });
});

// Update job status (HTTP REST endpoint for gateways and clients)
const handleStatusUpdate = (req: AuthenticatedRequest, res: Response) => {
  const jobId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const job = store.findPrintJobById(jobId);

  if (!job || (job.userId !== scopeId && job.workspaceId !== scopeId)) {
    res.status(404).json({ error: 'Job not found or inaccessible in current scope' });
    return;
  }

  const { status, progressPercent, message } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }

  const updated = store.updatePrintJobStatus(
    job.id,
    status,
    typeof progressPercent === 'number' ? progressPercent : job.progressPercent,
    message || ''
  );

  res.json({ message: 'Job status updated successfully', job: updated });
};

router.patch('/:id/status', requireSessionOrDeviceAuth, handleStatusUpdate);
router.post('/:id/status', requireSessionOrDeviceAuth, handleStatusUpdate);

// Secure PDF Download for Phone or Laptop Gateway
router.get('/:id/download', (req: Request, res: Response) => {
  const jobId = String(req.params.id);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (req.headers['x-download-token'] as string) || (req.query.token as string);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing download token' });
    return;
  }

  if (usedDownloadTokens.has(token)) {
    res.status(403).json({ error: 'Forbidden: Download token has already been consumed (Single-use enforcement)' });
    return;
  }

  const payload = verifyToken<{ jobId: string; purpose: string }>(token);
  if (!payload || payload.jobId !== jobId || payload.purpose !== 'download') {
    res.status(403).json({ error: 'Forbidden: Invalid or expired download token' });
    return;
  }

  const job = store.findPrintJobById(jobId);
  if (!job || !fs.existsSync(job.filePath)) {
    res.status(404).json({ error: 'File not found on relay server' });
    return;
  }

  usedDownloadTokens.add(token);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${job.originalName}"`);
  fs.createReadStream(job.filePath).pipe(res);
});

export default router;
