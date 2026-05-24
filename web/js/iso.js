// web/js/iso.js
// 等角投影 (isometric) 立方體堆疊渲染。
// 提供 cubeStack(layout, options) — 接受 1D/2D/3D 陣列,輸出 SVG 字串。

export const ISO_COLORS = {
  top:   '#FFD93D',   // yellow
  left:  '#FF9F45',   // orange
  right: '#FF6B9D',   // pink
  edge:  '#2D2A4A'
};

/** (x,y,z) 3D → (sx,sy) 2D 等角投影。 */
function project(x, y, z, s) {
  const cos30 = Math.cos(Math.PI / 6);  // ≈ 0.866
  const sin30 = Math.sin(Math.PI / 6);  // = 0.5
  return {
    sx: (x - y) * cos30 * s,
    sy: (x + y) * sin30 * s - z * s
  };
}

/**
 * 畫一個單位立方體 (位於 x,y,z)。
 * neighbors: { px, py, pz } — 三個方向是否有鄰居,有的話該面剔除。
 */
function isoCube(x, y, z, s, neighbors, colors) {
  const p = {
    blf: project(x,   y,   z,   s),
    brf: project(x+1, y,   z,   s),
    blb: project(x,   y+1, z,   s),
    brb: project(x+1, y+1, z,   s),
    tlf: project(x,   y,   z+1, s),
    trf: project(x+1, y,   z+1, s),
    tlb: project(x,   y+1, z+1, s),
    trb: project(x+1, y+1, z+1, s)
  };
  const poly = (pts, fill) => {
    const d = pts.map(pt => `${pt.sx.toFixed(2)},${pt.sy.toFixed(2)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" stroke="${colors.edge}" stroke-width="1.5" stroke-linejoin="round"/>`;
  };
  const faces = [];
  // +X face (右下): visible if no neighbor at (x+1, y, z)
  if (!neighbors.px) faces.push(poly([p.brf, p.brb, p.trb, p.trf], colors.right));
  // +Y face (左下): visible if no neighbor at (x, y+1, z)
  if (!neighbors.py) faces.push(poly([p.blb, p.brb, p.trb, p.tlb], colors.left));
  // +Z face (頂): visible if no neighbor at (x, y, z+1)
  if (!neighbors.pz) faces.push(poly([p.tlf, p.trf, p.trb, p.tlb], colors.top));
  return faces.join('');
}

/**
 * 畫立方體堆疊。
 * @param {number[] | number[][] | number[][][]} layout - 1D / 2D / 3D 陣列, 1 = 有方塊, 0 = 空
 * @param {object} options - { size, colors, padding }
 * @returns {string} SVG markup
 */
export function cubeStack(layout, options = {}) {
  const s = options.size || 24;
  const colors = options.colors || ISO_COLORS;
  const padding = options.padding || 10;

  // 正規化成 3D
  let l3;
  if (typeof layout[0] === 'number')         l3 = [[layout]];
  else if (typeof layout[0][0] === 'number') l3 = [layout];
  else                                       l3 = layout;

  // 蒐集 cells + 建鄰居索引
  const cells = [];
  const set = new Set();
  for (let z = 0; z < l3.length; z++) {
    for (let y = 0; y < l3[z].length; y++) {
      for (let x = 0; x < l3[z][y].length; x++) {
        if (l3[z][y][x]) { cells.push({ x, y, z }); set.add(`${x},${y},${z}`); }
      }
    }
  }
  if (cells.length === 0) return `<svg width="60" height="60"></svg>`;
  const has = (x, y, z) => set.has(`${x},${y},${z}`);

  // Painter sort: x+y 小的先畫 (遠到近)
  cells.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z);

  // Bounding box
  const pts = [];
  cells.forEach(({ x, y, z }) => {
    for (const dx of [0, 1])
      for (const dy of [0, 1])
        for (const dz of [0, 1])
          pts.push(project(x + dx, y + dy, z + dz, s));
  });
  const minX = Math.min(...pts.map(p => p.sx));
  const maxX = Math.max(...pts.map(p => p.sx));
  const minY = Math.min(...pts.map(p => p.sy));
  const maxY = Math.max(...pts.map(p => p.sy));
  const W = maxX - minX + padding * 2;
  const H = maxY - minY + padding * 2;
  const tx = -minX + padding;
  const ty = -minY + padding;

  const body = cells.map(c => isoCube(c.x, c.y, c.z, s, {
    px: has(c.x + 1, c.y, c.z),
    py: has(c.x, c.y + 1, c.z),
    pz: has(c.x, c.y, c.z + 1)
  }, colors)).join('');

  return `<svg width="${W.toFixed(0)}" height="${H.toFixed(0)}" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)})">${body}</g>
  </svg>`;
}
