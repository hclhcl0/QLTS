import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2, Printer, Download, Save, RefreshCw,
  CheckCircle2, Users, Search, Settings, Trash2, Edit2,
  Stethoscope, Monitor, Layers, FileText, SlidersHorizontal, ArrowUpDown,
  ChevronDown, ChevronLeft, ChevronRight, X, Table2, Eye, ArrowUp, ArrowDown, Sparkles, FolderKanban, QrCode
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { apiGet, apiPost, apiPut, apiDelete, apiDownload } from '../lib/api';
import QrLabelPrintModal from '../components/QrLabelPrintModal';
import { useAuth } from '../contexts/AuthContext';
import { Department, Asset, CommitteeMember, STANDARD_FLOORS, TCHC_GROUP_OPTIONS, TCHC_GROUP_META } from '../types';
import {
  FLOOR_PILL_OPTIONS,
  SUPER_SORT_FIELDS,
  SMART_TAG_EXAMPLES,
  matchesSmartSearchClient,
  sortAssetsClient,
} from '../utils/superSortSearch';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';

const FLOORS = ['Tất cả tầng', ...STANDARD_FLOORS];

export interface ColumnOption {
  key: string;
  label: string;
  group: 'basic' | 'quantity' | 'financial' | 'location' | 'status';
  required?: boolean;
  desc?: string;
}

export const ALL_INVENTORY_COLUMNS: ColumnOption[] = [
  { key: 'stt', label: 'STT', group: 'basic', required: true, desc: 'Số thứ tự' },
  { key: 'name', label: 'Tên tài sản & thông số', group: 'basic', required: true, desc: 'Tên thiết bị, quy cách kỹ thuật' },
  { key: 'oldAssetCode', label: 'Mã số cũ', group: 'basic', desc: 'Mã tài sản giai đoạn trước' },
  { key: 'assetCode', label: 'Mã số mới (Mã TS)', group: 'basic', desc: 'Mã tài sản chuẩn hóa 2026' },
  { key: 'yearInUse', label: 'Năm đưa vào SD', group: 'basic', desc: 'Năm bắt đầu sử dụng tài sản' },
  { key: 'bookQty', label: 'Số lượng Sổ sách', group: 'quantity', desc: 'Số lượng theo dõi sổ sách kế toán' },
  { key: 'actualQty', label: 'Số lượng Thực tế KK', group: 'quantity', desc: 'Số lượng kiểm kê thực tế tại đơn vị' },
  { key: 'diff', label: 'Chênh lệch (Thừa/Thiếu)', group: 'quantity', desc: 'Chênh lệch Thực tế - Sổ sách' },
  { key: 'price', label: 'Đơn giá (đ)', group: 'financial', desc: 'Nguyên giá tài sản' },
  { key: 'total', label: 'Thành tiền (đ)', group: 'financial', desc: 'Tổng giá trị theo số lượng thực tế' },
  { key: 'unit', label: 'Bộ phận quản lý', group: 'location', desc: 'Tổ CNTT, Khoa Dược, hoặc Phòng TCHC' },
  { key: 'user', label: 'Nơi / Người sử dụng', group: 'location', desc: 'Khoa phòng, phòng ban, người được giao' },
  { key: 'status', label: 'Tình trạng sử dụng', group: 'status', desc: 'Đang sử dụng, Hỏng, Bảo trì, Chờ thanh lý...' },
  { key: 'location', label: 'Nơi TS mới chuyển đến', group: 'location', desc: 'Cơ sở 1, Cơ sở 2 hoặc địa điểm điều chuyển' },
  { key: 'note', label: 'Ghi chú', group: 'status', desc: 'Ghi chú bổ sung khi kiểm kê' },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  'stt', 'name', 'oldAssetCode', 'assetCode', 'yearInUse',
  'actualQty', 'price', 'total', 'unit', 'user', 'status', 'location', 'note'
];

