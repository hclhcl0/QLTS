import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { wrap: string; iconClass: string; Icon: React.ElementType }> = {
  success: {
    wrap: 'border-emerald-200 bg-white text-slate-800',
    iconClass: 'text-emerald-600 bg-emerald-50',
    Icon: CheckCircle2,
  },
  error: {
    wrap: 'border-rose-200 bg-white text-slate-800',
    iconClass: 'text-rose-600 bg-rose-50',
    Icon: AlertCircle,
  },
  warning: {
    wrap: 'border-amber-200 bg-white text-slate-800',
    iconClass: 'text-amber-600 bg-amber-50',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'border-blue-200 bg-white text-slate-800',
    iconClass: 'text-blue-600 bg-blue-50',
    Icon: Info,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', title?: string, duration = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-4), { id, title, message, variant, duration }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    show,
    success: (message, title) => show(message, 'success', title),
    error: (message, title) => show(message, 'error', title, 6000),
    warning: (message, title) => show(message, 'warning', title, 5000),
    info: (message, title) => show(message, 'info', title),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Thông báo hệ thống"
        className="print-hidden fixed bottom-4 right-4 z-[90] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map((item) => {
          const style = VARIANT_STYLES[item.variant];
          const Icon = style.Icon;
          return (
            <div
              key={item.id}
              role={item.variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-lg transition-all ${style.wrap}`}
            >
              <div className={`p-1.5 rounded-xl shrink-0 ${style.iconClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                {item.title && (
                  <p className="font-heading text-sm font-semibold text-slate-900 leading-snug">
                    {item.title}
                  </p>
                )}
                <p className="text-[13px] text-slate-700 leading-snug break-words">{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Đóng thông báo"
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
