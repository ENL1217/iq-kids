// web/js/renderer.js
// 中央 renderer:把 visual spec 物件轉成 HTML 字串。
// 所有題目的 visual 跟 options[i].visual 都經過這個函數。

import {
  svg, circle, square, triangle, star, diamond, hex, arrow, dots,
  multiShape, mc, shapeByName, COLORS,
  clockHand, angleV, triangleSplit, tallyLines, bowtie, nestedGrid
} from './shapes.js';
import { cubeStack } from './iso.js';

// Batch +1000 新增 primitive 的 inner-SVG 產生器。同時被 cell 層
// (renderCellContent) 跟 option/top-level 層 (renderVisual switch) 共用。
const CELL_TYPE_RENDERERS = {
  'clock-hand':     (s) => clockHand(s.angle_deg, s.length_ratio, s.dot_radius),
  'angle-v':        (s) => angleV(s.orientation, s.spread_deg, s.dots),
  'triangle-split': (s) => triangleSplit(s.diagonal, s.top_fill, s.bottom_fill),
  'tally-lines':    (s) => tallyLines(s.h_count, s.v_count),
  'bowtie':         (s) => bowtie(s.orientation, s.left_fill, s.right_fill),
  'nested-grid':    (s) => nestedGrid(s.filled_cells, s.black_cell_size, {
    fill_color: s.fill_color, fill_shape: s.fill_shape, border_color: s.border_color
  })
};

/**
 * 主入口:接受任何 visual spec,回傳 HTML 字串。
 * @param {object} spec - 必含 spec.type
 * @returns {string} HTML
 */
