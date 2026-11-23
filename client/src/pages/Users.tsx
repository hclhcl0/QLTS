import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users as UsersIcon, Plus, Search, KeyRound, Edit2, Trash2, 
  ShieldCheck, Building2, Lock, CheckCircle2, AlertTriangle, 
  Monitor, Stethoscope, Layers, RefreshCw, X, Eye, EyeOff,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/api';
import { User, Department } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import DataTableShell, { useTablePrefs } from '../components/ui/DataTableShell';
import RowActionMenu from '../components/ui/RowActionMenu';

export default function Users() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'username' | 'fullName' | 'role' | 'dept'>('role');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [showUserModal, setShowUserModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // User Form State (Create / Edit)
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    role: 'DEPARTMENT',
    departmentId: ''
  });

  // Reset Password State
  const { density, setDensity, cellPy, headPy } = useTablePrefs('users');
  const [resetPassData, setResetPassData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPass, setShowPass] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, deptRes] = await Promise.allSettled([
        apiGet('/users'),
        apiGet('/departments')
      ]);

      if (userRes.status === 'fulfilled' && Array.isArray(userRes.value)) {
        setUsers(userRes.value);
      }
      if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value)) {
        setDepartments(deptRes.value);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      username: '',
      fullName: '',
      password: '',
      role: 'DEPARTMENT',
      departmentId: departments[0]?.id?.toString() || '1'
    });
    setShowUserModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      fullName: user.fullName,
      password: '',
      role: user.role,
      departmentId: user.departmentId ? user.departmentId.toString() : ''
    });
    setShowUserModal(true);
  };

  // Open Reset Password Modal
  const handleOpenReset = (user: User) => {
    setSelectedUser(user);
    setResetPassData({ newPassword: '', confirmPassword: '' });
    setShowResetModal(true);
  };

  // Submit Create or Edit User
  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.role) {
      toast.warning('Vui lòng điền đầy đủ họ tên và phân quyền!');
      return;
    }

    try {
      if (selectedUser) {
        // Edit User
        await apiPut(`/users/${selectedUser.id}`, {
          fullName: formData.fullName,
          role: formData.role,
          departmentId: formData.departmentId ? parseInt(formData.departmentId) : null,
          username: formData.username
        });
        toast.success(`Đã cập nhật thông tin tài khoản ${formData.username} thành công!`);
      } else {
        // Create User
        if (!formData.username || !formData.password) {
          toast.warning('Vui lòng nhập tên đăng nhập và mật khẩu khởi tạo!');
          return;
        }
        await apiPost('/users', {
          username: formData.username,
          password: formData.password,
          fullName: formData.fullName,
          role: formData.role,
          departmentId: formData.departmentId ? parseInt(formData.departmentId) : null
        });
        toast.success(`Đã tạo tài khoản ${formData.username} thành công!`);
      }

      setShowUserModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu thông tin người dùng');
    }
  };

  // Submit Reset Password
  const handleSubmitResetPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (resetPassData.newPassword.length < 6) {
      toast.warning('Mật khẩu mới phải có tối thiểu 6 ký tự!');
      return;
    }

    if (resetPassData.newPassword !== resetPassData.confirmPassword) {
      toast.warning('Xác nhận mật khẩu mới không trùng khớp!');
      return;
    }

    try {
      await apiPut(`/users/${selectedUser.id}/reset-password`, {
        newPassword: resetPassData.newPassword
      });
      toast.success(`Đã đặt lại mật khẩu cho tài khoản ${selectedUser.username} thành công!`);
      setShowResetModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đặt lại mật khẩu');
    }
  };

  // Delete User
  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.warning('Bạn không thể tự xóa tài khoản của chính mình!');
      return;
    }

    if (user.username === 'admin') {
      toast.warning('Không được phép xóa tài khoản Admin hệ thống!');
      return;
    }

    const ok = await confirm({
      title: 'Xóa tài khoản người dùng',
      message: `Bạn có chắc chắn muốn xóa tài khoản "${user.username}" (${user.fullName}) khỏi hệ thống?`,
      confirmLabel: 'Xóa tài khoản',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }

    try {
      await apiDelete(`/users/${user.id}`);
      toast.success(`Đã xóa tài khoản ${user.username} thành công!`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi xóa người dùng');
    }
  };

  // Filter & Sort users
  const filteredUsers = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const roleRank: Record<string, number> = {
      ADMIN: 1,
      MANAGER_DUOC: 2,
      MANAGER_CNTT: 3,
      MANAGER_TCHC: 4,
      DEPARTMENT: 5,
      VIEWER: 6,
    };
    const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

    const list = users.filter((u) => {
      if (roleFilter === 'MANAGERS') {
        if (!u.role.startsWith('MANAGER_')) return false;
      } else if (roleFilter !== 'ALL' && u.role !== roleFilter) {
        return false;
      }
      if (deptFilter !== 'ALL' && u.departmentId?.toString() !== deptFilter) return false;
      if (tokens.length === 0) return true;
      const blob = [
        u.username,
        u.fullName,
        u.role,
        u.department?.code,
        u.department?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => blob.includes(tok));
    });

    const dir = sortOrder === 'desc' ? -1 : 1;
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'username') cmp = collator.compare(a.username, b.username);
      else if (sortBy === 'fullName') cmp = collator.compare(a.fullName, b.fullName);
      else if (sortBy === 'dept') {
        cmp = collator.compare(a.department?.name || 'AAA', b.department?.name || 'AAA');
      } else {
        cmp = (roleRank[a.role] || 9) - (roleRank[b.role] || 9);
      }
      if (cmp !== 0) return cmp * dir;
      return collator.compare(a.username, b.username);
    });
  }, [users, search, roleFilter, deptFilter, sortBy, sortOrder]);

  const handleSort = (field: 'username' | 'fullName' | 'role' | 'dept') => {
    if (sortBy === field) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: 'username' | 'fullName' | 'role' | 'dept') => {
    if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-700" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-700" />
    );
  };

  const getUserAssetsScopeUrl = (u: User): { url: string; label: string } => {
    if (u.role === 'ADMIN' || u.role === 'VIEWER') return { url: '/assets', label: 'Toàn bộ danh mục TS' };
    if (u.role === 'MANAGER_DUOC') return { url: '/assets?managingUnit=DUOC', label: 'Khối TBYT (Dược)' };
    if (u.role === 'MANAGER_CNTT') return { url: '/assets?managingUnit=CNTT', label: 'Khối CNTT (IT)' };
    if (u.role === 'MANAGER_TCHC') return { url: '/assets?managingUnit=TCHC', label: 'Khối TCHC (HC & M&E)' };
    if (u.departmentId) {
      return {
        url: `/assets?departmentId=${u.departmentId}`,
        label: `TS ${u.department?.code || 'Khoa/Phòng'}`,
      };
    }
    return { url: '/assets', label: 'Danh mục TS' };
  };

  // Calculate statistics
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === 'ADMIN').length;
  const managerCount = users.filter(u => u.role.startsWith('MANAGER_')).length;
  const deptUserCount = users.filter(u => u.role === 'DEPARTMENT').length;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><ShieldCheck className="w-3.5 h-3.5" /> Admin</span>;
      case 'MANAGER_DUOC':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Stethoscope className="w-3.5 h-3.5" /> Quản Lý Dược (TBYT)</span>;
      case 'MANAGER_CNTT':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Monitor className="w-3.5 h-3.5" /> Quản Lý Tổ CNTT</span>;
      case 'MANAGER_TCHC':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Building2 className="w-3.5 h-3.5" /> Quản Lý Phòng TCHC</span>;
      case 'DEPARTMENT':
        return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Layers className="w-3.5 h-3.5" /> Khoa / Phòng</span>;
      case 'VIEWER':
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Eye className="w-3.5 h-3.5" /> Chỉ Xem (BGĐ/KT)</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-[11px] flex items-center gap-1 w-fit"><Layers className="w-3.5 h-3.5" /> {role}</span>;
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* 1. COMPACT HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Tài Khoản &amp; Phân Quyền
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
              RBAC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh sách tài khoản, phân quyền truy cập 6 vai trò và đặt lại mật khẩu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-md text-slate-700 transition cursor-pointer"
            title="Tải lại dữ liệu"
            aria-label="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            title="Thêm tài khoản người dùng mới"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm TK</span>
          </button>
        </div>
      </div>

      {/* 2. UNIFIED ROLE PILL BAR & FILTERS */}
      <div className="space-y-3">
        <div className="p-3.5 bg-white rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-slate-100">
            {[
              { key: 'ALL', label: 'Tất cả', count: totalUsers, activeCls: 'bg-slate-900 text-white' },
              { key: 'ADMIN', label: 'Admin', count: adminCount, activeCls: 'bg-rose-600 text-white' },
              { key: 'MANAGERS', label: 'Quản lý khối', count: managerCount, activeCls: 'bg-blue-700 text-white' },
              { key: 'DEPARTMENT', label: 'Khoa / Phòng', count: deptUserCount, activeCls: 'bg-purple-700 text-white' },
            ].map((pill) => {
              const active = roleFilter === pill.key;
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setRoleFilter(active && pill.key !== 'ALL' ? 'ALL' : pill.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition cursor-pointer ${
                    active
                      ? `${pill.activeCls} shadow-2xs font-semibold`
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">Vai trò / Quyền hạn (Tất cả)</option>
                <option value="ADMIN">Admin</option>
                <option value="MANAGERS">Quản lý chuyên trách (3 khối)</option>
                <option value="MANAGER_DUOC">Quản Lý TBYT - Khoa Dược</option>
                <option value="MANAGER_CNTT">Quản Lý Thiết Bị - Tổ CNTT</option>
                <option value="MANAGER_TCHC">Quản Lý CSVC - Phòng TCHC</option>
                <option value="DEPARTMENT">Người Dùng Khoa / Phòng</option>
                <option value="VIEWER">Chỉ Xem Toàn Viện (BGĐ / Kế toán)</option>
              </select>

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="ALL">Khoa / Phòng (Tất cả)</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo username, họ tên, khoa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none w-60 sm:w-72"
              />
            </div>
          </div>
        </div>

        {/* User Table */}
        <DataTableShell
          title="Danh sách tài khoản người dùng"
          totalCount={filteredUsers.length}
          countLabel="tài khoản"
          density={density}
          onDensityChange={setDensity}
          loading={loading}
          isEmpty={filteredUsers.length === 0}
          emptyMessage="Không tìm thấy tài khoản người dùng nào phù hợp."
        >
          {/* Mobile Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {!loading &&
              filteredUsers.map((u) => {
                const scopeInfo = getUserAssetsScopeUrl(u);
                const canDelete = !(u.id === currentUser?.id || u.username === 'admin');
                return (
                  <div key={u.id} className="p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-heading text-sm font-semibold text-slate-900">
                          {u.fullName}
                        </div>
                        <span className="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                          @{u.username}
                        </span>
                      </div>
                      <div className="shrink-0">{getRoleBadge(u.role)}</div>
                    </div>

                    <div className="text-xs text-slate-600">
                      {u.department ? `${u.department.code} - ${u.department.name}` : 'Toàn cơ quan CDC Đà Nẵng'}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReset(u)}
                        className="min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-800 text-xs font-medium cursor-pointer"
                        title="Đặt lại mật khẩu"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Đổi MK</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(scopeInfo.url)}
                        className="min-h-[38px] px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                        title={`Xem ${scopeInfo.label}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          className="min-h-[38px] px-3 py-1.5 rounded-md border border-rose-200 bg-rose-50/70 text-rose-700 text-xs font-medium cursor-pointer"
                          title="Xóa tài khoản"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 font-heading font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className={`${headPy} px-4 min-w-[220px] whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSort('fullName')}
                        className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                      >
                        <span>Họ tên</span>
                        {renderSortIcon('fullName')}
                      </button>
                      <span className="text-slate-300">·</span>
                      <button
                        type="button"
                        onClick={() => handleSort('username')}
                        className="inline-flex items-center gap-1 hover:text-blue-700 cursor-pointer"
                      >
                        <span>Username</span>
                        {renderSortIcon('username')}
                      </button>
                    </div>
                  </th>
                  <th className={`${headPy} px-4 whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('role')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Phân quyền / Vai trò</span>
                      {renderSortIcon('role')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 min-w-[180px] whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => handleSort('dept')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Khoa / Phòng &amp; Phạm vi TS</span>
                      {renderSortIcon('dept')}
                    </button>
                  </th>
                  <th className={`${headPy} px-4 w-28 text-right whitespace-nowrap`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading &&
                  filteredUsers.map((u) => {
                    const scopeInfo = getUserAssetsScopeUrl(u);
                    return (
                    <tr key={u.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className={`${cellPy} px-4 align-top`}>
                        <div className="font-heading font-semibold text-slate-800 text-sm leading-snug">
                          {u.fullName}
                        </div>
                        <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200/70 font-mono text-[11px] font-medium text-blue-700">
                          @{u.username}
                        </span>
                      </td>
                      <td className={`${cellPy} px-4 align-top whitespace-nowrap`}>
                        {getRoleBadge(u.role)}
                      </td>
                      <td className={`${cellPy} px-4 align-top font-medium text-slate-700`}>
                        <div>
                          {u.department ? (
                            `${u.department.code} - ${u.department.name}`
                          ) : (
                            <span className="text-slate-500">Toàn cơ quan CDC Đà Nẵng</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(scopeInfo.url)}
                          className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 text-[11px] font-medium transition cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Xem {scopeInfo.label}</span>
                        </button>
                      </td>
                      <td className={`${cellPy} px-4 align-top text-right whitespace-nowrap`}>
                        <RowActionMenu
                          primary={{
                            label: 'Sửa',
                            title: 'Chỉnh sửa thông tin & phân quyền',
                            icon: <Edit2 className="w-3.5 h-3.5" />,
                            onClick: () => handleOpenEdit(u),
                            tone: 'blue',
                          }}
                          items={[
                            {
                              label: `Mở danh mục (${scopeInfo.label})`,
                              icon: <ExternalLink className="w-3.5 h-3.5" />,
                              onClick: () => navigate(scopeInfo.url),
                            },
                            {
                              label: 'Đặt lại mật khẩu',
                              icon: <KeyRound className="w-3.5 h-3.5" />,
                              onClick: () => handleOpenReset(u),
                            },
                            {
                              label: 'Xóa tài khoản',
                              icon: <Trash2 className="w-3.5 h-3.5" />,
                              onClick: () => handleDeleteUser(u),
                              danger: true,
                              hidden: u.id === currentUser?.id || u.username === 'admin',
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

        {/* RBAC Security & Role Matrix Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Ma trận Phân quyền &amp; Bảo mật JWT chuẩn Production</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Xác thực bắt buộc qua JWT Bearer Token (bcrypt mật khẩu thật, tự động chặn 401/403 nếu thiếu token hoặc thao tác vượt phạm vi).
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đã khóa bảo mật API
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2 px-3">Vai trò</th>
                  <th className="py-2 px-3">Phạm vi dữ liệu</th>
                  <th className="py-2 px-3">Quản lý Tài sản / Khấu hao</th>
                  <th className="py-2 px-3">Báo hỏng / Kiểm kê</th>
                  <th className="py-2 px-3">Duyệt Thanh lý / Điều chuyển / Quản trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-2 px-3 font-bold text-rose-700">ADMIN</td>
                  <td className="py-2 px-3">Toàn viện CDC</td>
                  <td className="py-2 px-3">Toàn quyền Thêm / Sửa / Xóa</td>
                  <td className="py-2 px-3">Xử lý, kiểm kê, in tem QR toàn viện</td>
                  <td className="py-2 px-3">Duyệt hồ sơ + Quản trị User, Khoa, Telegram</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-emerald-700">MANAGER_DUOC</td>
                  <td className="py-2 px-3">Khối Dược (TBYT)</td>
                  <td className="py-2 px-3">Quản lý TBYT + Hiệu chuẩn + BTKH</td>
                  <td className="py-2 px-3">Tiếp nhận sửa, kiểm kê khối Dược</td>
                  <td className="py-2 px-3">Giám định kỹ thuật thanh lý khối Dược</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-blue-700">MANAGER_CNTT</td>
                  <td className="py-2 px-3">Khối CNTT (IT)</td>
                  <td className="py-2 px-3">Quản lý thiết bị CNTT &amp; đồng bộ IT</td>
                  <td className="py-2 px-3">Tiếp nhận sửa, kiểm kê khối CNTT</td>
                  <td className="py-2 px-3">Giám định kỹ thuật thanh lý khối CNTT</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-amber-700">MANAGER_TCHC</td>
                  <td className="py-2 px-3">Khối TCHC (HC &amp; M&amp;E)</td>
                  <td className="py-2 px-3">Quản lý nội thất, xe &amp; hạ tầng</td>
                  <td className="py-2 px-3">Tiếp nhận sửa, kiểm kê khối TCHC</td>
                  <td className="py-2 px-3">Giám định kỹ thuật thanh lý khối TCHC</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-purple-700">DEPARTMENT</td>
                  <td className="py-2 px-3">Đúng Khoa/Phòng được gán</td>
                  <td className="py-2 px-3">Chỉ xem (không thêm/sửa/xóa TS)</td>
                  <td className="py-2 px-3">Gửi báo hỏng, kiểm kê tại khoa, in tem</td>
                  <td className="py-2 px-3">Gửi đề xuất điều chuyển / thanh lý khoa mình</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-bold text-indigo-700">VIEWER</td>
                  <td className="py-2 px-3">Toàn viện CDC</td>
                  <td className="py-2 px-3">Chỉ xem toàn viện, xuất Excel/In A4</td>
                  <td className="py-2 px-3">Chỉ xem báo cáo &amp; tra cứu QR</td>
                  <td className="py-2 px-3">Không có quyền thêm / sửa / xóa / duyệt</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: THÊM MỚI / CHỈNH SỬA TÀI KHOẢN & PHÂN QUYỀN                      */}
      {/* ========================================================================= */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  {selectedUser ? `Chỉnh Sửa Tài Khoản: ${selectedUser.username}` : 'Thêm Tài Khoản Người Dùng Mới'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Thiết lập thông tin đăng nhập và phân quyền chuyên trách</p>
              </div>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmitUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Tên đăng nhập (*)</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(selectedUser)}
                    placeholder="vd: pkdk, manager_cntt..."
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {!selectedUser && (
                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Mật khẩu khởi tạo (*)</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: 123456"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Họ và tên / Tên đơn vị hiển thị (*)</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Phòng Khám Đa Khoa, Quản Lý Tổ CNTT, BS. Nguyễn Văn A..."
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Phân quyền vai trò (*)</label>
                <select
                  value={formData.role}
                  onChange={e => {
                    const r = e.target.value;
                    let defaultDeptId = formData.departmentId;
                    if (r === 'ADMIN') defaultDeptId = '';
                    setFormData({ ...formData, role: r, departmentId: defaultDeptId });
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="DEPARTMENT">Người Dùng Khoa / Phòng (Xem tài sản khoa, báo hỏng, kiểm kê, đề xuất thanh lý)</option>
                  <option value="MANAGER_CNTT">Quản Lý Tài Sản - Tổ CNTT (Chuyên trách thiết bị CNTT)</option>
                  <option value="MANAGER_DUOC">Quản Lý Tài Sản - Khoa Dược (Chuyên trách TBYT &amp; Hiệu chuẩn)</option>
                  <option value="MANAGER_TCHC">Quản Lý Tài Sản - Phòng TCHC (Chuyên trách CSVC &amp; Thiết bị Hành chính)</option>
                  <option value="VIEWER">Chỉ Xem Toàn Viện (Lãnh đạo / Kế toán / Kiểm tra)</option>
                  <option value="ADMIN">Admin (Toàn quyền hệ thống)</option>
                </select>
              </div>

              {formData.role === 'DEPARTMENT' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">Thuộc Khoa / Phòng (*)</label>
                  <select
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.code} - {d.name.replace(/\s*\((?:Cơ sở|Cs)\s*[12]\)/gi, '')}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Lưu Tài Khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADMIN ĐẶT LẠI MẬT KHẨU (RESET PASSWORD)                          */}
      {/* ========================================================================= */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Đặt Lại Mật Khẩu Người Dùng</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tài khoản: <strong>{selectedUser.username}</strong> ({selectedUser.fullName})</p>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSubmitResetPass} className="space-y-3.5 text-xs">
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
                <div>Quản trị viên đang thực hiện đặt lại mật khẩu cho người dùng này.</div>
                <div>Gợi ý nhanh: Bạn có thể bấm nút bên dưới để gán nhanh về <strong>123456</strong>.</div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Mật khẩu mới (*)</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    placeholder="Nhập tối thiểu 6 ký tự..."
                    value={resetPassData.newPassword}
                    onChange={e => setResetPassData({ ...resetPassData, newPassword: e.target.value })}
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Xác nhận mật khẩu mới (*)</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  placeholder="Nhập lại mật khẩu mới..."
                  value={resetPassData.confirmPassword}
                  onChange={e => setResetPassData({ ...resetPassData, confirmPassword: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setResetPassData({ newPassword: '123456', confirmPassword: '123456' })}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                >
                  Đặt về mật khẩu mặc định "123456"
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Xác Nhận Đặt Lại Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
