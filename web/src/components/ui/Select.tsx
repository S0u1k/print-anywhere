import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  children,
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
      <div className="relative">
        <select
          id={generatedId}
          className={`w-full bg-[#162032] border rounded-lg px-3.5 py-2 text-sm text-gray-100 transition-colors focus:outline-none focus:ring-1 appearance-none cursor-pointer ${
            error
              ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-700/80 hover:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-red-400 mt-1 font-medium">{error}</p>}
      {!error && helperText && <p className="text-[11px] text-gray-500 mt-1">{helperText}</p>}
    </div>
  );
};
