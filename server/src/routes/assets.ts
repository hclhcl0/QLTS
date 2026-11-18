import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRoles, canAccessAssetRecord } from '../middleware/auth';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { syncCnttRecords } from '../syncCnttData';

const router = Router();
const prisma = new PrismaClient();
const viCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

const FLOOR_ORDER_MAP: Record<string, number> = {
  'Tầng Hầm': 1,
  'Tầng 1': 2,
  'Tầng 2': 3,
  'Tầng 3': 4,
  'Tầng 4': 5,
  'Tầng 5': 6,
  'Tầng 6': 7,
  'Tầng 7': 8,
  'Tầng Mái': 9,
  'Khối phụ trợ (KLCTN)': 10,
};

const FUNCTION_ORDER_MAP: Record<string, number> = {
  DUOC: 1,
  CNTT: 2,
  NOI_THAT: 3,
  GIA_DUNG_XE: 4,
  DIEN_CS: 5,
  HVAC: 6,
  PCCC: 7,
  NUOC_VS: 8,
  NHA_DAT: 9,
};

const FUNCTION_LABELS: Record<string, string> = {
  DUOC: 'Trang thiết bị Y tế (Khoa Dược)',
  CNTT: 'Thiết bị CNTT (Tổ CNTT)',
  NOI_THAT: 'Nội thất & Bàn ghế (TCHC)',
  GIA_DUNG_XE: 'Gia dụng, Quạt rời & Xe (TCHC)',
  DIEN_CS: 'Hệ thống Điện & Chiếu sáng (M&E)',
  HVAC: 'Điều hòa & Thông gió HVAC (M&E)',
  PCCC: 'Hệ thống PCCC & An toàn (M&E)',
  NUOC_VS: 'Cấp thoát nước & Vệ sinh (M&E)',
  NHA_DAT: 'Nhà đất & Công trình kiến trúc (TCHC)',
};

const STATUS_ORDER_MAP: Record<string, number> = {
  DANG_SU_DUNG: 1,
  BAO_TRI: 2,
  HONG: 3,
  CHO_THANH_LY: 4,
  CHO_PHAN_BO: 5,
  KHONG_SU_DUNG: 6,
};

