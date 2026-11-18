import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, requireRoles, getManagingUnitForRole } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req: any, res) => {
  const { status, fromDepartmentId, toDepartmentId } = req.query;
  const where: any = {};

  if (status) where.status = status;
  if (fromDepartmentId) where.fromDepartmentId = parseInt(fromDepartmentId);
  if (toDepartmentId) where.toDepartmentId = parseInt(toDepartmentId);

  if (req.user) {
    if (req.user.role === 'MANAGER_CNTT') {
      where.asset = { managingUnit: 'CNTT' };
    } else if (req.user.role === 'MANAGER_DUOC') {
      where.asset = { managingUnit: 'DUOC' };
    } else if (req.user.role === 'MANAGER_TCHC') {
      where.asset = { managingUnit: 'TCHC' };
    } else if (req.user.role === 'DEPARTMENT' && req.user.departmentId) {
      where.OR = [
        { fromDepartmentId: req.user.departmentId },
        { toDepartmentId: req.user.departmentId }
      ];
    }
  }

  try {
    const transfers = await prisma.assetTransfer.findMany({
      where,
      include: {
        asset: true,
        fromDepartment: true,
        toDepartment: true
      }
    });
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, async (req: any, res) => {
  if (req.user?.role === 'VIEWER') {
    return res.status(403).json({ error: 'Tài khoản Chỉ xem không thể tạo phiếu điều chuyển.' });
  }
  try {
    const data = { ...req.body };
    if (req.user?.role === 'DEPARTMENT' && req.user?.departmentId) {
      data.fromDepartmentId = req.user.departmentId;
    }
    const transfer = await prisma.assetTransfer.create({ data });
    res.status(201).json(transfer);
  } catch (error) {
    res.status(400).json({ error: 'Error creating transfer' });
  }
});

router.put('/:id/approve', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const transfer = await prisma.assetTransfer.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'APPROVED', approvedBy: req.body.approvedBy || req.user.username }
    });
    res.json(transfer);
  } catch (error) {
    res.status(400).json({ error: 'Error approving transfer' });
  }
});

router.put('/:id/reject', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const existing = await prisma.assetTransfer.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { asset: { select: { managingUnit: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Transfer not found' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    if (unitScope && existing.asset?.managingUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn không có quyền từ chối phiếu điều chuyển ngoài khối phụ trách.' });
    }
    const transfer = await prisma.assetTransfer.update({
      where: { id: existing.id },
      data: { status: 'REJECTED' }
    });
    res.json(transfer);
  } catch (error) {
    res.status(400).json({ error: 'Error rejecting transfer' });
  }
});

router.put('/:id/complete', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const transferId = parseInt(req.params.id);
    const transfer = await prisma.assetTransfer.findUnique({
      where: { id: transferId },
      include: { asset: { select: { managingUnit: true } } },
    });
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    if (unitScope && transfer.asset?.managingUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn không có quyền hoàn tất điều chuyển ngoài khối phụ trách.' });
    }

    const result = await prisma.$transaction([
      prisma.assetTransfer.update({
        where: { id: transferId },
        data: { status: 'COMPLETED' }
      }),
      prisma.asset.update({
        where: { id: transfer.assetId },
        data: { departmentId: transfer.toDepartmentId, status: 'DANG_SU_DUNG' }
      })
    ]);
    res.json(result[0]);
  } catch (error) {
    res.status(400).json({ error: 'Error completing transfer' });
  }
});

export default router;
