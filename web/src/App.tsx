import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  HelpCircle,
  ArrowRight,
  Monitor,
  Printer,
  Sparkles,
  Info,
  Radio,
  X,
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

  // Open pairing modal automatically if requested by Mode C flow
  useEffect(() => {
    if (localStorage.getItem('pocketprint_open_pairing') === 'true') {
      setShowPairingModal(true);
      localStorage.removeItem('pocketprint_open_pairing');
    }
  }, []);

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
  const isSubmittingRef = useRef<boolean>(false);

  // 1. Decision A: How to continue ('guest' | 'login' | 'register')
  const [authMode, setAuthMode] = useState<'guest' | 'login' | 'register'>('guest');

  // 2. Decision B: Where is your printer connected ('mode_a' | 'mode_b' | 'mode_c')
  const [selectedMode, setSelectedMode] = useState<'mode_a' | 'mode_b' | 'mode_c'>(() => {
    return (localStorage.getItem('pocketprint_preferred_mode') as any) || 'mode_a';
  });

  // 3. Decision C: Which device are you sending prints from ('phone' | 'laptop' | 'other')
  const [senderDevice, setSenderDevice] = useState<'phone' | 'laptop' | 'other'>(() => {
    return (localStorage.getItem('pocketprint_sender_device') as any) || 'phone';
  });

  // Form input states
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Modal dialog states
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState<boolean>(false);
  const [recoveryInput, setRecoveryInput] = useState<string>('');
  const [recovering, setRecovering] = useState<boolean>(false);

  // Sync mode selection to storage immediately for persistence
  const handleSelectMode = (mode: 'mode_a' | 'mode_b' | 'mode_c') => {
    setSelectedMode(mode);
    localStorage.setItem('pocketprint_preferred_mode', mode);
  };

  const handleSelectSender = (device: 'phone' | 'laptop' | 'other') => {
    setSenderDevice(device);
    localStorage.setItem('pocketprint_sender_device', device);
  };

  // Keyboard accessibility helper for radio card
  const handleCardKeyDown = (e: React.KeyboardEvent, mode: 'mode_a' | 'mode_b' | 'mode_c') => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleSelectMode(mode);
    }
  };

  // Dynamic label for primary call to action
  const getActionLabel = () => {
    if (loading) return 'Connecting...';

    const modeLabel =
      selectedMode === 'mode_a'
        ? 'Windows Gateway (Mode A)'
        : selectedMode === 'mode_b'
        ? 'Android Gateway (Mode B)'
        : 'Paired Gateway (Mode C)';

    if (authMode === 'guest') {
      return selectedMode === 'mode_c' ? 'Connect to Paired Gateway (Mode C)' : `Continue to ${modeLabel}`;
    }
    if (authMode === 'login') {
      return `Sign In & Launch ${modeLabel}`;
    }
    return `Create Account & Launch ${modeLabel}`;
  };

  const handleMainAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    localStorage.setItem('pocketprint_preferred_mode', selectedMode);
    localStorage.setItem('pocketprint_sender_device', senderDevice);

    if (authMode === 'guest') {
      isSubmittingRef.current = true;
      setLoading(true);
      try {
        if (selectedMode === 'mode_c') {
          localStorage.setItem('pocketprint_open_pairing', 'true');
        }
        await continueAsGuest();
        const modeTitle =
          selectedMode === 'mode_a'
            ? 'Windows Laptop Gateway'
            : selectedMode === 'mode_b'
            ? 'Android Phone Gateway'
            : 'Paired Gateway';
        toast.success(`Guest Workspace initialized for ${modeTitle}!`, 'Welcome to PocketPrint');
      } catch (err: any) {
        const errorMsg = err.userFriendlyMessage || err.message || 'Failed to initialize workspace';
        toast.error(errorMsg);
      } finally {
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } else if (authMode === 'login') {
      if (!email.trim() || !password) {
        toast.warning('Please enter both email and password');
        return;
      }
      isSubmittingRef.current = true;
      setLoading(true);
      try {
        const res = await api.login({ email: email.trim(), password });
        login(res.token, res.user);
        toast.success(`Welcome back, ${res.user.name}!`, 'Authentication Succeeded');
      } catch (err: any) {
        const errorMsg = err.userFriendlyMessage || err.message || 'Authentication failed';
        toast.error(errorMsg);
      } finally {
        isSubmittingRef.current = false;
        setLoading(false);
      }
    } else if (authMode === 'register') {
      if (!name.trim() || !email.trim() || !password) {
        toast.warning('Please fill in all registration fields');
        return;
      }
      isSubmittingRef.current = true;
      setLoading(true);
      try {
        const res = await api.register({ email: email.trim(), password, name: name.trim() });
        login(res.token, res.user);
        toast.success(`Account created for ${res.user.name}!`, 'Welcome to PocketPrint');
      } catch (err: any) {
        const errorMsg = err.userFriendlyMessage || err.message || 'Account creation failed';
        toast.error(errorMsg);
      } finally {
        isSubmittingRef.current = false;
        setLoading(false);
      }
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryInput.trim() || recovering) return;
    setRecovering(true);
    try {
      await recoverGuest(recoveryInput.trim());
      toast.success('Workspace recovered successfully!', 'Welcome Back');
      setShowRecoveryModal(false);
    } catch (err: any) {
      const errorMsg = err.userFriendlyMessage || err.message || 'Invalid recovery key';
      toast.error(errorMsg);
    } finally {
      setRecovering(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    localStorage.setItem('pocketprint_preferred_mode', selectedMode);
    localStorage.setItem('pocketprint_sender_device', senderDevice);
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
    <div className="min-h-screen w-full bg-[#07090E] text-white selection:bg-emerald-500/30 flex flex-col justify-between relative overflow-x-hidden">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Navigation Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-sky-500 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-[#07090E] rounded-[10px] flex items-center justify-center">
              <Printer className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-base sm:text-lg block leading-none">
              PocketPrint Bridge
            </span>
            <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">
              Dual-Gateway Remote Printing
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Canon MG2570S Ready
          </span>
          <button
            type="button"
            onClick={() => setShowHowItWorksModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 hover:text-white transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>How it works</span>
          </button>
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col justify-center">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Remote Internet Printing • Zero Driver Installation on Client Phones</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Print from anywhere. <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-emerald-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Use the printer you already own.
            </span>
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            Connect your phone or laptop to your printer gateway and send documents remotely through one simple dashboard.
          </p>
        </div>

        {/* 2-Column Interactive Decision Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN: Hardware Gateway & Sender Decisions (cols 1-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* DECISION 2: Where is your printer connected? */}
            <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/60 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center border border-emerald-500/30">
                      1
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                      Where is your printer connected?
                    </h2>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 pl-7">
                    Select the gateway mode matching your physical printer setup
                  </p>
                </div>
                <span className="text-[10px] text-gray-500 font-mono hidden sm:block">
                  Select 1 of 3 Modes
                </span>
              </div>

              {/* Mode Cards Grid (Radio Group) */}
              <div role="radiogroup" aria-label="Printer Gateway Mode" className="grid grid-cols-1 gap-3">
                {/* MODE A: Windows Laptop */}
                <div
                  role="radio"
                  aria-checked={selectedMode === 'mode_a'}
                  tabIndex={0}
                  onClick={() => handleSelectMode('mode_a')}
                  onKeyDown={(e) => handleCardKeyDown(e, 'mode_a')}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 outline-none ${
                    selectedMode === 'mode_a'
                      ? 'border-sky-500 bg-sky-950/40 shadow-lg shadow-sky-950/60 ring-2 ring-sky-500/50'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          selectedMode === 'mode_a'
                            ? 'bg-sky-500 text-black border-sky-400'
                            : 'bg-white/5 text-sky-400 border-white/10'
                        }`}
                      >
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Mode A: Windows Laptop</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                            USB001
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                          Canon PIXMA MG2570S via USB • Windows Driver & Spooler
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                        selectedMode === 'mode_a'
                          ? 'border-sky-400 bg-sky-400'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {selectedMode === 'mode_a' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2.5 pl-12 leading-relaxed">
                    Printer is plugged into a Windows PC. The Windows Print Agent receives remote jobs and feeds them to the official Canon spooler.
                  </p>
                </div>

                {/* MODE B: Android Phone */}
                <div
                  role="radio"
                  aria-checked={selectedMode === 'mode_b'}
                  tabIndex={0}
                  onClick={() => handleSelectMode('mode_b')}
                  onKeyDown={(e) => handleCardKeyDown(e, 'mode_b')}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 outline-none ${
                    selectedMode === 'mode_b'
                      ? 'border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/50'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          selectedMode === 'mode_b'
                            ? 'bg-emerald-500 text-black border-emerald-400'
                            : 'bg-white/5 text-emerald-400 border-white/10'
                        }`}
                      >
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Mode B: Android Phone</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                            USB OTG Host
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                          Canon PIXMA MG2570S via OTG • BJL / BJRaster3
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                        selectedMode === 'mode_b'
                          ? 'border-emerald-400 bg-emerald-400'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {selectedMode === 'mode_b' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2.5 pl-12 leading-relaxed">
                    Printer is plugged into an Android smartphone via USB OTG. The Android app sends raw raster bytes directly to Canon bulk endpoints (0x01/0x81).
                  </p>
                </div>

                {/* MODE C: Existing Paired Gateway */}
                <div
                  role="radio"
                  aria-checked={selectedMode === 'mode_c'}
                  tabIndex={0}
                  onClick={() => handleSelectMode('mode_c')}
                  onKeyDown={(e) => handleCardKeyDown(e, 'mode_c')}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 outline-none ${
                    selectedMode === 'mode_c'
                      ? 'border-purple-500 bg-purple-950/40 shadow-lg shadow-purple-950/60 ring-2 ring-purple-500/50'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          selectedMode === 'mode_c'
                            ? 'bg-purple-500 text-black border-purple-400'
                            : 'bg-white/5 text-purple-400 border-white/10'
                        }`}
                      >
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">Mode C: Existing Paired Gateway</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                            Cloud Direct
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-0.5">
                          Connect with 8-digit PIN or 12-word recovery mnemonic
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-1 transition-all ${
                        selectedMode === 'mode_c'
                          ? 'border-purple-400 bg-purple-400'
                          : 'border-gray-600 bg-transparent'
                      }`}
                    >
                      {selectedMode === 'mode_c' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2.5 pl-12 leading-relaxed">
                    Your printer is already online on another laptop or phone. Hook this browser directly into that active workspace to dispatch print jobs.
                  </p>
                </div>
              </div>
            </div>

            {/* DECISION 3: Which device are you sending prints from? */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/40 border border-white/5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                  2
                </span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  Which device are you sending prints from?
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectSender('phone')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    senderDevice === 'phone'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>This Phone</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSender('laptop')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    senderDevice === 'laptop'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  <span>This Laptop/PC</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSender('other')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    senderDevice === 'other'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Tablet / Other</span>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Authentication & Dynamic Action (cols 8-12) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 sm:p-6 rounded-2xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl shadow-2xl space-y-5">
              {/* DECISION 1: How do you want to continue? */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center border border-purple-500/30">
                    3
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    How do you want to continue?
                  </h3>
                </div>

                {/* Segmented Mode Selector */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-black/60 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setAuthMode('guest')}
                    className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate ${
                      authMode === 'guest'
                        ? 'bg-emerald-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Quick Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate ${
                      authMode === 'login'
                        ? 'bg-white text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`py-2 px-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer truncate ${
                      authMode === 'register'
                        ? 'bg-white text-black shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              {/* Form / Content based on authMode */}
              {authMode === 'guest' && (
                <div className="space-y-3 animate-fadeIn">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Zero-Account Instant Workspace</span>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Start right away without signing up. Your workspace is assigned a secure cryptographic session token and can pair with devices via an 8-digit PIN or QR code.
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                    <span>Need to switch to an existing guest workspace?</span>
                    <button
                      type="button"
                      onClick={() => setShowRecoveryModal(true)}
                      className="text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3 h-3" />
                      <span>Enter Key</span>
                    </button>
                  </div>
                </div>
              )}

              {authMode === 'login' && (
                <form onSubmit={handleMainAction} className="space-y-3 animate-fadeIn">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-gray-300">Email Address</label>
                    <input
                      type="email"
                      placeholder="souvik@pocketprint.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl h-11 px-3 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-gray-300">Password</label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-black/50 border border-white/10 rounded-xl h-11 px-3 pr-10 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {authMode === 'register' && (
                <form onSubmit={handleMainAction} className="space-y-3 animate-fadeIn">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-gray-300">Full Name</label>
                    <input
                      type="text"
                      placeholder="Souvik Developer"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl h-11 px-3 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-gray-300">Email Address</label>
                    <input
                      type="email"
                      placeholder="souvik@pocketprint.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl h-11 px-3 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-medium text-gray-300">Password</label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-black/50 border border-white/10 rounded-xl h-11 px-3 pr-10 text-xs sm:text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-gray-400 hover:text-white cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* DYNAMIC PRIMARY ACTION BUTTON */}
              <button
                type="button"
                onClick={() => handleMainAction()}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-500 hover:from-emerald-300 hover:to-indigo-400 text-black text-xs sm:text-sm font-extrabold tracking-wide shadow-lg shadow-sky-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>{getActionLabel()}</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center justify-center pt-1">
                <div className="w-full border-t border-white/10" />
                <span className="absolute bg-[#121620] px-3 text-[10px] font-medium text-gray-500 uppercase tracking-widest">
                  Quick Testing
                </span>
              </div>

              {/* 1-Click Demo Login */}
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>1-Click Sign In (Souvik Admin Demo)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 py-4 text-center border-t border-white/5 text-[11px] text-gray-500">
        PocketPrint Bridge v2.0 • Canon PIXMA MG2570S • End-to-End Encrypted Cloud Print Relay
      </footer>

      {/* HOW IT WORKS MODAL */}
      <Modal
        isOpen={showHowItWorksModal}
        onClose={() => setShowHowItWorksModal(false)}
        title="How PocketPrint Bridge Works"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-gray-300">
            PocketPrint Bridge eliminates the need to install printer drivers on your mobile devices. It connects your phone and laptop through a secure, isolated cloud bridge:
          </p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                <Laptop className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white block">Mode A: Windows Laptop Gateway</span>
                <span className="text-gray-300 leading-relaxed block mt-0.5">
                  Plug your Canon printer into a Windows laptop with USB cable. Run the lightweight agent (<code className="text-sky-300 font-mono">npm run agent</code>). It catches remote PDF print requests and sends them to the local Windows Canon Spooler.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white block">Mode B: Android Phone Gateway</span>
                <span className="text-gray-300 leading-relaxed block mt-0.5">
                  Plug your Canon printer into an Android phone using a USB OTG adapter. The Android app acts as a standalone host, converting PDFs to native Canon BJL raster bytes and transmitting directly over bulk endpoints.
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/40 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <QrCode className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-white block">Mode C: Existing Paired Gateway</span>
                <span className="text-gray-300 leading-relaxed block mt-0.5">
                  Pair any other smartphone, tablet, or browser with your active printer gateway using an 8-digit PIN or QR code to dispatch print jobs from across the room or across the globe.
                </span>
              </div>
            </div>
          </div>

          <Button variant="primary" className="w-full" onClick={() => setShowHowItWorksModal(false)}>
            Got it, Let's Print!
          </Button>
        </div>
      </Modal>

      {/* RESTORE WORKSPACE MODAL */}
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
    </div>
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
