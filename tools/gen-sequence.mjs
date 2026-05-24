#!/usr/bin/env node
// tools/gen-sequence.mjs
// 生成「圖形序列」題型,8 個 sub_type 共 75 題。
//
// Reviewer 拍板 (PR #5):
// Q1 cyclic-count-color seed (mid-001) 不擴,我用 dual-attribute-cycle 走自己的 label
// Q2 nested-elements 保 5 題,raw SVG 統一從 nestedCellRaw() helper 出
// Q3 命名用 dual-attribute-cycle (不是 triple-cycle)
//
// I-RAVEN 加碼約束:同題 4 個選項裡,「對」跟「最像錯答」要刻意拉開視覺差異
// (≥ 2 個 attribute 不同),避免孩子靠「看哪個最像」就猜。
// → distractor 設計時用 cellDistance() 檢查,並讓「規則內錯位」距 ≥ 2。

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle, COLOR_ZH, SHAPE_ZH } from './gen-utils.mjs';

const TOPIC = 'sequence';

// ─── PROMPTS (per sub_type 統一語氣,跨 sub_type 變化) ──────────────────
const PROMPTS = {
  'cyclic-AB':              '形狀和顏色在輪換,下一個是什麼?',
  'cyclic-ABC':             '三個一組重複,下一個應該是?',
  'rotation-equal-angle':   '看箭頭怎麼轉,下一個指向哪裡?',
  'accumulative':           '東西的數量在變多,下一格有幾個?',
  'dual-attribute-cycle':   '形狀跟顏色各有自己的節奏,下一個是?',
  'nested-elements':        '外框和裡面的小圖都在變,下一個是?',
  'async-variation':        '不同的東西用不同速度在變,下一個是?',
  'grouped-pattern':        '把它兩兩分組看,下一個應該是?',
  'complex-rotation':       '箭頭轉、顏色也在變,下一個是什麼?'
};

// ─── 共用資源 ───────────────────────────────────────────────────────────
const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'];
const COLORS = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];
const ROT_STEPS = [45, 90];   // 等角度旋轉:每次 45° 或 90°

// 描述一個 cell 給 option text 用
// guard: 若 cell 缺 shape/color,throw — 避免靜默產生 "粉紅undefined" 這種 text
// (前車之鑑:grouped-pattern v1 因 SHAPES pool 抽光,distractor 的 shape 變 undefined,
//  describe 跑出 "粉紅undefined" 通過原 validator,造成 PR #5 6 題壞掉)
function describe(cell) {
  if (cell.unknown) return '?';
  if (cell.shape === undefined || cell.shape === null) {
    throw new Error(`describe(): cell missing shape: ${JSON.stringify(cell)}`);
  }
  if (cell.color === undefined || cell.color === null) {
    throw new Error(`describe(): cell missing color: ${JSON.stringify(cell)}`);
  }
  const c = COLOR_ZH[cell.color] || cell.color;
  const s = SHAPE_ZH[cell.shape] || cell.shape;
  if (cell.shape === 'arrow') {
    const arrowDir = { 0: '↑', 45: '↗', 90: '→', 135: '↘', 180: '↓', 225: '↙', 270: '←', 315: '↖' };
    return `${c}${arrowDir[cell.rotation] ?? cell.rotation + '°'}`;
  }
  if (cell.count && cell.count > 1) return `${cell.count} 個${c}${s}`;
  if (cell.dots) return `${cell.dots} 點`;
  return `${c}${s}`;
}

// 兩個 cell 在多少個 attribute 上不同 (用來檢查 distractor 視覺距離)
function cellDistance(a, b) {
  let d = 0;
  for (const k of ['shape', 'color', 'count', 'rotation', 'dots']) {
    const av = a[k] ?? null, bv = b[k] ?? null;
    if (av !== bv) d += 1;
  }
  return d;
}

// 把 single-shape cell 轉成 option (含 visual)
function cellToOption(cell) {
  const visual = { type: 'single-shape' };
  for (const k of ['shape', 'color', 'count', 'rotation', 'dots']) {
    if (cell[k] !== undefined) visual[k] = cell[k];
  }
  return { text: describe(cell), visual };
}

