import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, requireRoles, getManagingUnitForRole } from '../middleware/auth';
import {
  getTelegramConfig,
  sendTelegramMessage,
  sendTelegramPhotos,
  formatMaintenanceNotification,
  formatMaintenanceStatusNotification,
} from '../services/telegram';

const router = Router();
const prisma = new PrismaClient();

const maintenanceUploadDir = path.join(
  process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
  'maintenance'
);
try {
  fs.mkdirSync(maintenanceUploadDir, { recursive: true });
} catch {}

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const maintenanceUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        fs.mkdirSync(maintenanceUploadDir, { recursive: true });
      } catch {}
      cb(null, maintenanceUploadDir);
    },
    filename: (_req, file, cb) => {
      const rawExt = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_IMAGE_EXT.has(rawExt) ? rawExt : '.jpg';
      cb(null, `maint-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_IMAGE_MIME.has(file.mimetype) && (ext === '' || ALLOWED_IMAGE_EXT.has(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ hỗ trợ tệp ảnh JPG, PNG, WEBP hoặc GIF.'));
    }
  },
});

function handleMaintenanceUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.is('multipart/form-data')) return next();
  maintenanceUpload.array('photos', 3)(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Mỗi ảnh đính kèm không được vượt quá 5MB.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Chỉ được đính kèm tối đa 3 ảnh hiện trạng.' });
      }
      return res.status(400).json({ error: `Lỗi tải ảnh lên: ${err.message}` });
    }
    return res.status(400).json({ error: err.message || 'Tệp ảnh đính kèm không hợp lệ.' });
  });
}

function cleanupUploadedFiles(files?: Express.Multer.File[]) {
  if (!files || files.length === 0) return;
  for (const f of files) {
    try {
      if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
    } catch {}
  }
}

// GET /api/maintenance/stats/periodic - Báo cáo thống kê định kỳ tháng, quý, năm
router.get('/stats/periodic', requireAuth, async (req: any, res) => {
  try {
    const { year = '2026', month, quarter, departmentId, managingUnit } = req.query;

    const allRequests = await prisma.maintenanceRequest.findMany({
      include: {
        asset: { include: { category: true } },
        department: true
      },
      orderBy: { requestDate: 'desc' }
    });

    // Enforce role-based scoping for periodic stats
    let userManagingUnit = managingUnit;
    let userDepartmentId = departmentId;
    if (req.user?.role === 'MANAGER_CNTT') userManagingUnit = 'CNTT';
    else if (req.user?.role === 'MANAGER_DUOC') userManagingUnit = 'DUOC';
    else if (req.user?.role === 'MANAGER_TCHC') userManagingUnit = 'TCHC';
    else if (req.user?.role === 'DEPARTMENT' && req.user.departmentId) userDepartmentId = req.user.departmentId;

    // Filter by year, month, quarter
    let filtered = allRequests.filter(r => {
      const d = new Date(r.requestDate);
      if (year && d.getFullYear().toString() !== year.toString()) return false;
      if (month && (d.getMonth() + 1).toString() !== month.toString()) return false;
      if (quarter) {
        const q = Math.floor(d.getMonth() / 3) + 1;
        if (q.toString() !== quarter.toString()) return false;
      }
      if (userDepartmentId && userDepartmentId !== 'ALL' && r.departmentId.toString() !== userDepartmentId.toString()) return false;
      const unit = (r as any).managingUnit || (r.asset as any)?.managingUnit;
      if (userManagingUnit && userManagingUnit !== 'ALL' && unit !== userManagingUnit) return false;
      return true;
    });

    const total = filtered.length;
    const distinctAssetCount = new Set(filtered.map(r => r.assetId)).size;
    const completed = filtered.filter(r => r.status === 'COMPLETED').length;
    const inProgress = filtered.filter(r => r.status === 'IN_PROGRESS').length;
    const pending = filtered.filter(r => r.status === 'PENDING').length;
    const totalCost = filtered.reduce((sum, r) => sum + (r.repairCost || 0), 0);

    // Group by managingUnit
    const byUnit = {
      DUOC: { name: 'Khoa Dược (TBYT)', count: 0, cost: 0, completed: 0 },
      CNTT: { name: 'Tổ CNTT', count: 0, cost: 0, completed: 0 },
      TCHC: { name: 'Phòng TCHC', count: 0, cost: 0, completed: 0 }
    };

    filtered.forEach(r => {
      const unit = ((r as any).managingUnit || (r.asset as any)?.managingUnit || 'CNTT') as keyof typeof byUnit;
      if (byUnit[unit]) {
        byUnit[unit].count++;
        byUnit[unit].cost += (r.repairCost || 0);
        if (r.status === 'COMPLETED') byUnit[unit].completed++;
      }
    });

    // Group by Department
    const deptMap = new Map<number, { name: string; code: string; count: number; cost: number; completed: number }>();
    filtered.forEach(r => {
      const dId = r.departmentId;
      const dName = r.department?.name || 'CDC';
      const dCode = r.department?.code || 'CDC';
      if (!deptMap.has(dId)) {
        deptMap.set(dId, { name: dName, code: dCode, count: 0, cost: 0, completed: 0 });
      }
      const entry = deptMap.get(dId)!;
      entry.count++;
      entry.cost += (r.repairCost || 0);
      if (r.status === 'COMPLETED') entry.completed++;
    });

    res.json({
      period: { year, month: month || null, quarter: quarter || null },
      summary: { total, distinctAssetCount, completed, inProgress, pending, totalCost },
      byUnit: Object.values(byUnit),
      byDepartment: Array.from(deptMap.values()),
      records: filtered
    });
  } catch (error) {
    console.error('Error calculating periodic stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance - Danh sách yêu cầu với bộ lọc
router.get('/', requireAuth, async (req: any, res) => {
  const { departmentId, status, priority, managingUnit, assetId } = req.query;
  const where: any = {};

  if (departmentId && departmentId !== 'ALL') where.departmentId = parseInt(departmentId);
  if (status && status !== 'ALL') where.status = status;
  if (priority && priority !== 'ALL') where.priority = priority;
  if (assetId) where.assetId = parseInt(assetId);

  // Enforce role-based scoping
  let enforcedUnit = managingUnit;
  if (req.user?.role === 'MANAGER_CNTT') {
    enforcedUnit = 'CNTT';
  } else if (req.user?.role === 'MANAGER_DUOC') {
    enforcedUnit = 'DUOC';
  } else if (req.user?.role === 'MANAGER_TCHC') {
    enforcedUnit = 'TCHC';
  } else if (req.user?.role === 'DEPARTMENT' && req.user.departmentId) {
    where.departmentId = req.user.departmentId;
  }

  try {
    const requests = await prisma.maintenanceRequest.findMany({
      where,
      include: {
        asset: {
          include: {
            category: true,
            department: true
          }
        },
        department: true
      },
      orderBy: { requestDate: 'desc' }
    });

    let filtered = requests;
    if (enforcedUnit && enforcedUnit !== 'ALL') {
      filtered = filtered.filter(r => 
        (r as any).managingUnit === enforcedUnit || 
        (r.asset as any)?.managingUnit === enforcedUnit ||
        (enforcedUnit === 'DUOC' && r.asset?.categoryId === 1) ||
        (enforcedUnit === 'CNTT' && r.asset?.categoryId === 2) ||
        (enforcedUnit === 'TCHC' && (r.asset?.categoryId === 3 || r.asset?.categoryId === 4))
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance/:id - Chi tiết 1 phiếu yêu cầu
router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const request = await prisma.maintenanceRequest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        asset: { include: { category: true, department: true } },
        department: true
      }
    });
    if (!request) return res.status(404).json({ error: 'Not found' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    const reqUnit = (request as any).managingUnit || (request.asset as any)?.managingUnit;
    if (unitScope && reqUnit && reqUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn không có quyền xem phiếu sửa chữa ngoài khối chuyên trách.' });
    }
    if (req.user?.role === 'DEPARTMENT' && request.departmentId !== req.user?.departmentId) {
      return res.status(403).json({ error: 'Bạn chỉ được xem phiếu báo hỏng của Khoa/Phòng mình.' });
    }
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance - Báo hỏng / Tạo yêu cầu sửa chữa
router.post('/', requireAuth, handleMaintenanceUpload, async (req: any, res) => {
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];
  if (req.user?.role === 'VIEWER') {
    cleanupUploadedFiles(uploadedFiles);
    return res.status(403).json({ error: 'Tài khoản Chỉ xem không thể gửi báo hỏng thiết bị.' });
  }
  try {
    const {
      assetId,
      departmentId,
      requestedBy,
      contactPhone,
      locationDetail,
      issueType,
      issueDescription,
      ultraViewId,
      ultraViewPass,
      cannotOpenUltraView,
      priority,
      managingUnit,
    } = req.body;

    const cleanRequestedBy = String(requestedBy || '').trim();
    const cleanIssueDesc = String(issueDescription || '').trim();

    if (!cleanRequestedBy || !cleanIssueDesc) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ error: 'Vui lòng nhập người đề nghị và mô tả sự cố' });
    }
    if (!assetId || isNaN(parseInt(assetId))) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({ error: 'Vui lòng chọn thiết bị hư hỏng' });
    }

    const parsedAssetId = parseInt(assetId);
    const asset = await prisma.asset.findUnique({ where: { id: parsedAssetId } });
    if (!asset) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(404).json({ error: 'Không tìm thấy thiết bị cần báo hỏng' });
    }
    if (req.user?.role === 'DEPARTMENT' && asset.departmentId !== req.user.departmentId) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(403).json({ error: 'Khoa/Phòng chỉ được báo hỏng thiết bị thuộc đơn vị mình.' });
    }

    const normalizedIssueType =
      issueType === 'SOFTWARE' || issueType === 'OTHER' ? issueType : 'HARDWARE';
    const cleanUvId = typeof ultraViewId === 'string' ? ultraViewId.trim() : '';
    const cleanUvPass = typeof ultraViewPass === 'string' ? ultraViewPass.trim() : '';
    const uvUnavailable = cannotOpenUltraView === true || cannotOpenUltraView === 'true';

    if (normalizedIssueType === 'SOFTWARE' && !uvUnavailable && !cleanUvId) {
      cleanupUploadedFiles(uploadedFiles);
      return res.status(400).json({
        error: 'Với lỗi phần mềm, vui lòng nhập ID UltraViewer (hoặc đánh dấu không mở được UltraViewer).',
      });
    }

    const fallbackUnit =
      (asset as any)?.managingUnit ||
      (asset.categoryId === 1 ? 'DUOC' : asset.categoryId === 2 ? 'CNTT' : 'TCHC');
    const finalManagingUnit =
      managingUnit && managingUnit !== 'ALL' ? String(managingUnit) : fallbackUnit;
    const finalDeptId =
      req.user?.role === 'DEPARTMENT' && req.user?.departmentId
        ? req.user.departmentId
        : departmentId && !isNaN(parseInt(departmentId))
        ? parseInt(departmentId)
        : asset.departmentId || req.user?.departmentId || 1;

    const attachmentUrls = uploadedFiles.map((f) => `/uploads/maintenance/${path.basename(f.path)}`);
    const savedFilePaths = uploadedFiles.map((f) => f.path);

    const request = await prisma.maintenanceRequest.create({
      data: {
        assetId: parsedAssetId,
        departmentId: finalDeptId,
        requestedBy: cleanRequestedBy,
        contactPhone: contactPhone ? String(contactPhone).trim() : null,
        locationDetail: locationDetail ? String(locationDetail).trim() : asset.locationDetail || null,
        issueType: normalizedIssueType,
        issueDescription: cleanIssueDesc,
        ultraViewId: cleanUvId || null,
        ultraViewPass: cleanUvPass || null,
        attachments: attachmentUrls.length > 0 ? JSON.stringify(attachmentUrls) : null,
        priority: priority || 'MEDIUM',
        status: 'PENDING',
        managingUnit: finalManagingUnit,
        requestDate: new Date(),
      },
    });

    // Update asset status to BAO_TRI
    await prisma.asset.update({
      where: { id: parsedAssetId },
      data: { status: 'BAO_TRI' },
    });

    // Gửi thông báo Telegram (bất đồng bộ, không chặn response)
    (async () => {
      try {
        const [{ config: tgConfig }, notifAsset, notifDept] = await Promise.all([
          getTelegramConfig(),
          prisma.asset.findUnique({ where: { id: parsedAssetId }, include: { category: true } }),
          prisma.department.findUnique({ where: { id: finalDeptId } }),
        ]);
        if (tgConfig.enabled && tgConfig.notifyOnCreate && notifAsset && notifDept) {
          const message = formatMaintenanceNotification({
            assetCode: notifAsset.assetCode,
            assetName: notifAsset.name,
            departmentName: notifDept.name,
            locationDetail: locationDetail ? String(locationDetail).trim() : notifAsset.locationDetail,
            issueType: normalizedIssueType,
            issueDescription: cleanIssueDesc,
            ultraViewId: cleanUvId || null,
            ultraViewPass: cleanUvPass || null,
            attachmentCount: attachmentUrls.length,
            requestedBy: cleanRequestedBy,
            priority: priority || 'MEDIUM',
            managingUnit: finalManagingUnit,
            contactPhone: contactPhone ? String(contactPhone).trim() : null,
            requestDate: new Date(),
          });
          await sendTelegramMessage(message, { managingUnit: finalManagingUnit });
          if (savedFilePaths.length > 0) {
            const photoCaption = `📷 Ảnh hiện trạng phiếu #SC-${request.id} · [${notifAsset.assetCode}] ${notifAsset.name}`;
            await sendTelegramPhotos(savedFilePaths, photoCaption, { managingUnit: finalManagingUnit });
          }
        }
      } catch (tgErr: any) {
        console.error('[Telegram] Lỗi khi gửi thông báo/ảnh:', tgErr.message);
      }
    })();

    res.status(201).json(request);
  } catch (error) {
    cleanupUploadedFiles(uploadedFiles);
    console.error('Error creating maintenance request:', error);
    res.status(400).json({ error: 'Lỗi khi tạo phiếu yêu cầu sửa chữa' });
  }
});

