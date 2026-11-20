import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Device } from '../types';
import {
  X,
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

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: string;
  onSelectTab: (tab: string) => void;
  activeDevice: Device | null;
  queueCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  activeDevice,
  queueCount,
}) => {
  const { user, logout } = useAuth();

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[85%] bg-[#111827] border-r border-gray-800 h-full flex flex-col z-10 shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Printer className="w-4 h-4" />
            </div>
            <span className="font-bold text-white text-sm">PocketPrint Bridge</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Status */}
        <div className="p-3 mx-3 my-3 rounded-lg bg-[#162032] border border-gray-800 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold text-gray-400">Gateway Status</span>
            <span className={`w-2 h-2 rounded-full ${activeDevice?.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          </div>
          <div className="text-gray-200 font-semibold truncate">
            {activeDevice?.name || 'No Gateway Phone'}
          </div>
          <div className="text-[11px] text-gray-400 truncate mt-0.5">
            {activeDevice?.printerModel || 'Canon PIXMA MG2570S'}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`mobile-nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-900 text-blue-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0B0F19]/50 flex items-center justify-between">
          <div className="truncate">
            <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
            <div className="text-[11px] text-gray-400 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="p-2 rounded-lg text-red-400 hover:bg-red-950/40"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
