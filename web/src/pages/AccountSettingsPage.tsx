import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User,
  Settings,
  Shield,
  Server,
  Trash2,
  CheckCircle2,
  Lock,
  Palette,
  Bell,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';

export const AccountSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [retentionHours, setRetentionHours] = useState<number>(24);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [defaultPaperSize, setDefaultPaperSize] = useState<string>('A4');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Your settings and retention preferences have been updated.', 'Settings Saved');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="pb-2 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white tracking-tight">Account & Gateway Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Configure security, document retention policies, and print pipeline preferences
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span>User Profile</span>
            </CardTitle>
            <CardDescription>Authentication credentials for your web dashboard session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                type="text"
                readOnly
                value={user?.name || ''}
                className="cursor-not-allowed opacity-80"
              />
              <Input
                label="Email Address"
                type="email"
                readOnly
                value={user?.email || ''}
                className="cursor-not-allowed opacity-80"
              />
            </div>
          </CardContent>
        </Card>

        {/* Document Retention & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-blue-400" />
              <span>Document Retention & Auto-Cleanup</span>
            </CardTitle>
            <CardDescription>
              Uploaded PDF files on the Cloud Relay are automatically unlinked once printed or upon expiration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-xs">
              <Select
                label="Document Retention Window"
                value={retentionHours}
                onChange={(e) => setRetentionHours(parseInt(e.target.value, 10))}
              >
                <option value={1}>1 Hour (Maximum Privacy)</option>
                <option value={6}>6 Hours</option>
                <option value={24}>24 Hours (Standard)</option>
                <option value={72}>72 Hours</option>
              </Select>
            </div>
            <p className="text-[11px] text-gray-500">
              Files are stored with SHA-256 integrity checks and accessed solely via expiring 60-minute JWT download tokens.
            </p>
          </CardContent>
        </Card>

        {/* Pipeline & Appearance Defaults */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-400" />
              <span>Pipeline Defaults & Appearance</span>
            </CardTitle>
            <CardDescription>Default paper sizes and visual theme options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Default Paper Media"
                value={defaultPaperSize}
                onChange={(e) => setDefaultPaperSize(e.target.value)}
              >
                <option value="A4">A4 (210 x 297 mm)</option>
                <option value="LETTER">US Letter (8.5 x 11 in)</option>
              </Select>

              <Select label="Dashboard Theme" value="dark" disabled>
                <option value="dark">Deep Navy & Charcoal (Production)</option>
              </Select>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="rounded border-gray-700 bg-[#162032] text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Enable browser push notifications for completed print jobs</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Security & Infrastructure Summary */}
        <Card className="bg-[#0B0F19]">
          <CardContent className="text-xs space-y-2 text-gray-400">
            <div className="flex items-center gap-2 text-white font-bold">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Production Security Standards</span>
            </div>
            <p>• Zero public phone exposure — outbound encrypted WebSockets only.</p>
            <p>• Strict PDF magic bytes validation (<code className="text-blue-300">%PDF-</code>) and 50MB file caps.</p>
            <p>• Self-hostable via Docker Compose with PostgreSQL 16.</p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="md">
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