function stripVi(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function parsePriceValue(raw: string): number | null {
  const clean = stripVi(raw).replace(/,/g, '.');
  const m = clean.match(/^(\d+(?:\.\d+)?)\s*(ty|t|trieu|tr|m|nghin|ngan|k|d)?$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2] || '';
  if (unit === 'ty' || unit === 't') return num * 1_000_000_000;
  if (unit === 'trieu' || unit === 'tr' || unit === 'm') return num * 1_000_000;
  if (unit === 'nghin' || unit === 'ngan' || unit === 'k') return num * 1_000;
  return num;
}

export function buildSmartAssetSearch(rawSearch: string): any[] {
  const andConditions: any[] = [];
  const q = rawSearch.normalize('NFC').trim();
  if (!q) return andConditions;

  // Match quoted phrases or whitespace tokens
  const rawTokens = q.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

  for (const rawTok of rawTokens) {
    const tok = rawTok.replace(/^"|"$/g, '').trim();
    if (!tok) continue;

    const colonIdx = tok.indexOf(':');
    if (colonIdx > 0 && colonIdx < tok.length - 1) {
      const key = stripVi(tok.slice(0, colonIdx));
      const val = tok.slice(colonIdx + 1).trim();
      const valNorm = stripVi(val);

      if (['tang', 'floor', 't'].includes(key)) {
        if (['none', 'khong', 'chung', 'null'].includes(valNorm)) {
          andConditions.push({ OR: [{ floor: null }, { floor: '' }] });
        } else if (valNorm === 'ham' || valNorm === 'tangham') {
          andConditions.push({ floor: { contains: 'Hầm', mode: 'insensitive' } });
        } else if (valNorm === 'mai' || valNorm === 'tangmai') {
          andConditions.push({ floor: { contains: 'Mái', mode: 'insensitive' } });
        } else if (valNorm.includes('klctn') || valNorm.includes('phutro')) {
          andConditions.push({ floor: { contains: 'KLCTN', mode: 'insensitive' } });
        } else if (/^\d+$/.test(valNorm)) {
          andConditions.push({ floor: `Tầng ${valNorm}` });
        } else {
          andConditions.push({ floor: { contains: val, mode: 'insensitive' } });
        }
        continue;
      }

      if (['khoa', 'phong', 'dept', 'kp'].includes(key)) {
        andConditions.push({
          department: {
            is: {
              OR: [
                { name: { contains: val, mode: 'insensitive' } },
                { code: { contains: val, mode: 'insensitive' } },
              ],
            },
          },
        });
        continue;
      }

      if (['dv', 'donvi', 'khoi', 'unit'].includes(key)) {
        if (valNorm.includes('duoc') || valNorm.includes('tbyt') || valNorm.includes('yte')) {
          andConditions.push({ managingUnit: 'DUOC' });
        } else if (valNorm.includes('cntt') || valNorm === 'it') {
          andConditions.push({ managingUnit: 'CNTT' });
        } else if (valNorm.includes('toanha') || valNorm.includes('me') || valNorm.includes('codien')) {
          andConditions.push({ managingUnit: 'TCHC', buildingAsset: 1 });
        } else if (valNorm.includes('hc') || valNorm.includes('hanhchinh')) {
          andConditions.push({ managingUnit: 'TCHC', buildingAsset: 0 });
        } else if (valNorm.includes('tchc')) {
          andConditions.push({ managingUnit: 'TCHC' });
        } else {
          andConditions.push({ managingUnit: { contains: val, mode: 'insensitive' } });
        }
        continue;
      }

      if (['nhom', 'chucnang', 'group', 'loai'].includes(key)) {
        if (valNorm.includes('noithat') || valNorm.includes('banghe')) {
          andConditions.push({ assetGroup: 'NOI_THAT' });
        } else if (valNorm.includes('giadung') || valNorm.includes('xe')) {
          andConditions.push({ assetGroup: 'GIA_DUNG_XE' });
        } else if (valNorm.includes('dien') || valNorm.includes('den')) {
          andConditions.push({ assetGroup: 'DIEN_CS' });
        } else if (valNorm.includes('hvac') || valNorm.includes('dieuhoa') || valNorm.includes('maylanh')) {
          andConditions.push({ assetGroup: 'HVAC' });
        } else if (valNorm.includes('pccc') || valNorm.includes('chuachay')) {
          andConditions.push({ assetGroup: 'PCCC' });
        } else if (valNorm.includes('nuoc') || valNorm.includes('vesinh')) {
          andConditions.push({ assetGroup: 'NUOC_VS' });
        } else if (valNorm.includes('nhadat') || valNorm === 'dat' || valNorm === 'nha') {
          andConditions.push({ assetGroup: 'NHA_DAT' });
        } else if (valNorm.includes('duoc') || valNorm.includes('tbyt')) {
          andConditions.push({ managingUnit: 'DUOC' });
        } else if (valNorm.includes('cntt') || valNorm === 'it') {
          andConditions.push({ managingUnit: 'CNTT' });
        } else {
          andConditions.push({ assetGroup: { contains: val.toUpperCase(), mode: 'insensitive' } });
        }
        continue;
      }

      if (['cs', 'coso', 'location'].includes(key)) {
        if (valNorm === '1' || valNorm === 'cs1') {
          andConditions.push({ location: { contains: 'Cơ sở 1', mode: 'insensitive' } });
        } else if (valNorm === '2' || valNorm === 'cs2') {
          andConditions.push({ location: { contains: 'Cơ sở 2', mode: 'insensitive' } });
        } else {
          andConditions.push({ location: { contains: val, mode: 'insensitive' } });
        }
        continue;
      }

      if (['nam', 'year'].includes(key)) {
        const rangeMatch = val.match(/^(\d{4})-(\d{4})$/);
        const opMatch = val.match(/^(>=|<=|>|<|=)?(\d{4})$/);
        if (rangeMatch) {
          andConditions.push({
            yearInUse: { gte: parseInt(rangeMatch[1], 10), lte: parseInt(rangeMatch[2], 10) },
          });
        } else if (opMatch) {
          const op = opMatch[1] || '=';
          const yr = parseInt(opMatch[2], 10);
          if (op === '>') andConditions.push({ yearInUse: { gt: yr } });
          else if (op === '>=') andConditions.push({ yearInUse: { gte: yr } });
          else if (op === '<') andConditions.push({ yearInUse: { lt: yr } });
          else if (op === '<=') andConditions.push({ yearInUse: { lte: yr } });
          else andConditions.push({ yearInUse: yr });
        }
        continue;
      }

      if (['gia', 'price', 'nguyengia'].includes(key)) {
        const opMatch = val.match(/^(>=|<=|>|<|=)?(.+)$/);
        if (opMatch) {
          const op = opMatch[1] || '>=';
          const parsed = parsePriceValue(opMatch[2]);
          if (parsed !== null) {
            if (op === '>') andConditions.push({ originalPrice: { gt: parsed } });
            else if (op === '>=') andConditions.push({ originalPrice: { gte: parsed } });
            else if (op === '<') andConditions.push({ originalPrice: { lt: parsed } });
            else if (op === '<=') andConditions.push({ originalPrice: { lte: parsed } });
            else andConditions.push({ originalPrice: parsed });
          }
        }
        continue;
      }

      if (['tt', 'trangthai', 'status'].includes(key)) {
        if (valNorm.includes('hong')) andConditions.push({ status: 'HONG' });
        else if (valNorm.includes('baotri') || valNorm.includes('sua')) andConditions.push({ status: 'BAO_TRI' });
        else if (valNorm.includes('thanhly')) andConditions.push({ status: 'CHO_THANH_LY' });
        else if (valNorm.includes('tot') || valNorm.includes('sd') || valNorm.includes('dang')) {
          andConditions.push({ status: 'DANG_SU_DUNG' });
        }
        continue;
      }
    }

    // Standard multi-field token matching across 14+ fields & semantic aliases
    const tokNorm = stripVi(tok);
    const orClauses: any[] = [
      { name: { contains: tok, mode: 'insensitive' } },
      { assetCode: { contains: tok, mode: 'insensitive' } },
      { oldAssetCode: { contains: tok, mode: 'insensitive' } },
      { assignedTo: { contains: tok, mode: 'insensitive' } },
      { location: { contains: tok, mode: 'insensitive' } },
      { locationDetail: { contains: tok, mode: 'insensitive' } },
      { floor: { contains: tok, mode: 'insensitive' } },
      { specifications: { contains: tok, mode: 'insensitive' } },
      { manufacturer: { contains: tok, mode: 'insensitive' } },
      { countryOfOrigin: { contains: tok, mode: 'insensitive' } },
      { note: { contains: tok, mode: 'insensitive' } },
      { assetGroup: { contains: tok, mode: 'insensitive' } },
      { managingUnit: { contains: tok, mode: 'insensitive' } },
      {
        department: {
          is: {
            OR: [
              { name: { contains: tok, mode: 'insensitive' } },
              { code: { contains: tok, mode: 'insensitive' } },
            ],
          },
        },
      },
      {
        category: {
          is: {
            name: { contains: tok, mode: 'insensitive' },
          },
        },
      },
    ];

    if (/^\d{4}$/.test(tok)) {
      orClauses.push({ yearInUse: parseInt(tok, 10) });
    }
    if (tokNorm === 'hvac' || tokNorm === 'maylanh' || tokNorm === 'dieuhoa') {
      orClauses.push({ assetGroup: 'HVAC' });
    } else if (tokNorm === 'pccc') {
      orClauses.push({ assetGroup: 'PCCC' });
    } else if (tokNorm === 'noithat') {
      orClauses.push({ assetGroup: 'NOI_THAT' });
    } else if (tokNorm === 'giadung') {
      orClauses.push({ assetGroup: 'GIA_DUNG_XE' });
    } else if (tokNorm === 'cntt' || tokNorm === 'it') {
      orClauses.push({ managingUnit: 'CNTT' });
    } else if (tokNorm === 'tbyt' || tokNorm === 'duoc') {
      orClauses.push({ managingUnit: 'DUOC' });
    } else if (tokNorm === 'tchc') {
      orClauses.push({ managingUnit: 'TCHC' });
    }

    andConditions.push({ OR: orClauses });
  }

  return andConditions;
}

function getFunctionKey(a: any): string {
  if (a.managingUnit === 'DUOC') return 'DUOC';
  if (a.managingUnit === 'CNTT') return 'CNTT';
  return a.assetGroup || (a.buildingAsset === 1 ? 'DIEN_CS' : 'NOI_THAT');
}

function getUnitScopeKey(a: any): string {
  if (a.managingUnit === 'DUOC') return 'DUOC';
  if (a.managingUnit === 'CNTT') return 'CNTT';
  return a.buildingAsset === 1 ? 'TCHC_TOANHA' : 'TCHC_HC';
}

function compareByField(a: any, b: any, field: string, order: 'asc' | 'desc'): number {
  const dir = order === 'desc' ? -1 : 1;
  let cmp = 0;

  switch (field) {
    case 'floor': {
      const fa = a.floor ? (FLOOR_ORDER_MAP[a.floor] ?? 50) : 99;
      const fb = b.floor ? (FLOOR_ORDER_MAP[b.floor] ?? 50) : 99;
      if (fa === 99 && fb === 99) cmp = 0;
      else if (fa === 99) return 1; // keep unassigned floor at bottom
      else if (fb === 99) return -1;
      else cmp = fa - fb;
      break;
    }
    case 'function':
    case 'assetGroup': {
      const ga = FUNCTION_ORDER_MAP[getFunctionKey(a)] ?? 99;
      const gb = FUNCTION_ORDER_MAP[getFunctionKey(b)] ?? 99;
      cmp = ga - gb;
      break;
    }
    case 'managingUnit': {
      const orderUnit: Record<string, number> = {
        DUOC: 1,
        CNTT: 2,
        TCHC_HC: 3,
        TCHC_TOANHA: 4,
      };
      cmp = (orderUnit[getUnitScopeKey(a)] ?? 9) - (orderUnit[getUnitScopeKey(b)] ?? 9);
      break;
    }
    case 'department': {
      const da = a.department?.name || '';
      const db = b.department?.name || '';
      if (!da && !db) cmp = 0;
      else if (!da) return 1;
      else if (!db) return -1;
      else cmp = viCollator.compare(da, db);
      break;
    }
    case 'location': {
      const la = [a.location || '', a.floor || '', a.locationDetail || ''].join(' · ');
      const lb = [b.location || '', b.floor || '', b.locationDetail || ''].join(' · ');
      cmp = viCollator.compare(la, lb);
      break;
    }
    case 'assignedTo': {
      const ua = a.assignedTo || a.locationDetail || a.department?.name || '';
      const ub = b.assignedTo || b.locationDetail || b.department?.name || '';
      cmp = viCollator.compare(ua, ub);
      break;
    }
    case 'name': {
      cmp = viCollator.compare(a.name || '', b.name || '');
      break;
    }
    case 'oldAssetCode': {
      const oa = a.oldAssetCode || '';
      const ob = b.oldAssetCode || '';
      if (!oa && !ob) cmp = 0;
      else if (!oa) return 1;
      else if (!ob) return -1;
      else cmp = viCollator.compare(oa, ob);
      break;
    }
    case 'originalPrice':
    case 'price': {
      const pa = Number(a.originalPrice) || 0;
      const pb = Number(b.originalPrice) || 0;
      if (pa <= 0 && pb <= 0) cmp = 0;
      else if (pa <= 0) return 1; // always keep unpriced items at the bottom
      else if (pb <= 0) return -1;
      else cmp = pa - pb;
      break;
    }
    case 'totalValue': {
      const ta = (Number(a.originalPrice) || 0) * (a.actualQuantity ?? a.bookQuantity ?? 1);
      const tb = (Number(b.originalPrice) || 0) * (b.actualQuantity ?? b.bookQuantity ?? 1);
      if (ta <= 0 && tb <= 0) cmp = 0;
      else if (ta <= 0) return 1;
      else if (tb <= 0) return -1;
      else cmp = ta - tb;
      break;
    }
    case 'yearInUse': {
      const ya = Number(a.yearInUse) || 0;
      const yb = Number(b.yearInUse) || 0;
      if (!ya && !yb) cmp = 0;
      else if (!ya) return 1;
      else if (!yb) return -1;
      else cmp = ya - yb;
      break;
    }
    case 'status': {
      const sa = STATUS_ORDER_MAP[a.status || 'DANG_SU_DUNG'] ?? 99;
      const sb = STATUS_ORDER_MAP[b.status || 'DANG_SU_DUNG'] ?? 99;
      cmp = sa - sb;
      break;
    }
    case 'assetCode':
    default: {
      cmp = viCollator.compare(a.assetCode || '', b.assetCode || '');
      break;
    }
  }

  return cmp * dir;
}

export function sortAssetsMultiLevel(
  list: any[],
  sortBy = 'assetCode',
  sortOrder: 'asc' | 'desc' = 'asc',
  sortBy2 = '',
  sortOrder2: 'asc' | 'desc' = 'asc'
): any[] {
  return [...list].sort((a, b) => {
    const primary = compareByField(a, b, sortBy, sortOrder);
    if (primary !== 0) return primary;
    if (sortBy2 && sortBy2 !== sortBy) {
      const secondary = compareByField(a, b, sortBy2, sortOrder2);
      if (secondary !== 0) return secondary;
    }
    return viCollator.compare(a.assetCode || '', b.assetCode || '');
  });
}

router.get('/', requireAuth, async (req: any, res) => {
  const {
    search,
    categoryId,
    departmentId,
    status,
    location,
    managingUnit,
    floor,
    buildingAsset,
    assetGroup,
    sortBy = 'assetCode',
    sortOrder = 'asc',
    sortBy2 = '',
    sortOrder2 = 'asc',
    groupBy = '',
    page = '1',
    limit = '15',
  } = req.query;

  const andFilters: any[] = [];

  if (search && typeof search === 'string' && search.trim()) {
    andFilters.push(...buildSmartAssetSearch(search));
  }
  if (categoryId && !isNaN(parseInt(categoryId as string))) {
    andFilters.push({ categoryId: parseInt(categoryId as string) });
  }
  if (departmentId && !isNaN(parseInt(departmentId as string))) {
    andFilters.push({ departmentId: parseInt(departmentId as string) });
  }
  if (status && typeof status === 'string' && status.trim()) {
    const parts = status.split(',').map((s) => s.trim()).filter(Boolean);
    andFilters.push({ status: parts.length > 1 ? { in: parts } : parts[0] });
  }
  if (location && typeof location === 'string' && location.trim()) {
    andFilters.push({ location: location.trim() });
  }
  if (managingUnit && typeof managingUnit === 'string' && managingUnit.trim()) {
    andFilters.push({ managingUnit: managingUnit.trim() });
  }
  if (buildingAsset !== undefined && buildingAsset !== '') {
    andFilters.push({ buildingAsset: parseInt(buildingAsset as string) || 0 });
  }
  if (assetGroup && typeof assetGroup === 'string' && assetGroup.trim()) {
    const parts = assetGroup.split(',').map((s) => s.trim()).filter(Boolean);
    andFilters.push({ assetGroup: parts.length > 1 ? { in: parts } : parts[0] });
  }

  // Strict Role-based access control
  if (req.user) {
    if (req.user.role === 'MANAGER_CNTT') {
      andFilters.push({ managingUnit: 'CNTT' });
    } else if (req.user.role === 'MANAGER_DUOC') {
      andFilters.push({ managingUnit: 'DUOC' });
    } else if (req.user.role === 'MANAGER_TCHC') {
      andFilters.push({ managingUnit: 'TCHC' });
    } else if (req.user.role === 'DEPARTMENT' && req.user.departmentId) {
      andFilters.push({ departmentId: req.user.departmentId });
    }
  }

  // Floor filter applied after base filters so we can also compute floor facet counts cleanly
  const baseWhere: any = andFilters.length > 0 ? { AND: andFilters } : {};
  const fullAndFilters = [...andFilters];
  if (floor && typeof floor === 'string' && floor.trim() && floor !== 'Tất cả tầng') {
    const fl = floor.trim();
    if (fl === 'NONE' || fl === 'Chưa gắn tầng') {
      fullAndFilters.push({ OR: [{ floor: null }, { floor: '' }] });
    } else {
      fullAndFilters.push({ floor: fl });
    }
  }
  const where: any = fullAndFilters.length > 0 ? { AND: fullAndFilters } : {};

  try {
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.max(1, parseInt(limit as string) || 15);
    const validSortOrder: 'asc' | 'desc' =
      (sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    const validSortOrder2: 'asc' | 'desc' =
      (sortOrder2 as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';

    // Fetch base matched records & floor distribution in parallel
    const [allMatched, floorGroupCounts] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          category: true,
          department: true,
        },
      }),
      prisma.asset.groupBy({
        by: ['floor'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);

    const sortedAll = sortAssetsMultiLevel(
      allMatched,
      String(sortBy || 'assetCode'),
      validSortOrder,
      String(sortBy2 || ''),
      validSortOrder2
    );

    const total = sortedAll.length;
    const assets = sortedAll.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    // Build live facets
    const floorFacets: Record<string, number> = {};
    for (const fg of floorGroupCounts) {
      const k = fg.floor && fg.floor.trim() ? fg.floor.trim() : 'NONE';
      floorFacets[k] = (floorFacets[k] || 0) + fg._count._all;
    }

    const functionFacets: Record<string, number> = {};
    const statusFacets: Record<string, number> = {};
    let totalValuation = 0;
    for (const item of sortedAll) {
      const fk = getFunctionKey(item);
      functionFacets[fk] = (functionFacets[fk] || 0) + 1;
      const sk = item.status || 'DANG_SU_DUNG';
      statusFacets[sk] = (statusFacets[sk] || 0) + 1;
      totalValuation += (Number(item.originalPrice) || 0) * (item.actualQuantity ?? item.bookQuantity ?? 1);
    }

    // Build optional group-by buckets when requested
    let groups: any[] | undefined = undefined;
    if (groupBy && typeof groupBy === 'string' && groupBy.trim()) {
      const gMode = groupBy.trim();
      const map = new Map<
        string,
        {
          key: string;
          label: string;
          subtitle: string;
          order: number;
          count: number;
          totalQty: number;
          totalValue: number;
          healthyCount: number;
          issueCount: number;
          items: any[];
        }
      >();

      for (const item of sortedAll) {
        let gKey = 'OTHER';
        let gLabel = 'Khác';
        let gSub = '';
        let gOrder = 50;

        if (gMode === 'floor') {
          gKey = item.floor && item.floor.trim() ? item.floor.trim() : 'NONE';
          gLabel = gKey === 'NONE' ? 'Dùng chung / Chưa gắn tầng cụ thể' : gKey;
          gSub = gKey === 'NONE' ? 'Thiết bị lưu động hoặc hạ tầng toàn nhà' : 'Không gian vật lý theo tầng';
          gOrder = gKey === 'NONE' ? 99 : (FLOOR_ORDER_MAP[gKey] ?? 50);
        } else if (gMode === 'function') {
          gKey = getFunctionKey(item);
          gLabel = FUNCTION_LABELS[gKey] || gKey;
          gSub =
            item.managingUnit === 'DUOC'
              ? 'Khoa Dược quản lý'
              : item.managingUnit === 'CNTT'
              ? 'Tổ CNTT quản lý'
              : item.buildingAsset === 1
              ? 'Phòng TCHC · Cơ điện & Hạ tầng M&E'
              : 'Phòng TCHC · Trang bị Hành chính Khoa';
          gOrder = FUNCTION_ORDER_MAP[gKey] ?? 50;
        } else if (gMode === 'managingUnit') {
          gKey = getUnitScopeKey(item);
          if (gKey === 'DUOC') {
            gLabel = 'Khối Khoa Dược (Trang thiết bị Y tế)';
            gSub = 'Thiết bị xét nghiệm, chẩn đoán, dây chuyền lạnh, chuyên môn y tế';
            gOrder = 1;
          } else if (gKey === 'CNTT') {
            gLabel = 'Khối Tổ CNTT (Thiết bị Công nghệ thông tin)';
            gSub = 'Máy tính, laptop, máy in, mạng, phần mềm tại 16 khoa/phòng';
            gOrder = 2;
          } else if (gKey === 'TCHC_HC') {
            gLabel = 'Khối Phòng TCHC · Trang bị Hành chính (Khoa giữ)';
            gSub = 'Nội thất bàn ghế, tủ kệ, gia dụng, quạt rời, xe phục vụ';
            gOrder = 3;
          } else {
            gLabel = 'Khối Phòng TCHC · Cơ điện & Hạ tầng Tòa nhà (M&E)';
            gSub = 'Hệ thống Điện, Chiếu sáng, Điều hòa HVAC, PCCC, Cấp thoát nước';
            gOrder = 4;
          }
        } else if (gMode === 'department') {
          gKey = item.departmentId ? String(item.departmentId) : 'NONE';
          gLabel = item.department?.name || 'Chưa phân bổ Khoa / Phòng';
          gSub = item.department?.code ? `Mã đơn vị: ${item.department.code}` : '';
          gOrder = item.departmentId || 999;
        } else if (gMode === 'location') {
          gKey = item.location || 'Cơ sở 1';
          gLabel = gKey;
          gSub = gKey.includes('1') ? '118 Lê Đình Lý' : 'Cơ sở Bàn Thạch';
          gOrder = gKey.includes('1') ? 1 : 2;
        }

        let bucket = map.get(gKey);
        if (!bucket) {
          bucket = {
            key: gKey,
            label: gLabel,
            subtitle: gSub,
            order: gOrder,
            count: 0,
            totalQty: 0,
            totalValue: 0,
            healthyCount: 0,
            issueCount: 0,
            items: [],
          };
          map.set(gKey, bucket);
        }
        const qty = item.actualQuantity ?? item.bookQuantity ?? 1;
        bucket.count += 1;
        bucket.totalQty += qty;
        bucket.totalValue += (Number(item.originalPrice) || 0) * qty;
        if (!item.status || item.status === 'DANG_SU_DUNG') bucket.healthyCount += 1;
        else if (['HONG', 'BAO_TRI', 'CHO_THANH_LY'].includes(item.status)) bucket.issueCount += 1;
        if (bucket.items.length < 40) {
          bucket.items.push(item);
        }
      }

      groups = Array.from(map.values()).sort((a, b) => {
        if (gMode === 'department') return viCollator.compare(a.label, b.label);
        return a.order - b.order;
      });
    }

    res.json({
      total,
      totalValuation,
      page: pageNum,
      limit: limitNum,
      assets,
      facets: {
        floors: floorFacets,
        functions: functionFacets,
        statuses: statusFacets,
      },
      groups,
    });
  } catch (error) {
    console.error('Error in /api/assets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const rawParam = req.params.id;
    const isNum = /^\d+$/.test(rawParam);

    const asset = await prisma.asset.findFirst({
      where: isNum ? { id: parseInt(rawParam) } : { assetCode: rawParam },
      include: {
        category: true,
        department: true,
        transfers: { include: { fromDepartment: true, toDepartment: true } },
        maintenanceRequests: true,
        calibrations: true,
        depreciations: true
      }
    });

    if (!asset) return res.status(404).json({ error: 'Không tìm thấy thiết bị yêu cầu.' });
    if (!canAccessAssetRecord(req.user, asset)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem thông tin tài sản ngoài phạm vi quản lý.' });
    }
    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset detail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, requireRoles('ADMIN', 'MANAGER_DUOC', 'MANAGER_CNTT', 'MANAGER_TCHC'), async (req: any, res) => {
  try {
    const {
      assetCode, oldAssetCode, name, categoryId, departmentId, location, locationDetail,
      assignedTo, yearInUse, originalPrice, currentValue, depreciationRate,
      manufacturer, countryOfOrigin, specifications, status, managingUnit,
      floor, buildingAsset, assetGroup, bookQuantity, actualQuantity, quantityDifference,
      source, fundingSource, decisionNumber, note
    } = req.body;

    let finalManagingUnit = managingUnit || 'TCHC';
    if (req.user) {
      if (req.user.role === 'MANAGER_CNTT') finalManagingUnit = 'CNTT';
      else if (req.user.role === 'MANAGER_DUOC') finalManagingUnit = 'DUOC';
      else if (req.user.role === 'MANAGER_TCHC') finalManagingUnit = 'TCHC';
    }

    const data: any = {
      assetCode: (assetCode || '').trim(),
      oldAssetCode: oldAssetCode ? oldAssetCode.trim() : null,
      name: (name || '').trim(),
      categoryId: parseInt(categoryId) || 1,
      departmentId: parseInt(departmentId) || 1,
      managingUnit: finalManagingUnit,
      location: location || 'Cơ sở 1',
      locationDetail: locationDetail || null,
      assignedTo: assignedTo || null,
      yearInUse: yearInUse ? parseInt(yearInUse) : null,
      originalPrice: originalPrice !== '' && originalPrice !== null && originalPrice !== undefined ? parseFloat(originalPrice) : null,
      currentValue: currentValue !== '' && currentValue !== null && currentValue !== undefined ? parseFloat(currentValue) : null,
      depreciationRate: depreciationRate !== '' && depreciationRate !== null && depreciationRate !== undefined ? parseFloat(depreciationRate) : null,
      manufacturer: manufacturer || null,
      countryOfOrigin: countryOfOrigin || null,
      specifications: specifications || null,
      status: status || 'DANG_SU_DUNG',
      floor: floor || null,
      buildingAsset: parseInt(buildingAsset) || 0,
      assetGroup: assetGroup || null,
      bookQuantity: parseInt(bookQuantity) || 1,
      actualQuantity: parseInt(actualQuantity) || 1,
      quantityDifference: parseInt(quantityDifference) || 0,
      source: source || null,
      fundingSource: fundingSource || 'Nguồn ngân sách nhà nước cấp',
      decisionNumber: decisionNumber || null,
      note: note || null,
      qrCode: uuidv4()
    };

    const asset = await prisma.asset.create({ data });
    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(400).json({ error: 'Lỗi khi tạo mới tài sản' });
  }
});

router.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const rawId = req.params.id;
    const isNum = /^\d+$/.test(rawId);
    const existing = await prisma.asset.findFirst({
      where: isNum ? { id: parseInt(rawId) } : { assetCode: rawId }
    });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy tài sản' });

    // Enforce role isolation
    if (req.user && req.user.role !== 'ADMIN') {
      if (req.user.role === 'MANAGER_CNTT' && existing.managingUnit !== 'CNTT') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền chỉnh sửa tài sản thuộc Khối CNTT' });
      }
      if (req.user.role === 'MANAGER_DUOC' && existing.managingUnit !== 'DUOC') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền chỉnh sửa tài sản thuộc Khối Khoa Dược (TBYT)' });
      }
      if (req.user.role === 'MANAGER_TCHC' && existing.managingUnit !== 'TCHC') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền chỉnh sửa tài sản thuộc Khối Phòng TCHC' });
      }
    }

    const {
      assetCode, oldAssetCode, name, categoryId, departmentId, location, locationDetail,
      assignedTo, yearInUse, originalPrice, currentValue, depreciationRate,
      manufacturer, countryOfOrigin, specifications, status, managingUnit,
      floor, buildingAsset, assetGroup, bookQuantity, actualQuantity, quantityDifference,
      source, fundingSource, decisionNumber, note
    } = req.body;

    const data: any = {};
    if (assetCode !== undefined) data.assetCode = assetCode.trim();
    if (oldAssetCode !== undefined) data.oldAssetCode = oldAssetCode ? oldAssetCode.trim() : null;
    if (name !== undefined) data.name = name.trim();
    if (categoryId !== undefined) data.categoryId = parseInt(categoryId);
    if (departmentId !== undefined) data.departmentId = parseInt(departmentId);
    if (location !== undefined) data.location = location;
    if (locationDetail !== undefined) data.locationDetail = locationDetail;
    if (assignedTo !== undefined) data.assignedTo = assignedTo;
    if (yearInUse !== undefined) data.yearInUse = yearInUse ? parseInt(yearInUse) : null;
    if (originalPrice !== undefined) data.originalPrice = originalPrice !== '' && originalPrice !== null ? parseFloat(originalPrice) : null;
    if (currentValue !== undefined) data.currentValue = currentValue !== '' && currentValue !== null ? parseFloat(currentValue) : null;
    if (depreciationRate !== undefined) data.depreciationRate = depreciationRate !== '' && depreciationRate !== null ? parseFloat(depreciationRate) : null;
    if (manufacturer !== undefined) data.manufacturer = manufacturer;
    if (countryOfOrigin !== undefined) data.countryOfOrigin = countryOfOrigin;
    if (specifications !== undefined) data.specifications = specifications;
    if (status !== undefined) data.status = status;
    if (floor !== undefined) data.floor = floor;
    if (buildingAsset !== undefined) data.buildingAsset = parseInt(buildingAsset) || 0;
    if (assetGroup !== undefined) data.assetGroup = assetGroup || null;
    if (bookQuantity !== undefined) data.bookQuantity = parseInt(bookQuantity) || 1;
    if (actualQuantity !== undefined) data.actualQuantity = parseInt(actualQuantity) || 1;
    if (quantityDifference !== undefined) data.quantityDifference = parseInt(quantityDifference) || 0;
    if (source !== undefined) data.source = source;
    if (fundingSource !== undefined) data.fundingSource = fundingSource;
    if (decisionNumber !== undefined) data.decisionNumber = decisionNumber;
    if (note !== undefined) data.note = note;

    if (req.user) {
      if (req.user.role === 'MANAGER_CNTT') data.managingUnit = 'CNTT';
      else if (req.user.role === 'MANAGER_DUOC') data.managingUnit = 'DUOC';
      else if (req.user.role === 'MANAGER_TCHC') data.managingUnit = 'TCHC';
      else if (managingUnit !== undefined) data.managingUnit = managingUnit;
    }

    const updated = await prisma.asset.update({
      where: { id: existing.id },
      data
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(400).json({ error: 'Lỗi khi cập nhật tài sản' });
  }
});

router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const rawId = req.params.id;
    const isNum = /^\d+$/.test(rawId);
    const existing = await prisma.asset.findFirst({
      where: isNum ? { id: parseInt(rawId) } : { assetCode: rawId }
    });
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy tài sản' });

    if (req.user && req.user.role !== 'ADMIN') {
      if (req.user.role === 'MANAGER_CNTT' && existing.managingUnit !== 'CNTT') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa tài sản thuộc Khối CNTT' });
      }
      if (req.user.role === 'MANAGER_DUOC' && existing.managingUnit !== 'DUOC') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa tài sản thuộc Khối Khoa Dược' });
      }
      if (req.user.role === 'MANAGER_TCHC' && existing.managingUnit !== 'TCHC') {
        return res.status(403).json({ error: 'Bạn chỉ có quyền xóa tài sản thuộc Khối Phòng TCHC' });
      }
    }

    await prisma.asset.delete({ where: { id: existing.id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(400).json({ error: 'Error deleting asset' });
  }
});