// shuffle 選項並算 answer index
function placeCellOptions(correct, distractors, seedId) {
  const seed = [...seedId].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const all = [correct, ...distractors];
  // 去重 by describe text
  const seen = new Set();
  const unique = [];
  for (const c of all) {
    const k = describe(c);
    if (!seen.has(k)) { seen.add(k); unique.push(c); }
  }
  // 不足 4 個就 fallback 補一個新 shape (不應發生,留保險)
  while (unique.length < 4) {
    const filler = { shape: SHAPES[unique.length % SHAPES.length], color: COLORS[(unique.length + 2) % COLORS.length] };
    if (!seen.has(describe(filler))) { seen.add(describe(filler)); unique.push(filler); }
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const opts = shuffled.map(cellToOption);
  const answerIdx = shuffled.findIndex(c => describe(c) === describe(correct));
  return { options: opts, answerIdx };
}

function makeQ(id, difficulty, sub_type, skill_code, skillZh, visualItems, options, answerIdx, hint, explanation) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: PROMPTS[sub_type],
    visual: { type: 'sequence-row', items: visualItems },
    options,
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// 抽 2 個不同 shape + 2 個不同 color
function pickTwoDistinctCells(rng) {
  const shuffled = rngShuffle(rng, SHAPES);
  const colorShuffled = rngShuffle(rng, COLORS);
  return [
    { shape: shuffled[0], color: colorShuffled[0] },
    { shape: shuffled[1], color: colorShuffled[1] }
  ];
}

function pickThreeDistinctCells(rng) {
  const sh = rngShuffle(rng, SHAPES);
  const co = rngShuffle(rng, COLORS);
  return [
    { shape: sh[0], color: co[0] },
    { shape: sh[1], color: co[1] },
    { shape: sh[2], color: co[2] }
  ];
}

// ─── EASY ──────────────────────────────────────────────────────────────

// cyclic-AB: [A,B,A,B,?] → A
function genCyclicAB(id, seed) {
  const rng = makeRng(seed);
  const [A, B] = pickTwoDistinctCells(rng);
  const items = [A, B, A, B, { unknown: true }];
  const correct = A;
  // 干擾:
  //  D1 (規則內錯位): B (誤判位置) — A 跟 B 自然就 ≥ 2 attr 不同
  //  D2 (部分規則):   A 的 shape + B 的 color (1-attr 對 1-attr 錯)
  //  D3 (跳出規則):   新 shape + 新 color
  const sh3 = SHAPES.find(s => s !== A.shape && s !== B.shape);
  const co3 = COLORS.find(c => c !== A.color && c !== B.color);
  const D1 = B;
  const D2 = { shape: A.shape, color: B.color };
  const D3 = { shape: sh3, color: co3 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'easy', 'cyclic-AB', 'sequence-cyclic', 'AB 循環追蹤',
    items, options, answerIdx,
    `兩個一組重複:${describe(A)}→${describe(B)}→${describe(A)}→${describe(B)}→?。第 5 個應該回到哪一個?`,
    `這是<strong>AB AB</strong> 循環:<strong>${describe(A)}</strong> 跟 <strong>${describe(B)}</strong> 兩個輪流。前 4 格是 ${describe(A)}→${describe(B)}→${describe(A)}→${describe(B)},第 5 格輪到 <strong>${describe(A)}</strong>。`
  );
}

// cyclic-ABC: [A,B,C,A,B,?] → C
function genCyclicABC(id, seed) {
  const rng = makeRng(seed);
  const [A, B, C] = pickThreeDistinctCells(rng);
  const items = [A, B, C, A, B, { unknown: true }];
  const correct = C;
  // D1: B (前一個 cycle 位置,跟答案 C 自然差 2 attr)
  // D2: A 的 shape + C 的 color (對的色錯的形)
  // D3: 新 shape + 新 color
  const sh4 = SHAPES.find(s => ![A.shape, B.shape, C.shape].includes(s));
  const co4 = COLORS.find(c => ![A.color, B.color, C.color].includes(c));
  const D1 = B;
  const D2 = { shape: A.shape, color: C.color };
  const D3 = { shape: sh4, color: co4 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'easy', 'cyclic-ABC', 'sequence-cyclic', 'ABC 循環追蹤',
    items, options, answerIdx,
    `三個一組重複:${describe(A)}→${describe(B)}→${describe(C)}→${describe(A)}→${describe(B)}→?。下一個輪到哪一個?`,
    `這是<strong>ABC ABC</strong> 三項循環:${describe(A)}→${describe(B)}→${describe(C)} 一直重複。前 5 格走完 ABCAB,第 6 格輪到 <strong>${describe(C)}</strong>。`
  );
}

// rotation-equal-angle: 4 個箭頭,每次轉固定角度,問下一個
function genRotation(id, seed) {
  const rng = makeRng(seed);
  const step = rngShuffle(rng, ROT_STEPS)[0];   // 45 or 90
  const startRot = rngShuffle(rng, [0, 45, 90, 135])[0];
  const color = rngShuffle(rng, COLORS)[0];
  const items = [];
  for (let i = 0; i < 4; i++) {
    items.push({ shape: 'arrow', rotation: (startRot + step * i) % 360, color });
  }
  items.push({ unknown: true });
  const correct = { shape: 'arrow', rotation: (startRot + step * 4) % 360, color };

  // 干擾 (按 I-RAVEN 約束:讓「規則內錯位」距 ≥ 2 attr):
  //  D1: 反方向 (倒退 step) — 同色;額外換顏色讓距 = 2 attr
  //  D2: 對的方向但跳 2 步 (前進 2 step) — 同色 (1 attr 不同)
  //  D3: 對的角度但錯誤 shape (改 circle)
  const otherColor = COLORS.find(c => c !== color);
  const D1 = { shape: 'arrow', rotation: (startRot + step * 3) % 360, color: otherColor };  // 角度倒退 + 換色 → 2 attr
  const D2 = { shape: 'arrow', rotation: (startRot + step * 5) % 360, color };               // 多前進一步 → 1 attr
  const D3 = { shape: 'circle', color };                                                      // 換 shape → 1 attr,但完全不在規則內
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'easy', 'rotation-equal-angle', 'sequence-rotation', '等角度旋轉追蹤',
    items, options, answerIdx,
    `每次轉 ${step}°。前 4 格指 ${items.slice(0,4).map(c => describe(c)).join('→')},下一格指?`,
    `箭頭每次<strong>順時針轉 ${step}°</strong>。第 5 格在 ${items[3].rotation}° + ${step}° = <strong>${correct.rotation}°</strong>(${describe(correct)})。`
  );
}

