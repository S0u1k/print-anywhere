import React, { useState } from 'react';
import { PrintJob, PrintJobEvent } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import {
  History,
  Search,
  RotateCcw,
  FileText,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

export interface PrintHistoryPageProps {
  jobs: PrintJob[];
  onRefresh: () => void;
}

export const PrintHistoryPage: React.FC<PrintHistoryPageProps> = ({ jobs, onRefresh }) => {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [jobEvents, setJobEvents] = useState<PrintJobEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);

  const historyJobs = jobs.filter((j) =>
    ['COMPLETED', 'SIMULATED_COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
  );

  const filteredJobs = historyJobs.filter((job) => {
    const matchesSearch = job.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewEvents = async (job: PrintJob) => {
    setSelectedJob(job);
    setLoadingEvents(true);
    try {
      const data = await api.getJob(job.id);
      setJobEvents(data.events || []);
    } catch (e) {
      setJobEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await api.retryJob(jobId);
      toast.success('Job re-queued for transmission to phone');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to retry job');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Print History & Audit Log</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Historical record of all physical and simulated print executions with timestamped telemetry
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh Log
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search document name or Job ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-gray-500" />}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Jobs' },
            { id: 'COMPLETED', label: 'Physical Print' },
            { id: 'SIMULATED_COMPLETED', label: 'Simulated' },
            { id: 'FAILED', label: 'Failed' },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#111827] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <Card className="overflow-hidden">
        {filteredJobs.length === 0 ? (
          <EmptyState
            icon={<History className="w-8 h-8" />}
            title="No Print History Matches"
            description="No past print jobs matched your current search and filter criteria."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document / Job ID</TableHead>
                <TableHead>Gateway & Mode</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Settings</TableHead>
                <TableHead>Status & Verification</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => {
                const isWindows = job.gatewayType === 'WINDOWS_HOST';
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium text-white max-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div>
                          <span className="block truncate font-bold text-gray-100">{job.originalName}</span>
                          <span className="block text-[11px] text-gray-500 font-mono">{job.id}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold w-fit ${isWindows ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                          {isWindows ? <Laptop className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          {isWindows ? 'Mode A: Windows Laptop' : 'Mode B: Android Phone'}
                        </span>
                        <span className="text-[11px] text-gray-400">Canon PIXMA MG2570S</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 whitespace-nowrap text-xs">
                      {new Date(job.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-gray-400 whitespace-nowrap text-xs">
                      {job.options.copies}x • {job.options.paperSize} • {job.options.colorMode}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} isSimulated={job.isSimulated} />
                      {job.errorMessage && (
                        <span className="block text-[11px] text-red-400 mt-1 max-w-xs truncate">
                          {job.errorMessage}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleViewEvents(job)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Audit
                        </Button>
                        {job.status === 'FAILED' && (
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => handleRetry(job.id)}
                            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Event Timeline Modal */}
      {selectedJob && (
        <Modal
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title="Job Event Audit Trail"
          description={`Telemetry timeline for ${selectedJob.id}`}
          footer={
            <Button variant="secondary" size="sm" onClick={() => setSelectedJob(null)}>
              Close Audit Trail
            </Button>
          }
        >
          <div className="text-xs space-y-3 max-h-96 overflow-y-auto pr-1">
            {loadingEvents ? (
              <div className="p-8 text-center text-gray-400">Loading timeline...</div>
            ) : jobEvents.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No telemetry events logged for this job.</div>
            ) : (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                {jobEvents.map((evt, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-[#111827]" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{evt.status} ({evt.progressPercent}%)</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-400 mt-0.5">{evt.message || 'Stage transition recorded'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
