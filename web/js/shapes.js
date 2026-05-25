// web/js/shapes.js
// 基本 SVG helper 函數庫。所有形狀題的最小構件。
// 從 iq_brain_explorer.html 抽出,維持完全相容。

export const COLORS = {
  pink:   '#FF6B9D',
  teal:   '#4ECDC4',
  yellow: '#FFD93D',
  purple: '#9B7EDE',
  orange: '#FF9F45',
  blue:   '#5B9DEC',
  white:  '#FFFFFF',
  ink:    '#2D2A4A'
};

const INK = COLORS.ink;

/** 包一個 SVG 容器,viewBox 固定 50×50。 */
export function svg(content, size = 50) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

export function circle(c, r = 16, cx = 25, cy = 25, stroke = INK) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" stroke="${stroke}" stroke-width="2.5"/>`;
}

export function square(c, side = 28, x = 11, y = 11) {
  return `<rect x="${x}" y="${y}" width="${side}" height="${side}" rx="3" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;
}

export function triangle(c) {
  return `<polygon points="25,8 42,38 8,38" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

export function star(c) {
  return `<polygon points="25,6 30,19 44,19 33,28 37,42 25,34 13,42 17,28 6,19 20,19" fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
}

export function diamond(c) {
  return `<polygon points="25,6 42,25 25,44 8,25" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

export function hex(c) {
  return `<polygon points="25,6 41,15 41,35 25,44 9,35 9,15" fill="${c}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
}

export function arrow(deg, c = COLORS.pink) {
  return `<g transform="rotate(${deg} 25 25)"><path d="M 25 8 L 25 40 M 14 19 L 25 8 L 36 19" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
}

/** 骰子點數樣式 (1-6),固定位置。 */
export function dots(n) {
  const positions = {
    1: [[25, 25]],
    2: [[15, 25], [35, 25]],
    3: [[15, 15], [25, 35], [35, 15]],
    4: [[15, 15], [35, 15], [15, 35], [35, 35]],
    5: [[15, 15], [35, 15], [25, 25], [15, 35], [35, 35]],
    6: [[15, 12], [35, 12], [15, 25], [35, 25], [15, 38], [35, 38]]
  };
  if (!positions[n]) return '';
  return positions[n].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="${INK}"/>`).join('');
}

/** 多個同形狀疊放 (1-4 個,使用預設座標)。 */
export function multiShape(shape, n, c) {
  if (n === 1) return shape(c);
  if (n === 2) {
    return `<g transform="translate(-9,0) scale(0.6) translate(8,15)">${shape(c)}</g>`
         + `<g transform="translate(9,0) scale(0.6) translate(8,15)">${shape(c)}</g>`;
  }
  if (n === 3) {
    return `<g transform="scale(0.5) translate(0,10)">${shape(c)}</g>`
         + `<g transform="scale(0.5) translate(50,10)">${shape(c)}</g>`
         + `<g transform="scale(0.5) translate(25,50)">${shape(c)}</g>`;
  }
  if (n === 4) {
    return `<g transform="scale(0.45) translate(5,5)">${shape(c)}</g>`
         + `<g transform="scale(0.45) translate(55,5)">${shape(c)}</g>`
         + `<g transform="scale(0.45) translate(5,55)">${shape(c)}</g>`
         + `<g transform="scale(0.45) translate(55,55)">${shape(c)}</g>`;
  }
  return shape(c);
}

/** 矩陣格子容器。isUnknown=true 時顯示「?」黃底。 */
export function mc(content, isUnknown = false) {
  return `<div class="matrix-cell${isUnknown ? ' unknown' : ''}">${isUnknown ? '?' : content}</div>`;
}

/** 用 shape name 字串選對應 shape 函數。 */
const SHAPE_FNS = { circle, square, triangle, star, diamond, hex };
export function shapeByName(name) {
  return SHAPE_FNS[name] || null;
}

// ─── Batch +1000 新增 primitive (B.1-B.6) ─────────────────────────────
// 每個函式回傳「內部 SVG 內容」(不含 <svg> 包裝)。viewBox 統一 0 0 50 50。
// 角度規範:0° = 12 點鐘方向(正上),順時針為正。
// SVG Y 軸向下為正,所以 y_end = cy - r*cos(angle_rad)(注意是減)。
// stroke 基準 2.5(主矩陣 cell 渲染時可由 renderer 調至 3、選項 cell 調至 2.6)。

const HEX_COLORS = { black: COLORS.ink, white: '#FFFFFF', gray: '#888888' };

/** B.1 時鐘指針:angle_deg 0-359,length_ratio 0.4 或 0.7,dot_radius 預設 2 */
export function clockHand(angle_deg = 0, length_ratio = 0.7, dot_radius = 2) {
  const r = 20;
  const rad = (angle_deg * Math.PI) / 180;
  const xEnd = (25 + r * length_ratio * Math.sin(rad)).toFixed(2);
  const yEnd = (25 - r * length_ratio * Math.cos(rad)).toFixed(2);
  return `<circle cx="25" cy="25" r="${r}" fill="white" stroke="${INK}" stroke-width="2.5"/>`
       + `<circle cx="25" cy="25" r="${dot_radius}" fill="${INK}"/>`
       + `<line x1="25" y1="25" x2="${xEnd}" y2="${yEnd}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;
}

/** B.2 V 字形:orientation up/down/left/right,spread_deg 開角,dots 0-3
 *  orientation = 開口方向(up = 開口朝上、頂點在下方 25,35,V 形)。
 *  Dots 位置採參數化:fwd = 從頂點往開口方向走、perp = 垂直 fwd。
 *  r=2(略大於 spec 的 1.5,在 320px viewport 下才看得清楚)。 */
export function angleV(orientation = 'up', spread_deg = 60, dotCount = 0) {
  const armLen = 18;
  const halfRad = (spread_deg / 2) * Math.PI / 180;
  const cfg = {
    up:    { vx: 25, vy: 35, baseRad: -Math.PI / 2 },
    down:  { vx: 25, vy: 15, baseRad:  Math.PI / 2 },
    left:  { vx: 35, vy: 25, baseRad:  Math.PI     },
    right: { vx: 15, vy: 25, baseRad: 0            }
  }[orientation] || null;
  if (!cfg) return '';
  const { vx, vy, baseRad } = cfg;
  const a1 = baseRad - halfRad, a2 = baseRad + halfRad;
  const e1x = (vx + armLen * Math.cos(a1)).toFixed(2);
  const e1y = (vy + armLen * Math.sin(a1)).toFixed(2);
  const e2x = (vx + armLen * Math.cos(a2)).toFixed(2);
  const e2y = (vy + armLen * Math.sin(a2)).toFixed(2);
  let out = `<line x1="${vx}" y1="${vy}" x2="${e1x}" y2="${e1y}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
          + `<line x1="${vx}" y1="${vy}" x2="${e2x}" y2="${e2y}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`;

  if (dotCount > 0) {
    // dot 區中心:從頂點沿 baseRad 方向走 8 單位
    const cx = vx + 8 * Math.cos(baseRad);
    const cy = vy + 8 * Math.sin(baseRad);
    const fwdX = Math.cos(baseRad), fwdY = Math.sin(baseRad);
    const perpX = -fwdY, perpY = fwdX;  // perp = 順時針旋轉 fwd 90°
    const layouts = {
      1: [[cx, cy]],
      // 2 dots:垂直 fwd 方向擺,間距 4
      2: [[cx - 2 * perpX, cy - 2 * perpY], [cx + 2 * perpX, cy + 2 * perpY]],
      // 3 dots:一個遠端(深入開口)+ 兩個近端(靠近頂點),三角形排列
      3: [[cx + 3 * fwdX, cy + 3 * fwdY],
          [cx - 1 * fwdX - 2.5 * perpX, cy - 1 * fwdY - 2.5 * perpY],
          [cx - 1 * fwdX + 2.5 * perpX, cy - 1 * fwdY + 2.5 * perpY]]
    };
    const dots = layouts[dotCount];
    if (dots) {
      out += dots.map(([x, y]) =>
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2" fill="${INK}"/>`
      ).join('');
    }
  }
  return out;
}

/** B.3 三角形對角分割填色。diagonal: TL-BR 或 TR-BL。
 *  Convention:從 diagonal 起點起逆時針的第一個三角形 = top。
 *    TL-BR (起點 0,0,CCW 第一個經過 0,50) → top = 左下三角
 *    TR-BL (起點 50,0,CCW 第一個經過 0,0) → top = 左上三角  */
export function triangleSplit(diagonal = 'TL-BR', top_fill = 'white', bottom_fill = 'black') {
  const tc = HEX_COLORS[top_fill] || '#FFFFFF';
  const bc = HEX_COLORS[bottom_fill] || '#FFFFFF';
  let topTri, botTri, diagLine;
  if (diagonal === 'TL-BR') {
    topTri  = `<polygon points="0,0 0,50 50,50" fill="${tc}"/>`;
    botTri  = `<polygon points="0,0 50,0 50,50" fill="${bc}"/>`;
    diagLine = `<line x1="0" y1="0" x2="50" y2="50" stroke="${INK}" stroke-width="1.5"/>`;
  } else {
    topTri  = `<polygon points="50,0 0,0 0,50" fill="${tc}"/>`;
    botTri  = `<polygon points="50,0 0,50 50,50" fill="${bc}"/>`;
    diagLine = `<line x1="50" y1="0" x2="0" y2="50" stroke="${INK}" stroke-width="1.5"/>`;
  }
  const outline = `<rect x="0.5" y="0.5" width="49" height="49" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
  return topTri + botTri + diagLine + outline;
}

/** B.4 線條計數:橫線數 h_count、直線數 v_count(各 0-3,可同時)。 */
export function tallyLines(h_count = 0, v_count = 0) {
  const positions = { 1: [25], 2: [20, 30], 3: [18, 25, 32] };
  let parts = '';
  if (positions[h_count]) {
    parts += positions[h_count].map(y =>
      `<line x1="10" y1="${y}" x2="40" y2="${y}" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
    ).join('');
  }
  if (positions[v_count]) {
    parts += positions[v_count].map(x =>
      `<line x1="${x}" y1="10" x2="${x}" y2="40" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`
    ).join('');
  }
  return parts;
}

