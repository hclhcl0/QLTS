import { Asset, TCHC_GROUP_META } from '../types';

const viCollator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export const FLOOR_ORDER_MAP: Record<string, number> = {
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

export const FLOOR_PILL_OPTIONS: { value: string; shortLabel: string; fullLabel: string }[] = [
  { value: 'Tất cả tầng', shortLabel: 'Tất cả', fullLabel: 'Tất cả tầng' },
  { value: 'Tầng Hầm', shortLabel: 'Hầm', fullLabel: 'Tầng Hầm' },
  { value: 'Tầng 1', shortLabel: 'T1', fullLabel: 'Tầng 1' },
  { value: 'Tầng 2', shortLabel: 'T2', fullLabel: 'Tầng 2' },
  { value: 'Tầng 3', shortLabel: 'T3', fullLabel: 'Tầng 3' },
  { value: 'Tầng 4', shortLabel: 'T4', fullLabel: 'Tầng 4' },
  { value: 'Tầng 5', shortLabel: 'T5', fullLabel: 'Tầng 5' },
  { value: 'Tầng 6', shortLabel: 'T6', fullLabel: 'Tầng 6' },
  { value: 'Tầng 7', shortLabel: 'T7', fullLabel: 'Tầng 7' },
  { value: 'Tầng Mái', shortLabel: 'Mái', fullLabel: 'Tầng Mái' },
  { value: 'Khối phụ trợ (KLCTN)', shortLabel: 'KLCTN', fullLabel: 'Khối phụ trợ (KLCTN)' },
  { value: 'NONE', shortLabel: 'Dùng chung', fullLabel: 'Chưa gắn tầng / Dùng chung' },
];

export const FUNCTION_ORDER_MAP: Record<string, number> = {
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

export const FUNCTION_LABELS: Record<string, string> = {
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

export const FUNCTION_BADGE_MAP: Record<string, { label: string; className: string }> = {
  DUOC: { label: 'TBYT · Dược', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CNTT: { label: 'Thiết bị CNTT', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  NOI_THAT: { label: TCHC_GROUP_META.NOI_THAT.label, className: TCHC_GROUP_META.NOI_THAT.badgeClass },
  GIA_DUNG_XE: { label: TCHC_GROUP_META.GIA_DUNG_XE.label, className: TCHC_GROUP_META.GIA_DUNG_XE.badgeClass },
  DIEN_CS: { label: TCHC_GROUP_META.DIEN_CS.label, className: TCHC_GROUP_META.DIEN_CS.badgeClass },
  HVAC: { label: TCHC_GROUP_META.HVAC.label, className: TCHC_GROUP_META.HVAC.badgeClass },
  PCCC: { label: TCHC_GROUP_META.PCCC.label, className: TCHC_GROUP_META.PCCC.badgeClass },
  NUOC_VS: { label: TCHC_GROUP_META.NUOC_VS.label, className: TCHC_GROUP_META.NUOC_VS.badgeClass },
  NHA_DAT: { label: TCHC_GROUP_META.NHA_DAT.label, className: TCHC_GROUP_META.NHA_DAT.badgeClass },
};

const STATUS_ORDER_MAP: Record<string, number> = {
  DANG_SU_DUNG: 1,
  BAO_TRI: 2,
  HONG: 3,
  CHO_THANH_LY: 4,
  CHO_PHAN_BO: 5,
  KHONG_SU_DUNG: 6,
};

export const SUPER_SORT_FIELDS: {
  value: string;
  label: string;
  ascLabel: string;
  descLabel: string;
}[] = [
  { value: 'assetCode', label: 'Mã tài sản (Chuẩn tự nhiên)', ascLabel: 'Mã TS (01 → 99)', descLabel: 'Mã TS (99 → 01)' },
  { value: 'floor', label: 'Tầng tòa nhà (Trục vật lý)', ascLabel: 'Hầm → T1..T7 → Mái', descLabel: 'Mái → T7..T1 → Hầm' },
  { value: 'function', label: 'Chức năng / Nhóm chuyên môn', ascLabel: 'TBYT → CNTT → Nội thất → M&E', descLabel: 'M&E → Nội thất → CNTT → TBYT' },
  { value: 'managingUnit', label: 'Đơn vị quản lý (Khối)', ascLabel: 'Dược → CNTT → TCHC HC → M&E', descLabel: 'M&E → TCHC HC → CNTT → Dược' },
  { value: 'department', label: 'Khoa / Phòng sử dụng', ascLabel: 'Khoa/Phòng (A → Z)', descLabel: 'Khoa/Phòng (Z → A)' },
  { value: 'name', label: 'Tên thiết bị', ascLabel: 'Tên TS (A → Z)', descLabel: 'Tên TS (Z → A)' },
  { value: 'originalPrice', label: 'Nguyên giá', ascLabel: 'Nguyên giá (Thấp → Cao)', descLabel: 'Nguyên giá (Cao → Thấp)' },
  { value: 'totalValue', label: 'Tổng thành tiền', ascLabel: 'Thành tiền (Thấp → Cao)', descLabel: 'Thành tiền (Cao → Thấp)' },
  { value: 'yearInUse', label: 'Năm đưa vào sử dụng', ascLabel: 'Năm SD (Cũ → Mới)', descLabel: 'Năm SD (Mới → Cũ)' },
  { value: 'status', label: 'Tình trạng vận hành', ascLabel: 'Đang SD → Bảo trì → Hỏng', descLabel: 'Hỏng / Thanh lý lên đầu' },
  { value: 'location', label: 'Cơ sở & Vị trí đặt', ascLabel: 'Cơ sở 1 → Cơ sở 2', descLabel: 'Cơ sở 2 → Cơ sở 1' },
  { value: 'oldAssetCode', label: 'Mã tài sản cũ', ascLabel: 'Mã cũ (A → Z)', descLabel: 'Mã cũ (Z → A)' },
];

export const GROUP_BY_OPTIONS: { value: string; label: string; shortLabel: string }[] = [
  { value: '', label: 'Danh sách phẳng (Không gom)', shortLabel: 'Bảng phẳng' },
  { value: 'function', label: 'Gom theo Nhóm chức năng (TBYT · CNTT · 6 nhóm TCHC)', shortLabel: 'Theo Chức năng' },
  { value: 'floor', label: 'Gom theo Tầng tòa nhà (Hầm → T1..T7 → Mái → KLCTN)', shortLabel: 'Theo Tầng' },
  { value: 'managingUnit', label: 'Gom theo Đơn vị quản lý (4 Khối)', shortLabel: 'Theo Đơn vị QL' },
  { value: 'department', label: 'Gom theo Khoa / Phòng sử dụng (16 Khoa/Phòng)', shortLabel: 'Theo Khoa/Phòng' },
  { value: 'location', label: 'Gom theo Cơ sở (Cơ sở 1 / Cơ sở 2)', shortLabel: 'Theo Cơ sở' },
];

export const SMART_TAG_EXAMPLES: { tag: string; label: string; desc: string }[] = [
  { tag: 'tầng:3', label: 'tầng:3', desc: 'Tài sản tại Tầng 3' },
  { tag: 'tầng:hầm', label: 'tầng:hầm', desc: 'Tài sản tại Tầng Hầm' },
  { tag: 'nhóm:hvac', label: 'nhóm:hvac', desc: 'Điều hòa & Thông gió' },
  { tag: 'nhóm:pccc', label: 'nhóm:pccc', desc: 'Hệ thống PCCC' },
  { tag: 'nhóm:noithat', label: 'nhóm:noithat', desc: 'Nội thất bàn ghế, tủ kệ' },
  { tag: 'khoa:xn', label: 'khoa:xn', desc: 'Khoa Xét nghiệm' },
  { tag: 'giá:>10tr', label: 'giá:>10tr', desc: 'Nguyên giá trên 10 triệu' },
  { tag: 'năm:>=2024', label: 'năm:>=2024', desc: 'Đưa vào SD từ 2024' },
];

export interface AssetGroupSummary {
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

export function stripViClient(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function parsePriceClient(raw: string): number | null {
  const clean = stripViClient(raw).replace(/,/g, '.');
  const m = clean.match(/^(\d+(?:\.\d+)?)\s*(ty|t|trieu|tr|m|nghin|ngan|k|d)?$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2] || '';
  if (unit === 'ty' || unit === 't') return num * 1_000_000_000;
  if (unit === 'trieu' || unit === 'tr' || unit === 'm') return num * 1_000_000;
  if (unit === 'nghin' || unit === 'ngan' || unit === 'k') return num * 1_000;
  return num;
}

export function getAssetFunctionKey(a: Partial<Asset> & Record<string, any>): string {
  if (a.managingUnit === 'DUOC') return 'DUOC';
  if (a.managingUnit === 'CNTT') return 'CNTT';
  return a.assetGroup || (a.buildingAsset === 1 ? 'DIEN_CS' : 'NOI_THAT');
}

export function getAssetUnitScopeKey(a: Partial<Asset> & Record<string, any>): string {
  if (a.managingUnit === 'DUOC') return 'DUOC';
  if (a.managingUnit === 'CNTT') return 'CNTT';
  return a.buildingAsset === 1 ? 'TCHC_TOANHA' : 'TCHC_HC';
}

export function matchesSmartSearchClient(asset: any, rawQuery: string): boolean {
  const q = (rawQuery || '').normalize('NFC').trim();
  if (!q) return true;

  const rawTokens = q.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const statusVal = asset.currentStatus || asset.status || 'DANG_SU_DUNG';
  const funcKey = getAssetFunctionKey(asset);
  const funcLabel = FUNCTION_LABELS[funcKey] || '';

  const searchableBlob = stripViClient(
    [
      asset.name,
      asset.assetCode,
      asset.oldAssetCode,
      asset.assignedTo,
      asset.location,
      asset.locationDetail,
      asset.floor,
      asset.specifications,
      asset.manufacturer,
      asset.countryOfOrigin,
      asset.customNote ?? asset.note,
      asset.assetGroup,
      asset.managingUnit,
      asset.department?.name,
      asset.department?.code,
      asset.category?.name,
      funcLabel,
      asset.yearInUse ? String(asset.yearInUse) : '',
    ]
      .filter(Boolean)
      .join(' ')
  );

  for (const rawTok of rawTokens) {
    const tok = rawTok.replace(/^"|"$/g, '').trim();
    if (!tok) continue;

    const colonIdx = tok.indexOf(':');
    if (colonIdx > 0 && colonIdx < tok.length - 1) {
      const key = stripViClient(tok.slice(0, colonIdx));
      const val = tok.slice(colonIdx + 1).trim();
      const valNorm = stripViClient(val);

      if (['tang', 'floor', 't'].includes(key)) {
        const flNorm = stripViClient(asset.floor || '');
        if (['none', 'khong', 'chung', 'null'].includes(valNorm)) {
          if (flNorm) return false;
        } else if (valNorm === 'ham' || valNorm === 'tangham') {
          if (!flNorm.includes('ham')) return false;
        } else if (valNorm === 'mai' || valNorm === 'tangmai') {
          if (!flNorm.includes('mai')) return false;
        } else if (valNorm.includes('klctn') || valNorm.includes('phutro')) {
          if (!flNorm.includes('klctn') && !flNorm.includes('phu tro')) return false;
        } else if (/^\d+$/.test(valNorm)) {
          if (asset.floor !== `Tầng ${valNorm}`) return false;
        } else if (!flNorm.includes(valNorm)) {
          return false;
        }
        continue;
      }

      if (['khoa', 'phong', 'dept', 'kp'].includes(key)) {
        const dStr = stripViClient(`${asset.department?.name || ''} ${asset.department?.code || ''}`);
        if (!dStr.includes(valNorm)) return false;
        continue;
      }

      if (['dv', 'donvi', 'khoi', 'unit'].includes(key)) {
        const uKey = getAssetUnitScopeKey(asset);
        if (valNorm.includes('duoc') || valNorm.includes('tbyt')) {
          if (uKey !== 'DUOC') return false;
        } else if (valNorm.includes('cntt') || valNorm === 'it') {
          if (uKey !== 'CNTT') return false;
        } else if (valNorm.includes('toanha') || valNorm.includes('me') || valNorm.includes('codien')) {
          if (uKey !== 'TCHC_TOANHA') return false;
        } else if (valNorm.includes('hc') || valNorm.includes('hanhchinh')) {
          if (uKey !== 'TCHC_HC') return false;
        } else if (valNorm.includes('tchc')) {
          if (asset.managingUnit !== 'TCHC') return false;
        }
        continue;
      }

      if (['nhom', 'chucnang', 'group', 'loai'].includes(key)) {
        if (valNorm.includes('noithat') || valNorm.includes('banghe')) {
          if (funcKey !== 'NOI_THAT') return false;
        } else if (valNorm.includes('giadung') || valNorm.includes('xe')) {
          if (funcKey !== 'GIA_DUNG_XE') return false;
        } else if (valNorm.includes('dien') || valNorm.includes('den')) {
          if (funcKey !== 'DIEN_CS') return false;
        } else if (valNorm.includes('hvac') || valNorm.includes('dieuhoa') || valNorm.includes('maylanh')) {
          if (funcKey !== 'HVAC') return false;
        } else if (valNorm.includes('pccc') || valNorm.includes('chuachay')) {
          if (funcKey !== 'PCCC') return false;
        } else if (valNorm.includes('nuoc') || valNorm.includes('vesinh')) {
          if (funcKey !== 'NUOC_VS') return false;
        } else if (valNorm.includes('duoc') || valNorm.includes('tbyt')) {
          if (funcKey !== 'DUOC') return false;
        } else if (valNorm.includes('cntt') || valNorm === 'it') {
          if (funcKey !== 'CNTT') return false;
        } else if (!stripViClient(funcKey).includes(valNorm)) {
          return false;
        }
        continue;
      }

      if (['cs', 'coso', 'location'].includes(key)) {
        const locNorm = stripViClient(asset.location || '');
        if (valNorm === '1' || valNorm === 'cs1') {
          if (!locNorm.includes('1')) return false;
        } else if (valNorm === '2' || valNorm === 'cs2') {
          if (!locNorm.includes('2')) return false;
        } else if (!locNorm.includes(valNorm)) {
          return false;
        }
        continue;
      }

      if (['nam', 'year'].includes(key)) {
        const yrAsset = Number(asset.yearInUse) || 0;
        const rangeMatch = val.match(/^(\d{4})-(\d{4})$/);
        const opMatch = val.match(/^(>=|<=|>|<|=)?(\d{4})$/);
        if (rangeMatch) {
          if (yrAsset < parseInt(rangeMatch[1], 10) || yrAsset > parseInt(rangeMatch[2], 10)) return false;
        } else if (opMatch) {
          const op = opMatch[1] || '=';
          const yr = parseInt(opMatch[2], 10);
          if (op === '>' && !(yrAsset > yr)) return false;
          if (op === '>=' && !(yrAsset >= yr)) return false;
          if (op === '<' && !(yrAsset < yr)) return false;
          if (op === '<=' && !(yrAsset <= yr)) return false;
          if (op === '=' && yrAsset !== yr) return false;
        }
        continue;
      }

      if (['gia', 'price', 'nguyengia'].includes(key)) {
        const priceAsset = Number(asset.originalPrice) || 0;
        const opMatch = val.match(/^(>=|<=|>|<|=)?(.+)$/);
        if (opMatch) {
          const op = opMatch[1] || '>=';
          const parsed = parsePriceValue(opMatch[2]);
          if (parsed !== null) {
            if (op === '>' && !(priceAsset > parsed)) return false;
            if (op === '>=' && !(priceAsset >= parsed)) return false;
            if (op === '<' && !(priceAsset < parsed)) return false;
            if (op === '<=' && !(priceAsset <= parsed)) return false;
            if (op === '=' && priceAsset !== parsed) return false;
          }
        }
        continue;
      }

      if (['tt', 'trangthai', 'status'].includes(key)) {
        if (valNorm.includes('hong') && statusVal !== 'HONG') return false;
        if ((valNorm.includes('baotri') || valNorm.includes('sua')) && statusVal !== 'BAO_TRI') return false;
        if (valNorm.includes('thanhly') && statusVal !== 'CHO_THANH_LY') return false;
        if ((valNorm.includes('tot') || valNorm.includes('dang')) && statusVal !== 'DANG_SU_DUNG') return false;
        continue;
      }
    }

    const tokNorm = stripViClient(tok);
    if (!searchableBlob.includes(tokNorm)) {
      return false;
    }
  }

  return true;
}

function parsePriceValue(raw: string): number | null {
  return parsePriceClient(raw);
}

export function compareAssetByFieldClient(a: any, b: any, field: string, order: 'asc' | 'desc'): number {
  const dir = order === 'desc' ? -1 : 1;
  let cmp = 0;

  switch (field) {
    case 'floor': {
      const fa = a.floor ? (FLOOR_ORDER_MAP[a.floor] ?? 50) : 99;
      const fb = b.floor ? (FLOOR_ORDER_MAP[b.floor] ?? 50) : 99;
      if (fa === 99 && fb === 99) cmp = 0;
      else if (fa === 99) return 1;
      else if (fb === 99) return -1;
      else cmp = fa - fb;
      break;
    }
    case 'function':
    case 'assetGroup': {
      const ga = FUNCTION_ORDER_MAP[getAssetFunctionKey(a)] ?? 99;
      const gb = FUNCTION_ORDER_MAP[getAssetFunctionKey(b)] ?? 99;
      cmp = ga - gb;
      break;
    }
    case 'managingUnit':
    case 'unit': {
      const orderUnit: Record<string, number> = {
        DUOC: 1,
        CNTT: 2,
        TCHC_HC: 3,
        TCHC_TOANHA: 4,
      };
      cmp = (orderUnit[getAssetUnitScopeKey(a)] ?? 9) - (orderUnit[getAssetUnitScopeKey(b)] ?? 9);
      break;
    }
    case 'department':
    case 'user': {
      const da = a.locationDetail || a.assignedTo || a.department?.name || '';
      const db = b.locationDetail || b.assignedTo || b.department?.name || '';
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
      else if (pa <= 0) return 1;
      else if (pb <= 0) return -1;
      else cmp = pa - pb;
      break;
    }
    case 'totalValue':
    case 'total': {
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
      const sa = STATUS_ORDER_MAP[a.currentStatus || a.status || 'DANG_SU_DUNG'] ?? 99;
      const sb = STATUS_ORDER_MAP[b.currentStatus || b.status || 'DANG_SU_DUNG'] ?? 99;
      cmp = sa - sb;
      break;
    }
    case 'actualQty': {
      cmp = (a.actualQuantity || 0) - (b.actualQuantity || 0);
      break;
    }
    case 'diff': {
      cmp = (a.quantityDifference || 0) - (b.quantityDifference || 0);
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

export function sortAssetsClient(
  list: any[],
  sortBy = 'assetCode',
  sortOrder: 'asc' | 'desc' = 'asc',
  sortBy2 = '',
  sortOrder2: 'asc' | 'desc' = 'asc'
): any[] {
  return [...list].sort((a, b) => {
    const primary = compareAssetByFieldClient(a, b, sortBy, sortOrder);
    if (primary !== 0) return primary;
    if (sortBy2 && sortBy2 !== sortBy) {
      const secondary = compareAssetByFieldClient(a, b, sortBy2, sortOrder2);
      if (secondary !== 0) return secondary;
    }
    return viCollator.compare(a.assetCode || '', b.assetCode || '');
  });
}

export function groupAssetsClient(list: any[], groupBy: string): AssetGroupSummary[] {
  if (!groupBy) return [];
  const map = new Map<string, AssetGroupSummary>();

  for (const item of list) {
    let gKey = 'OTHER';
    let gLabel = 'Khác';
    let gSub = '';
    let gOrder = 50;

    if (groupBy === 'floor') {
      gKey = item.floor && item.floor.trim() ? item.floor.trim() : 'NONE';
      gLabel = gKey === 'NONE' ? 'Dùng chung / Chưa gắn tầng cụ thể' : gKey;
      gSub = gKey === 'NONE' ? 'Thiết bị lưu động hoặc hạ tầng toàn nhà' : 'Không gian vật lý theo tầng';
      gOrder = gKey === 'NONE' ? 99 : (FLOOR_ORDER_MAP[gKey] ?? 50);
    } else if (groupBy === 'function') {
      gKey = getAssetFunctionKey(item);
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
    } else if (groupBy === 'managingUnit') {
      gKey = getAssetUnitScopeKey(item);
      if (gKey === 'DUOC') {
        gLabel = 'Khối Khoa Dược (Trang thiết bị Y tế)';
        gSub = 'Thiết bị chuyên môn y tế, xét nghiệm, dây chuyền lạnh';
        gOrder = 1;
      } else if (gKey === 'CNTT') {
        gLabel = 'Khối Tổ CNTT (Thiết bị Công nghệ thông tin)';
        gSub = 'Máy tính, laptop, máy in, mạng tại 16 khoa/phòng';
        gOrder = 2;
      } else if (gKey === 'TCHC_HC') {
        gLabel = 'Khối Phòng TCHC · Trang bị Hành chính (Khoa giữ)';
        gSub = 'Nội thất bàn ghế, tủ kệ, gia dụng, xe phục vụ';
        gOrder = 3;
      } else {
        gLabel = 'Khối Phòng TCHC · Cơ điện & Hạ tầng Tòa nhà (M&E)';
        gSub = 'Hệ thống Điện, Chiếu sáng, HVAC, PCCC, Cấp thoát nước';
        gOrder = 4;
      }
    } else if (groupBy === 'department') {
      gKey = item.departmentId ? String(item.departmentId) : 'NONE';
      gLabel = item.department?.name || 'Chưa phân bổ Khoa / Phòng';
      gSub = item.department?.code ? `Mã đơn vị: ${item.department.code}` : '';
      gOrder = item.departmentId || 999;
    } else if (groupBy === 'location') {
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
    const st = item.currentStatus || item.status || 'DANG_SU_DUNG';
    bucket.count += 1;
    bucket.totalQty += qty;
    bucket.totalValue += (Number(item.originalPrice) || 0) * qty;
    if (st === 'DANG_SU_DUNG') bucket.healthyCount += 1;
    else if (['HONG', 'BAO_TRI', 'CHO_THANH_LY'].includes(st)) bucket.issueCount += 1;
    bucket.items.push(item);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (groupBy === 'department') return viCollator.compare(a.label, b.label);
    return a.order - b.order;
  });
}
