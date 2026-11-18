import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin, JWT_SECRET } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
  }

  const cleanUsername = username.toString().trim().toLowerCase();
  const cleanPassword = password.toString().trim();

  try {
    let user = await prisma.user.findFirst({
      where: { username: cleanUsername }
    });

    // If user does not exist in SQLite database (e.g. fresh volume on Coolify), auto-create from default directory
    if (!user) {
      const defaultUserMap: Record<string, { role: string; fullName: string; deptCode?: string }> = {
        'admin': { role: 'ADMIN', fullName: 'Admin' },
        'manager_duoc': { role: 'MANAGER_DUOC', fullName: 'Quản Lý Tài Sản - Khoa Dược (TBYT)' },
        'manager_cntt': { role: 'MANAGER_CNTT', fullName: 'Quản Lý Tài Sản - Tổ CNTT' },
        'manager_tchc': { role: 'MANAGER_TCHC', fullName: 'Quản Lý Tài Sản - Phòng TCHC' },
        'pkdk': { role: 'DEPARTMENT', fullName: 'Phòng Khám Đa Khoa', deptCode: 'PKDK' },
        'xn': { role: 'DEPARTMENT', fullName: 'Khoa Xét Nghiệm - CĐHA - TDCN', deptCode: 'XN' },
        'bnn': { role: 'DEPARTMENT', fullName: 'Khoa Bệnh Nghề Nghiệp', deptCode: 'BNN' },
        'dd': { role: 'DEPARTMENT', fullName: 'Khoa Dinh Dưỡng', deptCode: 'DD' },
        'skmt': { role: 'DEPARTMENT', fullName: 'Khoa Sức Khỏe Môi Trường - YTTH', deptCode: 'SKMT' },
        'skss': { role: 'DEPARTMENT', fullName: 'Khoa Sức Khỏe Sinh Sản', deptCode: 'SKSS' },
        'khnv': { role: 'DEPARTMENT', fullName: 'Phòng Kế Hoạch Nghiệp Vụ', deptCode: 'KHNV' },
        'ttgdsk': { role: 'DEPARTMENT', fullName: 'Khoa Truyền Thông Giáo Dục Sức Khỏe', deptCode: 'TTGDSK' },
        'kstct': { role: 'DEPARTMENT', fullName: 'Khoa Ký Sinh Trùng - Côn Trùng', deptCode: 'KSTCT' },
        'pcbkln': { role: 'DEPARTMENT', fullName: 'Khoa Phòng Chống Bệnh Không Lây Nhiễm', deptCode: 'PCBKLN' },
        'dvtyt': { role: 'DEPARTMENT', fullName: 'Khoa Dược - Vật Tư Y Tế', deptCode: 'DVTYT' },
        'hiv': { role: 'DEPARTMENT', fullName: 'Khoa HIV/AIDS và QLĐTNC', deptCode: 'HIV' },
        'pcbtn': { role: 'DEPARTMENT', fullName: 'Khoa Phòng Chống Bệnh Truyền Nhiễm', deptCode: 'PCBTN' },
        'tckt': { role: 'DEPARTMENT', fullName: 'Phòng Tài Chính - Kế Toán', deptCode: 'TCKT' },
        'tchc': { role: 'DEPARTMENT', fullName: 'Phòng Tổ Chức - Hành Chính', deptCode: 'TCHC' },
        'kdytqt': { role: 'DEPARTMENT', fullName: 'Khoa Kiểm Dịch Y Tế Quốc Tế', deptCode: 'KDYTQT' },
      };

      const predefined = defaultUserMap[cleanUsername];
      if (predefined) {
        let deptId = null;
        if (predefined.deptCode) {
          const dept = await prisma.department.findUnique({ where: { code: predefined.deptCode } });
          if (dept) deptId = dept.id;
        }
        const hashedPassword = await bcrypt.hash(cleanUsername === 'admin' ? 'admin123' : '123456', 10);
        user = await prisma.user.create({
          data: {
            username: cleanUsername,
            password: hashedPassword,
            fullName: predefined.fullName,
            role: predefined.role,
            departmentId: deptId
          }
        });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    // Check password match strictly via bcrypt
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(cleanPassword, user.password);
    } catch {}

    if (!isMatch) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, departmentId: user.departmentId, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        departmentId: user.departmentId
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const detail = error?.message || 'Database connection error';
    res.status(500).json({ 
      error: `Lỗi kết nối cơ sở dữ liệu: ${detail}. Vui lòng kiểm tra chuỗi kết nối DATABASE_URL trên Coolify.` 
    });
  }
});

router.post('/register', requireAuth, requireAdmin, async (req, res) => {
  const { username, password, fullName, role, departmentId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword, fullName, role, departmentId }
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'Error creating user' });
  }
});

// POST /api/auth/change-password - Tự đổi mật khẩu của chính user đang đăng nhập
router.post('/change-password', requireAuth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
    }

    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng' });
    }

    // Verify current password strictly via bcrypt
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } catch {}

    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: newHashedPassword }
    });

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Lỗi máy chủ khi đổi mật khẩu' });
  }
});

router.get('/me', requireAuth, async (req: any, res) => {
  res.json({ user: req.user });
});

export default router;
