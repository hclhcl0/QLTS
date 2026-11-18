import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Monitor,
  RefreshCw,
  Stethoscope,
  Building2,
  ArrowRight,
  Table2,
  BarChart3,
  Layers,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Plus,
  Search,
  QrCode,
  ClipboardCheck,
  Award,
  PanelRightOpen,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiGet } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Asset, TCHC_GROUP_META } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import AssetQuickDrawer from '../components/AssetQuickDrawer';

const DONUT_COLORS = ['#059669', '#1E40AF', '#D97706', '#EA580C', '#0D9488', '#64748B'];

interface DivisionCardProps {
  title: string;
  subtitle: string;
  badgeText: string;
  count: number;
  totalBase: number;
  healthyCount: number;
  issueCount?: number;
  unitText: string;
  accentClass: string;
  barColorClass: string;
  iconBg: string;
  icon: React.ElementType;
  onClick: () => void;
}

function DivisionCard({
  title,
  subtitle,
  badgeText,
  count,
  totalBase,
  healthyCount,
  issueCount = 0,
  unitText,
  accentClass,
  barColorClass,
  iconBg,
  icon: Icon,
  onClick,
}: DivisionCardProps) {
  const sharePct = totalBase > 0 ? Math.round((count / totalBase) * 100) : 0;
  const healthyPct = count > 0 ? Math.round((healthyCount / count) * 100) : 100;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left bg-white rounded-2xl border border-slate-200/80 border-l-4 ${accentClass} p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between w-full`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-heading text-[13px] font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">
                {title}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{badgeText}</div>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums shrink-0">
            {sharePct}%
          </span>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <div className="font-heading text-2xl font-bold text-slate-900 tabular-nums">
            {count.toLocaleString('vi-VN')}{' '}
            <span className="text-xs font-normal text-slate-400">{unitText}</span>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 tabular-nums">
            {healthyPct}% tốt
          </span>
        </div>

        {/* Visual Readiness Bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
            style={{ width: `${healthyPct}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">{subtitle}</span>
          {issueCount > 0 && (
            <span className="shrink-0 font-semibold text-rose-700 tabular-nums">
              {issueCount} cần XL
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CustomChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const label = item?.payload?.fullName || item?.payload?.name || item?.name || '';
  const value = item?.value ?? item?.payload?.count ?? 0;
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-lg border border-slate-700 text-xs">
      <div className="font-medium text-slate-200 max-w-[220px] leading-snug">{label}</div>
      <div className="font-heading font-bold text-sm text-white tabular-nums mt-0.5">
        {Number(value).toLocaleString('vi-VN')} thiết bị
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { density, setDensity, cellPy, headPy } = useTablePrefs('dashboard_recent');

  const [selectedUnitFilter, setSelectedUnitFilter] = useState('');
  const [tableScope, setTableScope] = useState<'ATTENTION' | 'ALL'>('ATTENTION');
  const [chartViewMode, setChartViewMode] = useState<'chart' | 'table'>('chart');
  const [quickViewAssetId, setQuickViewAssetId] = useState<number | null>(null);

  const isCntt = user?.role === 'MANAGER_CNTT';
  const isDuoc = user?.role === 'MANAGER_DUOC';
  const isTchc = user?.role === 'MANAGER_TCHC';
  const isDept = user?.role === 'DEPARTMENT';
  const isViewer = user?.role === 'VIEWER';
  const isAdmin = user?.role === 'ADMIN';
  const canManageAssets = isAdmin || isDuoc || isCntt || isTchc;
  const canAccessMedicalOps = isAdmin || isViewer || isDuoc || isDept;

  const { data: statsData, isFetching: statsFetching } = useQuery<any>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiGet('/dashboard/stats'),
  });

  const { data: rawCategoryData = [] } = useQuery<any[]>({
    queryKey: ['dashboard-by-category'],
    queryFn: () => apiGet('/dashboard/by-category'),
  });

  const { data: deptData = [] } = useQuery<any[]>({
    queryKey: ['dashboard-by-department'],
    queryFn: () => apiGet('/dashboard/by-department'),
  });

  const { data: rawStatusData = [] } = useQuery<any[]>({
    queryKey: ['dashboard-by-status'],
    queryFn: () => apiGet('/dashboard/by-status'),
  });

  const { data: maintSummary } = useQuery<{ pending: number; inProgress: number; completed: number }>({
    queryKey: ['dashboard-maintenance-summary'],
    queryFn: () => apiGet('/dashboard/maintenance-summary'),
  });

  const { data: calibrationAlerts } = useQuery<{ upcoming: number; overdue: number }>({
    queryKey: ['dashboard-calibration-alerts'],
    queryFn: () => apiGet('/dashboard/calibration-alerts'),
    enabled: canAccessMedicalOps,
  });

  const { data: tableAssetsRes, isFetching: tableFetching } = useQuery<{ assets: Asset[]; total: number }>({
    queryKey: ['dashboard-recent-assets', user?.departmentId, isDept, selectedUnitFilter, tableScope],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append('limit', '10');
      if (isDept && user?.departmentId) {
        params.append('departmentId', String(user.departmentId));
      }
      if (selectedUnitFilter) {
        params.append('managingUnit', selectedUnitFilter);
      }
      if (tableScope === 'ATTENTION') {
        params.append('status', 'HONG,BAO_TRI,CHO_THANH_LY');
      }
      return apiGet(`/assets?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const stats = statsData || {
    totalAssets: 0,
    dangSuDung: 0,
    hong: 0,
    baoTriOnly: 0,
    baoTri: 0,
    choPhanBo: 0,
    choThanhLy: 0,
    daThanhLy: 0,
    khongSuDung: 0,
    totalValue: 0,
    managingUnits: {
      cntt: { total: 0, dangSuDung: 0, baoTri: 0, choThanhLy: 0 },
      tchc: { total: 0, toanha: 0, hanhchinh: 0, dangSuDung: 0, baoTri: 0, choThanhLy: 0 },
      tchcHc: { total: 0, dangSuDung: 0, baoTri: 0 },
      tchcTn: { total: 0, dangSuDung: 0, baoTri: 0 },
      duoc: { total: 0, dangSuDung: 0, baoTri: 0, choThanhLy: 0 },
    },
    badges: [],
  };

  const categoryData = useMemo(
    () => (Array.isArray(rawCategoryData) ? rawCategoryData.map((c) => ({ ...c, value: c.count })) : []),
    [rawCategoryData]
  );

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(rawStatusData)) {
      rawStatusData.forEach((row) => {
        counts[row.status] = row._count?.status ?? 0;
      });
    }
    const items = [
      {
        key: 'DANG_SU_DUNG',
        label: 'Đang sử dụng',
        count: counts.DANG_SU_DUNG ?? stats.dangSuDung ?? 0,
        barColor: 'bg-emerald-600',
        dotColor: 'bg-emerald-600',
        textClass: 'text-emerald-700',
      },
      {
        key: 'HONG',
        label: 'Đang hỏng',
        count: counts.HONG ?? stats.hong ?? 0,
        barColor: 'bg-rose-600',
        dotColor: 'bg-rose-600',
        textClass: 'text-rose-700',
      },
      {
        key: 'BAO_TRI',
        label: 'Đang bảo trì',
        count: counts.BAO_TRI ?? stats.baoTriOnly ?? 0,
        barColor: 'bg-amber-500',
        dotColor: 'bg-amber-500',
        textClass: 'text-amber-700',
      },
      {
        key: 'CHO_THANH_LY',
        label: 'Chờ thanh lý',
        count: counts.CHO_THANH_LY ?? stats.choThanhLy ?? 0,
        barColor: 'bg-orange-500',
        dotColor: 'bg-orange-500',
        textClass: 'text-orange-700',
      },
      {
        key: 'KHONG_SU_DUNG',
        label: 'Không sử dụng',
        count: counts.KHONG_SU_DUNG ?? stats.khongSuDung ?? 0,
        barColor: 'bg-slate-400',
        dotColor: 'bg-slate-400',
        textClass: 'text-slate-600',
      },
    ];
    return items.filter((item) => item.count > 0 || item.key === 'DANG_SU_DUNG' || item.key === 'HONG');
  }, [rawStatusData, stats]);

  const tableAssets = tableAssetsRes?.assets || [];
  const tableTotal = tableAssetsRes?.total || 0;
  const readyPct = stats.totalAssets ? ((stats.dangSuDung / stats.totalAssets) * 100).toFixed(1) : '0.0';
  const openTickets = (maintSummary?.pending || 0) + (maintSummary?.inProgress || 0);
  const totalCalibAlerts = (calibrationAlerts?.overdue || 0) + (calibrationAlerts?.upcoming || 0);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-by-category'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-by-department'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-by-status'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-maintenance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-calibration-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-recent-assets'] });
  };

  const handleOpenQuickSearch = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };

  const navigateByCategoryName = (name: string, key?: string) => {
    if (key && TCHC_GROUP_META[key]) {
      const scopeBuilding = TCHC_GROUP_META[key].scope === 'ME' ? '1' : '0';
      navigate(`/assets?managingUnit=TCHC&buildingAsset=${scopeBuilding}&assetGroup=${key}`);
    } else if (key === 'DUOC' || name.includes('Y tế') || name.includes('Dược')) {
      navigate('/assets?managingUnit=DUOC');
    } else if (key === 'CNTT' || name.includes('CNTT')) {
      navigate('/assets?managingUnit=CNTT');
    } else if (key === 'TCHC_TOANHA' || name.includes('Cơ điện') || name.includes('tòa nhà') || name.includes('Tòa nhà')) {
      navigate('/assets?managingUnit=TCHC&buildingAsset=1');
    } else if (key === 'TCHC_HC' || key === 'TCHC' || name.includes('Hành chính') || name.includes('TCHC')) {
      navigate('/assets?managingUnit=TCHC&buildingAsset=0');
    } else {
      navigate('/assets');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      {/* 1. COMPACT COMMAND HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
              {isDept ? user?.department?.code || 'Khoa / Phòng' : 'CDC Đà Nẵng'}
            </span>
            <h1 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {isDept
                ? `Tài sản · ${user?.department?.name || user?.fullName}`
                : isCntt
                ? 'Điều hành Khối Thiết bị CNTT'
                : isDuoc
                ? 'Điều hành Trang thiết bị Y tế'
                : isTchc
                ? 'Điều hành Khối TCHC & Hạ tầng Tòa nhà'
                : 'Tổng Quan Quản Trị Tài Sản'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Theo dõi {(stats.totalAssets || 0).toLocaleString('vi-VN')} thiết bị · Tổng nguyên giá{' '}
            <strong className="text-slate-700">
              {stats.totalValue ? (stats.totalValue / 1e9).toFixed(2) : '0.00'} tỷ đ
            </strong>{' '}
            · Sẵn sàng <strong className="text-emerald-700">{readyPct}%</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenQuickSearch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Tìm nhanh</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-50 border border-slate-200 rounded text-slate-500">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Kiểm kê</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(user?.role !== 'VIEWER' ? '/maintenance?quickReport=1' : '/maintenance')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100/90 border border-amber-300/80 rounded-xl hover:bg-amber-200/80 transition cursor-pointer shadow-2xs"
            title={user?.role !== 'VIEWER' ? 'Mở nhanh phiếu báo hỏng thiết bị' : 'Xem danh sách sửa chữa'}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-700" />
            <span>{user?.role !== 'VIEWER' ? 'Báo hỏng nhanh' : 'Sửa chữa'}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/qr-scanner')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            title="Quét mã QR"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Quét QR</span>
          </button>

          {canManageAssets && (
            <button
              type="button"
              onClick={() => navigate('/assets/new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm tài sản</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            title="Làm mới số liệu"
            className="p-1.5 text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${statsFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. TOP KPI & ACTIONABLE ALERTS ROW (4 Focused Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate('/assets')}
          className="text-left bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{isDept ? 'Tổng tài sản khoa' : 'Tổng danh mục'}</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-heading text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {(stats.totalAssets || 0).toLocaleString('vi-VN')}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1.5">
            <span className="text-slate-500 tabular-nums">
              {stats.totalValue ? (stats.totalValue / 1e9).toFixed(2) : '0.00'} tỷ đ
            </span>
            <span className="font-medium text-blue-700">Danh mục →</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/assets?status=DANG_SU_DUNG')}
          className="text-left bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Đang sử dụng tốt</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-heading text-2xl font-bold text-emerald-700 tabular-nums">
              {(stats.dangSuDung || 0).toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-semibold text-emerald-600 tabular-nums">{readyPct}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${readyPct}%` }} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/assets?status=HONG,BAO_TRI')}
          className="text-left bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-sm transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Hỏng / Bảo trì</span>
            <Wrench className="w-4 h-4 text-rose-600" />
          </div>
          <div className="font-heading text-2xl font-bold text-rose-700 tabular-nums mt-1">
            {(stats.baoTri || 0).toLocaleString('vi-VN')}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-1.5">
            <span className="text-slate-500 tabular-nums">
              {openTickets > 0 ? `${openTickets} phiếu đang xử lý` : 'Kiểm tra thiết bị lỗi'}
            </span>
            <span className="font-medium text-rose-700">Lọc danh sách →</span>
          </div>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <button
            type="button"
            onClick={() => navigate('/assets?status=CHO_THANH_LY')}
            className="text-left w-full cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Chờ thanh lý</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="font-heading text-2xl font-bold text-amber-700 tabular-nums">
                {(stats.choThanhLy || 0).toLocaleString('vi-VN')}
              </span>
              <span className="text-[11px] text-amber-700 font-medium group-hover:underline">
                Xem đề xuất →
              </span>
            </div>
          </button>

          <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            {canAccessMedicalOps ? (
              <button
                type="button"
                onClick={() => navigate('/calibration')}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-teal-600" />
                <span className="tabular-nums">
                  {totalCalibAlerts > 0
                    ? `${calibrationAlerts?.overdue || 0} quá hạn · ${calibrationAlerts?.upcoming || 0} sắp hạn KĐ`
                    : 'Kiểm định TBYT đạt chuẩn'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/depreciation')}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                <TrendingDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Xem báo cáo khấu hao →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. DIVISION BREAKDOWN (4 Clear Autonomous Cards for Admin, 3 for Dept, 1 Strip for Manager) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <DivisionCard
            title="Khối TBYT"
            badgeText="Khoa Dược quản lý"
            subtitle="Thiết bị y tế chuyên dụng"
            count={stats.managingUnits?.duoc?.total ?? 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={stats.managingUnits?.duoc?.dangSuDung ?? 0}
            issueCount={stats.managingUnits?.duoc?.baoTri ?? 0}
            unitText="thiết bị"
            accentClass="border-l-emerald-600"
            barColorClass="bg-emerald-600"
            iconBg="bg-emerald-50 text-emerald-700"
            icon={Stethoscope}
            onClick={() => navigate('/assets?managingUnit=DUOC')}
          />

          <DivisionCard
            title="Khối CNTT"
            badgeText="Tổ CNTT quản lý"
            subtitle="Máy tính, máy in, mạng 16 khoa"
            count={stats.managingUnits?.cntt?.total ?? 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={stats.managingUnits?.cntt?.dangSuDung ?? 0}
            issueCount={stats.managingUnits?.cntt?.baoTri ?? 0}
            unitText="thiết bị"
            accentClass="border-l-blue-700"
            barColorClass="bg-blue-700"
            iconBg="bg-blue-50 text-blue-700"
            icon={Monitor}
            onClick={() => navigate('/assets?managingUnit=CNTT')}
          />

          <DivisionCard
            title="TCHC · Hành chính"
            badgeText="Nội thất & Gia dụng"
            subtitle="Bàn ghế, tủ kệ, gia dụng 16 khoa"
            count={stats.managingUnits?.tchcHc?.total ?? stats.managingUnits?.tchc?.hanhchinh ?? 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={
              stats.managingUnits?.tchcHc?.dangSuDung ?? stats.managingUnits?.tchc?.hanhchinh ?? 0
            }
            issueCount={stats.managingUnits?.tchcHc?.baoTri ?? 0}
            unitText="tài sản"
            accentClass="border-l-amber-600"
            barColorClass="bg-amber-500"
            iconBg="bg-amber-50 text-amber-700"
            icon={Building2}
            onClick={() => navigate('/assets?managingUnit=TCHC&buildingAsset=0')}
          />

          <DivisionCard
            title="TCHC · Cơ điện M&E"
            badgeText="Hạ tầng 9 tầng & KLCTN"
            subtitle="Điện, HVAC, PCCC, Cấp thoát nước"
            count={stats.managingUnits?.tchcTn?.total ?? stats.managingUnits?.tchc?.toanha ?? 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={
              stats.managingUnits?.tchcTn?.dangSuDung ?? stats.managingUnits?.tchc?.toanha ?? 0
            }
            issueCount={stats.managingUnits?.tchcTn?.baoTri ?? 0}
            unitText="hạng mục"
            accentClass="border-l-orange-600"
            barColorClass="bg-orange-500"
            iconBg="bg-orange-50 text-orange-700"
            icon={Layers}
            onClick={() => navigate('/assets?managingUnit=TCHC&buildingAsset=1')}
          />
        </div>
      )}

      {isDept && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DivisionCard
            title="Thiết bị CNTT"
            badgeText="Tổ CNTT bàn giao"
            subtitle="PC, Laptop, Máy in, Mạng"
            count={stats.managingUnits?.cntt?.total || 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={stats.managingUnits?.cntt?.dangSuDung || 0}
            issueCount={stats.managingUnits?.cntt?.baoTri || 0}
            unitText="thiết bị"
            accentClass="border-l-blue-700"
            barColorClass="bg-blue-700"
            iconBg="bg-blue-50 text-blue-700"
            icon={Monitor}
            onClick={() => navigate('/assets?managingUnit=CNTT')}
          />

          <DivisionCard
            title="Văn phòng & Điện"
            badgeText="Phòng TCHC bàn giao"
            subtitle="Bàn ghế, điều hòa, hành chính"
            count={stats.managingUnits?.tchc?.total || 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={stats.managingUnits?.tchc?.dangSuDung || 0}
            issueCount={stats.managingUnits?.tchc?.baoTri || 0}
            unitText="tài sản"
            accentClass="border-l-amber-600"
            barColorClass="bg-amber-500"
            iconBg="bg-amber-50 text-amber-700"
            icon={Building2}
            onClick={() => navigate('/assets?managingUnit=TCHC&buildingAsset=0')}
          />

          <DivisionCard
            title="Trang thiết bị Y tế"
            badgeText="Khoa Dược bàn giao"
            subtitle="Xét nghiệm, tiêm chủng, đo kiểm"
            count={stats.managingUnits?.duoc?.total || 0}
            totalBase={stats.totalAssets || 0}
            healthyCount={stats.managingUnits?.duoc?.dangSuDung || 0}
            issueCount={stats.managingUnits?.duoc?.baoTri || 0}
            unitText="thiết bị"
            accentClass="border-l-emerald-600"
            barColorClass="bg-emerald-600"
            iconBg="bg-emerald-50 text-emerald-700"
            icon={Stethoscope}
            onClick={() => navigate('/assets?managingUnit=DUOC')}
          />
        </div>
      )}

      {(isCntt || isDuoc || isTchc) && (
        <div
          className={`bg-white rounded-2xl border border-slate-200/80 border-l-4 ${
            isCntt ? 'border-l-blue-700' : isDuoc ? 'border-l-emerald-600' : 'border-l-amber-600'
          } p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                isCntt
                  ? 'bg-blue-50 text-blue-700'
                  : isDuoc
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isCntt ? (
                <Monitor className="w-5 h-5" />
              ) : isDuoc ? (
                <Stethoscope className="w-5 h-5" />
              ) : (
                <Building2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="font-heading text-sm font-semibold text-slate-900">
                {isCntt
                  ? 'Khối Tổ Công Nghệ Thông Tin'
                  : isDuoc
                  ? 'Khối Khoa Dược - Trang Thiết Bị Y Tế'
                  : `Khối Phòng TCHC · ${stats.managingUnits?.tchc?.hanhchinh?.toLocaleString('vi-VN') || 0} Hành chính · ${stats.managingUnits?.tchc?.toanha?.toLocaleString('vi-VN') || 0} Cơ điện M&E`}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isCntt
                  ? 'Theo dõi máy tính, laptop, máy in và hạ tầng mạng tại 16 khoa/phòng.'
                  : isDuoc
                  ? 'Theo dõi trang thiết bị y tế, sửa chữa và kiểm định định kỳ.'
                  : 'Quản lý nội thất/gia dụng 16 khoa và hạ tầng cơ điện M&E (Điện, HVAC, PCCC, Nước).'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/assets')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Mở danh mục khối</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. ANALYTICS ROW (3 Clear Cards with Interactive Drill-down + Table Toggle) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold text-slate-800">
            Phân tích cơ cấu &amp; tình trạng vận hành
          </h2>
          <div className="inline-flex p-0.5 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <button
              type="button"
              onClick={() => setChartViewMode('chart')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                chartViewMode === 'chart' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Trực quan</span>
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                chartViewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Bảng số</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Category / Division Share */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-semibold text-sm text-slate-900">
                {isDept
                  ? 'Cơ cấu 3 khối tại khoa'
                  : isCntt
                  ? 'Nhóm thiết bị CNTT'
                  : isDuoc
                  ? 'Nhóm Trang thiết bị Y tế'
                  : isTchc
                  ? 'Nhóm Tài sản TCHC'
                  : 'Tỷ trọng theo 4 khối quản lý'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Bấm từng nhóm để mở danh sách lọc</p>
            </div>

            {chartViewMode === 'chart' ? (
              <>
                <div className="relative h-48 my-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={74}
                        paddingAngle={2.5}
                        dataKey="value"
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      Tổng cộng
                    </span>
                    <span className="font-heading text-lg font-bold text-slate-900 tabular-nums">
                      {(stats.totalAssets || 0).toLocaleString('vi-VN')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  {categoryData.map((c, idx) => {
                    const pct = stats.totalAssets ? Math.round(((c.count || 0) / stats.totalAssets) * 100) : 0;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => navigateByCategoryName(c.name || '', c.key)}
                        className="w-full text-left group space-y-1 hover:bg-slate-50 rounded-lg p-1 -mx-1 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                            />
                            <span className="text-slate-700 group-hover:text-blue-700 truncate font-medium">
                              {c.name}
                            </span>
                          </span>
                          <span className="font-heading font-semibold text-slate-900 tabular-nums shrink-0">
                            {(c.count || 0).toLocaleString('vi-VN')}{' '}
                            <span className="text-[11px] font-normal text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length],
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Nhóm tài sản</th>
                      <th className="py-2 font-medium text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoryData.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-slate-700">{c.name}</td>
                        <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">
                          {c.count?.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 2: Top Departments with Drill-Down */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-heading font-semibold text-sm text-slate-900">
                {isDept ? 'Phân bổ theo Phòng / Cán bộ' : 'Top 8 Khoa / Phòng sử dụng'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDept ? 'Các khu vực quản lý trong khoa' : 'Bấm vào cột để xem thiết bị của đơn vị'}
              </p>
            </div>

            {chartViewMode === 'chart' ? (
              <div className="h-72 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptData.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 4, right: 16, top: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={isDept ? 94 : 62}
                      tick={{ fontSize: 11, fontWeight: 500, fill: '#334155' }}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar
                      dataKey="count"
                      fill="#1E40AF"
                      radius={[0, 6, 6, 0]}
                      className="cursor-pointer"
                      onClick={(entry: any) => {
                        if (entry?.id) navigate(`/assets?departmentId=${entry.id}`);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b border-slate-100 text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Đơn vị / Vị trí</th>
                      <th className="py-2 font-medium text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deptData.slice(0, 10).map((d, idx) => (
                      <tr key={idx}>
                        <td className="py-2 text-slate-700">{d.fullName || d.name}</td>
                        <td className="py-2 text-right font-semibold text-slate-900 tabular-nums">
                          {d.count?.toLocaleString('vi-VN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card 3: Asset Health & Operations Pipeline */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-4">
            <div>
              <h3 className="font-heading font-semibold text-sm text-slate-900">
                Sức khỏe tài sản &amp; Vận hành
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Phân bổ tình trạng kỹ thuật theo số liệu thực</p>

              {/* Stacked Progress Overview */}
              <div className="mt-3.5 h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                {statusBreakdown.map((item) => {
                  const pct = stats.totalAssets ? (item.count / stats.totalAssets) * 100 : 0;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={item.key}
                      className={`${item.barColor} h-full`}
                      style={{ width: `${Math.max(pct, 0.8)}%` }}
                      title={`${item.label}: ${item.count.toLocaleString('vi-VN')} (${pct.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>

              <div className="mt-3.5 space-y-2">
                {statusBreakdown.map((item) => {
                  const pct = stats.totalAssets ? ((item.count / stats.totalAssets) * 100).toFixed(1) : '0.0';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => navigate(`/assets?status=${item.key}`)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 -mx-2 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 text-slate-700 font-medium">
                        <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                        <span>{item.label}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 tabular-nums">
                        <span className={`font-heading font-semibold ${item.textClass}`}>
                          {item.count.toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[11px] text-slate-400 w-10 text-right">{pct}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Maintenance & Calibration Micro Summary */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate('/maintenance')}
                className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/70 border border-slate-200/70 transition cursor-pointer"
              >
                <div className="text-[11px] text-slate-500">Phiếu sửa chữa</div>
                <div className="font-heading font-semibold text-slate-900 tabular-nums mt-0.5">
                  {maintSummary?.pending || 0} chờ · {maintSummary?.inProgress || 0} đang xử lý
                </div>
              </button>

              {canAccessMedicalOps ? (
                <button
                  type="button"
                  onClick={() => navigate('/calibration')}
                  className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-teal-50/70 border border-slate-200/70 transition cursor-pointer"
                >
                  <div className="text-[11px] text-slate-500">Kiểm định 30 ngày</div>
                  <div className="font-heading font-semibold text-slate-900 tabular-nums mt-0.5">
                    {calibrationAlerts?.overdue || 0} quá hạn · {calibrationAlerts?.upcoming || 0} sắp hạn
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/inventory')}
                  className="text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200/70 transition cursor-pointer"
                >
                  <div className="text-[11px] text-slate-500">Kiểm kê C53-HD</div>
                  <div className="font-heading font-semibold text-blue-700 mt-0.5">Mở bảng kiểm kê →</div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. ACTIONABLE PRIORITY & RECENT ASSETS TABLE (Opens QuickDrawer in-place) */}
      <DataTableShell
        title={
          tableScope === 'ATTENTION'
            ? 'Thiết bị cần xử lý (Hỏng / Bảo trì / Chờ thanh lý)'
            : isDept
            ? `Danh mục tài sản · ${user?.department?.name || user?.fullName}`
            : 'Danh mục thiết bị gần đây'
        }
        totalCount={tableTotal}
        countLabel={tableScope === 'ATTENTION' ? 'cần xử lý' : 'tài sản'}
        density={density}
        onDensityChange={setDensity}
        loading={tableFetching && tableAssets.length === 0}
        isEmpty={!tableFetching && tableAssets.length === 0}
        emptyMessage={
          tableScope === 'ATTENTION'
            ? 'Không có thiết bị nào đang báo hỏng, bảo trì hoặc chờ thanh lý trong phạm vi lọc.'
            : 'Chưa có dữ liệu thiết bị.'
        }
        toolbarExtra={
          <div className="flex flex-wrap items-center gap-2">
            {/* Switch Attention Queue vs All Assets */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTableScope('ATTENTION')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                  tableScope === 'ATTENTION' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Cần xử lý</span>
              </button>
              <button
                type="button"
                onClick={() => setTableScope('ALL')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                  tableScope === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tất cả</span>
              </button>
            </div>

            {!isCntt && !isDuoc && !isTchc && (
              <select
                value={selectedUnitFilter}
                onChange={(e) => setSelectedUnitFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-xl bg-white focus:border-blue-600 outline-none"
              >
                <option value="">Tất cả khối</option>
                <option value="DUOC">Khoa Dược</option>
                <option value="CNTT">Tổ CNTT</option>
                <option value="TCHC">Phòng TCHC</option>
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (selectedUnitFilter) params.set('managingUnit', selectedUnitFilter);
                if (tableScope === 'ATTENTION') params.set('status', 'HONG,BAO_TRI,CHO_THANH_LY');
                const qs = params.toString();
                navigate(qs ? `/assets?${qs}` : '/assets');
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer whitespace-nowrap"
            >
              Xem toàn bộ ({tableTotal.toLocaleString('vi-VN')}) →
            </button>
          </div>
        }
      >
        <table className="w-full text-[13px] text-left border-collapse">
          <thead className="bg-slate-50/90 text-slate-500 font-heading text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200/80">
            <tr>
              <th className={`${headPy} px-3.5 w-32 whitespace-nowrap`}>Mã tài sản</th>
              <th className={`${headPy} px-3.5 min-w-[230px] whitespace-nowrap`}>Tên thiết bị</th>
              <th className={`${headPy} px-3.5 whitespace-nowrap`}>Khối</th>
              <th className={`${headPy} px-3.5 whitespace-nowrap`}>Đơn vị / Vị trí</th>
              <th className={`${headPy} px-3.5 whitespace-nowrap`}>Trạng thái</th>
              <th className={`${headPy} px-3.5 w-20 text-right whitespace-nowrap`}>Xem nhanh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tableAssets.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => setQuickViewAssetId(a.id)}
                    className="font-mono text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                  >
                    {a.assetCode}
                  </button>
                </td>
                <td className={`${cellPy} px-3.5 align-top max-w-[360px]`}>
                  <button
                    type="button"
                    onClick={() => setQuickViewAssetId(a.id)}
                    className="font-heading font-semibold text-slate-900 hover:text-blue-700 text-left leading-snug line-clamp-2 break-words cursor-pointer"
                  >
                    {a.name}
                  </button>
                </td>
                <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium text-[11px] border whitespace-nowrap ${
                      a.managingUnit === 'DUOC'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : a.managingUnit === 'CNTT'
                        ? 'bg-sky-50 text-sky-700 border-sky-200/80'
                        : 'bg-amber-50 text-amber-800 border-amber-200/80'
                    }`}
                  >
                    {a.managingUnit === 'DUOC'
                      ? 'Khoa Dược'
                      : a.managingUnit === 'CNTT'
                      ? 'Tổ CNTT'
                      : 'TCHC'}
                  </span>
                </td>
                <td className={`${cellPy} px-3.5 align-top text-slate-600`}>
                  <div className="font-medium text-slate-800 text-xs leading-snug truncate max-w-[260px]">
                    {a.assignedTo || a.department?.name || 'Chưa giao cá nhân'}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug truncate max-w-[260px]">
                    {a.locationDetail || a.floor || 'Cơ sở 1'}
                  </div>
                </td>
                <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                  <StatusBadge status={a.status} compact />
                </td>
                <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => setQuickViewAssetId(a.id)}
                    className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-500 hover:text-blue-700 transition cursor-pointer"
                    title="Mở bảng xem & cập nhật nhanh"
                  >
                    <PanelRightOpen className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {/* Slide-over Quick Drawer */}
      <AssetQuickDrawer
        assetId={quickViewAssetId}
        canManage={canManageAssets}
        onClose={() => setQuickViewAssetId(null)}
        onNavigate={(to) => {
          setQuickViewAssetId(null);
          navigate(to);
        }}
      />
    </div>
  );
}