/** B.5 蝴蝶結:雙三角形。orientation horizontal/vertical;fill: black/white/striped。
 *  pattern id 用固定字串 (SVG defs 內 scope 不跨 <svg>),多 cell 各自的 <svg> 不衝突。 */
export function bowtie(orientation = 'horizontal', left_fill = 'white', right_fill = 'white') {
  const PID = 'bowtieStripe';
  const fillFor = (f) => f === 'striped' ? `url(#${PID})` : (HEX_COLORS[f] || '#FFFFFF');
  const needsPattern = left_fill === 'striped' || right_fill === 'striped';
  const defs = needsPattern
    ? `<defs><pattern id="${PID}" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="${INK}" stroke-width="1.5"/></pattern></defs>`
    : '';
  let leftTri, rightTri;
  if (orientation === 'horizontal') {
    leftTri  = `<polygon points="25,25 8,12 8,38" fill="${fillFor(left_fill)}" stroke="${INK}" stroke-width="2"/>`;
    rightTri = `<polygon points="25,25 42,12 42,38" fill="${fillFor(right_fill)}" stroke="${INK}" stroke-width="2"/>`;
  } else {
    leftTri  = `<polygon points="25,25 12,8 38,8" fill="${fillFor(left_fill)}" stroke="${INK}" stroke-width="2"/>`;
    rightTri = `<polygon points="25,25 12,42 38,42" fill="${fillFor(right_fill)}" stroke="${INK}" stroke-width="2"/>`;
  }
  return defs + leftTri + rightTri;
}

