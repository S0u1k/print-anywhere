export type JobStatus =
  | 'CREATED'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'QUEUED'
  | 'DISPATCHED'
  | 'SENT_TO_DEVICE'
  | 'RECEIVED_BY_DEVICE'
  | 'RECEIVED_BY_GATEWAY'
  | 'VALIDATING'
  | 'RENDERING'
  | 'SUBMITTED_TO_PRINTER'
  | 'SPOOLING'
  | 'PRINTING'
  | 'DATA_ACCEPTED'
  | 'SPOOLER_COMPLETED'
  | 'COMPLETED'
  | 'SIMULATED_COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'STATUS_UNKNOWN';

export type GatewayType = 'WINDOWS_HOST' | 'ANDROID_USB';

export type DeviceRole = 'CONTROLLER' | 'WINDOWS_GATEWAY' | 'ANDROID_GATEWAY';

export type DeviceType = 'LAPTOP' | 'PHONE' | 'TABLET' | 'DESKTOP';

export type PairingStatus = 'PENDING' | 'CLAIMED' | 'APPROVED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface GuestWorkspace {
  id: string;
  name: string;
  recoveryKey?: string;
  pairedDeviceIds: string[];
  createdAt: number;
  lastActiveAt: number;
}

export interface DeviceSummary {
  deviceId: string;
  name: string;
  deviceType: DeviceType;
  os: string;
  role: DeviceRole;
  gatewayType?: GatewayType;
  printerModel?: string | null;
}

export interface Device {
  id: string;
  userId?: string;
  workspaceId?: string;
  name: string;
  deviceType?: DeviceType;
  gatewayType?: GatewayType;
  roles?: DeviceRole[];
  deviceToken?: string;
  isOnline: boolean;
  isPrinterConnected: boolean;
  printerModel: string | null;
  printerVid: number | string | null;
  printerPid: number | string | null;
  activeBackend: string;
  batteryPercent: number;
  osVersion?: string;
  lastSeenAt: number | null;
  isRevoked?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PairingSession {
  id: string;
  pairingCode: string; // 8-character manual code
  qrToken: string;
  workspaceId?: string;
  userId?: string;
  initiatorDevice: DeviceSummary;
  claimerDevice?: DeviceSummary;
  status: PairingStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  completedAt?: number;
  createdAt: number;
}

export interface Printer {
  id: string;
  deviceId: string;
  workspaceId?: string;
  userId?: string;
  name: string;
  manufacturer: string;
  model: string;
  gatewayType: GatewayType;
  connectionType: 'USB' | 'USB_OTG';
  driverIdentifier: string;
  compatibilityStatus: 'COMPATIBLE' | 'TESTED' | 'DIAGNOSTIC_REQUIRED';
  isOnline: boolean;
  status: 'READY' | 'PRINTING' | 'BUSY' | 'ERROR' | 'OFFLINE';
  lastSeenAt: number;
  capabilities?: {
    color: boolean;
    duplex: boolean;
    dpi: number[];
    paperSizes: string[];
  };
  errorMessage?: string | null;
  vendorId?: number | string;
  productId?: number | string;
  ieee1284String?: string | null;
  backend?: string;
  isTargetCanon?: boolean;
  createdAt: number;
}

export interface PrintOptions {
  copies: number;
  pageRange: string;
  paperSize: 'A4' | 'LETTER';
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  colorMode: 'COLOR' | 'MONOCHROME';
  dpi: number;
}

export interface PrintJob {
  id: string;
  userId?: string;
  workspaceId?: string;
  deviceId: string;
  gatewayType?: GatewayType;
  printerId?: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath?: string;
  downloadToken?: string;
  fileHash?: string;
  status: JobStatus;
  options: PrintOptions;
  totalPages: number;
  progressPercent: number;
  errorMessage: string | null;
  isSimulated: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PrintJobEvent {
  id: string;
  jobId: string;
  status: JobStatus;
  progressPercent: number;
  message: string;
  isSimulated: boolean;
  timestamp: number;
}
