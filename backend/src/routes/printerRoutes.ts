import { Router, Response } from 'express';
import crypto from 'crypto';
import { DataStore } from '../db/store.js';
import { requireSessionAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { Printer } from '../types/index.js';

const uuidv4 = () => crypto.randomUUID();
const router = Router();
const store = DataStore.getInstance();

// GET /api/printers — List all printers across session's paired gateways (account or guest workspace)
router.get('/', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const scopeId = req.workspaceId!;
  const printers = store.findPrintersByScope(scopeId);
  res.json({ printers });
});

// GET /api/printers/:id — Get details of a specific printer
router.get('/:id', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const printerId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const printer = store.findPrinterById(printerId);
  if (!printer) {
    res.status(404).json({ error: 'Printer not found' });
    return;
  }

  const device = store.findDeviceById(printer.deviceId);
  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(403).json({ error: 'Unauthorized: Printer not accessible in current workspace' });
    return;
  }

  res.json({ printer, device });
});

// POST /api/printers — Register or update a printer attached to a device
router.post('/', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const {
    id,
    deviceId,
    name,
    manufacturer,
    model,
    gatewayType,
    connectionType,
    driverIdentifier,
    compatibilityStatus,
    isOnline,
    status,
    capabilities,
  } = req.body;

  if (!deviceId || !name) {
    res.status(400).json({ error: 'deviceId and name are required' });
    return;
  }

  const scopeId = req.workspaceId!;
  const device = store.findDeviceById(deviceId);
  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(403).json({ error: 'Device not found or not owned in current workspace' });
    return;
  }

  const printerId = id || `prn-${uuidv4().substring(0, 8)}`;
  const isGuest = req.isGuest || false;

  const printer: Printer = {
    id: printerId,
    deviceId,
    userId: !isGuest ? scopeId : undefined,
    workspaceId: isGuest ? scopeId : undefined,
    name,
    manufacturer: manufacturer || 'Canon',
    model: model || 'Canon PIXMA MG2570S',
    gatewayType: gatewayType || device.gatewayType || 'WINDOWS_HOST',
    connectionType: connectionType || (gatewayType === 'ANDROID_USB' ? 'USB_OTG' : 'USB'),
    driverIdentifier: driverIdentifier || 'Canon MG2500 series Printer',
    compatibilityStatus: compatibilityStatus || 'COMPATIBLE',
    isOnline: isOnline ?? true,
    status: status || 'READY',
    lastSeenAt: Date.now(),
    capabilities: capabilities || {
      color: true,
      duplex: false,
      dpi: [300, 600],
      paperSizes: ['A4', 'LETTER'],
    },
    createdAt: Date.now(),
  };

  const saved = store.upsertPrinter(printer);
  res.status(201).json({ printer: saved });
});

// DELETE /api/printers/:id — Delete a printer
router.delete('/:id', requireSessionAuth, (req: AuthenticatedRequest, res: Response) => {
  const printerId = String(req.params.id);
  const scopeId = req.workspaceId!;
  const printer = store.findPrinterById(printerId);
  if (!printer) {
    res.status(404).json({ error: 'Printer not found' });
    return;
  }

  const device = store.findDeviceById(printer.deviceId);
  if (!device || (device.userId !== scopeId && device.workspaceId !== scopeId)) {
    res.status(403).json({ error: 'Unauthorized: Printer not owned in current workspace' });
    return;
  }

  store.deletePrinter(printerId);
  res.json({ message: 'Printer deleted successfully' });
});

export default router;
