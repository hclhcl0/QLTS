import React, { useEffect, useState } from 'react';
import {
  Send,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Save,
  Trash2,
  BellRing,
  Bot,
  Users,
  Stethoscope,
  Monitor,
  Building2,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../lib/api';
import { useToast } from '../components/ui/Toast';

interface TelegramSettingsState {
  enabled: boolean;
  hasToken: boolean;
  maskedToken: string | null;
  source: 'db' | 'env' | 'none';
  defaultChatId: string;
  chatIdDuoc: string;
  chatIdCntt: string;
  chatIdTchc: string;
  notifyOnCreate: boolean;
  notifyOnStatusChange: boolean;
  configured: boolean;
}

interface DetectedChat {
  id: string;
  title: string;
  type: string;
  username?: string;
}

export default function Settings() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingChat, setTestingChat] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const [maskedToken, setMaskedToken] = useState<string | null>(null);
  const [source, setSource] = useState<'db' | 'env' | 'none'>('none');
  const [botTokenInput, setBotTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [defaultChatId, setDefaultChatId] = useState('');
  const [chatIdDuoc, setChatIdDuoc] = useState('');
  const [chatIdCntt, setChatIdCntt] = useState('');
  const [chatIdTchc, setChatIdTchc] = useState('');
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [notifyOnStatusChange, setNotifyOnStatusChange] = useState(true);
  const [configured, setConfigured] = useState(false);

  const [detectedBot, setDetectedBot] = useState<{ username?: string; first_name?: string } | null>(null);
  const [detectedChats, setDetectedChats] = useState<DetectedChat[]>([]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = (await apiGet('/settings/telegram')) as TelegramSettingsState;
      setEnabled(Boolean(res.enabled));
      setHasToken(Boolean(res.hasToken));
      setMaskedToken(res.maskedToken || null);
      setSource(res.source || 'none');
      setDefaultChatId(res.defaultChatId || '');
      setChatIdDuoc(res.chatIdDuoc || '');
      setChatIdCntt(res.chatIdCntt || '');
      setChatIdTchc(res.chatIdTchc || '');
      setNotifyOnCreate(res.notifyOnCreate !== false);
      setNotifyOnStatusChange(res.notifyOnStatusChange !== false);
      setConfigured(Boolean(res.configured));
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải cấu hình Telegram');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        enabled,
        defaultChatId: defaultChatId.trim(),
        chatIdDuoc: chatIdDuoc.trim(),
        chatIdCntt: chatIdCntt.trim(),
        chatIdTchc: chatIdTchc.trim(),
        notifyOnCreate,
        notifyOnStatusChange,
      };
      if (botTokenInput.trim()) {
        payload.botToken = botTokenInput.trim();
      }
      const res = (await apiPut('/settings/telegram', payload)) as TelegramSettingsState & { ok: boolean };
      setHasToken(Boolean(res.hasToken));
      setMaskedToken(res.maskedToken || null);
      setConfigured(Boolean(res.configured));
      setBotTokenInput('');
      setSource('db');
      toast.success('Đã lưu cài đặt thông báo Telegram thành công!');
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi lưu cấu hình Telegram');
    } finally {
      setSaving(false);
    }
  };

  const handleClearToken = async () => {
    setSaving(true);
    try {
      const res = (await apiPut('/settings/telegram', { clearToken: true })) as TelegramSettingsState;
      setHasToken(Boolean(res.hasToken));
      setMaskedToken(res.maskedToken || null);
      setConfigured(Boolean(res.configured));
      setBotTokenInput('');
      toast.info('Đã xóa Bot Token khỏi cấu hình giao diện.');
    } catch (err: any) {
      toast.error(err?.message || 'Không thể xóa Bot Token');
    } finally {
      setSaving(false);
    }
  };

  const handleDetectChats = async () => {
    setDetecting(true);
    try {
      const res = (await apiPost('/settings/telegram/detect-chats', {
        botToken: botTokenInput.trim() || undefined,
      })) as {
        ok: boolean;
        botInfo?: { username?: string; first_name?: string };
        chats: DetectedChat[];
        error?: string;
      };
      setDetectedBot(res.botInfo || null);
      setDetectedChats(res.chats || []);
      if (res.chats && res.chats.length > 0) {
        toast.success(`Đã kết nối Bot @${res.botInfo?.username || ''} và tìm thấy ${res.chats.length} nhóm/chat!`);
      } else {
        toast.warning(
          `Bot @${res.botInfo?.username || ''} hợp lệ nhưng chưa có tin nhắn gần đây. Hãy thêm Bot vào nhóm kỹ thuật rồi nhắn 1 tin bất kỳ và bấm dò lại.`
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Không thể dò nhóm Telegram');
    } finally {
      setDetecting(false);
    }
  };

  const handleTestSend = async (targetKey: string, chatId: string, unitLabel?: string) => {
    const cleanChatId = chatId.trim();
    if (!cleanChatId) {
      toast.warning('Vui lòng nhập Chat ID trước khi gửi tin thử.');
      return;
    }
    setTestingChat(targetKey);
    try {
      const res = (await apiPost('/settings/telegram/test', {
        botToken: botTokenInput.trim() || undefined,
        chatId: cleanChatId,
        unitLabel,
      })) as { ok: boolean; message?: string };
      toast.success(res.message || 'Đã gửi tin nhắn thử tới Telegram!');
    } catch (err: any) {
      toast.error(err?.message || 'Telegram từ chối gửi tin thử');
    } finally {
      setTestingChat(null);
    }
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-[#024383]" />
              <span>Cài Đặt Hệ Thống &amp; Cảnh Báo Telegram</span>
            </h1>
            {configured && enabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đang hoạt động
              </span>
            ) : !enabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Đang tạm tắt
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5" />
                Chưa cấu hình đầy đủ
              </span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
            Tự động gửi cảnh báo tức thì tới nhóm Telegram kỹ thuật khi các Khoa/Phòng báo hỏng hoặc cập nhật tiến độ sửa chữa thiết bị.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
          Đang tải cài đặt Telegram...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: Config Form */}
          <form
            onSubmit={handleSave}
            className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-5"
          >
            {/* Master Toggle */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${enabled ? 'bg-[#024383] text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Bật thông báo Telegram tự động</div>
                  <div className="text-xs text-slate-500">
                    Nguồn cấu hình hiện tại:{' '}
                    <strong>
                      {source === 'db' ? 'Lưu trong CSDL phần mềm' : source === 'env' ? 'Biến môi trường (.env)' : 'Chưa thiết lập'}
                    </strong>
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* 1. Bot Token */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#024383]" />
                  1. Telegram Bot Token (@BotFather)
                </label>
                {hasToken && (
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                      Đã lưu: {maskedToken}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearToken}
                      className="text-rose-600 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                    placeholder={
                      hasToken
                        ? 'Để trống để giữ nguyên Bot Token hiện tại, hoặc dán token mới...'
                        : 'Dán token dạng 7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:border-[#024383] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    aria-label="Hiện/ẩn Bot Token"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDetectChats}
                  disabled={detecting || (!botTokenInput.trim() && !hasToken)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {detecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Tự dò Group ID</span>
                </button>
              </div>

              {/* Detected Chats Picker */}
              {(detectedBot || detectedChats.length > 0) && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-2 text-xs">
                  <div className="font-semibold text-blue-900">
                    Bot đã xác thực: @{detectedBot?.username} ({detectedBot?.first_name})
                  </div>
                  {detectedChats.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-600">
                        Chọn nhanh nhóm vừa phát hiện:
                      </div>
                      {detectedChats.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-blue-100"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800">{c.title}</span>{' '}
                            <span className="font-mono text-[11px] text-blue-700">({c.id})</span>{' '}
                            <span className="text-[10px] text-slate-400">[{c.type}]</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              onClick={() => setDefaultChatId(c.id)}
                              className="px-2 py-0.5 rounded bg-blue-700 text-white text-[10px] font-semibold hover:bg-blue-800 cursor-pointer"
                            >
                              Gán Mặc định
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatIdDuoc(c.id)}
                              className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium hover:bg-emerald-100 cursor-pointer"
                            >
                              Gán Dược
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatIdCntt(c.id)}
                              className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-medium hover:bg-sky-100 cursor-pointer"
                            >
                              Gán CNTT
                            </button>
                            <button
                              type="button"
                              onClick={() => setChatIdTchc(c.id)}
                              className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium hover:bg-amber-100 cursor-pointer"
                            >
                              Gán TCHC
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* 2. Default Chat ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#024383]" />
                2. Chat ID Nhóm Mặc Định (Nhận tất cả báo hỏng)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={defaultChatId}
                  onChange={(e) => setDefaultChatId(e.target.value)}
                  placeholder="VD: -1002345678901 hoặc -4567890123"
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono text-slate-800 focus:border-[#024383] outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleTestSend('default', defaultChatId)}
                  disabled={testingChat === 'default' || !defaultChatId.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-45 cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{testingChat === 'default' ? 'Đang gửi...' : 'Gửi tin thử'}</span>
                </button>
              </div>
            </div>

            {/* 3. Unit Routing (Optional) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div>
                <div className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-600">
                  3. Phân nhóm riêng theo Tổ chuyên trách (Tùy chọn)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Để trống nếu muốn tất cả 3 tổ cùng nhận chung trong Nhóm Mặc Định ở trên.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {[
                  {
                    key: 'duoc',
                    label: 'Khoa Dược (TBYT)',
                    icon: Stethoscope,
                    value: chatIdDuoc,
                    setter: setChatIdDuoc,
                  },
                  {
                    key: 'cntt',
                    label: 'Tổ CNTT (IT)',
                    icon: Monitor,
                    value: chatIdCntt,
                    setter: setChatIdCntt,
                  },
                  {
                    key: 'tchc',
                    label: 'Phòng TCHC (Hành chính & Cơ điện)',
                    icon: Building2,
                    value: chatIdTchc,
                    setter: setChatIdTchc,
                  },
                ].map((unit) => {
                  const UIcon = unit.icon;
                  return (
                    <div key={unit.key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="sm:w-56 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0">
                        <UIcon className="w-3.5 h-3.5 text-slate-500" />
                        {unit.label}
                      </span>
                      <div className="flex-1 flex gap-1.5">
                        <input
                          type="text"
                          value={unit.value}
                          onChange={(e) => unit.setter(e.target.value)}
                          placeholder="Mặc định (dùng nhóm chung)"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:border-[#024383] outline-none"
                        />
                        {unit.value.trim() && (
                          <button
                            type="button"
                            onClick={() => handleTestSend(unit.key, unit.value, unit.label)}
                            disabled={testingChat === unit.key}
                            className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer shrink-0"
                          >
                            {testingChat === unit.key ? '...' : 'Thử'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Trigger Events */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="text-xs font-heading font-semibold uppercase tracking-wider text-slate-600">
                4. Thời điểm gửi tin nhắn Telegram
              </div>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnCreate}
                    onChange={(e) => setNotifyOnCreate(e.target.checked)}
                    className="rounded border-slate-300 text-[#024383]"
                  />
                  <span>Gửi ngay khi có phiếu <strong>Báo hỏng / Đề xuất sửa chữa mới</strong></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnStatusChange}
                    onChange={(e) => setNotifyOnStatusChange(e.target.checked)}
                    className="rounded border-slate-300 text-[#024383]"
                  />
                  <span>Gửi cập nhật khi kỹ thuật viên đổi trạng thái (<strong>Đang sửa / Hoàn thành / Từ chối</strong>)</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-md bg-[#024383] hover:bg-[#02366b] text-white text-xs sm:text-sm font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Đang lưu...' : 'Lưu cài đặt Telegram'}</span>
              </button>
            </div>
          </form>

          {/* RIGHT: Guide & Sample Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3">
              <h2 className="font-heading text-sm font-bold text-slate-900">
                Hướng dẫn kết nối nhanh (2 phút)
              </h2>
              <ol className="space-y-2 text-xs text-slate-600 list-decimal pl-4 leading-relaxed">
                <li>
                  Mở Telegram tìm <strong>@BotFather</strong> → gõ <code className="px-1 py-0.5 rounded bg-slate-100 font-mono">/newbot</code> → đặt tên Bot (VD: <em>QLTS CDC Đà Nẵng Bot</em>) để nhận <strong>Bot Token</strong>.
                </li>
                <li>
                  Tạo nhóm Telegram nhận thông báo (VD: <em>Kỹ thuật QLTS CDC</em>) → <strong>Thêm Bot vừa tạo vào nhóm</strong> (và nhắn 1 câu bất kỳ như <em>hello</em> trong nhóm).
                </li>
                <li>
                  Dán <strong>Bot Token</strong> vào ô bên trái → bấm <strong>Tự dò Group ID</strong> → bấm <strong>Gán Mặc định</strong> ngay bên cạnh tên nhóm hiện ra.
                </li>
                <li>
                  Bấm <strong>Gửi tin thử</strong> để thấy tin nhắn về nhóm rồi bấm <strong>Lưu cài đặt Telegram</strong>.
                </li>
              </ol>
            </div>

            {/* Telegram Message Preview */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-sky-300">
                Mẫu tin nhắn gửi về nhóm Telegram
              </div>
              <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-xs leading-relaxed font-sans space-y-0.5">
                <div>🔧 <strong>BÁO HỎNG THIẾT BỊ</strong></div>
                <div className="text-slate-500">━━━━━━━━━━━━━━━━━━━━</div>
                <div>📦 <strong>Thiết bị:</strong> Máy xét nghiệm sinh hóa tự động</div>
                <div>🏷️ <strong>Mã TB:</strong> <code className="text-sky-300">TSXN004</code></div>
                <div>🏥 <strong>Bộ phận báo:</strong> Khoa Xét Nghiệm - CĐHA - TDCN</div>
                <div>📍 <strong>Vị trí:</strong> Tầng 3 · Phòng Sinh hóa</div>
                <div>⚠️ <strong>Tình trạng:</strong> Báo lỗi cảm biến nhiệt buồng phản ứng</div>
                <div>🔴 <strong>Mức độ:</strong> Cao</div>
                <div>🔧 <strong>Đơn vị tiếp nhận:</strong> Khoa Dược (TBYT)</div>
                <div>👤 <strong>Người báo:</strong> Nguyễn Văn A</div>
                <div>📞 <strong>Điện thoại:</strong> 0905123456</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
