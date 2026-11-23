import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Plus, Edit, Trash2, MapPin, Search, 
  Package, Users, CheckCircle2, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { Department } from '../types';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';

export default function Departments() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { density, setDensity, cellPy, headPy } = useTablePrefs('departments');
  const [departments, setDepartments] = useState<(Department & { assetBreakdown?: { total: number; duoc: number; cntt: number; tchcHc: number; tchcMe: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'location' | 'assets'>('assets');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    location: 'Cơ sở 1',
    description: ''
  });

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await apiGet('/departments');
      if (Array.isArray(data)) {
        setDepartments(data);
      }
    } catch (e) {
      console.error('Error loading departments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setFormData({
      code: '',
      name: '',
      location: 'Cơ sở 1',
      description: '118 Lê Đình Lý, Thanh Khê, Đà Nẵng'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      code: dept.code,
      name: dept.name,
      location: dept.location || 'Cơ sở 1',
      description: dept.description || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      toast.warning('Vui lòng nhập Mã và Tên Khoa/Phòng');
      return;
    }

    try {
      if (editingDept && editingDept.id) {
        await apiPut(`/departments/${editingDept.id}`, formData);
        toast.success('Cập nhật thông tin Khoa/Phòng thành công!');
      } else {
        await apiPost('/departments', formData);
        toast.success('Thêm mới Khoa/Phòng thành công!');
      }
      setShowModal(false);
      loadDepartments();
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu Khoa/Phòng');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({
      title: 'Xóa đơn vị / khoa phòng',
      message: `Bạn có chắc muốn xóa đơn vị "${name}"?`,
      confirmLabel: 'Xóa đơn vị',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiDelete(`/departments/${id}`);
      loadDepartments();
      toast.success('Đã xóa đơn vị thành công!');
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa đơn vị');
    }
  };

  const filteredDepts = useMemo(() => {
    const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
    const dir = sortOrder === 'desc' ? -1 : 1;
    const list = departments.filter(
      (d) =>
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'code') cmp = collator.compare(a.code, b.code);
      else if (sortBy === 'name') cmp = collator.compare(a.name, b.name);
      else if (sortBy === 'location') cmp = collator.compare(a.location || '', b.location || '');
      else {
        const ca = a.assetBreakdown?.total ?? a._count?.assets ?? 0;
        const cb = b.assetBreakdown?.total ?? b._count?.assets ?? 0;
        cmp = ca - cb;
      }
      if (cmp !== 0) return cmp * dir;
      return collator.compare(a.code, b.code);
    });
  }, [departments, searchTerm, sortBy, sortOrder]);

  const handleSort = (field: 'code' | 'name' | 'location' | 'assets') => {
    if (sortBy === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder(field === 'assets' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: 'code' | 'name' | 'location' | 'assets') => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
    );
  };

  const cs1Count = departments.filter(d => d.location === 'Cơ sở 1').length;
  const cs2Count = departments.filter(d => d.location === 'Cơ sở 2').length;
  const totalAssets = departments.reduce((sum, d) => sum + (d.assetBreakdown?.total ?? d._count?.assets ?? 0), 0);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Cơ cấu tổ chức</span>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý 16 Khoa / Phòng CDC Đà Nẵng</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Danh mục các Khoa, Phòng và Đơn vị trực thuộc quản lý & sử dụng tài sản
          </p>
        </div>

        <button 
          onClick={handleOpenAdd}
          title="Thêm Khoa / Phòng mới"
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 rounded-md text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm ĐV</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{departments.length} Đơn vị</div>
            <div className="text-xs text-slate-500 font-medium">Toàn Trung tâm CDC</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{cs1Count} Cơ sở 1 | {cs2Count} Cơ sở 2</div>
            <div className="text-xs text-slate-500 font-medium">118 Lê Đình Lý & Bàn Thạch</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{totalAssets.toLocaleString('vi-VN')}</div>
            <div className="text-xs text-slate-500 font-medium">Tổng tài sản đang phân bổ</div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="space-y-3">
        <div className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên khoa phòng, mã đơn vị..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">Hiển thị {filteredDepts.length} đơn vị</span>
        </div>

        <DataTableShell
          title="Danh mục Khoa / Phòng"
          totalCount={filteredDepts.length}
          countLabel="đơn vị"
          density={density}
          onDensityChange={setDensity}
          loading={loading}
          isEmpty={filteredDepts.length === 0}
          emptyMessage="Không tìm thấy khoa phòng nào phù hợp."
        >
          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {!loading &&
              filteredDepts.map((item) => {
                const bd = item.assetBreakdown;
                const count = bd?.total ?? item._count?.assets ?? 0;
                return (
                  <div key={item.id} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                          {item.code}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.location === 'Cơ sở 2'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                              : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                          }`}
                        >
                          {item.location}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/assets?departmentId=${item.id}`)}
                        className="shrink-0 inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-md font-semibold text-xs tabular-nums cursor-pointer"
                      >
                        <span>{count.toLocaleString('vi-VN')} TS</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="font-heading text-sm font-semibold text-slate-900 leading-snug">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-xs text-slate-500 leading-snug">{item.description}</div>
                    )}

                    {bd && count > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] tabular-nums">
                        {bd.duoc > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Dược: {bd.duoc}
                          </span>
                        )}
                        {bd.cntt > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            CNTT: {bd.cntt}
                          </span>
                        )}
                        {bd.tchcHc > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                            HC: {bd.tchcHc}
                          </span>
                        )}
                        {bd.tchcMe > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                            M&amp;E: {bd.tchcMe}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Sửa thông tin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.name)}
                        className="min-h-[38px] px-3 py-1.5 rounded-md border border-rose-200 bg-rose-50/70 text-rose-700 text-xs font-medium cursor-pointer"
                        title="Xóa khoa phòng"
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
              <thead className="text-[11px] text-slate-600 uppercase tracking-wider bg-slate-50/90 border-b border-slate-200 font-heading font-semibold">
                <tr>
                  <th className={`${headPy} px-4 w-28 whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('code')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Mã ĐV</span>
                      {renderSortIcon('code')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 min-w-[220px] whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Tên Khoa / Phòng</span>
                      {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 min-w-[200px] whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('location')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Cơ sở &amp; Địa chỉ</span>
                      {renderSortIcon('location')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 text-right min-w-[240px] whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('assets')}
                      className="inline-flex items-center gap-1 ml-auto hover:text-slate-900 cursor-pointer"
                    >
                      <span>Cơ cấu &amp; Tổng Tài sản</span>
                      {renderSortIcon('assets')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 text-right w-24 whitespace-nowrap`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  filteredDepts.map((item) => {
                    const bd = item.assetBreakdown;
                    const count = bd?.total ?? item._count?.assets ?? 0;
                    return (
                    <tr key={item.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className={`${cellPy} px-4 align-top whitespace-nowrap`}>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                          {item.code}
                        </span>
                      </td>
                      <td className={`${cellPy} px-4 align-top`}>
                        <div className="font-heading font-semibold text-slate-800 text-sm leading-snug">
                          {item.name}
                        </div>
                      </td>
                      <td className={`${cellPy} px-4 align-top max-w-[300px]`}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              item.location === 'Cơ sở 2'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                                : 'bg-blue-50 text-blue-700 border border-blue-200/70'
                            }`}
                          >
                            {item.location}
                          </span>
                        </div>
                        {item.description && (
                          <div className="mt-1 text-[11px] text-slate-500 leading-snug break-words">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className={`${cellPy} px-4 align-top text-right whitespace-nowrap`}>
                        <div className="inline-flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/assets?departmentId=${item.id}`)}
                            title={`Mở danh sách ${count} tài sản của ${item.name}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-md font-semibold text-xs tabular-nums transition cursor-pointer"
                          >
                            <span>{count.toLocaleString('vi-VN')} tài sản</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          {bd && count > 0 && (
                            <div className="flex flex-wrap items-center justify-end gap-1 text-[10px] tabular-nums">
                              {bd.duoc > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Dược: {bd.duoc}
                                </span>
                              )}
                              {bd.cntt > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  CNTT: {bd.cntt}
                                </span>
                              )}
                              {bd.tchcHc > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  HC: {bd.tchcHc}
                                </span>
                              )}
                              {bd.tchcMe > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-orange-50 text-orange-800 border border-orange-200">
                                  M&amp;E: {bd.tchcMe}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={`${cellPy} px-4 align-top text-right whitespace-nowrap`}>
                        <RowActionMenu
                          primary={{
                            label: 'Sửa',
                            title: 'Sửa thông tin',
                            icon: <Edit className="w-3.5 h-3.5" />,
                            onClick: () => handleOpenEdit(item),
                            tone: 'blue',
                          }}
                          items={[
                            {
                              label: `Xem ${count} tài sản của đơn vị`,
                              icon: <ExternalLink className="w-3.5 h-3.5" />,
                              onClick: () => navigate(`/assets?departmentId=${item.id}`),
                            },
                            {
                              label: 'Xóa khoa phòng',
                              icon: <Trash2 className="w-3.5 h-3.5" />,
                              onClick: () => handleDelete(item.id, item.name),
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
      </div>

      {/* Modal Thêm / Sửa Khoa Phòng */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-lg text-slate-900">
              {editingDept ? 'Chỉnh sửa Khoa / Phòng' : 'Thêm mới Khoa / Phòng'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mã Khoa / Phòng (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: PKDK, XN, DVTYT, TCHC..."
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Tên đầy đủ Khoa / Phòng (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khoa Xét Nghiệm - CĐHA - TDCN..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Địa điểm (Cơ sở)</label>
                <select
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Cơ sở 1">Cơ sở 1 (118 Lê Đình Lý)</option>
                  <option value="Cơ sở 2">Cơ sở 2 (Bàn Thạch)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Địa chỉ chi tiết / Mô tả</label>
                <input
                  type="text"
                  placeholder="Địa chỉ cụ thể hoặc ghi chú..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow"
                >
                  {editingDept ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