// PUT /api/maintenance/:id/process - Quản lý / Kỹ thuật viên tiếp nhận & xử lý
router.put('/:id/process', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const { 
      status, technicianName, repairCost, repairVendor, repairNote,
      fundingSource, decisionNumber, servicePackage, replacementParts, acceptanceMembers,
      deviceStatusAfter, completedDate
    } = req.body;

    const currentReq = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { asset: { select: { managingUnit: true } } },
    });
    if (!currentReq) return res.status(404).json({ error: 'Không tìm thấy phiếu yêu cầu' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    const reqUnit = (currentReq as any).managingUnit || currentReq.asset?.managingUnit;
    if (unitScope && reqUnit && reqUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn chỉ được xử lý phiếu sửa chữa thuộc khối mình phụ trách.' });
    }

    const updateData: any = {
      status,
      technicianName: technicianName || req.user?.fullName || null,
      repairNote: repairNote !== undefined ? repairNote : currentReq.repairNote,
      repairVendor: repairVendor !== undefined ? repairVendor : currentReq.repairVendor,
      repairCost: repairCost !== undefined && repairCost !== '' ? parseFloat(repairCost) : currentReq.repairCost,
      fundingSource: fundingSource !== undefined ? fundingSource : (currentReq as any).fundingSource,
      decisionNumber: decisionNumber !== undefined ? decisionNumber : (currentReq as any).decisionNumber,
      servicePackage: servicePackage !== undefined ? servicePackage : (currentReq as any).servicePackage,
      replacementParts: replacementParts !== undefined ? replacementParts : (currentReq as any).replacementParts,
      acceptanceMembers: acceptanceMembers !== undefined ? acceptanceMembers : (currentReq as any).acceptanceMembers,
      deviceStatusAfter: deviceStatusAfter !== undefined ? deviceStatusAfter : (currentReq as any).deviceStatusAfter
    };

    if (status === 'COMPLETED') {
      updateData.completedDate = completedDate ? new Date(completedDate) : new Date();
      // Update asset back to DANG_SU_DUNG
      await prisma.asset.update({
        where: { id: currentReq.assetId },
        data: { status: 'DANG_SU_DUNG' }
      });
    } else if (status === 'IN_PROGRESS') {
      await prisma.asset.update({
        where: { id: currentReq.assetId },
        data: { status: 'BAO_TRI' }
      });
    } else if (status === 'REJECTED') {
      await prisma.asset.update({
        where: { id: currentReq.assetId },
        data: { status: 'HONG' }
      });
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: updateData,
      include: { asset: true, department: true }
    });

    if (status && status !== currentReq.status) {
      try {
        const { config: tgConfig } = await getTelegramConfig();
        if (tgConfig.enabled && tgConfig.notifyOnStatusChange && updated.asset) {
          const targetUnit = (updated as any).managingUnit || (updated.asset as any).managingUnit;
          const statusMsg = formatMaintenanceStatusNotification({
            assetCode: updated.asset.assetCode,
            assetName: updated.asset.name,
            departmentName: updated.department?.name || 'CDC Đà Nẵng',
            status: updated.status,
            technicianName: updated.technicianName,
            repairVendor: updated.repairVendor,
            repairCost: updated.repairCost,
            repairNote: updated.repairNote,
            deviceStatusAfter: (updated as any).deviceStatusAfter,
            managingUnit: targetUnit,
          });
          sendTelegramMessage(statusMsg, { managingUnit: targetUnit });
        }
      } catch (tgErr: any) {
        console.error('[Telegram] Lỗi thông báo cập nhật trạng thái:', tgErr.message);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error processing maintenance request:', error);
    res.status(400).json({ error: 'Lỗi khi xử lý phiếu yêu cầu' });
  }
});

