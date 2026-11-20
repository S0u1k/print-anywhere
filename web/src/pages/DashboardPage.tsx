import React, { useState } from 'react';
import { Device, Printer as PrinterType, PrintJob } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import {
  Printer,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  FileText,
  Radio,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Laptop,
  Smartphone,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';

export interface DashboardPageProps {
  devices: Device[];
  printers?: PrinterType[];
  jobs: PrintJob[];
  activeDevice: Device | null;
  onRefresh: () => void;
  onNavigateToPrint: () => void;
  onNavigateToDevices: () => void;
  onNavigateToQueue: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  devices,
  printers = [],
  jobs,
  activeDevice,
  onRefresh,
  onNavigateToPrint,
  onNavigateToDevices,
  onNavigateToQueue,
}) => {
  const toast = useToast();
  const [quickFile, setQuickFile] = useState<File | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'COLOR' | 'MONOCHROME'>('COLOR');
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const windowsGateways = devices.filter((d) => d.gatewayType === 'WINDOWS_HOST');
  const androidGateways = devices.filter((d) => d.gatewayType === 'ANDROID_USB' || (!d.gatewayType && !d.name.includes('Windows')));

  const activeWindows = windowsGateways.filter((d) => d.isOnline);
  const activeAndroid = androidGateways.filter((d) => d.isOnline);
  const onlinePrinters = printers.filter((p) => p.isOnline);

  const pendingJobs = jobs.filter(
    (j) => !['COMPLETED', 'SIMULATED_COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
  );
  const completedJobs = jobs.filter(
    (j) => j.status === 'COMPLETED' || j.status === 'SIMULATED_COMPLETED'
  );
  const failedJobs = jobs.filter((j) => j.status === 'FAILED');
  const recentJobs = jobs.slice(0, 6);

  // Default destination to first available printer or device
  React.useEffect(() => {
    if (!selectedDestinationId) {
      if (printers.length > 0) {
        setSelectedDestinationId(`printer:${printers[0].id}`);
      } else if (devices.length > 0) {
        setSelectedDestinationId(`device:${devices[0].id}`);
      }
    }
  }, [printers, devices, selectedDestinationId]);

  const handleQuickUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFile || !selectedDestinationId) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', quickFile);

    if (selectedDestinationId.startsWith('printer:')) {
      const pId = selectedDestinationId.replace('printer:', '');
      formData.append('printerId', pId);
    } else {
      const dId = selectedDestinationId.replace('device:', '');
      formData.append('deviceId', dId);
    }

    formData.append('copies', copies.toString());
    formData.append('colorMode', colorMode);
    formData.append('paperSize', 'A4');
    formData.append('orientation', 'PORTRAIT');
    formData.append('dpi', '300');

    try {
      const res = await api.uploadPrintJob(formData);
      toast.success(`Dispatched "${quickFile.name}" (Job: ${res.job.id})`, 'Print Job Queued');
      setQuickFile(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch job', 'Upload Error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Dual-Gateway Status Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-900/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold tracking-wide uppercase border border-blue-500/30">
              DUAL-GATEWAY ACTIVE
            </span>
            <span className="text-xs text-gray-400">PocketPrint Remote Cloud Routing</span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">Unified Multi-Platform Print Relay</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Send commands from any phone or laptop. The Cloud Relay routes to your Windows Laptop Gateway (Canon Driver) or Android Phone Gateway (USB OTG).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh All
          </Button>
          <Button variant="primary" size="sm" onClick={onNavigateToPrint} leftIcon={<UploadCloud className="w-3.5 h-3.5" />}>
            Print Document
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Pending In Queue</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{pendingJobs.length}</div>
          <div className="text-[11px] text-gray-500 mt-1">Awaiting or currently streaming</div>
        </Card>

        {/* Metric 2: Windows Gateways */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Windows Laptop Gateways</span>
            <Laptop className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            <span className="text-sky-400">{activeWindows.length}</span>
            <span className="text-gray-500 text-lg font-medium"> / {windowsGateways.length}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Mode A: Windows Canon Spooler</div>
        </Card>

        {/* Metric 3: Android Gateways */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Android Phone Gateways</span>
            <Smartphone className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            <span className="text-emerald-400">{activeAndroid.length}</span>
            <span className="text-gray-500 text-lg font-medium"> / {androidGateways.length}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Mode B: Android USB OTG Host</div>
        </Card>

        {/* Metric 4: Completed Prints */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Completed Prints</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white mt-2">{completedJobs.length}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Verified physical output</div>
        </Card>
      </div>

      {/* Main Grid: Gateways & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dual Gateway Profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows Laptop Gateway Card */}
            <Card className="border-sky-900/40 bg-[#0f172a]/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Mode A: Windows Gateway</CardTitle>
                      <CardDescription className="text-[11px]">Laptop USB Spooler</CardDescription>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeWindows.length > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                    {activeWindows.length > 0 ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Target Printer:</span>
                  <span className="font-semibold text-white">Canon PIXMA MG2570S</span>
                </div>
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Port & Driver:</span>
                  <span className="font-mono text-sky-300 text-[11px]">USB001 • Canon Driver</span>
                </div>
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Control Mode:</span>
                  <span className="text-gray-200">Phone/Web remote trigger</span>
                </div>
              </CardContent>
            </Card>

            {/* Android Phone Gateway Card */}
            <Card className="border-emerald-900/40 bg-[#0f172a]/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">Mode B: Android Gateway</CardTitle>
                      <CardDescription className="text-[11px]">Phone USB OTG Host</CardDescription>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeAndroid.length > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                    {activeAndroid.length > 0 ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Target Printer:</span>
                  <span className="font-semibold text-white">Canon PIXMA MG2570S</span>
                </div>
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Connection & Protocol:</span>
                  <span className="font-mono text-emerald-300 text-[11px]">USB OTG • BJL / BJRaster3</span>
                </div>
                <div className="bg-[#162032] p-2.5 rounded-lg border border-gray-800 flex items-center justify-between">
                  <span className="text-gray-400">Control Mode:</span>
                  <span className="text-gray-200">Laptop/Web remote trigger</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Jobs Table Card */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>Recent Print Jobs</span>
                </CardTitle>
                <CardDescription>Live streaming status across all gateways</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={onNavigateToQueue}
                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                View Queue ({pendingJobs.length})
              </Button>
            </CardHeader>
            <div className="p-0">
              {recentJobs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  No print jobs recorded. Use the Quick Print panel or the Print Documents tab.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Destination Gateway</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium text-white max-w-[200px]">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="truncate">{job.originalName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-300 text-xs">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${job.gatewayType === 'WINDOWS_HOST' ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                            {job.gatewayType === 'WINDOWS_HOST' ? <Laptop className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                            {job.gatewayType === 'WINDOWS_HOST' ? 'Windows Laptop' : 'Android USB'}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-400 whitespace-nowrap text-xs">
                          {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={job.status} isSimulated={job.isSimulated} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>

        {/* Right Col: Quick Print Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-blue-400" />
              <span>Quick Print Dispatch</span>
            </CardTitle>
            <CardDescription>
              Route a PDF immediately to your preferred gateway
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleQuickUpload} className="space-y-4">
              {/* Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">PDF Document</label>
                <div className="border-2 border-dashed border-gray-700/80 rounded-xl p-4 text-center hover:border-blue-500 transition-colors bg-[#162032]/40">
                  <input
                    type="file"
                    accept="application/pdf"
                    id="quick-pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setQuickFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="quick-pdf" className="cursor-pointer block">
                    <FileText className="w-7 h-7 text-gray-400 mx-auto mb-1.5" />
                    {quickFile ? (
                      <span className="text-xs text-blue-400 font-semibold block truncate">
                        {quickFile.name} ({(quickFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-300 font-medium block">Click to select PDF</span>
                        <span className="text-[11px] text-gray-500 block mt-0.5">Supports standard A4 documents</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Target Printer / Gateway Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Destination Printer & Gateway</label>
                <select
                  value={selectedDestinationId}
                  onChange={(e) => setSelectedDestinationId(e.target.value)}
                  className="w-full bg-[#162032] border border-gray-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {printers.length > 0 ? (
                    printers.map((p) => (
                      <option key={p.id} value={`printer:${p.id}`}>
                        {p.gatewayType === 'WINDOWS_HOST' ? '💻 [Windows Laptop]' : '📱 [Android Phone]'} {p.name} ({p.connectionType})
                      </option>
                    ))
                  ) : devices.length > 0 ? (
                    devices.map((d) => (
                      <option key={d.id} value={`device:${d.id}`}>
                        {d.gatewayType === 'WINDOWS_HOST' ? '💻 [Windows Laptop]' : '📱 [Android Phone]'} {d.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No gateways available</option>
                  )}
                </select>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Copies</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-[#162032] border border-gray-700/80 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Color Mode</label>
                  <select
                    value={colorMode}
                    onChange={(e) => setColorMode(e.target.value as any)}
                    className="w-full bg-[#162032] border border-gray-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="COLOR">Full Color</option>
                    <option value="MONOCHROME">Grayscale</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2"
                disabled={!quickFile || !selectedDestinationId || isUploading}
                isLoading={isUploading}
                rightIcon={<Play className="w-3.5 h-3.5" />}
              >
                Send Print Job Now
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