function resolveQrBaseUrl(req: any, overrideBaseUrl?: string): string {
  if (typeof overrideBaseUrl === 'string' && /^https?:\/\/[^/\s]+/i.test(overrideBaseUrl.trim())) {
    return overrideBaseUrl.trim().replace(/\/+$/, '');
  }
  const originHeader = req.headers?.origin;
  if (typeof originHeader === 'string' && /^https?:\/\/[^/\s]+/i.test(originHeader)) {
    return originHeader.replace(/\/+$/, '');
  }
  const referer = req.headers?.referer;
  if (typeof referer === 'string') {
    try {
      return new URL(referer).origin;
    } catch {}
  }
  const protoHeader = (req.headers?.['x-forwarded-proto'] as string) || req.protocol || 'http';
  const proto = protoHeader.split(',')[0].trim();
  const hostHeader = (req.headers?.['x-forwarded-host'] as string) || (req.get ? req.get('host') : '');
  const host = hostHeader ? hostHeader.split(',')[0].trim() : 'localhost:5173';
  return `${proto}://${host}`;
}

function buildOfflineQrText(asset: any, fields?: string[]): string {
  const useAll = !Array.isArray(fields) || fields.length === 0;
  const has = (k: string) => useAll || fields!.includes(k);

  const lines: string[] = ['CDC DA NANG', `Ma TS: ${asset.assetCode}`];
  if (has('oldCode') && asset.oldAssetCode) lines.push(`Ma cu: ${asset.oldAssetCode}`);
  if (has('name') && asset.name) lines.push(`Ten: ${asset.name}`);
  if (has('dept') && asset.department?.name) lines.push(`Khoa: ${asset.department.name}`);
  if (has('floorLocation')) {
    const loc = [asset.floor, asset.locationDetail || asset.location].filter(Boolean).join(' - ');
    if (loc) lines.push(`Vi tri: ${loc}`);
  }
  if (has('assignedTo') && asset.assignedTo) lines.push(`Nguoi SD: ${asset.assignedTo}`);
  if (has('year') && asset.yearInUse) lines.push(`Nam SD: ${asset.yearInUse}`);
  if (has('specs')) {
    const sp = asset.specifications || asset.manufacturer;
    if (sp) lines.push(`Thong so: ${String(sp).slice(0, 60)}`);
  }
  if (has('price') && asset.originalPrice && Number(asset.originalPrice) > 0) {
    lines.push(`Gia: ${Number(asset.originalPrice).toLocaleString('vi-VN')} VND`);
  }
  return lines.join('\n');
}

