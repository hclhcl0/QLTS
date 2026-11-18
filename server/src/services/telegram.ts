import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

/**
 * Telegram Bot Notification Service
 * Gửi thông báo báo hỏng & cập nhật sửa chữa thiết bị về group Telegram của kỹ thuật viên.
 * Cấu hình được lưu bền vững trong bảng SystemSetting (key = 'telegram_config')
 * và tự động lấy biến môi trường TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID làm dự phòng.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TELEGRAM_SETTING_KEY = 'telegram_config';

const prisma = new PrismaClient();
let tableEnsured = false;

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  defaultChatId: string;
  chatIdDuoc: string;
  chatIdCntt: string;
  chatIdTchc: string;
  notifyOnCreate: boolean;
  notifyOnStatusChange: boolean;
}

export interface TelegramSendResult {
  ok: boolean;
  skipped?: boolean;
  statusCode?: number;
  error?: string;
  telegramResponse?: any;
}

export async function ensureSystemSettingTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SystemSetting" (
        "key" TEXT PRIMARY KEY,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    tableEnsured = true;
  } catch (err) {
    // Fallback for SQLite syntax if running locally on SQLite
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SystemSetting" (
          "key" TEXT PRIMARY KEY,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      tableEnsured = true;
    } catch (innerErr) {
      console.warn('[Settings] Unable to ensure SystemSetting table:', innerErr);
    }
  }
}

export async function getTelegramConfig(): Promise<{
  config: TelegramConfig;
  source: 'db' | 'env' | 'none';
}> {
  await ensureSystemSettingTable();

  let dbData: Partial<TelegramConfig> | null = null;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "value" FROM "SystemSetting" WHERE "key" = $1 LIMIT 1`,
      TELEGRAM_SETTING_KEY
    )) as { value: string }[];
    if (rows && rows[0]?.value) {
      dbData = JSON.parse(rows[0].value);
    }
  } catch (err) {
    // Try positional '?' fallback for SQLite if $1 failed
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "value" FROM "SystemSetting" WHERE "key" = ? LIMIT 1`,
        TELEGRAM_SETTING_KEY
      )) as { value: string }[];
      if (rows && rows[0]?.value) {
        dbData = JSON.parse(rows[0].value);
      }
    } catch {}
  }

  const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const envChat = (process.env.TELEGRAM_CHAT_ID || '').trim();

  const merged: TelegramConfig = {
    enabled: dbData?.enabled !== undefined ? Boolean(dbData.enabled) : true,
    botToken: (dbData?.botToken || '').trim() || envToken,
    defaultChatId: (dbData?.defaultChatId || '').trim() || envChat,
    chatIdDuoc: (dbData?.chatIdDuoc || '').trim(),
    chatIdCntt: (dbData?.chatIdCntt || '').trim(),
    chatIdTchc: (dbData?.chatIdTchc || '').trim(),
    notifyOnCreate: dbData?.notifyOnCreate !== undefined ? Boolean(dbData.notifyOnCreate) : true,
    notifyOnStatusChange: dbData?.notifyOnStatusChange !== undefined ? Boolean(dbData.notifyOnStatusChange) : true,
  };

  const hasDb = Boolean((dbData?.botToken || '').trim() || (dbData?.defaultChatId || '').trim() || dbData?.chatIdDuoc || dbData?.chatIdCntt || dbData?.chatIdTchc);
  const source: 'db' | 'env' | 'none' = hasDb
    ? 'db'
    : envToken && envChat
    ? 'env'
    : 'none';

  return { config: merged, source };
}

export async function saveTelegramConfig(input: {
  enabled?: boolean;
  botToken?: string;
  clearToken?: boolean;
  defaultChatId?: string;
  chatIdDuoc?: string;
  chatIdCntt?: string;
  chatIdTchc?: string;
  notifyOnCreate?: boolean;
  notifyOnStatusChange?: boolean;
}): Promise<TelegramConfig> {
  await ensureSystemSettingTable();
  const { config: current } = await getTelegramConfig();

  let nextToken = current.botToken;
  if (input.clearToken) {
    nextToken = '';
  } else if (typeof input.botToken === 'string' && input.botToken.trim()) {
    nextToken = input.botToken.trim();
  }

  const next: TelegramConfig = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : current.enabled,
    botToken: nextToken,
    defaultChatId: input.defaultChatId !== undefined ? input.defaultChatId.trim() : current.defaultChatId,
    chatIdDuoc: input.chatIdDuoc !== undefined ? input.chatIdDuoc.trim() : current.chatIdDuoc,
    chatIdCntt: input.chatIdCntt !== undefined ? input.chatIdCntt.trim() : current.chatIdCntt,
    chatIdTchc: input.chatIdTchc !== undefined ? input.chatIdTchc.trim() : current.chatIdTchc,
    notifyOnCreate: input.notifyOnCreate !== undefined ? Boolean(input.notifyOnCreate) : current.notifyOnCreate,
    notifyOnStatusChange:
      input.notifyOnStatusChange !== undefined ? Boolean(input.notifyOnStatusChange) : current.notifyOnStatusChange,
  };

  const jsonVal = JSON.stringify(next);
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
      TELEGRAM_SETTING_KEY,
      jsonVal
    );
  } catch {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT ("key") DO UPDATE SET "value" = excluded."value", "updatedAt" = CURRENT_TIMESTAMP`,
      TELEGRAM_SETTING_KEY,
      jsonVal
    );
  }

  return next;
}

export function resolveTargetChatId(config: TelegramConfig, managingUnit?: string | null): string {
  const unit = (managingUnit || '').toUpperCase();
  if (unit === 'DUOC' && config.chatIdDuoc) return config.chatIdDuoc;
  if (unit === 'CNTT' && config.chatIdCntt) return config.chatIdCntt;
  if (unit === 'TCHC' && config.chatIdTchc) return config.chatIdTchc;
  return config.defaultChatId;
}

export function maskBotToken(token?: string | null): string | null {
  if (!token || !token.trim()) return null;
  const t = token.trim();
  if (t.length <= 14) return `${t.slice(0, 4)}***${t.slice(-3)}`;
  return `${t.slice(0, 10)}...${t.slice(-4)}`;
}

function escapeHtml(raw?: string | null): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Gửi một tin nhắn văn bản tới group Telegram qua Bot API.
 * Hàm này không throw - trả về kết quả để UI test hoặc log an toàn.
 */
