import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  Laptop,
  MapPin,
  Monitor,
  PackageCheck,
  Phone,
  QrCode,
  Search,
  Send,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { apiPostForm } from '../lib/api';
import { Asset, Department } from '../types';
import { useToast } from './ui/Toast';
import AssetPickerTable from './ui/AssetPickerTable';

export interface CreateMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: any;
  assets: Asset[];
  departments: Department[];
  initialAssetId?: string | null;
  telegramActive?: boolean | null;
  onGoScanQr: () => void;
}

type IssueType = 'HARDWARE' | 'SOFTWARE' | 'OTHER';
type PriorityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const UNIT_META: Record<string, { label: string; badgeClass: string }> = {
  CNTT: { label: 'Tổ CNTT', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  DUOC: { label: 'Khoa Dược (TBYT)', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TCHC: { label: 'Phòng TCHC', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const QUICK_SYMPTOMS: {
  label: string;
  text: string;
  issueType: IssueType;
  units: string[];
}[] = [
  { label: 'Lỗi phần mềm / HIS / LIS', text: 'Lỗi phần mềm / hệ thống HIS-LIS không thao tác được', issueType: 'SOFTWARE', units: ['ALL', 'CNTT', 'DUOC'] },
  { label: 'Lỗi Word / Excel / Unikey', text: 'Lỗi phần mềm văn phòng (Word, Excel, PDF hoặc gõ tiếng Việt)', issueType: 'SOFTWARE', units: ['ALL', 'CNTT'] },
  { label: 'Lỗi Driver / Không in được từ PC', text: 'Máy tính không kết nối được máy in / cần cài lại Driver', issueType: 'SOFTWARE', units: ['ALL', 'CNTT'] },
  { label: 'Chữ ký số / Token / BHYT', text: 'Lỗi chữ ký số, USB Token hoặc phần mềm cổng giám định', issueType: 'SOFTWARE', units: ['ALL', 'CNTT'] },
  { label: 'Mất mạng LAN / Wifi', text: 'Mất kết nối mạng LAN / Wifi nội bộ', issueType: 'HARDWARE', units: ['ALL', 'CNTT'] },
  { label: 'Không lên nguồn / Chập chờn', text: 'Thiết bị không lên nguồn hoặc tự ngắt khi đang chạy', issueType: 'HARDWARE', units: ['ALL', 'CNTT', 'DUOC', 'TCHC'] },
  { label: 'Kẹt giấy / Hết mực / Bản in mờ', text: 'Máy in kẹt giấy, hết mực hoặc bản in bị sọc mờ', issueType: 'HARDWARE', units: ['ALL', 'CNTT'] },
  { label: 'Lỗi cảm biến / Cần hiệu chuẩn', text: 'Thiết bị y tế báo lỗi cảm biến / sai số, cần kiểm tra hiệu chuẩn', issueType: 'HARDWARE', units: ['ALL', 'DUOC'] },
  { label: 'Điều hòa không mát / Chảy nước', text: 'Điều hòa không lạnh, kêu to hoặc bị chảy nước', issueType: 'HARDWARE', units: ['ALL', 'TCHC'] },
  { label: 'Hỏng điện / Đèn / Nước / Cửa', text: 'Hỏng thiết bị điện, đèn chiếu sáng, vòi nước hoặc khóa cửa', issueType: 'HARDWARE', units: ['ALL', 'TCHC'] },
];

const PRIORITY_OPTIONS: { value: PriorityType; label: string; dotClass: string; activeClass: string }[] = [
  { value: 'LOW', label: 'Thấp', dotClass: 'bg-slate-400', activeClass: 'bg-slate-100 border-slate-400 text-slate-900' },
  { value: 'MEDIUM', label: 'Trung bình', dotClass: 'bg-amber-500', activeClass: 'bg-amber-50 border-amber-400 text-amber-900' },
  { value: 'HIGH', label: 'Cao', dotClass: 'bg-orange-500', activeClass: 'bg-orange-50 border-orange-400 text-orange-900' },
  { value: 'URGENT', label: 'Khẩn cấp', dotClass: 'bg-rose-600', activeClass: 'bg-rose-50 border-rose-500 text-rose-900' },
];

const SOFTWARE_KEYWORD_RE =
  /(phần mềm|phan mem|ultraview|ultraviewer|teamview|anydesk|his|lis|bhyt|word|excel|pdf|office|unikey|gõ tiếng việt|font|driver|chữ ký số|chu ky so|token|đăng nhập|mat khau|mật khẩu|lỗi win|windows|cài đặt|cài lại|emr|pacs)/i;

function resolveAssetUnit(asset?: Asset | null): 'CNTT' | 'DUOC' | 'TCHC' {
  const unit = (asset as any)?.managingUnit;
  if (unit === 'CNTT' || unit === 'DUOC' || unit === 'TCHC') return unit;
  if (asset?.categoryId === 1) return 'DUOC';
  if (asset?.categoryId === 2) return 'CNTT';
  return 'TCHC';
}

export default function CreateMaintenanceModal({
  open,
  onClose,
  onSuccess,
  user,
  assets,
  departments,
  initialAssetId,
  telegramActive,
  onGoScanQr,
}: CreateMaintenanceModalProps) {
  const toast = useToast();
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);
  const hydratedInitialRef = useRef<string | null>(null);

  const defaultUnitFilter =
    user?.role === 'MANAGER_CNTT'
      ? 'CNTT'
      : user?.role === 'MANAGER_DUOC'
      ? 'DUOC'
      : user?.role === 'MANAGER_TCHC'
      ? 'TCHC'
      : 'ALL';

  const [departmentId, setDepartmentId] = useState<string>(user?.departmentId ? String(user.departmentId) : '1');
  const [unitFilter, setUnitFilter] = useState<string>(defaultUnitFilter);
  const [managingUnit, setManagingUnit] = useState<'CNTT' | 'DUOC' | 'TCHC'>('CNTT');
  const [assetId, setAssetId] = useState<string>('');
  const [changingAsset, setChangingAsset] = useState<boolean>(true);
  const [assetSearch, setAssetSearch] = useState<string>('');

  const [issueType, setIssueType] = useState<IssueType>('HARDWARE');
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [priority, setPriority] = useState<PriorityType>('MEDIUM');

  const [requestedBy, setRequestedBy] = useState<string>(user?.fullName || '');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [locationDetail, setLocationDetail] = useState<string>('');

  const [showOptionalUltraView, setShowOptionalUltraView] = useState<boolean>(false);
  const [ultraViewId, setUltraViewId] = useState<string>('');
  const [ultraViewPass, setUltraViewPass] = useState<string>('');
  const [cannotOpenUltraView, setCannotOpenUltraView] = useState<boolean>(false);

  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const photoPreviews = useMemo(
    () => photoFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photoFiles]
  );

  useEffect(() => {
    return () => {
      photoPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photoPreviews]);

  // Reset modal state cleanly only on open transition (false -> true) or explicit initialAssetId change while idle
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      hydratedInitialRef.current = null;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setErrors({});
      setSubmitting(false);
      setAssetSearch('');
      setIssueType('HARDWARE');
      setIssueDescription('');
      setPriority('MEDIUM');
      setContactPhone('');
      setShowOptionalUltraView(false);
      setUltraViewId('');
      setUltraViewPass('');
      setCannotOpenUltraView(false);
      setPhotoFiles([]);
      setAssetId('');
      setDepartmentId(user?.departmentId ? String(user.departmentId) : departments[0]?.id ? String(departments[0].id) : '1');
      setUnitFilter(defaultUnitFilter);
      setManagingUnit(defaultUnitFilter !== 'ALL' ? (defaultUnitFilter as 'CNTT' | 'DUOC' | 'TCHC') : 'CNTT');
      setLocationDetail('');
      setRequestedBy(user?.fullName || '');
      setChangingAsset(!initialAssetId);
    }
  }, [open, initialAssetId, departments, user, defaultUnitFilter]);

  // Hydrate initialAssetId cleanly once assets list finishes loading without wiping user-typed fields
  useEffect(() => {
    if (!open || !initialAssetId || assets.length === 0) return;
    if (hydratedInitialRef.current === String(initialAssetId)) return;
    const matched = assets.find((a) => String(a.id) === String(initialAssetId));
    if (matched) {
      hydratedInitialRef.current = String(initialAssetId);
      const resolvedUnit = resolveAssetUnit(matched);
      setAssetId(String(matched.id));
      setDepartmentId(matched.departmentId ? String(matched.departmentId) : user?.departmentId ? String(user.departmentId) : '1');
      setManagingUnit(resolvedUnit);
      setUnitFilter(resolvedUnit);
      setLocationDetail((prev) => prev || matched.locationDetail || (matched as any).floor || '');
      setRequestedBy((prev) =>
        user?.role === 'DEPARTMENT'
          ? matched.assignedTo || prev || user?.fullName || ''
          : prev || user?.fullName || matched.assignedTo || ''
      );
      setChangingAsset(false);
    }
  }, [open, initialAssetId, assets, user]);

  // Close with Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  const selectedAsset = useMemo(
    () => assets.find((a) => String(a.id) === String(assetId)) || null,
    [assets, assetId]
  );

  const filteredAssets = useMemo(() => {
    const targetDeptId = user?.role === 'DEPARTMENT' && user.departmentId ? String(user.departmentId) : departmentId;
    const q = assetSearch.trim().toLowerCase();

    return assets
      .filter((a) => {
        if (targetDeptId && String(a.departmentId) !== targetDeptId) return false;
        if (unitFilter !== 'ALL' && resolveAssetUnit(a) !== unitFilter) return false;
        if (q) {
          const hit =
            a.assetCode?.toLowerCase().includes(q) ||
            a.name?.toLowerCase().includes(q) ||
            a.assignedTo?.toLowerCase().includes(q) ||
            a.locationDetail?.toLowerCase().includes(q) ||
            (a as any).floor?.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) =>
        (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true, sensitivity: 'base' })
      );
  }, [assets, user, departmentId, unitFilter, assetSearch]);

  const visibleSymptoms = useMemo(() => {
    const scope = selectedAsset ? managingUnit : unitFilter;
    return QUICK_SYMPTOMS.filter((s) => scope === 'ALL' || s.units.includes(scope));
  }, [selectedAsset, managingUnit, unitFilter]);

  if (!open) return null;

  const handleSelectAsset = (a: Asset) => {
    const resolvedUnit = resolveAssetUnit(a);
    setAssetId(String(a.id));
    setManagingUnit(resolvedUnit);
    setLocationDetail(a.locationDetail || (a as any).floor || '');
    setRequestedBy((prev) => prev.trim() || a.assignedTo || user?.fullName || '');
    setChangingAsset(false);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.assetId;
      return next;
    });
  };

  const handleQuickSymptomClick = (sym: (typeof QUICK_SYMPTOMS)[number]) => {
    const currentDesc = issueDescription.trim();
    const exists = currentDesc.toLowerCase().includes(sym.text.toLowerCase());
    if (exists) return;

    setIssueDescription(currentDesc ? `${currentDesc}; ${sym.text}` : sym.text);
    if (sym.issueType === 'SOFTWARE') setIssueType('SOFTWARE');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.issueDescription;
      return next;
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;

    const remaining = 3 - photoFiles.length;
    if (remaining <= 0) {
      toast.warning('Chỉ được đính kèm tối đa 3 ảnh hiện trạng sự cố.');
      return;
    }

    const valid: File[] = [];
    for (const f of picked.slice(0, remaining)) {
      if (!f.type.startsWith('image/')) {
        toast.warning(`Tệp "${f.name}" không phải hình ảnh hợp lệ.`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.warning(`Ảnh "${f.name}" vượt quá giới hạn 5MB.`);
        continue;
      }
      valid.push(f);
    }
    if (picked.length > remaining) {
      toast.info('Tối đa 3 ảnh — chỉ nhận thêm các ảnh đầu tiên.');
    }
    if (valid.length > 0) setPhotoFiles((prev) => [...prev, ...valid]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!assetId) nextErrors.assetId = 'Vui lòng chọn thiết bị đang gặp sự cố.';
    if (!issueDescription.trim()) nextErrors.issueDescription = 'Vui lòng mô tả ngắn gọn tình trạng hư hỏng.';
    if (!requestedBy.trim()) nextErrors.requestedBy = 'Vui lòng nhập họ tên người báo hỏng.';
    if (issueType === 'SOFTWARE' && !cannotOpenUltraView && !ultraViewId.trim()) {
      nextErrors.ultraViewId = 'Nhập ID UltraViewer để KTV hỗ trợ từ xa (hoặc đánh dấu không mở được).';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setTimeout(() => errorAlertRef.current?.focus(), 20);
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('assetId', assetId);
      fd.append('departmentId', departmentId);
      fd.append('managingUnit', managingUnit);
      fd.append('requestedBy', requestedBy.trim());
      if (contactPhone.trim()) fd.append('contactPhone', contactPhone.trim());
      if (locationDetail.trim()) fd.append('locationDetail', locationDetail.trim());
      fd.append('issueType', issueType);
      fd.append('issueDescription', issueDescription.trim());
      if (ultraViewId.trim()) fd.append('ultraViewId', ultraViewId.trim());
      if (ultraViewPass.trim()) fd.append('ultraViewPass', ultraViewPass.trim());
      fd.append('cannotOpenUltraView', cannotOpenUltraView ? 'true' : 'false');
      fd.append('priority', priority);
      photoFiles.forEach((f) => fd.append('photos', f));

      await apiPostForm('/maintenance', fd);
      toast.success('Đã gửi phiếu báo hỏng đến đơn vị tiếp nhận thành công!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi phiếu báo hỏng, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeUnitInfo = UNIT_META[managingUnit] || UNIT_META.CNTT;
  const showUltraViewCard = issueType === 'SOFTWARE' || showOptionalUltraView;
  const errorEntries = Object.entries(errors);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-maintenance-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Sticky Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="create-maintenance-title" className="font-heading text-base sm:text-lg font-semibold text-slate-900 truncate">
                Phiếu Báo Hỏng &amp; Đề Nghị Sửa Chữa Thiết Bị
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Điền 3 bước nhanh — tự động điều phối về đơn vị kỹ thuật phụ trách
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Đóng hộp thoại báo hỏng"
            className="w-11 h-11 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body + Sticky Footer */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Inline Error Summary */}
            {errorEntries.length > 0 && (
              <div
                ref={errorAlertRef}
                role="alert"
                tabIndex={-1}
                className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1 outline-none"
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Vui lòng bổ sung thông tin còn thiếu trước khi gửi:</span>
                </div>
                <ul className="list-disc list-inside text-xs text-rose-800 pl-1 space-y-0.5">
                  {errorEntries.map(([key, msg]) => (
                    <li key={key}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* STEP 1: THIẾT BỊ & KHOA PHÒNG */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center">
                    1
                  </span>
                  <h4 className="font-heading text-sm font-semibold text-slate-900">
                    Khoa/Phòng &amp; Thiết bị cần sửa chữa
                  </h4>
                </div>

                {user?.role === 'DEPARTMENT' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                    <span>{user.fullName || departments.find((d) => d.id === user.departmentId)?.name || 'Khoa / Phòng'}</span>
                  </div>
                ) : (
                  <div className="w-full sm:w-72">
                    <label htmlFor="maint-dept" className="sr-only">Khoa hoặc phòng yêu cầu</label>
                    <select
                      id="maint-dept"
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(e.target.value);
                        setAssetId('');
                        setChangingAsset(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} - {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Selected Asset Summary Card OR Picker */}
              {selectedAsset && !changingAsset ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PackageCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="font-mono text-xs font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                        {selectedAsset.assetCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${activeUnitInfo.badgeClass}`}>
                        {activeUnitInfo.label}
                      </span>
                    </div>
                    <div className="font-heading text-sm font-semibold text-slate-900 break-words">
                      {selectedAsset.name}
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{selectedAsset.department?.name || departments.find((d) => String(d.id) === departmentId)?.name}</span>
                      {(selectedAsset.locationDetail || (selectedAsset as any).floor) && (
                        <span>· {selectedAsset.locationDetail || (selectedAsset as any).floor}</span>
                      )}
                      {selectedAsset.assignedTo && <span>· SD: {selectedAsset.assignedTo}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div>
                      <label htmlFor="maint-unit-override" className="sr-only">Đơn vị tiếp nhận</label>
                      <select
                        id="maint-unit-override"
                        value={managingUnit}
                        onChange={(e) => setManagingUnit(e.target.value as 'CNTT' | 'DUOC' | 'TCHC')}
                        title="Điều chỉnh đơn vị tiếp nhận nếu cần"
                        className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 cursor-pointer"
                      >
                        <option value="CNTT">Gửi: Tổ CNTT</option>
                        <option value="DUOC">Gửi: Khoa Dược (TBYT)</option>
                        <option value="TCHC">Gửi: Phòng TCHC</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChangingAsset(true);
                        setTimeout(() => searchInputRef.current?.focus(), 40);
                      }}
                      className="px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition"
                    >
                      Đổi thiết bị
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-xl border p-3.5 space-y-3 bg-slate-50/60 ${
                    errors.assetId ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo khối thiết bị">
                      {[
                        { key: 'ALL', label: 'Tất cả' },
                        { key: 'CNTT', label: 'Tổ CNTT' },
                        { key: 'DUOC', label: 'Khoa Dược (TBYT)' },
                        { key: 'TCHC', label: 'Phòng TCHC' },
                      ].map((u) => (
                        <button
                          key={u.key}
                          type="button"
                          onClick={() => setUnitFilter(u.key)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                            unitFilter === u.key
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {filteredAssets.length} thiết bị
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onGoScanQr();
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Quét QR</span>
                      </button>
                      {selectedAsset && (
                        <button
                          type="button"
                          onClick={() => setChangingAsset(false)}
                          className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                        >
                          Giữ máy đã chọn
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <label htmlFor="maint-asset-search" className="sr-only">Tìm kiếm thiết bị</label>
                    <input
                      ref={searchInputRef}
                      id="maint-asset-search"
                      type="text"
                      placeholder="Tìm theo mã tài sản, tên thiết bị, phòng máy hoặc người sử dụng..."
                      value={assetSearch}
                      onChange={(e) => setAssetSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {assetSearch && (
                      <button
                        type="button"
                        aria-label="Xóa từ khóa tìm kiếm"
                        onClick={() => setAssetSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <AssetPickerTable
                    mode="single"
                    assets={filteredAssets}
                    selectedId={assetId}
                    showDepartment={false}
                    accentColor="blue"
                    maxHeightClass="max-h-48"
                    emptyMessage="Không tìm thấy thiết bị nào phù hợp trong Khoa/Phòng này."
                    onSelect={handleSelectAsset}
                  />

                  {errors.assetId && (
                    <p id="err-assetId" className="text-xs font-medium text-rose-700 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.assetId}</span>
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* STEP 2: PHÂN LOẠI, MÔ TẢ SỰ CỐ & MỨC ĐỘ */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center">
                  2
                </span>
                <h4 className="font-heading text-sm font-semibold text-slate-900">
                  Tình trạng sự cố &amp; Mức độ ưu tiên
                </h4>
              </div>

              {/* 3 Clean Issue Type Cards */}
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">Loại sự cố</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Loại sự cố">
                  {[
                    {
                      value: 'HARDWARE' as IssueType,
                      title: 'Phần cứng / Thiết bị',
                      desc: 'Nguồn, linh kiện, cơ khí',
                      icon: Wrench,
                      active: 'bg-amber-50/90 border-amber-400 text-amber-950 ring-1 ring-amber-400/40',
                      iconCls: 'text-amber-700',
                    },
                    {
                      value: 'SOFTWARE' as IssueType,
                      title: 'Lỗi phần mềm (Từ xa)',
                      desc: 'Kèm ID & MK UltraViewer',
                      icon: Laptop,
                      active: 'bg-blue-50/90 border-blue-500 text-blue-950 ring-1 ring-blue-500/40',
                      iconCls: 'text-blue-700',
                    },
                    {
                      value: 'OTHER' as IssueType,
                      title: 'Yêu cầu khác',
                      desc: 'Kiểm tra, cài đặt, di dời',
                      icon: ClipboardList,
                      active: 'bg-slate-100 border-slate-400 text-slate-900 ring-1 ring-slate-400/40',
                      iconCls: 'text-slate-700',
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = issueType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setIssueType(opt.value)}
                        className={`p-3 rounded-md border text-left transition cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? opt.active
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? opt.iconCls : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold leading-tight">{opt.title}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Concise Quick Symptom Chips */}
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-600">
                  Chọn nhanh triệu chứng thường gặp
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {visibleSymptoms.map((sym) => {
                    const selected = issueDescription.toLowerCase().includes(sym.text.toLowerCase());
                    return (
                      <button
                        key={sym.label}
                        type="button"
                        onClick={() => handleQuickSymptomClick(sym)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition cursor-pointer ${
                          selected
                            ? 'bg-blue-700 text-white border-blue-700'
                            : sym.issueType === 'SOFTWARE'
                            ? 'bg-blue-50/60 text-blue-800 border-blue-200/80 hover:bg-blue-100/70'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 shrink-0" />}
                        <span>{sym.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Issue Description Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="maint-desc" className="block text-xs font-medium text-slate-700">
                  Mô tả chi tiết tình trạng hư hỏng <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="maint-desc"
                  rows={3}
                  aria-invalid={Boolean(errors.issueDescription)}
                  aria-describedby={errors.issueDescription ? 'err-desc' : undefined}
                  placeholder="Nêu rõ biểu hiện lỗi: Lỗi phần mềm HIS/LIS, máy không in được, không lên nguồn, báo lỗi cảm biến..."
                  value={issueDescription}
                  onChange={(e) => {
                    setIssueDescription(e.target.value);
                    if (errors.issueDescription) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.issueDescription;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.issueDescription ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                  }`}
                />
                {errors.issueDescription && (
                  <p id="err-desc" className="text-xs font-medium text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errors.issueDescription}</span>
                  </p>
                )}

                {issueType !== 'SOFTWARE' && SOFTWARE_KEYWORD_RE.test(issueDescription) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                    <span className="text-xs">
                      Mô tả có liên quan đến <strong>lỗi phần mềm</strong> — bật UltraViewer để kỹ thuật viên hỗ trợ từ xa ngay.
                    </span>
                    <button
                      type="button"
                      onClick={() => setIssueType('SOFTWARE')}
                      className="px-2.5 py-1 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Bật UltraViewer
                    </button>
                  </div>
                )}
              </div>

              {/* Progressive Disclosure: UltraViewer Box */}
              {issueType !== 'SOFTWARE' && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOptionalUltraView}
                    onChange={(e) => setShowOptionalUltraView(e.target.checked)}
                    className="rounded border-slate-300 text-blue-700 focus:ring-blue-500"
                  />
                  <span>Kèm thông tin UltraViewer nếu cần kiểm tra từ xa</span>
                </label>
              )}

              {showUltraViewCard && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-heading text-xs font-semibold text-blue-950">
                        Thông tin kết nối UltraViewer {issueType === 'SOFTWARE' ? '(*)' : '(Tùy chọn)'}
                      </div>
                      <p className="text-xs text-blue-800/80 mt-0.5">
                        Mở UltraViewer trên màn hình Desktop và nhập dãy số <strong>ID của bạn</strong> kèm <strong>Mật khẩu</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="maint-uv-id" className="block text-xs font-medium text-blue-950 mb-1">
                        ID UltraViewer {issueType === 'SOFTWARE' && !cannotOpenUltraView && <span className="text-rose-600">*</span>}
                      </label>
                      <input
                        id="maint-uv-id"
                        type="text"
                        inputMode="numeric"
                        disabled={cannotOpenUltraView}
                        aria-invalid={Boolean(errors.ultraViewId)}
                        aria-describedby={errors.ultraViewId ? 'err-uv-id' : undefined}
                        placeholder="Ví dụ: 12 345 678"
                        value={ultraViewId}
                        onChange={(e) => {
                          setUltraViewId(e.target.value);
                          if (errors.ultraViewId) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.ultraViewId;
                              return next;
                            });
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-xl border bg-white font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400 ${
                          errors.ultraViewId ? 'border-rose-400' : 'border-blue-300'
                        }`}
                      />
                      {errors.ultraViewId && (
                        <p id="err-uv-id" className="mt-1 text-xs font-medium text-rose-700">
                          {errors.ultraViewId}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="maint-uv-pass" className="block text-xs font-medium text-blue-950 mb-1">
                        Mật khẩu UltraViewer
                      </label>
                      <input
                        id="maint-uv-pass"
                        type="text"
                        disabled={cannotOpenUltraView}
                        placeholder="Ví dụ: 4829"
                        value={ultraViewPass}
                        onChange={(e) => setUltraViewPass(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-blue-300 bg-white font-mono text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  {issueType === 'SOFTWARE' && (
                    <label className="inline-flex items-center gap-2 text-xs text-blue-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={cannotOpenUltraView}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCannotOpenUltraView(checked);
                          if (checked) {
                            setUltraViewId('');
                            setUltraViewPass('');
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next.ultraViewId;
                              return next;
                            });
                          }
                        }}
                        className="rounded border-blue-300 text-blue-700 focus:ring-blue-500"
                      />
                      <span>Máy không mở được UltraViewer (mất mạng hoặc treo Windows)</span>
                    </label>
                  )}
                </div>
              )}

              {/* Priority Segmented Pills */}
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">Mức độ khẩn cấp</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Mức độ khẩn cấp">
                  {PRIORITY_OPTIONS.map((p) => {
                    const active = priority === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPriority(p.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center justify-center gap-2 ${
                          active ? `${p.activeClass} font-semibold shadow-2xs` : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${p.dotClass}`} />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* STEP 3: NGƯỜI LIÊN HỆ & ẢNH HIỆN TRẠNG */}
            <section className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold inline-flex items-center justify-center">
                  3
                </span>
                <h4 className="font-heading text-sm font-semibold text-slate-900">
                  Thông tin liên hệ &amp; Hình ảnh đính kèm
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="maint-requester" className="block text-xs font-medium text-slate-700 mb-1">
                    Họ tên người báo <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="maint-requester"
                      type="text"
                      aria-invalid={Boolean(errors.requestedBy)}
                      aria-describedby={errors.requestedBy ? 'err-requester' : undefined}
                      placeholder="VD: BS. Nguyễn Văn A"
                      value={requestedBy}
                      onChange={(e) => {
                        setRequestedBy(e.target.value);
                        if (errors.requestedBy) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.requestedBy;
                            return next;
                          });
                        }
                      }}
                      className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.requestedBy ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 bg-white'
                      }`}
                    />
                  </div>
                  {errors.requestedBy && (
                    <p id="err-requester" className="mt-1 text-xs font-medium text-rose-700">
                      {errors.requestedBy}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="maint-phone" className="block text-xs font-medium text-slate-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="maint-phone"
                      type="tel"
                      placeholder="0905 xxx xxx"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="maint-location" className="block text-xs font-medium text-slate-700 mb-1">
                    Vị trí phòng / tầng
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="maint-location"
                      type="text"
                      placeholder="Phòng 204, Tầng 2..."
                      value={locationDetail}
                      onChange={(e) => setLocationDetail(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Compact Photo Upload */}
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Camera className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>
                      <strong className="text-slate-800">Ảnh chụp hiện trạng / màn hình lỗi</strong> (tối đa 3 ảnh, ≤ 5MB/ảnh)
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer shadow-2xs transition">
                    <Camera className="w-3.5 h-3.5 text-blue-700" />
                    <span>Chọn / Chụp ảnh ({photoFiles.length}/3)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                    {photoPreviews.map((item, idx) => (
                      <div
                        key={`${item.file.name}-${idx}`}
                        className="relative rounded-lg overflow-hidden border border-slate-200 bg-white aspect-video"
                      >
                        <img src={item.url} alt={item.file.name} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotoFiles((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Xóa ảnh ${item.file.name}`}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/75 text-white hover:bg-rose-600 flex items-center justify-center transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200/80 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-600 flex items-center gap-2 min-w-0">
              {selectedAsset ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">
                    Gửi đến <strong className="text-slate-800">{activeUnitInfo.label}</strong>
                    {issueType === 'SOFTWARE' && ultraViewId.trim() ? ' · Kèm UltraViewer' : ''}
                    {telegramActive ? ' · Báo Telegram ngay' : ''}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span>Chọn thiết bị ở bước 1 để hoàn tất phiếu</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                {submitting ? (
                  <span>Đang gửi phiếu...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi phiếu báo hỏng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
