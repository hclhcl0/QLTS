import React, { useCallback, useEffect, useState } from 'react';
import { Columns, AlignJustify, List, Check, Loader2 } from 'lucide-react';

export type TableDensity = 'compact' | 'comfortable';

export interface TableColumnMeta {
  key: string;
  label: string;
  hideable?: boolean;
}

export function useTablePrefs(storageKey: string, defaultHidden: string[] = []) {
  const [density, setDensityState] = useState<TableDensity>(() => {
    try {
      const saved = localStorage.getItem('qlts_table_density');
      return saved === 'comfortable' ? 'comfortable' : 'compact';
    } catch {
      return 'compact';
    }
  });

  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`qlts_table_cols_${storageKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return defaultHidden;
  });

  const setDensity = useCallback((next: TableDensity) => {
    setDensityState(next);
    try {
      localStorage.setItem('qlts_table_density', next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleCol = useCallback(
    (key: string) => {
      setHiddenCols((prev) => {
        const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        try {
          localStorage.setItem(`qlts_table_cols_${storageKey}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [storageKey]
  );

  const isColVisible = useCallback((key: string) => !hiddenCols.includes(key), [hiddenCols]);

  const cellPy = density === 'compact' ? 'py-2' : 'py-3';
  const headPy = density === 'compact' ? 'py-2.5' : 'py-3';

  return { density, setDensity, hiddenCols, toggleCol, isColVisible, cellPy, headPy };
}

interface DataTableShellProps {
  title?: string;
  totalCount?: number;
  countLabel?: string;
  density: TableDensity;
  onDensityChange: (d: TableDensity) => void;
  columns?: TableColumnMeta[];
  hiddenCols?: string[];
  onToggleCol?: (key: string) => void;
  toolbarExtra?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export default function DataTableShell({
  title,
  totalCount,
  countLabel = 'bản ghi',
  density,
  onDensityChange,
  columns,
  hiddenCols = [],
  onToggleCol,
  toolbarExtra,
  loading = false,
  isEmpty = false,
  emptyMessage = 'Không có dữ liệu phù hợp với bộ lọc hiện tại.',
  children,
  className = '',
}: DataTableShellProps) {
  const [colsOpen, setColsOpen] = useState(false);

  const hideableCols = columns?.filter((c) => c.hideable) || [];

  useEffect(() => {
    if (!colsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColsOpen(false);
    };
    const onClick = () => setColsOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [colsOpen]);

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden ${className}`}
    >
      {/* Unified Compact Table Utility Bar */}
      <div className="px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
          {title && (
            <span className="font-heading font-semibold text-slate-800 truncate">{title}</span>
          )}
          {typeof totalCount === 'number' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium tabular-nums shrink-0">
              {totalCount.toLocaleString('vi-VN')} {countLabel}
            </span>
          )}
          {loading && (
            <span className="inline-flex items-center gap-1 text-blue-700 text-xs shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang tải...</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {toolbarExtra}

          {/* Column Visibility Toggle (desktop table only) */}
          {hideableCols.length > 0 && onToggleCol && (
            <div className="hidden md:block relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setColsOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 min-h-[34px] sm:min-h-0 px-2.5 py-1.5 rounded-md border text-xs font-medium transition cursor-pointer ${
                  colsOpen || hiddenCols.length > 0
                    ? 'border-blue-200 bg-blue-50/70 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title="Ẩn / hiện các cột mở rộng"
                aria-label="Ẩn / hiện các cột mở rộng"
              >
                <Columns className="w-3.5 h-3.5" />
                {hiddenCols.length > 0 && (
                  <span className="text-[10px] px-1 rounded bg-blue-700 text-white tabular-nums">
                    {hideableCols.length - hiddenCols.length}/{hideableCols.length}
                  </span>
                )}
              </button>

              {colsOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-40">
                  <div className="px-3 py-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-400">
                    Cột hiển thị mở rộng
                  </div>
                  {hideableCols.map((col) => {
                    const checked = !hiddenCols.includes(col.key);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => onToggleCol(col.key)}
                        className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                      >
                        <span>{col.label}</span>
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            checked
                              ? 'bg-blue-700 border-blue-700 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && <Check className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Compact / Comfortable Density Switch (desktop table only) */}
          <div
            role="group"
            aria-label="Mật độ dòng bảng"
            className="hidden md:inline-flex p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80"
          >
            <button
              type="button"
              onClick={() => onDensityChange('compact')}
              title="Hiển thị gọn (nhiều dòng hơn)"
              aria-label="Hiển thị gọn"
              className={`inline-flex items-center gap-1 min-h-[30px] sm:min-h-0 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                density === 'compact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDensityChange('comfortable')}
              title="Hiển thị thoáng"
              aria-label="Hiển thị thoáng"
              className={`inline-flex items-center gap-1 min-h-[30px] sm:min-h-0 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                density === 'comfortable'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Body */}
      {isEmpty && !loading ? (
        <div className="py-12 px-4 text-center text-sm text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">{children}</div>
      )}
    </div>
  );
}
