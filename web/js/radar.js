// web/js/radar.js
// 六大能力雷達圖 (SVG)。
// 接受 aggregateByTopic() 的輸出,畫出六邊形 + 填充多邊形。

const TOPICS = ['matrix', 'sequence', 'spatial', 'numseries', 'analogy', 'multivar'];

const TOPIC_LABEL = {
  matrix:    '矩陣',
  sequence:  '序列',
  spatial:   '空間',
  numseries: '數列',
  analogy:   '類比',
  multivar:  '多元'
};

const TOPIC_COLOR = {
  matrix:    '#FF6B9D',
  sequence:  '#4ECDC4',
  spatial:   '#9B7EDE',
  numseries: '#FFD93D',
  analogy:   '#FF9F45',
  multivar:  '#5B9DEC'
};

const INK      = '#2D2A4A';
const GRID     = '#E5E2F0';
const FILL     = 'rgba(255, 107, 157, 0.22)';
const FILL_STROKE = '#FF6B9D';

/**
 * @param {object} data - { topic: { total, correct, rate } } 從 aggregateByTopic 來
 * @param {object} opts - { size, title }
 * @returns SVG markup string
 */
export function radarChart(data, opts = {}) {
  const size    = opts.size || 280;
  const padding = 48;  // 留給標籤的空間
  const cx      = size / 2;
  const cy      = size / 2;
  const maxR    = (size - padding * 2) / 2;

  // 6 軸座標 (從正上方順時針)
  const axes = TOPICS.map((topic, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2 / 6);
    return {
      topic,
      angle,
      tipX: cx + maxR * Math.cos(angle),
      tipY: cy + maxR * Math.sin(angle),
      labelX: cx + (maxR + 24) * Math.cos(angle),
      labelY: cy + (maxR + 24) * Math.sin(angle)
    };
  });

  // 背景網格:4 圈 (25/50/75/100%)
  const rings = [0.25, 0.5, 0.75, 1.0].map((r, ringIdx) => {
    const points = axes.map(a =>
      `${(cx + maxR * r * Math.cos(a.angle)).toFixed(1)},${(cy + maxR * r * Math.sin(a.angle)).toFixed(1)}`
    ).join(' ');
    const strokeW = ringIdx === 3 ? 2 : 1;
    return `<polygon points="${points}" fill="none" stroke="${GRID}" stroke-width="${strokeW}"/>`;
  }).join('');

  // 軸線 (從中心到尖端)
  const axisLines = axes.map(a =>
    `<line x1="${cx}" y1="${cy}" x2="${a.tipX.toFixed(1)}" y2="${a.tipY.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`
  ).join('');

  // 資料多邊形 (依 rate)
  const dataPoints = axes.map(a => {
    const d = data[a.topic];
    const rate = (d && d.total > 0) ? d.rate : 0;
    return {
      x: cx + maxR * rate * Math.cos(a.angle),
      y: cy + maxR * rate * Math.sin(a.angle),
      rate,
      played: !!(d && d.total > 0)
    };
  });

  // 至少要有一個 played 才畫多邊形,不然會是個點
  const playedCount = dataPoints.filter(p => p.played).length;
  const dataPolygon = playedCount >= 1 ? `<polygon
    points="${dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"
    fill="${FILL}"
    stroke="${FILL_STROKE}"
    stroke-width="2.5"
    stroke-linejoin="round"
    class="radar-data-polygon"/>` : '';

  // 資料點 (每個軸的端點)
  const dataDots = dataPoints.map((p, i) => {
    if (!p.played) {
      // 未玩過用空心圓
      return `<circle cx="${cx}" cy="${cy}" r="3" fill="white" stroke="${GRID}" stroke-width="1.5"/>`;
    }
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${TOPIC_COLOR[axes[i].topic]}" stroke="${INK}" stroke-width="2"/>`;
  }).join('');

  // 標籤 (題型名 + 百分比)
  const labels = axes.map((a, i) => {
    const d = data[a.topic];
    const percent = (d && d.total > 0) ? Math.round(d.rate * 100) : null;
    const isTop = a.angle < -Math.PI / 3 && a.angle > -Math.PI * 2 / 3;
    const isBottom = a.angle > Math.PI / 3 && a.angle < Math.PI * 2 / 3;
    const dy1 = isTop ? -6 : (isBottom ? 4 : -2);
    const dy2 = isTop ? 8 : (isBottom ? 18 : 12);

    return `<g class="radar-label">
      <text x="${a.labelX.toFixed(1)}" y="${(a.labelY + dy1).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${INK}">${TOPIC_LABEL[a.topic]}</text>
      ${percent !== null
        ? `<text x="${a.labelX.toFixed(1)}" y="${(a.labelY + dy2).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="${TOPIC_COLOR[a.topic]}">${percent}%</text>`
        : `<text x="${a.labelX.toFixed(1)}" y="${(a.labelY + dy2).toFixed(1)}" text-anchor="middle" font-size="10" fill="#9B98B5">未練</text>`
      }
    </g>`;
  }).join('');

  const totalH = size + 16;

  return `<svg width="${size}" height="${totalH}" viewBox="0 0 ${size} ${totalH}" xmlns="http://www.w3.org/2000/svg" class="radar-chart">
    ${rings}
    ${axisLines}
    ${dataPolygon}
    ${dataDots}
    ${labels}
  </svg>`;
}

/** 給雷達圖下面的圖例 (此題型練了幾題 / 答對率) */
export function radarLegend(data) {
  const lines = TOPICS.map(topic => {
    const d = data[topic];
    if (!d || d.total === 0) return null;
    return `<div class="legend-row">
      <span class="legend-swatch" style="background:${TOPIC_COLOR[topic]}"></span>
      <span class="legend-name">${TOPIC_LABEL[topic]}</span>
      <span class="legend-stat">${d.correct}/${d.total}</span>
    </div>`;
  }).filter(Boolean).join('');
  return `<div class="radar-legend">${lines || '<div class="legend-empty">還沒有紀錄,玩幾題吧!</div>'}</div>`;
}
