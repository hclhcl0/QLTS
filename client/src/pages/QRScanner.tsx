import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  CameraOff,
  ImagePlus,
  QrCode,
  RefreshCw,
  Search,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import { STATUS_COLORS, STATUS_LABELS } from '../types';

const READER_ELEMENT_ID = 'qlts-qr-reader';
const FILE_READER_ELEMENT_ID = 'qlts-qr-file-reader';

type CameraState = 'starting' | 'scanning' | 'idle' | 'matched' | 'error';

interface CameraOption {
  id: string;
  label: string;
}

function extractAssetCode(raw: string): string {
  let clean = raw.trim();
  if (!clean) return '';

  if (clean.includes('/qr/')) {
    clean = clean.split('/qr/').pop()?.split('?')[0]?.split('#')[0] || clean;
    try {
      clean = decodeURIComponent(clean);
    } catch {}
    return clean.trim();
  }

  const matchCodeLine = clean.match(/(?:^|\n)\s*(?:Ma TS|Mã TS)\s*:\s*([^\r\n]+)/i);
  if (matchCodeLine && matchCodeLine[1]) {
    return matchCodeLine[1].trim();
  }

  return clean;
}

export default function QRScanner() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [assetData, setAssetData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const startSeqRef = useRef(0);
  const busyStartingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(async () => {
    const instance = scannerRef.current;
    if (!instance) return;
    try {
      const state = instance.getState();
      // 2 = SCANNING, 3 = PAUSED in Html5QrcodeScannerState
      if (state === 2 || state === 3 || instance.isScanning) {
        await instance.stop();
      }
    } catch {
      // ignore if already stopped
    }
    try {
      instance.clear();
    } catch {
      // ignore cleanup error
    }
  }, []);

  const handleLookup = useCallback(async (rawCode: string) => {
    const clean = extractAssetCode(rawCode);
    if (!clean) return;

    setLoading(true);
    setError('');
    setAssetData(null);

    try {
      let res;
      try {
        res = await apiGet(`/assets/by-qr/${encodeURIComponent(clean)}`);
      } catch {
        res = await apiGet(`/assets/${encodeURIComponent(clean)}`);
      }

      if (res && res.id) {
        setAssetData(res);
      } else {
        setError(`Không tìm thấy thông tin cho mã: ${clean}`);
      }
    } catch {
      setError(`Không tìm thấy thiết bị "${clean}". Vui lòng kiểm tra lại mã.`);
    } finally {
      setLoading(false);
    }
  }, []);

  const startCamera = useCallback(
    async (preferredCameraId?: string) => {
      if (busyStartingRef.current || !mountedRef.current) return;
      const host = document.getElementById(READER_ELEMENT_ID);
      if (!host) return;

      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setCameraState('error');
        setCameraMessage('Trình duyệt yêu cầu kết nối HTTPS để bật camera. Hãy mở trang qua HTTPS hoặc dùng nút Quét từ ảnh / nhập mã bên dưới.');
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('error');
        setCameraMessage('Thiết bị hoặc trình duyệt không hỗ trợ camera trực tiếp. Bạn có thể chọn ảnh QR từ máy hoặc nhập mã thủ công.');
        return;
      }

      busyStartingRef.current = true;
      setCameraState('starting');
      setCameraMessage('');

      try {
        await stopCamera();
        if (!mountedRef.current) return;

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(READER_ELEMENT_ID, false);
        }
        const scanner = scannerRef.current;

        const scanConfig = {
          fps: 10,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minSide = Math.min(viewfinderWidth || 280, viewfinderHeight || 280);
            const size = Math.max(160, Math.min(260, Math.floor(minSide * 0.72)));
            return { width: size, height: size };
          },
        };

        const onDecoded = (decodedText: string) => {
          if (!mountedRef.current) return;
          setScanResult(decodedText);
          setCameraState('matched');
          void stopCamera();
          void handleLookup(decodedText);
        };

        // Enumerate devices first (safe fallback to facingMode if blocked before prompt)
        let detected: CameraOption[] = [];
        try {
          const list = await Html5Qrcode.getCameras();
          detected = (list || []).map((c, idx) => ({
            id: c.id,
            label: c.label || `Camera ${idx + 1}`,
          }));
          if (mountedRef.current && detected.length > 0) {
            setCameras(detected);
          }
        } catch {
          detected = [];
        }

        const chosenId =
          preferredCameraId ||
          selectedCameraId ||
          detected.find((c) => /back|rear|environment|sau|main/i.test(c.label))?.id ||
          '';

        if (chosenId && mountedRef.current) {
          setSelectedCameraId(chosenId);
        }

        const targets: Array<string | { facingMode: 'environment' | 'user' }> = [];
        if (chosenId) targets.push(chosenId);
        targets.push({ facingMode: 'environment' });
        targets.push({ facingMode: 'user' });

        let started = false;
        let lastErr: any = null;

        for (const target of targets) {
          if (!mountedRef.current) break;
          try {
            await scanner.start(target, scanConfig, onDecoded, () => {});
            started = true;
            break;
          } catch (err: any) {
            lastErr = err;
            const msg = String(err?.message || err || '');
            if (/NotAllowedError|Permission|denied/i.test(msg)) {
              break;
            }
          }
        }

        if (!mountedRef.current) {
          await stopCamera();
          return;
        }

        if (!started) {
          throw lastErr || new Error('Không khởi động được camera');
        }

        // Refresh camera labels after permission grant so switcher shows real names
        try {
          const listAfter = await Html5Qrcode.getCameras();
          if (mountedRef.current && listAfter && listAfter.length > 0) {
            setCameras(
              listAfter.map((c, idx) => ({
                id: c.id,
                label: c.label || `Camera ${idx + 1}`,
              }))
            );
          }
        } catch {}

        // Ensure video attributes for iOS Safari & Chrome and detect blank video tracks
        const video = host.querySelector('video');
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          video.play().catch(() => {});
        }

        setCameraState('scanning');
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = String(err?.message || err || '');
        if (/NotAllowedError|Permission|denied/i.test(msg)) {
          setCameraMessage('Bạn chưa cấp quyền Camera cho trình duyệt. Hãy cho phép quyền Camera rồi bấm "Bật Camera".');
        } else if (/NotFoundError|Requested device not found|no camera/i.test(msg)) {
          setCameraMessage('Không tìm thấy camera trên thiết bị này. Hãy dùng nút "Quét từ ảnh" hoặc nhập mã bên dưới.');
        } else if (/NotReadableError|TrackStartError|in use/i.test(msg)) {
          setCameraMessage('Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi bấm "Bật Camera".');
        } else {
          setCameraMessage('Không thể mở luồng video camera. Hãy kiểm tra quyền camera hoặc dùng nút "Quét từ ảnh".');
        }
        setCameraState('error');
      } finally {
        busyStartingRef.current = false;
      }
    },
    [handleLookup, selectedCameraId, stopCamera]
  );

  useEffect(() => {
    mountedRef.current = true;
    const seq = ++startSeqRef.current;

    // Slight delay avoids React 18 StrictMode double-mount racing getUserMedia
    const timer = window.setTimeout(() => {
      if (mountedRef.current && seq === startSeqRef.current) {
        void startCamera();
      }
    }, 80);

    return () => {
      mountedRef.current = false;
      startSeqRef.current++;
      window.clearTimeout(timer);
      void stopCamera();
    };
  }, []);

  const handleScanImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setLoading(true);
    try {
      await stopCamera();
      const fileScanner = new Html5Qrcode(FILE_READER_ELEMENT_ID, false);
      let decoded = '';
      try {
        decoded = await fileScanner.scanFile(file, false);
      } finally {
        try {
          fileScanner.clear();
        } catch {}
      }
      setScanResult(decoded);
      setCameraState('matched');
      await handleLookup(decoded);
    } catch {
      setError('Không đọc được mã QR trong ảnh đã chọn. Hãy chọn ảnh chụp tem QR rõ nét hơn.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-12">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-3 bg-cyan-50 text-cyan-700 border border-cyan-200/80 rounded-2xl mb-2.5">
          <QrCode className="w-7 h-7" />
        </div>
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Quét mã QR thiết bị
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Đưa camera vào tem QR dán trên thiết bị hoặc chọn ảnh QR để tra cứu tức thì
        </p>
      </div>

      {/* Camera Scanner Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-2xs border border-slate-200/85 space-y-3">
        {/* Top Scanner Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {cameras.length > 1 && (
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedCameraId(id);
                  void startCamera(id);
                }}
                aria-label="Chọn camera"
                className="max-w-full truncate px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 outline-none focus:border-cyan-600"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScanImageFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-cyan-700" />
              <span>Quét từ ảnh</span>
            </button>

            {cameraState === 'scanning' ? (
              <button
                type="button"
                onClick={() => {
                  void stopCamera();
                  setCameraState('idle');
                }}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Tắt camera</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startCamera(selectedCameraId || undefined)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{cameraState === 'matched' ? 'Quét mã khác' : 'Bật camera'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport Container (kept clean light when inactive so it never shows an unexplained black box) */}
        <div
          className={`relative w-full overflow-hidden rounded-xl border ${
            cameraState === 'scanning'
              ? 'border-cyan-500/40 bg-slate-950 min-h-[260px]'
              : 'border-slate-200 bg-slate-50 min-h-[240px]'
          }`}
        >
          <div
            id={READER_ELEMENT_ID}
            className="w-full [&_video]:w-full [&_video]:h-auto [&_video]:max-h-[420px] [&_video]:object-cover [&_video]:block"
          />
          <div id={FILE_READER_ELEMENT_ID} className="hidden" />

          {cameraState !== 'scanning' && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-5 text-center bg-slate-50/95">
              {cameraState === 'starting' ? (
                <div className="space-y-2.5">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-cyan-50 border border-cyan-200/80 text-cyan-700 flex items-center justify-center">
                    <Camera className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="text-sm font-semibold text-slate-800">Đang khởi động camera...</div>
                  <div className="text-xs text-slate-500">Vui lòng bấm Cho phép nếu trình duyệt hỏi quyền Camera</div>
                </div>
              ) : cameraState === 'matched' ? (
                <div className="space-y-3">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Đã đọc mã QR</div>
                    {scanResult && (
                      <div className="text-xs text-slate-500 mt-0.5 break-all max-w-xs mx-auto">
                        {scanResult}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void startCamera(selectedCameraId || undefined)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Quét tiếp mã khác</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-w-sm">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-2xs">
                    <Camera className="w-5 h-5 text-cyan-700" />
                  </div>
                  <div className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
                    {cameraMessage || 'Bấm "Bật camera" để mở ống kính quét mã QR, hoặc chọn ảnh QR từ thiết bị.'}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void startCamera(selectedCameraId || undefined)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Bật camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4 text-cyan-700" />
                      <span>Quét từ ảnh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Smartphone className="w-4 h-4 text-cyan-600" />
          <span>Hỗ trợ camera sau trên điện thoại, webcam máy tính và ảnh tem QR</span>
        </div>
      </div>

      {/* Manual Input Fallback */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/85 shadow-2xs">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
          Hoặc nhập mã thiết bị thủ công
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) void handleLookup(manualCode);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ví dụ: TSPK008, TSXN004, TSKD001..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 min-w-0 px-3.5 py-2.5 border border-slate-200 rounded-md text-sm focus:border-cyan-600 outline-none uppercase"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-md text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Tra cứu</span>
          </button>
        </form>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-5 text-center text-xs sm:text-sm text-slate-500 bg-white rounded-2xl border border-slate-200/85 shadow-2xs">
          Đang tra cứu dữ liệu thiết bị...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm text-center">
          {error}
        </div>
      )}

      {/* Scanned Result Profile Card */}
      {assetData && (
        <div className="bg-white p-5 rounded-2xl shadow-md border border-cyan-200 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-cyan-700 uppercase">{assetData.assetCode}</span>
              <h2 className="font-heading text-base sm:text-lg font-bold text-slate-900">{assetData.name}</h2>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                STATUS_COLORS[assetData.status as keyof typeof STATUS_COLORS] || 'bg-slate-100 text-slate-700'
              }`}
            >
              {STATUS_LABELS[assetData.status as keyof typeof STATUS_LABELS] || assetData.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl text-xs">
            <div>
              Khoa quản lý: <strong className="text-slate-800">{assetData.department?.name}</strong>
            </div>
            <div>
              Cơ sở: <strong className="text-slate-800">{assetData.location || 'Cơ sở 1'}</strong>
            </div>
            <div>
              Năm SD: <strong className="text-slate-800">{assetData.yearInUse || '-'}</strong>
            </div>
            <div>
              Phụ trách: <strong className="text-slate-800">{assetData.assignedTo || 'Khoa'}</strong>
            </div>
            {assetData.locationDetail && (
              <div className="col-span-2">
                Vị trí: <strong className="text-slate-800">{assetData.locationDetail}</strong>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate(`/assets/${assetData.id}`)}
              className="flex-1 min-w-[160px] py-2.5 px-3 bg-cyan-700 hover:bg-cyan-800 text-white rounded-md text-xs font-semibold text-center transition cursor-pointer"
            >
              Xem toàn bộ lịch sử thiết bị
            </button>
            <button
              type="button"
              onClick={() => navigate(`/maintenance?assetId=${assetData.id}`)}
              className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" /> Báo hỏng máy này
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
