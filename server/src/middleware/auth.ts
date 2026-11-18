import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const JWT_SECRET = process.env.JWT_SECRET || 'qlts-cdc-danang-secret-key-2026';

export interface AuthRequest extends Request {
  user?: any;
}

export const MANAGER_UNIT_BY_ROLE: Record<string, string> = {
  MANAGER_DUOC: 'DUOC',
  MANAGER_CNTT: 'CNTT',
  MANAGER_TCHC: 'TCHC',
};

export function getManagingUnitForRole(role?: string | null): string | null {
  if (!role) return null;
  return MANAGER_UNIT_BY_ROLE[role] || null;
}

export function canAccessAssetRecord(user: any, asset: { managingUnit?: string | null; departmentId?: number | null }): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'VIEWER') return true;
  const unit = getManagingUnitForRole(user.role);
  if (unit) return asset.managingUnit === unit;
  if (user.role === 'DEPARTMENT') {
    return Boolean(user.departmentId && asset.departmentId === user.departmentId);
  }
  return false;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để truy cập hệ thống.' });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Token xác thực không hợp lệ.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: number };
    if (!decoded?.userId) {
      return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        departmentId: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị xóa.' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Từ chối truy cập: Chức năng chỉ dành cho Quản trị viên (ADMIN).' });
};

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      error: 'Bạn không có quyền thực hiện thao tác này.',
    });
  };
};
