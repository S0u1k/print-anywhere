import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}) => {
  const generatedId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={generatedId} className="block text-xs font-semibold text-gray-300 tracking-wide">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-gray-500">
            {leftIcon}
          </div>
        )}
        <input
          id={generatedId}
          className={`w-full bg-[#162032] border rounded-lg py-2 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:outline-none focus:ring-1 ${
            leftIcon ? 'pl-9' : 'pl-3.5'
          } ${rightIcon ? 'pr-9' : 'pr-3.5'} ${
            error
              ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-700/80 hover:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
          } disabled:bg-[#0B0F19] disabled:border-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 flex items-center text-gray-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-400 mt-1 font-medium">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-gray-500 mt-1">{helperText}</p>}
    </div>
  );
};
