import React, { useState } from 'react';
import { Device, Printer as PrinterType } from '../types';
import { api } from '../services/api';
import {
  UploadCloud,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Laptop,
  Layers,
  ArrowRight,
  ShieldCheck,
  Printer,
  Radio,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

export interface PrintDocumentsPageProps {
  devices: Device[];
  printers?: PrinterType[];
  onJobCreated: () => void;
  onNavigateToQueue: () => void;
  onOpenPairing?: () => void;
}

export const PrintDocumentsPage: React.FC<PrintDocumentsPageProps> = ({
  devices,
  printers = [],
  onJobCreated,
  onNavigateToQueue,
  onOpenPairing,
}) => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  
  // Destination selection can be a printer or a device
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');

  const [copies, setCopies] = useState<number>(1);
  const [pageRange, setPageRange] = useState<string>('ALL');
  const [paperSize, setPaperSize] = useState<'A4' | 'LETTER'>('A4');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [colorMode, setColorMode] = useState<'COLOR' | 'MONOCHROME'>('COLOR');
  const [dpi, setDpi] = useState<number>(300);

  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  const preferredMode = (localStorage.getItem('pocketprint_preferred_mode') as any) || 'mode_a';

  // Initialize selected destination, prioritizing user's active gateway mode
  React.useEffect(() => {
    if (!selectedDestinationId) {
      if (preferredMode === 'mode_b') {
        const androidPrn = printers.find((p) => p.gatewayType === 'ANDROID_USB');
        const androidDev = devices.find((d) => d.gatewayType === 'ANDROID_USB' || (!d.gatewayType && !d.name.includes('Windows')));
        if (androidPrn) {
          setSelectedDestinationId(`printer:${androidPrn.id}`);
          return;
        } else if (androidDev) {
          setSelectedDestinationId(`device:${androidDev.id}`);
          return;
        }
      } else {
        const winPrn = printers.find((p) => p.gatewayType === 'WINDOWS_HOST');
        const winDev = devices.find((d) => d.gatewayType === 'WINDOWS_HOST' || d.name.includes('Windows'));
        if (winPrn) {
          setSelectedDestinationId(`printer:${winPrn.id}`);
          return;
        } else if (winDev) {
          setSelectedDestinationId(`device:${winDev.id}`);
          return;
        }
      }

      if (printers.length > 0) {
        setSelectedDestinationId(`printer:${printers[0].id}`);
      } else if (devices.length > 0) {
        setSelectedDestinationId(`device:${devices[0].id}`);
      }
    }
  }, [printers, devices, selectedDestinationId, preferredMode]);

  // Resolve target details
  let targetName = 'No destination selected';
  let targetGatewayType = 'UNKNOWN';
  let targetConnection = 'USB';
  let targetDriver = 'Default Driver';
  let isTargetOnline = false;

  if (selectedDestinationId.startsWith('printer:')) {
    const pId = selectedDestinationId.replace('printer:', '');
    const p = printers.find((pr) => pr.id === pId);
    if (p) {
      targetName = p.name;
      targetGatewayType = p.gatewayType;
      targetConnection = p.connectionType;
      targetDriver = p.driverIdentifier;
      isTargetOnline = p.isOnline;
    }
  } else if (selectedDestinationId.startsWith('device:')) {
    const dId = selectedDestinationId.replace('device:', '');
    const d = devices.find((dev) => dev.id === dId);
    if (d) {
      targetName = d.name;
      targetGatewayType = d.gatewayType || (d.name.includes('Windows') ? 'WINDOWS_HOST' : 'ANDROID_USB');
      targetConnection = targetGatewayType === 'WINDOWS_HOST' ? 'USB' : 'USB_OTG';
      targetDriver = d.activeBackend;
      isTargetOnline = d.isOnline;
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Please select a valid PDF file (.pdf)', 'Invalid File Type');
        return;
      }
      setFile(selected);
      toast.info(`Loaded "${selected.name}" (${(selected.size / (1024 * 1024)).toFixed(2)} MB)`, 'File Ready');
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.warning('Please select a PDF document first', 'Missing File');
      return;
    }
    if (!selectedDestinationId) {
      toast.warning('Please select an active destination gateway/printer', 'No Destination');
      return;
    }
    setShowConfirmModal(true);
  };

  const executePrint = async () => {
    if (!file || !selectedDestinationId) return;

    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    if (selectedDestinationId.startsWith('printer:')) {
      const pId = selectedDestinationId.replace('printer:', '');
      formData.append('printerId', pId);
    } else {
      const dId = selectedDestinationId.replace('device:', '');
      formData.append('deviceId', dId);
    }

    formData.append('copies', copies.toString());
    formData.append('pageRange', pageRange);
    formData.append('paperSize', paperSize);
    formData.append('orientation', orientation);
    formData.append('colorMode', colorMode);
    formData.append('dpi', dpi.toString());

    try {
      const res = await api.uploadPrintJob(formData);
      const gwLabel = res.job.gatewayType === 'WINDOWS_HOST' ? 'Windows Laptop Agent' : 'Android Phone Gateway';
      toast.success(`Job dispatched to ${gwLabel}! Job ID: ${res.job.id}`, 'Print Started');
      setShowConfirmModal(false);
      setFile(null);
      onJobCreated();
      onNavigateToQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch print job', 'Transmission Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Print Document (PDF)</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Send a PDF document from any device through Cloud Relay to your Windows Laptop or Android Phone gateway.
        </p>
      </div>

      <form onSubmit={handleOpenConfirm} className="space-y-6">
        {/* Step 1: File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              <span>Select PDF Document</span>
            </CardTitle>
            <CardDescription>Upload a standard PDF document for remote printing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-700/80 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-[#162032]/30">
              <input
                type="file"
                accept="application/pdf"
                id="pdf-input"
                className="hidden"
                onChange={handleFileChange}
              />
              <label htmlFor="pdf-input" className="cursor-pointer block">
                <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                {file ? (
                  <div>
                    <div className="text-sm font-bold text-blue-400">{file.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Verified PDF document
                    </div>
                    <span className="inline-block mt-3 px-3 py-1 rounded-md bg-[#1F2937] text-xs text-gray-300 hover:bg-gray-700 transition-colors">
                      Change File
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-semibold text-white block">Drop PDF here or click to browse</span>
                    <span className="text-xs text-gray-400 block mt-1">Files up to 50MB supported</span>
                  </div>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Destination Gateway & Printer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              <span>Select Destination Gateway & Printer</span>
            </CardTitle>
            <CardDescription>Choose whether the physical printer is hosted by your Windows Laptop or Android Phone</CardDescription>
          </CardHeader>
          <CardContent>
            {printers.length === 0 && devices.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-900/60 text-xs text-amber-300 space-y-2.5">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>No Gateway or Printer Detected in Current Workspace</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  To send prints, connect your Canon PIXMA MG2570S using either Mode A (run the Windows Laptop Agent) or Mode B (connect via USB OTG to the Android PocketPrint app).
                </p>
                {onOpenPairing && (
                  <div className="pt-1">
                    <Button
                      size="xs"
                      variant="outline"
                      type="button"
                      onClick={onOpenPairing}
                      className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    >
                      Connect Gateway via QR or 8-Digit PIN
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Available Printers */}
                {printers.map((p) => {
                  const isSelected = selectedDestinationId === `printer:${p.id}`;
                  const isWindows = p.gatewayType === 'WINDOWS_HOST';
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedDestinationId(`printer:${p.id}`)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? isWindows
                            ? 'border-sky-500 bg-sky-950/30 shadow-md ring-1 ring-sky-500'
                            : 'border-emerald-500 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500'
                          : 'border-gray-800 bg-[#162032]/40 hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {isWindows ? <Laptop className="w-4 h-4 text-sky-400" /> : <Smartphone className="w-4 h-4 text-emerald-400" />}
                          <span className="font-bold text-sm text-white">{p.name}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.isOnline ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                          {p.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        Gateway: <span className="text-white font-medium">{isWindows ? 'Mode A: Windows Laptop' : 'Mode B: Android Phone'}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Connection: <span className="font-mono text-gray-200">{p.connectionType}</span> • Driver: <span className="text-gray-300">{p.driverIdentifier}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Devices fallback if no printer entries */}
                {printers.length === 0 &&
                  devices.map((dev) => {
                    const isSelected = selectedDestinationId === `device:${dev.id}`;
                    const isWindows = dev.gatewayType === 'WINDOWS_HOST' || dev.name.includes('Windows');
                    return (
                      <div
                        key={dev.id}
                        onClick={() => setSelectedDestinationId(`device:${dev.id}`)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-950/30 shadow-md ring-1 ring-blue-500'
                            : 'border-gray-800 bg-[#162032]/40 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {isWindows ? <Laptop className="w-4 h-4 text-sky-400" /> : <Smartphone className="w-4 h-4 text-emerald-400" />}
                            <span className="font-bold text-sm text-white">{dev.name}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dev.isOnline ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                            {dev.isOnline ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-300 mt-1">
                          Printer: <span className="text-white font-medium">{dev.printerModel || 'Canon PIXMA MG2570S'}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Backend: <span className="text-gray-300">{dev.activeBackend}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Print Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
              <span>Print Parameters</span>
            </CardTitle>
            <CardDescription>Paper, quality, and formatting options</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Number of Copies"
                type="number"
                min={1}
                max={99}
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value, 10) || 1)}
              />

              <Input
                label="Page Range"
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="ALL or 1-3 or 2,4"
              />

              <Select
                label="Paper Size"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as any)}
              >
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="LETTER">US Letter (8.5 x 11 in)</option>
              </Select>

              <Select
                label="Orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as any)}
              >
                <option value="PORTRAIT">Portrait</option>
                <option value="LANDSCAPE">Landscape</option>
              </Select>

              <Select
                label="Color Mode"
                value={colorMode}
                onChange={(e) => setColorMode(e.target.value as any)}
              >
                <option value="COLOR">Full Color</option>
                <option value="MONOCHROME">Grayscale (Black & White)</option>
              </Select>

              <Select
                label="Target Resolution (DPI)"
                value={dpi.toString()}
                onChange={(e) => setDpi(parseInt(e.target.value, 10))}
              >
                <option value="300">300 DPI (Standard)</option>
                <option value="600">600 DPI (High Resolution)</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto px-8"
            disabled={!file || !selectedDestinationId}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Review & Send Print Job
          </Button>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Print Command"
        description="Verify your document specifications and target hardware"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#162032] border border-gray-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Document:</span>
              <span className="font-bold text-white truncate max-w-[200px]">{file?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">File Size:</span>
              <span className="text-gray-200">{file ? (file.size / (1024 * 1024)).toFixed(2) : 0} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Destination:</span>
              <span className="font-semibold text-blue-400">{targetName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gateway Mode:</span>
              <span className="font-semibold text-white">
                {targetGatewayType === 'WINDOWS_HOST' ? 'Mode A: Windows Laptop' : 'Mode B: Android Phone'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Driver / Backend:</span>
              <span className="text-gray-300 font-mono text-[11px]">{targetDriver}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Settings:</span>
              <span className="text-gray-200">
                {copies} copy(ies) • {paperSize} • {orientation} • {colorMode} • {dpi} DPI
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/60 text-[11px] text-blue-300 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-400" />
            <span>
              Document will be securely routed over Cloud Relay to your selected gateway. Status updates will stream live to your screen.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" onClick={() => setShowConfirmModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={executePrint}
              isLoading={loading}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Confirm & Dispatch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