// ─── MID ──────────────────────────────────────────────────────────────

// accumulative: 1→2→3→4→?=5 用 dots 或 count
function genAccumulative(id, seed) {
  const rng = makeRng(seed);
  // 隨機決定用 dots 還是 count
  const useDots = rng() < 0.5;
  if (useDots) {
    // dots 1→2→3→4→? = 5  (dots 範圍 1-6)
    const items = [];
    for (let n = 1; n <= 4; n++) items.push({ shape: 'dots', dots: n, color: 'pink' });
    items.push({ unknown: true });
    const correct = { shape: 'dots', dots: 5, color: 'pink' };
    // 干擾:
    //  D1 (規則內錯位): dots=4 但換色 → 距 2 attr (符合 I-RAVEN 約束)
    //  D2 (部分規則):   dots=6 (跳一格)
    //  D3 (跳出規則):   不同 shape 但對的「下一個」概念 (5 個 circle 用 count)
    const otherColor = COLORS.find(c => c !== 'pink');
    const D1 = { shape: 'dots', dots: 4, color: otherColor };
    const D2 = { shape: 'dots', dots: 6, color: 'pink' };
    const D3 = { shape: 'circle', color: 'pink', count: 4 };
    const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
    return makeQ(id, 'mid', 'accumulative', 'sequence-accumulative', '累積數量追蹤',
      items, options, answerIdx,
      `每格的點數是 1, 2, 3, 4,下一格應該是幾點?`,
      `每格<strong>多 1 點</strong>:1→2→3→4→<strong>5 點</strong>。`
    );
  } else {
    // count 1→2→3→? = 4 (count 範圍 1-4)
    const shape = rngShuffle(rng, ['circle', 'square', 'triangle', 'star'])[0];
    const color = rngShuffle(rng, COLORS)[0];
    const items = [];
    for (let n = 1; n <= 3; n++) items.push({ shape, color, count: n });
    items.push({ unknown: true });
    const correct = { shape, color, count: 4 };
    const otherColor = COLORS.find(c => c !== color);
    const otherShape = SHAPES.find(s => s !== shape);
    const D1 = { shape, color: otherColor, count: 3 };   // 同數量但換色 → 2 attr
    const D2 = { shape, color, count: 2 };                // 倒退 → 1 attr
    const D3 = { shape: otherShape, color, count: 4 };    // 對的數量錯的 shape
    const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
    return makeQ(id, 'mid', 'accumulative', 'sequence-accumulative', '累積數量追蹤',
      items, options, answerIdx,
      `每格的${describe({shape, color})}數量是 1, 2, 3,下一格應該幾個?`,
      `每格<strong>多 1 個</strong>:1→2→3→<strong>4 個 ${describe({shape, color})}</strong>。`
    );
  }
}