export async function sendTelegramMessage(
  text: string,
  options?: {
    managingUnit?: string | null;
    tokenOverride?: string;
    chatIdOverride?: string;
    ignoreDisabled?: boolean;
  }
): Promise<TelegramSendResult> {
  const { config } = await getTelegramConfig();

  if (!options?.ignoreDisabled && !config.enabled) {
    return { ok: false, skipped: true, error: 'Thông báo Telegram đang được tắt trong cài đặt.' };
  }

  const token = (options?.tokenOverride || config.botToken || '').trim();
  const chatId = (options?.chatIdOverride || resolveTargetChatId(config, options?.managingUnit) || '').trim();

  if (!token || !chatId) {
    console.log('[Telegram] TELEGRAM_BOT_TOKEN hoặc Chat ID chưa được cấu hình — bỏ qua gửi thông báo.');
    return {
      ok: false,
      skipped: true,
      error: 'Chưa cấu hình đủ Bot Token hoặc Chat ID.',
    };
  }

  try {
    const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const rawText = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {}

    if (!response.ok || (parsed && parsed.ok === false)) {
      const desc = parsed?.description || rawText || `HTTP ${response.status}`;
      console.error('[Telegram] Gửi thông báo thất bại:', response.status, desc);
      return {
        ok: false,
        statusCode: response.status,
        error: desc,
        telegramResponse: parsed || rawText,
      };
    }

    console.log(`[Telegram] Đã gửi thông báo thành công tới chat ${chatId}.`);
    return { ok: true, statusCode: response.status, telegramResponse: parsed };
  } catch (err: any) {
    console.error('[Telegram] Lỗi khi gọi Telegram API:', err.message);
    return { ok: false, error: err.message };
  }
}

