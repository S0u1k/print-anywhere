import fs from 'fs';
import path from 'path';
import {
  User,
  GuestWorkspace,
  Device,
  DeviceCredential,
  PairingSession,
  Printer,
  PrintJob,
  PrintJobEvent,
  FileMetadata,
} from '../types/index.js';

interface DatabaseData {
  users: User[];
  guestWorkspaces: GuestWorkspace[];
  devices: Device[];
  deviceCredentials: DeviceCredential[];
  pairingSessions: PairingSession[];
  printers: Printer[];
  printJobs: PrintJob[];
  printJobEvents: PrintJobEvent[];
  fileMetadata: FileMetadata[];
}

export class DataStore {
  private static instance: DataStore;
  private filePath: string;
  private data: DatabaseData;

  private constructor(filePath?: string) {
    this.filePath = filePath || (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? path.join('/tmp', 'pocketprint_store.json')
      : path.join(process.cwd(), 'pocketprint_store.json'));
    this.data = {
      users: [],
      guestWorkspaces: [],
      devices: [],
      deviceCredentials: [],
      pairingSessions: [],
      printers: [],
      printJobs: [],
      printJobEvents: [],
      fileMetadata: [],
    };
    this.load();
  }

  public static getInstance(customPath?: string): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore(customPath);
    }
    return DataStore.instance;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          users: parsed.users || [],
          guestWorkspaces: parsed.guestWorkspaces || [],
          devices: parsed.devices || [],
          deviceCredentials: parsed.deviceCredentials || [],
          pairingSessions: parsed.pairingSessions || [],
          printers: parsed.printers || [],
          printJobs: parsed.printJobs || [],
          printJobEvents: parsed.printJobEvents || [],
          fileMetadata: parsed.fileMetadata || [],
        };
      }
    } catch (e) {
      console.warn('Could not load persistent store, starting fresh:', e);
    }
  }

  private persist(): void {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('Error persisting database:', e);
    }
  }

  // --- Users (Account Mode) ---
  public findUserById(id: string): User | undefined {
    this.load();
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmail(email: string): User | undefined {
    this.load();
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: User): User {
    this.data.users.push(user);
    this.persist();
    return user;
  }

  public updateUserPassword(email: string, newPasswordHash: string): boolean {
    const user = this.findUserByEmail(email);
    if (user) {
      user.passwordHash = newPasswordHash;
      user.updatedAt = Date.now();
      this.persist();
      return true;
    }
    return false;
  }

  // --- Guest Workspaces (Accountless Quick Pair Mode) ---
  public createGuestWorkspace(workspace: GuestWorkspace): GuestWorkspace {
    this.data.guestWorkspaces.push(workspace);
    this.persist();
    return workspace;
  }

  public findGuestWorkspaceById(id: string): GuestWorkspace | undefined {
    this.load();
    return this.data.guestWorkspaces.find((w) => w.id === id);
  }

  public findGuestWorkspaceByRecoveryHash(recoveryKeyHash: string): GuestWorkspace | undefined {
    this.load();
    return this.data.guestWorkspaces.find((w) => w.recoveryKeyHash === recoveryKeyHash);
  }

  public updateGuestWorkspace(id: string, updates: Partial<GuestWorkspace>): GuestWorkspace | undefined {
    const ws = this.findGuestWorkspaceById(id);
    if (ws) {
      Object.assign(ws, updates);
      ws.lastActiveAt = Date.now();
      this.persist();
    }
    return ws;
  }

  public addDeviceToGuestWorkspace(workspaceId: string, deviceId: string): void {
    const ws = this.findGuestWorkspaceById(workspaceId);
    if (ws && !ws.pairedDeviceIds.includes(deviceId)) {
      ws.pairedDeviceIds.push(deviceId);
      ws.lastActiveAt = Date.now();
      this.persist();
    }
  }

  public removeDeviceFromGuestWorkspace(workspaceId: string, deviceId: string): void {
    const ws = this.findGuestWorkspaceById(workspaceId);
    if (ws) {
      ws.pairedDeviceIds = ws.pairedDeviceIds.filter((id) => id !== deviceId);
      ws.lastActiveAt = Date.now();
      this.persist();
    }
  }

  // --- Devices & Roles ---
  public findDeviceById(id: string): Device | undefined {
    this.load();
    return this.data.devices.find((d) => d.id === id);
  }

  public findDevicesByUserId(userId: string): Device[] {
    this.load();
    return this.data.devices.filter((d) => d.userId === userId && !d.isRevoked);
  }

  public findDevicesByWorkspaceId(workspaceId: string): Device[] {
    this.load();
    return this.data.devices.filter((d) => d.workspaceId === workspaceId && !d.isRevoked);
  }

  public findDevicesByScope(scopeId: string): Device[] {
    this.load();
    return this.data.devices.filter(
      (d) => (d.userId === scopeId || d.workspaceId === scopeId) && !d.isRevoked
    );
  }

  public upsertDevice(device: Device): Device {
    const idx = this.data.devices.findIndex((d) => d.id === device.id);
    if (idx >= 0) {
      this.data.devices[idx] = { ...this.data.devices[idx], ...device, updatedAt: Date.now() };
    } else {
      this.data.devices.push(device);
    }
    this.persist();
    return this.findDeviceById(device.id)!;
  }

  public updateDeviceOnline(deviceId: string, isOnline: boolean, metadata?: Partial<Device>): void {
    const dev = this.findDeviceById(deviceId);
    if (dev) {
      dev.isOnline = isOnline;
      dev.lastSeenAt = Date.now();
      if (metadata) {
        Object.assign(dev, metadata);
      }
      dev.updatedAt = Date.now();
      this.persist();
    }
  }

  public revokeDevice(deviceId: string): boolean {
    const dev = this.findDeviceById(deviceId);
    if (dev) {
      dev.isRevoked = true;
      dev.isOnline = false;
      dev.updatedAt = Date.now();
      // Revoke associated credential
      this.revokeDeviceCredential(deviceId);
      // Remove from any guest workspace list
      if (dev.workspaceId) {
        this.removeDeviceFromGuestWorkspace(dev.workspaceId, deviceId);
      }
      this.persist();
      return true;
    }
    return false;
  }

  public deleteDevice(deviceId: string): boolean {
    const initialLen = this.data.devices.length;
    this.data.devices = this.data.devices.filter((d) => d.id !== deviceId);
    this.data.printers = this.data.printers.filter((p) => p.deviceId !== deviceId);
    this.revokeDeviceCredential(deviceId);
    this.persist();
    return this.data.devices.length < initialLen;
  }

  // --- Device Credentials ---
  public createDeviceCredential(cred: DeviceCredential): DeviceCredential {
    this.data.deviceCredentials = this.data.deviceCredentials.filter((c) => c.deviceId !== cred.deviceId);
    this.data.deviceCredentials.push(cred);
    this.persist();
    return cred;
  }

  public findDeviceCredential(deviceId: string): DeviceCredential | undefined {
    this.load();
    return this.data.deviceCredentials.find((c) => c.deviceId === deviceId);
  }

  public revokeDeviceCredential(deviceId: string): void {
    const cred = this.findDeviceCredential(deviceId);
    if (cred) {
      cred.isRevoked = true;
      this.persist();
    }
  }

  public isDeviceRevoked(deviceId: string): boolean {
    const dev = this.findDeviceById(deviceId);
    if (!dev || dev.isRevoked) return true;
    const cred = this.findDeviceCredential(deviceId);
    return cred ? cred.isRevoked : false;
  }

  // --- Bidirectional Pairing Sessions ---
  public createPairingSession(session: PairingSession): PairingSession {
    this.data.pairingSessions.push(session);
    this.persist();
    return session;
  }

  public findPairingSessionById(id: string): PairingSession | undefined {
    this.load();
    return this.data.pairingSessions.find((s) => s.id === id);
  }

  public findPairingSessionByCode(code: string): PairingSession | undefined {
    this.load();
    const cleanCode = code.trim().toUpperCase();
    return this.data.pairingSessions.find(
      (s) => s.pairingCode.replace('-', '').toUpperCase() === cleanCode.replace('-', '')
    );
  }

  public findPairingSessionByQrToken(qrToken: string): PairingSession | undefined {
    this.load();
    return this.data.pairingSessions.find((s) => s.qrToken === qrToken);
  }

  public updatePairingSession(id: string, updates: Partial<PairingSession>): PairingSession | undefined {
    const session = this.findPairingSessionById(id);
    if (session) {
      Object.assign(session, updates);
      this.persist();
    }
    return session;
  }

  public markPairingSessionUsed(code: string, deviceId: string): void {
    const s = this.findPairingSessionByCode(code);
    if (s) {
      s.status = 'COMPLETED';
      s.completedAt = Date.now();
      this.persist();
    }
  }

  // --- Printers ---
  public findPrinterById(id: string): Printer | undefined {
    this.load();
    return this.data.printers.find((p) => p.id === id);
  }

  public findPrintersByDeviceId(deviceId: string): Printer[] {
    this.load();
    return this.data.printers.filter((p) => p.deviceId === deviceId);
  }

  public findPrintersByUserId(userId: string): Printer[] {
    this.load();
    const userDevices = this.findDevicesByUserId(userId);
    const deviceIds = new Set(userDevices.map((d) => d.id));
    return this.data.printers.filter((p) => deviceIds.has(p.deviceId) || p.userId === userId);
  }

  public findPrintersByWorkspaceId(workspaceId: string): Printer[] {
    this.load();
    const wsDevices = this.findDevicesByWorkspaceId(workspaceId);
    const deviceIds = new Set(wsDevices.map((d) => d.id));
    return this.data.printers.filter((p) => deviceIds.has(p.deviceId) || p.workspaceId === workspaceId);
  }

  public findPrintersByScope(scopeId: string): Printer[] {
    this.load();
    const scopeDevices = this.findDevicesByScope(scopeId);
    const deviceIds = new Set(scopeDevices.map((d) => d.id));
    return this.data.printers.filter(
      (p) => deviceIds.has(p.deviceId) || p.userId === scopeId || p.workspaceId === scopeId
    );
  }

  public upsertPrinter(printer: Printer): Printer {
    const idx = this.data.printers.findIndex((p) => p.id === printer.id);
    if (idx >= 0) {
      this.data.printers[idx] = { ...this.data.printers[idx], ...printer };
    } else {
      this.data.printers.push(printer);
    }
    this.persist();
    return this.findPrinterById(printer.id)!;
  }

  public updatePrinterStatus(
    id: string,
    status: Printer['status'],
    isOnline?: boolean,
    errorMessage?: string | null
  ): Printer | undefined {
    const p = this.findPrinterById(id);
    if (p) {
      p.status = status;
      if (isOnline !== undefined) p.isOnline = isOnline;
      if (errorMessage !== undefined) p.errorMessage = errorMessage;
      p.lastSeenAt = Date.now();
      this.persist();
    }
    return p;
  }

  public deletePrinter(id: string): boolean {
    const initialLen = this.data.printers.length;
    this.data.printers = this.data.printers.filter((p) => p.id !== id);
    this.persist();
    return this.data.printers.length < initialLen;
  }

  // --- Print Jobs ---
  public createPrintJob(job: PrintJob): PrintJob {
    this.data.printJobs.push(job);
    this.persist();
    return job;
  }

  public findPrintJobById(id: string): PrintJob | undefined {
    this.load();
    return this.data.printJobs.find((j) => j.id === id);
  }

  public findPrintJobsByUserId(userId: string): PrintJob[] {
    this.load();
    return this.data.printJobs
      .filter((j) => j.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public findPrintJobsByWorkspaceId(workspaceId: string): PrintJob[] {
    this.load();
    return this.data.printJobs
      .filter((j) => j.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public findPrintJobsByScope(scopeId: string): PrintJob[] {
    this.load();
    return this.data.printJobs
      .filter((j) => j.userId === scopeId || j.workspaceId === scopeId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public findPrintJobsByDeviceId(deviceId: string): PrintJob[] {
    return this.data.printJobs
      .filter((j) => j.deviceId === deviceId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  public updatePrintJobStatus(
    id: string,
    status: PrintJob['status'],
    progressPercent: number,
    message?: string,
    isSimulated?: boolean
  ): PrintJob | undefined {
    const job = this.findPrintJobById(id);
    if (job) {
      job.status = status;
      job.progressPercent = progressPercent;
      if (isSimulated !== undefined) job.isSimulated = isSimulated;
      if (message) job.errorMessage = status === 'FAILED' ? message : null;
      job.updatedAt = Date.now();

      // Record Event
      this.data.printJobEvents.push({
        id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        jobId: id,
        status,
        progressPercent,
        message: message || '',
        isSimulated: isSimulated ?? job.isSimulated,
        timestamp: Date.now(),
      });

      this.persist();
    }
    return job;
  }

  public getEventsForJob(jobId: string): PrintJobEvent[] {
    return this.data.printJobEvents
      .filter((e) => e.jobId === jobId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // --- File Metadata ---
  public createFileMetadata(metadata: FileMetadata): FileMetadata {
    this.data.fileMetadata.push(metadata);
    this.persist();
    return metadata;
  }

  public findFileMetadataByJobId(jobId: string): FileMetadata | undefined {
    return this.data.fileMetadata.find((m) => m.jobId === jobId);
  }

  public cleanExpiredFiles(): number {
    const now = Date.now();
    let cleaned = 0;
    this.data.fileMetadata = this.data.fileMetadata.filter((m) => {
      if (m.expiresAt < now) {
        const job = this.findPrintJobById(m.jobId);
        if (job && fs.existsSync(job.filePath)) {
          try {
            fs.unlinkSync(job.filePath);
            cleaned++;
          } catch (e) {
            console.error('Failed to unlink expired file:', e);
          }
        }
        return false;
      }
      return true;
    });
    this.persist();
    return cleaned;
  }
}