router.post('/qr-batch', requireAuth, async (req: any, res) => {
  try {
    const rawIds: unknown[] = Array.isArray(req.body?.assetIds) ? req.body.assetIds : [];
    const uniqueIds = Array.from(
      new Set(rawIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))
    ).slice(0, 500);

    if (uniqueIds.length === 0) {
      return res.json({ qrMap: {}, baseUrl: '', count: 0 });
    }

    const qrMode: 'url' | 'code' | 'text' =
      req.body?.qrMode === 'code' ? 'code' : req.body?.qrMode === 'text' ? 'text' : 'url';
    const textFields: string[] | undefined = Array.isArray(req.body?.textFields) ? req.body.textFields : undefined;
    const baseUrl = resolveQrBaseUrl(req, req.body?.baseUrl);

    const allRows = await prisma.asset.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        assetCode: true,
        oldAssetCode: true,
        name: true,
        managingUnit: true,
        departmentId: true,
        floor: true,
        location: true,
        locationDetail: true,
        assignedTo: true,
        yearInUse: true,
        originalPrice: true,
        specifications: true,
        manufacturer: true,
        department: { select: { name: true } },
      },
    });
    const rows = allRows.filter((r) => canAccessAssetRecord(req.user, r));

    const qrMap: Record<number, string> = {};
    const chunkSize = 25;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      await Promise.all(
        slice.map(async (asset) => {
          const payload =
            qrMode === 'code'
              ? asset.assetCode
              : qrMode === 'text'
              ? buildOfflineQrText(asset, textFields)
              : `${baseUrl}/qr/${encodeURIComponent(asset.assetCode)}`;
          qrMap[asset.id] = await QRCode.toDataURL(payload, {
            width: qrMode === 'text' ? 280 : 240,
            margin: 1,
            errorCorrectionLevel: qrMode === 'text' ? 'L' : 'M',
          });
        })
      );
    }

    res.json({ qrMap, baseUrl, qrMode, count: rows.length });
  } catch (error) {
    console.error('Error in batch QR generation:', error);
    res.status(500).json({ error: 'Lỗi tạo mã QR hàng loạt' });
  }
});

