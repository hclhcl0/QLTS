import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Search,
  RefreshCw,
  Stethoscope,
  Monitor,
  Building2,
  Layers,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PanelRightOpen,
  X,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Department, TCHC_GROUP_META } from '../types';
import { matchesSmartSearchClient } from '../utils/superSortSearch';
import { useToast } from '../components/ui/Toast';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import AssetQuickDrawer from '../components/AssetQuickDrawer';

interface DepreciationItem {
  id: number;
  assetCode: string;
  oldAssetCode?: string | null;
  name: string;
  managingUnit?: string | null;
  buildingAsset?: number | null;
  assetGroup?: string | null;
  floor?: string | null;
  location?: string | null;
  locationDetail?: string | null;
  assignedTo?: string | null;
  departmentId?: number;
  department?: { id: number; code: string; name: string } | null;
  status?: string;
  yearInUse: number;
  yearsUsed: number;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  rate: number;
  annualAmount: number;
  accumulated: number;
  remaining: number;
  wornPct: number;
}

const viCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export default function Depreciation() {
  const { user } = useAuth();
  const toast = useToast();
  const { density, setDensity, cellPy, headPy } = useTablePrefs('depreciation');

  const [items, setItems] = useState<DepreciationItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const defaultTab =
    user?.role === 'MANAGER_DUOC'
      ? 'DUOC'
      : user?.role === 'MANAGER_CNTT'
      ? 'CNTT'
      : user?.role === 'MANAGER_TCHC'
      ? 'TCHC_HC'
      : 'ALL';

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [wornFilter, setWornFilter] = useState<'ALL' | 'ACTIVE' | 'FULL'>('ALL');
  const [sortBy, setSortBy] = useState<string>('originalPrice');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [quickViewAssetId, setQuickViewAssetId] = useState<number | null>(null);

  const canManage = ['ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'].includes(
    user?.role || ''
  );

  const loadData = async (yr = selectedYear) => {
    setLoading(true);
    try {
      const [depRes, deptRes] = await Promise.allSettled([
        apiGet(`/depreciation?year=${yr}`),
        apiGet('/departments'),
      ]);
      if (depRes.status === 'fulfilled' && Array.isArray(depRes.value?.items)) {
        setItems(depRes.value.items);
      }
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
        setDepartments(deptRes.value);
      }
    } catch (err) {
      console.error('Error loading depreciation data:', err);
      toast.error('Không thể tải dữ liệu khấu hao');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedYear);
  }, [selectedYear]);

  const handleCalculateAll = async () => {
    setCalculating(true);
    try {
      const res = await apiPost('/depreciation/calculate-all', { year: selectedYear });
      toast.success(
        `Đã chốt & cập nhật giá trị hao mòn kỳ ${selectedYear} cho ${res?.updatedCount || items.length} tài sản.`
      );
      await loadData(selectedYear);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tính khấu hao kỳ này');
    } finally {
      setCalculating(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeTab === 'DUOC' && item.managingUnit !== 'DUOC') return false;
      if (activeTab === 'CNTT' && item.managingUnit !== 'CNTT') return false;
      if (activeTab === 'TCHC_HC' && !(item.managingUnit === 'TCHC' && !item.buildingAsset)) {
        return false;
      }
      if (activeTab === 'TCHC_TOANHA' && !(item.managingUnit === 'TCHC' && item.buildingAsset === 1)) {
        return false;
      }
      if (selectedDept && String(item.departmentId) !== selectedDept) return false;
      if (wornFilter === 'ACTIVE' && item.remaining <= 0) return false;
      if (wornFilter === 'FULL' && item.remaining > 0) return false;
      if (!matchesSmartSearchClient(item, searchTerm)) return false;
      return true;
    });
  }, [items, activeTab, selectedDept, wornFilter, searchTerm]);

  const sortedItems = useMemo(() => {
    const dir = sortOrder === 'desc' ? -1 : 1;
    return [...filteredItems].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'assetCode') cmp = viCollator.compare(a.assetCode, b.assetCode);
      else if (sortBy === 'name') cmp = viCollator.compare(a.name, b.name);
      else if (sortBy === 'yearInUse') cmp = (a.yearInUse || 0) - (b.yearInUse || 0);
      else if (sortBy === 'rate') cmp = (a.rate || 0) - (b.rate || 0);
      else if (sortBy === 'wornPct') cmp = (a.wornPct || 0) - (b.wornPct || 0);
      else if (sortBy === 'accumulated') cmp = (a.accumulated || 0) - (b.accumulated || 0);
      else if (sortBy === 'remaining') cmp = (a.remaining || 0) - (b.remaining || 0);
      else cmp = (a.originalPrice || 0) - (b.originalPrice || 0);
      if (cmp !== 0) return cmp * dir;
      return viCollator.compare(a.assetCode, b.assetCode);
    });
  }, [filteredItems, sortBy, sortOrder]);

  const kpi = useMemo(() => {
    let orig = 0;
    let accum = 0;
    let rem = 0;
    let fullCount = 0;
    for (const it of sortedItems) {
      orig += it.originalPrice;
      accum += it.accumulated;
      rem += it.remaining;
      if (it.remaining === 0) fullCount += 1;
    }
    return { count: sortedItems.length, orig, accum, rem, fullCount };
  }, [sortedItems]);

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, safePage, pageSize]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'assetCode' || field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900">
            Quản Lý Khấu Hao &amp; Hao Mòn Tài Sản
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
            Theo dõi nguyên giá sổ sách, hao mòn lũy kế và giá trị còn lại theo năm sử dụng thực tế
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-600">
            <span>Kỳ tính:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="font-heading font-semibold text-slate-900 bg-transparent outline-none cursor-pointer"
            >
              <option value={2026}>Năm 2026</option>
              <option value={2025}>Năm 2025</option>
              <option value={2024}>Năm 2024</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => loadData(selectedYear)}
            className="p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {canManage && (
            <button
              type="button"
              onClick={handleCalculateAll}
              disabled={calculating || loading}
              title={`Tính & Chốt hao mòn kỳ ${selectedYear}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-md text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>{calculating ? 'Đang chốt...' : `Chốt HM ${selectedYear}`}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tài sản có nguyên giá</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-heading text-xl font-bold text-slate-900 tabular-nums mt-1">
            {kpi.count.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-500">mục</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Đã hết hạn khấu hao: <strong className="text-slate-700">{kpi.fullCount.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tổng nguyên giá sổ sách</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-heading text-lg font-bold text-slate-900 tabular-nums mt-1 truncate">
            {kpi.orig.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tính theo số lượng thực tế đang quản lý</div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 bg-amber-50/20 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-amber-800">
            <span>Tổng hao mòn lũy kế ({selectedYear})</span>
            <TrendingDown className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-heading text-lg font-bold text-amber-800 tabular-nums mt-1 truncate">
            {kpi.accum.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">
            Tỷ lệ hao mòn TB:{' '}
            <strong>{kpi.orig > 0 ? ((kpi.accum / kpi.orig) * 100).toFixed(1) : '0.0'}%</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-blue-200/80 bg-blue-50/20 p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-blue-800">
            <span>Tổng giá trị còn lại</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-heading text-lg font-bold text-blue-800 tabular-nums mt-1 truncate">
            {kpi.rem.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-blue-700/80 mt-0.5">
            Còn lại: <strong>{kpi.orig > 0 ? ((kpi.rem / kpi.orig) * 100).toFixed(1) : '0.0'}%</strong> nguyên giá
          </div>
        </div>
      </div>

      {/* Filter & Division Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'ALL', label: 'Tất cả đơn vị', icon: Layers },
            { id: 'DUOC', label: 'Khoa Dược (TBYT)', icon: Stethoscope },
            { id: 'CNTT', label: 'Tổ CNTT (IT)', icon: Monitor },
            { id: 'TCHC_HC', label: 'TCHC · Hành chính', icon: Building2 },
            { id: 'TCHC_TOANHA', label: 'TCHC · Cơ điện M&E', icon: Layers },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveTab(t.id);
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã TS, tên thiết bị, khoa phòng, tầng, hoặc gõ giá:>20tr năm:2022..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="md:w-56 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="">Tất cả Khoa / Phòng ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </select>

          <select
            value={wornFilter}
            onChange={(e) => {
              setWornFilter(e.target.value as any);
              setPage(1);
            }}
            className="md:w-48 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="ALL">Tất cả mức hao mòn</option>
            <option value="ACTIVE">Còn giá trị sử dụng (&gt; 0đ)</option>
            <option value="FULL">Đã khấu hao hết (100%)</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <DataTableShell
        title="Bảng tổng hợp hao mòn & giá trị còn lại"
        totalCount={sortedItems.length}
        countLabel="tài sản"
        density={density}
        onDensityChange={setDensity}
        loading={loading}
        isEmpty={!loading && sortedItems.length === 0}
        emptyMessage="Không có tài sản có nguyên giá khớp với bộ lọc hiện tại."
        toolbarExtra={
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none"
          >
            <option value={25}>25 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>
        }
      >
        {/* Mobile Card View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {pagedItems.map((item) => {
            const grpMeta = item.assetGroup ? TCHC_GROUP_META[item.assetGroup] : null;
            return (
              <div key={item.id} className="p-3.5 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                      {item.assetCode}
                    </span>
                    {grpMeta && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${grpMeta.badgeClass}`}>
                        {grpMeta.label}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 tabular-nums">
                      Năm ĐSD {item.yearInUse} ({item.yearsUsed}n)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickViewAssetId(item.id)}
                    className="shrink-0 min-h-[34px] px-2.5 py-1 rounded-md border border-slate-200 bg-white text-blue-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PanelRightOpen className="w-3.5 h-3.5" />
                    <span>Hồ sơ</span>
                  </button>
                </div>

                <div className="font-heading text-sm font-semibold text-slate-900 leading-snug">
                  {item.name}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {item.department?.name || 'Chưa phân bổ'} {item.floor ? `· ${item.floor}` : ''}
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] tabular-nums">
                    <span className="text-slate-600">{item.rate}%/năm</span>
                    <span className={item.wornPct >= 100 ? 'text-amber-700 font-semibold' : 'text-slate-700 font-medium'}>
                      Đã hao mòn {item.wornPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.wornPct >= 100 ? 'bg-amber-500' : 'bg-blue-600'}`}
                      style={{ width: `${item.wornPct}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-100 text-[11px] tabular-nums">
                  <div>
                    <div className="text-slate-400">Nguyên giá</div>
                    <div className="font-semibold text-slate-800">{item.originalPrice.toLocaleString('vi-VN')}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Lũy kế HM</div>
                    <div className="font-medium text-slate-600">{item.accumulated.toLocaleString('vi-VN')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400">Còn lại</div>
                    <div className="font-semibold text-blue-700">{item.remaining.toLocaleString('vi-VN')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[11px] text-slate-500 uppercase tracking-wider bg-slate-50/90 border-b border-slate-200 font-heading font-semibold">
              <tr>
                <th className={`${headPy} px-3 w-32 whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('assetCode')}
                    className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                  >
                    <span>Mã TS</span>
                    {renderSortIcon('assetCode')}
                  </button>
                </th>
                <th className={`${headPy} px-3 min-w-[220px]`}>
                  <button
                    type="button"
                    onClick={() => handleSort('name')}
                    className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                  >
                    <span>Tên thiết bị &amp; Khoa/Phòng</span>
                    {renderSortIcon('name')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-center whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('yearInUse')}
                    className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                  >
                    <span>Năm SD</span>
                    {renderSortIcon('yearInUse')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('originalPrice')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-slate-800 cursor-pointer"
                  >
                    <span>Nguyên giá (đ)</span>
                    {renderSortIcon('originalPrice')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('wornPct')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-slate-800 cursor-pointer"
                  >
                    <span>Tỷ lệ / Tiến độ HM</span>
                    {renderSortIcon('wornPct')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('accumulated')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-slate-800 cursor-pointer"
                  >
                    <span>Lũy kế (đ)</span>
                    {renderSortIcon('accumulated')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={() => handleSort('remaining')}
                    className="inline-flex items-center gap-1 ml-auto hover:text-slate-800 cursor-pointer"
                  >
                    <span>Còn lại (đ)</span>
                    {renderSortIcon('remaining')}
                  </button>
                </th>
                <th className={`${headPy} px-3 text-right w-16`}>Xem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedItems.map((item) => {
                const grpMeta = item.assetGroup ? TCHC_GROUP_META[item.assetGroup] : null;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className={`${cellPy} px-3 align-top whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={() => setQuickViewAssetId(item.id)}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                      >
                        {item.assetCode}
                      </button>
                      {item.quantity > 1 && (
                        <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                          SL: {item.quantity}
                        </div>
                      )}
                    </td>
                    <td className={`${cellPy} px-3 align-top`}>
                      <button
                        type="button"
                        onClick={() => setQuickViewAssetId(item.id)}
                        className="font-heading font-semibold text-slate-900 hover:text-blue-700 text-left cursor-pointer"
                      >
                        {item.name}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                        {grpMeta && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${grpMeta.badgeClass}`}
                          >
                            {grpMeta.label}
                          </span>
                        )}
                        <span>{item.department?.name || 'Chưa phân bổ'}</span>
                        {item.floor && <span>· {item.floor}</span>}
                      </div>
                    </td>
                    <td className={`${cellPy} px-3 align-top text-center text-slate-700 tabular-nums whitespace-nowrap`}>
                      <div className="font-semibold">{item.yearInUse}</div>
                      <div className="text-[10px] text-slate-400">{item.yearsUsed} năm</div>
                    </td>
                    <td className={`${cellPy} px-3 align-top text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap`}>
                      {item.originalPrice.toLocaleString('vi-VN')}
                    </td>
                    <td className={`${cellPy} px-3 align-top text-right whitespace-nowrap`}>
                      <div className="inline-flex flex-col items-end gap-1 min-w-[115px]">
                        <span className="text-slate-700 font-medium tabular-nums">
                          {item.rate}%/năm ·{' '}
                          <span className={item.wornPct >= 100 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                            HM {item.wornPct}%
                          </span>
                        </span>
                        <div className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.wornPct >= 100 ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${item.wornPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className={`${cellPy} px-3 align-top text-right text-slate-600 tabular-nums whitespace-nowrap`}>
                      {item.accumulated.toLocaleString('vi-VN')}
                    </td>
                    <td className={`${cellPy} px-3 align-top text-right font-semibold text-blue-700 tabular-nums whitespace-nowrap`}>
                      {item.remaining.toLocaleString('vi-VN')}
                    </td>
                    <td className={`${cellPy} px-3 align-top text-right whitespace-nowrap`}>
                      <button
                        type="button"
                        onClick={() => setQuickViewAssetId(item.id)}
                        className="p-1.5 rounded-md border border-slate-200 hover:bg-blue-50 text-blue-700 cursor-pointer"
                        title="Xem nhanh hồ sơ"
                      >
                        <PanelRightOpen className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <span>
            Trang <strong>{safePage}</strong> / {totalPages} · Tổng{' '}
            <strong>{sortedItems.length.toLocaleString('vi-VN')}</strong> mục
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      <AssetQuickDrawer
        assetId={quickViewAssetId}
        canManage={canManage}
        onClose={() => setQuickViewAssetId(null)}
        onNavigate={() => setQuickViewAssetId(null)}
      />
    </div>
  );
}
