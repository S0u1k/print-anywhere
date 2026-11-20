import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  subMessage = 'Synchronizing with Cloud Relay',
  className = '',
}) => {
  return (
    <div className={`p-12 text-center flex flex-col items-center justify-center ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <h3 className="text-sm font-semibold text-white tracking-tight">{message}</h3>
      {subMessage && <p className="text-xs text-gray-400 mt-1">{subMessage}</p>}
    </div>
  );
};