// PUT /api/maintenance/:id - Chỉnh sửa toàn bộ nội dung phiếu bảo trì / sửa chữa
router.put('/:id', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { asset: { select: { managingUnit: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy phiếu yêu cầu' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    const reqUnit = (existing as any).managingUnit || existing.asset?.managingUnit;
    if (unitScope && reqUnit && reqUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn chỉ được chỉnh sửa phiếu sửa chữa thuộc khối mình phụ trách.' });
    }

    const {
      assetId, departmentId, requestedBy, contactPhone, locationDetail,
      issueType, issueDescription, ultraViewId, ultraViewPass,
      priority, status, repairCost, repairVendor, repairNote,
      technicianName, maintenanceType, servicePackage, replacementParts,
      acceptanceMembers, fundingSource, decisionNumber, deviceStatusAfter,
      requestDate, completedDate, managingUnit
    } = req.body;

    const data: any = {};
    if (assetId !== undefined) data.assetId = parseInt(assetId);
    if (departmentId !== undefined) data.departmentId = parseInt(departmentId);
    if (managingUnit !== undefined) data.managingUnit = managingUnit;
    if (requestedBy !== undefined) data.requestedBy = requestedBy;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (locationDetail !== undefined) data.locationDetail = locationDetail;
    if (issueType !== undefined) data.issueType = issueType;
    if (issueDescription !== undefined) data.issueDescription = issueDescription;
    if (ultraViewId !== undefined) data.ultraViewId = ultraViewId ? String(ultraViewId).trim() : null;
    if (ultraViewPass !== undefined) data.ultraViewPass = ultraViewPass ? String(ultraViewPass).trim() : null;
    if (priority !== undefined) data.priority = priority;
    if (status !== undefined) data.status = status;
    if (repairCost !== undefined) data.repairCost = repairCost !== '' && repairCost !== null ? parseFloat(repairCost) : null;
    if (repairVendor !== undefined) data.repairVendor = repairVendor;
    if (repairNote !== undefined) data.repairNote = repairNote;
    if (technicianName !== undefined) data.technicianName = technicianName;
    if (maintenanceType !== undefined) data.maintenanceType = maintenanceType;
    if (servicePackage !== undefined) data.servicePackage = servicePackage;
    if (replacementParts !== undefined) data.replacementParts = replacementParts;
    if (acceptanceMembers !== undefined) data.acceptanceMembers = acceptanceMembers;
    if (fundingSource !== undefined) data.fundingSource = fundingSource;
    if (decisionNumber !== undefined) data.decisionNumber = decisionNumber;
    if (deviceStatusAfter !== undefined) data.deviceStatusAfter = deviceStatusAfter;
    if (requestDate !== undefined) data.requestDate = new Date(requestDate);
    if (completedDate !== undefined) data.completedDate = completedDate ? new Date(completedDate) : null;

    // Synchronize asset status if status changed
    if (status && status !== existing.status) {
      const targetAssetId = data.assetId || existing.assetId;
      if (status === 'COMPLETED') {
        if (!data.completedDate && !existing.completedDate) data.completedDate = new Date();
        await prisma.asset.update({
          where: { id: targetAssetId },
          data: { status: 'DANG_SU_DUNG' }
        });
      } else if (status === 'IN_PROGRESS' || status === 'PENDING') {
        await prisma.asset.update({
          where: { id: targetAssetId },
          data: { status: 'BAO_TRI' }
        });
      } else if (status === 'REJECTED') {
        await prisma.asset.update({
          where: { id: targetAssetId },
          data: { status: 'HONG' }
        });
      }
    }

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data,
      include: { asset: true, department: true }
    });

    if (status && status !== existing.status) {
      try {
        const { config: tgConfig } = await getTelegramConfig();
        if (tgConfig.enabled && tgConfig.notifyOnStatusChange && updated.asset) {
          const targetUnit = (updated as any).managingUnit || (updated.asset as any).managingUnit;
          const statusMsg = formatMaintenanceStatusNotification({
            assetCode: updated.asset.assetCode,
            assetName: updated.asset.name,
            departmentName: updated.department?.name || 'CDC Đà Nẵng',
            status: updated.status,
            technicianName: updated.technicianName,
            repairVendor: updated.repairVendor,
            repairCost: updated.repairCost,
            repairNote: updated.repairNote,
            deviceStatusAfter: (updated as any).deviceStatusAfter,
            managingUnit: targetUnit,
          });
          sendTelegramMessage(statusMsg, { managingUnit: targetUnit });
        }
      } catch (tgErr: any) {
        console.error('[Telegram] Lỗi thông báo cập nhật phiếu:', tgErr.message);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating maintenance request:', error);
    res.status(400).json({ error: 'Lỗi khi cập nhật phiếu yêu cầu sửa chữa' });
  }
});

// DELETE /api/maintenance/:id - Xóa phiếu yêu cầu
router.delete('/:id', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { asset: { select: { managingUnit: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy phiếu yêu cầu' });
    const unitScope = getManagingUnitForRole(req.user?.role);
    const reqUnit = (existing as any).managingUnit || existing.asset?.managingUnit;
    if (unitScope && reqUnit && reqUnit !== unitScope) {
      return res.status(403).json({ error: 'Bạn không có quyền xóa phiếu sửa chữa ngoài khối phụ trách.' });
    }
    await prisma.maintenanceRequest.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting maintenance request:', error);
    res.status(400).json({ error: 'Lỗi khi xóa phiếu yêu cầu' });
  }
});

export default router;
