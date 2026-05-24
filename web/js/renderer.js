// web/js/renderer.js
// 中央 renderer:把 visual spec 物件轉成 HTML 字串。
// 所有題目的 visual 跟 options[i].visual 都經過這個函數。

import {
  svg, circle, square, triangle, star, diamond, hex, arrow, dots,
  multiShape, mc, shapeByName, COLORS
} from './shapes.js';
import { cubeStack } from './iso.js';

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
// Folded Paper (折紙打洞示意,目前用 raw-html 過渡,後續實作)
// ─────────────────────────────────────────────────────────────────
function renderFoldedPaper(spec) {
  // 暫用占位,實作待 wishlist 項目處理
  if (spec.raw_html) return spec.raw_html;
  return `<div class="render-stub">[foldedPaper helper 待實作]</div>`;
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