export async function detectTelegramChats(tokenInput?: string): Promise<{
  ok: boolean;
  botInfo?: { id: number; username?: string; first_name?: string };
  chats: { id: string; title: string; type: string; username?: string }[];
  error?: string;
}> {
  const { config } = await getTelegramConfig();
  const token = (tokenInput || config.botToken || '').trim();
  if (!token) {
    return { ok: false, chats: [], error: 'Vui lòng nhập Bot Token trước khi dò nhóm.' };
  }

  try {
    const [meRes, updatesRes] = await Promise.all([
      fetch(`${TELEGRAM_API_BASE}/bot${token}/getMe`),
      fetch(`${TELEGRAM_API_BASE}/bot${token}/getUpdates?limit=40`),
    ]);

    const meData: any = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !meData.ok) {
      return {
        ok: false,
        chats: [],
        error: meData?.description || 'Bot Token không hợp lệ hoặc bị Telegram từ chối.',
      };
    }

    const updData: any = await updatesRes.json().catch(() => ({}));
    const chatMap = new Map<string, { id: string; title: string; type: string; username?: string }>();

    if (updData?.ok && Array.isArray(updData.result)) {
      for (const u of updData.result) {
        const candidates = [
          u.message?.chat,
          u.edited_message?.chat,
          u.channel_post?.chat,
          u.my_chat_member?.chat,
          u.chat_member?.chat,
          u.callback_query?.message?.chat,
        ].filter(Boolean);

        for (const c of candidates) {
          const id = String(c.id);
          const title =
            c.title ||
            [c.first_name, c.last_name].filter(Boolean).join(' ') ||
            (c.username ? `@${c.username}` : id);
          chatMap.set(id, {
            id,
            title,
            type: c.type || 'unknown',
            username: c.username,
          });
        }
      }
    }

    return {
      ok: true,
      botInfo: meData.result,
      chats: Array.from(chatMap.values()),
    };
  } catch (err: any) {
    return {
      ok: false,
      chats: [],
      error: `Không thể kết nối Telegram API: ${err.message}`,
    };
  }
}

/**
 * Gửi danh sách ảnh hiện trạng sự cố (tối đa 10 ảnh) tới group Telegram.
 */
