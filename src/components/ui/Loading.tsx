interface LoadingProps {
  message?: string;
  className?: string;
}

export function Loading({ message = 'กำลังโหลด...', className = '' }: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center min-h-[60vh] ${className}`}
    >
      <div className="text-center">
        <div
          className="w-12 h-12 border-4 border-line-green border-t-transparent rounded-full animate-spin mx-auto mb-4"
          aria-hidden="true"
        />
        <p className="text-senior-muted text-senior-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
