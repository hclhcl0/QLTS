import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Award,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  LogIn,
  Package,
  QrCode,
  Wrench,
  X,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const QUICK_BLOCKS = [
  {
    title: 'Quét mã QR',
    hint: 'Tra cứu tem',
    to: '/qr-scanner',
    bg: '/welcome/qr.jpg',
    icon: QrCode,
    scrim: 'from-slate-950/85 via-cyan-950/55 to-slate-900/45',
    ringHover: 'hover:ring-cyan-400/70 hover:shadow-cyan-500/30',
    iconGlow: 'bg-cyan-500/25 border-cyan-300/45 text-cyan-100',
    bar: 'bg-cyan-400',
  },
  {
    title: 'Báo hỏng',
    hint: 'Gửi sửa chữa',
    to: '/maintenance?quickReport=1',
    bg: '/welcome/repair.jpg',
    icon: Wrench,
    scrim: 'from-slate-950/85 via-amber-950/50 to-slate-900/45',
    ringHover: 'hover:ring-amber-400/70 hover:shadow-amber-500/30',
    iconGlow: 'bg-amber-500/25 border-amber-300/45 text-amber-100',
    bar: 'bg-amber-400',
  },
  {
    title: 'Tài sản',
    hint: 'Danh mục',
    to: '/assets',
    bg: '/welcome/assets.jpg',
    icon: Package,
    scrim: 'from-slate-950/85 via-emerald-950/50 to-slate-900/45',
    ringHover: 'hover:ring-emerald-400/70 hover:shadow-emerald-500/30',
    iconGlow: 'bg-emerald-500/25 border-emerald-300/45 text-emerald-100',
    bar: 'bg-emerald-400',
  },
  {
    title: 'Kiểm kê C53',
    hint: 'Kiểm đếm',
    to: '/inventory',
    bg: '/welcome/inventory.jpg',
    icon: ClipboardCheck,
    scrim: 'from-slate-950/85 via-teal-950/55 to-slate-900/45',
    ringHover: 'hover:ring-teal-400/70 hover:shadow-teal-500/30',
    iconGlow: 'bg-teal-500/25 border-teal-300/45 text-teal-100',
    bar: 'bg-teal-400',
  },
  {
    title: 'Kiểm định',
    hint: 'Bảo trì ĐK',
    to: '/calibration',
    bg: '/welcome/calibration.jpg',
    icon: Award,
    scrim: 'from-slate-950/85 via-sky-950/55 to-slate-900/45',
    ringHover: 'hover:ring-sky-400/70 hover:shadow-sky-500/30',
    iconGlow: 'bg-sky-500/25 border-sky-300/45 text-sky-100',
    bar: 'bg-sky-400',
  },
  {
    title: 'Tổng quan',
    hint: 'Bảng điều khiển',
    to: '/dashboard',
    bg: '/welcome/dashboard.jpg',
    icon: LayoutDashboard,
    scrim: 'from-slate-950/88 via-slate-900/60 to-cyan-950/45',
    ringHover: 'hover:ring-cyan-300/70 hover:shadow-slate-900/40',
    iconGlow: 'bg-white/20 border-white/40 text-white',
    bar: 'bg-cyan-300',
  },
];

export default function Welcome() {
  const { isAuthenticated } = useAuth();
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (installPromptEvent) {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice.catch(() => null);
      setInstallPromptEvent(null);
    } else {
      setShowInstallHelp(true);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#F4F7FA] text-slate-900 flex flex-col relative overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(60% 45% at 15% 10%, rgba(8, 145, 178, 0.09) 0%, transparent 70%), radial-gradient(50% 45% at 85% 90%, rgba(5, 150, 105, 0.08) 0%, transparent 70%), radial-gradient(rgba(148, 163, 184, 0.22) 1px, transparent 1px)',
        backgroundSize: '100% 100%, 100% 100%, 22px 22px',
      }}
    >
      {/* Floating Header */}
      <header className="relative z-10 w-full pt-4 sm:pt-5 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto bg-white/85 backdrop-blur-md border border-slate-200/85 rounded-xl px-3.5 sm:px-4 h-14 flex items-center justify-between gap-3 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.07)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center p-1 shrink-0">
              <img
                src="/cdc-logo.png"
                alt="CDC Đà Nẵng"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-heading text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight truncate">
                QLTS CDC Đà Nẵng
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Hệ thống Quản lý Tài sản</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstall}
              title="Cài đặt WebApp"
              aria-label="Cài đặt WebApp"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-600 shadow-2xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-gradient-to-r from-cyan-700 to-teal-700 hover:from-cyan-800 hover:to-teal-800 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-cyan-900/15 transition"
            >
              <LogIn className="w-4 h-4" />
              <span>{isAuthenticated ? 'Vào app' : 'Đăng nhập'}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Centered Quick Access Buttons */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-4xl space-y-5 sm:space-y-6">
          <div className="text-center space-y-1.5">
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Truy cập nhanh
            </h1>
            <div className="w-12 h-1 mx-auto rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
            {QUICK_BLOCKS.map((item) => {
              const Icon = item.icon;
              const href = isAuthenticated
                ? item.to
                : `/login?redirect=${encodeURIComponent(item.to)}`;

              return (
                <Link
                  key={item.title}
                  to={href}
                  className={`group relative overflow-hidden rounded-xl ring-1 ring-slate-900/10 min-h-[150px] sm:min-h-[186px] p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-[0_10px_26px_-8px_rgba(15,23,42,0.32)] hover:-translate-y-1 hover:shadow-[0_18px_36px_-10px_rgba(15,23,42,0.45)] ${item.ringHover} transition-all duration-200`}
                >
                  {/* Full-bleed Background Image */}
                  <img
                    src={item.bg}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-100 group-hover:scale-108 transition-transform duration-500 ease-out"
                  />

                  {/* Color-tinted dark gradient overlay for contrast & mood */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${item.scrim} transition-opacity duration-200 group-hover:opacity-90`}
                  />

                  {/* Inner subtle specular highlight border */}
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />

                  {/* Centered Icon + Text */}
                  <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl backdrop-blur-md border shadow-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${item.iconGlow}`}
                    >
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="font-heading text-[15px] sm:text-lg font-bold text-white tracking-tight drop-shadow-xs">
                        {item.title}
                      </div>
                      <div className="text-[11px] sm:text-xs font-medium text-white/80">
                        {item.hint}
                      </div>
                    </div>

                    <span
                      className={`h-0.5 w-7 group-hover:w-14 rounded-full transition-all duration-300 opacity-85 ${item.bar}`}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {showInstallHelp && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowInstallHelp(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="font-heading text-sm font-semibold text-slate-900">
                Cài đặt WebApp lên thiết bị
              </span>
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <strong className="text-slate-900 block mb-0.5">iPhone / iPad (Safari):</strong>
                Bấm <strong>Chia sẻ (Share)</strong> → <strong>Thêm vào Màn hình chính</strong>.
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <strong className="text-slate-900 block mb-0.5">Android / PC (Chrome / Edge):</strong>
                Menu <strong>⋮</strong> → <strong>Cài đặt ứng dụng / Thêm vào màn hình chính</strong>.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