// dual-attribute-cycle: 兩個屬性各自循環,週期不同
// 例如 shape ABC (週期 3), color XY (週期 2),合起來週期 6
function genDualAttributeCycle(id, seed) {
  const rng = makeRng(seed);
  const [s1, s2, s3] = rngShuffle(rng, SHAPES).slice(0, 3);
  const [c1, c2] = rngShuffle(rng, COLORS).slice(0, 2);
  // 6 格 sequence:i = 0..5, shape = [s1,s2,s3][i%3], color = [c1,c2][i%2]
  const cellAt = (i) => ({ shape: [s1, s2, s3][i % 3], color: [c1, c2][i % 2] });
  const items = [];
  for (let i = 0; i < 5; i++) items.push(cellAt(i));
  items.push({ unknown: true });
  const correct = cellAt(5);   // i=5: shape s3, color c2

  // 干擾:
  //  D1 (規則內錯位): 兩 cycle 都錯一格 — 用 i=4 的 cell
  //  D2 (部分對):     對的 shape 但錯的 color (用 c1 而非 c2)
  //  D3 (跳出):       對的 color 但用第 4 個 shape (不在 ABC 循環內)
  const sh4 = SHAPES.find(s => ![s1, s2, s3].includes(s));
  const D1 = cellAt(4);                                  // shape s2, color c1 → 跟 correct 差 2 attr ✓
  const D2 = { shape: correct.shape, color: c1 };        // 1 attr 不同
  const D3 = { shape: sh4, color: correct.color };       // 1 attr 不同
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'mid', 'dual-attribute-cycle', 'sequence-cyclic', '雙屬性異步循環',
    items, options, answerIdx,
    `形狀依 ${SHAPE_ZH[s1]}→${SHAPE_ZH[s2]}→${SHAPE_ZH[s3]} 三個一輪;顏色依 ${COLOR_ZH[c1]}→${COLOR_ZH[c2]} 兩個一輪。第 6 格的形狀跟顏色各應該是什麼?`,
    `<strong>形狀</strong>三個一輪 (週期 3):${SHAPE_ZH[s1]}→${SHAPE_ZH[s2]}→${SHAPE_ZH[s3]}→${SHAPE_ZH[s1]}→${SHAPE_ZH[s2]}→<strong>${SHAPE_ZH[s3]}</strong>。<strong>顏色</strong>兩個一輪 (週期 2):${COLOR_ZH[c1]}→${COLOR_ZH[c2]}→${COLOR_ZH[c1]}→${COLOR_ZH[c2]}→${COLOR_ZH[c1]}→<strong>${COLOR_ZH[c2]}</strong>。合起來:<strong>${describe(correct)}</strong>。`
  );
}