export const COLUMN_GROUPS = [
  { id: 'basic', title: '1. Thông tin định danh tài sản' },
  { id: 'quantity', title: '2. Số lượng & Kiểm đếm' },
  { id: 'financial', title: '3. Giá trị & Tài chính' },
  { id: 'location', title: '4. Quản lý & Vị trí sử dụng' },
  { id: 'status', title: '5. Tình trạng & Theo dõi' },
];

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [showCommitteeModal, setShowCommitteeModal] = useState(false);
  
  // Managing division selection by Role
  const defaultInvType = 
    user?.role === 'MANAGER_CNTT' ? 'CNTT' :
    user?.role === 'MANAGER_DUOC' ? 'DUOC' :
    user?.role === 'MANAGER_TCHC' ? 'TCHC_HC' :
    user?.role === 'DEPARTMENT' ? 'BY_DEPT' : 'DUOC';

  const [inventoryType, setInventoryType] = useState<string>(defaultInvType);
  
  // Specific department, floor, or TCHC sub-group selection
  const [selectedDeptId, setSelectedDeptId] = useState<string>(user?.role === 'DEPARTMENT' && user.departmentId ? user.departmentId.toString() : '');
  const [selectedFloor, setSelectedFloor] = useState<string>('Tất cả tầng');
  const [selectedAssetGroup, setSelectedAssetGroup] = useState<string>('');
  
  const [assets, setAssets] = useState<any[]>([]);
  const [serverTotal, setServerTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [inventoryDate, setInventoryDate] = useState('15/01/2026');
  const [viewMode, setViewMode] = useState<'compact' | 'c53'>('compact');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { density, setDensity, cellPy, headPy } = useTablePrefs('inventory_compact');

  // Sorting state - Supports 2-level Super Sort
  const [sortBy, setSortBy] = useState<string>('assetCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortBy2, setSortBy2] = useState<string>('');
  const [sortOrder2, setSortOrder2] = useState<'asc' | 'desc'>('asc');
  const [showSmartHints, setShowSmartHints] = useState<boolean>(false);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  const handleSort = (field: string, isShiftKey = false) => {
    if (isShiftKey && field !== sortBy) {
      if (sortBy2 === field) {
        setSortOrder2(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy2(field);
        setSortOrder2('asc');
      }
      setPage(1);
      return;
    }
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    const onClick = () => setSettingsOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [settingsOpen]);
  
  // Committee form modal state
  const [editingMember, setEditingMember] = useState<Partial<CommitteeMember> | null>(null);

  // Signatures configuration for C53-HD
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [signatures, setSignatures] = useState(() => {
    const saved = localStorage.getItem('inventory_signatures_c53');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      membersTitle: 'Thành viên tổ kiểm kê',
      membersList: 'Trần Văn Vũ\nPhan Thanh Hoàn\nTrần Thị Liên\nHuỳnh Thị Thanh Tú',
      leaderTitle: 'Tổ trưởng Tổ chuyên trách / Đại diện Đơn vị',
      leaderName: user?.role === 'MANAGER_CNTT' ? 'KTV. Phan Thanh Hoàn' :
                  user?.role === 'MANAGER_DUOC' ? 'Bà. Mai Thị Tính (Khoa Dược)' :
                  user?.role === 'MANAGER_TCHC' ? 'Ông. Trần Liên (Phòng TCHC)' : 'KTV. Phan Thanh Hoàn',
      tcktTitle: 'Trưởng phòng TC - KT',
      tcktName: 'Ông. Hồ Phú Quảng',
      presidentTitle: 'Chủ tịch Hội đồng kiểm kê',
      presidentName: 'Ông. Nguyễn Đại Vĩnh'
    };
  });

  const handleSaveSignatures = (newSigs: typeof signatures) => {
    setSignatures(newSigs);
    localStorage.setItem('inventory_signatures_c53', JSON.stringify(newSigs));
    setShowSignaturesModal(false);
  };

  // Column Selection State - Persisted per inventoryType so CNTT, DUOC, TCHC remember their choices independently
  const getSavedColumns = (type: string) => {
    try {
      const saved = localStorage.getItem(`inventory_columns_${type}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_VISIBLE_COLUMNS;
  };

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getSavedColumns(defaultInvType));
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [tempColumns, setTempColumns] = useState<string[]>(visibleColumns);

  // Sync columns when inventoryType changes
  useEffect(() => {
    const cols = getSavedColumns(inventoryType);
    setVisibleColumns(cols);
    setTempColumns(cols);
  }, [inventoryType]);

  const handleSaveColumns = (newCols: string[]) => {
    let safeCols = [...newCols];
    if (!safeCols.includes('stt')) safeCols.unshift('stt');
    if (!safeCols.includes('name')) safeCols.splice(1, 0, 'name');
    setVisibleColumns(safeCols);
    localStorage.setItem(`inventory_columns_${inventoryType}`, JSON.stringify(safeCols));
    setShowColumnModal(false);
  };

  const toggleTempColumn = (key: string) => {
    if (key === 'stt' || key === 'name') return; // Mandatory/locked
    setTempColumns(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        const allKeys = ALL_INVENTORY_COLUMNS.map(c => c.key);
        const next = [...prev, key];
        return next.sort((a, b) => allKeys.indexOf(a) - allKeys.indexOf(b));
      }
    });
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setTimeout(async () => {
      try {
        const element = document.getElementById('inventory-c53-document');
        if (!element) {
          toast.error('Không tìm thấy vùng dữ liệu biểu mẫu C53-HD để xuất PDF.');
          return;
        }
        const typePrefix = 
          inventoryType === 'DUOC' ? 'DUOC' :
          inventoryType === 'CNTT' ? 'CNTT' :
          inventoryType === 'TCHC_HC' ? 'TCHC_HC' :
          inventoryType === 'TCHC_TOANHA' ? `TCHC_Tang_${selectedFloor.replace(/\s+/g, '_')}` :
          'KHOA_PHONG';
        const deptPrefix = currentDept ? currentDept.code : typePrefix;
        const filename = `BienBan_KiemKe_${deptPrefix}_2026.pdf`;

        const opt = {
          margin: [6, 6, 6, 6] as [number, number, number, number],
          filename: filename,
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            letterRendering: true
          },
          jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'landscape' as const,
            compress: true
          },
          pagebreak: { 
            mode: ['css', 'legacy'],
            avoid: ['tr', '.signature-block']
          }
        };

        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error('PDF export error:', err);
        toast.error('Lỗi xuất PDF. Bạn có thể sử dụng nút "In / Lưu PDF qua Trình duyệt" để lưu file PDF chất lượng cao.');
      } finally {
        setExportingPdf(false);
      }
    }, 150);
  };

  // Load departments & committee members from API
  const loadInitialData = async () => {
    try {
      const [dRes, mRes] = await Promise.allSettled([
        apiGet('/departments'),
        apiGet('/committee')
      ]);

      if (dRes.status === 'fulfilled' && Array.isArray(dRes.value)) {
        setDepartments(dRes.value);
      }
      if (mRes.status === 'fulfilled' && Array.isArray(mRes.value)) {
        setCommitteeMembers(mRes.value);
      }
    } catch (e) {
      console.error('Error loading initial inventory data:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Load assets based on the selected inventory mode
  const loadInventoryAssets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '10000');

      if (inventoryType === 'DUOC') {
        params.append('managingUnit', 'DUOC');
        if (selectedDeptId) params.append('departmentId', selectedDeptId);
      } else if (inventoryType === 'CNTT') {
        params.append('managingUnit', 'CNTT');
        if (selectedDeptId) params.append('departmentId', selectedDeptId);
      } else if (inventoryType === 'TCHC_HC') {
        params.append('managingUnit', 'TCHC');
        params.append('buildingAsset', '0');
        if (selectedDeptId) params.append('departmentId', selectedDeptId);
        if (selectedAssetGroup) params.append('assetGroup', selectedAssetGroup);
      } else if (inventoryType === 'TCHC_TOANHA') {
        params.append('managingUnit', 'TCHC');
        params.append('buildingAsset', '1');
        if (selectedAssetGroup) params.append('assetGroup', selectedAssetGroup);
      } else if (inventoryType === 'BY_DEPT' && selectedDeptId) {
        params.append('departmentId', selectedDeptId);
      }

      const res = await apiGet(`/assets?${params.toString()}`);
      if (res && res.assets) {
        const mapped = res.assets.map((a: Asset) => ({
          ...a,
          bookQuantity: a.bookQuantity || 1,
          actualQuantity: a.actualQuantity !== undefined && a.actualQuantity !== null ? a.actualQuantity : (a.bookQuantity || 1),
          quantityDifference: a.quantityDifference || 0,
          currentStatus: a.status || 'DANG_SU_DUNG',
          customNote: a.note || ''
        }));
        mapped.sort((a: any, b: any) =>
          (a.assetCode || '').localeCompare(b.assetCode || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        setAssets(mapped);
        setServerTotal(typeof res.total === 'number' ? res.total : mapped.length);
        setDirtyIds(new Set());
        setPage(1);
      }
    } catch (e) {
      console.error('Error loading inventory assets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventoryAssets();
  }, [inventoryType, selectedDeptId, selectedAssetGroup]);

  // Handle actual quantity change
  const handleQuantityChange = (id: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setAssets(prev => prev.map(item => {
      if (item.id === id) {
        const diff = num - item.bookQuantity;
        return {
          ...item,
          actualQuantity: num,
          quantityDifference: diff
        };
      }
      return item;
    }));
    setDirtyIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Handle status change
  const handleStatusChange = (id: number, status: string) => {
    setAssets(prev => prev.map(item => item.id === id ? { ...item, currentStatus: status } : item));
    setDirtyIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Handle note change
  const handleNoteChange = (id: number, note: string) => {
    setAssets(prev => prev.map(item => item.id === id ? { ...item, customNote: note } : item));
    setDirtyIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Save changes to DB
  const handleSaveInventory = async () => {
    setSaving(true);
    try {
      const targets = dirtyIds.size > 0
        ? assets.filter(a => dirtyIds.has(a.id))
        : assets;
      const updates = targets.map(a => ({
        id: a.id,
        actualQuantity: a.actualQuantity,
        quantityDifference: a.quantityDifference,
        status: a.currentStatus,
        note: a.customNote
      }));

      await apiPost('/inventory/update-bulk-assets', { updates });
      setDirtyIds(new Set());
      toast.success(`Đã lưu ${updates.length} kết quả kiểm kê vào hệ thống thành công!`);
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu kết quả kiểm kê');
    } finally {
      setSaving(false);
    }
  };

  // Committee Member Management
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editingMember.fullName || !editingMember.position || !editingMember.role) {
      toast.warning('Vui lòng điền đủ thông tin thành viên');
      return;
    }

    try {
      if (editingMember.id) {
        await apiPut(`/committee/${editingMember.id}`, editingMember);
      } else {
        await apiPost('/committee', editingMember);
      }
      setEditingMember(null);
      // Reload committee
      const updated = await apiGet('/committee');
      if (Array.isArray(updated)) setCommitteeMembers(updated);
      toast.success('Đã cập nhật thông tin thành viên hội đồng kiểm kê!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu thành viên');
    }
  };

  const handleDeleteMember = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa thành viên hội đồng',
      message: 'Bạn có chắc muốn xóa thành viên này khỏi hội đồng?',
      confirmLabel: 'Xóa thành viên',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/committee/${id}`);
      setCommitteeMembers(prev => prev.filter(m => m.id !== id));
      toast.success('Đã xóa thành viên khỏi hội đồng.');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa');
    }
  };

  // Get dynamic committee members based on inventory type
  const president = committeeMembers.find(m => m.role === 'CHUTICH') || { fullName: 'Ông. Nguyễn Đại Vĩnh', position: 'Giám đốc' };
  const memberTCKT = committeeMembers.find(m => m.role === 'UYVIEN' || m.position.includes('TC - KT')) || { fullName: 'Ông. Hồ Phú Quảng', position: 'Trưởng phòng TC - KT' };
  
  // Team leader based on inventory division
  let teamLeader = { fullName: 'Bà. Mai Thị Tính', position: 'Phụ trách Khoa Dược - VTYT', titleRole: 'Tổ trưởng TBYT' };
  if (inventoryType === 'CNTT') {
    const leader = committeeMembers.find(m => m.role === 'TOTRUONG_CNTT' || m.position.includes('KHNV') || m.fullName.includes('Vũ'));
    teamLeader = leader ? { fullName: leader.fullName, position: leader.position, titleRole: 'Tổ trưởng Tổ CNTT' } : { fullName: 'Ông. Trần Văn Vũ', position: 'Trưởng phòng KHNV', titleRole: 'Tổ trưởng Tổ CNTT' };
  } else if (inventoryType === 'TCHC_HC' || inventoryType === 'TCHC_TOANHA') {
    const leader = committeeMembers.find(m => m.role === 'TOTRUONG_TCHC' || m.position.includes('TC - HC') || m.fullName.includes('Liên'));
    teamLeader = leader ? { fullName: leader.fullName, position: leader.position, titleRole: 'Tổ trưởng Tổ TCHC' } : { fullName: 'Ông. Trần Liên', position: 'Trưởng phòng TC - HC', titleRole: 'Tổ trưởng Tổ TCHC' };
  }

  // Department Representative
  const currentDept = departments.find(d => d.id.toString() === selectedDeptId);
  const deptRepMember = currentDept ? committeeMembers.find(m => m.departmentId === currentDept.id || m.scope === currentDept.code) : null;
  const deptRep = deptRepMember 
    ? { fullName: deptRepMember.fullName, position: deptRepMember.position }
    : currentDept 
      ? { fullName: `Đại diện ${currentDept.name}`, position: 'Trưởng / Phó đơn vị' }
      : { fullName: 'Đại diện các Khoa / Phòng', position: 'Trưởng / Phó đơn vị' };

  // Other team members scoped to the current active inventory team
  const teamMembers = committeeMembers.filter(m => {
    if (inventoryType === 'DUOC') {
      return m.role === 'THANHVIEN_DUOC' || m.scope === 'DUOC' || (m.role === 'THANHVIEN' && m.scope === 'ALL');
    }
    if (inventoryType === 'CNTT') {
      return m.role === 'THANHVIEN_CNTT' || m.scope === 'CNTT' || (m.role === 'THANHVIEN' && m.scope === 'ALL');
    }
    if (inventoryType === 'TCHC_HC' || inventoryType === 'TCHC_TOANHA') {
      return m.role === 'THANHVIEN_TCHC' || m.scope === 'TCHC' || (m.role === 'THANHVIEN' && m.scope === 'ALL');
    }
    return m.role === 'THANHVIEN' || m.role.startsWith('THANHVIEN');
  });

  // Floor counts across currently loaded division assets
  const floorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assets) {
      const k = a.floor && a.floor.trim() ? a.floor.trim() : 'NONE';
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [assets]);

  // Filtered Assets (Multi-token 14-field Super Search + Smart Tags + Floor + Status)
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (selectedFloor && selectedFloor !== 'Tất cả tầng') {
        const fl = a.floor && a.floor.trim() ? a.floor.trim() : 'NONE';
        if (fl !== selectedFloor) return false;
      }
      if (!matchesSmartSearchClient(a, searchTerm)) return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'DIFF') return (a.quantityDifference || 0) !== 0;
      return a.currentStatus === statusFilter;
    });
  }, [assets, searchTerm, statusFilter, selectedFloor]);

  // Sorted Assets (Multi-level Physical Floor / Function / Natural Sort)
  const sortedAssets = useMemo(() => {
    return sortAssetsClient(filteredAssets, sortBy, sortOrder, sortBy2, sortOrder2);
  }, [filteredAssets, sortBy, sortOrder, sortBy2, sortOrder2]);

  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedAssets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedAssets.slice(start, start + pageSize);
  }, [sortedAssets, safePage, pageSize]);

  // Totals
  const totalBookQty = sortedAssets.reduce((sum, a) => sum + (a.bookQuantity || 0), 0);
  const totalActualQty = sortedAssets.reduce((sum, a) => sum + (a.actualQuantity || 0), 0);
  const totalDiffQty = sortedAssets.reduce((sum, a) => sum + (a.quantityDifference || 0), 0);
  const totalValue = sortedAssets.reduce((sum, a) => sum + ((a.originalPrice || 0) * (a.actualQuantity || 1)), 0);

  const exportExcelC53 = async () => {
    const params = new URLSearchParams();
    if (inventoryType === 'DUOC') params.append('managingUnit', 'DUOC');
    else if (inventoryType === 'CNTT') params.append('managingUnit', 'CNTT');
    else if (inventoryType === 'TCHC_HC') {
      params.append('managingUnit', 'TCHC');
      params.append('buildingAsset', '0');
      if (selectedAssetGroup) params.append('assetGroup', selectedAssetGroup);
    } else if (inventoryType === 'TCHC_TOANHA') {
      params.append('managingUnit', 'TCHC');
      params.append('buildingAsset', '1');
      if (selectedFloor && selectedFloor !== 'Tất cả tầng') params.append('floor', selectedFloor);
      if (selectedAssetGroup) params.append('assetGroup', selectedAssetGroup);
    }
    if (selectedDeptId) params.append('departmentId', selectedDeptId);
    if (selectedFloor && selectedFloor !== 'Tất cả tầng') params.append('floor', selectedFloor);
    if (searchTerm.trim()) params.append('search', searchTerm.trim());
    params.append('inventoryDate', inventoryDate);
    params.append('signaturesJson', JSON.stringify(signatures));
    params.append('visibleColumns', visibleColumns.join(','));
    params.append('sortBy', sortBy);
    params.append('sortOrder', sortOrder);
    if (sortBy2) {
      params.append('sortBy2', sortBy2);
      params.append('sortOrder2', sortOrder2);
    }

    try {
      await apiDownload(`/export/c53-hd?${params.toString()}`, 'bien_ban_kiem_ke_c53_hd.xlsx');
      toast.success('Đã xuất biểu mẫu kiểm kê C53-HD ra Excel.');
    } catch (e: any) {
      toast.error(e.message || 'Không thể xuất file Excel kiểm kê');
    }
  };

  const getStatusSelectStyle = (status: string) => {
    if (status === 'HONG') return 'border-rose-200 bg-rose-50/80 text-rose-700';
    if (status === 'BAO_TRI') return 'border-amber-200 bg-amber-50/80 text-amber-800';
    if (status === 'CHO_THANH_LY') return 'border-orange-200 bg-orange-50/80 text-orange-800';
    if (status === 'KHONG_SU_DUNG') return 'border-slate-200 bg-slate-100 text-slate-600';
    return 'border-emerald-200 bg-emerald-50/70 text-emerald-800';
  };

  // Dynamic column visibility helpers
  const isCol = (key: string) => visibleColumns.includes(key);

  const idColKeys = ['stt', 'name', 'oldAssetCode', 'assetCode', 'yearInUse'];
  let lCode = 65;
  let nCode = 1;
  const colRefMap: Record<string, string> = {};
  visibleColumns.forEach(key => {
    if (idColKeys.includes(key)) {
      colRefMap[key] = String.fromCharCode(lCode++);
    } else {
      colRefMap[key] = String(nCode++);
    }
  });

  const qtyCols = ['bookQty', 'actualQty', 'diff'].filter(c => isCol(c));
  const hasSubHeader = qtyCols.length > 0;
  const prefixColCount = visibleColumns.filter(k => idColKeys.includes(k)).length;

  // Form title
  const formTitle = 
    inventoryType === 'DUOC' ? 'TRANG THIẾT BỊ Y TẾ (KHOA DƯỢC QUẢN LÝ)' :
    inventoryType === 'CNTT' ? (currentDept ? `THIẾT BỊ CNTT ${currentDept.name.toUpperCase()}` : 'THIẾT BỊ CÔNG NGHỆ THÔNG TIN (TỔ CNTT QUẢN LÝ)') :
    inventoryType === 'TCHC_HC' ? 'THIẾT BỊ HÀNH CHÍNH & CÔNG CỤ DỤNG CỤ (PHÒNG TCHC QUẢN LÝ)' :
    inventoryType === 'TCHC_TOANHA' ? `CƠ SỞ VẬT CHẤT & HẠ TẦNG TÒA NHÀ (${selectedFloor.toUpperCase()})` :
    `KHOA / PHÒNG: ${currentDept ? currentDept.name.toUpperCase() : 'TOÀN ĐƠN VỊ'}`;

  const renderSortButton = (field: string, label: string, align: 'left' | 'center' | 'right' = 'left') => {
    const active = sortBy === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer ${
          align === 'right' ? 'justify-end ml-auto' : align === 'center' ? 'justify-center mx-auto' : ''
        }`}
      >
        <span>{label}</span>
        {active ? (
          <span className="text-[11px] font-bold text-blue-700">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-300" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3.5 pb-12">
      {/* 1. COMPACT PAGE HEADER & ACTION BAR */}
      <div className="print:hidden flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-heading font-bold text-slate-900 tracking-tight">
              Kiểm kê tài sản &amp; CCDC
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
              Mẫu C53-HD · 2026
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {formTitle} · Ngày lập {inventoryDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* View Mode Segmented Switch */}
          <div
            role="group"
            aria-label="Chế độ hiển thị"
            className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/80"
          >
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-blue-700" />
              <span>Bảng gọn</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('c53')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                viewMode === 'c53'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>Mẫu C53-HD</span>
            </button>
          </div>

          {/* C53-HD Config Popover */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSettingsOpen(o => !o)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                settingsOpen
                  ? 'border-blue-300 bg-blue-50/70 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Thiết lập</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-40">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setShowCommitteeModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hội đồng kiểm kê theo QĐ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setShowSignaturesModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cấu hình Người ký C53-HD</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setTempColumns(visibleColumns);
                    setShowColumnModal(true);
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                    <span>Cột xuất biên bản</span>
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold tabular-nums">
                    {visibleColumns.length}/15
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Compact Export Cluster */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden divide-x divide-slate-200">
            <button
              type="button"
              onClick={exportExcelC53}
              title="Xuất Excel (.xlsx) chuẩn C53-HD"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              title="Tải trực tiếp PDF (.pdf) khổ ngang A4"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition disabled:opacity-50 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>{exportingPdf ? 'Đang xuất...' : 'PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="In / Lưu PDF qua trình duyệt"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (sortedAssets.length === 0) {
                  toast.warning('Không có thiết bị nào khớp bộ lọc để xuất tem QR.');
                  return;
                }
                setShowQrModal(true);
              }}
              disabled={loading}
              title="Xuất & In nhiều tem QR kiểm kê trên trang A4"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50/60 hover:bg-blue-100/80 transition disabled:opacity-50 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-700" />
              <span>Tem QR A4</span>
            </button>
          </div>

          {/* Primary Save CTA (hidden for Read-Only VIEWER) */}
          {user?.role !== 'VIEWER' && (
            <button
              type="button"
              onClick={handleSaveInventory}
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu kiểm kê'}</span>
              {dirtyIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold leading-none tabular-nums">
                  {dirtyIds.size}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. UNIFIED DIVISION TABS & COMPACT FILTER STRIP */}
      <div className="print:hidden bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Role-scoped Division Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {(!user || user.role === 'ADMIN' || user.role === 'MANAGER_DUOC') && (
              <button
                type="button"
                onClick={() => { setInventoryType('DUOC'); setSelectedDeptId(''); setSelectedAssetGroup(''); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  inventoryType === 'DUOC'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>TBYT (Dược)</span>
              </button>
            )}

            {(!user || user.role === 'ADMIN' || user.role === 'MANAGER_CNTT') && (
              <button
                type="button"
                onClick={() => { setInventoryType('CNTT'); setSelectedDeptId(''); setSelectedAssetGroup(''); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  inventoryType === 'CNTT'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Thiết bị CNTT</span>
              </button>
            )}

            {(!user || user.role === 'ADMIN' || user.role === 'MANAGER_TCHC') && (
              <button
                type="button"
                onClick={() => { setInventoryType('TCHC_HC'); setSelectedDeptId(''); setSelectedAssetGroup(''); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  inventoryType === 'TCHC_HC'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Hành chính (Khoa)</span>
              </button>
            )}

            {(!user || user.role === 'ADMIN' || user.role === 'MANAGER_TCHC') && (
              <button
                type="button"
                onClick={() => { setInventoryType('TCHC_TOANHA'); setSelectedDeptId(''); setSelectedAssetGroup(''); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  inventoryType === 'TCHC_TOANHA'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cơ điện &amp; Tòa nhà (M&amp;E)</span>
              </button>
            )}

            {(!user || user.role === 'ADMIN' || user.role === 'DEPARTMENT') && (
              <button
                type="button"
                onClick={() => {
                  setInventoryType('BY_DEPT');
                  setSelectedAssetGroup('');
                  setPage(1);
                  if (user?.role === 'DEPARTMENT' && user.departmentId) {
                    setSelectedDeptId(user.departmentId.toString());
                  } else if (!selectedDeptId && departments.length) {
                    setSelectedDeptId(departments[0].id.toString());
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  inventoryType === 'BY_DEPT'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{user?.role === 'DEPARTMENT' ? user.fullName : 'Theo Khoa / Phòng'}</span>
              </button>
            )}
          </div>

          {/* Compact Inventory Date Inline Input */}
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span>Ngày KK:</span>
            <input
              type="text"
              value={inventoryDate}
              onChange={e => setInventoryDate(e.target.value)}
              className="w-24 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 text-center tabular-nums focus:bg-white focus:border-blue-600 outline-none"
            />
          </label>
        </div>

        {/* Single-Row Super Search & Multi-Dimensional Filters */}
        <div className="flex flex-col lg:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Siêu tìm kiếm 14 trường: gõ kết hợp Tên, Mã, Khoa, Tầng, Người SD hoặc tầng:3 nhóm:hvac..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-8 pr-20 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-blue-600 outline-none transition"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setPage(1); }}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSmartHints(prev => !prev)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer inline-flex items-center gap-0.5 ${
                  showSmartHints
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Cú pháp</span>
              </button>
            </div>

            {showSmartHints && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-blue-200 rounded-xl shadow-xl p-2.5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-800 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Trợ lý Siêu Tìm Kiếm Kiểm Kê (1-Click Smart Tags)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSmartHints(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SMART_TAG_EXAMPLES.map(item => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => {
                        setSearchTerm(prev =>
                          prev.toLowerCase().includes(item.tag.toLowerCase())
                            ? prev.split(/\s+/).filter(t => t.toLowerCase() !== item.tag.toLowerCase()).join(' ')
                            : prev ? `${prev} ${item.tag}` : item.tag
                        );
                        setPage(1);
                      }}
                      className={`px-2 py-0.5 rounded-lg font-mono text-[11px] border transition cursor-pointer ${
                        searchTerm.toLowerCase().includes(item.tag.toLowerCase())
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-700 border-blue-200 hover:border-blue-500'
                      }`}
                    >
                      {item.label}{' '}
                      <span className="font-sans text-[10px] opacity-75">({item.desc})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {user?.role === 'DEPARTMENT' ? (
            <div className="md:w-56 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 flex items-center truncate">
              {user.fullName || departments.find(d => d.id === user.departmentId)?.name || 'Khoa / Phòng'}
            </div>
          ) : (
            <select
              value={selectedDeptId}
              onChange={e => { setSelectedDeptId(e.target.value); setPage(1); }}
              className="md:w-56 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
            >
              {inventoryType !== 'BY_DEPT' && <option value="">Tất cả Khoa / Phòng ({departments.length})</option>}
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name.replace(/\s*\((?:Cơ sở|Cs)\s*[12]\)/gi, '')}
                </option>
              ))}
            </select>
          )}

          {(inventoryType === 'TCHC_HC' || inventoryType === 'TCHC_TOANHA') && (
            <select
              value={selectedAssetGroup}
              onChange={e => { setSelectedAssetGroup(e.target.value); setPage(1); }}
              className="md:w-44 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả nhóm TCHC</option>
              {TCHC_GROUP_OPTIONS.filter(
                g => g.scope === (inventoryType === 'TCHC_HC' ? 'HC' : 'ME')
              ).map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="md:w-40 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
          >
            <option value="ALL">Tất cả tình trạng</option>
            <option value="DANG_SU_DUNG">Đang sử dụng</option>
            <option value="HONG">Hỏng</option>
            <option value="BAO_TRI">Bảo trì</option>
            <option value="CHO_THANH_LY">ĐN thanh lý</option>
            <option value="KHONG_SU_DUNG">Không sử dụng</option>
            <option value="DIFF">Có chênh lệch SL</option>
          </select>
        </div>



        {/* 1-Click Floor Pill Strip + 2-Level Super Sort */}
        <div className="pt-1.5 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1 inline-flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Tầng:
            </span>
            {FLOOR_PILL_OPTIONS.map(fl => {
              const active = selectedFloor === fl.value;
              const cnt = fl.value === 'Tất cả tầng' ? undefined : (floorCounts[fl.value] || 0);
              if (fl.value !== 'Tất cả tầng' && cnt === 0 && !active) return null;
              return (
                <button
                  key={fl.value}
                  type="button"
                  title={fl.fullLabel}
                  onClick={() => {
                    setSelectedFloor(active && fl.value !== 'Tất cả tầng' ? 'Tất cả tầng' : fl.value);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition cursor-pointer inline-flex items-center gap-1 ${
                    active
                      ? 'bg-blue-700 text-white border-blue-700 font-semibold'
                      : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <span>{fl.shortLabel}</span>
                  {cnt !== undefined && (
                    <span className={`text-[10px] tabular-nums ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                      ({cnt})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
              Sắp xếp:
            </span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value); setPage(1); }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white outline-none cursor-pointer"
              >
                {SUPER_SORT_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="px-2 py-1 border-l border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-700 font-semibold text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
              >
                {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                <span>{sortOrder === 'asc' ? 'Thuận' : 'Ngược'}</span>
              </button>
            </div>

            <span className="text-[11px] text-slate-400">+ Lớp 2:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white overflow-hidden">
              <select
                value={sortBy2}
                onChange={e => { setSortBy2(e.target.value); setPage(1); }}
                className="px-2 py-1 text-xs font-medium text-slate-700 bg-white outline-none cursor-pointer"
              >
                <option value="">-- Không --</option>
                {SUPER_SORT_FIELDS.filter(f => f.value !== sortBy).map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              {sortBy2 && (
                <button
                  type="button"
                  onClick={() => setSortOrder2(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="px-2 py-1 border-l border-slate-200 bg-amber-50 text-amber-800 font-semibold text-[11px] inline-flex items-center gap-0.5 cursor-pointer"
                >
                  {sortOrder2 === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Slim KPI Summary Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums text-slate-600">
            <span>
              Hiển thị: <strong className="text-slate-900">{sortedAssets.length.toLocaleString('vi-VN')}</strong> thiết bị
            </span>
            <span>
              Sổ sách: <strong className="text-slate-900">{totalBookQty.toLocaleString('vi-VN')}</strong>
            </span>
            <span>
              Thực tế: <strong className="text-blue-700">{totalActualQty.toLocaleString('vi-VN')}</strong>
            </span>
            <span>
              Chênh lệch:{' '}
              <strong className={totalDiffQty > 0 ? 'text-emerald-700' : totalDiffQty < 0 ? 'text-rose-700' : 'text-slate-900'}>
                {totalDiffQty > 0 ? `+${totalDiffQty}` : totalDiffQty}
              </strong>
            </span>
            <span>
              Tổng giá trị: <strong className="text-slate-900">{totalValue > 0 ? `${totalValue.toLocaleString('vi-VN')} đ` : '—'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {serverTotal > assets.length && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-medium">
                Đang nạp {assets.length.toLocaleString('vi-VN')}/{serverTotal.toLocaleString('vi-VN')} dòng (lọc Khoa/Phòng để xem đủ)
              </span>
            )}
            {dirtyIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                {dirtyIds.size} dòng đã sửa chưa lưu
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. DEFAULT COMPACT WORKING TABLE VIEW */}
      {viewMode === 'compact' && (
        <div className="print:hidden space-y-2.5">
          {/* Desktop Zero-Overflow Table */}
          <DataTableShell
            className="hidden md:block"
            title="Bảng kiểm kê chi tiết"
            totalCount={sortedAssets.length}
            countLabel="thiết bị"
            density={density}
            onDensityChange={setDensity}
            loading={loading}
            isEmpty={!loading && sortedAssets.length === 0}
            emptyMessage="Không có tài sản nào khớp bộ lọc hiện tại."
            toolbarExtra={
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="hidden sm:inline text-slate-400">Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none"
                >
                  <option value={25}>25 / trang</option>
                  <option value={50}>50 / trang</option>
                  <option value={100}>100 / trang</option>
                </select>
              </div>
            }
          >
            <table className="w-full table-fixed text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
                  <th className={`w-12 px-2.5 ${headPy} text-center`}>STT</th>
                  <th className={`w-[138px] px-2.5 ${headPy}`}>{renderSortButton('assetCode', 'Mã TS / Năm')}</th>
                  <th className={`px-2.5 ${headPy}`}>{renderSortButton('name', 'Tên tài sản & Thông số')}</th>
                  <th className={`w-[18%] px-2.5 ${headPy}`}>{renderSortButton('user', 'Đơn vị / Vị trí')}</th>
                  <th className={`w-[140px] px-2.5 ${headPy} text-center`}>{renderSortButton('actualQty', 'SL (SS / TT)', 'center')}</th>
                  <th className={`w-[126px] px-2.5 ${headPy} text-right`}>{renderSortButton('price', 'Nguyên giá', 'right')}</th>
                  <th className={`w-[136px] px-2.5 ${headPy}`}>{renderSortButton('status', 'Tình trạng')}</th>
                  <th className={`w-[16%] px-2.5 ${headPy}`}>Ghi chú</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-[13px]">
                {paginatedAssets.map((asset, idx) => {
                  const rowNum = (safePage - 1) * pageSize + idx + 1;
                  const diff = asset.quantityDifference || 0;
                  const lineTotal = (Number(asset.originalPrice) || 0) * (asset.actualQuantity || 1);
                  const isDirty = dirtyIds.has(asset.id);
                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-blue-50/30 transition-colors ${isDirty ? 'bg-amber-50/35' : ''}`}
                    >
                      <td className={`px-2.5 ${cellPy} text-center text-xs text-slate-500 tabular-nums`}>
                        {rowNum}
                      </td>
                      <td className={`px-2.5 ${cellPy} align-top`}>
                        <div className="font-mono text-xs font-semibold text-blue-700 truncate" title={asset.assetCode}>
                          {asset.assetCode}
                        </div>
                        {(asset.oldAssetCode || asset.yearInUse) && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 tabular-nums" title={asset.oldAssetCode || ''}>
                            {asset.oldAssetCode ? `Cũ: ${asset.oldAssetCode}` : ''}
                            {asset.oldAssetCode && asset.yearInUse ? ' · ' : ''}
                            {asset.yearInUse ? asset.yearInUse : ''}
                          </div>
                        )}
                      </td>
                      <td className={`px-2.5 ${cellPy} align-top`}>
                        <div className="font-medium text-slate-900 line-clamp-2 leading-snug" title={asset.name}>
                          {asset.name}
                        </div>
                        {(asset.specifications || asset.managingUnit || asset.assetGroup) && (
                          <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1" title={asset.specifications || ''}>
                            {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] ? (
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border shrink-0 ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}>
                                {TCHC_GROUP_META[asset.assetGroup].label}
                              </span>
                            ) : (
                              <span>{asset.managingUnit === 'DUOC' ? 'Khoa Dược' : asset.managingUnit === 'CNTT' ? 'Tổ CNTT' : 'Phòng TCHC'}</span>
                            )}
                            {asset.specifications ? ` · ${asset.specifications}` : ''}
                          </div>
                        )}
                      </td>
                      <td className={`px-2.5 ${cellPy} align-top`}>
                        <div className="text-xs text-slate-700 truncate" title={asset.locationDetail || asset.assignedTo || asset.department?.name || ''}>
                          {asset.locationDetail || asset.assignedTo || asset.department?.name || 'Tại đơn vị'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {asset.location || 'Cơ sở 1'}
                          {asset.floor ? ` · ${asset.floor}` : ''}
                        </div>
                      </td>
                      <td className={`px-2.5 ${cellPy} align-middle`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[11px] text-slate-400 tabular-nums" title="Số lượng sổ sách">
                            {asset.bookQuantity || 1}/
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={asset.actualQuantity}
                            onChange={e => handleQuantityChange(asset.id, e.target.value)}
                            aria-label={`Số lượng thực tế ${asset.assetCode}`}
                            className="w-12 text-center font-semibold text-xs text-blue-900 bg-white border border-slate-200 rounded-lg px-1 py-1 tabular-nums focus:border-blue-600 focus:ring-1 focus:ring-blue-500/30 outline-none"
                          />
                          {diff !== 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                                diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-2.5 ${cellPy} text-right align-top tabular-nums`}>
                        <div className="text-xs font-medium text-slate-800">
                          {asset.originalPrice ? Number(asset.originalPrice).toLocaleString('vi-VN') : '—'}
                        </div>
                        {asset.originalPrice && (asset.actualQuantity || 1) > 1 && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            TT: {lineTotal.toLocaleString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td className={`px-2.5 ${cellPy} align-middle`}>
                        <select
                          value={asset.currentStatus}
                          onChange={e => handleStatusChange(asset.id, e.target.value)}
                          className={`w-full text-[11px] font-medium border rounded-lg px-2 py-1 outline-none cursor-pointer ${getStatusSelectStyle(asset.currentStatus)}`}
                        >
                          <option value="DANG_SU_DUNG">Đang sử dụng</option>
                          <option value="HONG">Hỏng</option>
                          <option value="BAO_TRI">Bảo trì</option>
                          <option value="CHO_THANH_LY">ĐN thanh lý</option>
                          <option value="KHONG_SU_DUNG">Không SD</option>
                        </select>
                      </td>
                      <td className={`px-2.5 ${cellPy} align-middle`}>
                        <input
                          type="text"
                          value={asset.customNote || ''}
                          onChange={e => handleNoteChange(asset.id, e.target.value)}
                          placeholder="Ghi chú..."
                          className="w-full text-xs text-slate-700 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-blue-500 rounded-lg px-2 py-1 outline-none transition"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </DataTableShell>

          {/* Mobile Compact Card List */}
          <div className="md:hidden space-y-2">
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                Đang tải danh mục kiểm kê...
              </div>
            ) : paginatedAssets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                Không có tài sản nào khớp bộ lọc hiện tại.
              </div>
            ) : (
              paginatedAssets.map((asset, idx) => {
                const rowNum = (safePage - 1) * pageSize + idx + 1;
                const diff = asset.quantityDifference || 0;
                return (
                  <div key={asset.id} className="bg-white rounded-2xl border border-slate-200/80 p-3 space-y-2 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-blue-700">
                          <span className="text-slate-400">#{rowNum}</span>
                          <span>{asset.assetCode}</span>
                          {asset.oldAssetCode && <span className="text-slate-400 font-normal">· {asset.oldAssetCode}</span>}
                        </div>
                        <div className="text-xs font-semibold text-slate-900 mt-0.5">{asset.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {asset.locationDetail || asset.assignedTo || asset.department?.name || 'Tại đơn vị'}
                        </div>
                      </div>
                      <div className="text-right text-xs font-semibold text-slate-800 tabular-nums shrink-0">
                        {asset.originalPrice ? `${Number(asset.originalPrice).toLocaleString('vi-VN')} đ` : '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-slate-400 text-[11px]">SL:</span>
                        <input
                          type="number"
                          min="0"
                          value={asset.actualQuantity}
                          onChange={e => handleQuantityChange(asset.id, e.target.value)}
                          className="w-12 text-center font-semibold text-xs text-blue-900 border border-slate-200 rounded-lg py-1 tabular-nums"
                        />
                        {diff !== 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                      <select
                        value={asset.currentStatus}
                        onChange={e => handleStatusChange(asset.id, e.target.value)}
                        className={`flex-1 text-[11px] font-medium border rounded-lg px-2 py-1 ${getStatusSelectStyle(asset.currentStatus)}`}
                      >
                        <option value="DANG_SU_DUNG">Đang sử dụng</option>
                        <option value="HONG">Hỏng</option>
                        <option value="BAO_TRI">Bảo trì</option>
                        <option value="CHO_THANH_LY">ĐN thanh lý</option>
                        <option value="KHONG_SU_DUNG">Không SD</option>
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Compact Pagination Footer */}
          {sortedAssets.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-600">
              <div className="tabular-nums">
                Hiển thị{' '}
                <strong className="text-slate-900">
                  {((safePage - 1) * pageSize + 1).toLocaleString('vi-VN')}–{Math.min(safePage * pageSize, sortedAssets.length).toLocaleString('vi-VN')}
                </strong>{' '}
                trong <strong className="text-slate-900">{sortedAssets.length.toLocaleString('vi-VN')}</strong> thiết bị
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trước</span>
                </button>
                <span className="px-2.5 py-1 font-medium text-slate-700 tabular-nums">
                  Trang {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. BIỂU MẪU CHUẨN C53-HD (Hiển thị khi chọn "Mẫu C53-HD", khi In hoặc Xuất PDF) */}
      {/* ========================================================================= */}
      <div
        id="inventory-c53-document"
        className={
          viewMode === 'c53'
            ? 'bg-white p-6 sm:p-10 rounded-2xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0 font-serif text-slate-900 leading-normal'
            : exportingPdf
              ? 'fixed -left-[99999px] top-0 w-[1080px] bg-white p-6 font-serif text-slate-900 leading-normal'
              : 'hidden print:block bg-white p-0 font-serif text-slate-900 leading-normal'
        }
      >
        {/* Header: Đơn vị & Mẫu số C53-HD */}
        <div className="flex justify-between items-start text-xs sm:text-sm font-sans mb-4">
          <div>
            <div className="font-bold text-slate-900 uppercase">Đơn vị: Trung tâm Kiểm soát bệnh tật TP Đà Nẵng</div>
            <div className="text-slate-700">Mã ĐV SDNS: <strong>1127644</strong></div>
          </div>
          <div className="text-right">
            <div className="font-bold text-slate-900">Mẫu số C53-HD</div>
            <div className="text-[11px] text-slate-500 italic">(Ban hành theo TT số 107/2017/TT-BTC)</div>
          </div>
        </div>

        {/* Tiêu đề Biên Bản */}
        <div className="text-center my-6">
          <h2 className="text-lg sm:text-2xl font-bold uppercase tracking-wide">
            BIÊN BẢN KIỂM KÊ TÀI SẢN CỐ ĐỊNH NĂM 2026
          </h2>
          <div className="text-base sm:text-lg font-bold text-blue-900 uppercase mt-1">
            {formTitle}
          </div>
          <div className="text-xs sm:text-sm text-slate-700 mt-2 font-sans space-y-1">
            <p className="italic">
              - Căn cứ Quyết định số <strong>05/QĐ-TTKSBT</strong> ngày 05/01/2026 của Giám đốc CDC Đà Nẵng về việc thành lập Hội đồng kiểm kê tài sản năm 2026.
            </p>
            <p className="italic">
              - Nguồn kinh phí hình thành: <strong>Ngân sách Nhà nước cấp & Quỹ phát triển hoạt động sự nghiệp</strong>
            </p>
            <p className="italic">
              - Hôm nay, ngày {inventoryDate}, tại Trung tâm Kiểm soát bệnh tật TP Đà Nẵng, chúng tôi gồm:
            </p>
          </div>
        </div>

        {/* Thành phần Hội đồng & Tổ kiểm kê tự động điền */}
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200 text-xs sm:text-sm font-sans mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-6">
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>1. <strong>{president.fullName}</strong> - {president.position}</span>
              <span className="font-bold text-blue-700">Chủ tịch Hội đồng</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>2. <strong>{memberTCKT.fullName}</strong> - {memberTCKT.position}</span>
              <span className="font-bold text-slate-700">Ủy viên</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>3. <strong>{inventoryType === 'CNTT' ? 'Ông. Trần Văn Vũ' : teamLeader.fullName}</strong> - {inventoryType === 'CNTT' ? 'Trưởng phòng KHNV' : teamLeader.position}</span>
              <span className="font-bold text-emerald-700">{inventoryType === 'CNTT' ? 'Tổ trưởng' : teamLeader.titleRole}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-1">
              <span>4. <strong>{deptRep.fullName}</strong> - {deptRep.position}</span>
              <span className="font-bold text-slate-700">Đại diện Khoa/Phòng</span>
            </div>
            <div className="md:col-span-2 pt-1 text-slate-700">
              <span>5. <strong>Thành viên tổ kiểm kê:</strong> {
                teamMembers.length > 0
                  ? teamMembers.map(m => `${m.fullName} (${m.position})`).join(', ')
                  : 'Ông. Trần Văn Vũ, Ông. Phan Thanh Hoàn, Bà. Trần Thị Liên, Bà. Huỳnh Thị Thanh Tú'
              }</span>
            </div>
          </div>
          <div className="mt-3 text-xs italic text-slate-600">
            Cùng tiến hành kiểm kê tài sản, kết quả như sau:
          </div>
        </div>

        {/* Bảng Dữ Liệu Kiểm Kê Tùy Biến Cột (Chuẩn C53-HD) */}
        <div className="overflow-x-auto border border-slate-400 rounded-lg">
          <table className="w-full text-xs font-sans border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-center font-bold border-b border-slate-400 divide-x divide-slate-300">
                {isCol('stt') && <th rowSpan={hasSubHeader ? 2 : 1} className="p-2 w-10">STT</th>}
                {isCol('name') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('name')}
                    className="p-2 min-w-[200px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Tên tài sản"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>TÀI SẢN</span>
                      <span className="print:hidden">
                        {sortBy === 'name' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}
                {isCol('oldAssetCode') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('oldAssetCode')}
                    className="p-2 min-w-[105px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Mã số cũ"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Mã số cũ</span>
                      <span className="print:hidden">
                        {sortBy === 'oldAssetCode' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}
                {isCol('assetCode') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('assetCode')}
                    className="p-2 min-w-[110px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Mã tài sản"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-bold text-slate-800">Mã số mới</span>
                      <span className="print:hidden">
                        {sortBy === 'assetCode' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}
                {isCol('yearInUse') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('yearInUse')}
                    className="p-2 min-w-[65px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Năm đưa vào SD"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Năm SD</span>
                      <span className="print:hidden">
                        {sortBy === 'yearInUse' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}
                
                {hasSubHeader && (
                  <th colSpan={qtyCols.length} className="p-1 border-b border-slate-300 bg-slate-100">
                    {qtyCols.length === 1 && isCol('actualQty') ? 'Thực tế KK' : 'Số lượng tài sản'}
                  </th>
                )}

                {isCol('price') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('price')}
                    className="p-2 min-w-[90px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Đơn giá"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Đơn giá (đ)</span>
                      <span className="print:hidden">
                        {sortBy === 'price' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}

                {isCol('total') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('total')}
                    className="p-2 min-w-[105px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Thành tiền"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Thành tiền (đ)</span>
                      <span className="print:hidden">
                        {sortBy === 'total' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}

                {isCol('unit') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('unit')}
                    className="p-2 min-w-[100px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Bộ phận quản lý"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Bộ phận QL</span>
                      <span className="print:hidden">
                        {sortBy === 'unit' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}

                {isCol('user') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('user')}
                    className="p-2 min-w-[130px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Nơi / Người sử dụng"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Nơi sử dụng hoặc người SD</span>
                      <span className="print:hidden">
                        {sortBy === 'user' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}

                {isCol('status') && (
                  <th 
                    rowSpan={hasSubHeader ? 2 : 1} 
                    onClick={() => handleSort('status')}
                    className="p-2 min-w-[110px] cursor-pointer hover:bg-slate-200/90 transition select-none group"
                    title="Bấm để đổi chiều sắp xếp theo Tình trạng sử dụng"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tình trạng SD</span>
                      <span className="print:hidden">
                        {sortBy === 'status' ? (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-100 text-blue-700 text-xs font-bold shadow-xs">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </span>
                    </div>
                  </th>
                )}

                {isCol('location') && <th rowSpan={hasSubHeader ? 2 : 1} className="p-2 min-w-[100px]">Nơi TS mới chuyển đến</th>}
                {isCol('note') && <th rowSpan={hasSubHeader ? 2 : 1} className="p-2 min-w-[120px]">Ghi chú</th>}
              </tr>

              {hasSubHeader && (
                <tr className="bg-slate-100 text-center font-bold border-b border-slate-400 divide-x divide-slate-300">
                  {isCol('bookQty') && (
                    <th className="p-1 min-w-[60px] bg-slate-50 text-slate-800">Sổ sách</th>
                  )}
                  {isCol('actualQty') && (
                    <th 
                      onClick={() => handleSort('actualQty')}
                      className="p-1 min-w-[65px] bg-blue-50/70 text-blue-900 cursor-pointer hover:bg-blue-100 transition select-none group"
                      title="Bấm để đổi chiều sắp xếp theo Số lượng thực tế"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{qtyCols.length === 1 ? 'Số lượng' : 'Thực tế'}</span>
                        <span className="print:hidden">
                          {sortBy === 'actualQty' ? (
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded bg-blue-200 text-blue-800 text-[9px] font-bold">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                          )}
                        </span>
                      </div>
                    </th>
                  )}
                  {isCol('diff') && (
                    <th 
                      onClick={() => handleSort('diff')}
                      className="p-1 min-w-[60px] bg-amber-50/70 text-amber-900 cursor-pointer hover:bg-amber-100 transition select-none group"
                      title="Bấm để đổi chiều sắp xếp theo Chênh lệch"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Chênh lệch</span>
                        <span className="print:hidden">
                          {sortBy === 'diff' ? (
                            <span className="inline-flex items-center justify-center w-3 h-3 rounded bg-amber-200 text-amber-800 text-[9px] font-bold">
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 text-amber-500 opacity-0 group-hover:opacity-100 transition" />
                          )}
                        </span>
                      </div>
                    </th>
                  )}
                </tr>
              )}

              {/* Reference Row: A, B, C... 1, 2, 3... */}
              <tr className="bg-slate-200 text-center text-[10px] font-bold border-b border-slate-400 divide-x divide-slate-300 text-slate-700">
                {visibleColumns.map(key => (
                  <td key={key} className={`p-1 ${key === 'actualQty' ? 'bg-blue-100/60' : ''}`}>
                    {colRefMap[key]}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-16 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Đang tải danh mục kiểm kê...
                  </td>
                </tr>
              ) : sortedAssets.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-16 text-slate-400 font-medium">
                    Không có tài sản nào trong phân loại hoặc khoa phòng được chọn.
                  </td>
                </tr>
              ) : (
                sortedAssets.map((asset, idx) => (
                  <tr key={asset.id} className="hover:bg-blue-50/30 divide-x divide-slate-200">
                    {isCol('stt') && (
                      <td className="p-2 text-center font-medium text-slate-600">{idx + 1}</td>
                    )}
                    {isCol('name') && (
                      <td className="p-2 font-semibold text-slate-900">
                        <div>{asset.name}</div>
                        {asset.specifications && (
                          <div className="text-[10px] text-slate-500 font-normal">{asset.specifications}</div>
                        )}
                      </td>
                    )}
                    {isCol('oldAssetCode') && (
                      <td className="p-2 font-mono text-center text-amber-800 text-[11px] font-medium">
                        {asset.oldAssetCode || '—'}
                      </td>
                    )}
                    {isCol('assetCode') && (
                      <td className="p-2 font-mono font-bold text-blue-700 text-center">
                        {asset.assetCode}
                      </td>
                    )}
                    {isCol('yearInUse') && (
                      <td className="p-2 text-center text-slate-700">{asset.yearInUse || '—'}</td>
                    )}
                    
                    {/* Sổ sách */}
                    {isCol('bookQty') && (
                      <td className="p-2 text-center text-slate-700 font-medium">
                        {asset.bookQuantity || 1}
                      </td>
                    )}

                    {/* Thực tế KK (Số lượng) */}
                    {isCol('actualQty') && (
                      <td className="p-1 text-center bg-blue-50/20">
                        {exportingPdf ? (
                          <span className="font-bold text-slate-900">{asset.actualQuantity}</span>
                        ) : (
                          <>
                            <span className="hidden print:inline font-bold text-slate-900">{asset.actualQuantity}</span>
                            <input
                              type="number"
                              min="0"
                              value={asset.actualQuantity}
                              onChange={e => handleQuantityChange(asset.id, e.target.value)}
                              className="print:hidden w-14 text-center font-bold text-blue-900 bg-white border border-blue-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </>
                        )}
                      </td>
                    )}

                    {/* Chênh lệch */}
                    {isCol('diff') && (
                      <td className={`p-2 text-center font-bold ${
                        (asset.quantityDifference || 0) > 0 ? 'text-emerald-700' :
                        (asset.quantityDifference || 0) < 0 ? 'text-rose-700' : 'text-slate-500'
                      }`}>
                        {(asset.quantityDifference || 0) !== 0
                          ? ((asset.quantityDifference || 0) > 0 ? `+${asset.quantityDifference}` : asset.quantityDifference)
                          : '0'}
                      </td>
                    )}

                    {/* Đơn giá */}
                    {isCol('price') && (
                      <td className="p-2 text-right text-slate-700 font-mono">
                        {asset.originalPrice ? Number(asset.originalPrice).toLocaleString('vi-VN') : '—'}
                      </td>
                    )}

                    {/* Thành tiền */}
                    {isCol('total') && (
                      <td className="p-2 text-right font-bold text-slate-900 font-mono">
                        {asset.originalPrice 
                          ? (Number(asset.originalPrice) * (asset.actualQuantity || 1)).toLocaleString('vi-VN')
                          : '—'}
                      </td>
                    )}

                    {/* Bộ phận quản lý */}
                    {isCol('unit') && (
                      <td className="p-2 text-slate-700 text-center">
                        {asset.managingUnit === 'DUOC' ? 'Khoa Dược' :
                         asset.managingUnit === 'CNTT' ? 'Tổ CNTT' :
                         asset.source || asset.department?.name || 'Phòng TCHC'}
                      </td>
                    )}

                    {/* Nơi sử dụng */}
                    {isCol('user') && (
                      <td className="p-2 text-slate-700">
                        <div>{asset.locationDetail || asset.assignedTo || asset.department?.name || 'Tại đơn vị'}</div>
                      </td>
                    )}

                    {/* Tình trạng sử dụng */}
                    {isCol('status') && (
                      <td className="p-1 text-center">
                        {exportingPdf ? (
                          <span className="font-medium text-slate-900">
                            {asset.currentStatus === 'DANG_SU_DUNG' ? 'Đang sử dụng' :
                             asset.currentStatus === 'HONG' ? 'Hỏng' :
                             asset.currentStatus === 'CHO_THANH_LY' ? 'ĐN thanh lý' :
                             asset.currentStatus === 'BAO_TRI' ? 'Bảo trì' :
                             asset.currentStatus === 'KHONG_SU_DUNG' ? 'Không sử dụng' : (asset.currentStatus || 'Đang sử dụng')}
                          </span>
                        ) : (
                          <>
                            <span className="hidden print:inline font-medium text-slate-900">
                              {asset.currentStatus === 'DANG_SU_DUNG' ? 'Đang sử dụng' :
                               asset.currentStatus === 'HONG' ? 'Hỏng' :
                               asset.currentStatus === 'CHO_THANH_LY' ? 'ĐN thanh lý' :
                               asset.currentStatus === 'BAO_TRI' ? 'Bảo trì' :
                               asset.currentStatus === 'KHONG_SU_DUNG' ? 'Không sử dụng' : (asset.currentStatus || 'Đang sử dụng')}
                            </span>
                            <select
                              value={asset.currentStatus}
                              onChange={e => handleStatusChange(asset.id, e.target.value)}
                              className="print:hidden w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white font-medium focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="DANG_SU_DUNG">Đang sử dụng</option>
                              <option value="HONG">Hỏng</option>
                              <option value="BAO_TRI">Bảo trì</option>
                              <option value="CHO_THANH_LY">ĐN thanh lý</option>
                              <option value="KHONG_SU_DUNG">Không sử dụng</option>
                            </select>
                          </>
                        )}
                      </td>
                    )}

                    {/* Nơi chuyển đến */}
                    {isCol('location') && (
                      <td className="p-2 text-center text-slate-600">{asset.location || 'Cơ sở 1'}</td>
                    )}

                    {/* Ghi chú */}
                    {isCol('note') && (
                      <td className="p-1">
                        {exportingPdf ? (
                          <span className="text-[11px] text-slate-800">{asset.customNote || ''}</span>
                        ) : (
                          <>
                            <span className="hidden print:inline text-[11px] text-slate-800">{asset.customNote || ''}</span>
                            <input
                              type="text"
                              value={asset.customNote || ''}
                              onChange={e => handleNoteChange(asset.id, e.target.value)}
                              placeholder="Ghi chú..."
                              className="print:hidden w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white focus:ring-1 focus:ring-blue-500"
                            />
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            
            {/* Tổng cộng footer */}
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 divide-x divide-slate-300">
                <td colSpan={prefixColCount} className="p-2 text-center uppercase tracking-wider">
                  TỔNG CỘNG ({sortedAssets.length} thiết bị)
                </td>
                {visibleColumns.slice(prefixColCount).map(key => {
                  if (key === 'bookQty') {
                    return <td key={key} className="p-2 text-center text-slate-800">{totalBookQty}</td>;
                  }
                  if (key === 'actualQty') {
                    return <td key={key} className="p-2 text-center text-blue-900 bg-blue-100/50">{totalActualQty}</td>;
                  }
                  if (key === 'diff') {
                    return (
                      <td key={key} className="p-2 text-center font-bold text-slate-800">
                        {totalDiffQty !== 0 ? (totalDiffQty > 0 ? `+${totalDiffQty}` : totalDiffQty) : '0'}
                      </td>
                    );
                  }
                  if (key === 'price') {
                    return <td key={key} className="p-2"></td>;
                  }
                  if (key === 'total') {
                    return (
                      <td key={key} className="p-2 text-right font-mono text-blue-900">
                        {totalValue > 0 ? totalValue.toLocaleString('vi-VN') + ' đ' : '—'}
                      </td>
                    );
                  }
                  return <td key={key} className="p-2"></td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 3. CHỮ KÝ PHÊ DUYỆT BIÊN BẢN (Khớp chuẩn 4 khối chức danh CDC) */}
        <div className="mt-8 pt-4 font-sans text-xs sm:text-sm">
          <div className="text-right italic mb-4 pr-6">
            Đà Nẵng, ngày {inventoryDate.split('/')[0]} tháng {inventoryDate.split('/')[1] || '01'} năm {inventoryDate.split('/')[2] || '2026'}
          </div>

          <div className="grid grid-cols-4 gap-4 text-center font-sans">
            {/* Cột 1: Tổ kiểm kê */}
            <div>
              <div className="font-bold uppercase text-slate-900">{signatures.membersTitle || 'THÀNH VIÊN TỔ KIỂM KÊ'}</div>
              <div className="text-[11px] italic text-slate-500 mb-6">(Ký, ghi rõ họ tên)</div>
              <div className="text-left text-xs text-slate-700 space-y-1.5 font-sans pl-2 whitespace-pre-line">
                {(signatures.membersList || 'Trần Văn Vũ\nPhan Thanh Hoàn\nTrần Thị Liên\nHuỳnh Thị Thanh Tú')
                  .split('\n')
                  .map((mem: string, i: number) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span>- {mem.replace(/^-\s*/, '')}</span>
                      <span className="text-slate-400 tracking-wider">........................</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Cột 2: Đại diện Khoa/Phòng */}
            <div>
              <div className="font-bold uppercase text-slate-900">
                {currentDept ? `ĐẠI DIỆN ${currentDept.name.toUpperCase()}` : signatures.leaderTitle}
              </div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
              <div className="font-bold text-slate-900">{signatures.leaderName}</div>
            </div>

            {/* Cột 3: Trưởng phòng TCKT */}
            <div>
              <div className="font-bold uppercase text-slate-900">{signatures.tcktTitle || 'TRƯỞNG PHÒNG TC - KT'}</div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, ghi rõ họ tên)</div>
              <div className="font-bold text-slate-900">{signatures.tcktName || 'Hồ Phú Quảng'}</div>
            </div>

            {/* Cột 4: Giám đốc / Chủ tịch Hội đồng */}
            <div>
              <div className="font-bold uppercase text-slate-900">{signatures.presidentTitle || 'CHỦ TỊCH HỘI ĐỒNG'}</div>
              <div className="text-[11px] italic text-slate-500 mb-20">(Ký, đóng dấu)</div>
              <div className="font-bold text-slate-900">{signatures.presidentName || 'Nguyễn Đại Vĩnh'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL QUẢN LÝ THÀNH VIÊN TỔ / HỘI ĐỒNG KIỂM KÊ (Thêm, Sửa, Gán vị trí) */}
      {/* ========================================================================= */}
      {showCommitteeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">Cấu hình Hội đồng & Thành viên Tổ kiểm kê</h3>
              </div>
              <button 
                onClick={() => { setShowCommitteeModal(false); setEditingMember(null); }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Add / Edit Member Form */}
              <form onSubmit={handleSaveMember} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase">
                  {editingMember?.id ? 'Chỉnh sửa thông tin thành viên' : 'Thêm thành viên mới vào Hội đồng'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Họ và tên (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Ông. Nguyễn Văn A"
                      value={editingMember?.fullName || ''}
                      onChange={e => setEditingMember(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Chức vụ (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Giám đốc, Trưởng phòng..."
                      value={editingMember?.position || ''}
                      onChange={e => setEditingMember(prev => ({ ...prev, position: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Vai trò trong Tổ (*)</label>
                    <select
                      value={editingMember?.role || 'THANHVIEN'}
                      onChange={e => setEditingMember(prev => ({ ...prev, role: e.target.value as any }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CHUTICH">Chủ tịch Hội đồng</option>
                      <option value="TOTRUONG_TBYT">Tổ trưởng Tổ TBYT (Khoa Dược)</option>
                      <option value="TOTRUONG_CNTT">Tổ trưởng Tổ CNTT</option>
                      <option value="TOTRUONG_TCHC">Tổ trưởng Tổ TCHC</option>
                      <option value="UYVIEN">Ủy viên / Thành viên TCKT</option>
                      <option value="DAIDIEN_KHOA">Đại diện Khoa / Phòng</option>
                      <option value="THANHVIEN">Thành viên tổ kiểm kê</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingMember && (
                    <button
                      type="button"
                      onClick={() => setEditingMember(null)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Hủy bỏ
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    {editingMember?.id ? 'Cập nhật thành viên' : 'Thêm thành viên'}
                  </button>
                </div>
              </form>

              {/* Members List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Họ và tên</th>
                      <th className="p-2.5">Chức vụ</th>
                      <th className="p-2.5">Vai trò phân công</th>
                      <th className="p-2.5 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {committeeMembers.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-900">{m.fullName}</td>
                        <td className="p-2.5 text-slate-600">{m.position}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            m.role === 'CHUTICH' ? 'bg-purple-100 text-purple-800' :
                            m.role.startsWith('TOTRUONG') ? 'bg-emerald-100 text-emerald-800' :
                            m.role === 'UYVIEN' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {m.role === 'CHUTICH' ? 'Chủ tịch Hội đồng' :
                             m.role === 'TOTRUONG_TBYT' ? 'Tổ trưởng TBYT' :
                             m.role === 'TOTRUONG_CNTT' ? 'Tổ trưởng CNTT' :
                             m.role === 'TOTRUONG_TCHC' ? 'Tổ trưởng TCHC' :
                             m.role === 'UYVIEN' ? 'Ủy viên TCKT' :
                             m.role === 'DAIDIEN_KHOA' ? 'Đại diện Khoa' : 'Thành viên tổ'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right space-x-1">
                          <button
                            onClick={() => setEditingMember(m)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                            title="Sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCommitteeModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl cursor-pointer"
              >
                Đóng & Áp dụng biểu mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: TÙY CHỈNH 4 CỘT CHỮ KÝ DƯỚI BIÊN BẢN KIỂM KÊ C53-HD             */}
      {/* ========================================================================= */}
      {showSignaturesModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Cấu Hình 4 Vị Trí Ký Dưới Biên Bản C53-HD</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tùy chỉnh chức danh & danh sách họ tên người ký in trên bản A4</p>
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
              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-600 mr-1">Gợi ý nhanh theo khối:</span>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    leaderTitle: 'TỔ TRƯỞNG TỔ CNTT',
                    leaderName: 'KTV. Phan Thanh Hoàn'
                  })}
                  className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px] hover:bg-blue-200 cursor-pointer"
                >
                  💻 Khối CNTT
                </button>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    leaderTitle: 'TRƯỞNG KHOA DƯỢC - VTYT',
                    leaderName: 'DS. Mai Thị Tính'
                  })}
                  className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] hover:bg-emerald-200 cursor-pointer"
                >
                  🩺 Khối Dược (TBYT)
                </button>
                <button
                  type="button"
                  onClick={() => setSignatures({
                    ...signatures,
                    leaderTitle: 'TRƯỞNG PHÒNG TỔ CHỨC - HÀNH CHÍNH',
                    leaderName: 'Ông. Trần Liên'
                  })}
                  className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] hover:bg-amber-200 cursor-pointer"
                >
                  🏢 Khối TCHC
                </button>
              </div>

              {/* 1. Cột 1: Tổ kiểm kê */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">1. Cột 1 (Thành viên Tổ kiểm kê)</div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tiêu đề cột</label>
                  <input
                    type="text"
                    value={signatures.membersTitle}
                    onChange={e => setSignatures({ ...signatures, membersTitle: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Danh sách thành viên (Mỗi người 1 dòng)</label>
                  <textarea
                    rows={4}
                    value={signatures.membersList}
                    onChange={e => setSignatures({ ...signatures, membersList: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* 2. Cột 2: Tổ trưởng / Đại diện đơn vị */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">2. Cột 2 (Tổ trưởng chuyên trách / Đại diện Khoa Phòng)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.leaderTitle}
                      onChange={e => setSignatures({ ...signatures, leaderTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.leaderName}
                      onChange={e => setSignatures({ ...signatures, leaderName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Cột 3: Phòng TCKT */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">3. Cột 3 (Đại diện Phòng Tài chính - Kế toán)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.tcktTitle}
                      onChange={e => setSignatures({ ...signatures, tcktTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.tcktName}
                      onChange={e => setSignatures({ ...signatures, tcktName: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Cột 4: Chủ tịch Hội đồng */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">4. Cột 4 (Chủ tịch Hội đồng kiểm kê / Giám đốc)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Chức danh</label>
                    <input
                      type="text"
                      value={signatures.presidentTitle}
                      onChange={e => setSignatures({ ...signatures, presidentTitle: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={signatures.presidentName}
                      onChange={e => setSignatures({ ...signatures, presidentName: e.target.value })}
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
      {/* MODAL 6: TÙY CHỌN CỘT HIỂN THỊ VÀO TRONG BIÊN BẢN KIỂM KÊ (C53-HD)         */}
      {/* ========================================================================= */}
      {showColumnModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    Tùy chọn cột Biên bản kiểm kê C53-HD
                  </h3>
                  <p className="text-xs text-slate-500">
                    Áp dụng cho: <span className="font-semibold text-purple-700">
                      {inventoryType === 'CNTT' ? 'Tổ CNTT' :
                       inventoryType === 'DUOC' ? 'Khoa Dược (TBYT)' :
                       inventoryType === 'TCHC_HC' ? 'Phòng TCHC (Hành chính)' :
                       inventoryType === 'TCHC_TOANHA' ? 'Phòng TCHC (Hạ tầng Tòa nhà)' : 'Khoa / Phòng'}
                    </span> (Lưu riêng theo từng khối)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowColumnModal(false)}
                className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Presets */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Gợi ý mẫu cột nhanh:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setTempColumns(DEFAULT_VISIBLE_COLUMNS)}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  ⭐ Chuẩn CDC 13 cột (Khuyên dùng)
                </button>
                <button
                  type="button"
                  onClick={() => setTempColumns(ALL_INVENTORY_COLUMNS.map(c => c.key))}
                  className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  📋 Đầy đủ 15 cột (Kèm Sổ sách & Chênh lệch)
                </button>
                <button
                  type="button"
                  onClick={() => setTempColumns(['stt', 'name', 'assetCode', 'actualQty', 'user', 'status', 'note'])}
                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  ⚡ Rút gọn kiểm đếm hiện trường (7 cột)
                </button>
                <button
                  type="button"
                  onClick={() => setTempColumns(['stt', 'name', 'assetCode', 'actualQty', 'price', 'total', 'unit', 'user', 'status', 'note'])}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  💰 Báo cáo Giá trị & Kế toán (10 cột)
                </button>
              </div>
            </div>

            {/* Column Checkboxes grouped */}
            <div className="p-5 overflow-y-auto space-y-5">
              {COLUMN_GROUPS.map(grp => {
                const groupCols = ALL_INVENTORY_COLUMNS.filter(c => c.group === grp.id);
                return (
                  <div key={grp.id} className="space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between border-b border-slate-100 pb-1">
                      <span>{grp.title}</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        {groupCols.filter(c => tempColumns.includes(c.key)).length}/{groupCols.length} đang bật
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupCols.map(col => {
                        const isChecked = tempColumns.includes(col.key);
                        const isLocked = !!col.required;
                        return (
                          <label
                            key={col.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-purple-50/50 border-purple-200 text-slate-900'
                                : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-50'
                            } ${isLocked ? 'opacity-80 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isLocked}
                              onChange={() => toggleTempColumn(col.key)}
                              className="mt-0.5 rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex-1">
                              <div className="font-semibold flex items-center gap-1.5">
                                <span>{col.label}</span>
                                {isLocked && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">Bắt buộc</span>
                                )}
                              </div>
                              {col.desc && (
                                <p className="text-[11px] text-slate-400 mt-0.5">{col.desc}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                Đang chọn: <strong className="text-purple-700 font-bold">{tempColumns.length}</strong> / 15 cột
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowColumnModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveColumns(tempColumns)}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" /> Áp dụng cấu hình cột
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <QrLabelPrintModal
        open={showQrModal}
        onClose={() => setShowQrModal(false)}
        assets={sortedAssets}
        defaultTitle="CDC ĐÀ NẴNG · KIỂM KÊ 2026"
        contextLabel={formTitle}
        quantitySourceLabel="SL thực tế KK"
      />
    </div>
  );
}
