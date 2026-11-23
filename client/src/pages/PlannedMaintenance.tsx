import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, AlertTriangle, CheckCircle2, Clock, Calendar, 
  Search, Printer, DollarSign, FileText, CheckCircle, XCircle, Users,
  Layers, ShieldCheck, Sparkles, Download, Edit3, Trash2, CalendarCheck,
  Building2, UserCheck, Wrench, RefreshCw, X, ChevronRight, Check, Eye,
  CheckSquare, Square, MapPin, User
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Asset, PlannedMaintenance as PlannedMaintenanceType, Department } from '../types';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';
import AssetPickerTable from '../components/ui/AssetPickerTable';

export default function PlannedMaintenance() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    density,
    setDensity,
    hiddenCols,
    toggleCol,
    isColVisible,
    cellPy,
    headPy,
  } = useTablePrefs('planned_maintenance');
  const [records, setRecords] = useState<PlannedMaintenanceType[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [detailRecord, setDetailRecord] = useState<PlannedMaintenanceType | null>(null);

  // Tabs: 'ALL' | 'UPCOMING' | 'OVERDUE' | 'PRINT'
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'OVERDUE' | 'PRINT'>('ALL');

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(
    user?.role === 'DEPARTMENT' && user.departmentId ? user.departmentId.toString() : 'ALL'
  );
  const [resultFilter, setResultFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState(
    user?.role === 'MANAGER_DUOC' ? 'DUOC' :
    user?.role === 'MANAGER_CNTT' ? 'CNTT' :
    user?.role === 'MANAGER_TCHC' ? 'TCHC' : 'ALL'
  );

  // Cascading Selection State in Create Modal
  const [selectedDeptForCreate, setSelectedDeptForCreate] = useState<string>(
    user?.role === 'DEPARTMENT' && user.departmentId ? user.departmentId.toString() : '2'
  );
  const [selectedUnitForCreate, setSelectedUnitForCreate] = useState<'DUOC' | 'CNTT' | 'TCHC' | 'ALL'>('DUOC');
  const [selectedAssetIds, setSelectedAssetIds] = useState<number[]>([]);
  const [assetSearch, setAssetSearch] = useState('');

  // Create Form State
  const [formData, setFormData] = useState({
    assetId: '',
    maintenanceDate: new Date().toISOString().split('T')[0],
    nextMaintenanceDate: '',
    cycleMonths: 6,
    performedBy: user?.fullName || 'Tổ Kỹ thuật / Kỹ sư bảo trì',
    vendor: 'Trung tâm Bảo trì & Dịch vụ Kỹ thuật Thiết bị',
    planContent: 'Bảo dưỡng định kỳ: Vệ sinh máy, kiểm tra nguồn điện, hiệu chỉnh độ ổn định, bôi trơn linh kiện chuyển động',
    result: 'PASS',
    cost: '500000',
    decisionNumber: 'Kế hoạch số 15/KH-TTKSBT năm 2026',
    acceptanceMembers: 'Trưởng bộ phận sử dụng, Cán bộ phụ trách',
    fundingSource: 'Nguồn thu sự nghiệp / Quỹ PTHĐSN',
    deviceStatusAfter: 'Hoạt động tốt, ổn định',
    note: ''
  });

  // Edit Form State
  const [editData, setEditData] = useState<any>({
    id: 0,
    assetId: '',
    maintenanceDate: '',
    nextMaintenanceDate: '',
    cycleMonths: 6,
    performedBy: '',
    vendor: '',
    planContent: '',
    result: 'PASS',
    cost: '',
    decisionNumber: '',
    acceptanceMembers: '',
    fundingSource: '',
    deviceStatusAfter: '',
    note: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, aRes, dRes, sRes] = await Promise.allSettled([
        apiGet('/planned-maintenance'),
        apiGet('/assets?limit=10000'),
        apiGet('/departments'),
        apiGet('/planned-maintenance/stats/summary')
      ]);

      if (rRes.status === 'fulfilled' && Array.isArray(rRes.value)) setRecords(rRes.value);
      if (aRes.status === 'fulfilled' && aRes.value?.assets) {
        const sorted = [...aRes.value.assets].sort((a, b) =>
          (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        setAssets(sorted);
      }
      if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) setDepartments(dRes.value);
      if (sRes.status === 'fulfilled' && sRes.value) setStats(sRes.value);
    } catch (e) {
      console.error('Error fetching planned maintenance data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Count TBYT per department for intuitive selection
  const deptTbytCounts = useMemo(() => {
    const map: Record<number, { duoc: number; cntt: number; tchc: number; total: number }> = {};
    assets.forEach(a => {
      const dId = a.departmentId;
      if (!map[dId]) map[dId] = { duoc: 0, cntt: 0, tchc: 0, total: 0 };
      map[dId].total++;
      if (a.managingUnit === 'DUOC') map[dId].duoc++;
      else if (a.managingUnit === 'CNTT') map[dId].cntt++;
      else if (a.managingUnit === 'TCHC') map[dId].tchc++;
    });
    return map;
  }, [assets]);

  // Update next maintenance date automatically when maintenanceDate or cycleMonths changes
  const updateNextDate = (dateStr: string, months: number, isEdit: boolean = false) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + Number(months));
    const nextStr = d.toISOString().split('T')[0];
    if (isEdit) {
      setEditData((prev: any) => ({ ...prev, nextMaintenanceDate: nextStr }));
    } else {
      setFormData((prev: any) => ({ ...prev, nextMaintenanceDate: nextStr }));
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextD = new Date();
    nextD.setMonth(nextD.getMonth() + 6);

    const initialDept = user?.departmentId ? user.departmentId.toString() : '2'; // Default Khoa Xét Nghiệm (2) or user's dept
    setSelectedDeptForCreate(initialDept);
    setSelectedUnitForCreate('DUOC');
    setSelectedAssetIds([]);
    setAssetSearch('');

    setFormData({
      assetId: '',
      maintenanceDate: today,
      nextMaintenanceDate: nextD.toISOString().split('T')[0],
      cycleMonths: 6,
      performedBy: user?.fullName || 'Tổ Kỹ thuật / Kỹ sư bảo dưỡng',
      vendor: 'Trung tâm Bảo trì & Dịch vụ Kỹ thuật Thiết bị',
      planContent: 'Bảo dưỡng định kỳ: Vệ sinh máy, kiểm tra nguồn điện, hiệu chỉnh độ ổn định, bôi trơn linh kiện chuyển động',
      result: 'PASS',
      cost: '500000',
      decisionNumber: 'Kế hoạch số 15/KH-TTKSBT năm 2026',
      acceptanceMembers: 'Trưởng bộ phận sử dụng, Cán bộ phụ trách',
      fundingSource: 'Nguồn thu sự nghiệp / Quỹ PTHĐSN',
      deviceStatusAfter: 'Hoạt động tốt, ổn định',
      note: ''
    });
    setShowModal(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssetIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 thiết bị từ danh mục TBYT của khoa để lập kế hoạch bảo trì!');
      return;
    }
    try {
      await apiPost('/planned-maintenance', {
        ...formData,
        assetIds: selectedAssetIds
      });
      setShowModal(false);
      fetchData();
      toast.success(`Đã lập kế hoạch bảo trì định kỳ cho ${selectedAssetIds.length} thiết bị thành công!`);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi tạo hồ sơ bảo trì');
    }
  };

  // Toggle selection of asset
  const handleToggleAsset = (id: number) => {
    setSelectedAssetIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filtered Assets for Modal Selector
  const filteredAssetsForSelector = useMemo(() => {
    let list = assets;

    // 1. Filter by Department selected in Modal
    if (user?.role === 'DEPARTMENT' && user.departmentId) {
      list = list.filter(a => a.departmentId === user.departmentId);
    } else if (selectedDeptForCreate && selectedDeptForCreate !== 'ALL') {
      list = list.filter(a => a.departmentId === parseInt(selectedDeptForCreate));
    }

    // 2. Filter by Managing Unit (Default: DUOC - Trang thiết bị Y tế)
    if (selectedUnitForCreate !== 'ALL') {
      list = list.filter(a => a.managingUnit === selectedUnitForCreate);
    }

    // 3. Search query
    if (!assetSearch.trim()) return list;
    const q = assetSearch.toLowerCase();
    return list.filter(a => 
      a.name.toLowerCase().includes(q) ||
      a.assetCode.toLowerCase().includes(q) ||
      a.assignedTo?.toLowerCase().includes(q) ||
      a.locationDetail?.toLowerCase().includes(q) ||
      a.specifications?.toLowerCase().includes(q)
    );
  }, [assets, selectedDeptForCreate, selectedUnitForCreate, assetSearch, user]);

  // Select all in current view
  const handleSelectAll = () => {
    const allIds = filteredAssetsForSelector.map(a => a.id);
    setSelectedAssetIds(allIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    setSelectedAssetIds([]);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: PlannedMaintenanceType) => {
    setEditingRecord(rec);
    setEditData({
      id: rec.id,
      assetId: rec.assetId ? rec.assetId.toString() : '',
      maintenanceDate: rec.maintenanceDate ? new Date(rec.maintenanceDate).toISOString().split('T')[0] : '',
      nextMaintenanceDate: rec.nextMaintenanceDate ? new Date(rec.nextMaintenanceDate).toISOString().split('T')[0] : '',
      cycleMonths: rec.cycleMonths || 6,
      performedBy: rec.performedBy || '',
      vendor: rec.vendor || '',
      planContent: rec.planContent || '',
      result: rec.result || 'PASS',
      cost: rec.cost !== undefined ? rec.cost.toString() : '',
      decisionNumber: rec.decisionNumber || '',
      acceptanceMembers: rec.acceptanceMembers || '',
      fundingSource: rec.fundingSource || '',
      deviceStatusAfter: rec.deviceStatusAfter || 'Hoạt động tốt',
      note: rec.note || ''
    });
    setAssetSearch('');
    setShowEditModal(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPut(`/planned-maintenance/${editData.id}`, editData);
      setShowEditModal(false);
      fetchData();
      toast.success('Đã cập nhật kế hoạch bảo trì thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi cập nhật kế hoạch bảo trì');
    }
  };

  // Open Detail Modal
  const handleOpenDetail = (rec: PlannedMaintenanceType) => {
    setDetailRecord(rec);
    setShowDetailModal(true);
  };

  // Delete Record
  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa bản ghi bảo trì kế hoạch',
      message: 'Bạn có chắc chắn muốn xóa bản ghi bảo trì kế hoạch này? Thao tác không thể hoàn tác.',
      confirmLabel: 'Xóa bản ghi',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/planned-maintenance/${id}`);
      fetchData();
      toast.success('Đã xóa bản ghi bảo trì thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa bản ghi bảo trì');
    }
  };

  // Filter Records
  const now = new Date();
  const future30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Tab status filter
      if (activeTab === 'UPCOMING') {
        if (!r.nextMaintenanceDate) return false;
        const d = new Date(r.nextMaintenanceDate);
        if (d < now || d > future30) return false;
      } else if (activeTab === 'OVERDUE') {
        if (!r.nextMaintenanceDate) return false;
        const d = new Date(r.nextMaintenanceDate);
        if (d >= now) return false;
      }

      // Dropdown filters
      if (resultFilter !== 'ALL' && r.result !== resultFilter) return false;
      if (deptFilter !== 'ALL' && r.asset?.departmentId?.toString() !== deptFilter) return false;
      if (unitFilter !== 'ALL') {
        const assetUnit = (r.asset as any)?.managingUnit;
        const assetCatId = r.asset?.categoryId;
        if (unitFilter === 'DUOC') {
          if (assetUnit !== 'DUOC' && assetCatId !== 1) return false;
        } else if (unitFilter === 'CNTT') {
          if (assetUnit !== 'CNTT' && assetCatId !== 2) return false;
        } else if (unitFilter === 'TCHC') {
          if (assetUnit !== 'TCHC' && assetCatId !== 3 && assetCatId !== 4) return false;
        } else if (assetUnit !== unitFilter) {
          return false;
        }
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = r.asset?.name?.toLowerCase().includes(q);
        const matchCode = r.asset?.assetCode?.toLowerCase().includes(q);
        const matchVendor = r.vendor?.toLowerCase().includes(q);
        const matchPerf = r.performedBy?.toLowerCase().includes(q);
        const matchContent = r.planContent?.toLowerCase().includes(q);
        const matchDept = r.asset?.department?.name?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchVendor && !matchPerf && !matchContent && !matchDept) return false;
      }

      return true;
    });
  }, [records, activeTab, resultFilter, deptFilter, unitFilter, search]);

  if (user && user.role !== 'ADMIN' && user.role !== 'MANAGER_DUOC' && user.role !== 'DEPARTMENT') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Không có quyền truy cập</h2>
        <p className="text-sm text-slate-500 mt-2">
          Chức năng Quản lý Kế hoạch Bảo trì định kỳ không áp dụng cho tài khoản này.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* 1. COMPACT HEADER */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Bảo Trì Định Kỳ Theo Kế Hoạch
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Chu kỳ 1–12 tháng
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Lập kế hoạch &amp; theo dõi chu kỳ bảo dưỡng định kỳ giúp thiết bị vận hành ổn định, an toàn
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'PRINT' ? 'ALL' : 'PRINT')}
            title={activeTab === 'PRINT' ? 'Quay lại danh sách' : 'In kế hoạch bảo trì định kỳ A4'}
            aria-label={activeTab === 'PRINT' ? 'Danh sách' : 'In kế hoạch A4'}
            className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-md border transition cursor-pointer ${
              activeTab === 'PRINT' 
                ? 'bg-purple-50 border-purple-300 text-purple-800' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <Printer className="w-4 h-4 text-purple-600" />
            <span className="hidden md:inline">{activeTab === 'PRINT' ? 'Danh sách' : 'In A4'}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition cursor-pointer"
            title="Làm mới dữ liệu"
            aria-label="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            title="Lập kế hoạch bảo trì định kỳ mới"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm lịch</span>
          </button>
        </div>
      </div>

      {/* 2. UNIFIED METRIC STRIP & FILTERS */}
      {activeTab !== 'PRINT' && (
        <div className="print:hidden bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          {/* Navigation Sub-Tabs + Compact Metrics */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'ALL' ? 'bg-slate-900 text-white font-semibold shadow-2xs' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Tất cả ({stats?.total || records.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('UPCOMING')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'UPCOMING' ? 'bg-amber-600 text-white font-semibold shadow-2xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Sắp đến hạn ({stats?.upcomingCount || records.filter(r => r.nextMaintenanceDate && new Date(r.nextMaintenanceDate) >= now && new Date(r.nextMaintenanceDate) <= future30).length})</span>
              </button>

              <button
                onClick={() => setActiveTab('OVERDUE')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 ${
                  activeTab === 'OVERDUE' ? 'bg-rose-600 text-white font-semibold shadow-2xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Quá hạn ({stats?.overdueCount || records.filter(r => r.nextMaintenanceDate && new Date(r.nextMaintenanceDate) < now).length})</span>
              </button>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-medium tabular-nums">
                Đạt chuẩn: <strong>{stats?.passCount || records.filter(r => r.result === 'PASS').length}</strong>
              </span>
            </div>

            <div className="text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70 tabular-nums">
              Tổng kinh phí: <strong className="text-slate-900">{stats?.totalCost ? Number(stats.totalCost).toLocaleString('vi-VN') : '0'} đ</strong>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Tìm mã TS, tên máy, đơn vị, cán bộ..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">Tất cả khoa / phòng</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
              ))}
            </select>

            <select
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">Tất cả khối quản lý</option>
              <option value="DUOC">Khối Trang thiết bị Y tế (Dược)</option>
              <option value="CNTT">Khối Thiết bị CNTT</option>
              <option value="TCHC">Khối Thiết bị Điện & CSVC (TCHC)</option>
            </select>

            <select
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">Tất cả kết quả bảo trì</option>
              <option value="PASS">Đạt tiêu chuẩn / Tốt</option>
              <option value="NEEDS_REPAIR">Cần sửa chữa thêm</option>
              <option value="PENDING">Đang thực hiện</option>
              <option value="FAIL">Không đạt</option>
            </select>
          </div>
        </div>
      )}

      {/* 4. MAIN DATA TABLE */}
      {activeTab !== 'PRINT' && (
        <DataTableShell
          title="Kế hoạch bảo trì định kỳ"
          totalCount={filteredRecords.length}
          countLabel="hồ sơ"
          density={density}
          onDensityChange={setDensity}
          columns={[
            { key: 'content', label: 'Nội dung chi tiết', hideable: true },
          ]}
          hiddenCols={hiddenCols}
          onToggleCol={toggleCol}
          loading={loading}
          isEmpty={filteredRecords.length === 0}
          emptyMessage="Không tìm thấy bản ghi bảo trì nào phù hợp."
        >
          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {!loading &&
              filteredRecords.map((r) => {
                const isOverdue = r.nextMaintenanceDate && new Date(r.nextMaintenanceDate) < now;
                const isUpcoming =
                  r.nextMaintenanceDate &&
                  new Date(r.nextMaintenanceDate) >= now &&
                  new Date(r.nextMaintenanceDate) <= future30;

                return (
                  <div key={r.id} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/70 font-mono text-[11px] font-medium text-emerald-700">
                          {r.asset?.assetCode || '-'}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold">
                            Quá hạn
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                            Sắp đến hạn
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.result === 'PASS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            : r.result === 'NEEDS_REPAIR'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200/70'
                              : r.result === 'PENDING'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                        }`}
                      >
                        {r.result === 'PASS'
                          ? 'Đạt yêu cầu'
                          : r.result === 'NEEDS_REPAIR'
                            ? 'Cần sửa chữa'
                            : r.result === 'PENDING'
                              ? 'Đang thực hiện'
                              : 'Không đạt'}
                      </span>
                    </div>

                    <div className="font-heading text-sm font-semibold text-slate-900 leading-snug">
                      {r.asset?.name}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {r.planContent || 'Bảo dưỡng định kỳ'}
                    </p>

                    <div className="text-xs text-slate-500 space-y-0.5 tabular-nums">
                      <div>
                        {r.asset?.department?.name || 'CDC'} · {r.vendor || 'Đơn vị kỹ thuật'}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Hạn tới:{' '}
                          <strong className={isOverdue ? 'text-rose-600' : isUpcoming ? 'text-amber-700' : 'text-slate-800'}>
                            {r.nextMaintenanceDate ? new Date(r.nextMaintenanceDate).toLocaleDateString('vi-VN') : '—'}
                          </strong>{' '}
                          ({r.cycleMonths ? `${r.cycleMonths}t` : '6t'})
                        </span>
                        <span className="font-semibold text-slate-800">
                          {r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'} đ
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(r)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-emerald-50 text-emerald-700 text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem / In</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(r)}
                        className="min-h-[38px] px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                        title="Chỉnh sửa hồ sơ"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-md border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-medium cursor-pointer"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 font-heading font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className={`${headPy} px-3.5 w-28 whitespace-nowrap`}>Mã TS</th>
                  <th className={`${headPy} px-3.5 min-w-[260px] whitespace-nowrap`}>Thiết bị &amp; Nội dung</th>
                  <th className={`${headPy} px-3.5 whitespace-nowrap`}>Lịch &amp; Hạn kế tiếp</th>
                  <th className={`${headPy} px-3.5 whitespace-nowrap`}>Đơn vị thực hiện</th>
                  <th className={`${headPy} px-3.5 text-right whitespace-nowrap`}>Kết quả &amp; Chi phí</th>
                  <th className={`${headPy} px-3.5 w-28 text-right whitespace-nowrap`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  filteredRecords.map((r) => {
                    const isOverdue = r.nextMaintenanceDate && new Date(r.nextMaintenanceDate) < now;
                    const isUpcoming =
                      r.nextMaintenanceDate &&
                      new Date(r.nextMaintenanceDate) >= now &&
                      new Date(r.nextMaintenanceDate) <= future30;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/70 font-mono text-[11px] font-medium text-emerald-700">
                            {r.asset?.assetCode || '-'}
                          </span>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top max-w-[340px]`}>
                          <div className="font-heading font-semibold text-slate-800 leading-snug line-clamp-2" title={r.asset?.name}>
                            {r.asset?.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{r.asset?.department?.name || 'CDC'}</span>
                            </span>
                            {r.asset?.locationDetail && (
                              <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{r.asset.locationDetail}</span>
                              </span>
                            )}
                          </div>
                          {isColVisible('content') && (
                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-snug break-words">
                              {r.planContent || 'Bảo dưỡng định kỳ'}
                            </p>
                          )}
                        </td>

                        <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                          {r.nextMaintenanceDate ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-semibold tabular-nums ${
                                  isOverdue
                                    ? 'text-rose-600'
                                    : isUpcoming
                                      ? 'text-amber-600'
                                      : 'text-slate-800'
                                }`}
                              >
                                {new Date(r.nextMaintenanceDate).toLocaleDateString('vi-VN')}
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold whitespace-nowrap">
                                  Quá hạn
                                </span>
                              )}
                              {isUpcoming && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold whitespace-nowrap">
                                  Sắp đến hạn
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            Lần cuối: {new Date(r.maintenanceDate).toLocaleDateString('vi-VN')} ·{' '}
                            {r.cycleMonths ? `${r.cycleMonths} tháng` : '6 tháng'}
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top max-w-[240px]`}>
                          <div className="font-medium text-slate-700 leading-snug break-words">
                            {r.vendor || 'Đơn vị kỹ thuật'}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="leading-snug break-words">{r.performedBy || '-'}</span>
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                r.result === 'PASS'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                  : r.result === 'NEEDS_REPAIR'
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200/70'
                                    : r.result === 'PENDING'
                                      ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                              }`}
                            >
                              {r.result === 'PASS'
                                ? 'Đạt yêu cầu'
                                : r.result === 'NEEDS_REPAIR'
                                  ? 'Cần sửa chữa'
                                  : r.result === 'PENDING'
                                    ? 'Đang thực hiện'
                                    : 'Không đạt'}
                            </span>
                          </div>
                          <div className="mt-1 font-sans font-semibold text-slate-800 tabular-nums">
                            {r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'} đ
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                          <RowActionMenu
                            primary={{
                              label: 'Xem',
                              title: 'Xem chi tiết bảo trì thiết bị',
                              icon: <Eye className="w-3.5 h-3.5" />,
                              onClick: () => handleOpenDetail(r),
                              tone: 'emerald',
                            }}
                            items={[
                              {
                                label: 'In biên bản (A4)',
                                icon: <Printer className="w-3.5 h-3.5" />,
                                onClick: () => handleOpenDetail(r),
                              },
                              {
                                label: 'Chỉnh sửa hồ sơ',
                                icon: <Edit3 className="w-3.5 h-3.5" />,
                                onClick: () => handleOpenEdit(r),
                              },
                              {
                                label: 'Xóa hồ sơ',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: () => handleDelete(r.id),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      )}

      {/* ========================================================================= */}
      {/* 5. PRINTABLE REPORT A4 (CHUẨN KẾ HOẠCH BẢO TRÌ ĐỊNH KỲ CDC ĐÀ NẴNG)          */}
      {/* ========================================================================= */}
      {activeTab === 'PRINT' && (
        <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0">
          <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4">
            <div>
              <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT TP ĐÀ NẴNG</div>
              <div className="font-bold text-slate-700">KHOA DƯỢC - VẬT TƯ Y TẾ / TỔ KỸ THUẬT</div>
            </div>
            <div className="text-right">
              <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>

          <div className="text-center my-6">
            <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
              KẾ HOẠCH & BẢNG THEO DÕI BẢO TRÌ ĐỊNH KỲ THIẾT BỊ NĂM 2026
            </h2>
            <p className="text-xs sm:text-sm italic text-slate-600 mt-1 font-sans">
              (Kế hoạch số 15/KH-TTKSBT ngày 15/01/2026 về Bảo dưỡng & Đảm bảo an toàn kỹ thuật trang thiết bị)
            </p>
          </div>

          <div className="border border-slate-400 rounded-lg overflow-hidden font-sans text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-center font-bold border-b border-slate-400 divide-x divide-slate-300">
                <tr>
                  <th className="p-2 w-8">STT</th>
                  <th className="p-2 min-w-[70px]">Mã TS</th>
                  <th className="p-2 min-w-[180px]">Tên trang thiết bị</th>
                  <th className="p-2 min-w-[90px]">Khoa / Phòng</th>
                  <th className="p-2 min-w-[90px]">Ngày bảo trì</th>
                  <th className="p-2 min-w-[90px]">Hạn tiếp theo</th>
                  <th className="p-2 min-w-[140px]">Nội dung kế hoạch</th>
                  <th className="p-2 min-w-[120px]">Đơn vị thực hiện</th>
                  <th className="p-2 min-w-[80px]">Kinh phí (đ)</th>
                  <th className="p-2 min-w-[70px]">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredRecords.map((r, idx) => (
                  <tr key={r.id} className="divide-x divide-slate-200">
                    <td className="p-2 text-center">{idx + 1}</td>
                    <td className="p-2 font-mono font-semibold">{r.asset?.assetCode}</td>
                    <td className="p-2 font-medium">{r.asset?.name}</td>
                    <td className="p-2">{r.asset?.department?.name}</td>
                    <td className="p-2 text-center">{new Date(r.maintenanceDate).toLocaleDateString('vi-VN')}</td>
                    <td className="p-2 text-center">{r.nextMaintenanceDate ? new Date(r.nextMaintenanceDate).toLocaleDateString('vi-VN') : '-'}</td>
                    <td className="p-2">{r.planContent || 'Bảo dưỡng định kỳ'}</td>
                    <td className="p-2">{r.vendor}</td>
                    <td className="p-2 text-right font-mono">{r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'}</td>
                    <td className="p-2 text-center font-semibold">
                      {r.result === 'PASS' ? 'Đạt' : r.result === 'NEEDS_REPAIR' ? 'Cần sửa' : 'Không đạt'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-between text-xs sm:text-sm font-sans pt-6">
            <div className="text-center">
              <div className="font-bold">NGƯỜI LẬP KẾ HOẠCH</div>
              <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold">{user?.fullName || 'Cán bộ phụ trách'}</div>
            </div>

            <div className="text-center">
              <div className="font-bold">TRƯỞNG BỘ PHẬN CHUYÊN TRÁCH</div>
              <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold">Trưởng Khoa Dược / Tổ CNTT / Phòng TCHC</div>
            </div>

            <div className="text-center">
              <div className="italic text-slate-600 text-xs mb-1">Đà Nẵng, ngày ..... tháng ..... năm 2026</div>
              <div className="font-bold">GIÁM ĐỐC TRUNG TÂM</div>
              <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký tên và đóng dấu)</div>
              <div className="h-16"></div>
              <div className="font-bold">TS. BS. Nguyễn Đại Vĩnh</div>
            </div>
          </div>

          <div className="print:hidden mt-8 text-center border-t border-slate-200 pt-4">
            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-md font-bold shadow hover:bg-purple-700 transition cursor-pointer"
            >
              In văn bản Kế Hoạch Bảo Trì
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. CREATE MODAL (BỘ CHỌN THIẾT BỊ TRỰC QUAN BẰNG TICK / CARDS)              */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                  <CalendarCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Lập Kế Hoạch & Nhật Ký Bảo Trì Định Kỳ</h3>
                  <p className="text-xs text-emerald-100">Bảo dưỡng định kỳ theo kế hoạch (chu kỳ 1/3/6/12 tháng)</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-md transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ========================================================================= */}
              {/* BƯỚC 1: CHỌN KHOA / PHÒNG & KHỐI TÀI SẢN                                  */}
              {/* ========================================================================= */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span>Bước 1: Chọn Khoa / Phòng quản lý tài sản</span>
                    <span className="text-red-500">*</span>
                  </label>
                  {user?.role === 'DEPARTMENT' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                      Khoa của bạn
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khoa / Phòng</label>
                    <select
                      value={selectedDeptForCreate}
                      onChange={e => {
                        setSelectedDeptForCreate(e.target.value);
                        setSelectedAssetIds([]);
                      }}
                      disabled={user?.role === 'DEPARTMENT'}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                    >
                      {departments.map(d => {
                        const counts = deptTbytCounts[d.id] || { duoc: 0, cntt: 0, tchc: 0, total: 0 };
                        return (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) — {counts.duoc} TBYT / {counts.total} tài sản
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khối danh mục tài sản</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUnitForCreate('DUOC');
                          setSelectedAssetIds([]);
                        }}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          selectedUnitForCreate === 'DUOC'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Khối TBYT (Dược)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUnitForCreate('ALL');
                          setSelectedAssetIds([]);
                        }}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          selectedUnitForCreate === 'ALL'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Tất cả tài sản
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* BƯỚC 2: DANH MỤC TÀI SẢN TBYT CỦA KHOA ĐÃ CHỌN                             */}
              {/* ========================================================================= */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Bước 2: Danh mục thiết bị khoa {departments.find(d => d.id.toString() === selectedDeptForCreate)?.name || ''}</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Tìm thấy <b className="text-emerald-700">{filteredAssetsForSelector.length}</b> thiết bị • Đã chọn: <b className="text-blue-700">{selectedAssetIds.length}</b> thiết bị
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition cursor-pointer"
                    >
                      Chọn tất cả ({filteredAssetsForSelector.length})
                    </button>
                    {selectedAssetIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition cursor-pointer"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm theo mã TBYT, tên máy, model, vị trí phòng, người sử dụng..."
                    value={assetSearch}
                    onChange={e => setAssetSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                  />
                </div>

                {/* Bảng chia cột danh sách thiết bị cần lập kế hoạch bảo trì */}
                <AssetPickerTable
                  mode="multi"
                  assets={filteredAssetsForSelector}
                  selectedIds={selectedAssetIds}
                  onToggle={handleToggleAsset}
                  showDepartment={false}
                  accentColor="emerald"
                  emptyMessage="Không tìm thấy thiết bị nào trong khoa đã chọn phù hợp với điều kiện tìm kiếm."
                />
              </div>

              {/* ========================================================================= */}
              {/* BƯỚC 3: THIẾT LẬP THÔNG TIN KẾ HOẠCH BẢO TRÌ                               */}
              {/* ========================================================================= */}

              {/* Maintenance Date & Cycle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày thực hiện bảo trì</label>
                  <input
                    type="date"
                    value={formData.maintenanceDate}
                    onChange={e => {
                      setFormData({ ...formData, maintenanceDate: e.target.value });
                      updateNextDate(e.target.value, formData.cycleMonths, false);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chu kỳ bảo trì</label>
                  <select
                    value={formData.cycleMonths}
                    onChange={e => {
                      const m = Number(e.target.value);
                      setFormData({ ...formData, cycleMonths: m });
                      updateNextDate(formData.maintenanceDate, m, false);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                  >
                    <option value={1}>1 tháng (Hàng tháng)</option>
                    <option value={3}>3 tháng (Hàng quý)</option>
                    <option value={6}>6 tháng (Nửa năm)</option>
                    <option value={12}>12 tháng (Hàng năm)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn bảo trì tiếp theo</label>
                  <input
                    type="date"
                    value={formData.nextMaintenanceDate}
                    onChange={e => setFormData({ ...formData, nextMaintenanceDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-700"
                  />
                </div>
              </div>

              {/* Vendor & Performed By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị thực hiện bảo trì</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    placeholder="VD: TT Dịch vụ Kỹ thuật Thiết bị Y tế..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cán bộ phụ trách / thực hiện</label>
                  <input
                    type="text"
                    value={formData.performedBy}
                    onChange={e => setFormData({ ...formData, performedBy: e.target.value })}
                    placeholder="VD: Tổ Kỹ thuật / Kỹ sư bảo trì..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Plan Content */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung bảo trì theo kế hoạch</label>
                <textarea
                  rows={2}
                  value={formData.planContent}
                  onChange={e => setFormData({ ...formData, planContent: e.target.value })}
                  placeholder="Ghi rõ nội dung: Vệ sinh linh kiện, kiểm tra dầu mỡ, hiệu chỉnh nguồn điện, kiểm tra an toàn..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Result & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kết quả bảo trì</label>
                  <select
                    value={formData.result}
                    onChange={e => setFormData({ ...formData, result: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                  >
                    <option value="PASS">Đạt tiêu chuẩn / Tốt</option>
                    <option value="NEEDS_REPAIR">Cần sửa chữa thêm</option>
                    <option value="PENDING">Đang thực hiện</option>
                    <option value="FAIL">Không đạt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chi phí bảo trì (đ)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="VD: 500000"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kế hoạch số / QĐ số</label>
                  <input
                    type="text"
                    value={formData.decisionNumber}
                    onChange={e => setFormData({ ...formData, decisionNumber: e.target.value })}
                    placeholder="VD: KH số 15/KH-TTKSBT"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Acceptance Members & Funding Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Người nghiệm thu</label>
                  <input
                    type="text"
                    value={formData.acceptanceMembers}
                    onChange={e => setFormData({ ...formData, acceptanceMembers: e.target.value })}
                    placeholder="VD: Trưởng khoa phòng, cán bộ phụ trách..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nguồn kinh phí</label>
                  <input
                    type="text"
                    value={formData.fundingSource}
                    onChange={e => setFormData({ ...formData, fundingSource: e.target.value })}
                    placeholder="VD: Nguồn thu sự nghiệp / Quỹ PTHĐSN..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow transition cursor-pointer"
                >
                  Lưu Kế Hoạch Bảo Trì
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. EDIT MODAL                                                              */}
      {/* ========================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Chỉnh Sửa Hồ Sơ Bảo Trì Định Kỳ</h3>
                  <p className="text-xs text-blue-100">Cập nhật nội dung, kết quả và chi phí bảo trì</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 hover:bg-white/20 rounded-md transition text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Asset Display */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      {editingRecord?.asset?.assetCode}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{editingRecord?.asset?.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {editingRecord?.asset?.department?.name} · {editingRecord?.asset?.locationDetail || 'Cơ sở 1'}
                  </div>
                </div>
              </div>

              {/* Maintenance Date & Cycle */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày thực hiện bảo trì</label>
                  <input
                    type="date"
                    value={editData.maintenanceDate}
                    onChange={e => {
                      setEditData({ ...editData, maintenanceDate: e.target.value });
                      updateNextDate(e.target.value, editData.cycleMonths, true);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chu kỳ bảo trì</label>
                  <select
                    value={editData.cycleMonths}
                    onChange={e => {
                      const m = Number(e.target.value);
                      setEditData({ ...editData, cycleMonths: m });
                      updateNextDate(editData.maintenanceDate, m, true);
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                  >
                    <option value={1}>1 tháng</option>
                    <option value={3}>3 tháng</option>
                    <option value={6}>6 tháng</option>
                    <option value={12}>12 tháng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hạn bảo trì tiếp theo</label>
                  <input
                    type="date"
                    value={editData.nextMaintenanceDate}
                    onChange={e => setEditData({ ...editData, nextMaintenanceDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-emerald-700"
                  />
                </div>
              </div>

              {/* Vendor & Performed By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị thực hiện</label>
                  <input
                    type="text"
                    value={editData.vendor}
                    onChange={e => setEditData({ ...editData, vendor: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cán bộ thực hiện</label>
                  <input
                    type="text"
                    value={editData.performedBy}
                    onChange={e => setEditData({ ...editData, performedBy: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Plan Content */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung bảo trì</label>
                <textarea
                  rows={2}
                  value={editData.planContent}
                  onChange={e => setEditData({ ...editData, planContent: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Result & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kết quả bảo trì</label>
                  <select
                    value={editData.result}
                    onChange={e => setEditData({ ...editData, result: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    <option value="PASS">Đạt tiêu chuẩn / Tốt</option>
                    <option value="NEEDS_REPAIR">Cần sửa chữa thêm</option>
                    <option value="PENDING">Đang thực hiện</option>
                    <option value="FAIL">Không đạt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chi phí (đ)</label>
                  <input
                    type="number"
                    value={editData.cost}
                    onChange={e => setEditData({ ...editData, cost: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kế hoạch số / QĐ số</label>
                  <input
                    type="text"
                    value={editData.decisionNumber}
                    onChange={e => setEditData({ ...editData, decisionNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Acceptance Members & Funding Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Người nghiệm thu</label>
                  <input
                    type="text"
                    value={editData.acceptanceMembers}
                    onChange={e => setEditData({ ...editData, acceptanceMembers: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nguồn kinh phí</label>
                  <input
                    type="text"
                    value={editData.fundingSource}
                    onChange={e => setEditData({ ...editData, fundingSource: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-md transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow transition cursor-pointer"
                >
                  Cập Nhật Kế Hoạch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL XEM CHI TIẾT & IN BIÊN BẢN BẢO DƯỠNG ĐỊNH KỲ (KHỔ A4)             */}
      {/* ========================================================================= */}
      {showDetailModal && detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                  <CalendarCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Hồ Sơ Bảo Trì Định Kỳ: {detailRecord.asset?.assetCode}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      detailRecord.result === 'PASS' ? 'bg-emerald-500 text-white' :
                      detailRecord.result === 'NEEDS_REPAIR' ? 'bg-orange-500 text-white' :
                      detailRecord.result === 'PENDING' ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {detailRecord.result === 'PASS' ? 'Đạt tiêu chuẩn' :
                       detailRecord.result === 'NEEDS_REPAIR' ? 'Cần sửa chữa' :
                       detailRecord.result === 'PENDING' ? 'Đang thực hiện' : 'Không đạt'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 truncate max-w-md">{detailRecord.asset?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-emerald-800 rounded-md text-xs font-bold shadow hover:bg-emerald-50 transition cursor-pointer"
                  title="In biên bản bảo dưỡng ra máy in hoặc lưu PDF"
                >
                  <Printer className="w-4 h-4 text-emerald-700" /> In Biên Bản Này (A4)
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-md transition text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50">
              <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto">
                <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT TP ĐÀ NẴNG</div>
                    <div className="font-bold text-slate-700">KHOA DƯỢC - VẬT TƯ Y TẾ / TỔ KỸ THUẬT</div>
                    <div className="text-[11px] text-slate-500">Mã phiếu: BT-2026-{detailRecord.id.toString().padStart(4, '0')}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Đà Nẵng, ngày {detailRecord.maintenanceDate ? new Date(detailRecord.maintenanceDate).getDate() : new Date().getDate()} tháng {detailRecord.maintenanceDate ? new Date(detailRecord.maintenanceDate).getMonth() + 1 : new Date().getMonth() + 1} năm 2026
                    </div>
                  </div>
                </div>

                <div className="text-center my-5">
                  <h2 className="text-xl font-bold uppercase tracking-wide">
                    BIÊN BẢN BẢO DƯỠNG & KIỂM TRA ĐỊNH KỲ THIẾT BỊ
                  </h2>
                  <p className="text-xs italic text-slate-600 font-sans mt-0.5">
                    ({detailRecord.decisionNumber || 'Kế hoạch số 15/KH-TTKSBT về Bảo trì & Đảm bảo an toàn kỹ thuật trang thiết bị'})
                  </p>
                </div>

                <div className="space-y-4 font-sans text-xs">
                  {/* Phần I: Thông tin thiết bị */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-emerald-800">
                      I. THÔNG TIN TRANG THIẾT BỊ BẢO DƯỠNG
                    </div>
                    <table className="w-full text-left border-collapse bg-white border border-slate-300">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2 font-bold w-1/3 bg-slate-100">Tên trang thiết bị:</td>
                          <td className="p-2 font-semibold text-slate-900">{detailRecord.asset?.name}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Mã tài sản:</td>
                          <td className="p-2 font-mono font-bold text-emerald-700">{detailRecord.asset?.assetCode}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Đơn vị quản lý sử dụng:</td>
                          <td className="p-2">
                            <b>{detailRecord.asset?.department?.name}</b>
                            {detailRecord.asset?.locationDetail && ` (Phòng: ${detailRecord.asset.locationDetail})`}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Cán bộ phụ trách máy:</td>
                          <td className="p-2">{detailRecord.asset?.assignedTo || 'Cán bộ khoa/phòng'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Phần II: Chi tiết bảo dưỡng */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-emerald-800">
                      II. NỘI DUNG & KẾT QUẢ BẢO DƯỠNG ĐỊNH KỲ
                    </div>
                    <table className="w-full text-left border-collapse bg-white border border-slate-300">
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="p-2 font-bold w-1/3 bg-slate-100">Ngày thực hiện:</td>
                          <td className="p-2 font-semibold">{new Date(detailRecord.maintenanceDate).toLocaleDateString('vi-VN')}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Chu kỳ & Hạn tiếp theo:</td>
                          <td className="p-2">
                            <b>{detailRecord.cycleMonths || 6} tháng/lần</b> ➔ Hạn kế tiếp: <b className="text-emerald-700">{detailRecord.nextMaintenanceDate ? new Date(detailRecord.nextMaintenanceDate).toLocaleDateString('vi-VN') : '-'}</b>
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Đơn vị / Cán bộ bảo trì:</td>
                          <td className="p-2">{detailRecord.vendor || detailRecord.performedBy || 'Tổ Kỹ thuật CDC'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Nội dung công việc:</td>
                          <td className="p-2 font-medium">{detailRecord.planContent || 'Vệ sinh, kiểm tra an toàn điện, hiệu chỉnh thông số kỹ thuật'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Tình trạng sau bảo dưỡng:</td>
                          <td className="p-2 font-bold text-emerald-700">{detailRecord.deviceStatusAfter || 'Hoạt động tốt, ổn định'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-bold bg-slate-100">Chi phí & Nguồn kinh phí:</td>
                          <td className="p-2">
                            <span className="font-mono font-bold text-slate-900">{detailRecord.cost ? Number(detailRecord.cost).toLocaleString('vi-VN') + ' đ' : '0 đ'}</span>
                            <span className="text-slate-500 ml-2">({detailRecord.fundingSource || 'Nguồn thu sự nghiệp'})</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Phần III: Kết luận */}
                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                    <div className="font-bold text-emerald-900 uppercase text-[11px] mb-1">
                      III. ĐÁNH GIÁ & KẾT LUẬN
                    </div>
                    <p className="text-slate-800 font-medium">
                      Thiết bị đã được kiểm tra, bảo dưỡng kỹ thuật theo đúng quy trình. Kết quả: <b>{detailRecord.result === 'PASS' ? 'ĐẠT TIÊU CHUẨN VẬN HÀNH' : detailRecord.result === 'NEEDS_REPAIR' ? 'CẦN SỬA CHỮA THÊM' : 'CHƯA ĐẠT'}</b>. Bàn giao đơn vị tiếp tục sử dụng an toàn.
                    </p>
                  </div>
                </div>

                {/* Chữ ký 4 bên */}
                <div className="mt-8 grid grid-cols-4 text-center text-xs font-sans pt-6 border-t border-slate-300">
                  <div>
                    <div className="font-bold">CÁN BỘ BẢO DƯỠNG</div>
                    <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-semibold">{detailRecord.performedBy || 'Kỹ sư bảo trì'}</div>
                  </div>

                  <div>
                    <div className="font-bold">NGƯỜI PHỤ TRÁCH MÁY</div>
                    <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-semibold">{detailRecord.asset?.assignedTo || 'Cán bộ quản lý'}</div>
                  </div>

                  <div>
                    <div className="font-bold">TRƯỞNG BỘ PHẬN</div>
                    <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                    <div className="h-14"></div>
                    <div className="font-semibold">Khoa Dược / CNTT / TCHC</div>
                  </div>

                  <div>
                    <div className="font-bold">GIÁM ĐỐC TRUNG TÂM</div>
                    <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký tên & đóng dấu)</div>
                    <div className="h-14"></div>
                    <div className="font-semibold">TS. BS. Nguyễn Đại Vĩnh</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