router.get('/:id/qr', requireAuth, async (req: any, res) => {
  try {
    const rawParam = req.params.id;
    const isNum = /^\d+$/.test(rawParam);
    const asset = await prisma.asset.findFirst({
      where: isNum ? { id: parseInt(rawParam) } : { assetCode: rawParam },
      include: { department: { select: { name: true } } },
    });
    if (!asset) return res.status(404).json({ error: 'Not found' });
    if (!canAccessAssetRecord(req.user, asset)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập mã QR của thiết bị này.' });
    }

    const qrMode: 'url' | 'code' | 'text' =
      req.query.qrMode === 'code' ? 'code' : req.query.qrMode === 'text' ? 'text' : 'url';
    const baseUrl = resolveQrBaseUrl(req, req.query.baseUrl as string | undefined);
    const payload =
      qrMode === 'code'
        ? asset.assetCode
        : qrMode === 'text'
        ? buildOfflineQrText(asset)
        : `${baseUrl}/qr/${encodeURIComponent(asset.assetCode)}`;
    const qrCodeImage = await QRCode.toDataURL(payload, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: qrMode === 'text' ? 'L' : 'M',
    });
    res.json({ qrCode: qrCodeImage, payload });
  } catch (error) {
    console.error('Error in QR generation:', error);
    res.status(500).json({ error: 'Error generating QR code' });
  }
});

