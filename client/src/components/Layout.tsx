import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { useToast } from './ui/Toast';
import StatusBadge from './ui/StatusBadge';
import { Asset, TCHC_GROUP_META } from '../types';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Wrench,
  ClipboardCheck,
  Trash2,
  TrendingDown,
  QrCode,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
  Activity,
  Award,
  KeyRound,
  CalendarClock,
  ShieldCheck,
  Stethoscope,
  Monitor,
  UserCheck,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Loader2,
  CornerDownLeft,
  Download,
  Smartphone,
  Settings,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ROUTE_TITLES: { match: (path: string) => boolean; group: string; label: string }[] = [
  { match: (p) => p === '/', group: 'Tổng quan', label: 'Bảng điều khiển' },
  { match: (p) => p === '/assets', group: 'Tài sản', label: 'Danh mục tài sản' },
  { match: (p) => p === '/assets/new', group: 'Tài sản', label: 'Thêm mới thiết bị' },
  { match: (p) => /^\/assets\/[^/]+\/edit$/.test(p), group: 'Tài sản', label: 'Cập nhật thiết bị' },
  { match: (p) => /^\/assets\/[^/]+$/.test(p), group: 'Tài sản', label: 'Hồ sơ chi tiết thiết bị' },
  { match: (p) => /^\/qr\/[^/]+$/.test(p), group: 'Tài sản', label: 'Tra cứu thiết bị qua QR' },
  { match: (p) => p === '/transfers', group: 'Vận hành & Bảo trì', label: 'Điều chuyển tài sản' },
  { match: (p) => p === '/maintenance', group: 'Vận hành & Bảo trì', label: 'Báo hỏng / Sửa chữa' },
  { match: (p) => p === '/planned-maintenance', group: 'Vận hành & Bảo trì', label: 'Bảo trì kế hoạch' },
  { match: (p) => p === '/calibration', group: 'Vận hành & Bảo trì', label: 'Hiệu chuẩn / Kiểm định' },
  { match: (p) => p === '/inventory', group: 'Kiểm soát & Tài chính', label: 'Kiểm kê tài sản' },
  { match: (p) => p === '/depreciation', group: 'Kiểm soát & Tài chính', label: 'Khấu hao & Hao mòn' },
  { match: (p) => p === '/disposals', group: 'Kiểm soát & Tài chính', label: 'Thanh lý tài sản' },
  { match: (p) => p === '/qr-scanner', group: 'Kiểm soát & Tài chính', label: 'Quét mã QR' },
  { match: (p) => p === '/departments', group: 'Hệ thống', label: 'Khoa phòng / Đơn vị' },
  { match: (p) => p === '/users', group: 'Hệ thống', label: 'Quản lý tài khoản' },
  { match: (p) => p === '/settings', group: 'Hệ thống', label: 'Cài đặt & Telegram' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('qlts_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  // Global Ctrl+K Search Modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const [quickScope, setQuickScope] = useState<'ALL' | 'DUOC' | 'CNTT' | 'TCHC_HC' | 'TCHC_ME' | 'NHA_DAT'>('ALL');
  const [quickResults, setQuickResults] = useState<Asset[]>([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  // PWA Install Prompt state
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    );
  });
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
      setShowInstallHelp(false);
      toast.success('Đã cài đặt WebApp QLTS CDC Đà Nẵng!');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [toast]);

  const handleInstallWebApp = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } else {
      setShowInstallHelp(true);
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('qlts_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Global keyboard shortcut (Ctrl+K / Cmd+K & Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        if (showPasswordModal) setShowPasswordModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen, showPasswordModal]);

  useEffect(() => {
    if (searchOpen) {
      window.setTimeout(() => quickInputRef.current?.focus(), 20);
      setActiveIndex(0);
    } else {
      setQuickQuery('');
      setQuickResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const trimmed = quickQuery.trim();
    if (!trimmed && quickScope === 'ALL') {
      setQuickResults([]);
      setQuickLoading(false);
      return;
    }

    let cancelled = false;
    setQuickLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '10' });
        if (trimmed) params.set('search', trimmed);
        if (quickScope === 'DUOC') {
          params.set('managingUnit', 'DUOC');
        } else if (quickScope === 'CNTT') {
          params.set('managingUnit', 'CNTT');
        } else if (quickScope === 'TCHC_HC') {
          params.set('managingUnit', 'TCHC');
          params.set('buildingAsset', 'false');
        } else if (quickScope === 'TCHC_ME') {
          params.set('managingUnit', 'TCHC');
          params.set('buildingAsset', 'true');
        } else if (quickScope === 'NHA_DAT') {
          params.set('managingUnit', 'TCHC');
          params.set('assetGroup', 'NHA_DAT');
        }
        const res = (await apiGet(
          `/assets?${params.toString()}`
        )) as { assets: Asset[] };
        if (!cancelled) {
          setQuickResults(res.assets || []);
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) setQuickResults([]);
      } finally {
        if (!cancelled) setQuickLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quickQuery, quickScope, searchOpen]);

  const handleOpenAsset = useCallback(
    (asset: Asset) => {
      setSearchOpen(false);
      navigate(`/assets/${asset.id}`);
    },
    [navigate]
  );

  const handleSearchModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (quickResults.length ? (prev + 1) % quickResults.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        quickResults.length ? (prev - 1 + quickResults.length) % quickResults.length : 0
      );
    } else if (e.key === 'Enter' && quickResults[activeIndex]) {
      e.preventDefault();
      handleOpenAsset(quickResults[activeIndex]);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword !== confirmPassword) {
      setPwError('Mật khẩu mới và Xác nhận mật khẩu không trùng khớp!');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('Mật khẩu mới phải có tối thiểu 6 ký tự!');
      return;
    }

    setPwLoading(true);
    try {
      await apiPost('/auth/change-password', { oldPassword, newPassword });
      toast.success('Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.');
      setShowPasswordModal(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Lỗi khi đổi mật khẩu');
    } finally {
      setPwLoading(false);
    }
  };

  const roleMeta = useMemo(() => {
    switch (user?.role) {
      case 'ADMIN':
        return {
          label: 'Quản trị Hệ thống',
          Icon: ShieldCheck,
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
        };
      case 'MANAGER_DUOC':
        return {
          label: 'Khoa Dược (TBYT)',
          Icon: Stethoscope,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        };
      case 'MANAGER_CNTT':
        return {
          label: 'Tổ CNTT (IT)',
          Icon: Monitor,
          badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
        };
      case 'MANAGER_TCHC':
        return {
          label: 'Phòng TCHC',
          Icon: Building2,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
        };
      case 'DEPARTMENT':
        return {
          label: user.department?.name || 'Cán bộ Khoa/Phòng',
          Icon: UserCheck,
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
        };
      case 'VIEWER':
        return {
          label: 'Chỉ xem toàn viện',
          Icon: ShieldCheck,
          badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        };
      default:
        return {
          label: user?.role || 'Nhân viên',
          Icon: UserCheck,
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  }, [user]);

  const navGroups: NavGroup[] = useMemo(() => {
    const canCalibrate =
      user?.role === 'ADMIN' ||
      user?.role === 'VIEWER' ||
      user?.role === 'MANAGER_DUOC' ||
      user?.role === 'DEPARTMENT';

    const operationsItems: NavItem[] = [
      { to: '/transfers', label: 'Điều chuyển tài sản', icon: ArrowLeftRight },
      { to: '/maintenance', label: 'Báo hỏng / Sửa chữa', icon: Wrench },
    ];
    if (canCalibrate) {
      operationsItems.push({ to: '/planned-maintenance', label: 'Bảo trì kế hoạch', icon: CalendarClock });
      operationsItems.push({ to: '/calibration', label: 'Hiệu chuẩn / Kiểm định', icon: Award });
    }

    const groups: NavGroup[] = [
      {
        title: 'Tổng quan',
        items: [
          { to: '/', label: 'Bảng điều khiển', icon: LayoutDashboard },
          { to: '/assets', label: 'Danh mục tài sản', icon: Package },
        ],
      },
      {
        title: 'Vận hành & Bảo trì',
        items: operationsItems,
      },
      {
        title: 'Kiểm soát & Tài chính',
        items: [
          { to: '/inventory', label: 'Kiểm kê tài sản', icon: ClipboardCheck },
          { to: '/depreciation', label: 'Khấu hao & Hao mòn', icon: TrendingDown },
          { to: '/disposals', label: 'Thanh lý tài sản', icon: Trash2 },
          { to: '/qr-scanner', label: 'Quét mã QR', icon: QrCode },
        ],
      },
    ];

    if (user?.role === 'ADMIN') {
      groups.push({
        title: 'Hệ thống',
        items: [
          { to: '/departments', label: 'Khoa phòng / Đơn vị', icon: Building2 },
          { to: '/users', label: 'Quản lý tài khoản', icon: Users },
          { to: '/settings', label: 'Cài đặt & Telegram', icon: Settings },
        ],
      });
    }

    return groups;
  }, [user?.role]);

  const activeRouteMeta = useMemo(() => {
    return (
      ROUTE_TITLES.find((item) => item.match(location.pathname)) || {
        group: 'Hệ thống',
        label: 'Trang quản lý',
      }
    );
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const RoleIcon = roleMeta.Icon;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="print-hidden fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`print-hidden fixed inset-y-0 left-0 z-50 bg-[#0F172A] text-slate-200 flex flex-col border-r border-slate-800/80 transition-all duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[70px] w-64' : 'w-64'}`}
      >
        {/* Brand Logo Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800/80 shrink-0">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'lg:mx-auto' : ''}`}
          >
            <img
              src="/cdc-logo.png"
              alt="Logo CDC Đà Nẵng"
              className="w-9 h-9 rounded-xl object-contain shadow-sm shrink-0"
            />
            <div className={collapsed ? 'lg:hidden' : ''}>
              <h1 className="font-heading text-[15px] font-semibold leading-tight text-white tracking-tight truncate">
                QLTS CDC
              </h1>
              <p className="text-[11px] text-slate-400 truncate">Đà Nẵng · Y tế & Thiết bị</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng menu"
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav aria-label="Menu điều hướng chính" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-400/90">
                  {group.title}
                </div>
              )}
              {collapsed && <div className="hidden lg:block h-px bg-slate-800/80 mx-2 mb-2" />}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.to === '/'
                      ? location.pathname === '/'
                      : location.pathname === item.to || location.pathname.startsWith(item.to + '/');

                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setSidebarOpen(false)}
                      className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                        collapsed ? 'lg:justify-center lg:px-0' : ''
                      } ${
                        isActive
                          ? 'bg-blue-600/90 text-white shadow-xs'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile & Collapse Control */}
        <div className="p-2.5 border-t border-slate-800/80 shrink-0 space-y-1.5">
          {/* Desktop Collapse Button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Mở rộng menu bên' : 'Thu gọn menu bên'}
            className={`hidden lg:flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Thu gọn thanh bên</span>
              </>
            )}
          </button>

          {/* Compact User Card */}
          <div
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-800/50 border border-slate-800 ${
              collapsed ? 'lg:justify-center lg:px-1.5' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 flex items-center justify-center shrink-0">
              <RoleIcon className="w-4 h-4" />
            </div>
            <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="text-[13px] font-medium text-white truncate">
                {user?.fullName || 'Người dùng'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{roleMeta.label}</p>
            </div>
          </div>

          <div className={`flex gap-1.5 ${collapsed ? 'lg:flex-col' : ''}`}>
            <button
              type="button"
              onClick={() => setShowPasswordModal(true)}
              title="Đổi mật khẩu"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>Đổi MK</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất"
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-medium text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 rounded-xl transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>Thoát</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Utility Bar */}
        <header className="print-hidden sticky top-0 z-30 h-14 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở menu điều hướng"
              className="lg:hidden -ml-1.5 w-11 h-11 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <img
              src="/cdc-logo.png"
              alt="CDC"
              className="w-6 h-6 rounded-md object-contain lg:hidden shrink-0"
            />

            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-[13px] min-w-0">
              <Link
                to="/"
                className="text-slate-400 hover:text-slate-700 font-medium hidden sm:inline truncate"
              >
                CDC Đà Nẵng
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
              <span className="text-slate-400 hidden md:inline truncate">{activeRouteMeta.group}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden md:inline shrink-0" />
              <span className="font-heading font-semibold text-slate-800 truncate">
                {activeRouteMeta.label}
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/90 text-slate-500 text-xs transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Tìm nhanh tài sản...</span>
              <span className="sm:hidden">Tìm kiếm</span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded-md">
                Ctrl K
              </kbd>
            </button>

            {/* Quick Breakdown Report Button */}
            {user?.role !== 'VIEWER' && (
              <button
                type="button"
                onClick={() => navigate('/maintenance?quickReport=1')}
                title="Mở nhanh phiếu báo hỏng thiết bị (kèm UltraViewer / ảnh sự cố)"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">Báo hỏng</span>
                <span className="hidden sm:inline">Báo hỏng nhanh</span>
              </button>
            )}

            {/* Quick QR Scan */}
            <Link
              to="/qr-scanner"
              title="Quét mã QR tài sản"
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            >
              <QrCode className="w-4 h-4" />
            </Link>

            {/* Install PWA WebApp Button */}
            {!isStandalone && (
              <button
                type="button"
                onClick={handleInstallWebApp}
                title="Cài đặt WebApp lên màn hình chính / máy tính"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  installPromptEvent
                    ? 'border-[#024383]/30 bg-[#024383] text-white hover:bg-[#02366b] shadow-xs'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cài WebApp</span>
              </button>
            )}

            {/* Role Pill (desktop) */}
            <span
              className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleMeta.badgeClass}`}
            >
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="max-w-[170px] truncate">{roleMeta.label}</span>
            </span>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Global Ctrl+K Quick Search Modal */}
      {searchOpen && (
        <div
          className="print-hidden fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] p-4 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tìm kiếm nhanh tài sản"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleSearchModalKeyDown}
            className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="border-b border-slate-100">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                <input
                  ref={quickInputRef}
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Siêu tìm kiếm 14 trường: Tên, Mã, Khoa, Tầng, Người SD hoặc tầng:3 nhóm:hvac..."
                  className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent"
                />
                {quickQuery && (
                  <button
                    type="button"
                    onClick={() => setQuickQuery('')}
                    className="text-[11px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
                {quickLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />}
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
                >
                  Esc
                </button>
              </div>
              <div className="px-4 pb-2.5 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {([
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'DUOC', label: 'TBYT Dược' },
                    { id: 'CNTT', label: 'Tổ CNTT' },
                    { id: 'TCHC_HC', label: 'TCHC Nội thất' },
                    { id: 'TCHC_ME', label: 'TCHC Cơ điện' },
                    { id: 'NHA_DAT', label: 'Nhà đất' },
                  ] as const).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setQuickScope(sc.id)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                        quickScope === sc.id
                          ? 'bg-blue-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {['tầng:3', 'nhóm:hvac', 'nhóm:noithat', 'khoa:xn', 'giá:>10tr'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setQuickQuery((prev) =>
                          prev.toLowerCase().includes(tag)
                            ? prev.split(/\s+/).filter((t) => t.toLowerCase() !== tag).join(' ')
                            : prev
                            ? `${prev} ${tag}`
                            : tag
                        )
                      }
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] border transition cursor-pointer ${
                        quickQuery.toLowerCase().includes(tag)
                          ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {!quickQuery.trim() && quickScope === 'ALL' ? (
                <div className="p-2 space-y-1">
                  <p className="px-2.5 py-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-400">
                    Truy cập nhanh
                  </p>
                  {[
                    { label: 'Danh mục tài sản toàn viện', to: '/assets', icon: Package },
                    { label: 'Báo hỏng / Sửa chữa thiết bị', to: '/maintenance', icon: Wrench },
                    { label: 'Quét mã QR kiểm tra nhanh', to: '/qr-scanner', icon: QrCode },
                    { label: 'Khấu hao & Hao mòn tài sản', to: '/depreciation', icon: TrendingDown },
                    ...(user?.role === 'ADMIN'
                      ? [{ label: 'Cài đặt cảnh báo Telegram', to: '/settings', icon: Settings }]
                      : []),
                  ].map((shortcut) => {
                    const SIcon = shortcut.icon;
                    return (
                      <button
                        key={shortcut.to}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate(shortcut.to);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <SIcon className="w-4 h-4 text-slate-400" />
                          <span>{shortcut.label}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              ) : quickResults.length === 0 && !quickLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Không tìm thấy thiết bị khớp từ khóa "{quickQuery}".
                </div>
              ) : (
                <div className="space-y-1">
                  {quickResults.map((asset, idx) => (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenAsset(asset)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenAsset(asset);
                        }
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                        idx === activeIndex ? 'bg-blue-50/80 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {asset.assetCode}
                          </span>
                          {asset.assetGroup && TCHC_GROUP_META[asset.assetGroup] && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${TCHC_GROUP_META[asset.assetGroup].badgeClass}`}
                            >
                              {TCHC_GROUP_META[asset.assetGroup].label}
                            </span>
                          )}
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {asset.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {[
                            asset.department?.name || 'Chưa phân bổ',
                            asset.floor,
                            asset.location || 'Cơ sở 1',
                            asset.assignedTo ? `SD: ${asset.assignedTo}` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(asset as { originalPrice?: number | null }).originalPrice != null &&
                          Number((asset as { originalPrice?: number | null }).originalPrice) > 0 && (
                            <span className="hidden sm:inline text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/70">
                              {Number((asset as { originalPrice?: number | null }).originalPrice).toLocaleString('vi-VN')} đ
                            </span>
                          )}
                        <StatusBadge status={asset.status} compact />
                        {user?.role !== 'VIEWER' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchOpen(false);
                              navigate(`/maintenance?assetId=${asset.id}`);
                            }}
                            title="Báo hỏng thiết bị này ngay"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition cursor-pointer"
                          >
                            <Wrench className="w-3 h-3" />
                            <span className="hidden sm:inline">Báo hỏng</span>
                          </button>
                        )}
                        <CornerDownLeft className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(quickQuery.trim() || quickScope !== 'ALL') && quickResults.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Dùng phím mũi tên ↑ ↓ và Enter để mở chi tiết</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(`/assets?search=${encodeURIComponent(quickQuery.trim())}`);
                  }}
                  className="text-blue-700 font-medium hover:underline cursor-pointer"
                >
                  Xem toàn bộ kết quả trong Danh mục →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {showPasswordModal && (
        <div
          className="print-hidden fixed inset-0 z-[85] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-pw-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 id="change-pw-title" className="font-heading text-base font-semibold text-slate-900">
                  Đổi Mật Khẩu Cá Nhân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                aria-label="Đóng"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pwError && (
              <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {pwError}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mật khẩu hiện tại *
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nhập mật khẩu cũ..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Mật khẩu mới (tối thiểu 6 ký tự) *
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nhập mật khẩu mới..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Nhập lại mật khẩu mới..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  {pwLoading ? 'Đang lưu...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Install Guide Modal */}
      {showInstallHelp && (
        <div
          className="print-hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowInstallHelp(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <img src="/cdc-logo.png" alt="Logo CDC Đà Nẵng" className="w-9 h-9 rounded-xl object-contain" />
                <div>
                  <h3 className="font-heading text-sm font-bold text-slate-900">
                    Cài đặt WebApp QLTS CDC Đà Nẵng
                  </h3>
                  <p className="text-[11px] text-slate-500">Chạy độc lập như ứng dụng trên điện thoại &amp; PC</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/70 space-y-1">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-700" />
                  Trên Máy tính (Chrome / Edge):
                </div>
                <p>
                  Nhấn biểu tượng <strong>Cài đặt (màn hình có mũi tên ↓)</strong> ở góc phải thanh địa chỉ, hoặc mở menu <strong>⋮ → Lưu và chia sẻ → Cài đặt trang làm ứng dụng</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="font-semibold text-slate-900">Trên iPhone / iPad (Safari):</div>
                <p>
                  Bấm nút <strong>Chia sẻ (⬆)</strong> ở thanh dưới cùng → chọn <strong>Thêm vào Màn hình chính</strong> → bấm <strong>Thêm</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="font-semibold text-slate-900">Trên Android (Chrome):</div>
                <p>
                  Bấm menu <strong>⋮</strong> góc trên phải → chọn <strong>Cài đặt ứng dụng / Thêm vào Màn hình chính</strong>.
                </p>
              </div>
              <p className="text-[11px] text-slate-500">
                Lưu ý: Trình duyệt yêu cầu truy cập bằng <strong>HTTPS</strong> (tên miền chính thức) hoặc <strong>localhost</strong> để kích hoạt cài đặt tự động 1 chạm.
              </p>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="px-4 py-1.5 rounded-xl bg-[#024383] hover:bg-[#02366b] text-white text-xs font-semibold cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
