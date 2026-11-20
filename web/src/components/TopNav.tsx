import React from 'react';
import { Device } from '../types';
import {
  Menu,
  UploadCloud,
  RefreshCw,
  Printer,
  Radio,
  CheckCircle2,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { Button } from './ui/Button';

export interface TopNavProps {
  currentTab: string;
  activeDevice: Device | null;
  onRefresh: () => void;
  onQuickPrint: () => void;
  onOpenMobileNav: () => void;
  onOpenPairing?: () => void;
}

const tabTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'System Dashboard', subtitle: 'Live overview of print pipeline & remote gateway' },
  print: { title: 'Print Documents', subtitle: 'Upload and configure PDF print dispatch' },
  status: { title: 'Printer Management', subtitle: 'Hardware descriptors & USB OTG status' },
  devices: { title: 'Device Management', subtitle: 'Authorized Android phones & pairing sessions' },
  queue: { title: 'Print Queue', subtitle: 'Real-time job execution & stream monitoring' },
  history: { title: 'Print History', subtitle: 'Audit log of physical and simulated jobs' },
  settings: { title: 'Account & Preferences', subtitle: 'Retention policy, security & device configuration' },
};

export const TopNav: React.FC<TopNavProps> = ({
  currentTab,
  activeDevice,
  onRefresh,
  onQuickPrint,
  onOpenMobileNav,
  onOpenPairing,
}) => {
  const current = tabTitles[currentTab] || { title: 'PocketPrint Bridge', subtitle: '' };

  return (
    <header className="bg-[#111827]/90 backdrop-blur-md border-b border-gray-800/80 sticky top-0 z-20 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Menu Button + Title / Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">{current.title}</h1>
          </div>
          <p className="text-[11px] text-gray-400 hidden sm:block">{current.subtitle}</p>
        </div>
      </div>

      {/* Right: Active Device Status Pill + Actions */}
      <div className="flex items-center gap-2.5">
        {/* Device Status Pill */}
        {activeDevice ? (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#162032] border border-gray-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${activeDevice.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-gray-200 font-medium">{activeDevice.name}</span>
            <span className="text-gray-600">•</span>
            <span className={activeDevice.isPrinterConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {activeDevice.printerModel || 'Canon PIXMA MG2570S'}
            </span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-950/40 border border-amber-900/50 text-xs text-amber-300">
            <Radio className="w-3.5 h-3.5" />
            <span>No Android Gateway</span>
          </div>
        )}

        <Button
          variant="outline"
          size="xs"
          onClick={onRefresh}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          title="Refresh Data"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {onOpenPairing && (
          <Button
            variant="outline"
            size="xs"
            onClick={onOpenPairing}
            leftIcon={<QrCode className="w-3.5 h-3.5 text-emerald-400" />}
            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
          >
            <span className="hidden sm:inline">Connect Device</span>
            <span className="sm:hidden">Pair</span>
          </Button>
        )}

        <Button
          variant="primary"
          size="xs"
          onClick={onQuickPrint}
          leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
        >
          <span>Print PDF</span>
        </Button>
      </div>
    </header>
  );
};
