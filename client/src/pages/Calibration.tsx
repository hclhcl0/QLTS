import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, AlertTriangle, CheckCircle2, Clock, Award, Building, Calendar, 
  Search, Printer, DollarSign, FileText, CheckCircle, XCircle, Users,
  Layers, ShieldCheck, Sparkles, Download, Edit3, Trash2, Building2
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, apiDownload } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Asset, CalibrationRecord } from '../types';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';

export default function Calibration() {
  const { user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'MANAGER_DUOC';
  const toast = useToast();
  const confirm = useConfirm();
  const { density, setDensity, cellPy, headPy } = useTablePrefs('calibration');
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [medicalAssets, setMedicalAssets] = useState<Asset[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');

  // Export sorting state
  const [exportSortBy, setExportSortBy] = useState('date');
  const [exportSortOrder, setExportSortOrder] = useState('asc');

  // Create Form State
  const [formData, setFormData] = useState({
    assetId: '',
    serviceType: 'HIEU_CHUAN',
    servicePackage: 'Gói dịch vụ: Hiệu chuẩn, kiểm định thiết bị phục vụ đánh giá lại ISO17025',
    vendor: 'TT Kiểm định Hiệu chuẩn Đo lường Miền Nam (SMETES)',
    decisionNumber: 'Quyết định số 34/QĐ-TTKSBT ngày 27/01/2026',
    departmentLocation: 'Khoa Xét Nghiệm - CS1',
    calibrationDate: new Date().toISOString().split('T')[0],
    nextCalibrationDate: '',
    cost: '600000',
    performedBy: 'Ds. Tính, Ds. Lộc, Cn. Hải, Cn. Sơn',
    acceptanceMembers: 'Ds. Tính, Ds. Lộc, Cn. Hải, Cn. Sơn',
    deviceStatusAfter: 'Tốt (Đạt tiêu chuẩn ISO 17025)',
    result: 'PASS',
    certificateNumber: '',
    fundingSource: 'Thu sự nghiệp',
    note: ''
  });

  // Edit Form State
  const [editData, setEditData] = useState<any>({
    id: 0,
    assetId: '',
    serviceType: 'HIEU_CHUAN',
    servicePackage: '',
    vendor: '',
    decisionNumber: '',
    departmentLocation: '',
    calibrationDate: '',
    nextCalibrationDate: '',
    cost: '',
    performedBy: '',
    acceptanceMembers: '',
    deviceStatusAfter: '',
    result: 'PASS',
    certificateNumber: '',
    fundingSource: 'Thu sự nghiệp',
    note: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, aRes, statRes] = await Promise.allSettled([
        apiGet('/calibrations'),
        apiGet('/assets?managingUnit=DUOC&limit=5000'),
        apiGet('/calibrations/stats/summary')
      ]);

      if (cRes.status === 'fulfilled' && Array.isArray(cRes.value)) setRecords(cRes.value);
      if (aRes.status === 'fulfilled' && aRes.value?.assets) setMedicalAssets(aRes.value.assets);
      if (statRes.status === 'fulfilled') setStats(statRes.value);
    } catch (e) {
      console.error('Error fetching calibrations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter medical assets for Edit Modal - ALWAYS include editingRecord's asset so it maps perfectly
  const editMedicalAssets = useMemo(() => {
    let list = [...medicalAssets];
    if (editingRecord?.asset && !list.some(a => a.id === editingRecord.asset.id)) {
      list = [editingRecord.asset, ...list];
    } else if (editData.assetId && !list.some(a => a.id?.toString() === editData.assetId?.toString())) {
      const found = records.find(r => r.assetId?.toString() === editData.assetId?.toString())?.asset;
      if (found) list = [found, ...list];
    }
    return list.sort((a, b) => (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [medicalAssets, editData.assetId, editingRecord, records]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.assetId || !formData.calibrationDate) {
      toast.warning('Vui lòng chọn thiết bị y tế và ngày thực hiện!');
      return;
    }

    try {
      // auto calculate next date if not entered (+1 year)
      const calibDate = new Date(formData.calibrationDate);
      const nextDate = formData.nextCalibrationDate 
        ? new Date(formData.nextCalibrationDate).toISOString()
        : new Date(calibDate.setFullYear(calibDate.getFullYear() + 1)).toISOString();

      await apiPost('/calibrations', {
        assetId: parseInt(formData.assetId),
        calibrationDate: new Date(formData.calibrationDate).toISOString(),
        nextCalibrationDate: nextDate,
        serviceType: formData.serviceType,
        servicePackage: formData.servicePackage,
        vendor: formData.vendor,
        decisionNumber: formData.decisionNumber,
        departmentLocation: formData.departmentLocation,
        cost: parseFloat(formData.cost) || 0,
        performedBy: formData.performedBy,
        acceptanceMembers: formData.acceptanceMembers,
        deviceStatusAfter: formData.deviceStatusAfter,
        result: formData.result,
        certificateNumber: formData.certificateNumber || `SMETES-2026-${Date.now().toString().slice(-4)}`,
        fundingSource: formData.fundingSource,
        note: formData.note
      });

      toast.success('Đã thêm hồ sơ hiệu chuẩn / kiểm định TBYT thành công!');
      setShowModal(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu kết quả hiệu chuẩn');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: CalibrationRecord) => {
    setEditingRecord(rec);
    const assetIdStr = rec.assetId ? rec.assetId.toString() : (rec.asset?.id ? rec.asset.id.toString() : '');
    setEditData({
      id: rec.id,
      assetId: assetIdStr,
      serviceType: rec.serviceType || 'HIEU_CHUAN',
      servicePackage: (rec as any).servicePackage || '',
      vendor: rec.vendor || '',
      decisionNumber: (rec as any).decisionNumber || '',
      departmentLocation: (rec as any).departmentLocation || '',
      calibrationDate: rec.calibrationDate ? new Date(rec.calibrationDate).toISOString().split('T')[0] : '',
      nextCalibrationDate: rec.nextCalibrationDate ? new Date(rec.nextCalibrationDate).toISOString().split('T')[0] : '',
      cost: (rec as any).cost !== undefined && (rec as any).cost !== null ? (rec as any).cost.toString() : '',
      performedBy: rec.performedBy || '',
      acceptanceMembers: (rec as any).acceptanceMembers || '',
      deviceStatusAfter: (rec as any).deviceStatusAfter || '',
      result: rec.result || 'PASS',
      certificateNumber: rec.certificateNumber || '',
      fundingSource: (rec as any).fundingSource || 'Thu sự nghiệp',
      note: rec.note || ''
    });
    setShowEditModal(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData.assetId || !editData.calibrationDate) {
      toast.warning('Vui lòng chọn thiết bị y tế và ngày thực hiện!');
      return;
    }
    try {
      await apiPut(`/calibrations/${editData.id}`, {
        assetId: parseInt(editData.assetId),
        calibrationDate: new Date(editData.calibrationDate).toISOString(),
        nextCalibrationDate: editData.nextCalibrationDate ? new Date(editData.nextCalibrationDate).toISOString() : null,
        serviceType: editData.serviceType,
        servicePackage: editData.servicePackage,
        vendor: editData.vendor,
        decisionNumber: editData.decisionNumber,
        departmentLocation: editData.departmentLocation,
        cost: parseFloat(editData.cost) || 0,
        performedBy: editData.performedBy,
        acceptanceMembers: editData.acceptanceMembers,
        deviceStatusAfter: editData.deviceStatusAfter,
        result: editData.result,
        certificateNumber: editData.certificateNumber,
        fundingSource: editData.fundingSource,
        note: editData.note
      });
      toast.success('Đã cập nhật hồ sơ hiệu chuẩn / kiểm định thành công!');
      setShowEditModal(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi cập nhật hồ sơ');
    }
  };

  // Delete Record
  const handleDeleteRecord = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa hồ sơ hiệu chuẩn',
      message: 'Bạn có chắc chắn muốn xóa hồ sơ hiệu chuẩn này?',
      confirmLabel: 'Xóa hồ sơ',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/calibrations/${id}`);
      toast.success('Đã xóa hồ sơ hiệu chuẩn thành công!');
      fetchData();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa hồ sơ');
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    const params = new URLSearchParams();
    if (serviceTypeFilter && serviceTypeFilter !== 'ALL') params.append('serviceType', serviceTypeFilter);
    if (locationFilter && locationFilter !== 'ALL') params.append('location', locationFilter);
    if (resultFilter && resultFilter !== 'ALL') params.append('result', resultFilter);
    params.append('sortBy', exportSortBy);
    params.append('sortOrder', exportSortOrder);

    try {
      await apiDownload(`/export/calibrations?${params.toString()}`, 'hieu_chuan_tbyt.xlsx');
      toast.success('Đã xuất danh sách hiệu chuẩn ra file Excel.');
    } catch (e: any) {
      toast.error(e.message || 'Không thể xuất file Excel');
    }
    setShowExportModal(false);
  };

  // Filtered records
  const filteredRecords = records.filter(r => {
    const searchMatch = !search ||
      r.asset?.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.asset?.assetCode?.toLowerCase().includes(search.toLowerCase()) ||
      r.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      r.performedBy?.toLowerCase().includes(search.toLowerCase()) ||
      r.decisionNumber?.toLowerCase().includes(search.toLowerCase());

    const typeMatch = serviceTypeFilter === 'ALL' || r.serviceType === serviceTypeFilter;
    const locMatch = locationFilter === 'ALL' || (r as any).departmentLocation?.includes(locationFilter);
    const resMatch = resultFilter === 'ALL' || r.result === resultFilter;

    return searchMatch && typeMatch && locMatch && resMatch;
  });

  const distinctAssetsCount = new Set(records.map(r => r.assetId)).size;
  const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <div className="space-y-4 pb-12">
      {/* 1. COMPACT HEADER */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Hiệu Chuẩn, Kiểm Định &amp; Kiểm Xạ TBYT
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Khoa Dược - VTYT
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi định kỳ tính chuẩn xác, an toàn bức xạ &amp; chất lượng chuẩn <strong>ISO 17025</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 p-2 px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 shadow-2xs transition cursor-pointer"
            title="Xuất danh sách hiệu chuẩn TBYT ra file Excel"
            aria-label="Xuất Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span className="hidden lg:inline">Excel</span>
          </button>

          <button
            onClick={() => window.print()}
            title="In danh sách A4"
            aria-label="In A4"
            className="flex items-center gap-1.5 p-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 shadow-2xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
          </button>
          
          {canEdit && (
            <button 
              onClick={() => setShowModal(true)}
              title="Thêm phiếu kiểm định / hiệu chuẩn"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm KĐ</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. UNIFIED METRIC STRIP & FILTER BAR */}
      <div className="print:hidden bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: 'ALL', label: 'Tất cả', count: records.length, sub: `${distinctAssetsCount} TB` },
              { key: 'HIEU_CHUAN', label: 'Hiệu chuẩn', count: records.filter(r => r.serviceType === 'HIEU_CHUAN').length },
              { key: 'THU_NGHIEM', label: 'Thử nghiệm', count: records.filter(r => r.serviceType === 'THU_NGHIEM').length },
              { key: 'KIEM_DINH', label: 'Kiểm định', count: records.filter(r => r.serviceType === 'KIEM_DINH').length },
              { key: 'KIEM_XA', label: 'Kiểm xạ', count: records.filter(r => r.serviceType === 'KIEM_XA').length },
            ].map((pill) => {
              const active = serviceTypeFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setServiceTypeFilter(pill.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                    {pill.count}
                  </span>
                </button>
              );
            })}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-medium tabular-nums">
              Đạt chuẩn: <strong>{records.filter(r => r.result === 'PASS').length}</strong>
            </span>
          </div>

          <div className="text-xs font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200/70 tabular-nums">
            Tổng kinh phí: <strong className="text-slate-900">{Number(totalCost).toLocaleString('vi-VN')} đ</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Bộ phận sử dụng (Tất cả)</option>
              <option value="CS1">Cơ sở 1 (118 Lê Đình Lý)</option>
              <option value="CS2">Cơ sở 2 (Bàn Thạch)</option>
              <option value="HIV">Bộ phận HIV / AIDS</option>
              <option value="Virus">Bộ phận Virus / Vi sinh</option>
              <option value="HL">Bộ phận Hóa lý</option>
              <option value="CLS">Bộ phận Cận lâm sàng</option>
            </select>

            <select
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Kết quả (Tất cả)</option>
              <option value="PASS">Đạt chuẩn / Tốt</option>
              <option value="FAIL">Không hoạt động / Cần sửa</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên thiết bị, mã TBYT, đơn vị..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full"
            />
          </div>
        </div>
      </div>

      {/* 4. DATA TABLE */}
      <div className="print:hidden">
        <DataTableShell
          title="Hồ sơ kiểm định & hiệu chuẩn TBYT"
          totalCount={filteredRecords.length}
          countLabel="hồ sơ"
          density={density}
          onDensityChange={setDensity}
          loading={loading}
          isEmpty={filteredRecords.length === 0}
          emptyMessage="Không tìm thấy thiết bị nào phù hợp."
        >
          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {!loading &&
              filteredRecords.map((r) => (
                <div key={r.id} className="p-3.5 space-y-2 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/70 font-mono text-[11px] font-medium text-emerald-700">
                        {r.asset?.assetCode || '-'}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          r.serviceType === 'THU_NGHIEM'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                            : r.serviceType === 'KIEM_DINH'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                              : r.serviceType === 'KIEM_XA'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                        }`}
                      >
                        {r.serviceType === 'THU_NGHIEM'
                          ? 'Thử nghiệm'
                          : r.serviceType === 'KIEM_DINH'
                            ? 'Kiểm định'
                            : r.serviceType === 'KIEM_XA'
                              ? 'Kiểm xạ'
                              : 'Hiệu chuẩn'}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        r.result === 'PASS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                      }`}
                    >
                      {(r as any).deviceStatusAfter || (r.result === 'PASS' ? 'Tốt' : 'Không đạt')}
                    </span>
                  </div>

                  <div className="font-heading text-sm font-semibold text-slate-900 leading-snug">
                    {r.asset?.name}
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>
                      {(r as any).departmentLocation || r.asset?.department?.name || 'CDC'} ·{' '}
                      <strong className="text-slate-700">{r.vendor || 'TT SMETES'}</strong>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                      <span>
                        KĐ: <strong>{new Date(r.calibrationDate).toLocaleDateString('vi-VN')}</strong>
                        {r.nextCalibrationDate ? ` → ${new Date(r.nextCalibrationDate).toLocaleDateString('vi-VN')}` : ''}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'} đ
                      </span>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(r)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Cập nhật KĐ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRecord(r.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-md border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-medium cursor-pointer"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 font-heading font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className={`${headPy} px-3.5 w-28 whitespace-nowrap`}>Mã TBYT</th>
                  <th className={`${headPy} px-3.5 min-w-[260px] whitespace-nowrap`}>Thiết bị &amp; Khoa phòng</th>
                  <th className={`${headPy} px-3.5 whitespace-nowrap`}>Đơn vị &amp; Nghiệm thu</th>
                  <th className={`${headPy} px-3.5 whitespace-nowrap`}>Thời gian &amp; Hạn tới</th>
                  <th className={`${headPy} px-3.5 text-right whitespace-nowrap`}>Kết quả &amp; Kinh phí</th>
                  <th className={`${headPy} px-3.5 w-24 text-right whitespace-nowrap`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  filteredRecords.map((r) => (
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
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                              r.serviceType === 'THU_NGHIEM'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                                : r.serviceType === 'KIEM_DINH'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/70'
                                  : r.serviceType === 'KIEM_XA'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                            }`}
                          >
                            {r.serviceType === 'THU_NGHIEM'
                              ? 'Thử nghiệm'
                              : r.serviceType === 'KIEM_DINH'
                                ? 'Kiểm định'
                                : r.serviceType === 'KIEM_XA'
                                  ? 'Kiểm xạ'
                                  : 'Hiệu chuẩn'}
                          </span>
                          <span className="inline-flex items-center gap-1 truncate max-w-[200px]">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {(r as any).departmentLocation || r.asset?.department?.name || 'CDC'}
                            </span>
                          </span>
                        </div>
                      </td>

                      <td className={`${cellPy} px-3.5 align-top max-w-[250px]`}>
                        <div className="font-medium text-slate-700 leading-snug break-words">
                          {r.vendor || 'TT SMETES'}
                        </div>
                        <div className="mt-1 flex items-start gap-1 text-[11px] text-slate-500">
                          <Users className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug break-words">
                            {(r as any).acceptanceMembers || r.performedBy || '-'}
                          </span>
                        </div>
                      </td>

                      <td className={`${cellPy} px-3.5 align-top whitespace-nowrap`}>
                        <div className="font-medium text-slate-800 tabular-nums">
                          {new Date(r.calibrationDate).toLocaleDateString('vi-VN')}
                        </div>
                        {r.nextCalibrationDate ? (
                          <div className="mt-1 text-[11px] text-slate-500 tabular-nums">
                            Hạn tới: {new Date(r.nextCalibrationDate).toLocaleDateString('vi-VN')}
                          </div>
                        ) : (
                          <div className="mt-1 text-[11px] text-slate-400">Theo kỳ ISO</div>
                        )}
                      </td>

                      <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              r.result === 'PASS'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                            }`}
                          >
                            {(r as any).deviceStatusAfter || (r.result === 'PASS' ? 'Tốt' : 'Không đạt')}
                          </span>
                        </div>
                        <div className="mt-1 font-sans font-semibold text-slate-800 tabular-nums">
                          {r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'} đ
                        </div>
                      </td>

                      <td className={`${cellPy} px-3.5 align-top text-right whitespace-nowrap`}>
                        {canEdit ? (
                          <RowActionMenu
                            primary={{
                              label: 'Sửa',
                              title: 'Chỉnh sửa hồ sơ hiệu chuẩn',
                              icon: <Edit3 className="w-3.5 h-3.5" />,
                              onClick: () => handleOpenEdit(r),
                              tone: 'blue',
                            }}
                            items={[
                              {
                                label: 'Xóa hồ sơ',
                                icon: <Trash2 className="w-3.5 h-3.5" />,
                                onClick: () => handleDeleteRecord(r.id),
                                danger: true,
                              },
                            ]}
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">Chỉ xem</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DataTableShell>
      </div>

      {/* ========================================================================= */}
      {/* 5. PRINTABLE REPORT A4 (CHUẨN MẪU KHOA DƯỢC CDC ĐÀ NẴNG)                    */}
      {/* ========================================================================= */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-md border border-slate-200 font-serif text-slate-900 print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4">
          <div>
            <div className="font-bold uppercase">TRUNG TÂM KIỂM SOÁT BỆNH TẬT THÀNH PHỐ ĐÀ NẴNG</div>
            <div className="font-bold text-slate-700">KHOA DƯỢC - VẬT TƯ Y TẾ</div>
          </div>
          <div className="text-right">
            <div className="font-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="italic text-xs">Độc lập - Tự do - Hạnh phúc</div>
          </div>
        </div>

        <div className="text-center my-6">
          <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide">
            BẢNG THEO DÕI THỜI GIAN HIỆU CHUẨN, THỬ NGHIỆM, KIỂM ĐỊNH, KIỂM XẠ MÁY MÓC, TBYT NĂM 2026
          </h2>
          <p className="text-xs sm:text-sm italic text-slate-600 mt-1 font-sans">
            (Quyết định số 34/QĐ-TTKSBT ngày 27/01/2026 - Đánh giá tiêu chuẩn ISO 17025)
          </p>
        </div>

        <div className="border border-slate-400 rounded-lg overflow-hidden font-sans text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-center font-bold border-b border-slate-400 divide-x divide-slate-300">
              <tr>
                <th className="p-2 w-8">STT</th>
                <th className="p-2 min-w-[70px]">Mã TBYT</th>
                <th className="p-2 min-w-[180px]">Tên thiết bị y tế</th>
                <th className="p-2 min-w-[90px]">Bộ phận SD</th>
                <th className="p-2 min-w-[100px]">Nội dung thực hiện</th>
                <th className="p-2 min-w-[140px]">Đơn vị thực hiện</th>
                <th className="p-2 min-w-[80px]">Ngày xong</th>
                <th className="p-2 min-w-[90px]">Kinh phí (đ)</th>
                <th className="p-2 min-w-[70px]">Tình trạng</th>
                <th className="p-2 min-w-[130px]">Người nghiệm thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {filteredRecords.slice(0, 35).map((r, idx) => (
                <tr key={r.id} className="divide-x divide-slate-200">
                  <td className="p-2 text-center text-slate-600">{idx + 1}</td>
                  <td className="p-2 font-mono font-bold text-emerald-700">{r.asset?.assetCode || '-'}</td>
                  <td className="p-2 font-semibold text-slate-900">{r.asset?.name}</td>
                  <td className="p-2">{(r as any).departmentLocation || r.asset?.department?.name || 'CDC'}</td>
                  <td className="p-2">
                    {r.serviceType === 'THU_NGHIEM' ? 'Thử nghiệm ATSH' :
                     r.serviceType === 'KIEM_DINH' ? 'Kiểm định TBYT' :
                     r.serviceType === 'KIEM_XA' ? 'Kiểm xạ X-quang' : 'Hiệu chuẩn'}
                  </td>
                  <td className="p-2">{r.vendor || 'TT SMETES'}</td>
                  <td className="p-2 text-center">{new Date(r.calibrationDate).toLocaleDateString('vi-VN')}</td>
                  <td className="p-2 text-right font-mono font-bold">
                    {r.cost ? Number(r.cost).toLocaleString('vi-VN') : '0'}
                  </td>
                  <td className="p-2 text-center font-semibold text-emerald-700">{(r as any).deviceStatusAfter || 'Tốt'}</td>
                  <td className="p-2 text-[11px]">{(r as any).acceptanceMembers || r.performedBy || 'Ds. Tính, Ds. Lộc'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Signatures */}
        <div className="mt-10 pt-4 font-sans text-xs sm:text-sm">
          <div className="text-right italic mb-4">Đà Nẵng, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="font-bold uppercase text-slate-900">NGƯỜI LẬP BẢNG</div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
              <div className="font-bold text-slate-800">DS. Lê Xuân Lộc</div>
            </div>

            <div>
              <div className="font-bold uppercase text-slate-900">PHỤ TRÁCH KHOA DƯỢC - VTYT</div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
              <div className="font-bold text-slate-800">DS. Mai Thị Tính</div>
            </div>

            <div>
              <div className="font-bold uppercase text-slate-900">GIÁM ĐỐC TRUNG TÂM</div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, đóng dấu)</div>
              <div className="font-bold text-slate-800">Ông. Nguyễn Đại Vĩnh</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL THÊM PHIẾU HIỆU CHUẨN MỚI                                        */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Thêm Hồ Sơ Hiệu Chuẩn / Kiểm Định TBYT</h3>
                <p className="text-xs text-slate-500 mt-0.5">Khoa Dược - VTYT theo dõi chuẩn ISO 17025</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Chọn Trang thiết bị y tế (*)</label>
                <select
                  required
                  value={formData.assetId}
                  onChange={e => setFormData({ ...formData, assetId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">-- Chọn thiết bị trong danh mục Khoa Dược --</option>
                  {medicalAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.assetCode}] {a.name} ({a.department?.name || 'CDC'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Loại hình dịch vụ (*)</label>
                  <select
                    value={formData.serviceType}
                    onChange={e => setFormData({ ...formData, serviceType: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="HIEU_CHUAN">Hiệu chuẩn thiết bị đo lường</option>
                    <option value="THU_NGHIEM">Thử nghiệm an toàn sinh học</option>
                    <option value="KIEM_DINH">Kiểm định an toàn TBYT</option>
                    <option value="KIEM_XA">Kiểm xạ thiết bị X-quang</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Bộ phận sử dụng cụ thể</label>
                  <input
                    type="text"
                    placeholder="HIV-CS1, Virus-CS1, HL-CS2..."
                    value={formData.departmentLocation}
                    onChange={e => setFormData({ ...formData, departmentLocation: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đơn vị thực hiện (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.vendor}
                    onChange={e => setFormData({ ...formData, vendor: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Quyết định phê duyệt</label>
                  <input
                    type="text"
                    value={formData.decisionNumber}
                    onChange={e => setFormData({ ...formData, decisionNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ngày hoàn thành (*)</label>
                  <input
                    type="date"
                    required
                    value={formData.calibrationDate}
                    onChange={e => setFormData({ ...formData, calibrationDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Kinh phí thực hiện (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Người nghiệm thu (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.acceptanceMembers}
                    onChange={e => setFormData({ ...formData, acceptanceMembers: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đánh giá hoạt động sau HC</label>
                  <input
                    type="text"
                    value={formData.deviceStatusAfter}
                    onChange={e => setFormData({ ...formData, deviceStatusAfter: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-emerald-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lưu Hồ Sơ Hiệu Chuẩn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL CHỈNH SỬA HỒ SƠ HIỆU CHUẨN                                       */}
      {/* ========================================================================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Chỉnh Sửa Hồ Sơ Hiệu Chuẩn / Kiểm Định</h3>
                <p className="text-xs text-slate-500 mt-0.5">Cập nhật thông tin kỹ thuật, kinh phí, đơn vị kiểm định, kết quả</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Trang thiết bị y tế (*)</label>
                <select
                  required
                  value={editData.assetId}
                  onChange={e => setEditData({ ...editData, assetId: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                >
                  <option value="">-- Chọn thiết bị trong danh mục Khoa Dược --</option>
                  {editMedicalAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      [{a.assetCode}] {a.name} ({a.department?.name || 'CDC'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Loại hình dịch vụ (*)</label>
                  <select
                    value={editData.serviceType}
                    onChange={e => setEditData({ ...editData, serviceType: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="HIEU_CHUAN">Hiệu chuẩn thiết bị đo lường</option>
                    <option value="THU_NGHIEM">Thử nghiệm an toàn sinh học</option>
                    <option value="KIEM_DINH">Kiểm định an toàn TBYT</option>
                    <option value="KIEM_XA">Kiểm xạ thiết bị X-quang</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Bộ phận sử dụng cụ thể</label>
                  <input
                    type="text"
                    placeholder="HIV-CS1, Virus-CS1, HL-CS2..."
                    value={editData.departmentLocation}
                    onChange={e => setEditData({ ...editData, departmentLocation: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đơn vị thực hiện (*)</label>
                  <input
                    type="text"
                    required
                    value={editData.vendor}
                    onChange={e => setEditData({ ...editData, vendor: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Quyết định phê duyệt</label>
                  <input
                    type="text"
                    value={editData.decisionNumber}
                    onChange={e => setEditData({ ...editData, decisionNumber: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ngày thực hiện (*)</label>
                  <input
                    type="date"
                    required
                    value={editData.calibrationDate}
                    onChange={e => setEditData({ ...editData, calibrationDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Ngày hết hạn / Kế tiếp</label>
                  <input
                    type="date"
                    value={editData.nextCalibrationDate}
                    onChange={e => setEditData({ ...editData, nextCalibrationDate: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Kinh phí thực hiện (VNĐ)</label>
                  <input
                    type="number"
                    value={editData.cost}
                    onChange={e => setEditData({ ...editData, cost: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Nguồn kinh phí</label>
                  <select
                    value={editData.fundingSource}
                    onChange={e => setEditData({ ...editData, fundingSource: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white outline-none"
                  >
                    <option value="Thu sự nghiệp">Thu sự nghiệp</option>
                    <option value="Ngân sách nhà nước">Ngân sách nhà nước</option>
                    <option value="Dịch vụ y tế">Dịch vụ y tế</option>
                    <option value="Nguồn viện trợ / Khác">Nguồn viện trợ / Khác</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Cán bộ thực hiện</label>
                  <input
                    type="text"
                    value={editData.performedBy}
                    onChange={e => setEditData({ ...editData, performedBy: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Người nghiệm thu (*)</label>
                  <input
                    type="text"
                    required
                    value={editData.acceptanceMembers}
                    onChange={e => setEditData({ ...editData, acceptanceMembers: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Kết quả đánh giá</label>
                  <select
                    value={editData.result}
                    onChange={e => setEditData({ ...editData, result: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold outline-none"
                  >
                    <option value="PASS">PASS - Đạt chuẩn ISO / Tốt</option>
                    <option value="FAIL">FAIL - Không đạt chuẩn / Cần sửa</option>
                    <option value="CONDITIONAL">CONDITIONAL - Đạt có điều kiện</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Đánh giá hoạt động sau HC</label>
                  <input
                    type="text"
                    value={editData.deviceStatusAfter}
                    onChange={e => setEditData({ ...editData, deviceStatusAfter: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-emerald-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={editData.note}
                  onChange={e => setEditData({ ...editData, note: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Cập Nhật Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL XUẤT EXCEL HỒ SƠ HIỆU CHUẨN CÓ SẮP XẾP CHỈ ĐỊNH                   */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Xuất Danh Sách Hiệu Chuẩn TBYT</h3>
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
                  <option value="fundingSource">Nguồn kinh phí (Thu sự nghiệp, Ngân sách, Dịch vụ y tế...)</option>
                  <option value="result">Kết quả đánh giá / Tình trạng (Đạt chuẩn, Không đạt...)</option>
                  <option value="serviceType">Loại hình dịch vụ (Hiệu chuẩn, Thử nghiệm, Kiểm định, Kiểm xạ)</option>
                  <option value="decisionNumber">Số quyết định phê duyệt (QĐ số 34...)</option>
                  <option value="location">Bộ phận / Khoa phòng sử dụng (HIV, Virus, Hóa lý...)</option>
                  <option value="date">Ngày thực hiện</option>
                  <option value="nextDate">Hạn hiệu chuẩn kế tiếp</option>
                  <option value="cost">Kinh phí thực hiện</option>
                  <option value="assetCode">Mã thiết bị y tế (TBYT Code)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1.5">Thứ tự hiển thị</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportSortOrder('asc')}
                    className={`p-2.5 rounded-md border text-center font-bold cursor-pointer transition ${
                      exportSortOrder === 'asc'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Tăng dần (A - Z / Cũ - Mới)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportSortOrder('desc')}
                    className={`p-2.5 rounded-md border text-center font-bold cursor-pointer transition ${
                      exportSortOrder === 'desc'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Giảm dần (Z - A / Mới - Cũ)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-[11px]">
                <p>File Excel xuất ra sẽ được định dạng chuẩn Khoa Dược CDC Đà Nẵng, có kẻ bảng, tổng hợp kinh phí bằng công thức SUM và sẵn 3 khối chữ ký (Người lập, Trưởng Khoa Dược, Ban Giám Đốc).</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Tải File Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