/** B.6 巢狀 9 宮格。filled_cells 是 0-8 的索引陣列;black_cell_size 'normal'|'large'。
 *  另支援 'fill_color' 跟 'fill_shape' 兩個可選 (direct-position-mapping easy 20 題用)。 */
export function nestedGrid(filled_cells = [], black_cell_size = 'normal', opts = {}) {
  const inset = black_cell_size === 'large' ? 1 : 2;
  const fillSize = 10 - 2 * inset;
  const fillColor = opts.fill_color ? (COLORS[opts.fill_color] || opts.fill_color) : INK;
  const fillShape = opts.fill_shape || 'square';   // 'square'|'circle'|'triangle'
  const borderColor = opts.border_color ? (COLORS[opts.border_color] || opts.border_color) : INK;

  let parts = '';
  for (let i = 0; i <= 3; i++) {
    const v = 10 + i * 10;
    parts += `<line x1="${v}" y1="10" x2="${v}" y2="40" stroke="${borderColor}" stroke-width="1.5"/>`;
    parts += `<line x1="10" y1="${v}" x2="40" y2="${v}" stroke="${borderColor}" stroke-width="1.5"/>`;
  }
  for (const idx of filled_cells) {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    const x = 10 + col * 10 + inset;
    const y = 10 + row * 10 + inset;
    const cx = x + fillSize / 2;
    const cy = y + fillSize / 2;
    if (fillShape === 'circle') {
      parts += `<circle cx="${cx}" cy="${cy}" r="${fillSize / 2}" fill="${fillColor}"/>`;
    } else if (fillShape === 'triangle') {
      const t = `${cx},${y} ${x + fillSize},${y + fillSize} ${x},${y + fillSize}`;
      parts += `<polygon points="${t}" fill="${fillColor}"/>`;
    } else {
      parts += `<rect x="${x}" y="${y}" width="${fillSize}" height="${fillSize}" fill="${fillColor}"/>`;
    }
  }
  return parts;
}
