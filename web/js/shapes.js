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
