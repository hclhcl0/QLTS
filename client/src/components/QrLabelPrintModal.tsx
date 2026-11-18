import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  QrCode,
  Printer,
  FileText,
  Download,
  Search,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Layers,
  AlertCircle,
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { apiPost } from '../lib/api';
import { useToast } from './ui/Toast';

export interface QrLabelAssetItem {
  id: number;
  assetCode: string;
  oldAssetCode?: string | null;
  name: string;
  department?: { name?: string; code?: string } | null;
  floor?: string | null;
  location?: string | null;
  locationDetail?: string | null;
  assignedTo?: string | null;
  yearInUse?: number | null;
  originalPrice?: number | null;
  specifications?: string | null;
  manufacturer?: string | null;
  managingUnit?: string | null;
  bookQuantity?: number | null;
  actualQuantity?: number | null;
}

interface QrLabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  assets: QrLabelAssetItem[];
  defaultTitle?: string;
  contextLabel?: string;
  quantitySourceLabel?: string;
}

type LayoutId = '3x8' | '3x10' | '4x10' | '5x13' | '2x5';
type BorderStyleMode = 'dashed' | 'solid' | 'none';
type QrContentMode = 'url' | 'code' | 'text';
type LabelFieldKey =
  | 'header'
  | 'oldCode'
  | 'name'
  | 'dept'
  | 'floorLocation'
  | 'assignedTo'
  | 'year'
  | 'specs'
  | 'price'
  | 'copyIndex';

const LABEL_FIELD_OPTIONS: { key: LabelFieldKey; label: string }[] = [
  { key: 'header', label: 'Tiêu đề tem' },
  { key: 'name', label: 'Tên thiết bị' },
  { key: 'oldCode', label: 'Mã cũ' },
  { key: 'dept', label: 'Khoa / Phòng' },
  { key: 'floorLocation', label: 'Tầng & Vị trí' },
  { key: 'assignedTo', label: 'Người sử dụng' },
  { key: 'year', label: 'Năm sử dụng' },
  { key: 'specs', label: 'Model / Thông số' },
  { key: 'price', label: 'Nguyên giá (VNĐ)' },
  { key: 'copyIndex', label: 'Số tem (1/N)' },
];

const DEFAULT_FIELDS: Record<LabelFieldKey, boolean> = {
  header: true,
  oldCode: false,
  name: true,
  dept: true,
  floorLocation: true,
  assignedTo: false,
  year: true,
  specs: false,
  price: false,
  copyIndex: true,
};

interface LayoutPreset {
  id: LayoutId;
  name: string;
  subtitle: string;
  cols: number;
  rows: number;
  perPage: number;
  gapMm: number;
  qrSizeMm: number;
  cellHeightMm: number;
  fontSizeTitlePt: number;
  fontSizeCodePt: number;
  fontSizeNamePt: number;
  fontSizeMetaPt: number;
  nameLines: number;
}

const A4_LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: '3x8',
    name: '24 tem / A4 (3×8)',
    subtitle: '64 × 33 mm · Chuẩn decal Tomy 138/143',
    cols: 3,
    rows: 8,
    perPage: 24,
    gapMm: 2,
    qrSizeMm: 23,
    cellHeightMm: 32.5,
    fontSizeTitlePt: 6.5,
    fontSizeCodePt: 9.5,
    fontSizeNamePt: 7.5,
    fontSizeMetaPt: 6.5,
    nameLines: 2,
  },
  {
    id: '3x10',
    name: '30 tem / A4 (3×10)',
    subtitle: '64 × 26 mm · Tem kiểm kê phổ thông',
    cols: 3,
    rows: 10,
    perPage: 30,
    gapMm: 1.5,
    qrSizeMm: 19.5,
    cellHeightMm: 26,
    fontSizeTitlePt: 6,
    fontSizeCodePt: 9,
    fontSizeNamePt: 7,
    fontSizeMetaPt: 6,
    nameLines: 2,
  },
  {
    id: '4x10',
    name: '40 tem / A4 (4×10)',
    subtitle: '48 × 26 mm · Gọn Tomy 144 (CNTT, nội thất)',
    cols: 4,
    rows: 10,
    perPage: 40,
    gapMm: 1.5,
    qrSizeMm: 17.5,
    cellHeightMm: 26,
    fontSizeTitlePt: 5.5,
    fontSizeCodePt: 8,
    fontSizeNamePt: 6.5,
    fontSizeMetaPt: 5.5,
    nameLines: 2,
  },
  {
    id: '5x13',
    name: '65 tem / A4 (5×13)',
    subtitle: '38 × 20 mm · Tem mini Tomy 145',
    cols: 5,
    rows: 13,
    perPage: 65,
    gapMm: 1,
    qrSizeMm: 14.5,
    cellHeightMm: 20.1,
    fontSizeTitlePt: 5,
    fontSizeCodePt: 7,
    fontSizeNamePt: 5.8,
    fontSizeMetaPt: 5,
    nameLines: 1,
  },
  {
    id: '2x5',
    name: '10 tem / A4 (2×5)',
    subtitle: '96 × 52 mm · Khổ lớn (Tủ vắc-xin, Máy Y tế, Xe)',
    cols: 2,
    rows: 5,
    perPage: 10,
    gapMm: 3.5,
    qrSizeMm: 35,
    cellHeightMm: 52,
    fontSizeTitlePt: 8,
    fontSizeCodePt: 12,
    fontSizeNamePt: 9,
    fontSizeMetaPt: 7.5,
    nameLines: 3,
  },
];

