import type { ReactNode } from 'react';

export interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <div className={`min-h-screen bg-senior-bg p-4 pb-24 max-w-lg mx-auto ${className}`}>
      {children}
    </div>
  );
}
