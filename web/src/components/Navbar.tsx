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
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeDevice: Device | null;
  queueCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activeDevice,
  queueCount,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'print', label: 'Print Documents', icon: UploadCloud },
    { id: 'status', label: 'Printer Status', icon: Activity },
    { id: 'devices', label: 'Device Management', icon: Smartphone },
    { id: 'queue', label: 'Print Queue', icon: ListOrdered, badge: queueCount > 0 ? queueCount : undefined },
    { id: 'history', label: 'Print History', icon: History },
    { id: 'settings', label: 'Account Settings', icon: Settings },
  ];

  return (
    <header className="bg-[#111827] border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight">PocketPrint</span>
              <span className="text-xs ml-1.5 px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-semibold uppercase tracking-wider border border-blue-700/50">
                Bridge
              </span>
            </div>
          </div>

          {/* Active Device Live Status Pill */}
          <div className="hidden md:flex items-center">
            {activeDevice ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 text-xs">
                <span className={`w-2 h-2 rounded-full ${activeDevice.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-gray-300 font-medium">{activeDevice.name}</span>
                <span className="text-gray-500">•</span>
                <span className={activeDevice.isPrinterConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-medium'}>
                  {activeDevice.printerModel || 'Canon PIXMA Standby'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/40 border border-amber-900/40 text-xs text-amber-300">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>No Android Gateway Paired</span>
              </div>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-white font-medium">{user?.name}</div>
              <div className="text-[11px] text-gray-400">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg bg-gray-800/80 hover:bg-red-950/60 text-gray-300 hover:text-red-400 border border-gray-700/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto pb-1 pt-1 border-t border-gray-800/60 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white text-blue-600' : 'bg-blue-900 text-blue-200'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
