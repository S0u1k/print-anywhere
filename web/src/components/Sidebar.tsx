import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Device } from '../types';
import {
  Printer,
  LayoutDashboard,
  UploadCloud,
  Activity,
  Smartphone,
  ListOrdered,
  History,
  Settings,
  LogOut,
  Radio,
  ChevronRight,
  ShieldCheck,
  QrCode,
} from 'lucide-react';

export interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeDevice: Device | null;
  devices?: Device[];
  queueCount: number;
  onOpenPairing?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeDevice,
  devices = [],
  queueCount,
  onOpenPairing,
}) => {
  const { user, logout } = useAuth();

  const hasWindows = devices.some((d) => d.gatewayType === 'WINDOWS_HOST' && d.isOnline);
  const hasAndroid = devices.some((d) => (d.gatewayType === 'ANDROID_USB' || !d.gatewayType) && d.isOnline);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'print', label: 'Print Documents', icon: UploadCloud },
    { id: 'status', label: 'Printer Management', icon: Activity },
    { id: 'devices', label: 'Device Management', icon: Smartphone },
    { id: 'queue', label: 'Print Queue', icon: ListOrdered, badge: queueCount > 0 ? queueCount : undefined },
    { id: 'history', label: 'Print History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[#111827] border-r border-gray-800/90 h-screen sticky top-0 flex-shrink-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-800/80 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-950/40">
          <Printer className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base text-white tracking-tight">PocketPrint</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-900/60 text-blue-300 font-bold uppercase tracking-wider border border-blue-700/50">
              Bridge
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium">Remote USB Print Gateway</p>
        </div>
      </div>

      {/* Target Hardware Indicator */}
      <div className="p-3.5 mx-3 my-3 rounded-xl bg-[#162032] border border-gray-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">Dual Gateways</span>
          <span className="text-[10px] text-blue-400 font-bold">Cloud Relay</span>
        </div>
        
        {/* Mode A indicator */}
        <div className="flex items-center justify-between text-xs py-1 border-b border-gray-800/70">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasWindows ? 'bg-sky-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-gray-300 font-medium">Windows USB</span>
          </div>
          <span className={`text-[10px] font-bold ${hasWindows ? 'text-sky-300' : 'text-gray-500'}`}>
            {hasWindows ? 'READY' : 'OFFLINE'}
          </span>
        </div>

        {/* Mode B indicator */}
        <div className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasAndroid ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-gray-300 font-medium">Android OTG</span>
          </div>
          <span className={`text-[10px] font-bold ${hasAndroid ? 'text-emerald-300' : 'text-gray-500'}`}>
            {hasAndroid ? 'READY' : 'OFFLINE'}
          </span>
        </div>

        {/* Connect Device Action */}
        {onOpenPairing && (
          <button
            onClick={onOpenPairing}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 mt-2 text-xs font-semibold rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Connect Device (QR / Code)</span>
          </button>
        )}
      </div>

      {/* Main Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              data-testid={`sidebar-nav-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-900/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1F2937]/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white text-blue-600' : 'bg-blue-900/90 text-blue-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200 opacity-80" />}
              </div>
            </button>
          );
        })}
      </nav>

      {/* User Card & Logout */}
      <div className="p-4 border-t border-gray-800/80 bg-[#0B0F19]/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[11px] text-gray-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/40 transition-colors flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
