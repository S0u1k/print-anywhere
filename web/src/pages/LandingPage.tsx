import React from 'react';
import {
  Printer,
  Smartphone,
  Cloud,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Usb,
  Lock,
  Zap,
  CheckCircle2,
  FileText,
  Activity,
  Terminal,
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col selection:bg-blue-600/30">
      {/* Top Header */}
      <header className="border-b border-gray-800/80 bg-[#111827]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-sm">
              <Printer className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-white tracking-tight">PocketPrint</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-bold uppercase tracking-wider border border-blue-700/50">
                Bridge
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onLogin}>
              Sign In
            </Button>
            <Button variant="primary" size="sm" onClick={onGetStarted} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/70 border border-blue-800/60 text-xs text-blue-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>Turn Any Android Phone into a Remote USB Print Gateway</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Remote USB Printing from Anywhere in the World.
            </h1>

            <p className="text-sm sm:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto">
              Send PDF print jobs from your laptop browser across the public Internet to a USB-connected printer.
              Engineered specifically for entry-level GDI printers like the <span className="text-blue-300 font-semibold">Canon PIXMA MG2570S</span> using Android USB Host API and native page rasterization.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button variant="primary" size="lg" onClick={onGetStarted} rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Web Dashboard
              </Button>
              <Button variant="secondary" size="lg" onClick={onLogin}>
                Sign In to Gateway
              </Button>
            </div>
          </div>

          {/* Interactive Hardware Pipeline Card */}
          <div className="mt-14 max-w-4xl mx-auto bg-[#111827] border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800 text-xs">
              <span className="font-bold text-gray-400 tracking-wider uppercase">End-to-End Pipeline Architecture</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Zero Port Forwarding (Outbound TLS WSS)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6 text-center">
              {/* Step 1 */}
              <div className="bg-[#162032] p-4 rounded-xl border border-gray-800 flex flex-col items-center">
                <div className="w-10 h-10 rounded-lg bg-blue-600/15 text-blue-400 flex items-center justify-center mb-2.5">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">1. Laptop Browser</h4>
                <p className="text-[11px] text-gray-400 mt-1">Upload PDF, configure A4/Letter & copies</p>
              </div>

              {/* Step 2 */}
              <div className="bg-[#162032] p-4 rounded-xl border border-gray-800 flex flex-col items-center">
                <div className="w-10 h-10 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center mb-2.5">
                  <Cloud className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">2. Cloud Relay</h4>
                <p className="text-[11px] text-gray-400 mt-1">Authenticates token & enqueues job</p>
              </div>

              {/* Step 3 */}
              <div className="bg-[#162032] p-4 rounded-xl border border-gray-800 flex flex-col items-center">
                <div className="w-10 h-10 rounded-lg bg-sky-600/15 text-sky-400 flex items-center justify-center mb-2.5">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">3. Android Phone</h4>
                <p className="text-[11px] text-gray-400 mt-1">Native PdfRenderer 300 DPI + BJL encoder</p>
              </div>

              {/* Step 4 */}
              <div className="bg-[#162032] p-4 rounded-xl border border-gray-800 flex flex-col items-center">
                <div className="w-10 h-10 rounded-lg bg-emerald-600/15 text-emerald-400 flex items-center justify-center mb-2.5">
                  <Printer className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-white">4. Canon PIXMA</h4>
                <p className="text-[11px] text-gray-400 mt-1">USB OTG Bulk OUT stream accepts BJRaster3</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Target Hardware Section: Canon PIXMA MG2570S */}
      <section className="py-16 border-b border-gray-800/60 bg-[#0E1422]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-10">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Hardware Verified: Canon PIXMA MG2570S (MG2500 Series)
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              The Canon PIXMA MG2570S is a host-based "GDI" printer without Wi-Fi, AirPrint, or PostScript.
              PocketPrint Bridge bridges this exact limitation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-blue-400">
                <Usb className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">USB Identifiers</h3>
              </div>
              <div className="space-y-1 text-xs text-gray-300 font-mono">
                <div>Vendor ID (VID): <span className="text-white font-bold">0x04A9 (Canon)</span></div>
                <div>Product ID (PID): <span className="text-white font-bold">0x176D (MG2500)</span></div>
                <div>Class: <span className="text-white">0x07 (Printers)</span></div>
              </div>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Terminal className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">IEEE-1284 Command Set</h3>
              </div>
              <p className="text-xs font-mono text-blue-300 bg-gray-900 p-2 rounded border border-gray-800">
                CMD:BJL,BJRaster3,BSCCe,NCCe,IVEC,IVECPLI
              </p>
              <p className="text-[11px] text-gray-400 mt-2">
                Converts bitmap rows into hardware swaths matching the Canon FINE cartridge.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-5 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-emerald-400">
                <Activity className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Status Verification</h3>
              </div>
              <p className="text-xs text-gray-300">
                Monitors Bulk IN endpoints for hardware feedback. Never falsely reports a print completed without spooler acceptance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-white tracking-tight">Designed for Production Reliability</h2>
            <p className="text-xs text-gray-400 mt-1">Modular architecture separating drivers, relay logic, and user interface.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/15 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Outbound-Only WebSocket Link</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                The smartphone initiates outbound TLS connections to the Cloud Relay. No router ports are opened and your phone's USB service is never exposed.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Native PDF Rasterization</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Android's built-in <code className="text-blue-300 font-mono">PdfRenderer</code> renders pages directly to 300 or 600 DPI memory buffers without third-party cloud conversion dependencies.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Modular Driver Backends</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Pluggable architecture with dedicated backends for Canon BJL/BJRaster3, HP PCL3/5, Epson ESC/P, and a verified Hardware Simulator Sandbox.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-600/15 text-amber-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Short-Lived Download Tokens</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Files are stored temporarily with SHA-256 validation and accessible solely via expiring 60-minute JWT tokens before being purged by the retention engine.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-sky-600/15 text-sky-400 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Android Foreground Service</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Persistent notification and partial WakeLock allow the phone to continuously listen for print commands even while unattended or in Android Doze mode.
              </p>
            </div>

            <div className="bg-[#111827] border border-gray-800 p-6 rounded-xl space-y-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600/15 text-purple-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Verified Status Truthfulness</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Distinct statuses: <span className="text-emerald-400 font-semibold">COMPLETED</span> for real hardware confirmation vs. <span className="text-amber-400 font-semibold">SIMULATED_COMPLETED</span> for virtual sandbox tests.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-[#111827] border-t border-gray-800 py-8 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-300">PocketPrint Bridge</span>
            <span>•</span>
            <span>Open Source Remote Printing Platform (MIT License)</span>
          </div>
          <div>
            <span>Engineered for Canon PIXMA MG2570S & Android USB Host API</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
