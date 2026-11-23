import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

export interface RowActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
}

interface RowActionMenuProps {
  primary?: {
    label?: string;
    title?: string;
    icon: React.ReactNode;
    onClick: () => void;
    tone?: 'blue' | 'amber' | 'emerald' | 'slate';
  };
  items?: RowActionItem[];
}

const TONE_MAP = {
  blue: 'text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 border-blue-200/80',
  amber: 'text-amber-800 bg-amber-50/70 hover:bg-amber-100/80 border-amber-200/80',
  emerald: 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-200/80',
  slate: 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200',
};

export default function RowActionMenu({ primary, items = [] }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const visibleItems = items.filter((item) => !item.hidden);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = visibleItems.length * 36 + 12;
    const openUp = rect.bottom + estimatedHeight > window.innerHeight - 16;
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(12, rect.right - 180),
      openUp,
    });
    setOpen(true);
  };

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {primary && (
        <button
          type="button"
          onClick={primary.onClick}
          title={primary.title || primary.label}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition cursor-pointer whitespace-nowrap ${
            TONE_MAP[primary.tone || 'slate']
          }`}
        >
          {primary.icon}
          {primary.label && <span className="hidden xl:inline">{primary.label}</span>}
        </button>
      )}

      {visibleItems.length > 0 && (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Thao tác khác"
          className={`p-1.5 rounded-md border transition cursor-pointer ${
            open
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )}

      {open &&
        coords &&
        createPortal(
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: 180,
              transform: coords.openUp ? 'translateY(-100%)' : undefined,
            }}
            className="z-[100] bg-white rounded-xl border border-slate-200 shadow-xl py-1.5"
          >
            {visibleItems.map((item, idx) => (
              <button
                key={idx}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 transition cursor-pointer ${
                  item.danger
                    ? 'text-rose-700 hover:bg-rose-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