const HEADER_PRESETS = [
  'CDC ĐÀ NẴNG · KIỂM KÊ 2026',
  'TÀI SẢN CDC ĐÀ NẴNG',
  'KIỂM KÊ TBYT · CDC ĐÀ NẴNG',
  'KIỂM KÊ CNTT · CDC ĐÀ NẴNG',
];

const MAX_ASSETS_PER_BATCH = 300;

interface ExpandedSticker {
  asset: QrLabelAssetItem;
  copyIndex: number;
  copyTotal: number;
}

function escapeHtml(raw: string | number | null | undefined): string {
  const str = String(raw ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function QrLabelPrintModal({
  open,
  onClose,
  assets,
  defaultTitle = 'CDC ĐÀ NẴNG · KIỂM KÊ 2026',
  contextLabel = 'Danh sách tài sản',
  quantitySourceLabel = 'SL thực tế',
}: QrLabelPrintModalProps) {
  const toast = useToast();

  const [layoutId, setLayoutId] = useState<LayoutId>('3x8');
  const [labelHeader, setLabelHeader] = useState<string>(defaultTitle);
  const [useAssetQty, setUseAssetQty] = useState<boolean>(false);
  const [fields, setFields] = useState<Record<LabelFieldKey, boolean>>(DEFAULT_FIELDS);
  const [showPageHeader, setShowPageHeader] = useState<boolean>(true);
  const [showLogoOnLabel, setShowLogoOnLabel] = useState<boolean>(true);
  const [borderStyle, setBorderStyle] = useState<BorderStyleMode>('dashed');
  const [monochrome, setMonochrome] = useState<boolean>(false);
  const [qrMode, setQrMode] = useState<QrContentMode>('url');
  const [baseUrl, setBaseUrl] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const [filterText, setFilterText] = useState<string>('');
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [batchIndex, setBatchIndex] = useState<number>(0);
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0);

  const [qrMap, setQrMap] = useState<Record<number, string>>({});
  const [loadingQr, setLoadingQr] = useState<boolean>(false);
  const [exportingPdf, setExportingPdf] = useState<boolean>(false);

  // Sync defaults when opened
  useEffect(() => {
    if (!open) return;
    setExcludedIds(new Set());
    setFilterText('');
    setBatchIndex(0);
    setPreviewPageIndex(0);
    setLabelHeader(defaultTitle);
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin);
    }
  }, [open, defaultTitle]);

  const preset = useMemo(
    () => A4_LAYOUT_PRESETS.find((p) => p.id === layoutId) || A4_LAYOUT_PRESETS[0],
    [layoutId]
  );

  const filteredSource = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const text = [
        a.assetCode,
        a.name,
        a.department?.name,
        a.floor,
        a.locationDetail,
        a.assignedTo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [assets, filterText]);

  const totalBatches = Math.max(1, Math.ceil(filteredSource.length / MAX_ASSETS_PER_BATCH));
  const safeBatchIndex = Math.min(batchIndex, totalBatches - 1);

  const batchAssets = useMemo(() => {
    const start = safeBatchIndex * MAX_ASSETS_PER_BATCH;
    return filteredSource.slice(start, start + MAX_ASSETS_PER_BATCH);
  }, [filteredSource, safeBatchIndex]);

  const activeAssets = useMemo(
    () => batchAssets.filter((a) => !excludedIds.has(a.id)),
    [batchAssets, excludedIds]
  );

  // Expand to individual stickers (by 1 or asset quantity)
  const expandedStickers = useMemo<ExpandedSticker[]>(() => {
    const list: ExpandedSticker[] = [];
    for (const asset of activeAssets) {
      const qtyRaw = Number(asset.actualQuantity ?? asset.bookQuantity ?? 1);
      const count = useAssetQty ? Math.max(1, Math.min(50, Math.round(qtyRaw) || 1)) : 1;
      for (let i = 1; i <= count; i++) {
        list.push({ asset, copyIndex: i, copyTotal: count });
      }
    }
    return list;
  }, [activeAssets, useAssetQty]);

  const a4Pages = useMemo<ExpandedSticker[][]>(() => {
    if (expandedStickers.length === 0) return [];
    const pages: ExpandedSticker[][] = [];
    for (let i = 0; i < expandedStickers.length; i += preset.perPage) {
      pages.push(expandedStickers.slice(i, i + preset.perPage));
    }
    return pages;
  }, [expandedStickers, preset.perPage]);

  const safePreviewPage = Math.min(previewPageIndex, Math.max(0, a4Pages.length - 1));

  const enabledTextFields = useMemo(
    () =>
      (Object.keys(fields) as LabelFieldKey[]).filter((k) => fields[k]),
    [fields]
  );

  // Fetch batch QR codes whenever active batch, qrMode, baseUrl, or selected textFields change
  useEffect(() => {
    if (!open || batchAssets.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingQr(true);
      try {
        const assetIds = batchAssets.map((a) => a.id);
        const res = (await apiPost('/assets/qr-batch', {
          assetIds,
          qrMode,
          baseUrl: baseUrl.trim(),
          textFields: qrMode === 'text' ? enabledTextFields : undefined,
        })) as { qrMap?: Record<number, string> };

        if (!cancelled && res?.qrMap) {
          setQrMap((prev) => ({ ...prev, ...res.qrMap }));
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || 'Không thể tạo mã QR hàng loạt');
        }
      } finally {
        if (!cancelled) setLoadingQr(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, batchAssets, qrMode, baseUrl, enabledTextFields]);

  if (!open) return null;

  const toggleField = (key: LabelFieldKey) => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyFieldPreset = (mode: 'minimal' | 'standard' | 'full') => {
    if (mode === 'minimal') {
      setFields({
        header: true,
        oldCode: false,
        name: true,
        dept: false,
        floorLocation: false,
        assignedTo: false,
        year: false,
        specs: false,
        price: false,
        copyIndex: false,
      });
    } else if (mode === 'standard') {
      setFields({ ...DEFAULT_FIELDS });
    } else {
      setFields({
        header: true,
        oldCode: true,
        name: true,
        dept: true,
        floorLocation: true,
        assignedTo: true,
        year: true,
        specs: true,
        price: true,
        copyIndex: true,
      });
    }
  };

  const formatStickerLines = (asset: QrLabelAssetItem, copyIndex: number, copyTotal: number) => {
    const codeLine =
      fields.oldCode && asset.oldAssetCode
        ? `${asset.assetCode} (Cũ: ${asset.oldAssetCode})`
        : asset.assetCode;

    const line1 = [
      fields.dept ? asset.department?.name || asset.department?.code || 'CDC Đà Nẵng' : '',
      fields.floorLocation ? [asset.floor, asset.locationDetail || asset.location].filter(Boolean).join(' - ') : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const line2 = [
      fields.assignedTo && asset.assignedTo ? `SD: ${asset.assignedTo}` : '',
      fields.year && asset.yearInUse ? `Năm ${asset.yearInUse}` : '',
      fields.specs && (asset.specifications || asset.manufacturer)
        ? String(asset.specifications || asset.manufacturer)
        : '',
      fields.price && asset.originalPrice && Number(asset.originalPrice) > 0
        ? `${Number(asset.originalPrice).toLocaleString('vi-VN')}đ`
        : '',
      fields.copyIndex && copyTotal > 1 ? `Tem ${copyIndex}/${copyTotal}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    return { codeLine, line1, line2 };
  };

  const toggleAsset = (id: number) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBatch = () => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      batchAssets.forEach((a) => next.delete(a.id));
      return next;
    });
  };

  const clearAllBatch = () => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      batchAssets.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const buildSheetsInnerHtml = () => {
    const accentColor = monochrome ? '#000000' : '#024383';
    const logoUrl = typeof window !== 'undefined' ? `${window.location.origin}/cdc-logo.png` : '/cdc-logo.png';
    const badgeSizeMm = preset.id === '2x5' ? 5.2 : preset.id === '3x8' ? 3.8 : 3.2;
    const textPrimary = '#0f172a';
    const textSecondary = monochrome ? '#1e293b' : '#475569';
    const borderCss =
      borderStyle === 'dashed'
        ? '1px dashed #94a3b8'
        : borderStyle === 'solid'
        ? '1px solid #cbd5e1'
        : '1px solid transparent';

    return a4Pages
      .map((pageItems, pageIdx) => {
        const cards = pageItems
          .map(({ asset, copyIndex, copyTotal }) => {
            const imgSrc = qrMap[asset.id] || '';
            const { codeLine, line1, line2 } = formatStickerLines(asset, copyIndex, copyTotal);

            return `
              <div class="qr-cell" style="
                height:${preset.cellHeightMm}mm;
                border:${borderCss};
                border-radius:${preset.id === '5x13' ? '1.5mm' : '2.2mm'};
                padding:${preset.id === '5x13' ? '1.2mm' : '1.8mm'};
                box-sizing:border-box;
                display:flex;
                align-items:center;
                gap:${preset.id === '5x13' ? '1.2mm' : '2mm'};
                background:#ffffff;
                overflow:hidden;
                break-inside:avoid;
              ">
                ${
                  imgSrc
                    ? `<img src="${imgSrc}" alt="${escapeHtml(asset.assetCode)}" style="width:${preset.qrSizeMm}mm;height:${preset.qrSizeMm}mm;object-fit:contain;flex-shrink:0;display:block;" />`
                    : `<div style="width:${preset.qrSizeMm}mm;height:${preset.qrSizeMm}mm;background:#f1f5f9;flex-shrink:0;"></div>`
                }
                <div style="min-width:0;flex:1;display:flex;flex-direction:column;justify-content:center;gap:0.35mm;overflow:hidden;">
                  ${
                    fields.header && labelHeader.trim()
                      ? `<div style="display:flex;align-items:center;gap:1mm;overflow:hidden;">
                          ${
                            showLogoOnLabel && preset.id !== '5x13'
                              ? `<img src="${logoUrl}" alt="CDC" style="width:${badgeSizeMm}mm;height:${badgeSizeMm}mm;border-radius:0.8mm;object-fit:contain;flex-shrink:0;${monochrome ? 'filter:grayscale(1) contrast(1.25);' : ''}" />`
                              : ''
                          }
                          <div style="font-size:${preset.fontSizeTitlePt}pt;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1;">${escapeHtml(labelHeader.trim())}</div>
                        </div>`
                      : ''
                  }
                  <div style="font-size:${preset.fontSizeCodePt}pt;font-weight:800;color:${textPrimary};font-family:'Courier New',Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;">${escapeHtml(codeLine)}</div>
                  ${
                    fields.name
                      ? `<div style="font-size:${preset.fontSizeNamePt}pt;font-weight:600;color:${textPrimary};line-height:1.18;display:-webkit-box;-webkit-line-clamp:${preset.nameLines};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(asset.name)}</div>`
                      : ''
                  }
                  ${
                    line1
                      ? `<div style="font-size:${preset.fontSizeMetaPt}pt;color:${textSecondary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.15;">${escapeHtml(line1)}</div>`
                      : ''
                  }
                  ${
                    line2
                      ? `<div style="font-size:${Math.max(5, preset.fontSizeMetaPt - 0.5)}pt;color:${textSecondary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1;">${escapeHtml(line2)}</div>`
                      : ''
                  }
                </div>
              </div>
            `;
          })
          .join('');

        const isLast = pageIdx === a4Pages.length - 1;
        return `
          <section class="a4-sheet" style="
            width:210mm;
            height:296.5mm;
            padding:6mm;
            box-sizing:border-box;
            background:#ffffff;
            color:#0f172a;
            font-family:'Segoe UI',Arial,Helvetica,sans-serif;
            ${isLast ? '' : 'page-break-after:always;break-after:page;'}
            overflow:hidden;
          ">
            ${
              showPageHeader
                ? `<div style="height:6mm;display:flex;align-items:center;justify-content:space-between;font-size:7.5pt;color:#475569;border-bottom:0.4pt solid #e2e8f0;margin-bottom:2mm;padding-bottom:1mm;">
                    <span style="display:inline-flex;align-items:center;gap:1.5mm;font-weight:700;color:${accentColor};">
                      ${showLogoOnLabel ? `<img src="${logoUrl}" alt="CDC" style="width:4.5mm;height:4.5mm;border-radius:0.8mm;object-fit:contain;" />` : ''}
                      <span>${escapeHtml(labelHeader || 'CDC ĐÀ NẴNG')} · ${escapeHtml(contextLabel)} (${escapeHtml(preset.name)})</span>
                    </span>
                    <span>Trang ${pageIdx + 1}/${a4Pages.length} · ${pageItems.length} tem</span>
                  </div>`
                : ''
            }
            <div style="
              display:grid;
              grid-template-columns:repeat(${preset.cols}, minmax(0, 1fr));
              gap:${preset.gapMm}mm;
              align-content:start;
            ">${cards}</div>
          </section>
        `;
      })
      .join('');
  };

  const buildFullPrintableHtml = (autoPrint: boolean) => `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Tem QR Kiểm Kê A4 (${expandedStickers.length} tem · ${a4Pages.length} trang)</title>
    <style data-qr-print="1">
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #f1f5f9;
      }
      .a4-sheet {
        margin: 0 auto 8mm auto;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
      }
      @media print {
        html, body {
          background: #ffffff !important;
        }
        .a4-sheet {
          margin: 0 !important;
          box-shadow: none !important;
        }
        .no-print-banner {
          display: none !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="no-print-banner" style="font-family:sans-serif;background:#0f172a;color:#fff;padding:10px 16px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
      <span><strong>Sẵn sàng in A4:</strong> ${expandedStickers.length} tem QR trên ${a4Pages.length} trang A4 (${preset.name}) — Chọn <em>Khổ giấy A4, Lề: Không có (None), Tỷ lệ: 100%</em> nếu hộp thoại in hỏi.</span>
      <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:7px 14px;border-radius:8px;font-weight:600;cursor:pointer;">In ngay / Lưu PDF</button>
    </div>
    ${buildSheetsInnerHtml()}
    ${
      autoPrint
        ? `<script>
            window.addEventListener('load', function() {
              var imgs = Array.prototype.slice.call(document.images);
              Promise.all(imgs.map(function(img) {
                if (img.complete) return Promise.resolve();
                return new Promise(function(res) { img.onload = res; img.onerror = res; });
              })).then(function() {
                setTimeout(function() { window.print(); }, 250);
              });
            });
          </script>`
        : ''
    }
  </body>
</html>`;

  const handlePrintA4 = () => {
    if (expandedStickers.length === 0) {
      toast.warning('Chưa có tem nào được chọn để in.');
      return;
    }
    const win = window.open('', '_blank', 'width=1024,height=780');
    if (!win) {
      toast.error('Trình duyệt đang chặn popup. Vui lòng cho phép mở cửa sổ mới để in trang A4.');
      return;
    }
    win.document.open();
    win.document.write(buildFullPrintableHtml(true));
    win.document.close();
    toast.success(`Đã mở bản in ${expandedStickers.length} tem QR (${a4Pages.length} trang A4).`);
  };

  const handleDownloadPdf = async () => {
    if (expandedStickers.length === 0) {
      toast.warning('Chưa có tem nào được chọn để xuất PDF.');
      return;
    }
    setExportingPdf(true);
    let container: HTMLDivElement | null = null;
    try {
      container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-99999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.background = '#ffffff';
      container.innerHTML = `<style data-qr-print="1">*{box-sizing:border-box;margin:0;padding:0;}</style>${buildSheetsInnerHtml()}`;
      document.body.appendChild(container);

      const imgs = Array.from(container.querySelectorAll('img'));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = res;
                img.onerror = res;
              })
        )
      );

      const opt = {
        margin: 0,
        filename: `Tem_QR_KiemKe_${preset.id}_${expandedStickers.length}tem.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc: Document) => {
            // Strip parent Tailwind CSS rules containing oklch() so html2canvas renders cleanly
            clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
              if (!el.hasAttribute('data-qr-print')) {
                el.parentNode?.removeChild(el);
              }
            });
          },
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait' as const,
          compress: true,
        },
        pagebreak: { mode: ['css'] },
      };

      await html2pdf().set(opt).from(container).save();
      toast.success(`Đã tải file PDF ${expandedStickers.length} tem QR (${a4Pages.length} trang A4).`);
    } catch (err: any) {
      console.error('QR PDF export error:', err);
      toast.error('Lỗi xuất PDF trực tiếp. Vui lòng dùng nút "In trực tiếp A4" → chọn "Lưu dưới dạng PDF".');
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setExportingPdf(false);
    }
  };

  const handleDownloadHtml = () => {
    if (expandedStickers.length === 0) return;
    const html = buildFullPrintableHtml(false);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tem_QR_KiemKe_${preset.id}_${expandedStickers.length}tem.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã tải file HTML trang A4 — có thể mở bằng bất kỳ trình duyệt nào để in.');
  };

  const currentPageStickers = a4Pages[safePreviewPage] || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-700 text-white shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-sm sm:text-base font-bold text-slate-900 truncate">
                Xuất Tem QR Kiểm Kê · Khổ A4 Nhiều Mã
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {contextLabel} · Nạp {assets.length.toLocaleString('vi-VN')} thiết bị
                {totalBatches > 1 ? ` (Chia ${totalBatches} lô in, mỗi lô tối đa ${MAX_ASSETS_PER_BATCH} mã TS)` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              disabled={loadingQr || expandedStickers.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Tải HTML A4</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loadingQr || exportingPdf || expandedStickers.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>{exportingPdf ? 'Đang tạo PDF...' : 'Tải PDF (A4)'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintA4}
              disabled={loadingQr || expandedStickers.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In trang A4 ({a4Pages.length} tờ)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ xuất tem QR"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT PANEL: Layout, Label Content & Asset Picker */}
          <div className="w-full lg:w-[410px] border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-0 bg-white overflow-y-auto">
            <div className="p-3.5 space-y-3.5 border-b border-slate-200">
              {/* Batch switch when source > 300 */}
              {totalBatches > 1 && (
                <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-2.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Danh sách có {filteredSource.length} mã — chọn lô xuất:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: totalBatches }).map((_, idx) => {
                      const from = idx * MAX_ASSETS_PER_BATCH + 1;
                      const to = Math.min(filteredSource.length, (idx + 1) * MAX_ASSETS_PER_BATCH);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setBatchIndex(idx);
                            setPreviewPageIndex(0);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                            safeBatchIndex === idx
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          Lô {idx + 1} ({from}–{to})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 1. A4 Sheet Layout Presets */}
              <div>
                <label className="text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  1. Bố cục tem trên trang A4
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {A4_LAYOUT_PRESETS.map((p) => {
                    const active = p.id === layoutId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setLayoutId(p.id);
                          setPreviewPageIndex(0);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500/30'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className={`text-xs font-semibold ${active ? 'text-blue-900' : 'text-slate-800'}`}>
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-500">{p.subtitle}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                            active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.perPage}/tờ
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Header Text & Quantity Rule */}
              <div className="space-y-2">
                <label className="block text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
                  2. Tiêu đề trên tem & Số lượng
                </label>
                <input
                  type="text"
                  value={labelHeader}
                  onChange={(e) => setLabelHeader(e.target.value)}
                  placeholder="VD: CDC ĐÀ NẴNG · KIỂM KÊ 2026"
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:border-blue-600 outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {HEADER_PRESETS.map((presetText) => (
                    <button
                      key={presetText}
                      type="button"
                      onClick={() => setLabelHeader(presetText)}
                      className={`px-2 py-0.5 rounded-md text-[10px] border cursor-pointer transition ${
                        labelHeader === presetText
                          ? 'bg-blue-50 text-blue-800 border-blue-300 font-semibold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {presetText}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setUseAssetQty(false)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium cursor-pointer transition ${
                      !useAssetQty
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    1 tem / mã tài sản
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseAssetQty(true)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-medium cursor-pointer transition ${
                      useAssetQty
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Nhân theo {quantitySourceLabel}
                  </button>
                </div>
              </div>

              {/* 3. Display Options & QR Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
                    3. Thông tin hiển thị trên tem
                  </label>
                  <div className="inline-flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => applyFieldPreset('minimal')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                    >
                      Gọn
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFieldPreset('standard')}
                      className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold cursor-pointer"
                    >
                      Chuẩn KK
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFieldPreset('full')}
                      className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                    >
                      Đầy đủ
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-700">
                  {LABEL_FIELD_OPTIONS.map((opt) => (
                    <label key={opt.key} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fields[opt.key]}
                        onChange={() => toggleField(opt.key)}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-1.5 cursor-pointer pt-0.5 border-t border-slate-100">
                    <input
                      type="checkbox"
                      checked={showLogoOnLabel}
                      onChange={(e) => setShowLogoOnLabel(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Logo CDC trên tem</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer pt-0.5 border-t border-slate-100">
                    <input
                      type="checkbox"
                      checked={showPageHeader}
                      onChange={(e) => setShowPageHeader(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Tiêu đề &amp; trang A4</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">Viền cắt:</span>
                  {([
                    { id: 'dashed', label: 'Nét đứt' },
                    { id: 'solid', label: 'Nét liền' },
                    { id: 'none', label: 'Ẩn viền (Decal)' },
                  ] as const).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBorderStyle(b.id)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] border cursor-pointer ${
                        borderStyle === b.id
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                  <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 ml-auto cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monochrome}
                      onChange={(e) => setMonochrome(e.target.checked)}
                    />
                    <span>In đen trắng</span>
                  </label>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-700">
                    Dữ liệu mã hóa bên trong hình QR (khi đưa Camera/Zalo quét):
                  </div>
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/80 p-0.5">
                    <button
                      type="button"
                      onClick={() => setQrMode('url')}
                      className={`px-1.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                        qrMode === 'url' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Link Web (/qr/...)
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrMode('text')}
                      className={`px-1.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                        qrMode === 'text' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Thông tin Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrMode('code')}
                      className={`px-1.5 py-1 rounded-md text-[10px] font-semibold cursor-pointer ${
                        qrMode === 'code' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Chỉ Mã TS
                    </button>
                  </div>
                  {qrMode === 'url' && (
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://qlts.cdcdanang.vn"
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-mono text-slate-700 outline-none focus:border-blue-600"
                    />
                  )}
                  {qrMode === 'text' && (
                    <p className="text-[10px] text-emerald-700 leading-snug">
                      Quét bằng Camera / Zalo sẽ hiện thẳng chữ theo các trường bạn đã tích chọn ở trên — dùng được ngay cả khi điện thoại không kết nối mạng nội bộ!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Asset Selection List */}
            <div className="p-3.5 flex-1 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-heading font-semibold uppercase tracking-wider text-slate-500">
                  4. Thiết bị trong lô ({activeAssets.length}/{batchAssets.length})
                </span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllBatch}
                    className="text-blue-700 hover:underline font-medium cursor-pointer"
                  >
                    Chọn hết
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllBatch}
                    className="text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Bỏ hết
                  </button>
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => {
                    setFilterText(e.target.value);
                    setBatchIndex(0);
                    setPreviewPageIndex(0);
                  }}
                  placeholder="Lọc mã TS, tên, khoa trong danh sách..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 lg:max-h-none">
                {batchAssets.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không có thiết bị phù hợp.
                  </div>
                ) : (
                  batchAssets.map((asset) => {
                    const checked = !excludedIds.has(asset.id);
                    const qty = Math.max(1, Number(asset.actualQuantity ?? asset.bookQuantity ?? 1) || 1);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => toggleAsset(asset.id)}
                        className={`w-full px-2.5 py-1.5 text-left flex items-start gap-2 hover:bg-slate-50 transition cursor-pointer ${
                          checked ? 'bg-white' : 'bg-slate-50/60 opacity-55'
                        }`}
                      >
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[11px] font-semibold text-blue-700 truncate">
                              {asset.assetCode}
                            </span>
                            {useAssetQty && qty > 1 && (
                              <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold">
                                ×{qty}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-800 truncate">{asset.name}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Live Multi-Page A4 Preview */}
          <div className="flex-1 bg-slate-200/80 flex flex-col min-h-0 overflow-hidden">
            {/* Preview Status & Page Controls */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span>
                  Xem trước khổ <strong className="text-slate-900">A4</strong>:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 font-semibold tabular-nums">
                  {expandedStickers.length} tem
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold tabular-nums">
                  {a4Pages.length} trang
                </span>
                {loadingQr && (
                  <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Đang tạo mã QR...
                  </span>
                )}
              </div>

              {a4Pages.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePreviewPage <= 0}
                    onClick={() => setPreviewPageIndex((p) => Math.max(0, p - 1))}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-slate-800 tabular-nums px-2">
                    Trang {safePreviewPage + 1} / {a4Pages.length}
                  </span>
                  <button
                    type="button"
                    disabled={safePreviewPage >= a4Pages.length - 1}
                    onClick={() => setPreviewPageIndex((p) => Math.min(a4Pages.length - 1, p + 1))}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* A4 Sheet Canvas */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-center items-start">
              {a4Pages.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500 my-auto">
                  Chưa có thiết bị nào được chọn. Hãy tích chọn ít nhất 1 thiết bị ở cột bên trái.
                </div>
              ) : (
                <div
                  className="bg-white shadow-xl border border-slate-300 shrink-0"
                  style={{
                    width: '210mm',
                    minHeight: '296mm',
                    padding: '6mm',
                    boxSizing: 'border-box',
                  }}
                >
                  {showPageHeader && (
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-200 pb-1 mb-2">
                      <span
                        className={`font-bold inline-flex items-center gap-1.5 ${
                          monochrome ? 'text-slate-900' : 'text-[#024383]'
                        }`}
                      >
                        {showLogoOnLabel && (
                          <img src="/cdc-logo.png" alt="CDC" className="w-4 h-4 rounded object-contain shrink-0" />
                        )}
                        <span>{labelHeader || 'CDC ĐÀ NẴNG'} · {contextLabel} ({preset.name})</span>
                      </span>
                      <span className="tabular-nums">
                        Trang {safePreviewPage + 1}/{a4Pages.length} · {currentPageStickers.length} tem
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${preset.cols}, minmax(0, 1fr))`,
                      gap: `${preset.gapMm}mm`,
                      alignContent: 'start',
                    }}
                  >
                    {currentPageStickers.map(({ asset, copyIndex, copyTotal }) => {
                      const imgSrc = qrMap[asset.id];
                      const { codeLine, line1, line2 } = formatStickerLines(asset, copyIndex, copyTotal);

                      return (
                        <div
                          key={`${asset.id}-${copyIndex}`}
                          style={{
                            height: `${preset.cellHeightMm}mm`,
                            border:
                              borderStyle === 'dashed'
                                ? '1px dashed #94a3b8'
                                : borderStyle === 'solid'
                                ? '1px solid #cbd5e1'
                                : '1px solid transparent',
                            borderRadius: preset.id === '5x13' ? '1.5mm' : '2.2mm',
                            padding: preset.id === '5x13' ? '1.2mm' : '1.8mm',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            gap: preset.id === '5x13' ? '1.2mm' : '2mm',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {imgSrc ? (
                            <img
                              src={imgSrc}
                              alt={asset.assetCode}
                              style={{
                                width: `${preset.qrSizeMm}mm`,
                                height: `${preset.qrSizeMm}mm`,
                                objectFit: 'contain',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: `${preset.qrSizeMm}mm`,
                                height: `${preset.qrSizeMm}mm`,
                              }}
                              className="bg-slate-100 animate-pulse rounded shrink-0"
                            />
                          )}

                          <div className="min-w-0 flex-1 flex flex-col justify-center overflow-hidden">
                            {fields.header && labelHeader.trim() && (
                              <div className="flex items-center gap-1 overflow-hidden">
                                {showLogoOnLabel && preset.id !== '5x13' && (
                                  <img
                                    src="/cdc-logo.png"
                                    alt="CDC"
                                    style={{
                                      width: `${preset.id === '2x5' ? 5.2 : preset.id === '3x8' ? 3.8 : 3.2}mm`,
                                      height: `${preset.id === '2x5' ? 5.2 : preset.id === '3x8' ? 3.8 : 3.2}mm`,
                                      filter: monochrome ? 'grayscale(1) contrast(1.25)' : undefined,
                                    }}
                                    className="rounded-xs object-contain shrink-0"
                                  />
                                )}
                                <div
                                  style={{
                                    fontSize: `${preset.fontSizeTitlePt}pt`,
                                    color: monochrome ? '#000000' : '#024383',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    lineHeight: 1.1,
                                  }}
                                  className="truncate"
                                >
                                  {labelHeader.trim()}
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                fontSize: `${preset.fontSizeCodePt}pt`,
                                fontWeight: 800,
                                color: '#0f172a',
                                lineHeight: 1.15,
                              }}
                              className="font-mono truncate"
                            >
                              {codeLine}
                            </div>

                            {fields.name && (
                              <div
                                style={{
                                  fontSize: `${preset.fontSizeNamePt}pt`,
                                  fontWeight: 600,
                                  color: '#0f172a',
                                  lineHeight: 1.18,
                                  display: '-webkit-box',
                                  WebkitLineClamp: preset.nameLines,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {asset.name}
                              </div>
                            )}

                            {line1 && (
                              <div
                                style={{
                                  fontSize: `${preset.fontSizeMetaPt}pt`,
                                  color: monochrome ? '#1e293b' : '#475569',
                                  lineHeight: 1.15,
                                }}
                                className="truncate"
                              >
                                {line1}
                              </div>
                            )}

                            {line2 && (
                              <div
                                style={{
                                  fontSize: `${Math.max(5, preset.fontSizeMetaPt - 0.5)}pt`,
                                  color: monochrome ? '#1e293b' : '#475569',
                                  lineHeight: 1.1,
                                }}
                                className="truncate"
                              >
                                {line2}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