export async function sendTelegramPhotos(
  filePaths: string[],
  caption?: string,
  options?: {
    managingUnit?: string | null;
    tokenOverride?: string;
    chatIdOverride?: string;
    ignoreDisabled?: boolean;
  }
): Promise<TelegramSendResult> {
  const validPaths = filePaths.filter((p) => p && fs.existsSync(p)).slice(0, 10);
  if (validPaths.length === 0) {
    return { ok: true, skipped: true };
  }

  const { config } = await getTelegramConfig();
  if (!options?.ignoreDisabled && !config.enabled) {
    return { ok: false, skipped: true, error: 'Thông báo Telegram đang được tắt trong cài đặt.' };
  }

  const token = (options?.tokenOverride || config.botToken || '').trim();
  const chatId = (options?.chatIdOverride || resolveTargetChatId(config, options?.managingUnit) || '').trim();
  if (!token || !chatId) {
    return { ok: false, skipped: true, error: 'Chưa cấu hình đủ Bot Token hoặc Chat ID.' };
  }

  const getMimeType = (filePath: string) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
  };

  try {
    const form = new FormData();
    form.append('chat_id', chatId);

    if (validPaths.length === 1) {
      const p = validPaths[0];
      const buffer = await fs.promises.readFile(p);
      form.append('photo', new Blob([buffer], { type: getMimeType(p) }), path.basename(p));
      if (caption) {
        form.append('caption', caption.slice(0, 1000));
        form.append('parse_mode', 'HTML');
      }
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form,
      });
      const parsed: any = await res.json().catch(() => null);
      if (!res.ok || (parsed && parsed.ok === false)) {
        return { ok: false, statusCode: res.status, error: parsed?.description || `HTTP ${res.status}` };
      }
      return { ok: true, statusCode: res.status, telegramResponse: parsed };
    }

    const mediaItems: any[] = [];
    for (let i = 0; i < validPaths.length; i++) {
      const p = validPaths[i];
      const fieldName = `photo${i}`;
      const buffer = await fs.promises.readFile(p);
      form.append(fieldName, new Blob([buffer], { type: getMimeType(p) }), path.basename(p));
      mediaItems.push({
        type: 'photo',
        media: `attach://${fieldName}`,
        ...(i === 0 && caption ? { caption: caption.slice(0, 1000), parse_mode: 'HTML' } : {}),
      });
    }
    form.append('media', JSON.stringify(mediaItems));

    const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMediaGroup`, {
      method: 'POST',
      body: form,
    });
    const parsed: any = await res.json().catch(() => null);
    if (!res.ok || (parsed && parsed.ok === false)) {
      return { ok: false, statusCode: res.status, error: parsed?.description || `HTTP ${res.status}` };
    }
    return { ok: true, statusCode: res.status, telegramResponse: parsed };
  } catch (err: any) {
    console.error('[Telegram] Lỗi khi gửi ảnh đính kèm:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Định dạng tin nhắn báo hỏng thiết bị mới để gửi Telegram.
 */
export function formatMaintenanceNotification(data: {
  assetCode: string;
  assetName: string;
  departmentName: string;
  locationDetail?: string | null;
  issueType?: string | null;
  issueDescription: string;
  ultraViewId?: string | null;
  ultraViewPass?: string | null;
  attachmentCount?: number;
  requestedBy: string;
  priority: string;
  managingUnit?: string | null;
  contactPhone?: string | null;
  requestDate: Date;
}): string {
  const priorityEmoji: Record<string, string> = {
    LOW: '🟢',
    MEDIUM: '🟡',
    HIGH: '🔴',
    URGENT: '🚨',
  };
  const priorityLabel: Record<string, string> = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    URGENT: 'Khẩn cấp',
  };
  const unitLabel: Record<string, string> = {
    DUOC: 'Khoa Dược (TBYT)',
    CNTT: 'Tổ CNTT',
    TCHC: 'Phòng TCHC',
  };
  const issueTypeLabel: Record<string, string> = {
    SOFTWARE: '💻 Lỗi phần mềm / Hỗ trợ từ xa',
    HARDWARE: '🔧 Lỗi phần cứng / Thiết bị',
    OTHER: '📋 Sự cố khác',
  };

  const prio = data.priority || 'MEDIUM';
  const unit = data.managingUnit ? unitLabel[data.managingUnit] || data.managingUnit : 'Tổ CNTT';
  const typeKey = (data.issueType || 'HARDWARE').toUpperCase();
  const date = data.requestDate.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cleanUvId = data.ultraViewId?.trim();
  const cleanUvPass = data.ultraViewPass?.trim();
  const ultraViewLine = cleanUvId
    ? `🖥️ <b>UltraViewer ID:</b> <code>${escapeHtml(cleanUvId)}</code>${
        cleanUvPass ? `  |  🔑 <b>MK:</b> <code>${escapeHtml(cleanUvPass)}</code>` : ''
      }`
    : typeKey === 'SOFTWARE'
    ? `🖥️ <b>UltraViewer:</b> <i>Không mở được / chưa cung cấp</i>`
    : null;

  const lines = [
    `🔧 <b>BÁO HỎNG THIẾT BỊ</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📦 <b>Thiết bị:</b> ${escapeHtml(data.assetName)}`,
    `🏷️ <b>Mã TB:</b> <code>${escapeHtml(data.assetCode)}</code>`,
    `🏥 <b>Bộ phận báo:</b> ${escapeHtml(data.departmentName)}`,
    data.locationDetail ? `📍 <b>Vị trí:</b> ${escapeHtml(data.locationDetail)}` : null,
    `🧩 <b>Phân loại:</b> ${issueTypeLabel[typeKey] || escapeHtml(typeKey)}`,
    `⚠️ <b>Tình trạng:</b> ${escapeHtml(data.issueDescription)}`,
    ultraViewLine,
    `${priorityEmoji[prio] || '🟡'} <b>Mức độ:</b> ${escapeHtml(priorityLabel[prio] || prio)}`,
    `🔧 <b>Đơn vị tiếp nhận:</b> ${escapeHtml(unit)}`,
    `👤 <b>Người báo:</b> ${escapeHtml(data.requestedBy)}`,
    data.contactPhone ? `📞 <b>Điện thoại:</b> ${escapeHtml(data.contactPhone)}` : null,
    data.attachmentCount && data.attachmentCount > 0
      ? `📷 <b>Ảnh hiện trạng:</b> ${data.attachmentCount} ảnh đính kèm bên dưới`
      : null,
    `🕐 <b>Thời gian:</b> ${date}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<i>Vui lòng kiểm tra và xử lý kịp thời!</i>`,
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Định dạng tin nhắn cập nhật trạng thái xử lý sửa chữa thiết bị.
 */
export function formatMaintenanceStatusNotification(data: {
  assetCode: string;
  assetName: string;
  departmentName: string;
  status: string;
  technicianName?: string | null;
  repairVendor?: string | null;
  repairCost?: number | null;
  repairNote?: string | null;
  deviceStatusAfter?: string | null;
  managingUnit?: string | null;
}): string {
  const statusMeta: Record<string, { icon: string; label: string }> = {
    PENDING: { icon: '⏳', label: 'Chờ tiếp nhận' },
    IN_PROGRESS: { icon: '🛠️', label: 'Đang kiểm tra / sửa chữa' },
    COMPLETED: { icon: '✅', label: 'Đã hoàn thành sửa chữa' },
    REJECTED: { icon: '❌', label: 'Không sửa được / Từ chối' },
  };
  const unitLabel: Record<string, string> = {
    DUOC: 'Khoa Dược (TBYT)',
    CNTT: 'Tổ CNTT',
    TCHC: 'Phòng TCHC',
  };

  const meta = statusMeta[data.status] || { icon: '🔄', label: data.status };
  const unit = data.managingUnit ? unitLabel[data.managingUnit] || data.managingUnit : '';
  const nowStr = new Date().toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = [
    `${meta.icon} <b>CẬP NHẬT SỬA CHỮA THIẾT BỊ</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Trạng thái:</b> ${escapeHtml(meta.label)}`,
    `📦 <b>Thiết bị:</b> ${escapeHtml(data.assetName)}`,
    `🏷️ <b>Mã TB:</b> <code>${escapeHtml(data.assetCode)}</code>`,
    `🏥 <b>Khoa/Phòng:</b> ${escapeHtml(data.departmentName)}`,
    unit ? `🔧 <b>Đơn vị xử lý:</b> ${escapeHtml(unit)}` : null,
    data.technicianName ? `👨‍🔧 <b>Người xử lý:</b> ${escapeHtml(data.technicianName)}` : null,
    data.repairVendor ? `🏢 <b>Đơn vị sửa chữa:</b> ${escapeHtml(data.repairVendor)}` : null,
    data.repairCost && data.repairCost > 0
      ? `💰 <b>Chi phí:</b> ${Number(data.repairCost).toLocaleString('vi-VN')} đ`
      : null,
    data.deviceStatusAfter ? `📋 <b>Tình trạng sau sửa:</b> ${escapeHtml(data.deviceStatusAfter)}` : null,
    data.repairNote ? `📝 <b>Ghi chú:</b> ${escapeHtml(data.repairNote)}` : null,
    `🕐 <b>Cập nhật lúc:</b> ${nowStr}`,
  ].filter(Boolean);

  return lines.join('\n');
}
