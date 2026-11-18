import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Filter, Wrench, AlertTriangle, CheckCircle, Clock, 
  XCircle, Printer, Building2, Monitor, Stethoscope, Layers, FileText,
  Calendar, DollarSign, User, Phone, CheckCircle2, ChevronRight, BarChart2, Users,
  Download, Edit3, Trash2, Eye, X, Check, MapPin, Settings,
  Laptop, Camera, Copy, KeyRound, Image as ImageIcon
} from 'lucide-react';
import { apiGet, apiPut, apiDelete, apiDownload } from '../lib/api';
import { MaintenanceRequest, Asset, Department, PRIORITY_LABELS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';
import AssetPickerTable from '../components/ui/AssetPickerTable';
import CreateMaintenanceModal from '../components/CreateMaintenanceModal';

function parseAttachments(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string' && u.length > 0) : [];
  } catch {
    return [];
  }
}

export default function Maintenance() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [telegramActive, setTelegramActive] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'LIST' | 'REPORT'>('LIST');

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRequest, setEditingRequest] = useState<any>(null);

  // Detail & Print State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailRequest, setDetailRequest] = useState<MaintenanceRequest | null>(null);
  const [detailPrintTab, setDetailPrintTab] = useState<'PROPOSAL' | 'ACCEPTANCE'>('PROPOSAL');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [unitFilter, setUnitFilter] = useState('ALL');
  const { density, setDensity, cellPy, headPy } = useTablePrefs('maintenance');
  const [deptFilter, setDeptFilter] = useState('ALL');

  // Periodic Report Filter State
  const [reportPeriodType, setReportPeriodType] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [reportYear, setReportYear] = useState('2026');
  const [reportMonth, setReportMonth] = useState('1');
  const [reportQuarter, setReportQuarter] = useState('1');
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialAssetId, setCreateInitialAssetId] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);

  // Export Dialog State
  const [exportSortBy, setExportSortBy] = useState('date');
  const [exportSortOrder, setExportSortOrder] = useState('desc');

  // Edit All Fields Form State
  const [editData, setEditData] = useState<any>({
    id: 0,
    assetId: '',
    departmentId: '1',
    managingUnit: 'CNTT',
    requestedBy: '',
    contactPhone: '',
    locationDetail: '',
    issueType: 'HARDWARE',
    issueDescription: '',
    ultraViewId: '',
    ultraViewPass: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    maintenanceType: 'SUA_CHUA',
    servicePackage: '',
    technicianName: '',
    repairVendor: '',
    repairCost: '',
    fundingSource: 'Nguồn ngân sách',
    decisionNumber: '',
    replacementParts: '',
    acceptanceMembers: '',
    deviceStatusAfter: 'Hoạt động tốt',
    repairNote: '',
    requestDate: '',
    completedDate: ''
  });

  // Process / Update Form State
  const [processData, setProcessData] = useState({
    status: 'IN_PROGRESS',
    technicianName: '',
    repairCost: '',
    repairVendor: '',
    repairNote: '',
    fundingSource: 'Nguồn thu dịch vụ y tế',
    decisionNumber: '',
    servicePackage: '',
    replacementParts: '',
    acceptanceMembers: ''
  });

  // Signatures configuration for Report
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [signatures, setSignatures] = useState(() => {
    const saved = localStorage.getItem('maintenance_report_signatures');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      reporterTitle: 'NGƯỜI LẬP BÁO CÁO',
      reporterName: user?.fullName || 'Cán bộ quản lý',
      techTitle: user?.role === 'MANAGER_CNTT' ? 'TỔ TRƯỞNG TỔ CNTT' :
                 user?.role === 'MANAGER_DUOC' ? 'TRƯỞNG KHOA DƯỢC - VTYT' :
                 user?.role === 'MANAGER_TCHC' ? 'TRƯỞNG PHÒNG TỔ CHỨC - HÀNH CHÍNH' : 'PHỤ TRÁCH ĐƠN VỊ KỸ THUẬT',
      techName: user?.role === 'MANAGER_CNTT' ? 'KTV. Phan Thanh Hoàn' :
                user?.role === 'MANAGER_DUOC' ? 'DS. Trưởng Khoa Dược' :
                user?.role === 'MANAGER_TCHC' ? 'Trưởng phòng TCHC' : 'Trưởng bộ phận kỹ thuật',
      directorTitle: 'GIÁM ĐỐC / BAN GIÁM ĐỐC',
      directorName: 'Ông. Nguyễn Đại Vĩnh'
    };
  });

  const handleSaveSignatures = (newSigs: typeof signatures) => {
    setSignatures(newSigs);
    localStorage.setItem('maintenance_report_signatures', JSON.stringify(newSigs));
    setShowSignaturesModal(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqRes, assetRes, deptRes, tgRes] = await Promise.allSettled([
        apiGet('/maintenance'),
        apiGet('/assets?limit=10000'),
        apiGet('/departments'),
        apiGet('/settings/telegram'),
      ]);

      if (reqRes.status === 'fulfilled' && Array.isArray(reqRes.value)) setRequests(reqRes.value);
      if (assetRes.status === 'fulfilled' && assetRes.value?.assets) setAssets(assetRes.value.assets);
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) setDepartments(deptRes.value);
      if (tgRes.status === 'fulfilled' && tgRes.value) {
        setTelegramActive(Boolean(tgRes.value.enabled && tgRes.value.configured));
      }
    } catch (error) {
      console.error('Error loading maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const quickReport = searchParams.get('quickReport');
    if (quickReport === '1') {
      if (user?.role !== 'VIEWER') {
        setActiveTab('LIST');
        setCreateInitialAssetId(null);
        setShowCreateModal(true);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('quickReport');
      setSearchParams(next, { replace: true });
      return;
    }

    const preselectId = searchParams.get('assetId');
    if (!preselectId || assets.length === 0) return;
    const match = assets.find((a) => a.id.toString() === preselectId);
    if (match) {
      setActiveTab('LIST');
      setCreateInitialAssetId(match.id.toString());
      setShowCreateModal(true);
      const next = new URLSearchParams(searchParams);
      next.delete('assetId');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, assets, setSearchParams, user]);

  // Load periodic report data
  const loadReportData = async () => {
    setReportLoading(true);
    try {
      let url = `/maintenance/stats/periodic?year=${reportYear}`;
      if (reportPeriodType === 'MONTH') url += `&month=${reportMonth}`;
      if (reportPeriodType === 'QUARTER') url += `&quarter=${reportQuarter}`;
      const data = await apiGet(url);
      setReportData(data);
    } catch (e) {
      console.error('Error fetching report:', e);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'REPORT') {
      loadReportData();
    }
  }, [activeTab, reportPeriodType, reportYear, reportMonth, reportQuarter]);

  const [editAssetSearch, setEditAssetSearch] = useState('');

  // Filter available assets for Edit Modal - ALWAYS include editingRequest's asset so it maps perfectly
  const editDepartmentAssets = useMemo(() => {
    let list = assets.filter(a => {
      const deptMatch = !editData.departmentId || a.departmentId?.toString() === editData.departmentId?.toString();
      const chosenUnit = editData.managingUnit;
      const unitMatch = !chosenUnit || chosenUnit === 'ALL' ||
        (a as any).managingUnit === chosenUnit || 
        (chosenUnit === 'CNTT' && a.categoryId === 2) ||
        (chosenUnit === 'DUOC' && a.categoryId === 1) ||
        (chosenUnit === 'TCHC' && (a.categoryId === 3 || a.categoryId === 4));
      
      if (!deptMatch || !unitMatch) return false;

      if (editAssetSearch.trim()) {
        const q = editAssetSearch.toLowerCase();
        const matchCode = a.assetCode?.toLowerCase().includes(q);
        const matchName = a.name?.toLowerCase().includes(q);
        const matchUser = a.assignedTo?.toLowerCase().includes(q);
        const matchLoc = a.locationDetail?.toLowerCase().includes(q) || (a as any).floor?.toLowerCase().includes(q);
        const matchSpec = a.specifications?.toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchUser && !matchLoc && !matchSpec) return false;
      }

      return true;
    });

    // Ensure the current editing request's asset is ALWAYS included
    if (editingRequest?.asset && !list.some(a => a.id === editingRequest.asset.id)) {
      list = [editingRequest.asset, ...list];
    } else if (editData.assetId && !list.some(a => a.id?.toString() === editData.assetId?.toString())) {
      const found = assets.find(a => a.id?.toString() === editData.assetId?.toString());
      if (found) {
        list = [found, ...list];
      }
    }

    return list.sort((a, b) => (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [assets, editData.departmentId, editData.managingUnit, editData.assetId, editingRequest, editAssetSearch]);

  const selectedEditAsset = assets.find(a => a.id.toString() === editData.assetId) || editingRequest?.asset;

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => toast.success(`Đã sao chép ${label}: ${text}`),
      () => toast.info(`${label}: ${text}`)
    );
  };

  // Open Edit Modal (Chỉnh sửa toàn bộ nội dung phiếu)
  const handleOpenEdit = (req: MaintenanceRequest) => {
    setEditingRequest(req);
    const assetUnit = (req as any).managingUnit || (req.asset as any)?.managingUnit || 'DUOC';
    const deptId = req.departmentId ? req.departmentId.toString() : (req.asset?.departmentId ? req.asset.departmentId.toString() : '1');
    const assetIdStr = req.assetId ? req.assetId.toString() : (req.asset?.id ? req.asset.id.toString() : '');

    setEditData({
      id: req.id,
      assetId: assetIdStr,
      departmentId: deptId,
      managingUnit: assetUnit,
      requestedBy: req.requestedBy || '',
      contactPhone: (req as any).contactPhone || '',
      locationDetail: (req as any).locationDetail || req.asset?.locationDetail || '',
      issueType: req.issueType || 'HARDWARE',
      issueDescription: req.issueDescription || '',
      ultraViewId: req.ultraViewId || '',
      ultraViewPass: req.ultraViewPass || '',
      priority: req.priority || 'MEDIUM',
      status: req.status || 'PENDING',
      maintenanceType: (req as any).maintenanceType || 'SUA_CHUA',
      servicePackage: (req as any).servicePackage || '',
      technicianName: (req as any).technicianName || '',
      repairVendor: (req as any).repairVendor || '',
      repairCost: (req as any).repairCost !== undefined && (req as any).repairCost !== null ? (req as any).repairCost.toString() : '',
      fundingSource: (req as any).fundingSource || 'Nguồn ngân sách',
      decisionNumber: (req as any).decisionNumber || '',
      replacementParts: (req as any).replacementParts || '',
      acceptanceMembers: (req as any).acceptanceMembers || '',
      deviceStatusAfter: (req as any).deviceStatusAfter || 'Hoạt động tốt',
      repairNote: (req as any).repairNote || '',
      requestDate: req.requestDate ? new Date(req.requestDate).toISOString().split('T')[0] : '',
      completedDate: (req as any).completedDate ? new Date((req as any).completedDate).toISOString().split('T')[0] : ''
    });
    setShowEditModal(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.requestedBy || !editData.issueDescription) {
      toast.warning('Vui lòng nhập người đề nghị và mô tả sự cố!');
      return;
    }
    try {
      await apiPut(`/maintenance/${editData.id}`, editData);
      setShowEditModal(false);
      loadData();
      toast.success('Đã cập nhật toàn bộ thông tin phiếu sửa chữa/bảo trì thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi cập nhật phiếu');
    }
  };

  // Open Detail & Print Modal
  const handleOpenDetail = (req: MaintenanceRequest, printTab: 'PROPOSAL' | 'ACCEPTANCE' = 'PROPOSAL') => {
    setDetailRequest(req);
    setDetailPrintTab(printTab);
    setShowDetailModal(true);
  };

  // Delete Request
  const handleDeleteRequest = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa phiếu báo hỏng / sửa chữa',
      message: 'Bạn có chắc chắn muốn xóa phiếu báo hỏng / sửa chữa này?',
      confirmLabel: 'Xóa phiếu',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/maintenance/${id}`);
      loadData();
      toast.success('Đã xóa phiếu thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa phiếu');
    }
  };

  // Handle Export Excel with user criteria
  const handleExportExcel = async () => {
    const params = new URLSearchParams();
    const effectiveDept = user?.role === 'DEPARTMENT' && user.departmentId ? user.departmentId.toString() : deptFilter;
    if (effectiveDept && effectiveDept !== 'ALL') params.append('departmentId', effectiveDept);
    if (unitFilter && unitFilter !== 'ALL') params.append('managingUnit', unitFilter);
    if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
    if (priorityFilter && priorityFilter !== 'ALL') params.append('priority', priorityFilter);
    params.append('sortBy', exportSortBy);
    params.append('sortOrder', exportSortOrder);

    try {
      await apiDownload(`/export/maintenance?${params.toString()}`, 'bao_hong_sua_chua.xlsx');
      toast.success('Đã xuất danh sách sửa chữa ra file Excel.');
    } catch (e: any) {
      toast.error(e.message || 'Không thể xuất file Excel');
    }
    setShowExportModal(false);
  };

  // Open Process Modal
  const handleOpenProcess = (req: MaintenanceRequest) => {
    setSelectedRequest(req);
    setProcessData({
      status: req.status === 'PENDING' ? 'IN_PROGRESS' : req.status,
      technicianName: req.technicianName || user?.fullName || '',
      repairCost: req.repairCost ? req.repairCost.toString() : '',
      repairVendor: req.repairVendor || '',
      repairNote: req.repairNote || '',
      fundingSource: req.fundingSource || 'Nguồn thu dịch vụ y tế',
      decisionNumber: req.decisionNumber || '',
      servicePackage: req.servicePackage || '',
      replacementParts: req.replacementParts || '',
      acceptanceMembers: req.acceptanceMembers || ''
    });
    setShowProcessModal(true);
  };

  // Submit Process / Status update
  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await apiPut(`/maintenance/${selectedRequest.id}/process`, processData);
      setShowProcessModal(false);
      loadData();
      toast.success('Đã cập nhật tiến độ xử lý và đồng bộ lịch sử thiết bị thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi cập nhật phiếu');
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    const q = search.toLowerCase();
    const searchMatch = !search || 
      r.asset?.name?.toLowerCase().includes(q) ||
      r.asset?.assetCode?.toLowerCase().includes(q) ||
      r.requestedBy?.toLowerCase().includes(q) ||
      r.issueDescription?.toLowerCase().includes(q) ||
      r.ultraViewId?.toLowerCase().includes(q);

    const statusMatch = statusFilter === 'ALL' || r.status === statusFilter;
    const priorityMatch = priorityFilter === 'ALL' || r.priority === priorityFilter;
    const unitMatch = unitFilter === 'ALL' || 
      (r as any).managingUnit === unitFilter || 
      (r.asset as any)?.managingUnit === unitFilter ||
      (unitFilter === 'DUOC' && r.asset?.categoryId === 1) ||
      (unitFilter === 'CNTT' && r.asset?.categoryId === 2) ||
      (unitFilter === 'TCHC' && (r.asset?.categoryId === 3 || r.asset?.categoryId === 4));
    const deptMatch = deptFilter === 'ALL' || r.departmentId.toString() === deptFilter;

    return searchMatch && statusMatch && priorityMatch && unitMatch && deptMatch;
  });

  // Calculate Statistics (Đếm theo số lượng thiết bị duy nhất - distinct assets)
  const distinctAssetsCount = new Set(requests.map(r => r.assetId)).size;
  const distinctPendingCount = new Set(requests.filter(r => r.status === 'PENDING').map(r => r.assetId)).size;
  const distinctInProgressCount = new Set(requests.filter(r => r.status === 'IN_PROGRESS').map(r => r.assetId)).size;
  const distinctCompletedCount = new Set(requests.filter(r => r.status === 'COMPLETED').map(r => r.assetId)).size;
  const totalCost = requests.reduce((sum, r) => sum + (r.repairCost || 0), 0);

  return (
    <div className="space-y-6 pb-16">
      {/* 1. TOP HEADER */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Quy trình điều phối & báo cáo</span>
            <h1 className="text-2xl font-bold text-slate-900">Báo Hỏng & Sửa Chữa Thiết Bị</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Khoa/Phòng báo hỏng ➔ Điều phối về <strong className="text-slate-700 font-semibold">Khoa Dược / Tổ CNTT / Phòng TCHC</strong> ➔ Xử lý &amp; Báo cáo định kỳ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'ADMIN' ? (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              title="Cài đặt Bot Telegram thông báo báo hỏng & sửa chữa"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition cursor-pointer ${
                telegramActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>{telegramActive ? 'Telegram: Bật' : 'Cài đặt Telegram'}</span>
            </button>
          ) : telegramActive !== null ? (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border ${
                telegramActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${telegramActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>{telegramActive ? 'Telegram: Đang bật' : 'Telegram: Chưa bật'}</span>
            </span>
          ) : null}

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition cursor-pointer"
            title="Xuất file Excel danh sách sửa chữa bảo trì với tùy chọn sắp xếp"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Xuất Excel
          </button>

          <button
            onClick={() => setActiveTab(activeTab === 'LIST' ? 'REPORT' : 'LIST')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl border transition cursor-pointer ${
              activeTab === 'REPORT' 
                ? 'bg-purple-50 border-purple-300 text-purple-800' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-purple-600" /> 
            {activeTab === 'REPORT' ? 'Quay lại danh sách' : 'Báo Cáo Tháng / Quý / Năm'}
          </button>

          {user?.role !== 'VIEWER' && (
            <button
              onClick={() => {
                setCreateInitialAssetId(null);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Báo Hỏng / Sửa Chữa Mới
            </button>
          )}
        </div>
      </div>

      {/* 2. VISUAL STATUS STEPPER & SUMMARY CARDS */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => { setActiveTab('LIST'); setStatusFilter('ALL'); }}
          className={`text-left bg-white p-3.5 rounded-2xl border shadow-xs transition cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-blue-600 ring-1 ring-blue-500/30'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-heading font-semibold text-slate-500">Tổng thiết bị hỏng</div>
          <div className="font-heading text-xl font-bold text-slate-900 tabular-nums mt-1">
            {distinctAssetsCount} <span className="text-xs font-normal text-slate-400">thiết bị</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Toàn bộ danh sách</div>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('LIST'); setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); }}
          className={`text-left bg-white p-3.5 rounded-2xl border border-l-4 border-l-amber-500 shadow-xs transition cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'border-amber-500 ring-1 ring-amber-400/40 bg-amber-50/30'
              : 'border-slate-200/80 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-heading font-semibold text-amber-700">
            <span>1. Chờ tiếp nhận</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="font-heading text-xl font-bold text-amber-800 tabular-nums mt-1">
            {distinctPendingCount} <span className="text-xs font-normal text-amber-600">thiết bị</span>
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Bấm để lọc nhanh →</div>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('LIST'); setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'); }}
          className={`text-left bg-white p-3.5 rounded-2xl border border-l-4 border-l-blue-600 shadow-xs transition cursor-pointer ${
            statusFilter === 'IN_PROGRESS'
              ? 'border-blue-600 ring-1 ring-blue-500/40 bg-blue-50/30'
              : 'border-slate-200/80 hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-heading font-semibold text-blue-700">
            <span>2. Đang xử lý</span>
            <Wrench className="w-3.5 h-3.5" />
          </div>
          <div className="font-heading text-xl font-bold text-blue-800 tabular-nums mt-1">
            {distinctInProgressCount} <span className="text-xs font-normal text-blue-600">thiết bị</span>
          </div>
          <div className="text-[11px] text-blue-700/80 mt-0.5">Đang sửa chữa →</div>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('LIST'); setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED'); }}
          className={`text-left bg-white p-3.5 rounded-2xl border border-l-4 border-l-emerald-600 shadow-xs transition cursor-pointer ${
            statusFilter === 'COMPLETED'
              ? 'border-emerald-600 ring-1 ring-emerald-500/40 bg-emerald-50/30'
              : 'border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-heading font-semibold text-emerald-700">
            <span>3. Đã hoàn thành</span>
            <CheckCircle className="w-3.5 h-3.5" />
          </div>
          <div className="font-heading text-xl font-bold text-emerald-800 tabular-nums mt-1">
            {distinctCompletedCount} <span className="text-xs font-normal text-emerald-600">thiết bị</span>
          </div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Đã nghiệm thu →</div>
        </button>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[11px] font-heading font-semibold text-slate-500">Tổng kinh phí</div>
          <div className="font-heading text-base font-bold text-slate-900 tabular-nums mt-1.5">
            {Number(totalCost).toLocaleString('vi-VN')} đ
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Cộng dồn tất cả phiếu</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB 1: DANH SÁCH YÊU CẦU BÁO HỎNG & TIẾP NHẬN XỬ LÝ                     */}
      {/* ========================================================================= */}
      {activeTab === 'LIST' && (
        <div className="print:hidden space-y-3">
          {/* Filters bar */}
          <div className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={unitFilter}
                onChange={e => setUnitFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">-- Đơn vị tiếp nhận (Tất cả) --</option>
                <option value="DUOC">Khoa Dược (TBYT)</option>
                <option value="CNTT">Tổ CNTT</option>
                <option value="TCHC">Phòng TCHC</option>
              </select>

              {user?.role !== 'DEPARTMENT' && (
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ALL">-- Khoa / Phòng gửi yêu cầu --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id.toString()}>{d.code} - {d.name}</option>
                  ))}
                </select>
              )}

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">-- Trạng thái --</option>
                <option value="PENDING">Chờ tiếp nhận</option>
                <option value="IN_PROGRESS">Đang xử lý</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã thiết bị, người báo, sự cố..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none w-56 sm:w-64"
              />
            </div>
          </div>

          {/* Table */}
          <DataTableShell
            title="Danh sách yêu cầu bảo trì & sửa chữa"
            totalCount={filteredRequests.length}
            countLabel="phiếu"
            density={density}
            onDensityChange={setDensity}
            loading={loading}
            isEmpty={filteredRequests.length === 0}
            emptyMessage="Chưa có phiếu báo hỏng nào phù hợp."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50/90 text-slate-600 font-heading font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className={`${headPy} px-3.5 w-28 whitespace-nowrap`}>Mã TB</th>
                    <th className={`${headPy} px-3.5 min-w-[250px] whitespace-nowrap`}>Thiết bị &amp; Sự cố</th>
                    <th className={`${headPy} px-3.5 whitespace-nowrap`}>Khoa báo &amp; Người LH</th>
                    <th className={`${headPy} px-3.5 text-right whitespace-nowrap`}>Đơn vị &amp; Chi phí</th>
                    <th className={`${headPy} px-3.5 whitespace-nowrap`}>Trạng thái</th>
                    <th className={`${headPy} px-3.5 w-32 text-right whitespace-nowrap`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!loading &&
                    filteredRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                            {r.asset?.assetCode || 'N/A'}
                          </span>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top max-w-[340px]`}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-heading font-semibold text-slate-800 leading-snug break-words">
                              {r.asset?.name || (r as any).assetName || 'Thiết bị'}
                            </span>
                            {r.issueType === 'SOFTWARE' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70 text-[10px] font-semibold whitespace-nowrap">
                                <Laptop className="w-2.5 h-2.5" /> Phần mềm
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-snug break-words">
                            {r.issueDescription}
                          </p>
                          {(r.ultraViewId || parseAttachments(r.attachments).length > 0) && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {r.ultraViewId && (
                                <button
                                  type="button"
                                  onClick={() => copyText(r.ultraViewId!, 'ID UltraViewer')}
                                  title="Bấm để sao chép ID UltraViewer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 font-mono text-[10px] font-semibold cursor-pointer transition"
                                >
                                  <Laptop className="w-2.5 h-2.5 shrink-0" />
                                  <span>UV: {r.ultraViewId}{r.ultraViewPass ? ` / ${r.ultraViewPass}` : ''}</span>
                                  <Copy className="w-2.5 h-2.5 opacity-70" />
                                </button>
                              )}
                              {parseAttachments(r.attachments).length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(r, 'PROPOSAL')}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-medium cursor-pointer transition"
                                >
                                  <Camera className="w-2.5 h-2.5" />
                                  <span>{parseAttachments(r.attachments).length} ảnh</span>
                                </button>
                              )}
                            </div>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                            {r.asset?.assignedTo && (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-medium truncate max-w-[160px]">
                                <User className="w-3 h-3 shrink-0" />
                                <span className="truncate">{r.asset.assignedTo}</span>
                              </span>
                            )}
                            {r.locationDetail && (
                              <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{r.locationDetail}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top max-w-[220px]`}>
                          <div className="font-medium text-slate-800 truncate">{r.department?.name || 'CDC'}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{r.requestedBy}</span>
                            </span>
                            {r.contactPhone && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px]">
                                <Phone className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>{r.contactPhone}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                (r as any).managingUnit === 'DUOC'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                  : (r as any).managingUnit === 'CNTT'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                              }`}
                            >
                              {(r as any).managingUnit === 'DUOC'
                                ? 'Khoa Dược'
                                : (r as any).managingUnit === 'CNTT'
                                  ? 'Tổ CNTT'
                                  : 'Phòng TCHC'}
                            </span>
                          </div>
                          <div className="mt-1 font-sans font-semibold text-slate-800 tabular-nums">
                            {r.repairCost ? `${Number(r.repairCost).toLocaleString('vi-VN')} đ` : '—'}
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                                r.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                  : r.status === 'IN_PROGRESS'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                    : r.status === 'REJECTED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200/70'
                              }`}
                            >
                              {r.status === 'COMPLETED'
                                ? 'Đã hoàn thành'
                                : r.status === 'IN_PROGRESS'
                                  ? 'Đang xử lý'
                                  : r.status === 'REJECTED'
                                    ? 'Từ chối'
                                    : 'Chờ tiếp nhận'}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${
                                r.priority === 'URGENT'
                                  ? 'bg-rose-50 text-rose-700'
                                  : r.priority === 'HIGH'
                                    ? 'bg-orange-50 text-orange-700'
                                    : r.priority === 'MEDIUM'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {PRIORITY_LABELS[r.priority] || r.priority}
                            </span>
                          </div>
                        </td>

                        <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                          <RowActionMenu
                            primary={{
                              label: 'Xử lý',
                              title: 'Tiếp nhận & Cập nhật tiến độ',
                              icon: <Wrench className="w-3.5 h-3.5" />,
                              onClick: () => handleOpenProcess(r),
                              tone: 'amber',
                            }}
                            items={[
                              {
                                label: 'Xem chi tiết',
                                icon: <Eye className="w-3.5 h-3.5" />,
                                onClick: () => handleOpenDetail(r, 'PROPOSAL'),
                              },
                              {
                                label: 'In phiếu (A4)',
                                icon: <Printer className="w-3.5 h-3.5" />,
                                onClick: () => handleOpenDetail(r, 'ACCEPTANCE'),
                              },
                              {
                                label: 'Chỉnh sửa phiếu',
                                icon: <Edit3 className="w-3.5 h-3.5" />,
                                onClick: () => handleOpenEdit(r),
                              },
                              {
                                label: 'Xóa phiếu',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: () => handleDeleteRequest(r.id),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </DataTableShell>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 2: BÁO CÁO TÌNH HÌNH BÁO HỎNG & SỬA CHỮA (THÁNG / QUÝ / NĂM)        */}
      {/* ========================================================================= */}
      {activeTab === 'REPORT' && (
        <div className="space-y-6">
          {/* Period Selectors */}
          <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setReportPeriodType('MONTH')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportPeriodType === 'MONTH' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Tháng
                </button>
                <button
                  onClick={() => setReportPeriodType('QUARTER')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportPeriodType === 'QUARTER' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Theo Quý
                </button>
                <button
                  onClick={() => setReportPeriodType('YEAR')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportPeriodType === 'YEAR' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cả Năm
                </button>
              </div>

              {reportPeriodType === 'MONTH' && (
                <select
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              )}

              {reportPeriodType === 'QUARTER' && (
                <select
                  value={reportQuarter}
                  onChange={e => setReportQuarter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="1">Quý I (Tháng 1 - 3)</option>
                  <option value="2">Quý II (Tháng 4 - 6)</option>
                  <option value="3">Quý III (Tháng 7 - 9)</option>
                  <option value="4">Quý IV (Tháng 10 - 12)</option>
                </select>
              )}

              <select
                value={reportYear}
                onChange={e => setReportYear(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white font-mono"
              >
                <option value="2026">Năm 2026</option>
                <option value="2025">Năm 2025</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSignaturesModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Tùy chỉnh chức danh và họ tên người ký dưới báo cáo"
              >
                <Users className="w-4 h-4 text-blue-600" /> Cấu hình Người ký
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                title="Xuất trực tiếp sang file PDF hoặc in ấn báo cáo chuẩn A4"
              >
                <Printer className="w-4 h-4" /> Xuất PDF / In Báo Cáo A4
              </button>
            </div>
          </div>

          {/* PRINTABLE REPORT A4 */}
          <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0">
            {/* Report Header */}
            <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-6">
              <div>
                <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT TP ĐÀ NẴNG</div>
                <div className="text-slate-600">BỘ PHẬN QUẢN LÝ TRANG THIẾT BỊ</div>
              </div>
              <div className="text-right">
                <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
              </div>
            </div>

            <div className="text-center my-6">
              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
                BÁO CÁO TỔNG HỢP TÌNH HÌNH BÁO HỎNG & SỬA CHỮA THIẾT BỊ
              </h2>
              <p className="text-xs sm:text-sm italic text-slate-600 mt-1 font-sans">
                Kỳ báo cáo: {
                  reportPeriodType === 'MONTH' ? `Tháng ${reportMonth}/${reportYear}` :
                  reportPeriodType === 'QUARTER' ? `Quý ${reportQuarter} Năm ${reportYear}` :
                  `Cả Năm ${reportYear}`
                }
              </p>
            </div>

            {/* KPI Summary Row */}
            <div className="grid grid-cols-4 gap-3 font-sans text-xs mb-6 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-slate-500 font-medium">Tổng thiết bị hỏng / sửa</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{reportData?.summary?.distinctAssetCount || reportData?.summary?.total || 0} thiết bị</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-emerald-700 font-medium">Đã hoàn thành sửa</div>
                <div className="text-lg font-bold text-emerald-900 mt-0.5">{reportData?.summary?.completed || 0}</div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="text-blue-700 font-medium">Đang trong tiến trình</div>
                <div className="text-lg font-bold text-blue-900 mt-0.5">{reportData?.summary?.inProgress || 0}</div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="text-purple-700 font-medium">Tổng kinh phí thực hiện</div>
                <div className="text-base font-bold text-purple-900 mt-0.5">
                  {reportData?.summary?.totalCost ? Number(reportData.summary.totalCost).toLocaleString('vi-VN') : 0} đ
                </div>
              </div>
            </div>

            {/* 1. Tổng hợp theo Đơn vị chuyên trách tiếp nhận */}
            <div className="font-sans text-xs mb-6">
              <h4 className="font-bold text-sm uppercase text-slate-900 mb-2">1. Tổng hợp theo Khối Quản lý tiếp nhận & xử lý</h4>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300">
                    <tr>
                      <th className="p-2.5">Đơn vị chuyên trách</th>
                      <th className="p-2.5 text-center">Số lượng thiết bị</th>
                      <th className="p-2.5 text-center">Đã sửa xong</th>
                      <th className="p-2.5 text-right">Tổng chi phí sửa chữa (đ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportData?.byUnit?.map((u: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold text-slate-900">{u.name}</td>
                        <td className="p-2.5 text-center font-bold">{u.count}</td>
                        <td className="p-2.5 text-center text-emerald-700 font-bold">{u.completed}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{Number(u.cost).toLocaleString('vi-VN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Chi tiết từng ca báo hỏng */}
            <div className="font-sans text-xs mb-8">
              <h4 className="font-bold text-sm uppercase text-slate-900 mb-2">2. Danh sách chi tiết các sự cố thiết bị</h4>
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold border-b border-slate-300 text-center">
                    <tr>
                      <th className="p-2 w-8">STT</th>
                      <th className="p-2 text-left">Mã & Tên thiết bị</th>
                      <th className="p-2 text-left">Khoa / Phòng yêu cầu</th>
                      <th className="p-2 text-left min-w-[160px]">Nội dung sự cố & Khắc phục</th>
                      <th className="p-2 text-left">Kỹ thuật viên</th>
                      <th className="p-2 text-right">Kinh phí (đ)</th>
                      <th className="p-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportData?.records?.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-slate-400">Không có dữ liệu trong kỳ này.</td></tr>
                    ) : (
                      reportData?.records?.map((r: any, idx: number) => (
                        <tr key={r.id}>
                          <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                          <td className="p-2">
                            <div className="font-bold text-slate-900">{r.asset?.name}</div>
                            <div className="font-mono text-[10px] text-blue-700">{r.asset?.assetCode}</div>
                          </td>
                          <td className="p-2 font-medium">{r.department?.name || 'CDC'}</td>
                          <td className="p-2">
                            <div className="text-slate-800">{r.issueDescription}</div>
                            {r.repairNote && <div className="text-[10px] text-emerald-700 italic mt-0.5">Xử lý: {r.repairNote}</div>}
                          </td>
                          <td className="p-2 font-medium">{r.technicianName || '-'}</td>
                          <td className="p-2 text-right font-mono font-bold">
                            {r.repairCost ? Number(r.repairCost).toLocaleString('vi-VN') : '-'}
                          </td>
                          <td className="p-2 text-center font-bold">
                            {r.status === 'COMPLETED' ? <span className="text-emerald-700">Đã sửa xong</span> :
                             r.status === 'IN_PROGRESS' ? <span className="text-blue-700">Đang sửa</span> :
                             <span className="text-amber-700">Chờ sửa</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Report Signatures */}
            <div className="font-sans text-xs sm:text-sm pt-4">
              <div className="text-right italic mb-4">Đà Nẵng, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="font-bold uppercase text-slate-900">{signatures.reporterTitle}</div>
                  <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
                  <div className="font-bold text-slate-800">{signatures.reporterName}</div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-900">{signatures.techTitle}</div>
                  <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
                  <div className="font-bold text-slate-800">{signatures.techName}</div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-900">{signatures.directorTitle}</div>
                  <div className="text-[11px] italic text-slate-500 mb-20">(Ký, đóng dấu)</div>
                  <div className="font-bold text-slate-800">{signatures.directorName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: TẠO YÊU CẦU BÁO HỎNG / SỬA CHỮA MỚI (KHOA / PHÒNG GỬI)            */}
      {/* ========================================================================= */}
      <CreateMaintenanceModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setCreateInitialAssetId(null);
        }}
        onSuccess={loadData}
        user={user}
        assets={assets}
        departments={departments}
        initialAssetId={createInitialAssetId}
        telegramActive={telegramActive}
        onGoScanQr={() => navigate('/qr-scanner')}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: TIẾP NHẬN & XỬ LÝ SỬA CHỮA (KỸ THUẬT VIÊN / QUẢN LÝ)             */}
      {/* ========================================================================= */}
      {showProcessModal && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Tiếp Nhận & Xử Lý Sự Cố Thiết Bị</h3>
                <p className="text-xs text-slate-500 mt-0.5">[{selectedRequest.asset?.assetCode}] {selectedRequest.asset?.name}</p>
              </div>
              <button onClick={() => setShowProcessModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            {/* Request Summary Box */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><strong>Khoa/Phòng:</strong> {selectedRequest.department?.name}</div>
                {selectedRequest.issueType === 'SOFTWARE' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                    <Laptop className="w-3 h-3" /> Lỗi phần mềm / Hỗ trợ từ xa
                  </span>
                )}
              </div>
              <div><strong>Người báo hỏng:</strong> {selectedRequest.requestedBy} {selectedRequest.contactPhone ? `(${selectedRequest.contactPhone})` : ''}</div>
              <div><strong>Hiện trạng sự cố:</strong> <span className="text-red-700 font-medium">{selectedRequest.issueDescription}</span></div>

              {selectedRequest.ultraViewId && (
                <div className="mt-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-bold text-blue-900">
                      <Laptop className="w-3.5 h-3.5" /> UltraViewer:
                    </span>
                    <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                      ID: {selectedRequest.ultraViewId}
                    </span>
                    {selectedRequest.ultraViewPass && (
                      <span className="font-mono font-bold text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                        MK: {selectedRequest.ultraViewPass}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyText(selectedRequest.ultraViewId!, 'ID UltraViewer')}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy ID
                    </button>
                    {selectedRequest.ultraViewPass && (
                      <button
                        type="button"
                        onClick={() => copyText(selectedRequest.ultraViewPass!, 'Mật khẩu UltraViewer')}
                        className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3" /> Copy MK
                      </button>
                    )}
                  </div>
                </div>
              )}

              {parseAttachments(selectedRequest.attachments).length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Ảnh hiện trạng đính kèm:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {parseAttachments(selectedRequest.attachments).map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg overflow-hidden border border-slate-200 bg-white aspect-video hover:opacity-90 transition"
                        title="Bấm để xem ảnh phóng to"
                      >
                        <img src={url} alt={`Ảnh sự cố ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleProcessSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Cập nhật trạng thái xử lý (*)</label>
                <select
                  value={processData.status}
                  onChange={e => setProcessData({ ...processData, status: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="IN_PROGRESS">🔄 Đang xử lý / Đang sửa chữa</option>
                  <option value="COMPLETED">✅ Đã hoàn thành (Thiết bị hoạt động bình thường)</option>
                  <option value="REJECTED">❌ Từ chối / Chuyển đề xuất thanh lý</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Cán bộ kỹ thuật tiếp nhận / xử lý (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: KS. Phan Thanh Hoàn (Tổ CNTT)..."
                  value={processData.technicianName}
                  onChange={e => setProcessData({ ...processData, technicianName: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Quyết định số / Phê duyệt</label>
                  <input
                    type="text"
                    placeholder="QĐ số 12/QĐ-TTKSBT..."
                    value={processData.decisionNumber}
                    onChange={e => setProcessData({ ...processData, decisionNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nguồn kinh phí thực hiện</label>
                  <select
                    value={processData.fundingSource}
                    onChange={e => setProcessData({ ...processData, fundingSource: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="Nguồn thu dịch vụ y tế">Nguồn thu dịch vụ y tế</option>
                    <option value="Nguồn ngân sách nhà nước cấp">Nguồn ngân sách nhà nước cấp</option>
                    <option value="Quỹ phát triển hoạt động sự nghiệp">Quỹ phát triển hoạt động sự nghiệp</option>
                    <option value="Nguồn dự án / Viện trợ">Nguồn dự án / Viện trợ</option>
                    <option value="Nguồn chi thường xuyên">Nguồn chi thường xuyên</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Chi phí sửa chữa (đ)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={processData.repairCost}
                    onChange={e => setProcessData({ ...processData, repairCost: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đơn vị / Hãng sửa chữa</label>
                  <input
                    type="text"
                    placeholder="Tự sửa / Tên nhà cung cấp..."
                    value={processData.repairVendor}
                    onChange={e => setProcessData({ ...processData, repairVendor: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Linh kiện thay thế</label>
                  <input
                    type="text"
                    placeholder="Nguồn, RAM, Ổ cứng SSD, Sensor..."
                    value={processData.replacementParts}
                    onChange={e => setProcessData({ ...processData, replacementParts: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Thành phần nghiệm thu</label>
                  <input
                    type="text"
                    placeholder="Người dùng, Kỹ thuật viên, Phòng TCKT..."
                    value={processData.acceptanceMembers}
                    onChange={e => setProcessData({ ...processData, acceptanceMembers: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Nội dung công việc & Kết quả nghiệm thu</label>
                <textarea
                  rows={3}
                  placeholder="Ghi rõ linh kiện đã thay thế, giải pháp xử lý, tình trạng máy sau khi sửa..."
                  value={processData.repairNote}
                  onChange={e => setProcessData({ ...processData, repairNote: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lưu Cập Nhật Tiến Độ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: TÙY CHỈNH CHỮ KÝ VÀ NGƯỜI KÝ DƯỚI BÁO CÁO                         */}
      {/* ========================================================================= */}
      {showSignaturesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Cấu Hình Người Ký Báo Cáo Sửa Chữa</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tùy chỉnh chức danh & họ tên in dưới chân trang báo cáo</p>
              </div>
              <button onClick={() => setShowSignaturesModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveSignatures(signatures);
              }}
              className="space-y-4 text-xs"
            >
              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 mr-1">Gợi ý nhanh:</span>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    techTitle: 'TỔ TRƯỞNG TỔ CNTT',
                    techName: 'KTV. Phan Thanh Hoàn'
                  })}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px] hover:bg-blue-200 cursor-pointer"
                >
                  💻 Khối CNTT
                </button>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    techTitle: 'TRƯỞNG KHOA DƯỢC - VTYT',
                    techName: 'DS. Trưởng Khoa Dược'
                  })}
                  className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] hover:bg-emerald-200 cursor-pointer"
                >
                  🩺 Khối Dược (TBYT)
                </button>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    techTitle: 'TRƯỞNG PHÒNG TỔ CHỨC - HÀNH CHÍNH',
                    techName: 'Trưởng phòng TCHC'
                  })}
                  className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] hover:bg-amber-200 cursor-pointer"
                >
                  🏢 Khối TCHC
                </button>
              </div>

              {/* 1. Người lập */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">1. Vị trí Bên Trái (Người lập báo cáo)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.reporterTitle}
                      onChange={e => setSignatures({ ...signatures, reporterTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.reporterName}
                      onChange={e => setSignatures({ ...signatures, reporterName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Đơn vị kỹ thuật */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">2. Vị trí Ở Giữa (Phụ trách đơn vị kỹ thuật)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.techTitle}
                      onChange={e => setSignatures({ ...signatures, techTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.techName}
                      onChange={e => setSignatures({ ...signatures, techName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Ban Giám Đốc */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">3. Vị trí Bên Phải (Ban Giám Đốc phê duyệt)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.directorTitle}
                      onChange={e => setSignatures({ ...signatures, directorTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.directorName}
                      onChange={e => setSignatures({ ...signatures, directorName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSignaturesModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lưu Cấu Hình Người Ký
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CHỈNH SỬA TOÀN BỘ NỘI DUNG PHIẾU BẢO TRÌ / SỬA CHỮA              */}
      {/* ========================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 max-h-[92vh] overflow-y-auto space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Chỉnh Sửa Toàn Bộ Hồ Sơ Sửa Chữa / Bảo Trì</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cho phép chỉnh sửa thông tin kỹ thuật, kinh phí, đơn vị thực hiện, số quyết định</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Row 1: Khoa phòng & Khối quản lý */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Khoa / Phòng sử dụng</label>
                  {user?.role === 'DEPARTMENT' ? (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-800 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>{user.fullName || departments.find(d => d.id.toString() === editData.departmentId)?.name || 'Khoa / Phòng của bạn'}</span>
                    </div>
                  ) : (
                    <select
                      value={editData.departmentId}
                      onChange={e => setEditData({ ...editData, departmentId: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-xs bg-white"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Khối chuyên trách quản lý</label>
                  <select
                    value={editData.managingUnit}
                    onChange={e => setEditData({ ...editData, managingUnit: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-blue-50/70 text-blue-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                  >
                    <option value="ALL">📋 Tất cả các khối (CNTT, Dược, TCHC)</option>
                    <option value="CNTT">💻 Khối Thiết bị CNTT (Tổ CNTT)</option>
                    <option value="DUOC">🩺 Khối Trang thiết bị Y tế (Khoa Dược)</option>
                    <option value="TCHC">🏢 Khối Thiết bị Hành chính (Phòng TCHC)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Chọn thiết bị dạng BẢNG CHIA CỘT RÕ RÀNG */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-slate-700 uppercase flex items-center gap-1.5">
                    <span>Thiết bị hỏng / cần sửa (*):</span>
                    {selectedEditAsset && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-md text-[11px] border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đã chọn: [{selectedEditAsset.assetCode}] {selectedEditAsset.name}</span>
                      </span>
                    )}
                  </label>
                  <span className="text-[11px] text-blue-600 font-semibold">({editDepartmentAssets.length} thiết bị phù hợp)</span>
                </div>

                {/* Quick Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, managingUnit: 'ALL' })}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                      editData.managingUnit === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, managingUnit: 'CNTT' })}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                      editData.managingUnit === 'CNTT'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    💻 Tổ CNTT
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, managingUnit: 'DUOC' })}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                      editData.managingUnit === 'DUOC'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    🩺 Khoa Dược (TBYT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditData({ ...editData, managingUnit: 'TCHC' })}
                    className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                      editData.managingUnit === 'TCHC'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    🏢 Phòng TCHC
                  </button>
                </div>

                {/* Quick Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm nhanh theo mã tài sản, tên thiết bị, người sử dụng, phòng máy..."
                    value={editAssetSearch}
                    onChange={e => setEditAssetSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-xl bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Bảng chia cột danh sách thiết bị chỉnh sửa */}
                <AssetPickerTable
                  mode="single"
                  assets={editDepartmentAssets}
                  selectedId={editData.assetId}
                  showDepartment={false}
                  accentColor="blue"
                  emptyMessage="Không tìm thấy thiết bị nào phù hợp."
                  onSelect={(a) => {
                    setEditData({
                      ...editData,
                      assetId: a.id.toString(),
                      locationDetail: a.locationDetail || editData.locationDetail,
                      departmentId: a.departmentId ? a.departmentId.toString() : editData.departmentId,
                      managingUnit: (a as any).managingUnit || editData.managingUnit,
                    });
                  }}
                />
              </div>

              {/* Row 3: Người báo & SĐT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Người đề nghị</label>
                  <input
                    type="text"
                    required
                    value={editData.requestedBy}
                    onChange={e => setEditData({ ...editData, requestedBy: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={editData.contactPhone}
                    onChange={e => setEditData({ ...editData, contactPhone: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Vị trí phòng / tầng</label>
                  <input
                    type="text"
                    value={editData.locationDetail}
                    onChange={e => setEditData({ ...editData, locationDetail: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Ngày báo hỏng, Mức ưu tiên & Trạng thái */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ngày báo hỏng</label>
                  <input
                    type="date"
                    value={editData.requestDate}
                    onChange={e => setEditData({ ...editData, requestDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Mức độ ưu tiên</label>
                  <select
                    value={editData.priority}
                    onChange={e => setEditData({ ...editData, priority: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Trung bình</option>
                    <option value="HIGH">Cao</option>
                    <option value="URGENT">Khẩn cấp</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Trạng thái xử lý</label>
                  <select
                    value={editData.status}
                    onChange={e => setEditData({ ...editData, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  >
                    <option value="PENDING">Chờ tiếp nhận</option>
                    <option value="IN_PROGRESS">Đang xử lý</option>
                    <option value="COMPLETED">Đã hoàn thành</option>
                    <option value="REJECTED">Từ chối</option>
                  </select>
                </div>
              </div>

              {/* Phân loại lỗi & UltraViewer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Phân loại sự cố</label>
                  <select
                    value={editData.issueType || 'HARDWARE'}
                    onChange={e => setEditData({ ...editData, issueType: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="HARDWARE">🔧 Lỗi phần cứng / Thiết bị</option>
                    <option value="SOFTWARE">💻 Lỗi phần mềm / Hỗ trợ từ xa</option>
                    <option value="OTHER">📋 Sự cố / Yêu cầu khác</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">ID UltraViewer</label>
                  <input
                    type="text"
                    placeholder="VD: 12 345 678"
                    value={editData.ultraViewId || ''}
                    onChange={e => setEditData({ ...editData, ultraViewId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Mật khẩu UltraViewer</label>
                  <input
                    type="text"
                    placeholder="VD: 4829"
                    value={editData.ultraViewPass || ''}
                    onChange={e => setEditData({ ...editData, ultraViewPass: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Mô tả sự cố */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mô tả chi tiết sự cố</label>
                <textarea
                  rows={2}
                  required
                  value={editData.issueDescription}
                  onChange={e => setEditData({ ...editData, issueDescription: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Thông tin xử lý & Kinh phí */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="font-bold text-slate-800 text-xs uppercase">Thông tin kỹ thuật & Kinh phí sửa chữa</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Cán bộ kỹ thuật / Tiếp nhận</label>
                    <input
                      type="text"
                      value={editData.technicianName}
                      onChange={e => setEditData({ ...editData, technicianName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Đơn vị sửa chữa / Đối tác</label>
                    <input
                      type="text"
                      value={editData.repairVendor}
                      onChange={e => setEditData({ ...editData, repairVendor: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Kinh phí sửa chữa (VNĐ)</label>
                    <input
                      type="number"
                      value={editData.repairCost}
                      onChange={e => setEditData({ ...editData, repairCost: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Nguồn kinh phí</label>
                    <select
                      value={editData.fundingSource}
                      onChange={e => setEditData({ ...editData, fundingSource: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    >
                      <option value="Nguồn ngân sách">Nguồn ngân sách</option>
                      <option value="Nguồn thu dịch vụ y tế">Nguồn thu dịch vụ y tế</option>
                      <option value="Nguồn thu sự nghiệp">Nguồn thu sự nghiệp</option>
                      <option value="Nguồn viện trợ / Khác">Nguồn viện trợ / Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Số quyết định / Hợp đồng</label>
                    <input
                      type="text"
                      value={editData.decisionNumber}
                      onChange={e => setEditData({ ...editData, decisionNumber: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Ngày hoàn thành</label>
                    <input
                      type="date"
                      value={editData.completedDate}
                      onChange={e => setEditData({ ...editData, completedDate: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Linh kiện thay thế</label>
                    <input
                      type="text"
                      value={editData.replacementParts}
                      onChange={e => setEditData({ ...editData, replacementParts: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Thành viên nghiệm thu</label>
                    <input
                      type="text"
                      value={editData.acceptanceMembers}
                      onChange={e => setEditData({ ...editData, acceptanceMembers: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Nội dung xử lý & Ghi chú kỹ thuật</label>
                  <textarea
                    rows={2}
                    value={editData.repairNote}
                    onChange={e => setEditData({ ...editData, repairNote: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lưu Toàn Bộ Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: XUẤT EXCEL DANH SÁCH SỬA CHỮA / BẢO TRÌ CÓ SẮP XẾP CHỈ ĐỊNH       */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Xuất Danh Sách Sửa Chữa Sang Excel</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tùy chọn sắp xếp theo danh mục chỉ định & thứ tự</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5">Sắp xếp danh sách theo</label>
                <select
                  value={exportSortBy}
                  onChange={e => setExportSortBy(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fundingSource">💰 Nguồn kinh phí (Ngân sách, Dịch vụ y tế, Thu sự nghiệp...)</option>
                  <option value="status">📌 Tình trạng xử lý (Chờ tiếp nhận, Đang xử lý, Đã hoàn thành...)</option>
                  <option value="managingUnit">🏢 Khối quản lý (CNTT, Khoa Dược, Phòng TCHC)</option>
                  <option value="department">🏛️ Khoa / Phòng yêu cầu (A-Z)</option>
                  <option value="priority">⚡ Mức độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp)</option>
                  <option value="date">📅 Ngày báo hỏng / sửa chữa</option>
                  <option value="cost">💵 Chi phí sửa chữa</option>
                  <option value="assetCode">🏷️ Mã thiết bị (Asset Code)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5">Thứ tự hiển thị</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportSortOrder('asc')}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition ${
                      exportSortOrder === 'asc'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Tăng dần (A ➔ Z / Cũ ➔ Mới)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportSortOrder('desc')}
                    className={`p-2.5 rounded-xl border text-center font-bold cursor-pointer transition ${
                      exportSortOrder === 'desc'
                        ? 'bg-blue-50 border-blue-500 text-blue-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Giảm dần (Z ➔ A / Mới ➔ Cũ)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl text-blue-800 text-[11px]">
                <p>💡 File Excel xuất ra sẽ được định dạng chuẩn CDC Đà Nẵng, có kẻ bảng, tổng hợp kinh phí bằng công thức SUM và sẵn 3 khối chữ ký.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Tải File Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL XEM CHI TIẾT & IN PHIẾU SỬA CHỮA / BÁO HỎNG (KHỔ A4)               */}
      {/* ========================================================================= */}
      {showDetailModal && detailRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/15 rounded-xl backdrop-blur-sm">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">Hồ Sơ Sửa Chữa Thiết Bị: {detailRequest.asset?.assetCode}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      detailRequest.status === 'COMPLETED' ? 'bg-emerald-500 text-white' :
                      detailRequest.status === 'IN_PROGRESS' ? 'bg-blue-500 text-white' :
                      detailRequest.status === 'REJECTED' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {detailRequest.status === 'COMPLETED' ? 'Đã hoàn thành' :
                       detailRequest.status === 'IN_PROGRESS' ? 'Đang xử lý' :
                       detailRequest.status === 'REJECTED' ? 'Từ chối' : 'Chờ tiếp nhận'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 truncate max-w-md">{detailRequest.asset?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
                  title="In trực tiếp văn bản này ra máy in hoặc lưu PDF"
                >
                  <Printer className="w-4 h-4" /> In Phiếu Này (A4)
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-xl transition text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Template Selector Tabs */}
            <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailPrintTab('PROPOSAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    detailPrintTab === 'PROPOSAL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Mẫu 1: Phiếu Báo Hỏng & Đề Xuất Sửa Chữa
                </button>
                <button
                  onClick={() => setDetailPrintTab('ACCEPTANCE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    detailPrintTab === 'ACCEPTANCE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mẫu 2: Biên Bản Nghiệm Thu & Bàn Giao
                </button>
              </div>
              <span className="text-[11px] text-slate-500 italic">Khổ giấy in tiêu chuẩn A4</span>
            </div>

            {/* Printable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50">
              {/* TAB 1: PHIẾU BÁO HỎNG & ĐỀ XUẤT SỬA CHỮA */}
              {detailPrintTab === 'PROPOSAL' && (
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto">
                  <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT TP ĐÀ NẴNG</div>
                      <div className="font-bold text-slate-700">
                        {detailRequest.department?.name?.toUpperCase() || 'KHOA / PHÒNG'}
                      </div>
                      <div className="text-[11px] text-slate-500">Mã phiếu: SC-2026-{detailRequest.id.toString().padStart(4, '0')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Đà Nẵng, ngày {detailRequest.requestDate ? new Date(detailRequest.requestDate).getDate() : new Date().getDate()} tháng {detailRequest.requestDate ? new Date(detailRequest.requestDate).getMonth() + 1 : new Date().getMonth() + 1} năm 2026
                      </div>
                    </div>
                  </div>

                  <div className="text-center my-5">
                    <h2 className="text-xl font-bold uppercase tracking-wide">
                      GIẤY ĐỀ NGHỊ SỬA CHỮA / BẢO DƯỠNG THIẾT BỊ
                    </h2>
                    <p className="text-xs italic text-slate-600 font-sans mt-0.5">
                      Kính gửi: Ban Giám Đốc Trung tâm Kiểm soát bệnh tật TP Đà Nẵng
                    </p>
                    <p className="text-xs italic text-slate-600 font-sans">
                      Đồng kính gửi: {
                        detailRequest.managingUnit === 'DUOC' ? 'Khoa Dược - Vật tư y tế' :
                        detailRequest.managingUnit === 'CNTT' ? 'Tổ Công nghệ thông tin' :
                        'Phòng Tổ chức - Hành chính'
                      }
                    </p>
                  </div>

                  <div className="space-y-4 font-sans text-xs">
                    {/* Phần I: Thông tin người đề nghị */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-blue-800">
                        I. ĐƠN VỊ & NGƯỜI ĐỀ NGHỊ BÁO HỎNG
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>• Khoa / Phòng sử dụng: <b>{detailRequest.department?.name}</b></div>
                        <div>• Người đề nghị: <b>{detailRequest.requestedBy}</b></div>
                        <div>• Số điện thoại liên hệ: <b>{detailRequest.contactPhone || 'Chưa cung cấp'}</b></div>
                        <div>• Vị trí thiết bị: <b>{detailRequest.locationDetail || detailRequest.asset?.locationDetail || 'Tại phòng làm việc'}</b></div>
                      </div>
                    </div>

                    {/* Phần II: Thông tin thiết bị */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-blue-800">
                        II. THÔNG TIN TRANG THIẾT BỊ BÁO HỎNG
                      </div>
                      <table className="w-full text-left border-collapse bg-white border border-slate-300">
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2 font-bold w-1/3 bg-slate-100">Tên thiết bị:</td>
                            <td className="p-2 font-semibold text-slate-900">{detailRequest.asset?.name}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Mã tài sản:</td>
                            <td className="p-2 font-mono font-bold text-blue-700">{detailRequest.asset?.assetCode}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Khối quản lý:</td>
                            <td className="p-2">
                              {detailRequest.managingUnit === 'DUOC' ? 'Khoa Dược (Trang thiết bị Y tế)' :
                               detailRequest.managingUnit === 'CNTT' ? 'Tổ CNTT (Thiết bị Công nghệ thông tin)' :
                               'Phòng TCHC (Thiết bị điện & Cơ sở vật chất)'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Cấu hình / Thông số:</td>
                            <td className="p-2">{detailRequest.asset?.specifications || 'Theo cấu hình nguyên bản'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Phần III: Hiện trạng sự cố */}
                    <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2">
                      <div className="font-bold text-amber-900 uppercase text-[11px]">
                        III. HIỆN TRẠNG SỰ CỐ &amp; MÔ TẢ HỎNG HÓC
                      </div>
                      <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-slate-800 font-medium">
                        {detailRequest.issueDescription}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-700">
                        <div>
                          • Phân loại sự cố:{' '}
                          <b>
                            {detailRequest.issueType === 'SOFTWARE'
                              ? 'Lỗi phần mềm / Hỗ trợ từ xa'
                              : detailRequest.issueType === 'OTHER'
                              ? 'Sự cố khác'
                              : 'Lỗi phần cứng / Thiết bị'}
                          </b>
                        </div>
                        <div>
                          • Mức độ ưu tiên xử lý:{' '}
                          <b className="text-amber-800">{PRIORITY_LABELS[detailRequest.priority] || detailRequest.priority}</b>
                        </div>
                      </div>
                      {detailRequest.ultraViewId && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex flex-wrap items-center gap-3">
                          <span>
                            • UltraViewer ID: <b className="font-mono">{detailRequest.ultraViewId}</b>
                          </span>
                          {detailRequest.ultraViewPass && (
                            <span>
                              | Mật khẩu: <b className="font-mono">{detailRequest.ultraViewPass}</b>
                            </span>
                          )}
                        </div>
                      )}
                      {parseAttachments(detailRequest.attachments).length > 0 && (
                        <div className="print:hidden pt-1">
                          <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Ảnh hiện trạng đính kèm:</div>
                          <div className="grid grid-cols-3 gap-2">
                            {parseAttachments(detailRequest.attachments).map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden border border-slate-200 bg-white aspect-video hover:opacity-90"
                              >
                                <img src={url} alt={`Ảnh sự cố ${idx + 1}`} className="w-full h-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chữ ký 4 bên */}
                  <div className="mt-8 grid grid-cols-3 text-center text-xs font-sans pt-6 border-t border-slate-300">
                    <div>
                      <div className="font-bold">NGƯỜI ĐỀ NGHỊ</div>
                      <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-16"></div>
                      <div className="font-semibold">{detailRequest.requestedBy}</div>
                    </div>

                    <div>
                      <div className="font-bold">TRƯỞNG KHOA / PHÒNG</div>
                      <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-16"></div>
                      <div className="font-semibold">Lãnh đạo đơn vị sử dụng</div>
                    </div>

                    <div>
                      <div className="font-bold">ĐƠN VỊ CHUYÊN TRÁCH TIẾP NHẬN</div>
                      <div className="italic text-slate-500 text-[11px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-16"></div>
                      <div className="font-semibold">{detailRequest.technicianName || 'Cán bộ kỹ thuật'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: BIÊN BẢN NGHIỆM THU & BÀN GIAO SỬA CHỮA */}
              {detailPrintTab === 'ACCEPTANCE' && (
                <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0 max-w-3xl mx-auto">
                  <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT TP ĐÀ NẴNG</div>
                      <div className="font-bold text-slate-700">HỘI ĐỒNG NGHIỆM THU KỸ THUẬT</div>
                      <div className="text-[11px] text-slate-500">Số BB: NT-2026-{detailRequest.id.toString().padStart(4, '0')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Đà Nẵng, ngày {detailRequest.completedDate ? new Date(detailRequest.completedDate).getDate() : new Date().getDate()} tháng {detailRequest.completedDate ? new Date(detailRequest.completedDate).getMonth() + 1 : new Date().getMonth() + 1} năm 2026
                      </div>
                    </div>
                  </div>

                  <div className="text-center my-5">
                    <h2 className="text-xl font-bold uppercase tracking-wide">
                      BIÊN BẢN NGHIỆM THU & BÀN GIAO THIẾT BỊ SỬA CHỮA
                    </h2>
                    <p className="text-xs italic text-slate-600 font-sans mt-0.5">
                      Căn cứ kết quả kiểm tra kỹ thuật và khắc phục sự cố trang thiết bị
                    </p>
                  </div>

                  <div className="space-y-4 font-sans text-xs">
                    {/* Thông tin thiết bị */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-emerald-800">
                        1. ĐỐI TƯỢNG NGHIỆM THU BÀN GIAO
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>• Tên trang thiết bị: <b>{detailRequest.asset?.name}</b></div>
                        <div>• Mã tài sản: <b className="font-mono text-blue-700">{detailRequest.asset?.assetCode}</b></div>
                        <div>• Đơn vị sử dụng: <b>{detailRequest.department?.name}</b></div>
                        <div>• Vị trí bàn giao: <b>{detailRequest.locationDetail || detailRequest.asset?.locationDetail || 'Tại phòng'}</b></div>
                      </div>
                    </div>

                    {/* Nội dung đã thực hiện */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-800 uppercase text-[11px] mb-2 text-emerald-800">
                        2. NỘI DUNG SỬA CHỮA & THAY THẾ LINH KIỆN
                      </div>
                      <table className="w-full text-left border-collapse bg-white border border-slate-300">
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2 font-bold w-1/3 bg-slate-100">Đơn vị / Cán bộ sửa chữa:</td>
                            <td className="p-2">{detailRequest.repairVendor || detailRequest.technicianName || 'Tổ Kỹ thuật CDC'}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Linh kiện thay thế:</td>
                            <td className="p-2 font-medium">{detailRequest.replacementParts || 'Không thay linh kiện (khắc phục cân chỉnh)'}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Ghi chú kỹ thuật:</td>
                            <td className="p-2">{detailRequest.repairNote || 'Đã kiểm tra hoạt động ổn định'}</td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Kinh phí thực hiện:</td>
                            <td className="p-2 font-mono font-bold text-emerald-700">
                              {detailRequest.repairCost ? Number(detailRequest.repairCost).toLocaleString('vi-VN') + ' đ' : '0 đ'}
                            </td>
                          </tr>
                          <tr>
                            <td className="p-2 font-bold bg-slate-100">Nguồn kinh phí:</td>
                            <td className="p-2">{detailRequest.fundingSource || 'Nguồn kinh phí sự nghiệp'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Đánh giá kết luận */}
                    <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200">
                      <div className="font-bold text-emerald-900 uppercase text-[11px] mb-1">
                        3. KẾT LUẬN & BÀN GIAO SỬ DỤNG
                      </div>
                      <p className="text-slate-800 font-medium">
                        Thiết bị đã được sửa chữa, căn chỉnh hoàn tất. Tình trạng kỹ thuật sau sửa chữa: <b>{detailRequest.deviceStatusAfter || 'Hoạt động tốt, an toàn'}</b>. Các bên thống nhất nghiệm thu và bàn giao đưa vào vận hành bình thường.
                      </p>
                    </div>
                  </div>

                  {/* Chữ ký 4 bên */}
                  <div className="mt-8 grid grid-cols-4 text-center text-xs font-sans pt-6 border-t border-slate-300">
                    <div>
                      <div className="font-bold">ĐẠI DIỆN ĐƠN VỊ SỬ DỤNG</div>
                      <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-14"></div>
                      <div className="font-semibold">{detailRequest.requestedBy}</div>
                    </div>

                    <div>
                      <div className="font-bold">CÁN BỘ KỸ THUẬT</div>
                      <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-14"></div>
                      <div className="font-semibold">{detailRequest.technicianName || 'Cán bộ sửa chữa'}</div>
                    </div>

                    <div>
                      <div className="font-bold">TRƯỞNG BỘ PHẬN CHUYÊN TRÁCH</div>
                      <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký và ghi rõ họ tên)</div>
                      <div className="h-14"></div>
                      <div className="font-semibold">Khoa Dược / CNTT / TCHC</div>
                    </div>

                    <div>
                      <div className="font-bold">GIÁM ĐỐC DUYỆT</div>
                      <div className="italic text-slate-500 text-[10px] mt-0.5">(Ký tên & đóng dấu)</div>
                      <div className="h-14"></div>
                      <div className="font-semibold">TS. BS. Nguyễn Đại Vĩnh</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
