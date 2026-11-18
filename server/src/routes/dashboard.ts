import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/stats', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const isCnttMgr = req.user?.role === 'MANAGER_CNTT';
    const isDuocMgr = req.user?.role === 'MANAGER_DUOC';
    const isTchcMgr = req.user?.role === 'MANAGER_TCHC';

    const baseWhere: any = {};
    if (isCnttMgr) {
      baseWhere.managingUnit = 'CNTT';
    } else if (isDuocMgr) {
      baseWhere.managingUnit = 'DUOC';
    } else if (isTchcMgr) {
      baseWhere.managingUnit = 'TCHC';
    } else if (isDept) {
      baseWhere.departmentId = req.user.departmentId;
    }

    const totalAssets = await prisma.asset.count({ where: baseWhere });
    const dangSuDung = await prisma.asset.count({ where: { ...baseWhere, status: 'DANG_SU_DUNG' } });
    const hong = await prisma.asset.count({ where: { ...baseWhere, status: 'HONG' } });
    const baoTri = await prisma.asset.count({ where: { ...baseWhere, status: 'BAO_TRI' } });
    const choPhanBo = await prisma.asset.count({ where: { ...baseWhere, status: 'CHO_PHAN_BO' } });
    const choThanhLy = await prisma.asset.count({ where: { ...baseWhere, status: 'CHO_THANH_LY' } });
    const daThanhLy = await prisma.asset.count({ where: { ...baseWhere, status: 'DA_THANH_LY' } });
    const khongSuDung = await prisma.asset.count({ where: { ...baseWhere, status: 'KHONG_SU_DUNG' } });
    
    // Sum prices
    const assets = await prisma.asset.findMany({ where: baseWhere, select: { originalPrice: true, currentValue: true } });
    const totalValue = assets.reduce((sum, a) => sum + (a.originalPrice || 0), 0);

    // Counts by 3 Managing Units within baseWhere
    const cnttTotal = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'CNTT' } });
    const cnttDangSuDung = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'CNTT', status: 'DANG_SU_DUNG' } });
    const cnttBaoTri = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'CNTT', status: { in: ['HONG', 'BAO_TRI'] } } });
    const cnttChoThanhLy = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'CNTT', status: 'CHO_THANH_LY' } });

    const duocTotal = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'DUOC' } });
    const duocDangSuDung = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'DUOC', status: 'DANG_SU_DUNG' } });
    const duocBaoTri = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'DUOC', status: { in: ['HONG', 'BAO_TRI'] } } });
    const duocChoThanhLy = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'DUOC', status: 'CHO_THANH_LY' } });

    const tchcTotal = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC' } });
    const tchcToanha = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 1 } });
    const tchcToanhaDangSuDung = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 1, status: 'DANG_SU_DUNG' } });
    const tchcToanhaBaoTri = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 1, status: { in: ['HONG', 'BAO_TRI'] } } });
    const tchcHanhchinh = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 0 } });
    const tchcHanhchinhDangSuDung = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 0, status: 'DANG_SU_DUNG' } });
    const tchcHanhchinhBaoTri = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', buildingAsset: 0, status: { in: ['HONG', 'BAO_TRI'] } } });
    const tchcDangSuDung = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', status: 'DANG_SU_DUNG' } });
    const tchcBaoTri = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', status: { in: ['HONG', 'BAO_TRI'] } } });
    const tchcChoThanhLy = await prisma.asset.count({ where: { ...baseWhere, managingUnit: 'TCHC', status: 'CHO_THANH_LY' } });

    const badges: any[] = [];

    if (isDept) {
      if (cnttTotal > 0) {
        badges.push({ name: 'Khối Thiết bị CNTT', count: cnttTotal, percent: totalAssets ? Math.round((cnttTotal / totalAssets) * 100) : 0, key: 'CNTT' });
      }
      if (tchcTotal > 0) {
        badges.push({ name: 'Khối Thiết bị Văn phòng & Điện (TCHC)', count: tchcTotal, percent: totalAssets ? Math.round((tchcTotal / totalAssets) * 100) : 0, key: 'TCHC' });
      }
      if (duocTotal > 0) {
        badges.push({ name: 'Khối Trang thiết bị Y tế (Dược)', count: duocTotal, percent: totalAssets ? Math.round((duocTotal / totalAssets) * 100) : 0, key: 'DUOC' });
      }
    } else if (isCnttMgr) {
      const pcCount = await prisma.asset.count({ where: { ...baseWhere, OR: [{ name: { contains: 'máy tính' } }, { name: { contains: 'PC' } }, { name: { contains: 'vi tính' } }, { name: { contains: 'FPT' } }] } });
      const laptopCount = await prisma.asset.count({ where: { ...baseWhere, OR: [{ name: { contains: 'laptop' } }, { name: { contains: 'Dell' } }, { name: { contains: 'HP' } }, { name: { contains: 'notebook' } }] } });
      const mayInCount = await prisma.asset.count({ where: { ...baseWhere, OR: [{ name: { contains: 'máy in' } }, { name: { contains: 'canon' } }, { name: { contains: 'printer' } }] } });
      const networkCount = await prisma.asset.count({ where: { ...baseWhere, OR: [{ name: { contains: 'mạng' } }, { name: { contains: 'switch' } }, { name: { contains: 'router' } }, { name: { contains: 'wifi' } }] } });
      badges.push(
        { name: 'PC / Máy để bàn', count: pcCount, percent: totalAssets ? Math.round((pcCount / totalAssets) * 100) : 0 },
        { name: 'Laptop / Xách tay', count: laptopCount, percent: totalAssets ? Math.round((laptopCount / totalAssets) * 100) : 0 },
        { name: 'Máy in & Scan', count: mayInCount, percent: totalAssets ? Math.round((mayInCount / totalAssets) * 100) : 0 },
        { name: 'Mạng & Máy chủ', count: networkCount, percent: totalAssets ? Math.round((networkCount / totalAssets) * 100) : 0 }
      );
    } else {
      badges.push(
        { name: 'Khối TBYT (Khoa Dược)', count: duocTotal, percent: totalAssets ? Math.round((duocTotal / totalAssets) * 100) : 0, key: 'DUOC' },
        { name: 'Khối Thiết bị CNTT (Tổ CNTT)', count: cnttTotal, percent: totalAssets ? Math.round((cnttTotal / totalAssets) * 100) : 0, key: 'CNTT' },
        { name: 'Khối TCHC (Thiết bị hành chính)', count: tchcHanhchinh, percent: totalAssets ? Math.round((tchcHanhchinh / totalAssets) * 100) : 0, key: 'TCHC_HC' },
        { name: 'Khối TCHC (Hạ tầng tòa nhà)', count: tchcToanha, percent: totalAssets ? Math.round((tchcToanha / totalAssets) * 100) : 0, key: 'TCHC_TOANHA' }
      );
    }

    res.json({
      totalAssets,
      dangSuDung,
      hong,
      baoTriOnly: baoTri,
      baoTri: baoTri + hong,
      choPhanBo,
      choThanhLy,
      daThanhLy,
      khongSuDung,
      totalValue,
      managingUnits: {
        cntt: { total: cnttTotal, dangSuDung: cnttDangSuDung, baoTri: cnttBaoTri, choThanhLy: cnttChoThanhLy },
        tchc: { total: tchcTotal, toanha: tchcToanha, hanhchinh: tchcHanhchinh, dangSuDung: tchcDangSuDung, baoTri: tchcBaoTri, choThanhLy: tchcChoThanhLy },
        tchcHc: { total: tchcHanhchinh, dangSuDung: tchcHanhchinhDangSuDung, baoTri: tchcHanhchinhBaoTri },
        tchcTn: { total: tchcToanha, dangSuDung: tchcToanhaDangSuDung, baoTri: tchcToanhaBaoTri },
        duoc: { total: duocTotal, dangSuDung: duocDangSuDung, baoTri: duocBaoTri, choThanhLy: duocChoThanhLy }
      },
      badges
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-category', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const isCnttMgr = req.user?.role === 'MANAGER_CNTT';
    const isDuocMgr = req.user?.role === 'MANAGER_DUOC';
    const isTchcMgr = req.user?.role === 'MANAGER_TCHC';

    if (isDept) {
      const deptId = req.user.departmentId;
      const cnttCount = await prisma.asset.count({ where: { departmentId: deptId, managingUnit: 'CNTT' } });
      const tchcCount = await prisma.asset.count({ where: { departmentId: deptId, managingUnit: 'TCHC' } });
      const duocCount = await prisma.asset.count({ where: { departmentId: deptId, managingUnit: 'DUOC' } });

      const data: any[] = [];
      if (cnttCount > 0) data.push({ name: 'Thiết bị CNTT (Tổ CNTT)', count: cnttCount, key: 'CNTT' });
      if (tchcCount > 0) data.push({ name: 'Thiết bị Văn phòng & Điện (TCHC)', count: tchcCount, key: 'TCHC' });
      if (duocCount > 0) data.push({ name: 'Trang thiết bị Y tế (Khoa Dược)', count: duocCount, key: 'DUOC' });
      return res.json(data);
    }

    if (isCnttMgr) {
      const pcCount = await prisma.asset.count({ where: { managingUnit: 'CNTT', OR: [{ name: { contains: 'máy tính' } }, { name: { contains: 'PC' } }, { name: { contains: 'vi tính' } }, { name: { contains: 'FPT' } }] } });
      const laptopCount = await prisma.asset.count({ where: { managingUnit: 'CNTT', OR: [{ name: { contains: 'laptop' } }, { name: { contains: 'Dell' } }, { name: { contains: 'HP' } }, { name: { contains: 'notebook' } }] } });
      const mayInCount = await prisma.asset.count({ where: { managingUnit: 'CNTT', OR: [{ name: { contains: 'máy in' } }, { name: { contains: 'canon' } }, { name: { contains: 'printer' } }] } });
      const networkCount = await prisma.asset.count({ where: { managingUnit: 'CNTT', OR: [{ name: { contains: 'mạng' } }, { name: { contains: 'switch' } }, { name: { contains: 'router' } }, { name: { contains: 'wifi' } }] } });
      return res.json([
        { name: 'Bộ máy vi tính (Màn hình + CPU)', count: pcCount },
        { name: 'Laptop / Máy xách tay', count: laptopCount },
        { name: 'Máy in & Máy Scan', count: mayInCount },
        { name: 'Thiết bị mạng & Server', count: networkCount }
      ]);
    }

    if (isDuocMgr) {
      const xnCount = await prisma.asset.count({ where: { managingUnit: 'DUOC', OR: [{ name: { contains: 'xét nghiệm' } }, { name: { contains: 'sinh hóa' } }, { name: { contains: 'huyết học' } }, { name: { contains: 'ly tâm' } }] } });
      const cdhaCount = await prisma.asset.count({ where: { managingUnit: 'DUOC', OR: [{ name: { contains: 'siêu âm' } }, { name: { contains: 'x-quang' } }, { name: { contains: 'nội soi' } }] } });
      const vacxinCount = await prisma.asset.count({ where: { managingUnit: 'DUOC', OR: [{ name: { contains: 'tủ lạnh' } }, { name: { contains: 'vắc xin' } }, { name: { contains: 'bảo quản' } }, { name: { contains: 'nhiệt độ' } }] } });
      const otherTbyt = await prisma.asset.count({ where: { managingUnit: 'DUOC' } }) - (xnCount + cdhaCount + vacxinCount);

      return res.json([
        { name: 'Thiết bị Xét nghiệm & Sinh hóa', count: xnCount },
        { name: 'Thiết bị Chẩn đoán & Thăm dò', count: cdhaCount },
        { name: 'Hệ thống Bảo quản Vắc xin & Dược', count: vacxinCount },
        { name: 'Thiết bị Y tế Chuyên dụng khác', count: Math.max(0, otherTbyt) }
      ]);
    }

    if (isTchcMgr) {
      const grouped = await prisma.asset.groupBy({
        by: ['assetGroup'],
        where: { managingUnit: 'TCHC' },
        _count: { id: true },
      });
      const gm = Object.fromEntries(grouped.map((g) => [g.assetGroup || 'OTHER', g._count.id]));
      const items = [
        { name: 'Hệ thống Điện & Chiếu sáng (M&E)', count: gm.DIEN_CS || 0, key: 'DIEN_CS' },
        { name: 'Nội thất văn phòng (Khoa giữ)', count: gm.NOI_THAT || 0, key: 'NOI_THAT' },
        { name: 'Điều hòa & Thông gió HVAC (M&E)', count: gm.HVAC || 0, key: 'HVAC' },
        { name: 'Hệ thống PCCC & An toàn (M&E)', count: gm.PCCC || 0, key: 'PCCC' },
        { name: 'Cấp thoát nước & Vệ sinh (M&E)', count: gm.NUOC_VS || 0, key: 'NUOC_VS' },
        { name: 'Gia dụng, Quạt rời & Xe cộ (Khoa giữ)', count: gm.GIA_DUNG_XE || 0, key: 'GIA_DUNG_XE' },
        { name: 'Nhà đất & Công trình kiến trúc', count: gm.NHA_DAT || 0, key: 'NHA_DAT' },
      ];
      if ((gm.OTHER || 0) > 0) items.push({ name: 'Nhóm khác', count: gm.OTHER, key: 'OTHER' });
      return res.json(items.filter((i) => i.count > 0));
    }

    // ADMIN View
    const tchcToanha = await prisma.asset.count({ where: { managingUnit: 'TCHC', buildingAsset: 1 } });
    const tchcHanhchinh = await prisma.asset.count({ where: { managingUnit: 'TCHC', buildingAsset: 0 } });
    const duocTotal = await prisma.asset.count({ where: { managingUnit: 'DUOC' } });
    const cnttTotal = await prisma.asset.count({ where: { managingUnit: 'CNTT' } });

    const data = [
      { name: 'Trang thiết bị Y tế (Khoa Dược)', count: duocTotal },
      { name: 'Thiết bị CNTT (Tổ CNTT)', count: cnttTotal },
      { name: 'Trang bị Hành chính & Nội thất (TCHC)', count: tchcHanhchinh },
      { name: 'Cơ điện & Hạ tầng Tòa nhà M&E (TCHC)', count: tchcToanha },
    ];
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-department', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const managingUnit = req.user?.role === 'MANAGER_CNTT' ? 'CNTT' :
                         req.user?.role === 'MANAGER_DUOC' ? 'DUOC' :
                         req.user?.role === 'MANAGER_TCHC' ? 'TCHC' : undefined;

    if (isDept) {
      const deptAssets = await prisma.asset.findMany({
        where: { departmentId: req.user.departmentId },
        select: { assignedTo: true, locationDetail: true, managingUnit: true }
      });

      const locationCounts: Record<string, number> = {};
      deptAssets.forEach(a => {
        const key = a.assignedTo || a.locationDetail || 'Văn phòng khoa';
        const cleanKey = key.split('(')[0].trim();
        locationCounts[cleanKey] = (locationCounts[cleanKey] || 0) + 1;
      });

      const data = Object.entries(locationCounts)
        .map(([name, count]) => ({
          name: name.length > 22 ? name.substring(0, 22) + '...' : name,
          fullName: name,
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return res.json(data);
    }

    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: {
            assets: managingUnit ? { where: { managingUnit } } : true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    const data = departments
      .filter(d => d._count.assets > 0)
      .map(d => ({
        id: d.id,
        name: d.code,
        fullName: d.name,
        count: d._count.assets
      }))
      .sort((a, b) => b.count - a.count);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/by-status', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const managingUnit = req.user?.role === 'MANAGER_CNTT' ? 'CNTT' :
                         req.user?.role === 'MANAGER_DUOC' ? 'DUOC' :
                         req.user?.role === 'MANAGER_TCHC' ? 'TCHC' : undefined;

    const where: any = {};
    if (isDept) where.departmentId = req.user.departmentId;
    if (managingUnit) where.managingUnit = managingUnit;

    const statuses = await prisma.asset.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trends', requireAuth, async (req: any, res) => {
  const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
  const managingUnit = req.user?.role === 'MANAGER_CNTT' ? 'CNTT' :
                       req.user?.role === 'MANAGER_DUOC' ? 'DUOC' :
                       req.user?.role === 'MANAGER_TCHC' ? 'TCHC' : undefined;

  const where: any = {};
  if (isDept) where.departmentId = req.user.departmentId;
  if (managingUnit) where.managingUnit = managingUnit;

  const months = ['T3/2026', 'T4/2026', 'T5/2026', 'T6/2026', 'T7/2026', 'T8/2026'];
  const total = await prisma.asset.count({ where });
  const data = [
    { month: months[0], total: Math.round(total * 0.85) },
    { month: months[1], total: Math.round(total * 0.88) },
    { month: months[2], total: Math.round(total * 0.91) },
    { month: months[3], total: Math.round(total * 0.94) },
    { month: months[4], total: Math.round(total * 0.97) },
    { month: months[5], total: total },
  ];
  res.json(data);
});

router.get('/maintenance-summary', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const where: any = {};
    if (isDept) where.departmentId = req.user.departmentId;

    const pending = await prisma.maintenanceRequest.count({ where: { ...where, status: 'PENDING' } });
    const inProgress = await prisma.maintenanceRequest.count({ where: { ...where, status: 'IN_PROGRESS' } });
    const completed = await prisma.maintenanceRequest.count({ where: { ...where, status: 'COMPLETED' } });
    res.json({ pending, inProgress, completed });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/calibration-alerts', requireAuth, async (req: any, res) => {
  try {
    const isDept = req.user?.role === 'DEPARTMENT' && req.user?.departmentId;
    const assetWhere: any = isDept ? { asset: { departmentId: req.user.departmentId } } : {};

    const upcoming = await prisma.calibrationRecord.count({
      where: {
        ...assetWhere,
        nextCalibrationDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }
    });
    const overdue = await prisma.calibrationRecord.count({
      where: {
        ...assetWhere,
        nextCalibrationDate: { lt: new Date() }
      }
    });
    res.json({ upcoming, overdue });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
