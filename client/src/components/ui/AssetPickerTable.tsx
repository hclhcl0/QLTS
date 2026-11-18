import React from 'react';
import { Building2, Check, MapPin, PackageOpen, User } from 'lucide-react';
import { TCHC_GROUP_META } from '../../types';

export interface PickerAssetItem {
  id: number | string;
  assetCode?: string | null;
  name: string;
  specifications?: string | null;
  department?: { id?: number | string; name?: string } | null;
  locationDetail?: string | null;
  floor?: string | null;
  assignedTo?: string | null;
  managingUnit?: string | null;
  assetGroup?: string | null;
  yearInUse?: number | string | null;
  usageYear?: number | string | null;
  originalPrice?: number | string | null;
  quantity?: number | null;
  status?: string | null;
}

interface AssetPickerTableProps<T extends PickerAssetItem> {
  mode: 'single' | 'multi';
  assets: T[];
  selectedId?: string | number;
  selectedIds?: Array<number | string>;
  onSelect?: (asset: T) => void;
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
  showDepartment?: boolean;
  showPrice?: boolean;
  accentColor?: 'blue' | 'emerald';
  emptyMessage?: string;
  maxHeightClass?: string;
}

function formatPriceVnd(value: number | string | null | undefined): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `${num.toLocaleString('vi-VN')} đ`;
}

export function AssetPickerTable<T extends PickerAssetItem>({
  mode,
  assets,
  selectedId,
  selectedIds = [],
  onSelect,
  onToggle,
  onToggleAll,
  showDepartment = true,
  showPrice = false,
  accentColor = 'blue',
  emptyMessage = 'Không tìm thấy tài sản phù hợp',
  maxHeightClass = 'max-h-60',
}: AssetPickerTableProps<T>) {
  const selectedSet = new Set(selectedIds.map((id) => String(id)));
  const isEmerald = accentColor === 'emerald';

  const activeRowCls = isEmerald
    ? 'bg-emerald-50/75 hover:bg-emerald-50'
    : 'bg-blue-50/75 hover:bg-blue-50';

  const activeBoxCls = isEmerald
    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
    : 'bg-blue-600 border-blue-600 text-white shadow-xs';

  const codeBadgeCls = isEmerald
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
    : 'bg-blue-50 text-blue-700 border-blue-200/80';

  const allSelected =
    mode === 'multi' && assets.length > 0 && assets.every((a) => selectedSet.has(String(a.id)));

  if (assets.length === 0) {
    return (
      <div className="border border-slate-200 rounded-xl bg-slate-50/50 py-8 px-4 text-center">
        <PackageOpen className="w-7 h-7 text-slate-300 mx-auto mb-1.5" strokeWidth={1.6} />
        <p className="text-xs font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs`}>
      <div className={`${maxHeightClass} overflow-y-auto overflow-x-auto`}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
            <tr className="text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-2 px-3 w-11 text-center whitespace-nowrap">
                {mode === 'multi' && onToggleAll ? (
                  <button
                    type="button"
                    onClick={onToggleAll}
                    title={allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    className={`w-4 h-4 rounded-md border inline-flex items-center justify-center transition-colors ${
                      allSelected
                        ? activeBoxCls
                        : 'bg-white border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {allSelected && <Check className="w-3 h-3" strokeWidth={2.5} />}
                  </button>
                ) : (
                  'Chọn'
                )}
              </th>
              <th className="py-2 px-3 whitespace-nowrap">Mã &amp; Tên thiết bị</th>
              <th className="py-2 px-3 whitespace-nowrap">
                {showDepartment ? 'Khoa · Vị trí · Người SD' : 'Vị trí · Người SD'}
              </th>
              <th className="py-2 px-3 text-right whitespace-nowrap">
                {showPrice ? 'Khối · Năm · Giá' : 'Khối · Năm SD'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {assets.map((asset) => {
              const isSelected =
                mode === 'multi'
                  ? selectedSet.has(String(asset.id))
                  : String(selectedId ?? '') === String(asset.id);

              const handleRowClick = () => {
                if (mode === 'multi') {
                  onToggle?.(Number(asset.id));
                } else {
                  onSelect?.(asset);
                }
              };

              return (
                <tr
                  key={asset.id}
                  onClick={handleRowClick}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? activeRowCls : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-2 px-3 text-center align-top pt-2.5">
                    {mode === 'multi' ? (
                      <span
                        className={`w-4 h-4 rounded-md border inline-flex items-center justify-center transition-colors ${
                          isSelected
                            ? activeBoxCls
                            : 'bg-white border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" strokeWidth={2.5} />}
                      </span>
                    ) : (
                      <span
                        className={`w-4 h-4 rounded-full border inline-flex items-center justify-center transition-colors ${
                          isSelected
                            ? isEmerald
                              ? 'border-emerald-600 bg-emerald-50'
                              : 'border-blue-600 bg-blue-50'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isEmerald ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}
                          />
                        )}
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-3 align-top">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md border font-mono text-[11px] font-medium whitespace-nowrap ${codeBadgeCls}`}
                      >
                        {asset.assetCode || `#${asset.id}`}
                      </span>
                      {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.2 rounded border text-[10px] font-medium whitespace-nowrap ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}
                        >
                          {TCHC_GROUP_META[asset.assetGroup].label}
                        </span>
                      )}
                      {asset.quantity && asset.quantity > 1 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px] whitespace-nowrap">
                          SL: {asset.quantity}
                        </span>
                      )}
                    </div>
                    <div
                      className="font-heading font-semibold text-slate-800 line-clamp-2 leading-snug break-words"
                      title={asset.name}
                    >
                      {asset.name}
                    </div>
                  </td>

                  <td className="py-2 px-3 align-top">
                    <div className="space-y-0.5 text-[11px] text-slate-600">
                      {showDepartment && asset.department?.name && (
                        <div className="flex items-center gap-1 font-medium text-slate-700 truncate max-w-[240px]">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{asset.department.name}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-500">
                        {(asset.locationDetail || asset.floor) && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{asset.locationDetail || asset.floor}</span>
                          </span>
                        )}
                        {asset.assignedTo && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{asset.assignedTo}</span>
                          </span>
                        )}
                        {!asset.department?.name &&
                          !asset.locationDetail &&
                          !asset.floor &&
                          !asset.assignedTo && <span className="text-slate-400">—</span>}
                      </div>
                    </div>
                  </td>

                  <td className="py-2 px-3 text-right align-top whitespace-nowrap">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {asset.managingUnit && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[10px]">
                          {asset.managingUnit === 'DUOC'
                            ? 'Khoa Dược'
                            : asset.managingUnit === 'CNTT'
                              ? 'Tổ CNTT'
                              : asset.managingUnit === 'TCHC'
                                ? 'TCHC'
                                : asset.managingUnit}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {asset.yearInUse || asset.usageYear
                          ? `${asset.yearInUse || asset.usageYear}`
                          : '—'}
                      </span>
                    </div>
                    {showPrice && (
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-700 tabular-nums">
                        {formatPriceVnd(asset.originalPrice)}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AssetPickerTable;