// nested-elements: 外框形狀 + 內元素,raw SVG (per reviewer Q2 要 helper)
function nestedCellRaw(outerShape, outerColor, innerShape, innerColor) {
  // 50x50 viewBox, 跟 sequence-mid-002 seed 風格一致
  const outerColorHex = { pink: '#FF6B9D', teal: '#4ECDC4', yellow: '#FFD93D', purple: '#9B7EDE', orange: '#FF9F45', blue: '#5B9DEC', white: '#FFFFFF' }[outerColor] || '#FFFFFF';
  const innerColorHex = { pink: '#FF6B9D', teal: '#4ECDC4', yellow: '#FFD93D', purple: '#9B7EDE', orange: '#FF9F45', blue: '#5B9DEC', white: '#FFFFFF' }[innerColor] || '#FF6B9D';
  const ink = '#2D2A4A';

  let outer = '';
  if (outerShape === 'circle')   outer = `<circle cx='25' cy='25' r='20' fill='${outerColorHex}' stroke='${ink}' stroke-width='2.5'/>`;
  else if (outerShape === 'square') outer = `<rect x='9' y='9' width='32' height='32' rx='3' fill='${outerColorHex}' stroke='${ink}' stroke-width='2.5'/>`;
  else if (outerShape === 'triangle') outer = `<polygon points='25,8 42,38 8,38' fill='${outerColorHex}' stroke='${ink}' stroke-width='2.5' stroke-linejoin='round'/>`;

  let inner = '';
  if (innerShape === 'circle')   inner = `<circle cx='25' cy='${outerShape === 'triangle' ? 30 : 25}' r='7' fill='${innerColorHex}' stroke='${ink}' stroke-width='2'/>`;
  else if (innerShape === 'square') inner = `<rect x='20' y='${outerShape === 'triangle' ? 25 : 20}' width='10' height='10' rx='2' fill='${innerColorHex}' stroke='${ink}' stroke-width='2'/>`;
  else if (innerShape === 'triangle') inner = `<polygon points='25,${outerShape === 'triangle' ? 22 : 17} 33,${outerShape === 'triangle' ? 33 : 30} 17,${outerShape === 'triangle' ? 33 : 30}' fill='${innerColorHex}' stroke='${ink}' stroke-width='2' stroke-linejoin='round'/>`;

  return outer + inner;
}

// 把 raw 字串包成 option (含 svg 容器)
function rawCellOption(outerShape, outerColor, innerShape, innerColor) {
  const text = `${SHAPE_ZH[outerShape]}中${COLOR_ZH[innerColor]}${SHAPE_ZH[innerShape]}`;
  return {
    text,
    visual: {
      type: 'raw-html',
      html: `<svg width='50' height='50' viewBox='0 0 50 50'>${nestedCellRaw(outerShape, outerColor, innerShape, innerColor)}</svg>`
    }
  };
}

