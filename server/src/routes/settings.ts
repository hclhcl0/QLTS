import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  detectTelegramChats,
  getTelegramConfig,
  maskBotToken,
  saveTelegramConfig,
  sendTelegramMessage,
} from '../services/telegram';

const router = Router();

function isAdmin(req: any): boolean {
  return req.user?.role === 'ADMIN';
}

// GET /api/settings/telegram - Lấy trạng thái & cấu hình Telegram (che token bảo mật)
router.get('/telegram', requireAuth, async (req: any, res) => {
  try {
    const { config, source } = await getTelegramConfig();
    const configured = Boolean(
      config.botToken &&
        (config.defaultChatId || config.chatIdDuoc || config.chatIdCntt || config.chatIdTchc)
    );

    if (!isAdmin(req)) {
      return res.json({
        enabled: config.enabled,
        configured,
        hasToken: Boolean(config.botToken),
        notifyOnCreate: config.notifyOnCreate,
        notifyOnStatusChange: config.notifyOnStatusChange,
        readOnly: true,
      });
    }

    res.json({
      enabled: config.enabled,
      hasToken: Boolean(config.botToken),
      maskedToken: maskBotToken(config.botToken),
      source,
      defaultChatId: config.defaultChatId,
      chatIdDuoc: config.chatIdDuoc,
      chatIdCntt: config.chatIdCntt,
      chatIdTchc: config.chatIdTchc,
      notifyOnCreate: config.notifyOnCreate,
      notifyOnStatusChange: config.notifyOnStatusChange,
      configured,
      readOnly: false,
    });
  } catch (error: any) {
    console.error('Error fetching Telegram settings:', error);
    res.status(500).json({ error: error.message || 'Lỗi tải cấu hình Telegram' });
  }
});

// PUT /api/settings/telegram - Lưu cấu hình Telegram (chỉ ADMIN)
router.put('/telegram', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền thay đổi cài đặt Telegram.' });
  }
  try {
    const updated = await saveTelegramConfig({
      enabled: req.body?.enabled,
      botToken: req.body?.botToken,
      clearToken: Boolean(req.body?.clearToken),
      defaultChatId: req.body?.defaultChatId,
      chatIdDuoc: req.body?.chatIdDuoc,
      chatIdCntt: req.body?.chatIdCntt,
      chatIdTchc: req.body?.chatIdTchc,
      notifyOnCreate: req.body?.notifyOnCreate,
      notifyOnStatusChange: req.body?.notifyOnStatusChange,
    });

    res.json({
      ok: true,
      enabled: updated.enabled,
      hasToken: Boolean(updated.botToken),
      maskedToken: maskBotToken(updated.botToken),
      defaultChatId: updated.defaultChatId,
      chatIdDuoc: updated.chatIdDuoc,
      chatIdCntt: updated.chatIdCntt,
      chatIdTchc: updated.chatIdTchc,
      notifyOnCreate: updated.notifyOnCreate,
      notifyOnStatusChange: updated.notifyOnStatusChange,
      configured: Boolean(
        updated.botToken &&
          (updated.defaultChatId || updated.chatIdDuoc || updated.chatIdCntt || updated.chatIdTchc)
      ),
    });
  } catch (error: any) {
    console.error('Error saving Telegram settings:', error);
    res.status(500).json({ error: error.message || 'Lỗi lưu cấu hình Telegram' });
  }
});

// POST /api/settings/telegram/detect-chats - Tự động tìm nhóm Telegram Bot đã tham gia
router.post('/telegram/detect-chats', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền thao tác này.' });
  }
  try {
    const result = await detectTelegramChats(req.body?.botToken);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, chats: [], error: error.message });
  }
});

// POST /api/settings/telegram/test - Gửi tin nhắn test tới Telegram (dùng config nhập hoặc đang lưu)
router.post('/telegram/test', requireAuth, async (req: any, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền gửi thử nghiệm.' });
  }
  try {
    const { config } = await getTelegramConfig();
    const token = (req.body?.botToken || '').trim() || config.botToken;
    const chatId = (req.body?.chatId || '').trim() || config.defaultChatId;
    const unitLabel = req.body?.unitLabel ? ` (${req.body.unitLabel})` : '';

    if (!token || !chatId) {
      return res.status(400).json({
        ok: false,
        error: 'Vui lòng nhập đầy đủ Bot Token và Chat ID trước khi gửi thử.',
      });
    }

    const nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const testText = [
      `🔔 <b>QLTS CDC ĐÀ NẴNG — TEST KẾT NỐI${unitLabel}</b>`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `✅ Kết nối Bot Telegram thành công!`,
      `👤 <b>Thử nghiệm bởi:</b> ${req.user?.fullName || req.user?.username || 'Quản trị viên'}`,
      `🕐 <b>Thời gian:</b> ${nowStr}`,
      `📌 Hệ thống sẵn sàng gửi cảnh báo báo hỏng &amp; cập nhật sửa chữa về nhóm này.`,
    ].join('\n');

    const result = await sendTelegramMessage(testText, {
      tokenOverride: token,
      chatIdOverride: chatId,
      ignoreDisabled: true,
    });

    if (!result.ok) {
      return res.status(400).json({
        ok: false,
        error: `Telegram từ chối gửi tin: ${result.error}`,
        telegramResponse: result.telegramResponse,
      });
    }

    res.json({
      ok: true,
      message: `Đã gửi tin nhắn thử nghiệm thành công tới nhóm ${chatId}!`,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'Lỗi kết nối Telegram API' });
  }
});

export default router;
