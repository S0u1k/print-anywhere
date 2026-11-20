import React, { useState } from 'react';
import { Device } from '../types';
import { api } from '../services/api';
import {
  Smartphone,
  Laptop,
  Plus,
  Trash2,
  QrCode,
  Clock,
  Radio,
  Edit2,
  Copy,
  CheckCircle2,
  ShieldCheck,
  BatteryCharging,
  Printer,
  Terminal,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { PairingModal } from '../components/PairingModal';

export interface DeviceManagementPageProps {
  devices: Device[];
  onRefresh: () => void;
}

export const DeviceManagementPage: React.FC<DeviceManagementPageProps> = ({ devices, onRefresh }) => {
  const toast = useToast();
  const [showPairModal, setShowPairModal] = useState<boolean>(false);

  // Rename state
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [renaming, setRenaming] = useState<boolean>(false);

  // Delete / Unpair confirmation state
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [unpairing, setUnpairing] = useState<boolean>(false);

  const windowsGateways = devices.filter((d) => d.gatewayType === 'WINDOWS_HOST');
  const androidGateways = devices.filter((d) => d.gatewayType === 'ANDROID_USB' || (!d.gatewayType && !d.name.includes('Windows')));

  const handleOpenRename = (device: Device) => {
    setEditingDevice(device);
    setNewName(device.name);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !newName.trim()) return;

    setRenaming(true);
    try {
      await api.renameDevice(editingDevice.id, newName.trim());
      toast.success(`Device renamed to "${newName.trim()}"`);
      setEditingDevice(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename device');
    } finally {
      setRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return;
    setUnpairing(true);
    try {
      await api.deleteDevice(deviceToDelete.id);
      toast.success(`Unpaired device "${deviceToDelete.name}"`);
      setDeviceToDelete(null);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to unpair device');
    } finally {
      setUnpairing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Gateways & Devices</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage your Windows Laptop Gateways (Mode A) and Android Phone USB OTG Gateways (Mode B).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            Refresh Gateways
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowPairModal(true)}
            leftIcon={<QrCode className="w-4 h-4 text-emerald-400" />}
            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
          >
            Connect Device (QR / Code)
          </Button>
        </div>
      </div>

      {/* SECTION 1: Windows Laptop Gateways (Mode A) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Laptop className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-base font-bold text-white">Mode A: Windows Laptop Print Gateways</h2>
          <span className="text-xs text-gray-400">({windowsGateways.length} registered)</span>
        </div>

        {windowsGateways.length === 0 ? (
          <Card className="p-6 text-center border-dashed border-gray-800">
            <Laptop className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <div className="text-sm font-semibold text-gray-300">No Windows Laptop Agent Connected</div>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Run <code className="text-sky-300 font-mono">npm run agent</code> inside the backend folder on your Windows laptop to register this laptop as a print gateway.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {windowsGateways.map((device) => (
              <Card key={device.id} className="flex flex-col justify-between border-sky-950/60 hover:border-sky-800 transition-colors bg-[#0d1527]/50">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-600/15 border border-sky-500/30 text-sky-400 flex items-center justify-center flex-shrink-0">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <CardTitle className="text-sm truncate text-white">{device.name}</CardTitle>
                        <span className="text-[10px] text-gray-500 font-mono">ID: {device.id}</span>
                      </div>
                    </div>
                    <Badge variant={device.isOnline ? 'success' : 'danger'} dot size="sm">
                      {device.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs pt-3">
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Host OS:</span>
                      <span className="text-gray-200 font-medium">Windows 11 (x64)</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Target Printer:</span>
                      <span className="text-sky-300 font-semibold truncate max-w-[150px]">
                        {device.printerModel || 'Canon MG2500 series Printer'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Port & Driver:</span>
                      <span className="text-gray-300 font-mono text-[11px]">USB001 • Canon Driver</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Agent Backend:</span>
                      <span className="text-gray-300">{device.activeBackend || 'Windows USB Spooler'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Last Seen:</span>
                      <span className="text-gray-400">
                        {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : 'Active'}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-3 border-t border-gray-800/80 bg-[#0B0F19]/40 flex items-center justify-between rounded-b-xl">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenRename(device)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    onClick={() => setDeviceToDelete(device)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Unpair
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Android Phone Gateways (Mode B) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Smartphone className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-base font-bold text-white">Mode B: Android Smartphone USB OTG Gateways</h2>
          <span className="text-xs text-gray-400">({androidGateways.length} registered)</span>
        </div>

        {androidGateways.length === 0 ? (
          <EmptyState
            icon={<Smartphone className="w-8 h-8" />}
            title="No Android Devices Paired"
            description="Use bidirectional QR code or an 8-character pairing code to pair your Android smartphone running the PocketPrint Bridge App."
            actionLabel="Connect Device (QR / Code)"
            onAction={() => setShowPairModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {androidGateways.map((device) => (
              <Card key={device.id} className="flex flex-col justify-between border-emerald-950/60 hover:border-emerald-800 transition-colors bg-[#091817]/40">
                <div>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <CardTitle className="text-sm truncate text-white">{device.name}</CardTitle>
                        <span className="text-[10px] text-gray-500 font-mono">ID: {device.id}</span>
                      </div>
                    </div>
                    <Badge variant={device.isOnline ? 'success' : 'danger'} dot size="sm">
                      {device.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-2 text-xs pt-3">
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Attached Printer:</span>
                      <span className="text-emerald-300 font-semibold truncate max-w-[150px]">
                        {device.printerModel || 'Canon PIXMA MG2570S'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">USB OTG State:</span>
                      <span className={device.isPrinterConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-medium'}>
                        {device.isPrinterConnected ? 'Physical USB OTG' : 'Virtual / Detached'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Phone Battery:</span>
                      <span className="text-white font-medium flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                        {device.batteryPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-gray-800/80">
                      <span className="text-gray-400">Protocol Backend:</span>
                      <span className="text-gray-300 font-mono text-[11px]">{device.activeBackend || 'CanonPixmaBackend'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-400">Last Seen:</span>
                      <span className="text-gray-400">
                        {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : 'Active'}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-3 border-t border-gray-800/80 bg-[#0B0F19]/40 flex items-center justify-between rounded-b-xl">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenRename(device)}
                    leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    onClick={() => setDeviceToDelete(device)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Unpair
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bidirectional Pairing Modal */}
      <PairingModal
        isOpen={showPairModal}
        onClose={() => setShowPairModal(false)}
        onPaired={onRefresh}
      />

      {/* Rename Modal */}
      <Modal
        isOpen={!!editingDevice}
        onClose={() => setEditingDevice(null)}
        title="Rename Gateway Device"
      >
        <form onSubmit={handleSaveRename} className="space-y-4">
          <Input
            label="Device Friendly Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g., Pixel 8 Pro USB Gateway"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditingDevice(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={renaming}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unpair Confirm */}
      <ConfirmDialog
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Unpair "${deviceToDelete?.name}"?`}
        message="This device will no longer receive remote print jobs until re-paired."
        confirmLabel="Unpair Device"
        variant="danger"
        isLoading={unpairing}
      />
    </div>
  );
};
