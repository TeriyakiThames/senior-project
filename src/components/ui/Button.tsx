import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
}

const variantStyles = {
  primary:
    'bg-line-green text-white hover:bg-line-green-dark active:bg-line-green-dark focus:ring-line-green',
  secondary:
    'bg-gray-100 text-senior-text hover:bg-gray-200 active:bg-gray-200 focus:ring-gray-400',
  danger: 'bg-senior-danger text-white hover:bg-red-600 active:bg-red-600 focus:ring-red-400',
};

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`min-h-touch min-w-[48px] px-6 rounded-xl font-semibold text-senior-sm transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