function genNestedElements(id, seed) {
  const rng = makeRng(seed);
  const NESTED_SHAPES = ['circle', 'square', 'triangle'];
  // 外框 3 循環,內元素 3 循環,獨立週期
  const [o1, o2, o3] = rngShuffle(rng, NESTED_SHAPES);
  const [i1, i2, i3] = rngShuffle(rng, NESTED_SHAPES);
  const outerColor = 'white';   // 外框統一白底,跟 seed 風格一致
  const innerColors = rngShuffle(rng, ['pink', 'teal', 'yellow']);
  const cellAt = (idx) => ({
    outerShape: [o1, o2, o3][idx % 3],
    innerShape: [i1, i2, i3][idx % 3],
    innerColor: innerColors[idx % 3]
  });
  const visualItems = [];
  for (let idx = 0; idx < 4; idx++) {
    const c = cellAt(idx);
    visualItems.push({ raw: nestedCellRaw(c.outerShape, outerColor, c.innerShape, c.innerColor) });
  }
  visualItems.push({ unknown: true });
  const correct = cellAt(4);   // i=4 → 同 i=1 (週期 3)

  // 干擾:
  //  D1 (規則內錯位): cellAt(3) — 上一個位置,outer+inner 都錯,跟 correct 差 ≥ 2 ✓
  //  D2 (部分對):     對的外框 + 錯的內形
  //  D3 (跳出):       外框 + 內形都對,但內色錯
  const D1 = cellAt(3);
  const D2 = { outerShape: correct.outerShape, innerShape: cellAt(2).innerShape, innerColor: correct.innerColor };
  const D3 = { outerShape: correct.outerShape, innerShape: correct.innerShape, innerColor: cellAt(2).innerColor };

  const correctOpt = rawCellOption(correct.outerShape, outerColor, correct.innerShape, correct.innerColor);
  const D1Opt = rawCellOption(D1.outerShape, outerColor, D1.innerShape, D1.innerColor);
  const D2Opt = rawCellOption(D2.outerShape, outerColor, D2.innerShape, D2.innerColor);
  const D3Opt = rawCellOption(D3.outerShape, outerColor, D3.innerShape, D3.innerColor);

  const seedNum = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const shuffled = rngShuffle(makeRng(seedNum), [correctOpt, D1Opt, D2Opt, D3Opt]);
  const answerIdx = shuffled.findIndex(o => o.text === correctOpt.text);

  return makeQ(id, 'mid', 'nested-elements', 'sequence-nested', '巢狀元素同步追蹤',
    visualItems, shuffled, answerIdx,
    `外框照 ${SHAPE_ZH[o1]}→${SHAPE_ZH[o2]}→${SHAPE_ZH[o3]} 三個一輪;內部小圖照 ${COLOR_ZH[innerColors[0]]}${SHAPE_ZH[i1]}→${COLOR_ZH[innerColors[1]]}${SHAPE_ZH[i2]}→${COLOR_ZH[innerColors[2]]}${SHAPE_ZH[i3]} 三個一輪。第 5 格是哪一組?`,
    `<strong>外框</strong>循環:${SHAPE_ZH[o1]}→${SHAPE_ZH[o2]}→${SHAPE_ZH[o3]}→${SHAPE_ZH[o1]}→<strong>${SHAPE_ZH[correct.outerShape]}</strong>。<strong>內部</strong>循環:${COLOR_ZH[innerColors[0]]}${SHAPE_ZH[i1]}→${COLOR_ZH[innerColors[1]]}${SHAPE_ZH[i2]}→${COLOR_ZH[innerColors[2]]}${SHAPE_ZH[i3]}→${COLOR_ZH[innerColors[0]]}${SHAPE_ZH[i1]}→<strong>${COLOR_ZH[correct.innerColor]}${SHAPE_ZH[correct.innerShape]}</strong>。`
  );
}

// ─── HARD ──────────────────────────────────────────────────────────────

// async-variation: 兩個屬性,一個每格變,另一個每兩格才變
// 例如:箭頭旋轉每格 +90°,顏色每兩格才換
function genAsyncVariation(id, seed) {
  const rng = makeRng(seed);
  const step = rngShuffle(rng, [90])[0];        // 旋轉 90° 每格 (避免 45° 太細微)
  const startRot = rngShuffle(rng, [0, 90])[0];
  const [c1, c2, c3] = rngShuffle(rng, COLORS).slice(0, 3);
  // 4 格 visible:i=0..3
  //   rotation = startRot + step * i
  //   color    = [c1, c1, c2, c2][i]
  const colorAt = [c1, c1, c2, c2];
  const items = [];
  for (let i = 0; i < 4; i++) {
    items.push({ shape: 'arrow', rotation: (startRot + step * i) % 360, color: colorAt[i] });
  }
  items.push({ unknown: true });
  const correct = { shape: 'arrow', rotation: (startRot + step * 4) % 360, color: c3 };
  // (i=4: 第 5 格輪到 c3,因為「兩個一組」走完 c1c1 c2c2,接 c3c3)

  // 干擾:
  //  D1 (規則內錯位): rotation 對但 color 沒換 (還在 c2) → 1 attr 不同 → 不夠;改成 rotation 倒退 + color 對 → 跟 correct 差 1 attr (rotation only)
  //  其實要符合 I-RAVEN,要讓 D1 跟 correct 差 ≥ 2 attr
  //  D1: rotation 倒退 + color c2 (沒換) → 跟 correct 差 2 attr (rotation, color) ✓
  //  D2: rotation 對 + color c2 (沒換) → 1 attr (color)
  //  D3: rotation 對 + color c1 (跳更久)
  const D1 = { shape: 'arrow', rotation: (startRot + step * 3) % 360, color: c2 };
  const D2 = { shape: 'arrow', rotation: correct.rotation, color: c2 };
  const D3 = { shape: 'arrow', rotation: correct.rotation, color: c1 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'async-variation', 'sequence-async', '不同步變化追蹤',
    items, options, answerIdx,
    `箭頭每次轉 ${step}°,顏色卻是<strong>兩個一組</strong>才換。第 5 格是?`,
    `<strong>角度</strong>每格 +${step}°:${items.slice(0,4).map(c=>c.rotation+'°').join('→')}→<strong>${correct.rotation}°</strong>。<strong>顏色</strong>兩兩一組:${COLOR_ZH[c1]}${COLOR_ZH[c1]}→${COLOR_ZH[c2]}${COLOR_ZH[c2]}→<strong>${COLOR_ZH[c3]}${COLOR_ZH[c3]}</strong>。合起來:<strong>${describe(correct)}</strong>。`
  );
}

