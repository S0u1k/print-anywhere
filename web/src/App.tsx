import React, { useState, useEffect, useCallback } from 'react';
import { motion, type Variants } from 'motion/react';
import {
  Circle,
  Laptop,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './components/ui/Toast';
import { api } from './services/api';
import { Device, Printer as PrinterType, PrintJob } from './types';
import {
  subscribeToJobUpdates,
  subscribeToDeviceStatus,
  subscribeToDeviceTelemetry,
  subscribeToPrinterUpdates,
} from './services/socket';

import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { MobileNav } from './components/MobileNav';
import { PairingModal } from './components/PairingModal';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';

import { DashboardPage } from './pages/DashboardPage';
import { PrintDocumentsPage } from './pages/PrintDocumentsPage';
import { PrinterStatusPage } from './pages/PrinterStatusPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { PrintQueuePage } from './pages/PrintQueuePage';
import { PrintHistoryPage } from './pages/PrintHistoryPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';

function AuthenticatedApp() {
  const { user, isGuest, recoveryKey } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [printers, setPrinters] = useState<PrinterType[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active device fallback
  const activeDevice = devices.find((d) => d.isOnline) || (devices.length > 0 ? devices[0] : null);

  const pendingQueueCount = jobs.filter(
    (j) => !['COMPLETED', 'SIMULATED_COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
  ).length;

  const fetchData = useCallback(async () => {
    try {
      const [devRes, prnRes, jobRes] = await Promise.all([
        api.getDevices().catch(() => ({ devices: [] })),
        api.getPrinters().catch(() => ({ printers: [] })),
        api.getJobs().catch(() => ({ jobs: [] })),
      ]);
      setDevices(devRes.devices);
      setPrinters(prnRes.printers);
      setJobs(jobRes.jobs);
    } catch (err) {
      console.error('Failed to load application telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time Socket.IO Subscriptions
  useEffect(() => {
    const unsubJob = subscribeToJobUpdates((data) => {
      fetchData();
      if (data.event.status === 'COMPLETED') {
        toast.success(`Job "${data.job.originalName}" finished printing!`, 'Print Complete');
      } else if (data.event.status === 'FAILED') {
        toast.error(`Job "${data.job.originalName}" failed: ${data.event.message || ''}`, 'Print Error');
      }
    });

    const unsubDevice = subscribeToDeviceStatus(() => {
      fetchData();
    });

    const unsubTelemetry = subscribeToDeviceTelemetry(() => {
      fetchData();
    });

    const unsubPrinters = subscribeToPrinterUpdates(() => {
      fetchData();
    });

    return () => {
      unsubJob();
      unsubDevice();
      unsubTelemetry();
      unsubPrinters();
    };
  }, [fetchData, toast]);

  const handleCopyRecoveryKey = () => {
    if (recoveryKey) {
      navigator.clipboard.writeText(recoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-gray-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        activeDevice={activeDevice}
        devices={devices}
        queueCount={pendingQueueCount}
        onOpenPairing={() => setShowPairingModal(true)}
      />

      {/* Mobile Off-Canvas Drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        activeDevice={activeDevice}
        queueCount={pendingQueueCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Guest Mode Workspace Notice Banner */}
        {isGuest && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Guest Workspace Active:</strong> You are using PocketPrint without a permanent account.
              </span>
            </div>
            {recoveryKey && (
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/40 font-medium transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Backup Recovery Key</span>
              </button>
            )}
          </div>
        )}

        <TopNav
          currentTab={activeTab}
          activeDevice={activeDevice}
          onRefresh={fetchData}
          onQuickPrint={() => setActiveTab('print')}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          onOpenPairing={() => setShowPairingModal(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardPage
                devices={devices}
                printers={printers}
                jobs={jobs}
                activeDevice={activeDevice}
                onRefresh={fetchData}
                onNavigateToPrint={() => setActiveTab('print')}
                onNavigateToDevices={() => setActiveTab('devices')}
                onNavigateToQueue={() => setActiveTab('queue')}
              />
            )}

            {activeTab === 'print' && (
              <PrintDocumentsPage
                devices={devices}
                printers={printers}
                onJobCreated={fetchData}
                onNavigateToQueue={() => setActiveTab('queue')}
              />
            )}

            {activeTab === 'status' && (
              <PrinterStatusPage
                devices={devices}
                printers={printers}
                activeDevice={activeDevice}
                onRefresh={fetchData}
              />
            )}

            {activeTab === 'devices' && (
              <DeviceManagementPage devices={devices} onRefresh={fetchData} />
            )}

            {activeTab === 'queue' && (
              <PrintQueuePage jobs={jobs} onRefresh={fetchData} />
            )}

            {activeTab === 'history' && (
              <PrintHistoryPage jobs={jobs} onRefresh={fetchData} />
            )}

            {activeTab === 'settings' && (
              <AccountSettingsPage />
            )}
          </div>
        </main>
      </div>

      {/* Global Bidirectional Pairing Modal */}
      <PairingModal
        isOpen={showPairingModal}
        onClose={() => setShowPairingModal(false)}
        onPaired={fetchData}
      />

      {/* Recovery Key Backup Modal */}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Backup Guest Workspace Recovery Key"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>

          <div className="text-xs text-gray-300 text-left space-y-2">
            <p>
              Your Guest Workspace is stored locally in this browser. To restore access from another browser or device without creating an account, save this secret recovery key:
            </p>
          </div>

          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between">
            <span className="font-mono text-xs text-emerald-400 break-all select-all font-bold">
              {recoveryKey}
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={handleCopyRecoveryKey}
              leftIcon={copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedKey ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-left flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              If you lose all paired devices and this recovery key, access to your guest workspace cannot be recovered.
            </span>
          </div>

          <Button variant="primary" className="w-full" onClick={() => setShowRecoveryModal(false)}>
            I Have Saved My Key
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const heroContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

function AuroraAuthScreen() {
  const { login, continueAsGuest, recoverGuest } = useAuth();
  const toast = useToast();

  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Recovery modal state
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveryInput, setRecoveryInput] = useState<string>('');
  const [recovering, setRecovering] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLoginMode) {
        const res = await api.login({ email, password });
        login(res.token, res.user);
        toast.success(`Welcome back, ${res.user.name}!`, 'Authentication Succeeded');
      } else {
        const res = await api.register({ email, password, name });
        login(res.token, res.user);
        toast.success(`Account created for ${res.user.name}!`, 'Welcome to PocketPrint');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = async () => {
    setLoading(true);
    try {
      const res = await continueAsGuest();
      toast.success('Guest Workspace initialized! Ready to pair.', 'Guest Quick Pair');
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize guest workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInput.trim()) return;
    setRecovering(true);
    try {
      await recoverGuest(recoveryInput.trim());
      toast.success('Workspace recovered successfully!', 'Welcome Back');
      setShowRecoveryModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Invalid recovery key');
    } finally {
      setRecovering(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await api.login({
        email: 'souvik@pocketprint.io',
        password: 'Password123!',
      });
      login(res.token, res.user);
      toast.success('Logged in as Souvik Admin', 'Quick Connect');
    } catch (err: any) {
      toast.error(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full bg-black selection:bg-white/30 p-2 transition-all duration-500 lg:h-screen lg:overflow-hidden lg:p-4">
      {/* Left Column (Hero & Background Video) */}
      <section className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4"
            type="video/mp4"
          />
        </video>

        {/* Hero Content Container */}
        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 w-full max-w-sm space-y-6"
        >
          {/* Brand/Logo */}
          <motion.div
            variants={heroItemVariants}
            className="flex items-center justify-center gap-2.5"
          >
            <Circle className="w-5 h-5 fill-white text-white" />
            <span className="text-xl font-semibold tracking-tight text-white">PocketPrint Bridge</span>
          </motion.div>

          {/* Heading Block */}
          <motion.div variants={heroItemVariants} className="text-center space-y-2">
            <h2 className="text-3xl font-medium tracking-tight whitespace-nowrap text-white">
              Open-Source Remote Printing
            </h2>
            <p className="text-white/70 text-xs leading-relaxed px-2">
              Print documents over the Internet to your Canon PIXMA MG2570S via Windows Laptop Gateway or Android Phone USB OTG.
            </p>
          </motion.div>

          {/* Steps */}
          <motion.div variants={heroItemVariants} className="space-y-2.5">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-black border border-white">
              <Laptop className="w-4 h-4 text-black shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Mode A: Windows Laptop Gateway</span>
                <span className="text-[11px] text-gray-700">Windows Canon Driver & Spooler</span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-gray text-white">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block text-white">Mode B: Android Phone Gateway</span>
                <span className="text-[11px] text-white/60">USB OTG Host • BJL / BJRaster3</span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-gray text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold block text-white">Optional Authentication</span>
                <span className="text-[11px] text-white/60">Account Mode OR Accountless Quick Pair</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Right Column (Sign In / Register / Guest Form) */}
      <section className="flex-1 flex flex-col items-center justify-center py-10 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md space-y-6"
        >
          {/* Header */}
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-white">
              Welcome to PocketPrint Bridge
            </h1>
            <p className="text-white/50 text-xs sm:text-sm">
              Remote printing across the Internet. Connect with or without an account.
            </p>
          </div>

          {/* OPTION B: GUEST QUICK PAIR (NO ACCOUNT REQUIRED) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/60 to-emerald-900/30 border border-emerald-500/40 shadow-lg shadow-emerald-950/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Quick Connect Mode</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                No Account Needed
              </span>
            </div>
            <p className="text-white/80 text-xs leading-relaxed">
              Start immediately without an email or password. Pair your laptop and phone using a private one-time QR code or 8-digit PIN.
            </p>
            <button
              type="button"
              onClick={handleGuestContinue}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black text-xs font-bold tracking-wide transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Continue Without Account (Guest Quick Pair)</span>
            </button>
            <div className="flex justify-between items-center pt-1 text-[11px] text-emerald-400/80">
              <button
                type="button"
                onClick={() => setShowRecoveryModal(true)}
                className="hover:underline flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3 h-3" />
                <span>Restore with recovery key</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-white/10" />
            <span className="absolute bg-black px-3 text-[11px] font-medium text-white/40 uppercase tracking-widest">
              Or Account Mode
            </span>
          </div>

          {/* Quick Demo Access Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold tracking-wide hover:from-blue-500 hover:to-indigo-500 transition-all shadow-md shadow-blue-950 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>1-Click Sign In (Souvik Admin Demo)</span>
          </button>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLoginMode && (
              <div className="space-y-1.5 w-full text-left">
                <label className="text-xs font-medium text-white">Full Name</label>
                <input
                  type="text"
                  placeholder="Souvik Developer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-xs sm:text-sm text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 outline-none transition-all duration-200"
                />
              </div>
            )}

            <div className="space-y-1.5 w-full text-left">
              <label className="text-xs font-medium text-white">Email Address</label>
              <input
                type="email"
                placeholder="souvik@pocketprint.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-xs sm:text-sm text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 outline-none transition-all duration-200"
              />
            </div>

            <div className="space-y-1.5 w-full text-left">
              <label className="text-xs font-medium text-white">Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 pr-11 text-xs sm:text-sm text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 outline-none transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-white/40 hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] mt-3 transition-all duration-200 flex items-center justify-center cursor-pointer text-sm"
            >
              {loading ? 'Processing...' : isLoginMode ? 'Sign In to Account' : 'Create Persistent Account'}
            </button>

            {/* Toggle Login / Register */}
            <p className="text-center text-xs text-white/40 pt-2">
              {isLoginMode ? "Don't have an account yet?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-white font-medium hover:underline cursor-pointer"
              >
                {isLoginMode ? 'Create one now' : 'Sign in here'}
              </button>
            </p>
          </form>
        </motion.div>
      </section>

      {/* Restore Workspace Modal */}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Restore Guest Workspace"
      >
        <form onSubmit={handleRecoverySubmit} className="space-y-4">
          <p className="text-xs text-gray-300">
            Enter the recovery key provided when you initialized your Guest Workspace (starts with <code className="text-emerald-400">pk_rec_</code>):
          </p>
          <input
            type="text"
            placeholder="pk_rec_xxxxxxxxxxxxxxxxxxxxxxxx"
            value={recoveryInput}
            onChange={(e) => setRecoveryInput(e.target.value)}
            required
            className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-emerald-400 placeholder:text-neutral-700 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowRecoveryModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={recovering}>
              Restore Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </main>
  );
}

function MainApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>Initializing PocketPrint Bridge...</span>
        </div>
      </div>
    );
  }

  return user ? <AuthenticatedApp /> : <AuroraAuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
