import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Download,
  Printer,
  Filter,
  Eye,
  Edit,
  Trash2,
  QrCode,
  RefreshCw,
  Stethoscope,
  Monitor,
  Building2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PanelRightOpen,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Sparkles,
  FolderKanban,
  Wrench,
} from 'lucide-react';
import { Asset, Department, AssetCategory, STANDARD_FLOORS, TCHC_GROUP_OPTIONS, TCHC_GROUP_META } from '../types';
import {
  SUPER_SORT_FIELDS,
  GROUP_BY_OPTIONS,
  FLOOR_PILL_OPTIONS,
  SMART_TAG_EXAMPLES,
  AssetGroupSummary,
  FUNCTION_BADGE_MAP,
  getAssetFunctionKey,
} from '../utils/superSortSearch';
import { apiGet, apiDelete } from '../lib/api';
import QrLabelPrintModal, { QrLabelAssetItem } from '../components/QrLabelPrintModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import StatusBadge from '../components/ui/StatusBadge';
import AssetQuickDrawer from '../components/AssetQuickDrawer';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';

const FLOORS = [
  'Tất cả tầng',
  ...STANDARD_FLOORS,
];

const UNIT_BADGE: Record<string, { label: string; className: string }> = {
  DUOC: { label: 'Dược', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  CNTT: { label: 'CNTT', className: 'bg-sky-50 text-sky-700 border-sky-200/80' },
  TCHC: { label: 'TCHC', className: 'bg-amber-50 text-amber-800 border-amber-200/80' },
};

const QUICK_STATUS_CHIPS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DANG_SU_DUNG', label: 'Đang sử dụng' },
  { value: 'HONG,BAO_TRI', label: 'Hỏng & Bảo trì' },
  { value: 'HONG', label: 'Đang hỏng' },
  { value: 'BAO_TRI', label: 'Đang bảo trì' },
  { value: 'CHO_THANH_LY', label: 'Chờ thanh lý' },
  { value: 'KHONG_SU_DUNG', label: 'Không sử dụng' },
];

