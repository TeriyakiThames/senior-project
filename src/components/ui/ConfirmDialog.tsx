'use client';

import { useEffect, type ReactNode } from 'react';
import Image from 'next/image';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  contentPreview?: string | ReactNode;
  warningText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  confirmIcon?: ReactNode;
  badgeBgColor?: string;
  badgeIcon?: ReactNode;
  confirmButtonColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  contentPreview,
  warningText,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  confirmVariant = 'danger',
  confirmIcon,
  badgeBgColor = 'bg-[#FEE2E2]',
  badgeIcon,
  confirmButtonColor,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';
  const resolvedButtonBg =
    confirmButtonColor ||
    (isDanger ? 'bg-[#942626] hover:bg-[#831f1f]' : 'bg-[#3E81F7] hover:bg-[#3474E0]');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#21215C]/40 backdrop-blur-xs transition-opacity"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl flex flex-col text-center transform transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Circular Badge matching Figma Image 2 */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${badgeBgColor}`}
        >
          {badgeIcon || (
            <Image
              src="/icons/trashbin.svg"
              alt=""
              width={28}
              height={28}
              unoptimized
              aria-hidden="true"
            />
          )}
        </div>

        {/* Title */}
        <h2 id="confirm-dialog-title" className="text-2xl font-bold text-[#21215C]">
          {title}
        </h2>

        {/* Preview box if contentPreview or message is provided */}
        {(contentPreview || message) && (
          <div
            id="confirm-dialog-desc"
            className="bg-[#F0F4F9] rounded-2xl p-4 my-4 text-[#21215C] text-lg font-medium leading-relaxed break-words text-left"
          >
            {contentPreview || message}
          </div>
        )}

        {/* Warning text */}
        {warningText && (
          <p className="text-senior-base text-[#7D84A3] text-center mb-6">{warningText}</p>
        )}

        {children}

        {/* Vertical Stack Action Buttons matching Figma Image 2 */}
        <div className="flex flex-col gap-3 mt-1">
          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full ${resolvedButtonBg} text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 min-h-[52px] text-lg active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-[#942626]`}
          >
            {isDanger &&
              (confirmIcon || (
                <Image
                  src="/icons/trashbin.svg"
                  alt=""
                  width={18}
                  height={18}
                  unoptimized
                  className="brightness-0 invert"
                  aria-hidden="true"
                />
              ))}
            <span>{confirmLabel}</span>
          </button>

          {/* Secondary Action (Cancel) Button */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full border-2 border-[#7D84A3] bg-white text-[#21215C] font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center hover:bg-gray-50 active:scale-[0.98] transition-all min-h-[52px] text-lg focus:outline-none focus:ring-2 focus:ring-[#7D84A3]"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
