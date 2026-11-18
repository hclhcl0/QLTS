import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, getManagingUnitForRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const requireManagerOrAdmin = requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC');

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.inventorySession.findMany({
      include: {
        _count: { select: { records: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sessions', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const session = await prisma.inventorySession.create({ data: req.body });
    res.status(201).json(session);
  } catch (error) {
    res.status(400).json({ error: 'Error creating session' });
  }
});

router.put('/sessions/:id', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const session = await prisma.inventorySession.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(session);
  } catch (error) {
    res.status(400).json({ error: 'Error updating session' });
  }
});

// Lưu cập nhật nhanh kết quả kiểm kê thực tế cho các tài sản (theo phạm vi phân quyền)
router.post('/update-bulk-assets', requireAuth, async (req: any, res) => {
  if (req.user?.role === 'VIEWER') {
    return res.status(403).json({ error: 'Tài khoản Chỉ xem không có quyền lưu thay đổi kiểm kê.' });
  }
  try {
    const { updates } = req.body; // Array of { id, actualQuantity, quantityDifference, status, note }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates payload' });
    }

    const ids = Array.from(new Set(updates.map((u) => Number(u.id)).filter((n) => Number.isInteger(n) && n > 0)));
    if (req.user?.role !== 'ADMIN') {
      const targetAssets = await prisma.asset.findMany({
        where: { id: { in: ids } },
        select: { id: true, managingUnit: true, departmentId: true },
      });
      const unitScope = getManagingUnitForRole(req.user?.role);
      const unauthorized = targetAssets.some((a) => {
        if (unitScope) return a.managingUnit !== unitScope;
        if (req.user?.role === 'DEPARTMENT') return a.departmentId !== req.user?.departmentId;
        return true;
      });
      if (unauthorized) {
        return res.status(403).json({ error: 'Bạn không có quyền cập nhật kiểm kê tài sản ngoài phạm vi quản lý.' });
      }
    }

    const promises = updates.map(u => 
      prisma.asset.update({
        where: { id: Number(u.id) },
        data: {
          actualQuantity: u.actualQuantity !== undefined ? parseInt(u.actualQuantity) : undefined,
          quantityDifference: u.quantityDifference !== undefined ? parseInt(u.quantityDifference) : undefined,
          status: u.status || undefined,
          note: u.note !== undefined ? u.note : undefined
        }
      })
    );

    await prisma.$transaction(promises);
    res.json({ message: `Cập nhật thành công ${updates.length} tài sản kiểm kê` });
  } catch (error) {
    console.error('Error updating bulk inventory:', error);
    res.status(500).json({ error: 'Error saving inventory results' });
  }
});

export default router;