export function renderVisual(spec) {
  if (!spec || typeof spec !== 'object') return '';
  switch (spec.type) {
    case 'matrix-3x3':     return renderMatrix(spec, 3);
    case 'matrix-2x2':     return renderMatrix(spec, 2);
    case 'sequence-row':   return renderSequenceRow(spec);
    case 'number-sequence':return renderNumberSequence(spec);
    case 'analogy-row':    return renderAnalogyRow(spec);
    case 'cubeStack':      return cubeStack(spec.layout, { size: spec.size, padding: spec.padding });
    case 'cubeNet':        return renderCubeNet(spec);
    case 'foldedPaper':    return renderFoldedPaper(spec);
    case 'single-shape':   return renderSingleShape(spec);
    case 'composite':      return renderComposite(spec);
    case 'text':           return `<span class="vtext">${spec.content || ''}</span>`;
    case 'raw-html':       return spec.html || '';
    default:
      // Batch +1000 primitive 統一從 CELL_TYPE_RENDERERS dispatch
      if (CELL_TYPE_RENDERERS[spec.type]) {
        return svg(CELL_TYPE_RENDERERS[spec.type](spec), spec.size || 50);
      }
      return `<div class="render-error">Unknown visual type: ${spec.type}</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────
// Matrix (2×2 / 3×3)
// cells: array of { shape, color, count?, radius?, rotation?, dots?, unknown?, raw? }
// ─────────────────────────────────────────────────────────────────
function renderMatrix(spec, size) {
  const cells = spec.cells || [];
  const expected = size * size;
  if (cells.length !== expected) {
    return `<div class="render-error">matrix-${size}x${size} expects ${expected} cells, got ${cells.length}</div>`;
  }
  const inner = cells.map(cell => {
    if (cell.unknown) return mc('', true);
    if (cell.raw) return mc(svg(cell.raw));
    return mc(svg(renderCellContent(cell)));
  }).join('');
  return `<div class="matrix-${size}x${size}">${inner}</div>`;
}

/** 一個 cell 的內部 SVG content (不含 <svg> 包裝)。 */
function renderCellContent(cell) {
  // Batch +1000:cell.type dispatch 優先 (新 primitive 走這條),
  // 沒指定才 fallback 到既有的 cell.shape 路徑(向後相容)。
  if (cell.type && CELL_TYPE_RENDERERS[cell.type]) {
    return CELL_TYPE_RENDERERS[cell.type](cell);
  }

  const colorHex = COLORS[cell.color] || cell.color || COLORS.pink;

  // 特殊形狀:arrow 用旋轉角度
  if (cell.shape === 'arrow') {
    return arrow(cell.rotation || 0, colorHex);
  }
  // 特殊形狀:dots 用點數
  if (cell.shape === 'dots') {
    return dots(cell.count || 1);
  }

  const shapeFn = shapeByName(cell.shape);
  if (!shapeFn) return '';

  // count > 1 → multiShape
  if (cell.count && cell.count > 1) {
    // 對 circle/square 要傳特殊 size 進去,這裡先用預設
    return multiShape(c => shapeFn(c, cell.radius), cell.count, colorHex);
  }

  // 一般單一形狀
  const base = (cell.shape === 'circle' && cell.radius)
    ? circle(colorHex, cell.radius)
    : shapeFn(colorHex);

  // 加 dots overlay (用於 multivar.hard 多變數題)
  if (cell.dots) {
    return base + dots(cell.dots);
  }
  return base;
}

// ─────────────────────────────────────────────────────────────────
// Sequence Row (一排圖形)
// items: 同 cells 結構
// ─────────────────────────────────────────────────────────────────
function renderSequenceRow(spec) {
  const items = spec.items || [];
  const inner = items.map(it => {
    if (it.unknown) return `<div class="seq-cell unknown">?</div>`;
    if (it.raw) return `<div class="seq-cell">${svg(it.raw)}</div>`;
    return `<div class="seq-cell">${svg(renderCellContent(it))}</div>`;
  }).join('<div class="seq-arrow">→</div>'.repeat(0));  // no inter-arrow by default
  return `<div class="sequence-row">${inner}</div>`;
}

// ─────────────────────────────────────────────────────────────────
// Number Sequence
// items: array of number | "?"
// ─────────────────────────────────────────────────────────────────
function renderNumberSequence(spec) {
  const items = spec.items || [];
  // 把 ? 之前的數字 + → + ? 排版
  const parts = [];
  for (let i = 0; i < items.length; i++) {
    const v = items[i];
    if (v === '?' || v === null) {
      parts.push(`<div class="arrow">→</div>`);
      parts.push(`<div class="num-cell unknown">?</div>`);
    } else {
      parts.push(`<div class="num-cell">${v}</div>`);
    }
  }
  return `<div class="number-sequence">${parts.join('')}</div>`;
}

// ─────────────────────────────────────────────────────────────────
// Analogy Row (A → B 就像 C → ?)
// pairs: [{a, b}, {a, b: {unknown:true}}]
// 每個 term 可有 { text, emoji }
// ─────────────────────────────────────────────────────────────────
function renderAnalogyRow(spec) {
  const pairs = spec.pairs || [];
  const renderTerm = (t) => {
    if (!t) return '';
    if (t.unknown) return `<div class="term unknown">?</div>`;
    const content = t.emoji ? `${t.emoji} ${t.text || ''}` : (t.text || '');
    return `<div class="term">${content}</div>`;
  };
  const blocks = pairs.map((pair, i) => {
    const pre = i > 0 ? `<div class="arr" style="margin: 0 10px;">就像</div>` : '';
    return pre + renderTerm(pair.a) + `<div class="arr">→</div>` + renderTerm(pair.b);
  }).join('');
  return `<div class="analogy-row">${blocks}</div>`;
}

// ─────────────────────────────────────────────────────────────────
// Cube Net (立方體展開圖,標籤版)
// layout: "cross" | "T" | "L"
// faces: [{position, label?, color?, symbol?}]
// position: top|front|right|back|left|bottom
// ─────────────────────────────────────────────────────────────────
function renderCubeNet(spec) {
  // 預設 cross 佈局:十字型
  //         [top]
  //   [left][front][right][back]
  //         [bottom]
  const faceSize = 40;
  const stroke = COLORS.ink;
  const positions = {
    cross: {
      top:    { col: 1, row: 0 },
      left:   { col: 0, row: 1 },
      front:  { col: 1, row: 1 },
      right:  { col: 2, row: 1 },
      back:   { col: 3, row: 1 },
      bottom: { col: 1, row: 2 }
    }
  };
  const layout = positions[spec.layout || 'cross'];
  if (!layout) return `<div class="render-error">cubeNet layout "${spec.layout}" not supported</div>`;

  // 計算容器大小
  const maxCol = Math.max(...Object.values(layout).map(p => p.col));
  const maxRow = Math.max(...Object.values(layout).map(p => p.row));
  const W = (maxCol + 1) * faceSize + 20;
  const H = (maxRow + 1) * faceSize + 20;

  const faces = (spec.faces || []).map(f => {
    const pos = layout[f.position];
    if (!pos) return '';
    const x = pos.col * faceSize + 10;
    const y = pos.row * faceSize + 10;
    const fill = f.color ? (COLORS[f.color] || f.color) : 'white';
    const label = f.label || f.symbol || '';
    const textColor = f.color === 'purple' || f.color === 'ink' ? 'white' : stroke;
    return `<rect x="${x}" y="${y}" width="${faceSize}" height="${faceSize}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`
         + (label ? `<text x="${x + faceSize/2}" y="${y + faceSize/2 + 6}" text-anchor="middle" font-size="18" font-weight="900" fill="${textColor}">${label}</text>` : '');
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${faces}</svg>`;
}

// ─────────────────────────────────────────────────────────────────
// Folded Paper — 折紙打洞示意圖
//
// spec:
//   layout: 'flat'    完整方形 (預設)
//         | 'half-h'  上下對摺後的半張 (高度 1/2)
//         | 'half-v'  左右對摺後的半張 (寬度 1/2)
//         | 'quarter' 對摺兩次後的 1/4 (寬高都 1/2)
//   foldHint: 'horizontal' | 'vertical' | [...] 畫虛線表示「對摺線」
//   holes: [{x, y}] 0-1 範圍的洞位置 (相對於當前 layout 的紙面)
//   label: 紙下方文字 (例如「對摺線」、「展開?」)
//
// 用法 — composite 把多步驟串起來:
//   { type: 'composite', arrangement: 'horizontal', items: [
//       { type: 'foldedPaper', layout: 'flat', foldHint: 'horizontal',
//         label: '對摺線' },
//       { type: 'text', content: '→' },
//       { type: 'foldedPaper', layout: 'half-h', holes: [{x:0.33,y:0.5}] },
//       { type: 'text', content: '展開?' }
//   ]}
// ─────────────────────────────────────────────────────────────────
function renderFoldedPaper(spec) {
  if (spec.raw_html) return spec.raw_html;  // 過渡用 escape hatch

  const INK = '#2D2A4A';
  const PINK = '#FF6B9D';
  const FOLD_LINE = '#9B98B5';

  // 不同 layout 對應不同尺寸
  const baseW = 60;
  const baseH = 60;
  let w = baseW, h = baseH;
  if (spec.layout === 'half-h')  h = baseH / 2;
  if (spec.layout === 'half-v')  w = baseW / 2;
  if (spec.layout === 'quarter') { w = baseW / 2; h = baseH / 2; }

  const padding = 10;
  // 永遠用 baseW × baseH 容器,讓不同 layout 的紙在 composite 排列時對齊
  const containerW = baseW + padding * 2;
  const containerH = baseH + padding * 2 + (spec.label ? 16 : 0);
  // 在容器內把紙置中
  const paperX = padding + (baseW - w) / 2;
  const paperY = padding + (baseH - h) / 2;

  const parts = [];

  // 紙張矩形
  parts.push(`<rect x="${paperX}" y="${paperY}" width="${w}" height="${h}" fill="white" stroke="${INK}" stroke-width="2.5" rx="2"/>`);

  // 對摺線提示 (虛線)
  if (spec.foldHint) {
    const hints = Array.isArray(spec.foldHint) ? spec.foldHint : [spec.foldHint];
    hints.forEach(f => {
      if (f === 'horizontal') {
        const y = paperY + h / 2;
        parts.push(`<line x1="${paperX}" y1="${y}" x2="${paperX + w}" y2="${y}" stroke="${FOLD_LINE}" stroke-width="1.5" stroke-dasharray="3,3"/>`);
      } else if (f === 'vertical') {
        const x = paperX + w / 2;
        parts.push(`<line x1="${x}" y1="${paperY}" x2="${x}" y2="${paperY + h}" stroke="${FOLD_LINE}" stroke-width="1.5" stroke-dasharray="3,3"/>`);
      }
    });
  }

  // 洞 (粉紅小圓,有黑邊框)
  (spec.holes || []).forEach(hole => {
    const cx = paperX + (hole.x || 0) * w;
    const cy = paperY + (hole.y || 0) * h;
    parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4" fill="${PINK}" stroke="${INK}" stroke-width="1.5"/>`);
  });

  // 標籤
  if (spec.label) {
    const labelY = paperY + h + 14;
    parts.push(`<text x="${padding + baseW / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${spec.label}</text>`);
  }

  return `<svg width="${containerW}" height="${containerH}" viewBox="0 0 ${containerW} ${containerH}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

// ─────────────────────────────────────────────────────────────────
// Single Shape (給 options 用)
// ─────────────────────────────────────────────────────────────────
function renderSingleShape(spec) {
  return svg(renderCellContent(spec), spec.size || 50);
}

// ─────────────────────────────────────────────────────────────────
// Composite (水平/垂直組合多個視覺)
// arrangement: "horizontal" | "vertical"
// items: [VisualSpec]
// ─────────────────────────────────────────────────────────────────
function renderComposite(spec) {
  const arrange = spec.arrangement || 'horizontal';
  const gap = spec.gap || 12;
  const dir = arrange === 'vertical' ? 'column' : 'row';
  const inner = (spec.items || []).map(item => renderVisual(item)).join('');
  return `<div style="display:flex; flex-direction:${dir}; gap:${gap}px; align-items:center; flex-wrap:wrap; justify-content:center;">${inner}</div>`;
}
