import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../lib/api';
import { Asset, MANAGING_UNIT_LABELS, STATUS_LABELS, TCHC_GROUP_META } from '../types';
import { useToast } from './ui/Toast';
import StatusBadge from './ui/StatusBadge';
import {
  X,
  ExternalLink,
  Edit,
  MapPin,
  User,
  Building2,
  Cpu,
  Calendar,
  Wrench,
  ArrowLeftRight,
  QrCode,
  Layers,
  Loader2,
} from 'lucide-react';

interface AssetQuickDrawerProps {
  assetId: number | null;
  canManage: boolean;
  onClose: () => void;
  onNavigate: (to: string) => void;
}

const formatVnd = (val?: number | null) => {
  if (!val) return '0 đ';
  return `${Math.round(val).toLocaleString('vi-VN')} đ`;
};

export default function AssetQuickDrawer({
  assetId,
  canManage,
  onClose,
  onNavigate,
}: AssetQuickDrawerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assetId, onClose]);

  const { data: asset, isLoading } = useQuery<Asset>({
    queryKey: ['asset', assetId],
    queryFn: () => apiGet(`/assets/${assetId}`),
    enabled: !!assetId,
  });

  const { data: qrData } = useQuery<{ qrCode: string }>({
    queryKey: ['asset-qr', assetId],
    queryFn: () => apiGet(`/assets/${assetId}/qr`),
    enabled: !!assetId,
  });

  const handleQuickStatusChange = async (nextStatus: string) => {
    if (!asset || !canManage || nextStatus === asset.status) return;
    setUpdatingStatus(true);
    try {
      await apiPut(`/assets/${asset.id}`, { status: nextStatus });
      toast.success(`Đã chuyển trạng thái thành "${STATUS_LABELS[nextStatus as Asset['status']] || nextStatus}"`);
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-by-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-recent-assets'] });
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật trạng thái thiết bị');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!assetId) return null;

  return (
    <div
      className="print-hidden fixed inset-0 z-[70] flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Xem nhanh thông tin tài sản"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col"
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-xs font-medium px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 truncate">
              {asset?.assetCode || `#${assetId}`}
            </span>
            {asset && <StatusBadge status={asset.status} />}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng xem nhanh"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading || !asset ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded-lg w-3/4" />
              <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 bg-slate-100 rounded-xl" />
                <div className="h-20 bg-slate-100 rounded-xl" />
              </div>
              <div className="h-32 bg-slate-100 rounded-xl" />
            </div>
          ) : (
            <>
              {/* Title & Core Meta */}
              <div>
                <h2 className="font-heading text-lg font-semibold text-slate-900 leading-snug">
                  {asset.name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-xs text-slate-500">
                  {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}
                    >
                      {TCHC_GROUP_META[asset.assetGroup].label}
                    </span>
                  )}
                  {asset.oldAssetCode && (
                    <span>
                      Mã cũ: <span className="font-mono text-slate-700">{asset.oldAssetCode}</span>
                    </span>
                  )}
                  {asset.category?.name && (
                    <span className="inline-flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {asset.category.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Nguyên giá</div>
                  <div className="font-heading text-sm font-semibold text-slate-900 tabular-nums mt-0.5">
                    {formatVnd(asset.originalPrice)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Giá trị còn lại</div>
                  <div className="font-heading text-sm font-semibold text-blue-700 tabular-nums mt-0.5">
                    {formatVnd(asset.currentValue ?? asset.originalPrice)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Năm sử dụng</div>
                  <div className="font-heading text-sm font-semibold text-slate-800 tabular-nums mt-0.5">
                    {asset.yearInUse || '—'}
                  </div>
                </div>
              </div>

              {/* Inline Quick Status Update */}
              {canManage && (
                <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200/70 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-heading font-semibold text-slate-700">
                      Cập nhật nhanh trạng thái
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Thay đổi trực tiếp mà không cần rời danh sách
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />}
                    <select
                      value={asset.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleQuickStatusChange(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer disabled:opacity-60"
                    >
                      <option value="DANG_SU_DUNG">Đang sử dụng</option>
                      <option value="BAO_TRI">Đang bảo trì</option>
                      <option value="HONG">Đang hỏng</option>
                      <option value="CHO_THANH_LY">Đề nghị thanh lý</option>
                      <option value="KHONG_SU_DUNG">Không sử dụng</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Technical Configuration / Specs */}
              {(asset.specifications || asset.manufacturer || asset.countryOfOrigin || asset.decisionNumber) && (
                <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-heading font-semibold text-slate-700">
                    <Cpu className="w-4 h-4 text-blue-600" />
                    <span>Thông số & Cấu hình thiết bị</span>
                  </div>
                  {asset.specifications && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {asset.specifications}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    {asset.manufacturer && (
                      <div>
                        <span className="text-slate-400">Hãng / NSX:</span>{' '}
                        <span className="text-slate-700 font-medium">{asset.manufacturer}</span>
                      </div>
                    )}
                    {asset.countryOfOrigin && (
                      <div>
                        <span className="text-slate-400">Nước SX:</span>{' '}
                        <span className="text-slate-700 font-medium">{asset.countryOfOrigin}</span>
                      </div>
                    )}
                    {asset.decisionNumber && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Số quyết định:</span>{' '}
                        <span className="font-mono text-slate-700">{asset.decisionNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Ownership & Location */}
              <div className="rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                <div className="p-3.5 flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Khoa/Phòng & Khối quản lý</div>
                    <div className="text-xs font-medium text-slate-800 mt-0.5">
                      {asset.department?.name || 'Chưa phân bổ khoa'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {asset.managingUnit ? MANAGING_UNIT_LABELS[asset.managingUnit] : 'Chung'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Vị trí đặt thiết bị</div>
                    <div className="text-xs font-medium text-slate-800 mt-0.5">
                      {[asset.locationDetail, asset.location, asset.floor]
                        .filter(Boolean)
                        .join(' · ') || 'Chưa cập nhật vị trí'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Người sử dụng trực tiếp</div>
                    <div className="text-xs font-medium text-slate-800 mt-0.5">
                      {asset.assignedTo || 'Chưa giao cá nhân'}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400">Ghi chú & Nguồn kinh phí</div>
                    <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      {[asset.fundingSource, asset.note].filter(Boolean).join(' · ') ||
                        'Không có ghi chú bổ sung.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Preview Card */}
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden p-1">
                  {qrData?.qrCode ? (
                    <img
                      src={qrData.qrCode}
                      alt={`QR ${asset.assetCode}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <QrCode className="w-8 h-8 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-heading text-xs font-semibold text-slate-800">
                    Tem định danh QR thiết bị
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Quét để kiểm kê nhanh, xem lý lịch sửa chữa hoặc điều chuyển khoa.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate(`/assets/${asset.id}`)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    <span>Mở trang chi tiết & in nhãn</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Sticky Footer */}
        {asset && (
          <div className="px-5 py-3.5 border-t border-slate-200/80 bg-white flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(`/assets/${asset.id}`)}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Hồ sơ đầy đủ</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => onNavigate(`/assets/${asset.id}/edit`)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate(`/maintenance?assetId=${asset.id}`)}
              title="Lập phiếu báo hỏng"
              className="flex items-center justify-center gap-1 px-3 py-2.5 border border-amber-200 bg-amber-50/70 hover:bg-amber-100/70 text-amber-800 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Báo hỏng</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(`/transfers?assetId=${asset.id}`)}
              title="Điều chuyển thiết bị"
              className="flex items-center justify-center gap-1 px-3 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Điều chuyển</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
