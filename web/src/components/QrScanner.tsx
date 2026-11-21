import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  SwitchCamera,
  ShieldAlert,
  X,
  KeyRound,
  Lock,
} from 'lucide-react';
import { parseAndValidateQrPayload, QrParsedPayload } from '../utils/qrPayloadParser';

export type ScannerStatus =
  | 'idle'
  | 'requesting_permission'
  | 'initializing'
  | 'active'
  | 'detected'
  | 'validating'
  | 'success'
  | 'error_invalid'
  | 'error_permission'
  | 'error_unavailable'
  | 'error_network';

export interface QrScannerProps {
  isActive: boolean;
  onScanSuccess: (payload: QrParsedPayload) => Promise<void>;
  onSwitchToManual: () => void;
  onCancel?: () => void;
}

export const QrScanner: React.FC<QrScannerProps> = ({
  isActive,
  onScanSuccess,
  onSwitchToManual,
  onCancel,
}) => {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize canvas on mount
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  // Check available cameras
  const enumerateCameras = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
    } catch {
      // Ignore enumeration errors
    }
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isProcessingRef.current = false;
  }, []);

  // Scan single video frame with jsQR
  const scanFrame = useCallback(() => {
    if (isProcessingRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width === 0 || height === 0) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    // Run jsQR decoder
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      // Lock to prevent duplicate scan requests
      isProcessingRef.current = true;
      setStatus('detected');

      // Haptic feedback on mobile if supported
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // Ignore
        }
      }

      const parsed = parseAndValidateQrPayload(code.data);
      if (!parsed.valid) {
        setStatus('error_invalid');
        setErrorMessage(parsed.error || 'Invalid QR code. Please scan a PocketPrint Bridge pairing code.');
        return;
      }

      // Valid QR code detected! Trigger validation and claim
      setStatus('validating');
      onScanSuccess(parsed)
        .then(() => {
          setStatus('success');
          stopCamera();
        })
        .catch((err: any) => {
          setStatus('error_network');
          setErrorMessage(err?.message || 'Failed to claim pairing session. Please retry or enter code manually.');
        });
    }
  }, [onScanSuccess, stopCamera]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMessage(null);
    setStatus('requesting_permission');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error_unavailable');
      setErrorMessage('Camera access is not supported by this browser. Please use the manual pairing code.');
      return;
    }

    try {
      setStatus('initializing');
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        // Fallback to basic video constraint if ideal resolution / facing mode fails
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      await enumerateCameras();
      setStatus('active');
      isProcessingRef.current = false;

      // Start frame scanning loop (100ms interval)
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = window.setInterval(scanFrame, 120);
    } catch (err: any) {
      console.warn('[QrScanner] Camera start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('error_permission');
        setErrorMessage(
          'Camera permission denied. Please allow camera permissions in your browser address bar (lock icon) or settings.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('error_unavailable');
        setErrorMessage('No camera hardware found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setStatus('error_unavailable');
        setErrorMessage('Camera is currently in use by another application. Please close other camera apps and retry.');
      } else {
        setStatus('error_unavailable');
        setErrorMessage(`Could not access camera (${err.message || 'Unknown error'}). Use manual pairing code.`);
      }
    }
  }, [enumerateCameras, facingMode, scanFrame, selectedDeviceId, stopCamera]);

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    setSelectedDeviceId(null);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Switch to specific camera
  const handleSelectCamera = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  };

  // Reset scan lock and retry
  const handleRetryScan = () => {
    isProcessingRef.current = false;
    setStatus('active');
    setErrorMessage(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  // Lifecycle control
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isActive, facingMode, selectedDeviceId, startCamera, stopCamera]);

  return (
    <div className="flex flex-col items-center space-y-4 text-center w-full">
      {/* Instructions header */}
      <div className="text-xs text-neutral-400">
        Point your camera at the QR code displayed on your other device
      </div>

      {/* Camera Viewport & Overlay */}
      <div className="relative w-full max-w-xs h-72 bg-black rounded-2xl overflow-hidden border border-neutral-800 flex items-center justify-center shadow-2xl">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            status === 'active' || status === 'detected' ? 'opacity-100' : 'opacity-20'
          }`}
          playsInline
          muted
        />

        {/* Viewfinder Target Guide */}
        {(status === 'active' || status === 'detected' || status === 'validating') && (
          <div className="absolute inset-8 pointer-events-none flex flex-col items-center justify-center">
            {/* Corner Markers */}
            <div className="relative w-48 h-48 border-2 border-emerald-400/80 rounded-2xl">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />

              {/* Animated Laser Scanning Line */}
              {status === 'active' && (
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse shadow-[0_0_8px_#34d399]" />
              )}
            </div>
          </div>
        )}

        {/* Loading / Initializing Overlay */}
        {(status === 'requesting_permission' || status === 'initializing') && (
          <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center p-4">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <span className="text-xs font-semibold text-white">
              {status === 'requesting_permission' ? 'Requesting Camera Access...' : 'Starting Camera...'}
            </span>
            <span className="text-[11px] text-neutral-400 mt-1">Please allow camera permissions if prompted</span>
          </div>
        )}

        {/* Detected / Validating Overlay */}
        {(status === 'detected' || status === 'validating') && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fadeIn">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <span className="text-sm font-semibold text-white">QR Code Detected</span>
            <span className="text-xs text-emerald-400 mt-1">Validating pairing session...</span>
          </div>
        )}

        {/* Success Overlay */}
        {status === 'success' && (
          <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fadeIn">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2" />
            <span className="text-sm font-semibold text-white">Pairing Verified!</span>
            <span className="text-xs text-neutral-300 mt-1">Connecting devices...</span>
          </div>
        )}

        {/* Permission Denied Overlay */}
        {status === 'error_permission' && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-5 text-center">
            <ShieldAlert className="w-10 h-10 text-amber-400 mb-2" />
            <span className="text-xs font-semibold text-white mb-1">Camera Permission Blocked</span>
            <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
              To scan QR codes, tap the <strong>lock icon</strong> in your browser address bar and enable camera access.
            </p>
            <div className="flex gap-2">
              <button
                onClick={startCamera}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold rounded-lg transition"
              >
                Try Again
              </button>
              <button
                onClick={onSwitchToManual}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Enter Code
              </button>
            </div>
          </div>
        )}

        {/* Invalid QR / Unavailable / Network Error Overlay */}
        {(status === 'error_invalid' || status === 'error_unavailable' || status === 'error_network') && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-5 text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
            <span className="text-xs font-semibold text-white mb-1">
              {status === 'error_invalid'
                ? 'Unrecognized QR Code'
                : status === 'error_network'
                ? 'Pairing Network Error'
                : 'Camera Unavailable'}
            </span>
            <p className="text-[11px] text-rose-300/80 mb-3">{errorMessage}</p>
            <div className="flex gap-2">
              <button
                onClick={handleRetryScan}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold rounded-lg transition"
              >
                Scan Again
              </button>
              <button
                onClick={onSwitchToManual}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-lg transition"
              >
                Manual Code
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls (Flip Camera / Device Picker) */}
      <div className="flex items-center justify-between w-full max-w-xs text-xs">
        {availableCameras.length > 1 ? (
          <button
            onClick={handleToggleFacingMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg text-neutral-300 transition"
          >
            <SwitchCamera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Flip Camera ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
            <Camera className="w-3.5 h-3.5" />
            <span>Camera active</span>
          </div>
        )}

        <button
          onClick={onSwitchToManual}
          className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Manual Code</span>
        </button>
      </div>

      {/* HTTPS / Security Notice */}
      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 max-w-xs text-left">
        <Lock className="w-3 h-3 text-emerald-500/70 shrink-0" />
        <span>End-to-end encrypted • Scanned locally in browser without uploading images</span>
      </div>
    </div>
  );
};
