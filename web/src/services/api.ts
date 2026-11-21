import { Device, Printer, PrintJob, PrintJobEvent, PairingSession, User } from '../types';
import { apiClient, getApiBaseUrl, ApiError, ApiErrorCode } from './apiClient';

export { apiClient, getApiBaseUrl, ApiError, type ApiErrorCode };

export const api = {
  // Auth & Guest
  async register(data: { email: string; password: string; name: string }): Promise<{ token: string; user: User }> {
    return apiClient.post('/auth/register', data);
  },

  async login(data: { email: string; password: string }): Promise<{ token: string; user: User }> {
    return apiClient.post('/auth/login', data);
  },

  async getMe(): Promise<{ user: User; workspaceId?: string }> {
    return apiClient.get('/auth/me');
  },

  async createGuestWorkspace(
    name?: string,
    firebaseToken?: string
  ): Promise<{
    message: string;
    token: string;
    recoveryKey: string;
    workspace: {
      id: string;
      name: string;
      pairedDeviceIds: string[];
      createdAt: number;
    };
  }> {
    return apiClient.post(
      '/guest/workspaces',
      { name, firebaseToken },
      {
        headers: firebaseToken ? { 'x-firebase-token': firebaseToken } : undefined,
      }
    );
  },

  async recoverGuestWorkspace(recoveryKey: string): Promise<{
    message: string;
    token: string;
    workspace: {
      id: string;
      name: string;
      pairedDeviceIds: string[];
      createdAt: number;
    };
  }> {
    return apiClient.post('/guest/workspaces/recover', { recoveryKey });
  },

  async getCurrentWorkspace(): Promise<{
    workspaceId: string;
    name: string;
    isGuest: boolean;
    pairedDevices: Device[];
    printers: Printer[];
    createdAt: number;
  }> {
    return apiClient.get('/guest/workspaces/current');
  },

  async forgotPassword(email: string): Promise<{ message: string; resetCode?: string }> {
    return apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(data: { email: string; resetCode: string; newPassword: string }): Promise<{ message: string }> {
    return apiClient.post('/auth/reset-password', data);
  },

  // Bidirectional Pairing Sessions
  async createPairingSession(data: {
    initiatorDeviceId: string;
    initiatorDeviceName: string;
    initiatorDeviceType: string;
    initiatorOs: string;
    initiatorGatewayRole: string;
    printerModel?: string;
  }): Promise<{
    sessionId: string;
    pairingCode: string;
    qrToken: string;
    qrPayload: string;
    expiresAt: number;
    initiatorDevice: any;
  }> {
    return apiClient.post('/pairing/sessions', data);
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
  ): Promise<{ message: string; session: PairingSession; deviceToken?: string }> {
    return apiClient.post(`/pairing/sessions/${sessionId}/claim`, data);
  },

  async claimPairingByCode(data: {
    pairingCode: string;
    claimerDeviceId: string;
    claimerDeviceName: string;
    claimerDeviceType: string;
    claimerOs: string;
    claimerGatewayRole: string;
    printerModel?: string;
  }): Promise<{ message: string; session?: PairingSession; deviceToken?: string; sessionId?: string; status?: string }> {
    return apiClient.post('/pairing/code/claim', data);
  },

  async approvePairingSession(
    sessionId: string,
    approved: boolean
  ): Promise<{
    message: string;
    status: string;
    workspaceId?: string;
    initiatorDevice?: any;
    claimerDevice?: any;
    initiatorToken?: string;
    claimerToken?: string;
    session?: PairingSession;
    deviceToken?: string;
  }> {
    return apiClient.post(`/pairing/sessions/${sessionId}/approve`, { approved });
  },

  async getPairingSessionStatus(sessionId: string): Promise<{
    sessionId: string;
    status: string;
    expiresAt: number;
    workspaceId?: string;
    initiator?: any;
    claimer?: any;
    initiatorToken?: string;
    claimerToken?: string;
    completedAt?: number;
  }> {
    return apiClient.get(`/pairing/sessions/${sessionId}/status`);
  },

  async cancelPairingSession(sessionId: string): Promise<{ message: string }> {
    return apiClient.post(`/pairing/sessions/${sessionId}/cancel`);
  },

  // Devices
  async getDevices(): Promise<{ devices: Device[] }> {
    return apiClient.get('/devices');
  },

  async renameDevice(deviceId: string, name: string): Promise<{ message: string; device: Device }> {
    return apiClient.patch(`/devices/${deviceId}`, { name });
  },

  async revokeDevice(deviceId: string): Promise<{ message: string }> {
    return apiClient.post(`/devices/${deviceId}/revoke`);
  },

  async deleteDevice(deviceId: string): Promise<{ message: string }> {
    return apiClient.delete(`/devices/${deviceId}`);
  },

  // Printers
  async getPrinters(): Promise<{ printers: Printer[] }> {
    return apiClient.get('/printers');
  },

  async deletePrinter(printerId: string): Promise<{ message: string }> {
    return apiClient.delete(`/printers/${printerId}`);
  },

  // Print Jobs
  async getJobs(): Promise<{ jobs: PrintJob[] }> {
    return apiClient.get('/jobs');
  },

  async getJob(id: string): Promise<{ job: PrintJob; events: PrintJobEvent[] }> {
    return apiClient.get(`/jobs/${id}`);
  },

  async uploadPrintJob(formData: FormData): Promise<{ message: string; job: PrintJob }> {
    return apiClient.post('/jobs/upload', formData);
  },

  async cancelJob(id: string): Promise<{ message: string; job: PrintJob }> {
    return apiClient.post(`/jobs/${id}/cancel`);
  },

  async retryJob(id: string): Promise<{ message: string; job: PrintJob }> {
    return apiClient.post(`/jobs/${id}/retry`);
  },
};
