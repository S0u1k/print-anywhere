import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Smartphone,
  Laptop,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Camera,
  KeyRound,
  ShieldCheck,
  X,
  AlertCircle,
  Clock,
  Printer,
} from 'lucide-react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { DeviceRole, DeviceType } from '../types';

interface PairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaired?: () => void;
}

export const PairingModal: React.FC<PairingModalProps> = ({ isOpen, onClose, onPaired }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'scan' | 'code'>('generate');

  const isMobile = typeof navigator !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent);

  // Generator State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [generatorRole, setGeneratorRole] = useState<DeviceRole>(isMobile ? 'ANDROID_GATEWAY' : 'CONTROLLER');
  const [generatorDeviceName, setGeneratorDeviceName] = useState<string>(
    isMobile ? 'Android Phone' : 'Windows Laptop'
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [claimRequest, setClaimRequest] = useState<any | null>(null);
  const [pairSuccess, setPairSuccess] = useState<boolean>(false);

  // Manual Code State
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [manualRole, setManualRole] = useState<DeviceRole>(isMobile ? 'ANDROID_GATEWAY' : 'CONTROLLER');
  const [manualDeviceName, setManualDeviceName] = useState<string>(
    isMobile ? 'My Android Phone' : 'My Laptop'
  );
  const [isSubmittingCode, setIsSubmittingCode] = useState<boolean>(false);
  const [codeClaimedSession, setCodeClaimedSession] = useState<any | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);

  // Scanner State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Initialize Pairing Generation
  const initPairingSession = async (roleOverride?: DeviceRole) => {
    if (isGenerating) return;
    try {
      setIsGenerating(true);
      setClaimRequest(null);
      setPairSuccess(false);

      const targetRole = roleOverride || generatorRole;
      const deviceId = `dev-${Date.now().toString().slice(-6)}`;
      const res = await api.createPairingSession({
        initiatorDeviceId: deviceId,
        initiatorDeviceName: generatorDeviceName,
        initiatorDeviceType: (isMobile ? 'PHONE' : 'LAPTOP') as DeviceType,
        initiatorOs: navigator.platform || (isMobile ? 'Android 12' : 'Windows 11'),
        initiatorGatewayRole: targetRole,
        printerModel: targetRole === 'WINDOWS_GATEWAY' ? 'Canon MG2500 series Printer' : targetRole === 'ANDROID_GATEWAY' ? 'Canon PIXMA MG2570S' : undefined,
      });

      setSessionId(res.sessionId);
      setPairingCode(res.pairingCode);
      setExpiresAt(res.expiresAt);
      setTimeLeft(Math.max(0, Math.floor((res.expiresAt - Date.now()) / 1000)));

      // Render QR Code onto Canvas
      if (canvasRef.current && res.qrPayload) {
        await QRCode.toCanvas(canvasRef.current, JSON.stringify(res.qrPayload), {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
      }

      // Join socket room for this pairing session
      const socket = getSocket();
      if (socket) {
        socket.emit('pairing:join', { sessionId: res.sessionId });
      }
    } catch (err: any) {
      console.error('Failed to create pairing session:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratorRoleChange = (newRole: DeviceRole) => {
    setGeneratorRole(newRole);
    if (!claimRequest && !pairSuccess) {
      initPairingSession(newRole);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'generate') {
      if (!sessionId || timeLeft <= 0) {
        initPairingSession();
      }
    }
  }, [isOpen, activeTab]);

  // Polling for Initiator (checks for incoming claims and completion status in serverless environments)
  useEffect(() => {
    if (!isOpen || activeTab !== 'generate' || !sessionId || pairSuccess) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await api.getPairingSessionStatus(sessionId);
        if (statusRes.status === 'CLAIMED' && statusRes.claimer && !claimRequest) {
          setClaimRequest({
            sessionId: statusRes.sessionId,
            claimer: statusRes.claimer,
            initiator: statusRes.initiator,
          });
        } else if (statusRes.status === 'COMPLETED') {
          if (statusRes.initiatorToken) {
            localStorage.setItem('pocketprint_token', statusRes.initiatorToken);
          }
          if (statusRes.workspaceId) {
            localStorage.setItem('pocketprint_workspace_id', statusRes.workspaceId);
          }
          setPairSuccess(true);
          setClaimRequest(null);
          if (onPaired) onPaired();
          setTimeout(() => onClose(), 2500);
        }
      } catch (err) {
        // Silent catch for background poll
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, activeTab, sessionId, pairSuccess, claimRequest, onPaired, onClose]);

  // Polling for Claimer (checks when host approves the claim)
  useEffect(() => {
    const claimSessionId = codeClaimedSession?.sessionId || codeClaimedSession?.session?.id;
    if (!isOpen || activeTab !== 'code' || !claimSessionId || pairSuccess) return;

    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await api.getPairingSessionStatus(claimSessionId);
        if (statusRes.status === 'COMPLETED') {
          if (statusRes.claimerToken) {
            localStorage.setItem('pocketprint_token', statusRes.claimerToken);
          }
          if (statusRes.workspaceId) {
            localStorage.setItem('pocketprint_workspace_id', statusRes.workspaceId);
          }
          setPairSuccess(true);
          setCodeClaimedSession(null);
          if (onPaired) onPaired();
          setTimeout(() => onClose(), 2500);
        } else if (statusRes.status === 'CANCELLED') {
          setManualError('Pairing request was declined by the host device.');
          setCodeClaimedSession(null);
        } else if (statusRes.status === 'EXPIRED') {
          setManualError('Pairing session has expired. Please ask the host device to generate a new code.');
          setCodeClaimedSession(null);
        }
      } catch (err) {
        // Silent catch for background poll
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isOpen, activeTab, codeClaimedSession, pairSuccess, onPaired, onClose]);

  // Countdown Timer
  useEffect(() => {
    if (!expiresAt || pairSuccess) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, pairSuccess]);

  // Socket Listeners for Pairing Events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleClaimed = (data: any) => {
      console.log('Incoming pairing claim:', data);
      setClaimRequest(data);
    };

    const handleCompleted = (data: any) => {
      console.log('Pairing completed:', data);
      if (data.claimerToken) {
        localStorage.setItem('pocketprint_token', data.claimerToken);
      } else if (data.initiatorToken) {
        localStorage.setItem('pocketprint_token', data.initiatorToken);
      }
      if (data.workspaceId) {
        localStorage.setItem('pocketprint_workspace_id', data.workspaceId);
      }
      setPairSuccess(true);
      setClaimRequest(null);
      if (onPaired) onPaired();
      setTimeout(() => {
        onClose();
      }, 2500);
    };

    const handleCancelled = () => {
      setClaimRequest(null);
      setCodeClaimedSession(null);
    };

    socket.on('pairing:claimed', handleClaimed);
    socket.on('pairing:completed', handleCompleted);
    socket.on('pairing:cancelled', handleCancelled);

    return () => {
      socket.off('pairing:claimed', handleClaimed);
      socket.off('pairing:completed', handleCompleted);
      socket.off('pairing:cancelled', handleCancelled);
    };
  }, [onPaired, onClose]);

  // Copy code handler
  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Approve claim handler (Flow A & Flow B)
  const handleApproveClaim = async (approved: boolean) => {
    if (!sessionId) return;
    try {
      if (approved) {
        const res = await api.approvePairingSession(sessionId, true);
        if (res.initiatorToken) {
          localStorage.setItem('pocketprint_token', res.initiatorToken);
        }
        if (res.workspaceId || res.session?.workspaceId) {
          localStorage.setItem('pocketprint_workspace_id', (res.workspaceId || res.session?.workspaceId)!);
        }
        setPairSuccess(true);
        setClaimRequest(null);
        if (onPaired) onPaired();
        setTimeout(() => onClose(), 2500);
      } else {
        await api.cancelPairingSession(sessionId);
        setClaimRequest(null);
      }
    } catch (err: any) {
      console.error('Approval failed:', err);
    }
  };

  // Submit manual pairing code (Flow C & Flow D)
  const handleSubmitManualCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const cleanCode = manualCodeInput.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (!cleanCode) {
      setManualError('Please enter a valid 8-digit pairing code.');
      return;
    }

    try {
      setIsSubmittingCode(true);
      const myDeviceId = `dev-${Date.now().toString().slice(-6)}`;
      const res = await api.claimPairingByCode({
        pairingCode: cleanCode,
        claimerDeviceId: myDeviceId,
        claimerDeviceName: manualDeviceName,
        claimerDeviceType: (isMobile ? 'PHONE' : 'LAPTOP') as DeviceType,
        claimerOs: navigator.platform || (isMobile ? 'Android 12' : 'Windows 11'),
        claimerGatewayRole: manualRole,
        printerModel: manualRole === 'ANDROID_GATEWAY' ? 'Canon PIXMA MG2570S' : undefined,
      });

      setCodeClaimedSession(res);

      // Join the socket pairing room to listen for initiator's approval
      const socket = getSocket();
      if (socket && res.sessionId) {
        socket.emit('pairing:join', { sessionId: res.sessionId });
      }
    } catch (err: any) {
      const details = err.sanitizedDetails || {};
      const backendCode = details.code || err.code;

      if (backendCode === 'PAIRING_CODE_NOT_FOUND' || err.message?.includes('not found')) {
        setManualError('Pairing code not found. Please verify the 8-digit code displayed on the other device.');
      } else if (backendCode === 'PAIRING_CODE_EXPIRED' || err.message?.includes('expired')) {
        setManualError('Pairing session has expired. Please tap "New Code" on the other device and try again.');
      } else if (backendCode === 'PAIRING_CODE_ALREADY_USED') {
        setManualError('This pairing code has already been used. Please generate a new code.');
      } else if (backendCode === 'PAIRING_DEVICE_ROLE_INVALID' || err.message?.includes('Conflicting')) {
        setManualError('Conflicting roles: Both devices cannot have the same gateway role. One must be Controller and the other Gateway.');
      } else if (backendCode === 'PAIRING_ATTEMPTS_EXCEEDED') {
        setManualError('Too many failed attempts. Session closed. Please generate a new code.');
      } else if (backendCode === 'PAIRING_CODE_INVALID') {
        setManualError('Invalid pairing code. Please enter the valid 8-digit code.');
      } else {
        setManualError(err.userFriendlyMessage || err.message || 'Failed to claim code. Check for typos or expired code.');
      }
    } finally {
      setIsSubmittingCode(false);
    }
  };

  // Camera Scanner Starter
  const startCamera = async () => {
    setCameraError(null);
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Please use the Manual Code tab.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (activeTab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Your Devices</h2>
              <p className="text-xs text-neutral-400">Bidirectional pairing: Pair laptop and phone without accounts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition border-b-2 ${
              activeTab === 'generate'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Generate QR / Code
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition border-b-2 ${
              activeTab === 'scan'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            Scan QR Code
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition border-b-2 ${
              activeTab === 'code'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Enter Pairing Code
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {/* TAB 1: GENERATE QR / CODE */}
          {activeTab === 'generate' && (
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Role Configuration */}
              <div className="w-full flex items-center justify-between p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl text-left">
                <div>
                  <div className="text-xs font-medium text-white">This Device Functionality</div>
                  <div className="text-[11px] text-neutral-400">Configure role for remote printing</div>
                </div>
                <select
                  value={generatorRole}
                  onChange={(e) => handleGeneratorRoleChange(e.target.value as DeviceRole)}
                  className="bg-neutral-800 border border-neutral-700 text-xs text-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="CONTROLLER">Remote Controller (Send Prints)</option>
                  <option value="WINDOWS_GATEWAY">Windows Gateway (Canon USB)</option>
                  <option value="ANDROID_GATEWAY">Android Gateway (USB OTG)</option>
                </select>
              </div>

              {/* QR Code Canvas */}
              <div className="relative p-4 bg-white rounded-2xl shadow-inner flex flex-col items-center">
                <canvas ref={canvasRef} className="rounded-lg" />
                {isGenerating && (
                  <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center rounded-2xl">
                    <RefreshCw className="w-8 h-8 text-neutral-600 animate-spin" />
                    <span className="text-xs text-neutral-600 mt-2 font-medium">Generating secure code...</span>
                  </div>
                )}
              </div>

              {/* Manual 8-character Pairing Code */}
              <div className="w-full max-w-sm">
                <div className="text-xs text-neutral-400 mb-1">Manual 8-Digit Pairing Code:</div>
                <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                  <span className="font-mono text-xl tracking-widest font-bold text-emerald-400">
                    {pairingCode || '---- ----'}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    disabled={!pairingCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Timer & Regenerate */}
              <div className="flex items-center justify-between w-full max-w-sm text-xs text-neutral-400">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  <span>
                    Expires in: <strong className={timeLeft < 30 ? 'text-rose-400' : 'text-neutral-200'}>{timeLeft}s</strong>
                  </span>
                </div>
                <button
                  onClick={() => initPairingSession()}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Code
                </button>
              </div>

              {/* Incoming Claim Prompt (Mutual Approval) */}
              {claimRequest && (
                <div className="w-full p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-left animate-slideUp">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">Approve Connection Request?</div>
                      <div className="text-xs text-neutral-300 mt-1">
                        Device <strong>"{claimRequest.claimer?.name}"</strong> ({claimRequest.claimer?.os},{' '}
                        {claimRequest.claimer?.role}) is requesting to pair into your workspace.
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleApproveClaim(true)}
                          className="px-4 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg transition"
                        >
                          Approve Connection
                        </button>
                        <button
                          onClick={() => handleApproveClaim(false)}
                          className="px-3 py-2 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {pairSuccess && (
                <div className="w-full p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded-xl text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Device successfully connected! Independent credentials issued.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SCAN QR CODE */}
          {activeTab === 'scan' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="text-xs text-neutral-400">
                Point your camera at the QR code displayed on your other device
              </div>

              <div className="relative w-full max-w-xs h-64 bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-8 border-2 border-dashed border-emerald-500/60 rounded-xl pointer-events-none" />
                {!cameraActive && cameraError && (
                  <div className="absolute inset-0 p-4 bg-neutral-950 flex flex-col items-center justify-center text-xs text-neutral-400">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
                    <span>{cameraError}</span>
                    <button
                      onClick={() => setActiveTab('code')}
                      className="mt-3 px-3 py-1.5 bg-neutral-800 text-neutral-200 rounded-lg hover:bg-neutral-700 text-xs"
                    >
                      Use Manual Code Instead
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-neutral-400 max-w-sm">
                Webcam scanning requires camera permission. If your browser or environment does not support webcam streaming, please select <strong>Enter Pairing Code</strong>.
              </p>
            </div>
          )}

          {/* TAB 3: ENTER PAIRING CODE */}
          {activeTab === 'code' && (
            <form onSubmit={handleSubmitManualCode} className="space-y-4">
              <div className="text-xs text-neutral-400">
                Enter the 8-digit pairing code displayed on the other device (format: <strong>XXXX-XXXX</strong>)
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Pairing Code</label>
                <input
                  type="text"
                  placeholder="e.g. 7492-8163"
                  value={manualCodeInput}
                  onChange={(e) => {
                    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
                    if (raw.length > 4) {
                      setManualCodeInput(`${raw.slice(0, 4)}-${raw.slice(4)}`);
                    } else {
                      setManualCodeInput(raw);
                    }
                  }}
                  maxLength={9}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-center font-mono text-xl tracking-widest text-emerald-400 placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">My Device Name</label>
                  <input
                    type="text"
                    value={manualDeviceName}
                    onChange={(e) => setManualDeviceName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-400 mb-1">My Device Role</label>
                  <select
                    value={manualRole}
                    onChange={(e) => setManualRole(e.target.value as DeviceRole)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="CONTROLLER">Remote Controller</option>
                    <option value="ANDROID_GATEWAY">Android USB Gateway</option>
                    <option value="WINDOWS_GATEWAY">Windows Gateway</option>
                  </select>
                </div>
              </div>

              {manualError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>{manualError}</span>
                </div>
              )}

              {codeClaimedSession && !pairSuccess && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs rounded-xl flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                  <div className="font-semibold text-white">Code Accepted! Awaiting Host Approval</div>
                  <div className="text-[11px] text-neutral-300 text-center">
                    Please approve the pairing prompt on your other device (<strong>{codeClaimedSession.initiator?.name}</strong>).
                  </div>
                </div>
              )}

              {pairSuccess && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500 text-emerald-300 rounded-xl text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Paired and authorized successfully!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingCode || !manualCodeInput.trim() || !!codeClaimedSession}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-500/10"
              >
                {isSubmittingCode ? 'Connecting...' : 'Connect to Device'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/60 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted one-time token • Zero account requirement</span>
          </div>
          <button onClick={onClose} className="hover:text-neutral-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
