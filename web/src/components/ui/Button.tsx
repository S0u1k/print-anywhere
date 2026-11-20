import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F19] disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-900/30 border border-blue-500/30 focus:ring-blue-500 active:bg-blue-700',
    secondary: 'bg-[#1F2937] hover:bg-[#374151] text-gray-200 border border-gray-700/80 focus:ring-gray-600 active:bg-[#111827]',
    outline: 'bg-transparent hover:bg-gray-800/60 text-gray-300 border border-gray-700/80 hover:border-gray-600 focus:ring-gray-600',
    ghost: 'bg-transparent hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 border border-transparent focus:ring-gray-700',
    danger: 'bg-red-600 hover:bg-red-500 text-white shadow-sm shadow-red-950/40 border border-red-500/30 focus:ring-red-500 active:bg-red-700',
  };

  const sizeClasses = {
    xs: 'text-xs px-2.5 py-1 gap-1.5',
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};
