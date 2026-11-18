import React from 'react';
import { AssetStatus, STATUS_COLORS, STATUS_LABELS } from '../../types';

const DOT_COLORS: Record<AssetStatus, string> = {
  DANG_SU_DUNG: 'bg-emerald-500',
  HONG: 'bg-rose-500',
  KHONG_SU_DUNG: 'bg-slate-400',
  CHO_THANH_LY: 'bg-amber-500',
  DA_THANH_LY: 'bg-slate-500',
  BAO_TRI: 'bg-orange-500',
  CHO_PHAN_BO: 'bg-blue-500',
};

interface StatusBadgeProps {
  status: AssetStatus | string;
  compact?: boolean;
  className?: string;
}

export default function StatusBadge({ status, compact = false, className = '' }: StatusBadgeProps) {
  const key = status as AssetStatus;
  const label = STATUS_LABELS[key] || status;
  const colorClass = STATUS_COLORS[key] || 'bg-slate-100 text-slate-700 border border-slate-200';
  const dotClass = DOT_COLORS[key] || 'bg-slate-400';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'
      } ${colorClass} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