router.get('/by-qr/:code', requireAuth, async (req: any, res) => {
  try {
    const asset = await prisma.asset.findFirst({
      where: {
        OR: [
          { assetCode: req.params.code },
          { qrCode: req.params.code }
        ]
      },
      include: {
        category: true,
        department: true,
        transfers: { include: { fromDepartment: true, toDepartment: true } },
        maintenanceRequests: true,
        calibrations: true,
        depreciations: true
      }
    });
    if (!asset) return res.status(404).json({ error: 'Not found' });
    if (!canAccessAssetRecord(req.user, asset)) {
      return res.status(403).json({ error: 'Bạn không có quyền xem thông tin thiết bị ngoài phạm vi đơn vị.' });
    }
    res.json(asset);
  } catch (error) {
    console.error('Error fetching by qr:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sync-cntt', requireAuth, async (req: any, res) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER_CNTT') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối' });
  }
  try {
    const result = await syncCnttRecords(prisma, true);
    res.json(result);
  } catch (error: any) {
    console.error('Error syncing CNTT assets:', error);
    res.status(500).json({ error: error.message || 'Lỗi đồng bộ tài sản CNTT' });
  }
});

router.get('/sync-cntt', requireAuth, async (req: any, res) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER_CNTT') {
    return res.status(403).json({ error: 'Quyền truy cập bị từ chối' });
  }
  try {
    const result = await syncCnttRecords(prisma, true);
    res.json(result);
  } catch (error: any) {
    console.error('Error syncing CNTT assets:', error);
    res.status(500).json({ error: error.message || 'Lỗi đồng bộ tài sản CNTT' });
  }
});

export default router;

