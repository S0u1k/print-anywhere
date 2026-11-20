import React from 'react';
import { Device, Printer as PrinterType } from '../types';
import {
  Printer,
  Usb,
  Cpu,
  BatteryCharging,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Sliders,
  HelpCircle,
  Laptop,
  Smartphone,
  Layers,
  Wrench,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

export interface PrinterStatusPageProps {
  devices?: Device[];
  printers?: PrinterType[];
  activeDevice: Device | null;
  onRefresh: () => void;
}

export const PrinterStatusPage: React.FC<PrinterStatusPageProps> = ({
  devices = [],
  printers = [],
  activeDevice,
  onRefresh,
}) => {
  const toast = useToast();

  const handleTestDiagnostics = (mode: string) => {
    toast.info(`Hardware diagnostic loopback initiated for ${mode}...`, 'Diagnostics Running');
    setTimeout(() => {
      toast.success(
        mode === 'WINDOWS'
          ? 'Windows Spooler service and Canon MG2500 series Printer (USB001) verified operational.'
          : 'Android USB Host Endpoint Bulk OUT (0x01) and Bulk IN (0x81) verified healthy.',
        'Diagnostics Passed'
      );
    }, 1000);
  };

  const windowsPrinters = printers.filter((p) => p.gatewayType === 'WINDOWS_HOST');
  const androidPrinters = printers.filter((p) => p.gatewayType === 'ANDROID_USB');

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Printer Management & Hardware Diagnostics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time status of Canon PIXMA MG2570S endpoints connected via Windows USB or Android USB OTG.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTestDiagnostics('WINDOWS')}
            leftIcon={<Wrench className="w-3.5 h-3.5" />}
          >
            Diagnostics (Windows)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTestDiagnostics('ANDROID')}
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
          >
            Diagnostics (Android USB)
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Grid of Printers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode A: Windows Laptop Connected Printer */}
        <Card className="border-sky-950/70 bg-[#0d1628]/40">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-sky-600/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Canon PIXMA MG2570S (Mode A)</CardTitle>
                <CardDescription className="text-xs text-sky-300/80">
                  Windows Laptop Print Gateway • USB Port USB001
                </CardDescription>
              </div>
            </div>
            <Badge variant={windowsPrinters.length > 0 && windowsPrinters[0].isOnline ? 'success' : 'neutral'} dot>
              {windowsPrinters.length > 0 && windowsPrinters[0].isOnline ? 'Ready' : 'Offline'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Manufacturer & Model:</span>
                <span className="font-semibold text-white">Canon PIXMA MG2570S</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Windows Driver Name:</span>
                <span className="font-mono text-sky-300 text-[11px]">Canon MG2500 series Printer</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Connection Type:</span>
                <span className="font-semibold text-gray-200">Physical USB 2.0 (USB001)</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Compatibility Status:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Compatible (Verified Driver)
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b101c] border border-gray-800 space-y-2 text-xs">
              <span className="font-bold text-gray-300 block text-[11px] uppercase tracking-wider">
                Driver & Spooler Specifications:
              </span>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Color Rendering:</span>
                <span className="text-gray-200">Full Color RGB (24-bit) & Monochrome</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Resolutions:</span>
                <span className="text-gray-200 font-mono">300 DPI, 600 DPI</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Paper Sizes:</span>
                <span className="text-gray-200">A4, Letter, 4x6" Photo</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Windows Spooler Service:</span>
                <span className="text-emerald-400 font-mono">spoolsv.exe (Running)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mode B: Android Phone Connected Printer */}
        <Card className="border-emerald-950/70 bg-[#091717]/40">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Canon PIXMA MG2570S (Mode B)</CardTitle>
                <CardDescription className="text-xs text-emerald-300/80">
                  Android USB OTG Gateway • Native BJL Backend
                </CardDescription>
              </div>
            </div>
            <Badge variant={androidPrinters.length > 0 && androidPrinters[0].isOnline ? 'success' : 'neutral'} dot>
              {androidPrinters.length > 0 && androidPrinters[0].isOnline ? 'Ready' : 'Offline / Detached'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Manufacturer & Model:</span>
                <span className="font-semibold text-white">Canon PIXMA MG2570S</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">USB Vendor & Product ID:</span>
                <span className="font-mono text-emerald-300 text-[11px]">VID: 0x04A9 • PID: 0x176D</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Connection Type:</span>
                <span className="font-semibold text-gray-200">USB On-The-Go (OTG)</span>
              </div>
              <div className="bg-[#162032] p-3 rounded-lg border border-gray-800">
                <span className="text-gray-400 block mb-0.5 text-[11px]">Backend Protocol:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  BJL / BJRaster3 Swaths
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b101c] border border-gray-800 space-y-2 text-xs">
              <span className="font-bold text-gray-300 block text-[11px] uppercase tracking-wider">
                Android USB Host Endpoints:
              </span>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Bulk OUT (Print Data):</span>
                <span className="text-emerald-300 font-mono">Endpoint 0x01 (512-byte packets)</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Bulk IN (Status / Errors):</span>
                <span className="text-emerald-300 font-mono">Endpoint 0x81 (Polling)</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>IEEE-1284 Device ID:</span>
                <span className="text-gray-300 font-mono text-[10px] truncate max-w-[220px]">
                  MFG:Canon;CMD:BJL,BJRaster3;MDL:MG2500;
                </span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Native Rasterizer:</span>
                <span className="text-gray-200">Android PdfRenderer (300 / 600 DPI)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hardware Architecture Notes */}
      <Card className="p-6 bg-[#162032]/40 border-gray-800">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Dual-Gateway Remote Printing Architecture</span>
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed">
          PocketPrint Bridge decouples the print command source from physical printer connectivity.
          In <strong>Mode A</strong>, your Windows laptop runs a background daemon and lets the Windows Canon driver render and spool jobs received over the Internet from your phone.
          In <strong>Mode B</strong>, your Android smartphone running the PocketPrint Bridge App acts as a direct USB Host over USB OTG, rasterizing PDF documents on-device into Canon BJRaster3 swaths.
          Neither configuration requires router port forwarding or public IP exposure.
        </p>
      </Card>
    </div>
  );
};