// grouped-pattern: 兩兩一組同色,組內形狀不同
// e.g. (粉圓 粉方) (綠三角 綠菱形) (黃星 ?)
function genGroupedPattern(id, seed) {
  const rng = makeRng(seed);
  const shapes = rngShuffle(rng, SHAPES).slice(0, 6);
  const colors = rngShuffle(rng, COLORS).slice(0, 3);
  // 6 格:(s0,s1) 都 c0, (s2,s3) 都 c1, (s4, ?) 都 c2
  const items = [
    { shape: shapes[0], color: colors[0] },
    { shape: shapes[1], color: colors[0] },
    { shape: shapes[2], color: colors[1] },
    { shape: shapes[3], color: colors[1] },
    { shape: shapes[4], color: colors[2] },
    { unknown: true }
  ];
  const correct = { shape: shapes[5], color: colors[2] };

  // 干擾:
  //  D1 (規則內錯位): 拿第 1 格 (上一組的 cell) → 跟 correct 自然差 2 attr (shape + color)
  //  D2 (部分對):     對的色 + 已經用過的 shape (組內違規)
  //  D3 (跳出規則):   已用過的 shape + 新的色 (= 第 4 組,規則沒講過會出現第 4 組)
  //
  // BUG FIX (v2 per reviewer PR #5 comment): 原本 D3 用 sh6 = SHAPES.find(s => !shapes.includes(s)),
  // 但 shapes 已經用滿 SHAPES 全部 6 個 → find 回 undefined → text 變 "粉紅undefined",
  // 6 題 grouped-pattern 全爆。改用 shapes[0] 配 co4(已用 shape + 新色,語義上等於「冒出第 4 組」),
  // 同樣具有「跳出規則」的誤解類型功能。
  const co4 = COLORS.find(c => !colors.includes(c));
  const D1 = { shape: shapes[0], color: colors[0] };       // 第 1 格 — 距 correct 2 attr
  const D2 = { shape: shapes[4], color: colors[2] };       // 顏色對但 shape 重複 (組內違規)
  const D3 = { shape: shapes[0], color: co4 };             // 第 4 組(色新,shape 重複舊組)
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'grouped-pattern', 'sequence-grouped', '分組模式辨識',
    items, options, answerIdx,
    `兩兩分組看:(第1,2格同色)(第3,4格同色)(第5,6格也應該同色)。組內形狀都不同。第 6 格是?`,
    `<strong>分組看</strong>:1-2 都是 ${COLOR_ZH[colors[0]]} (但形狀不同),3-4 都是 ${COLOR_ZH[colors[1]]} (但形狀不同),5-6 應該都是 <strong>${COLOR_ZH[colors[2]]}</strong> 但形狀不同。第 5 已經是 ${describe(items[4])},第 6 必須是 <strong>${COLOR_ZH[colors[2]]}</strong> 但<strong>不是 ${SHAPE_ZH[shapes[4]]}</strong>:<strong>${describe(correct)}</strong>。`
  );
}

