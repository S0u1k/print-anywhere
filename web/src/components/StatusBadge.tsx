import React from 'react';
import { JobStatus } from '../types';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Printer, Cpu, FileText, Send, Radio, UploadCloud, Check, Laptop } from 'lucide-react';

interface StatusBadgeProps {
  status: JobStatus;
  isSimulated?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, isSimulated }) => {
  switch (status) {
    case 'CREATED':
    case 'UPLOADING':
    case 'UPLOADED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-950/60 text-blue-300 border border-blue-800/50">
          <UploadCloud className="w-3.5 h-3.5" />
          Uploaded
        </span>
      );
    case 'QUEUED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
          <Clock className="w-3.5 h-3.5" />
          Queued
        </span>
      );
    case 'DISPATCHED':
    case 'SENT_TO_DEVICE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-800/50">
          <Send className="w-3.5 h-3.5" />
          Dispatched
        </span>
      );
    case 'RECEIVED_BY_GATEWAY':
    case 'RECEIVED_BY_DEVICE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
          <Radio className="w-3.5 h-3.5" />
          Gateway Received
        </span>
      );
    case 'VALIDATING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-950/60 text-blue-300 border border-blue-800/50">
          <Clock className="w-3.5 h-3.5" />
          Validating
        </span>
      );
    case 'RENDERING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-800/50">
          <Cpu className="w-3.5 h-3.5 animate-spin" />
          Rendering
        </span>
      );
    case 'SUBMITTED_TO_PRINTER':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/50">
          <Printer className="w-3.5 h-3.5" />
          Submitted
        </span>
      );
    case 'SPOOLING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-800/50">
          <Laptop className="w-3.5 h-3.5 animate-pulse" />
          Spooling
        </span>
      );
    case 'PRINTING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-950/60 text-purple-300 border border-purple-800/50">
          <Printer className="w-3.5 h-3.5 animate-pulse" />
          Printing
        </span>
      );
    case 'DATA_ACCEPTED':
    case 'SPOOLER_COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-950/60 text-teal-300 border border-teal-800/50">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Spooler Complete
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Physical Print Complete
        </span>
      );
    case 'SIMULATED_COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-700/60">
          <Cpu className="w-3.5 h-3.5 text-amber-400" />
          Simulated Complete
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-950/60 text-red-300 border border-red-800/50">
          <AlertTriangle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800/60 text-gray-400 border border-gray-700/50">
          <XCircle className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    case 'STATUS_UNKNOWN':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-800/60 text-gray-400 border border-gray-700/50">
          <Clock className="w-3.5 h-3.5" />
          Status Unknown
        </span>
      );
  }
};
