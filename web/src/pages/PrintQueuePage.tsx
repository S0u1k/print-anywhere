import React, { useState } from 'react';
import { PrintJob } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import {
  ListOrdered,
  FileText,
  Clock,
  XCircle,
  RefreshCw,
  Cpu,
  Printer,
  Radio,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useToast } from '../components/ui/Toast';

export interface PrintQueuePageProps {
  jobs: PrintJob[];
  onRefresh: () => void;
  onNavigateToPrint?: () => void;
}

export const PrintQueuePage: React.FC<PrintQueuePageProps> = ({
  jobs,
  onRefresh,
  onNavigateToPrint,
}) => {
  const toast = useToast();
  const [jobToCancel, setJobToCancel] = useState<PrintJob | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const activeQueue = jobs.filter(
    (j) => !['COMPLETED', 'SIMULATED_COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)
  );

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;
    setIsCancelling(true);
    try {
      await api.cancelJob(jobToCancel.id);
      toast.success(`Job "${jobToCancel.originalName}" cancelled successfully`);
      setJobToCancel(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusDescription = (job: PrintJob) => {
    const isWindows = job.gatewayType === 'WINDOWS_HOST';
    switch (job.status) {
      case 'QUEUED':
        return 'Job queued in Cloud Relay, awaiting gateway connection...';
      case 'DISPATCHED':
      case 'SENT_TO_DEVICE':
        return isWindows ? 'Dispatched to Windows Laptop Print Agent...' : 'Dispatched to Android Phone Gateway...';
      case 'RECEIVED_BY_GATEWAY':
      case 'RECEIVED_BY_DEVICE':
        return isWindows ? 'PDF downloaded by Windows Laptop Agent' : 'PDF received by Android Gateway phone';
      case 'VALIDATING':
        return 'Validating PDF document & verifying printer readiness...';
      case 'SUBMITTED_TO_PRINTER':
        return isWindows ? 'Submitted to Canon Windows Driver on USB001' : 'Preparing Canon BJL job sequence';
      case 'SPOOLING':
        return 'Spooling document in Windows print queue (USB001)...';
      case 'RENDERING':
        return 'Android PdfRenderer generating 300/600 DPI bitmap swaths...';
      case 'PRINTING':
        return isWindows ? 'Windows Spooler transmitting swaths to Canon printer...' : 'USB Bulk OUT streaming Canon BJRaster3 swaths...';
      case 'DATA_ACCEPTED':
      case 'SPOOLER_COMPLETED':
        return 'All document bytes accepted by Canon PIXMA MG2570S';
      default:
        return 'Processing print job...';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Active Print Queue</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time multi-gateway pipeline monitoring across Windows Laptop and Android Phone gateways.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-950 text-blue-300 border border-blue-800">
            {activeQueue.length} Active {activeQueue.length === 1 ? 'Job' : 'Jobs'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Queue
          </Button>
        </div>
      </div>

      {activeQueue.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="w-8 h-8" />}
          title="Print Queue is Empty"
          description="All submitted print jobs have finished processing. Submit a new document from the Print Documents tab."
          actionLabel={onNavigateToPrint ? 'Print Document' : undefined}
          onAction={onNavigateToPrint}
        />
      ) : (
        <div className="space-y-4">
          {activeQueue.map((job) => {
            const isWindows = job.gatewayType === 'WINDOWS_HOST';
            return (
              <Card key={job.id} className="p-5 space-y-4 hover:border-gray-700 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{job.originalName}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${isWindows ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'}`}>
                          {isWindows ? <Laptop className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
                          {isWindows ? 'Mode A: Windows Laptop' : 'Mode B: Android Phone'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                        <span className="font-mono text-[11px] text-gray-500">ID: {job.id}</span>
                        <span>•</span>
                        <span>{(job.fileSize / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>
                          {job.options.copies} {job.options.copies === 1 ? 'copy' : 'copies'}
                        </span>
                        <span>•</span>
                        <span>
                          {job.options.paperSize} ({job.options.colorMode})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <StatusBadge status={job.status} isSimulated={job.isSimulated} />
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-red-400 hover:text-red-300 hover:bg-red-950/40"
                      onClick={() => setJobToCancel(job)}
                      leftIcon={<XCircle className="w-3.5 h-3.5" />}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>

                {/* Progress Bar & Substage */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-300 font-medium">
                      {getStatusDescription(job)}
                    </span>
                    <span className="text-white font-mono font-bold">{job.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-[#162032] rounded-full h-2.5 overflow-hidden border border-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out shadow-sm ${isWindows ? 'bg-sky-500 shadow-sky-500' : 'bg-emerald-500 shadow-emerald-500'}`}
                      style={{ width: `${Math.max(5, job.progressPercent)}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {jobToCancel && (
        <ConfirmDialog
          isOpen={!!jobToCancel}
          onClose={() => setJobToCancel(null)}
          onConfirm={handleConfirmCancel}
          title="Cancel Print Job"
          message={`Are you sure you want to cancel print job "${jobToCancel.originalName}"? Any partially spooled data will be halted.`}
          confirmLabel="Cancel Job"
          variant="danger"
          isLoading={isCancelling}
        />
      )}
    </div>
  );
};