// complex-rotation: 箭頭轉 + 顏色每格也輪換
function genComplexRotation(id, seed) {
  const rng = makeRng(seed);
  const step = 45;
  const startRot = rngShuffle(rng, [0, 45, 90])[0];
  const [c1, c2, c3] = rngShuffle(rng, COLORS).slice(0, 3);
  // 4 visible: rotation +45° 每格;color 循環 c1,c2,c3,c1
  const colorAt = [c1, c2, c3, c1];
  const items = [];
  for (let i = 0; i < 4; i++) {
    items.push({ shape: 'arrow', rotation: (startRot + step * i) % 360, color: colorAt[i] });
  }
  items.push({ unknown: true });
  // i=4: rotation startRot+180, color cycle 走到 c2
  const correct = { shape: 'arrow', rotation: (startRot + step * 4) % 360, color: c2 };

  // 干擾 (I-RAVEN 約束):
  //  D1: 旋轉對 + 顏色錯 (用 c1) → 1 attr 不同;為了 ≥ 2 attr,把 rotation 也偏 → 倒退 + 錯色 → 2 attr
  //  D2: 對的色 + 倒退一格 (錯角度)
  //  D3: 對的角度 + 新色 (沒在 cycle 內)
  const otherC = COLORS.find(c => ![c1, c2, c3].includes(c));
  const D1 = { shape: 'arrow', rotation: (startRot + step * 3) % 360, color: c1 };  // 2 attr 不同
  const D2 = { shape: 'arrow', rotation: (startRot + step * 3) % 360, color: c2 };  // 1 attr
  const D3 = { shape: 'arrow', rotation: correct.rotation, color: otherC };          // 1 attr
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'complex-rotation', 'sequence-rotation', '複合旋轉(轉+變色)',
    items, options, answerIdx,
    `箭頭每格 +${step}°,顏色 ${COLOR_ZH[c1]}→${COLOR_ZH[c2]}→${COLOR_ZH[c3]} 三輪。下一格是?`,
    `<strong>角度</strong>每格 +${step}°:${items.slice(0,4).map(c=>c.rotation+'°').join('→')}→<strong>${correct.rotation}°</strong>。<strong>顏色</strong>三循環:${COLOR_ZH[c1]}→${COLOR_ZH[c2]}→${COLOR_ZH[c3]}→${COLOR_ZH[c1]}→<strong>${COLOR_ZH[c2]}</strong>。合起來:<strong>${describe(correct)}</strong>。`
  );
}

// ─── 配置與執行 ────────────────────────────────────────────────────────

const RUNS = [
  // [diff, gen function, count, seed-base]
  ['easy', genCyclicAB,            10, 100],
  ['easy', genCyclicABC,           10, 200],
  ['easy', genRotation,            10, 300],
  ['mid',  genAccumulative,        10, 400],
  ['mid',  genDualAttributeCycle,  10, 500],
  ['mid',  genNestedElements,       5, 600],
  ['hard', genAsyncVariation,       8, 700],
  ['hard', genGroupedPattern,       6, 800],
  ['hard', genComplexRotation,      6, 900]
];

const startCounter = { easy: 3, mid: 3, hard: 3 };
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  for (const [diff, fn, count, baseSeed] of RUNS) {
    for (let k = 0; k < count; k++) {
      const idNum = startCounter[diff]++;
      const id = `sequence-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = fn(id, baseSeed + k);
      buckets[diff].push(q);
    }
  }

  let failed = 0;
  for (const diff of ['easy', 'mid', 'hard']) {
    for (const q of buckets[diff]) {
      const res = validateQuestion(q);
      if (!res.valid) {
        console.error(`❌ ${q.id}: ${res.errors.join('; ')}`);
        failed += 1;
      }
      if (res.warnings && res.warnings.length) {
        console.warn(`! ${q.id}: ${res.warnings.join('; ')}`);
      }
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-sequence] ${failed} failed validation. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.easy) await writeQuestion(`questions/sequence/easy/${q.id}.json`, q);
  for (const q of buckets.mid)  await writeQuestion(`questions/sequence/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/sequence/hard/${q.id}.json`, q);

  console.log(`[gen-sequence] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
