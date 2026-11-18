import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [departments, groupedAssets] = await Promise.all([
      prisma.department.findMany({
        include: {
          _count: {
            select: { assets: true, users: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
      prisma.asset.groupBy({
        by: ['departmentId', 'managingUnit', 'buildingAsset'],
        _count: { _all: true },
      }),
    ]);

    const breakdownMap: Record<
      number,
      { total: number; duoc: number; cntt: number; tchcHc: number; tchcMe: number }
    > = {};

    for (const g of groupedAssets) {
      const dId = g.departmentId;
      if (!breakdownMap[dId]) {
        breakdownMap[dId] = { total: 0, duoc: 0, cntt: 0, tchcHc: 0, tchcMe: 0 };
      }
      const cnt = g._count._all;
      breakdownMap[dId].total += cnt;
      if (g.managingUnit === 'DUOC') breakdownMap[dId].duoc += cnt;
      else if (g.managingUnit === 'CNTT') breakdownMap[dId].cntt += cnt;
      else if (g.managingUnit === 'TCHC' && g.buildingAsset === 1) breakdownMap[dId].tchcMe += cnt;
      else if (g.managingUnit === 'TCHC') breakdownMap[dId].tchcHc += cnt;
    }

    const enriched = departments.map((d) => ({
      ...d,
      assetBreakdown: breakdownMap[d.id] || {
        total: d._count?.assets || 0,
        duoc: 0,
        cntt: 0,
        tchcHc: 0,
        tchcMe: 0,
      },
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error loading departments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        assets: true,
        users: { select: { id: true, username: true, fullName: true } }
      }
    });
    if (!department) return res.status(404).json({ error: 'Not found' });
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const department = await prisma.department.create({ data: req.body });
    res.status(201).json(department);
  } catch (error) {
    res.status(400).json({ error: 'Error creating department' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const department = await prisma.department.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(department);
  } catch (error) {
    res.status(400).json({ error: 'Error updating department' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Error deleting department' });
  }
});

export default router;