export default function Assets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { density, setDensity, cellPy, headPy } = useTablePrefs('assets');

  const defaultTabByRole =
    user?.role === 'MANAGER_CNTT'
      ? 'CNTT'
      : user?.role === 'MANAGER_DUOC'
      ? 'DUOC'
      : user?.role === 'MANAGER_TCHC'
      ? 'TCHC_HC'
      : 'ALL';

  const initialUnit = searchParams.get('managingUnit') || defaultTabByRole;
  const initialBuilding = searchParams.get('buildingAsset');

  const [activeTab, setActiveTab] = useState<string>(
    initialBuilding === '1'
      ? 'TCHC_TOANHA'
      : initialBuilding === '0' && initialUnit === 'TCHC'
      ? 'TCHC_HC'
      : initialUnit
  );

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [selectedFloor, setSelectedFloor] = useState(searchParams.get('floor') || 'Tất cả tầng');
  const [sortBy, setSortBy] = useState<string>(searchParams.get('sortBy') || 'assetCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
  );
  const [sortBy2, setSortBy2] = useState<string>(searchParams.get('sortBy2') || '');
  const [sortOrder2, setSortOrder2] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder2') as 'asc' | 'desc') || 'asc'
  );
  const [groupBy, setGroupBy] = useState<string>(searchParams.get('groupBy') || '');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [showSmartHints, setShowSmartHints] = useState<boolean>(false);
  const [quickFacetMode, setQuickFacetMode] = useState<'floor' | 'function' | 'status'>('floor');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const isDeptUser = user?.role === 'DEPARTMENT';
  const initialDept = isDeptUser && user.departmentId
    ? user.departmentId.toString()
    : (searchParams.get('departmentId') || '');

  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.get('categoryId') || '');
  const [selectedAssetGroup, setSelectedAssetGroup] = useState<string>(searchParams.get('assetGroup') || '');
  const [selectedDept, setSelectedDept] = useState<string>(initialDept);
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.get('status') || '');
  const [selectedLocation, setSelectedLocation] = useState<string>(searchParams.get('location') || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(
    Boolean((!isDeptUser && searchParams.get('departmentId')) || searchParams.get('categoryId') || searchParams.get('location'))
  );
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Selection & Quick Drawer
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quickViewAssetId, setQuickViewAssetId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [printingBatch, setPrintingBatch] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrModalAssets, setQrModalAssets] = useState<QrLabelAssetItem[]>([]);
  const [qrModalContext, setQrModalContext] = useState('Danh mục tài sản CDC');

  const canManage = ['ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'].includes(
    user?.role || ''
  );

  // Sync URL query params cleanly if navigated from Dashboard / Ctrl+K
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    const urlStatus = searchParams.get('status');
    const urlUnit = searchParams.get('managingUnit');
    const urlBuilding = searchParams.get('buildingAsset');
    const urlDept = searchParams.get('departmentId');
    const urlCategory = searchParams.get('categoryId');
    const urlAssetGroup = searchParams.get('assetGroup');
    const urlFloor = searchParams.get('floor');
    if (urlSearch !== null) {
      setSearchInput(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    if (urlStatus !== null) setSelectedStatus(urlStatus);
    if (urlFloor !== null) setSelectedFloor(urlFloor);
    setSelectedAssetGroup(urlAssetGroup ?? '');
    if (!isDeptUser && urlDept !== null) {
      setSelectedDept(urlDept);
      if (urlDept) setShowAdvancedFilters(true);
    }
    if (urlCategory !== null) {
      setSelectedCategory(urlCategory);
      if (urlCategory) setShowAdvancedFilters(true);
    }
    if (urlBuilding === '1') setActiveTab('TCHC_TOANHA');
    else if (urlBuilding === '0' && urlUnit === 'TCHC') setActiveTab('TCHC_HC');
    else if (urlUnit) setActiveTab(urlUnit);
    setPage(1);
  }, [searchParams, isDeptUser]);

  // Debounce live search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Press '/' to focus Omnibox Search Input quickly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (e.key === '/' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setShowSmartHints(false);
        setShowAdvancedFilters(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reference metadata queries
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => apiGet('/departments'),
    staleTime: 5 * 60_000,
  });

  const { data: categories = [] } = useQuery<AssetCategory[]>({
    queryKey: ['categories'],
    queryFn: () => apiGet('/categories'),
    staleTime: 5 * 60_000,
  });

  const buildFilterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.append('search', debouncedSearch);

    if (activeTab === 'DUOC') params.append('managingUnit', 'DUOC');
    else if (activeTab === 'CNTT') params.append('managingUnit', 'CNTT');
    else if (activeTab === 'TCHC_HC') {
      params.append('managingUnit', 'TCHC');
      params.append('buildingAsset', '0');
    } else if (activeTab === 'TCHC_TOANHA') {
      params.append('managingUnit', 'TCHC');
      params.append('buildingAsset', '1');
    }

    if (selectedFloor && selectedFloor !== 'Tất cả tầng') params.append('floor', selectedFloor);
    if (selectedDept) params.append('departmentId', selectedDept);
    if (selectedCategory) params.append('categoryId', selectedCategory);
    if (selectedAssetGroup && activeTab !== 'DUOC' && activeTab !== 'CNTT') {
      params.append('assetGroup', selectedAssetGroup);
    }
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedLocation) params.append('location', selectedLocation);
    return params;
  }, [
    debouncedSearch,
    activeTab,
    selectedFloor,
    selectedDept,
    selectedCategory,
    selectedAssetGroup,
    selectedStatus,
    selectedLocation,
  ]);

  const {
    data: assetsResponse,
    isLoading,
    isFetching,
    isPlaceholderData,
  } = useQuery<{
    assets: Asset[];
    total: number;
    totalValuation?: number;
    facets?: {
      floors: Record<string, number>;
      functions: Record<string, number>;
      statuses: Record<string, number>;
    };
    groups?: AssetGroupSummary[];
  }>({
    queryKey: ['assets', buildFilterParams.toString(), sortBy, sortOrder, sortBy2, sortOrder2, groupBy, page, limit],
    queryFn: () => {
      const params = new URLSearchParams(buildFilterParams);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      if (sortBy2) {
        params.append('sortBy2', sortBy2);
        params.append('sortOrder2', sortOrder2);
      }
      if (groupBy) {
        params.append('groupBy', groupBy);
      }
      params.append('page', String(page));
      params.append('limit', String(limit));
      return apiGet(`/assets?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  const assets = assetsResponse?.assets || [];
  const total = assetsResponse?.total || 0;
  const totalValuation = assetsResponse?.totalValuation || 0;
  const facets = assetsResponse?.facets;
  const groupedBuckets = assetsResponse?.groups || [];
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const visibleIds = useMemo(() => assets.map((a) => a.id), [assets]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSort = (field: string, isShiftKey = false) => {
    if (isShiftKey && field !== sortBy) {
      if (sortBy2 === field) {
        setSortOrder2((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy2(field);
        setSortOrder2('asc');
      }
      setPage(1);
      return;
    }
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
      );
    }
    if (sortBy2 === field) {
      return sortOrder2 === 'asc' ? (
        <ArrowUp className="w-3 h-3 text-amber-600" />
      ) : (
        <ArrowDown className="w-3 h-3 text-amber-600" />
      );
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
  };

  const toggleSmartTag = (tag: string) => {
    const cur = searchInput.trim();
    if (cur.toLowerCase().includes(tag.toLowerCase())) {
      const next = cur
        .split(/\s+/)
        .filter((t) => t.toLowerCase() !== tag.toLowerCase())
        .join(' ');
      setSearchInput(next);
    } else {
      setSearchInput(cur ? `${cur} ${tag}` : tag);
    }
  };

  const handleDrillIntoGroup = (gMode: string, gKey: string) => {
    if (gMode === 'floor') {
      setSelectedFloor(gKey);
    } else if (gMode === 'function') {
      if (gKey === 'DUOC') setActiveTab('DUOC');
      else if (gKey === 'CNTT') setActiveTab('CNTT');
      else {
        const meta = TCHC_GROUP_META[gKey];
        if (meta) {
          setActiveTab(meta.scope === 'ME' ? 'TCHC_TOANHA' : 'TCHC_HC');
          setSelectedAssetGroup(gKey);
        }
      }
    } else if (gMode === 'managingUnit') {
      setActiveTab(gKey);
    } else if (gMode === 'department' && gKey !== 'NONE') {
      setSelectedDept(gKey);
    } else if (gMode === 'location') {
      setSelectedLocation(gKey);
    }
    setGroupBy('');
    setPage(1);
  };

  const handleDelete = async (id: number, name: string) => {
    const accepted = await confirm({
      title: 'Xác nhận xóa thiết bị',
      message: `Bạn có chắc chắn muốn xóa thiết bị "${name}" khỏi danh mục? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa thiết bị',
      cancelLabel: 'Hủy',
      variant: 'danger',
    });
    if (!accepted) return;

    try {
      await apiDelete(`/assets/${id}`);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success(`Đã xóa thiết bị "${name}" thành công.`);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa tài sản');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams(buildFilterParams);
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      if (sortBy2) {
        params.append('sortBy2', sortBy2);
        params.append('sortOrder2', sortOrder2);
      }
      const res = await fetch(`/api/export/assets?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Không thể xuất file Excel');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `danh_sach_tai_san_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất danh sách tài sản ra file Excel.');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xuất Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenQrStudio = async (mode: 'selected' | 'filtered') => {
    setPrintingBatch(true);
    try {
      if (mode === 'selected' && selectedIds.length > 0) {
        const selectedAssets = await Promise.all(
          selectedIds.map(async (id) => {
            const cached = assets.find((a) => a.id === id);
            return cached || ((await apiGet(`/assets/${id}`)) as Asset);
          })
        );
        setQrModalAssets(selectedAssets);
        setQrModalContext(`${selectedAssets.length} thiết bị đã chọn`);
        setQrModalOpen(true);
        return;
      }

      if (total <= assets.length && assets.length > 0) {
        setQrModalAssets(assets);
        setQrModalContext(`Danh sách lọc (${assets.length} thiết bị)`);
        setQrModalOpen(true);
        return;
      }

      const params = new URLSearchParams(buildFilterParams.toString());
      params.set('limit', '600');
      params.set('page', '1');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      if (sortBy2) {
        params.set('sortBy2', sortBy2);
        params.set('sortOrder2', sortOrder2);
      }

      const res = (await apiGet(`/assets?${params.toString()}`)) as { assets?: Asset[]; total?: number };
      const fetched = res?.assets || [];
      if (fetched.length === 0) {
        toast.warning('Không có thiết bị nào khớp bộ lọc để xuất tem QR.');
        return;
      }
      if ((res?.total || total) > 600) {
        toast.info(`Đã nạp 600 thiết bị đầu tiên trong ${ (res?.total || total).toLocaleString('vi-VN') } kết quả. Bạn có thể lọc thêm Khoa/Tầng để in gọn hơn.`);
      }
      setQrModalAssets(fetched);
      setQrModalContext(`Danh sách đang lọc (${fetched.length} thiết bị)`);
      setQrModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải dữ liệu xuất tem QR');
    } finally {
      setPrintingBatch(false);
    }
  };

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedFloor('Tất cả tầng');
    setSelectedCategory('');
    setSelectedAssetGroup('');
    if (!isDeptUser) setSelectedDept('');
    setSelectedStatus('');
    setSelectedLocation('');
    setSortBy('assetCode');
    setSortOrder('asc');
    setSortBy2('');
    setSortOrder2('asc');
    setGroupBy('');
    setPage(1);
  };

  const isViewer = user?.role === 'VIEWER';
  const divisionTabs = [
    ...(user?.role === 'ADMIN' || isViewer || isDeptUser
      ? [{ id: 'ALL', label: 'Tất cả CDC', icon: Layers }]
      : []),
    ...(user?.role === 'ADMIN' || isViewer || user?.role === 'MANAGER_DUOC' || isDeptUser
      ? [{ id: 'DUOC', label: 'Khoa Dược (TBYT)', icon: Stethoscope }]
      : []),
    ...(user?.role === 'ADMIN' || isViewer || user?.role === 'MANAGER_CNTT' || isDeptUser
      ? [{ id: 'CNTT', label: 'Tổ CNTT (IT)', icon: Monitor }]
      : []),
    ...(user?.role === 'ADMIN' || isViewer || user?.role === 'MANAGER_TCHC' || isDeptUser
      ? [
          { id: 'TCHC_HC', label: 'TCHC · Hành chính (Khoa)', icon: Building2 },
          { id: 'TCHC_TOANHA', label: 'TCHC · Cơ điện Tòa nhà (M&E)', icon: Layers },
        ]
      : []),
  ];

  const activeAdvancedCount = [
    selectedDept && !isDeptUser ? selectedDept : '',
    selectedCategory,
    selectedFloor !== 'Tất cả tầng' ? selectedFloor : '',
    selectedLocation,
  ].filter(Boolean).length;

  const hasAnyFilter = Boolean(
    debouncedSearch ||
      selectedStatus ||
      selectedAssetGroup ||
      activeAdvancedCount > 0 ||
      sortBy !== 'assetCode' ||
      sortOrder !== 'asc' ||
      sortBy2 ||
      groupBy
  );

  const visibleTchcGroups = useMemo(() => {
    if (activeTab === 'TCHC_HC') return TCHC_GROUP_OPTIONS.filter((g) => g.scope === 'HC');
    if (activeTab === 'TCHC_TOANHA') return TCHC_GROUP_OPTIONS.filter((g) => g.scope === 'ME');
    if (activeTab === 'ALL' || selectedAssetGroup) return TCHC_GROUP_OPTIONS;
    return [];
  }, [activeTab, selectedAssetGroup]);

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Danh Mục Quản Lý Tài Sản CDC
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 flex items-center gap-2">
            <span>
              Hiển thị{' '}
              <strong className="font-heading font-semibold text-slate-800 tabular-nums">
                {total.toLocaleString('vi-VN')}
              </strong>{' '}
              tài sản
            </span>
            {isFetching && (
              <span className="inline-flex items-center gap-1 text-blue-600 text-xs">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Đang đồng bộ...
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {user?.role !== 'VIEWER' && (
            <button
              type="button"
              onClick={() => navigate('/maintenance?quickReport=1')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition cursor-pointer"
              title="Mở nhanh phiếu báo hỏng thiết bị"
              aria-label="Báo hỏng nhanh"
            >
              <Wrench className="w-4 h-4 text-amber-600" />
              <span className="hidden lg:inline">Báo hỏng</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/qr-scanner')}
            title="Quét mã QR thiết bị"
            aria-label="Quét mã QR"
            className="hidden sm:flex p-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-slate-600" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenQrStudio(selectedIds.length > 0 ? 'selected' : 'filtered')}
            disabled={printingBatch || total === 0}
            title="Xuất & In nhiều tem QR kiểm kê trên trang A4 theo bộ lọc hoặc dòng đang chọn"
            aria-label="Xuất tem QR A4"
            className="flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 py-1.5 sm:py-2 rounded-md border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-800 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-blue-700" />
            <span className="hidden md:inline">
              {printingBatch
                ? 'Đang mở...'
                : selectedIds.length > 0
                ? `QR (${selectedIds.length})`
                : 'Tem QR'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            title="Xuất file Excel danh sách tài sản"
            aria-label="Xuất Excel"
            className="flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 py-1.5 sm:py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline">{exporting ? 'Đang xuất...' : 'Excel'}</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => navigate('/assets/new')}
              title="Thêm tài sản mới"
              className="flex items-center gap-1.5 min-h-[36px] sm:min-h-0 px-3 py-1.5 sm:py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm TS</span>
            </button>
          )}
        </div>
      </div>

      {/* Unified Top Bar: Division Segmented Tabs + Group-by View Switcher */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:flex-wrap">
          {divisionTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'TCHC_HC' || tab.id === 'TCHC_TOANHA') {
                    setQuickFacetMode('function');
                  }
                  if (selectedAssetGroup) {
                    const meta = TCHC_GROUP_META[selectedAssetGroup];
                    const keepGroup =
                      tab.id === 'ALL' ||
                      (tab.id === 'TCHC_HC' && meta?.scope === 'HC') ||
                      (tab.id === 'TCHC_TOANHA' && meta?.scope === 'ME');
                    if (!keepGroup) setSelectedAssetGroup('');
                  }
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Compact Group-by View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl overflow-x-auto no-scrollbar w-full lg:w-auto">
          <span className="text-[11px] font-semibold text-slate-500 pl-2 pr-1 hidden sm:inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
            <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
            Góc nhìn:
          </span>
          {GROUP_BY_OPTIONS.map((opt) => {
            const active = groupBy === opt.value;
            return (
              <button
                key={opt.value || 'FLAT'}
                type="button"
                title={opt.label}
                onClick={() => {
                  setGroupBy(opt.value);
                  setExpandedGroups({});
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-blue-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* UI/UX Pro Max: 2-Tier Compact Omnibox Search & Facet Command Deck */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-2.5 sm:p-3 space-y-2.5 relative">
        {/* Tier 1: Unified Single-Row Omnibox + Mobile Filter Trigger + Desktop Selectors */}
        <div className="flex flex-col xl:flex-row gap-2">
          {/* Omnibox Input + Mobile Collapsible Filter Toggle */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm mã TS, tên máy, khoa, người SD..."
                className="w-full pl-9 pr-20 py-2 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 outline-none transition"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded">
                    /
                  </kbd>
                )}
                <button
                  type="button"
                  onClick={() => setShowSmartHints((prev) => !prev)}
                  title="Mở bảng gợi ý từ khóa & cú pháp thông minh"
                  aria-label="Cú pháp tìm kiếm"
                  className={`p-1.5 sm:px-2 sm:py-1 rounded-md text-[11px] font-semibold border transition cursor-pointer inline-flex items-center gap-1 ${
                    showSmartHints
                      ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Cú pháp</span>
                </button>
              </div>

              {/* Floating Smart Search Assistant Popover */}
              {showSmartHints && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-heading font-semibold text-slate-900 inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Trợ lý Siêu Tìm Kiếm Đa Trường (14 cột dữ liệu)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSmartHints(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-500">
                      1. Bấm chèn nhanh thẻ lọc thông minh (Smart Tags):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SMART_TAG_EXAMPLES.map((item) => {
                        const active = searchInput.toLowerCase().includes(item.tag.toLowerCase());
                        return (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => toggleSmartTag(item.tag)}
                            className={`px-2.5 py-1 rounded-md font-mono text-[11px] border transition cursor-pointer inline-flex items-center gap-1 ${
                              active
                                ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className={`font-sans text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                              · {item.desc}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-500">
                      2. Cụm từ tìm kiếm chéo nhiều trường mẫu (1-Click):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'điều hòa tầng 3',
                        'bàn xét nghiệm',
                        'tủ hồ sơ khnv',
                        'xe ô tô',
                        'máy phát điện',
                        'máy in pkđk',
                      ].map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => {
                            setSearchInput(phrase);
                            setShowSmartHints(false);
                          }}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-medium transition cursor-pointer"
                        >
                          "{phrase}"
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowMobileFilters((v) => !v)}
              title="Mở bộ lọc"
              aria-label="Mở bộ lọc"
              className={`md:hidden shrink-0 inline-flex items-center justify-center gap-1 min-h-[38px] px-2.5 py-1.5 rounded-md border text-xs font-semibold transition cursor-pointer ${
                showMobileFilters || hasAnyFilter
                  ? 'border-blue-300 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              {hasAnyFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />}
            </button>
          </div>

          {/* Inline High-Frequency Filter & Sort Controls */}
          <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center gap-1.5`}>
            {!isDeptUser && (
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo Khoa / Phòng"
                className={`px-2.5 py-2 rounded-xl border text-xs font-medium outline-none transition cursor-pointer max-w-[185px] ${
                  selectedDept
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <option value="">Khoa/Phòng ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name.replace(/\s*\((?:Cơ sở|Cs)\s*[12]\)/gi, '')}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo Tầng"
              className={`px-2.5 py-2 rounded-xl border text-xs font-medium outline-none transition cursor-pointer max-w-[155px] ${
                selectedFloor !== 'Tất cả tầng'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {FLOOR_PILL_OPTIONS.map((fl) => {
                const cnt = fl.value === 'Tất cả tầng' ? undefined : facets?.floors?.[fl.value];
                return (
                  <option key={fl.value} value={fl.value}>
                    {fl.fullLabel}
                    {cnt !== undefined ? ` (${cnt})` : ''}
                  </option>
                );
              })}
            </select>

            {visibleTchcGroups.length > 0 && (
              <select
                value={selectedAssetGroup}
                onChange={(e) => {
                  setSelectedAssetGroup(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo Nhóm chức năng"
                className={`px-2.5 py-2 rounded-xl border text-xs font-medium outline-none transition cursor-pointer max-w-[175px] ${
                  selectedAssetGroup
                    ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <option value="">Nhóm chức năng ({visibleTchcGroups.length})</option>
                {visibleTchcGroups.map((g) => {
                  const cnt = facets?.functions?.[g.value];
                  return (
                    <option key={g.value} value={g.value}>
                      {g.label}
                      {cnt !== undefined ? ` (${cnt})` : ''}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Compact Primary Sort Pill + Direction Toggle */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                aria-label="Tiêu chí sắp xếp chính"
                className="px-2.5 py-2 text-xs font-semibold text-slate-800 bg-white outline-none cursor-pointer max-w-[170px]"
              >
                {SUPER_SORT_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    Sắp xếp: {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title="Đảo chiều sắp xếp"
                className="px-2 py-2 border-l border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-700 font-semibold text-xs inline-flex items-center gap-0.5 cursor-pointer"
              >
                {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Advanced Sort / Extra Filters Popover Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              title="Sắp xếp Lớp 2, Cơ sở, Danh mục & Số dòng/trang"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium transition cursor-pointer ${
                showAdvancedFilters || sortBy2 || selectedLocation || selectedCategory
                  ? 'border-blue-300 bg-blue-50/70 text-blue-700 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nâng cao</span>
              {(sortBy2 || selectedLocation || selectedCategory) && (
                <span className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </button>
          </div>
        </div>

        {/* Tier 2: Single-Line Tabbed Quick Facet Strip (Floor | Function | Status) */}
        <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100`}>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap w-full sm:w-auto pb-0.5 sm:pb-0 min-w-0">
            {/* Mini Dimension Switcher */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200/70 mr-1 shrink-0">
              <button
                type="button"
                onClick={() => setQuickFacetMode('floor')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                  quickFacetMode === 'floor'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tầng
              </button>
              {visibleTchcGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuickFacetMode('function')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    quickFacetMode === 'function'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Chức năng
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuickFacetMode('status')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                  quickFacetMode === 'status'
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Trạng thái
              </button>
            </div>

            {/* Active Dimension Pills (Only 1 row shown at a time!) */}
            {quickFacetMode === 'floor' &&
              FLOOR_PILL_OPTIONS.map((fl) => {
                const active = selectedFloor === fl.value;
                const count = fl.value === 'Tất cả tầng' ? undefined : facets?.floors?.[fl.value] ?? 0;
                if (fl.value !== 'Tất cả tầng' && count === 0 && !active) return null;
                return (
                  <button
                    key={fl.value}
                    type="button"
                    title={fl.fullLabel}
                    onClick={() => {
                      setSelectedFloor(active && fl.value !== 'Tất cả tầng' ? 'Tất cả tầng' : fl.value);
                      setPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span>{fl.shortLabel}</span>
                    {count !== undefined && (
                      <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                        ({count.toLocaleString('vi-VN')})
                      </span>
                    )}
                  </button>
                );
              })}

            {quickFacetMode === 'function' &&
              visibleTchcGroups.map((grp) => {
                const active = selectedAssetGroup === grp.value;
                const grpCount = facets?.functions?.[grp.value];
                return (
                  <button
                    key={grp.value}
                    type="button"
                    onClick={() => {
                      setSelectedAssetGroup(active ? '' : grp.value);
                      setPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-medium border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                        : `${grp.badgeClass} opacity-90 hover:opacity-100`
                    }`}
                  >
                    <span>{grp.label}</span>
                    {grpCount !== undefined && (
                      <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'opacity-75'}`}>
                        ({grpCount.toLocaleString('vi-VN')})
                      </span>
                    )}
                  </button>
                );
              })}

            {quickFacetMode === 'status' &&
              QUICK_STATUS_CHIPS.map((chip) => {
                const active = selectedStatus === chip.value;
                const stCount = chip.value ? facets?.statuses?.[chip.value] : undefined;
                return (
                  <button
                    key={chip.value || 'ALL'}
                    type="button"
                    onClick={() => {
                      setSelectedStatus(active && chip.value ? '' : chip.value);
                      setPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded-md text-xs font-medium border transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span>{chip.label}</span>
                    {stCount !== undefined && stCount > 0 && (
                      <span className={`text-[10px] tabular-nums ${active ? 'text-slate-200' : 'text-slate-400'}`}>
                        ({stCount.toLocaleString('vi-VN')})
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Removable Active Filter Chips Summary */}
          {hasAnyFilter && (
            <div className="flex items-center gap-1 flex-wrap">
              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>Tìm: "{debouncedSearch}"</span>
                  <button type="button" onClick={() => setSearchInput('')} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedFloor !== 'Tất cả tầng' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>{selectedFloor === 'NONE' ? 'Dùng chung' : selectedFloor}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedFloor('Tất cả tầng')}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedAssetGroup && TCHC_GROUP_META[selectedAssetGroup] && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>{TCHC_GROUP_META[selectedAssetGroup].label}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAssetGroup('')}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedLocation && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>{selectedLocation}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedLocation('')}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {sortBy2 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                  <span>Lớp 2: {SUPER_SORT_FIELDS.find((f) => f.value === sortBy2)?.label}</span>
                  <button type="button" onClick={() => setSortBy2('')} className="hover:text-rose-600 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetFilters}
                className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold transition cursor-pointer"
              >
                Xóa lọc
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Advanced Drawer (2nd-Level Sort, Facility, Category, Page Size) */}
        {showAdvancedFilters && (
          <div className="pt-2.5 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/50 -mx-3 -mb-3 p-3 rounded-b-2xl">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Sắp xếp phụ (Lớp 2)
              </label>
              <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
                <select
                  value={sortBy2}
                  onChange={(e) => {
                    setSortBy2(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1 px-2.5 py-1.5 text-xs text-slate-700 bg-white outline-none"
                >
                  <option value="">-- Không dùng lớp 2 --</option>
                  {SUPER_SORT_FIELDS.filter((f) => f.value !== sortBy).map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {sortBy2 && (
                  <button
                    type="button"
                    onClick={() => setSortOrder2((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="px-2.5 py-1.5 border-l border-slate-200 bg-amber-50 text-amber-800 text-xs font-semibold cursor-pointer"
                  >
                    {sortOrder2 === 'asc' ? 'Thuận ↑' : 'Ngược ↓'}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cơ sở đặt máy</label>
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 outline-none focus:border-blue-600"
              >
                <option value="">Tất cả Cơ sở</option>
                <option value="Cơ sở 1">Cơ sở 1 (118 Lê Đình Lý)</option>
                <option value="Cơ sở 2">Cơ sở 2 (Bàn Thạch)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Danh mục chuẩn</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 outline-none focus:border-blue-600"
              >
                <option value="">Tất cả danh mục ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Số dòng mỗi trang
              </label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 outline-none focus:border-blue-600"
              >
                <option value={15}>15 thiết bị / trang</option>
                <option value={30}>30 thiết bị / trang</option>
                <option value={50}>50 thiết bị / trang</option>
                <option value={100}>100 thiết bị / trang</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="print-hidden bg-slate-900 text-white rounded-2xl px-4 py-2.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 font-heading font-semibold tabular-nums">
              {selectedIds.length} đã chọn
            </span>
            <span className="text-slate-300">Thao tác nhanh trên các thiết bị đang chọn:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenQrStudio('selected')}
              disabled={printingBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printingBatch ? 'Đang tạo nhãn...' : 'Xuất tem QR A4'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel lọc</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* Group-by Accordion View (when groupBy is active) */}
      {groupBy && (
        <div className="space-y-2.5">
          <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600">
              <span className="font-heading font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4 text-blue-600" />
                {GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label}
              </span>
              <span>
                Số nhóm: <strong className="text-slate-900 tabular-nums">{groupedBuckets.length}</strong>
              </span>
              <span>
                Tổng thiết bị:{' '}
                <strong className="text-blue-700 tabular-nums">{total.toLocaleString('vi-VN')}</strong>
              </span>
              {totalValuation > 0 && (
                <span>
                  Tổng nguyên giá:{' '}
                  <strong className="text-slate-900 tabular-nums">
                    {totalValuation.toLocaleString('vi-VN')} đ
                  </strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  groupedBuckets.forEach((b) => {
                    next[b.key] = true;
                  });
                  setExpandedGroups(next);
                }}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Mở rộng tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  groupedBuckets.forEach((b) => {
                    next[b.key] = false;
                  });
                  setExpandedGroups(next);
                }}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                Thu gọn tất cả
              </button>
            </div>
          </div>

          {groupedBuckets.map((bucket, idx) => {
            const isOpen = expandedGroups[bucket.key] ?? idx < 2;
            const fnBadge = groupBy === 'function' ? FUNCTION_BADGE_MAP[bucket.key] : null;
            return (
              <div
                key={bucket.key}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <div
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [bucket.key]: !isOpen,
                    }))
                  }
                  className="px-4 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${
                        isOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    {fnBadge && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${fnBadge.className}`}
                      >
                        {fnBadge.label}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-heading text-sm font-semibold text-slate-900 truncate">
                        {bucket.label}
                      </div>
                      {bucket.subtitle && (
                        <div className="text-[11px] text-slate-500 truncate">{bucket.subtitle}</div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-heading font-semibold tabular-nums">
                      {bucket.count.toLocaleString('vi-VN')} thiết bị
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium tabular-nums">
                      {bucket.healthyCount.toLocaleString('vi-VN')} đang SD
                    </span>
                    {bucket.issueCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium tabular-nums">
                        {bucket.issueCount.toLocaleString('vi-VN')} cần chú ý
                      </span>
                    )}
                    {bucket.totalValue > 0 && (
                      <span className="text-xs font-semibold text-slate-700 tabular-nums px-2">
                        {bucket.totalValue.toLocaleString('vi-VN')} đ
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrillIntoGroup(groupBy, bucket.key);
                      }}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold transition cursor-pointer"
                    >
                      Lọc riêng nhóm này →
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-200/80 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white border-b border-slate-100 text-[11px] font-heading font-semibold uppercase text-slate-400">
                          <th className="px-3 py-2 w-[140px]">Mã TS</th>
                          <th className="px-3 py-2">Tên thiết bị &amp; Cấu hình</th>
                          <th className="px-3 py-2 w-[26%]">Đơn vị · Khoa Phòng · Tầng</th>
                          <th className="px-3 py-2 w-[130px] text-right">Nguyên giá</th>
                          <th className="px-3 py-2 w-[120px]">Trạng thái</th>
                          <th className="px-3 py-2 w-[80px] text-right">Xem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bucket.items.map((item: Asset) => {
                          const uInfo = item.managingUnit ? UNIT_BADGE[item.managingUnit] : null;
                          const fKey = getAssetFunctionKey(item);
                          const fBadge = FUNCTION_BADGE_MAP[fKey];
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 align-top font-mono font-medium text-blue-700">
                                <button
                                  type="button"
                                  onClick={() => setQuickViewAssetId(item.id)}
                                  className="hover:underline text-left cursor-pointer"
                                >
                                  {item.assetCode}
                                </button>
                                {item.oldAssetCode && (
                                  <div className="text-[10px] text-slate-400">{item.oldAssetCode}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => setQuickViewAssetId(item.id)}
                                  className="font-semibold text-slate-900 hover:text-blue-700 text-left cursor-pointer"
                                >
                                  {item.name}
                                </button>
                                {item.specifications && (
                                  <div className="text-[11px] text-slate-400 truncate max-w-md">
                                    {item.specifications}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {uInfo && (
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${uInfo.className}`}
                                    >
                                      {uInfo.label}
                                    </span>
                                  )}
                                  {fBadge && item.managingUnit === 'TCHC' && (
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${fBadge.className}`}
                                    >
                                      {fBadge.label}
                                    </span>
                                  )}
                                  <span className="font-medium text-slate-700">
                                    {item.department?.name || 'Chưa phân bổ'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {[item.location, item.floor, item.locationDetail, item.assignedTo]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </div>
                              </td>
                              <td className="px-3 py-2 align-top text-right tabular-nums font-semibold text-slate-800">
                                {item.originalPrice && item.originalPrice > 0 ? (
                                  `${item.originalPrice.toLocaleString('vi-VN')} đ`
                                ) : (
                                  <span className="text-slate-400 font-normal text-[11px]">Chưa tách giá</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top">
                                <StatusBadge status={item.status} compact />
                              </td>
                              <td className="px-3 py-2 align-top text-right">
                                <button
                                  type="button"
                                  onClick={() => setQuickViewAssetId(item.id)}
                                  className="px-2 py-1 rounded-md border border-slate-200 hover:bg-blue-50 text-blue-700 text-[11px] font-medium cursor-pointer"
                                >
                                  Mở
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {bucket.count > bucket.items.length && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-center">
                        <button
                          type="button"
                          onClick={() => handleDrillIntoGroup(groupBy, bucket.key)}
                          className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                        >
                          Đang hiển thị {bucket.items.length} thiết bị đầu tiên · Bấm để xem toàn bộ{' '}
                          {bucket.count.toLocaleString('vi-VN')} thiết bị của nhóm "{bucket.label}" →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Zero-Overflow Data Table (Flat Mode) */}
      {!groupBy && (
        <>
          <DataTableShell
          className="hidden md:block"
          title="Danh sách tài sản cố định & CCDC"
          totalCount={total}
          countLabel="thiết bị"
          density={density}
          onDensityChange={setDensity}
          loading={false}
          isEmpty={!isLoading && assets.length === 0}
          emptyMessage="Không tìm thấy thiết bị nào khớp bộ lọc hiện tại."
          toolbarExtra={
            totalValuation > 0 ? (
              <span className="text-xs text-slate-500 hidden lg:inline">
                Tổng nguyên giá lọc:{' '}
                <strong className="text-slate-900 tabular-nums">
                  {totalValuation.toLocaleString('vi-VN')} đ
                </strong>
              </span>
            ) : undefined
          }
        >
          <table className="w-full table-fixed text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
                <th className={`w-10 px-3 ${headPy} text-center`}>
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    aria-label="Chọn tất cả dòng trên trang"
                    className="text-slate-400 hover:text-blue-700 cursor-pointer inline-flex items-center justify-center"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-700" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className={`w-[138px] px-3 ${headPy} whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={(e) => handleSort('assetCode', e.shiftKey)}
                    title="Bấm để sắp xếp Mã TS (Giữ Shift + Click để thêm làm sắp xếp phụ)"
                    className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                  >
                    <span>Mã tài sản</span>
                    {renderSortIcon('assetCode')}
                  </button>
                </th>
                <th className={`px-3 ${headPy} whitespace-nowrap`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleSort('name', e.shiftKey)}
                      title="Sắp xếp theo Tên thiết bị (Shift + Click: sắp xếp phụ)"
                      className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                    >
                      <span>Tên thiết bị</span>
                      {renderSortIcon('name')}
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={(e) => handleSort('function', e.shiftKey)}
                      title="Sắp xếp theo Chức năng / Nhóm chuyên môn (Shift + Click: sắp xếp phụ)"
                      className="inline-flex items-center gap-1 hover:text-blue-700 cursor-pointer text-[10px]"
                    >
                      <span>Chức năng</span>
                      {renderSortIcon('function')}
                    </button>
                  </div>
                </th>
                <th className={`w-[24%] px-3 ${headPy} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => handleSort('managingUnit', e.shiftKey)}
                      title="Sắp xếp theo Đơn vị quản lý (Dược → CNTT → TCHC)"
                      className="inline-flex items-center gap-0.5 hover:text-blue-700 cursor-pointer"
                    >
                      <span>Đơn vị</span>
                      {renderSortIcon('managingUnit')}
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={(e) => handleSort('department', e.shiftKey)}
                      title="Sắp xếp theo Khoa / Phòng sử dụng"
                      className="inline-flex items-center gap-0.5 hover:text-blue-700 cursor-pointer"
                    >
                      <span>Khoa</span>
                      {renderSortIcon('department')}
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={(e) => handleSort('floor', e.shiftKey)}
                      title="Sắp xếp theo Trục Tầng vật lý (Hầm → T1..T7 → Mái → KLCTN)"
                      className="inline-flex items-center gap-0.5 hover:text-blue-700 cursor-pointer"
                    >
                      <span>Tầng</span>
                      {renderSortIcon('floor')}
                    </button>
                  </div>
                </th>
                <th className={`w-[134px] px-3 ${headPy} text-right whitespace-nowrap`}>
                  <div className="inline-flex items-center justify-end gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={(e) => handleSort('originalPrice', e.shiftKey)}
                      title="Sắp xếp theo Nguyên giá"
                      className="inline-flex items-center gap-0.5 hover:text-slate-800 cursor-pointer"
                    >
                      <span>Giá</span>
                      {renderSortIcon('originalPrice')}
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={(e) => handleSort('yearInUse', e.shiftKey)}
                      title="Sắp xếp theo Năm đưa vào sử dụng"
                      className="inline-flex items-center gap-0.5 hover:text-blue-700 cursor-pointer text-[10px]"
                    >
                      <span>Năm</span>
                      {renderSortIcon('yearInUse')}
                    </button>
                  </div>
                </th>
                <th className={`w-[126px] px-3 ${headPy} whitespace-nowrap`}>
                  <button
                    type="button"
                    onClick={(e) => handleSort('status', e.shiftKey)}
                    title="Sắp xếp theo Trạng thái thiết bị"
                    className="inline-flex items-center gap-1 hover:text-slate-800 cursor-pointer"
                  >
                    <span>Trạng thái</span>
                    {renderSortIcon('status')}
                  </button>
                </th>
                <th className={`w-[92px] px-3 ${headPy} text-right whitespace-nowrap`}>Thao tác</th>
              </tr>
            </thead>

          <tbody
            className={`divide-y divide-slate-100 text-[13px] transition-opacity ${
              isPlaceholderData ? 'opacity-60' : 'opacity-100'
            }`}
          >
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-3.5" colSpan={7}>
                    <div className="h-5 bg-slate-100 rounded-lg w-full" />
                  </td>
                </tr>
              ))
            ) : (
              assets.map((asset) => {
                const isSelected = selectedIds.includes(asset.id);
                const unitInfo = asset.managingUnit ? UNIT_BADGE[asset.managingUnit] : null;
                const techLine =
                  asset.specifications ||
                  [asset.manufacturer, asset.countryOfOrigin].filter(Boolean).join(' · ');

                return (
                  <tr
                    key={asset.id}
                    className={`group transition-colors ${
                      isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className={`px-3 ${cellPy} text-center align-top pt-3`}>
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(asset.id)}
                        aria-label={`Chọn ${asset.assetCode}`}
                        className="text-slate-400 hover:text-blue-700 cursor-pointer inline-flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-700" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    <td className={`px-3 ${cellPy} align-top max-w-[138px]`}>
                      <button
                        type="button"
                        onClick={() => setQuickViewAssetId(asset.id)}
                        title={asset.assetCode}
                        className="block max-w-full truncate font-mono text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline text-left cursor-pointer"
                      >
                        {asset.assetCode}
                      </button>
                      {asset.oldAssetCode && (
                        <div
                          className="font-mono text-[11px] text-slate-400 mt-0.5 truncate"
                          title={asset.oldAssetCode}
                        >
                          {asset.oldAssetCode}
                        </div>
                      )}
                    </td>

                    <td className={`px-3 ${cellPy} align-top min-w-0`}>
                      <button
                        type="button"
                        onClick={() => setQuickViewAssetId(asset.id)}
                        title={asset.name}
                        className="font-heading font-semibold text-[13px] text-slate-900 hover:text-blue-700 text-left leading-snug line-clamp-2 break-words cursor-pointer"
                      >
                        {asset.name}
                      </button>
                      {techLine ? (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-snug" title={techLine}>
                          {techLine}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {asset.category?.name || 'Thiết bị chung'}
                        </div>
                      )}
                    </td>

                    <td className={`px-3 ${cellPy} align-top min-w-0`}>
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        {unitInfo && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0 ${unitInfo.className}`}
                          >
                            {unitInfo.label}
                          </span>
                        )}
                        {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] && (
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0 ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}
                          >
                            {TCHC_GROUP_META[asset.assetGroup].label}
                          </span>
                        )}
                        <span
                          className="text-xs font-medium text-slate-700 truncate"
                          title={asset.department?.name}
                        >
                          {asset.department?.name || 'Chưa phân bổ'}
                        </span>
                      </div>
                      <div
                        className="text-[11px] text-slate-500 mt-0.5 truncate"
                        title={[asset.location, asset.floor, asset.assignedTo].filter(Boolean).join(' · ')}
                      >
                        {[asset.location, asset.floor].filter(Boolean).join(' · ') || '—'}
                        {asset.assignedTo ? ` · SD: ${asset.assignedTo}` : ''}
                      </div>
                    </td>

                    <td className={`px-3 ${cellPy} align-top text-right whitespace-nowrap`}>
                      {asset.originalPrice && asset.originalPrice > 0 ? (
                        <div className="font-semibold text-slate-900 tabular-nums">
                          {asset.originalPrice.toLocaleString('vi-VN')} đ
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic" title="Nằm trong gói thầu chung hoặc chưa tách đơn giá lẻ">
                          Chưa tách giá
                        </div>
                      )}
                      <div className="text-xs text-slate-400 tabular-nums mt-0.5">
                        {asset.yearInUse ? `Năm SD: ${asset.yearInUse}` : '—'}
                      </div>
                    </td>

                    <td className={`px-3 ${cellPy} align-top whitespace-nowrap`}>
                      <StatusBadge status={asset.status} compact />
                    </td>

                    <td className={`px-3 ${cellPy} align-top text-right whitespace-nowrap`}>
                      <RowActionMenu
                        primary={{
                          title: 'Xem nhanh',
                          icon: <PanelRightOpen className="w-3.5 h-3.5" />,
                          onClick: () => setQuickViewAssetId(asset.id),
                          tone: 'blue',
                        }}
                        items={[
                          {
                            label: 'Mở hồ sơ chi tiết',
                            icon: <Eye className="w-3.5 h-3.5" />,
                            onClick: () => navigate(`/assets/${asset.id}`),
                          },
                          {
                            label: 'Báo hỏng thiết bị này',
                            icon: <Wrench className="w-3.5 h-3.5" />,
                            onClick: () => navigate(`/maintenance?assetId=${asset.id}`),
                            hidden: user?.role === 'VIEWER',
                          },
                          {
                            label: 'Chỉnh sửa',
                            icon: <Edit className="w-3.5 h-3.5" />,
                            onClick: () => navigate(`/assets/${asset.id}/edit`),
                            hidden: !canManage,
                          },
                          {
                            label: 'Xóa tài sản',
                            icon: <Trash2 className="w-3.5 h-3.5" />,
                            onClick: () => handleDelete(asset.id, asset.name),
                            danger: true,
                            hidden: !canManage,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataTableShell>

      {/* Mobile Card List (< md) */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-5 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : assets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Không tìm thấy thiết bị nào khớp bộ lọc hiện tại.
          </div>
        ) : (
          assets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3.5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-medium text-blue-700">
                      {asset.assetCode}
                    </span>
                    {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}
                      >
                        {TCHC_GROUP_META[asset.assetGroup].label}
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-sm font-semibold text-slate-900 mt-0.5 leading-snug">
                    {asset.name}
                  </h3>
                </div>
                <StatusBadge status={asset.status} compact />
              </div>

              <div className="text-xs text-slate-500 space-y-0.5">
                <div>{asset.department?.name || 'Chưa phân bổ'}</div>
                <div>
                  {[asset.location, asset.floor, asset.assignedTo ? `SD: ${asset.assignedTo}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-800 tabular-nums">
                  {asset.originalPrice && asset.originalPrice > 0
                    ? `${asset.originalPrice.toLocaleString('vi-VN')} đ`
                    : 'Chưa tách giá lẻ'}
                </div>
                <div className="flex items-center gap-1.5">
                  {user?.role !== 'VIEWER' && (
                    <button
                      type="button"
                      onClick={() => navigate(`/maintenance?assetId=${asset.id}`)}
                      className="h-10 px-2.5 rounded-md border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 inline-flex items-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Báo hỏng</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setQuickViewAssetId(asset.id)}
                    className="h-10 px-3 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                  >
                    <PanelRightOpen className="w-3.5 h-3.5" />
                    <span>Xem nhanh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="h-10 px-3 rounded-md bg-blue-700 text-white text-xs font-medium inline-flex items-center gap-1"
                  >
                    <span>Chi tiết</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200/80 shadow-xs text-xs text-slate-600">
        <div>
          Trang{' '}
          <strong className="font-heading font-semibold text-slate-900 tabular-nums">{page}</strong> /{' '}
          <span className="tabular-nums">{totalPages}</span> · Tổng{' '}
          <strong className="font-heading font-semibold text-slate-900 tabular-nums">
            {total.toLocaleString('vi-VN')}
          </strong>{' '}
          thiết bị
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trước</span>
          </button>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 min-h-[38px] sm:min-h-0 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
        </>
      )}

      {/* Quick-View Slide-Over Drawer */}
      <AssetQuickDrawer
        assetId={quickViewAssetId}
        canManage={canManage}
        onClose={() => setQuickViewAssetId(null)}
        onNavigate={(to) => {
          setQuickViewAssetId(null);
          navigate(to);
        }}
      />

      <QrLabelPrintModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        assets={qrModalAssets}
        defaultTitle="CDC ĐÀ NẴNG · KIỂM KÊ 2026"
        contextLabel={qrModalContext}
        quantitySourceLabel="Số lượng"
      />
    </div>
  );
}
