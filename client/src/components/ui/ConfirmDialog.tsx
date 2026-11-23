import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback<ConfirmFn>((input) => {
    const options: ConfirmOptions = typeof input === 'string' ? { message: input } : input;
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const handleClose = useCallback(
    (result: boolean) => {
      if (!pending) return;
      pending.resolve(result);
      setPending(null);
    },
    [pending]
  );

  useEffect(() => {
    if (!pending) return;
    cancelBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pending, handleClose]);

  const variant = pending?.options.variant || 'danger';
  const Icon = variant === 'danger' ? Trash2 : variant === 'warning' ? AlertTriangle : HelpCircle;
  const iconWrap =
    variant === 'danger'
      ? 'bg-rose-50 text-rose-600 border border-rose-100'
      : variant === 'warning'
      ? 'bg-amber-50 text-amber-600 border border-amber-100'
      : 'bg-blue-50 text-blue-600 border border-blue-100';
  const confirmBtnClass =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-blue-700 hover:bg-blue-800 text-white';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="print-hidden fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => handleClose(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6"
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${iconWrap}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  id="confirm-dialog-title"
                  className="font-heading text-base font-semibold text-slate-900"
                >
                  {pending.options.title || 'Xác nhận thao tác'}
                </h3>
                <p id="confirm-dialog-desc" className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {pending.options.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                {pending.options.cancelLabel || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium shadow-xs transition cursor-pointer ${confirmBtnClass}`}
              >
                {pending.options.confirmLabel || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
