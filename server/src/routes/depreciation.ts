import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

function getDefaultRate(asset: { managingUnit?: string | null; buildingAsset?: number | null; depreciationRate?: number | null }): number {
  if (asset.depreciationRate && asset.depreciationRate > 0) return asset.depreciationRate;
  if (asset.managingUnit === 'CNTT') return 20; // CNTT 5 năm (20%/năm)
  if (asset.managingUnit === 'DUOC') return 12.5; // TBYT ~8 năm (12.5%/năm)
  if (asset.buildingAsset === 1) return 8; // Hạ tầng cơ điện ~12.5 năm
  return 10; // Mặc định 10%/năm
}

router.get('/', requireAuth, async (req: any, res) => {
  try {
    const currentYear = parseInt(req.query.year as string) || new Date().getFullYear();
    const where: any = {
      originalPrice: { gt: 0 },
      status: { notIn: ['DA_THANH_LY'] },
    };

    if (req.user) {
      if (req.user.role === 'MANAGER_CNTT') where.managingUnit = 'CNTT';
      else if (req.user.role === 'MANAGER_DUOC') where.managingUnit = 'DUOC';
      else if (req.user.role === 'MANAGER_TCHC') where.managingUnit = 'TCHC';
      else if (req.user.role === 'DEPARTMENT' && req.user.departmentId) {
        where.departmentId = req.user.departmentId;
      }
    }

    const assets = await prisma.asset.findMany({
      where,
      include: {
        department: true,
        category: true,
      },
      orderBy: [{ originalPrice: 'desc' }, { assetCode: 'asc' }],
    });

    let totalOriginal = 0;
    let totalAnnual = 0;
    let totalAccumulated = 0;
    let totalRemaining = 0;
    let fullyDepreciatedCount = 0;

    const items = assets.map((a) => {
      const qty = a.actualQuantity ?? a.bookQuantity ?? 1;
      const unitPrice = Number(a.originalPrice) || 0;
      const totalPrice = unitPrice * qty;
      const rate = getDefaultRate(a);
      const startYear = a.yearInUse && a.yearInUse > 1990 && a.yearInUse <= currentYear ? a.yearInUse : currentYear;
      const yearsUsed = Math.max(1, currentYear - startYear + 1);
      const annualAmount = Math.round((totalPrice * rate) / 100);
      const accumulated = Math.min(totalPrice, annualAmount * yearsUsed);
      const remaining = Math.max(0, totalPrice - accumulated);
      const wornPct = totalPrice > 0 ? Math.min(100, Math.round((accumulated / totalPrice) * 100)) : 0;

      totalOriginal += totalPrice;
      totalAnnual += remaining > 0 ? annualAmount : 0;
      totalAccumulated += accumulated;
      totalRemaining += remaining;
      if (remaining === 0 && totalPrice > 0) fullyDepreciatedCount += 1;

      return {
        id: a.id,
        assetCode: a.assetCode,
        oldAssetCode: a.oldAssetCode,
        name: a.name,
        managingUnit: a.managingUnit,
        buildingAsset: a.buildingAsset,
        assetGroup: a.assetGroup,
        floor: a.floor,
        location: a.location,
        locationDetail: a.locationDetail,
        assignedTo: a.assignedTo,
        departmentId: a.departmentId,
        department: a.department,
        category: a.category,
        status: a.status,
        yearInUse: a.yearInUse || startYear,
        yearsUsed,
        quantity: qty,
        unitPrice,
        originalPrice: totalPrice,
        rate,
        annualAmount,
        accumulated,
        remaining,
        wornPct,
      };
    });

    res.json({
      year: currentYear,
      summary: {
        totalCount: items.length,
        totalOriginal,
        totalAnnual,
        totalAccumulated,
        totalRemaining,
        fullyDepreciatedCount,
      },
      items,
    });
  } catch (error) {
    console.error('Error loading depreciation list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:assetId', requireAuth, async (req, res) => {
  try {
    const history = await prisma.depreciation.findMany({
      where: { assetId: parseInt(req.params.assetId) },
      orderBy: { year: 'asc' }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/calculate', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req, res) => {
  const { assetId, year } = req.body;
  try {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || !asset.originalPrice || !asset.depreciationRate || !asset.yearInUse) {
      return res.status(400).json({ error: 'Asset missing depreciation parameters' });
    }

    const currentYear = year || new Date().getFullYear();
    const yearsInUse = currentYear - asset.yearInUse + 1;
    if (yearsInUse < 1) return res.status(400).json({ error: 'Invalid year' });

    const depreciationAmount = (asset.originalPrice * asset.depreciationRate) / 100;
    let accumulatedDepreciation = depreciationAmount * yearsInUse;
    
    if (accumulatedDepreciation > asset.originalPrice) {
      accumulatedDepreciation = asset.originalPrice;
    }

    const remainingValue = asset.originalPrice - accumulatedDepreciation;

    const depreciation = await prisma.depreciation.create({
      data: {
        assetId,
        year: currentYear,
        depreciationAmount,
        accumulatedDepreciation,
        remainingValue
      }
    });

    await prisma.asset.update({
      where: { id: assetId },
      data: { currentValue: remainingValue }
    });

    res.status(201).json(depreciation);
  } catch (error) {
    res.status(400).json({ error: 'Error calculating depreciation' });
  }
});

router.post('/calculate-all', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  const { year } = req.body;
  const currentYear = Number(year) || new Date().getFullYear();

  try {
    const where: any = {
      originalPrice: { gt: 0 },
      status: { notIn: ['DA_THANH_LY'] },
    };
    if (req.user) {
      if (req.user.role === 'MANAGER_CNTT') where.managingUnit = 'CNTT';
      else if (req.user.role === 'MANAGER_DUOC') where.managingUnit = 'DUOC';
      else if (req.user.role === 'MANAGER_TCHC') where.managingUnit = 'TCHC';
    }

    const assets = await prisma.asset.findMany({ where });

    let updatedCount = 0;
    for (const asset of assets) {
      if (!asset.originalPrice || asset.originalPrice <= 0) continue;
      const rate = getDefaultRate(asset);
      const startYear =
        asset.yearInUse && asset.yearInUse > 1990 && asset.yearInUse <= currentYear
          ? asset.yearInUse
          : currentYear;
      const yearsInUse = Math.max(1, currentYear - startYear + 1);

      const depreciationAmount = Math.round((asset.originalPrice * rate) / 100);
      const accumulatedDepreciation = Math.min(asset.originalPrice, depreciationAmount * yearsInUse);
      const remainingValue = Math.max(0, asset.originalPrice - accumulatedDepreciation);

      const existing = await prisma.depreciation.findFirst({
        where: { assetId: asset.id, year: currentYear },
      });

      if (existing) {
        await prisma.depreciation.update({
          where: { id: existing.id },
          data: {
            depreciationAmount,
            accumulatedDepreciation,
            remainingValue,
          },
        });
      } else {
        await prisma.depreciation.create({
          data: {
            assetId: asset.id,
            year: currentYear,
            depreciationAmount,
            accumulatedDepreciation,
            remainingValue,
          },
        });
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          currentValue: remainingValue,
          depreciationRate: asset.depreciationRate || rate,
        },
      });

      updatedCount += 1;
    }
    res.status(200).json({ updatedCount, year: currentYear });
  } catch (error) {
    console.error('Error calculating all depreciation:', error);
    res.status(500).json({ error: 'Error calculating all depreciation' });
  }
});

export default router;
