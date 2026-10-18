import type { KeyboardEvent, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? handleKeyDown : undefined}
      className={`bg-white rounded-card p-5 shadow-sm border border-gray-100 ${
        onClick
          ? 'cursor-pointer active:scale-[0.98] transition-transform focus:outline-none focus:ring-2 focus:ring-line-green'
          : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
