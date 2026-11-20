import { Device, Printer, PrintJob, PrintJobEvent, PairingSession, User } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('pocketprint_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth & Guest
  async register(data: { email: string; password: string; name: string }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  async login(data: { email: string; password: string }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async getMe(): Promise<{ user: User; workspaceId?: string }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async createGuestWorkspace(name?: string) {
    const res = await fetch(`${API_BASE}/guest/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create guest workspace' }));
      throw new Error(err.error || 'Failed to create guest workspace');
    }
    return res.json();
  },

  async recoverGuestWorkspace(recoveryKey: string) {
    const res = await fetch(`${API_BASE}/guest/workspaces/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recoveryKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to recover guest workspace' }));
      throw new Error(err.error || 'Failed to recover guest workspace');
    }
    return res.json();
  },

  async getCurrentWorkspace() {
    const res = await fetch(`${API_BASE}/guest/workspaces/current`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load workspace info');
    return res.json();
  },

  async forgotPassword(email: string): Promise<{ message: string; resetCode?: string }> {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  },

  async resetPassword(data: { email: string; resetCode: string; newPassword: string }): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Password reset failed' }));
      throw new Error(err.error || 'Password reset failed');
    }
    return res.json();
  },

  // Bidirectional Pairing Sessions
  async createPairingSession(data: {
    initiatorDeviceId: string;
    initiatorDeviceName: string;
    initiatorDeviceType: string;
    initiatorOs: string;
    initiatorGatewayRole: string;
    printerModel?: string;
  }) {
    const res = await fetch(`${API_BASE}/pairing/sessions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create pairing session' }));
      throw new Error(err.error || 'Failed to create pairing session');
    }
    return res.json();
  },

  async claimPairingSession(
    sessionId: string,
    data: {
      pairingCode?: string;
      qrToken?: string;
      claimerDeviceId: string;
      claimerDeviceName: string;
      claimerDeviceType: string;
      claimerOs: string;
      claimerGatewayRole: string;
      printerModel?: string;
    }
  ) {
    const res = await fetch(`${API_BASE}/pairing/sessions/${sessionId}/claim`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to claim pairing session' }));
      throw new Error(err.error || 'Failed to claim pairing session');
    }
    return res.json();
  },

  async claimPairingByCode(data: {
    pairingCode: string;
    claimerDeviceId: string;
    claimerDeviceName: string;
    claimerDeviceType: string;
    claimerOs: string;
    claimerGatewayRole: string;
    printerModel?: string;
  }) {
    const res = await fetch(`${API_BASE}/pairing/code/claim`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to claim pairing code' }));
      throw new Error(err.error || 'Failed to claim pairing code');
    }
    return res.json();
  },

  async approvePairingSession(sessionId: string, approved: boolean) {
    const res = await fetch(`${API_BASE}/pairing/sessions/${sessionId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ approved }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Approval failed' }));
      throw new Error(err.error || 'Approval failed');
    }
    return res.json();
  },

  async getPairingSessionStatus(sessionId: string): Promise<PairingSession> {
    const res = await fetch(`${API_BASE}/pairing/sessions/${sessionId}/status`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load pairing status');
    return res.json();
  },

  async cancelPairingSession(sessionId: string) {
    const res = await fetch(`${API_BASE}/pairing/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return res.json();
  },

  // Devices
  async getDevices(): Promise<{ devices: Device[] }> {
    const res = await fetch(`${API_BASE}/devices`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load devices');
    return res.json();
  },

  async renameDevice(deviceId: string, name: string): Promise<{ message: string; device: Device }> {
    const res = await fetch(`${API_BASE}/devices/${deviceId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to rename device');
    return res.json();
  },

  async revokeDevice(deviceId: string) {
    const res = await fetch(`${API_BASE}/devices/${deviceId}/revoke`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to revoke device');
    return res.json();
  },

  async deleteDevice(deviceId: string) {
    const res = await fetch(`${API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to unpair device');
    return res.json();
  },

  // Printers
  async getPrinters(): Promise<{ printers: Printer[] }> {
    const res = await fetch(`${API_BASE}/printers`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load printers');
    return res.json();
  },

  async deletePrinter(printerId: string) {
    const res = await fetch(`${API_BASE}/printers/${printerId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete printer');
    return res.json();
  },

  // Print Jobs
  async getJobs(): Promise<{ jobs: PrintJob[] }> {
    const res = await fetch(`${API_BASE}/jobs`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load print jobs');
    return res.json();
  },

  async getJob(id: string): Promise<{ job: PrintJob; events: PrintJobEvent[] }> {
    const res = await fetch(`${API_BASE}/jobs/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load job details');
    return res.json();
  },

  async uploadPrintJob(formData: FormData): Promise<{ message: string; job: PrintJob }> {
    const token = localStorage.getItem('pocketprint_token');
    const res = await fetch(`${API_BASE}/jobs/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  async cancelJob(id: string) {
    const res = await fetch(`${API_BASE}/jobs/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to cancel job');
    return res.json();
  },

  async retryJob(id: string) {
    const res = await fetch(`${API_BASE}/jobs/${id}/retry`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to retry job');
    return res.json();
  },
};
