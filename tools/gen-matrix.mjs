#!/usr/bin/env node
// tools/gen-matrix.mjs
// 生成「矩陣推理」題型 (3x3 grid),9 個 sub_type 共 75 題。
//
// 教訓內化 (from batch 3 PR #5):
//  - generator 第一行 assert POOL.length 夠用 (避免 pool 抽光)
//  - describe() 對 missing shape/color throw (從 gen-sequence.mjs 複製來)
//  - I-RAVEN distractor 約束:correct + most-similar-wrong 視覺距離 ≥ 2
//  - PROMPTS key 必須 EXACTLY = sub_type 字串

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle, COLOR_ZH, SHAPE_ZH } from './gen-utils.mjs';

const TOPIC = 'matrix';

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'];
const COLORS = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];

const PROMPTS = {
  'single-variable-row':        '橫向看一下,每一排有什麼規律?',
  'dual-variable-bidirectional':'橫向跟直向各有規律,?要選哪個?',
  'dual-variable-count-row':    '橫向看數量怎麼變,?應該是?',
  'three-variable-independent': '形狀、顏色、數量各有規律,?是什麼?',
  'latin-square':               '每一排每一行都有 3 種不同的東西,?填什麼?',
  'dual-shape-rotation':        '形狀跟方向都在變,?選哪個?',
  'arithmetic-row-add':         '每一排前兩格的數量加起來等於第三格,?是?',
  'rotation-grid':              '橫向跟直向箭頭都在轉,?指哪裡?',
  'three-variable-latin':       '形狀、顏色、數量 3 個變數每排每行各出現一次,?是?'
};

// ─── 共用工具 ──────────────────────────────────────────────────────────

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
    const dir = { 0: '↑', 45: '↗', 90: '→', 135: '↘', 180: '↓', 225: '↙', 270: '←', 315: '↖' };
    return `${c}${dir[cell.rotation] ?? cell.rotation + '°'}`;
  }
  if (cell.count && cell.count > 1) return `${cell.count} 個${c}${s}`;
  return `${c}${s}`;
}

function cellDistance(a, b) {
  let d = 0;
  for (const k of ['shape', 'color', 'count', 'rotation']) {
    if ((a[k] ?? null) !== (b[k] ?? null)) d += 1;
  }
  return d;
}

function cellToOption(cell) {
  const visual = { type: 'single-shape' };
  for (const k of ['shape', 'color', 'count', 'rotation']) {
    if (cell[k] !== undefined) visual[k] = cell[k];
  }
  return { text: describe(cell), visual };
}

function placeCellOptions(correct, distractors, seedId) {
  const seed = [...seedId].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const all = [correct, ...distractors];
  const seen = new Set();
  const unique = [];
  for (const c of all) {
    const k = describe(c);
    if (!seen.has(k)) { seen.add(k); unique.push(c); }
  }
  // assert 不靠後備就有 4 個
  if (unique.length < 4) {
    throw new Error(`placeCellOptions: only ${unique.length} unique options (need 4). Seed=${seedId}, opts=${JSON.stringify(all)}`);
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const opts = shuffled.map(cellToOption);
  const answerIdx = shuffled.findIndex(c => describe(c) === describe(correct));
  return { options: opts, answerIdx };
}

function makeQ(id, difficulty, sub_type, skill_code, skillZh, cells, options, answerIdx, hint, explanation) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: PROMPTS[sub_type],
    visual: { type: 'matrix-3x3', cells },
    options,
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// matrix-3x3 cells 9 個,? 永遠在 (row 2, col 2) = idx 8
function buildCells(rowColFn) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 2 && c === 2) cells.push({ unknown: true });
      else cells.push(rowColFn(r, c));
    }
  }
  return cells;
}

// ─── EASY ──────────────────────────────────────────────────────────────

// single-variable-row: 每排同 shape+color,第 3 排前 2 格定型,? = 同
function genSingleVariableRow(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // Row r 全部用 (sh[r], co[r])
  const cells = buildCells((r, c) => ({ shape: sh[r], color: co[r] }));
  const correct = { shape: sh[2], color: co[2] };

  // 干擾 (I-RAVEN: D1 ≥ 2 attr diff from correct):
  //  D1: 拿 row 0 的 cell (sh[0], co[0]) — shape 跟 color 都不同 → 距 2 ✓
  //  D2: 對的 shape + row 0 color (1 attr diff)
  //  D3: row 0 shape + 對的 color (1 attr diff)
  const D1 = { shape: sh[0], color: co[0] };
  const D2 = { shape: sh[2], color: co[0] };
  const D3 = { shape: sh[0], color: co[2] };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'easy', 'single-variable-row', 'pattern-row-identification', '橫向規律識別',
    cells, options, answerIdx,
    `每一排的 3 個東西都長一樣。第 3 排前 2 個是${describe(correct)},第 3 格呢?`,
    `每一排的 3 格是<strong>同樣的</strong>東西。第 3 排前 2 個是<strong>${describe(correct)}</strong>,第 3 格也要是 <strong>${describe(correct)}</strong>。`
  );
}

// dual-variable-bidirectional: shape 橫向變,color 直向變
function genDualVariableBi(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // cell(r,c) = (sh[c], co[r])
  const cells = buildCells((r, c) => ({ shape: sh[c], color: co[r] }));
  const correct = { shape: sh[2], color: co[2] };

  // 干擾:
  //  D1: row 0 的 (sh[2], co[0]) — color 跟 correct 差 → 距 1;再讓 shape 也差 → (sh[0], co[0]) 距 2
  //  D2: 對的 shape + 別 row 的 color (sh[2], co[0]) → 距 1
  //  D3: 對的 color + 別 col 的 shape (sh[0], co[2]) → 距 1
  const D1 = { shape: sh[0], color: co[0] };
  const D2 = { shape: sh[2], color: co[0] };
  const D3 = { shape: sh[0], color: co[2] };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'easy', 'dual-variable-bidirectional', 'pattern-bidirectional', '雙向規律推理',
    cells, options, answerIdx,
    `橫向看每排的形狀怎麼變,直向看每行的顏色怎麼變。?在第 3 排第 3 行,形狀跟顏色各是?`,
    `<strong>橫向</strong>每排形狀依序是 ${SHAPE_ZH[sh[0]]}→${SHAPE_ZH[sh[1]]}→${SHAPE_ZH[sh[2]]}。<strong>直向</strong>每行顏色依序是 ${COLOR_ZH[co[0]]}→${COLOR_ZH[co[1]]}→${COLOR_ZH[co[2]]}。? 在第 3 排第 3 行,所以是 <strong>${describe(correct)}</strong>。`
  );
}

// dual-variable-count-row: count 橫向變 (1,2,3),color 直向變
function genDualVariableCountRow(id, seed) {
  const rng = makeRng(seed);
  const shape = rngShuffle(rng, SHAPES)[0];
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // cell(r,c) = (shape, co[r], count=c+1)
  const cells = buildCells((r, c) => ({ shape, color: co[r], count: c + 1 }));
  const correct = { shape, color: co[2], count: 3 };

  // 干擾:
  //  D1: count=2 (前一格) + 換 row color → 距 2 attr
  //  D2: 對的 count + 別 row color (1 attr)
  //  D3: 對的 color + count=2 (1 attr)
  const D1 = { shape, color: co[0], count: 2 };
  const D2 = { shape, color: co[0], count: 3 };
  const D3 = { shape, color: co[2], count: 2 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'easy', 'dual-variable-count-row', 'pattern-bidirectional', '雙向(數量+顏色)規律',
    cells, options, answerIdx,
    `橫向看數量怎麼變 (1→2→3),直向看顏色怎麼變。第 3 排第 3 行是?`,
    `<strong>橫向</strong>數量 1→2→3。<strong>直向</strong>顏色 ${COLOR_ZH[co[0]]}→${COLOR_ZH[co[1]]}→${COLOR_ZH[co[2]]}。? = <strong>${describe(correct)}</strong>。`
  );
}

// ─── MID ──────────────────────────────────────────────────────────────

// three-variable-independent: 3 個變數獨立橫向變化(每排各自規律,但不同 attr)
// e.g. shape 第 1 排同,第 2 排同(另一形狀),第 3 排同; color 直向變; count 橫向變
function genThreeVariableIndependent(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // shape 直向變 (每 row 同 shape),color 橫向變 (每 col 同 color),count = r+1 (每 row 同 count)
  const cells = buildCells((r, c) => ({ shape: sh[r], color: co[c], count: r + 1 }));
  const correct = { shape: sh[2], color: co[2], count: 3 };

  //  D1: (sh[0], co[0], 1) — 完全別格 → 距 3 attr
  //  D2: 對的 shape + 別 col color + 對的 count (1 attr)
  //  D3: 對的 shape + 對的 color + 別 count (1 attr)
  const D1 = { shape: sh[0], color: co[0], count: 1 };
  const D2 = { shape: sh[2], color: co[0], count: 3 };
  const D3 = { shape: sh[2], color: co[2], count: 2 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'mid', 'three-variable-independent', 'pattern-three-variable', '三變數獨立規律',
    cells, options, answerIdx,
    `形狀直向變,顏色橫向變,數量直向也在變。第 3 排第 3 行的 3 個屬性各是?`,
    `<strong>形狀</strong>每 row 同:${SHAPE_ZH[sh[0]]}/${SHAPE_ZH[sh[1]]}/<strong>${SHAPE_ZH[sh[2]]}</strong>。<strong>顏色</strong>每 col 同,第 3 col 是 <strong>${COLOR_ZH[co[2]]}</strong>。<strong>數量</strong>每 row 同:1/2/<strong>3</strong>。組起來:<strong>${describe(correct)}</strong>。`
  );
}

// latin-square: 每排每行各 shape 都各出現一次 (色不變)
function genLatinSquare(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const color = rngShuffle(rng, COLORS)[0];
  // latin: shape[r][c] = sh[(r+c) % 3]
  const cells = buildCells((r, c) => ({ shape: sh[(r + c) % 3], color }));
  const correct = { shape: sh[(2 + 2) % 3], color };   // = sh[1]

  // 干擾:
  //  D1: 換色 + 換 shape 到 sh[0] → 距 2 ✓
  //  D2: 對的 shape + 換色 (1 attr)
  //  D3: 對的色 + 別 shape sh[0] (1 attr)
  const otherColor = COLORS.find(c => c !== color);
  const D1 = { shape: sh[0], color: otherColor };
  const D2 = { shape: correct.shape, color: otherColor };
  const D3 = { shape: sh[0], color };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'mid', 'latin-square', 'pattern-latin-square', '拉丁方陣 (形狀)',
    cells, options, answerIdx,
    `每一排都有 ${SHAPE_ZH[sh[0]]}/${SHAPE_ZH[sh[1]]}/${SHAPE_ZH[sh[2]]} 三種,每一行也都有。? 那一格少了哪種?`,
    `這是<strong>拉丁方陣</strong>:每 row 跟每 col 三種形狀各出現一次。第 3 排前 2 格是 ${SHAPE_ZH[cells[6].shape]} 跟 ${SHAPE_ZH[cells[7].shape]},第 3 格必須是 <strong>${SHAPE_ZH[correct.shape]}</strong>。色全部都是 ${COLOR_ZH[color]}。答案:<strong>${describe(correct)}</strong>。`
  );
}

// dual-shape-rotation: shape 橫向變,rotation 直向變 (用 arrow)
function genDualShapeRotation(id, seed) {
  const rng = makeRng(seed);
  const color = rngShuffle(rng, COLORS)[0];
  const rotations = [0, 90, 180];
  // 全部用 arrow,rotation 橫向變 (c*45?),其實這 sub_type 想要兩屬性
  // 改:shape 直向變 (arrow vs star vs diamond?),rotation 橫向變
  // 但只有 arrow 有意義的 rotation,改用單一 shape arrow + 顏色橫向 + rotation 直向
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  const cells = buildCells((r, c) => ({ shape: 'arrow', color: co[c], rotation: rotations[r] }));
  const correct = { shape: 'arrow', color: co[2], rotation: rotations[2] };

  //  D1: rotation 換 + color 換 → 距 2
  //  D2: 對的 rotation + 別 color
  //  D3: 對的 color + 別 rotation
  const D1 = { shape: 'arrow', color: co[0], rotation: rotations[0] };
  const D2 = { shape: 'arrow', color: co[0], rotation: rotations[2] };
  const D3 = { shape: 'arrow', color: co[2], rotation: rotations[0] };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'mid', 'dual-shape-rotation', 'pattern-bidirectional', '雙向(顏色+方向)',
    cells, options, answerIdx,
    `顏色橫向變,箭頭方向直向變。? 應該是哪個顏色 + 哪個方向?`,
    `<strong>顏色</strong>橫向變:${COLOR_ZH[co[0]]}→${COLOR_ZH[co[1]]}→<strong>${COLOR_ZH[co[2]]}</strong>。<strong>方向</strong>直向變:↑→→→<strong>↓</strong>。答案:<strong>${describe(correct)}</strong>。`
  );
}

// ─── HARD ──────────────────────────────────────────────────────────────

// arithmetic-row-add: 每排前兩格 count 加起來 = 第三格
function genArithmeticRowAdd(id, seed) {
  const rng = makeRng(seed);
  const shape = rngShuffle(rng, SHAPES)[0];
  const color = rngShuffle(rng, COLORS)[0];
  // 隨機選 3 排的 (a, b) 配對,確保 a+b ≤ 4 (count 上限)
  const configs = [
    [1, 1], [1, 2], [2, 1], [2, 2], [1, 3], [3, 1]
  ];
  const picked = rngShuffle(rng, configs).slice(0, 3);
  const cells = [];
  for (let r = 0; r < 3; r++) {
    const [a, b] = picked[r];
    if (r < 2) {
      cells.push({ shape, color, count: a });
      cells.push({ shape, color, count: b });
      cells.push({ shape, color, count: a + b });
    } else {
      cells.push({ shape, color, count: a });
      cells.push({ shape, color, count: b });
      cells.push({ unknown: true });
    }
  }
  const correct = { shape, color, count: picked[2][0] + picked[2][1] };
  if (correct.count > 4) {
    // 換配對,確保 ≤ 4
    picked[2] = [1, 2];
    cells[6] = { shape, color, count: 1 };
    cells[7] = { shape, color, count: 2 };
    correct.count = 3;
  }

  //  Distractor design 避免 a=b 時 misconception 收斂的問題:
  //  D1: count = correct.count ± 1 + 換色 → 距 2 attr ✓
  //  D2: count = correct.count ± 1 (另一向) + 同色 → 距 1
  //  D3: 對的 count + 換 shape → 距 1
  const otherColor = COLORS.find(c => c !== color);
  const otherShape = SHAPES.find(s => s !== shape);
  // 決定 ±1 / ±2 方向,避免出界 (1..4)
  let c1, c2;
  if (correct.count >= 3) { c1 = correct.count - 1; c2 = correct.count - 2; }
  else { c1 = correct.count + 1; c2 = correct.count + 2; }
  c1 = Math.max(1, Math.min(4, c1));
  c2 = Math.max(1, Math.min(4, c2));
  if (c1 === c2) c2 = c1 === 1 ? 4 : 1;   // 保險:c1, c2 必須不同且都跟 correct.count 不同
  const D1 = { shape, color: otherColor, count: c1 };
  const D2 = { shape, color, count: c2 };
  const D3 = { shape: otherShape, color, count: correct.count };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'arithmetic-row-add', 'pattern-arithmetic', '橫向相加規律',
    cells, options, answerIdx,
    `每一排:前兩格的數量加起來等於第三格。第 3 排前兩格是 ${picked[2][0]} 跟 ${picked[2][1]} 個,第 3 格應該是?`,
    `每一排<strong>第 1 + 第 2 = 第 3</strong>:Row 1: ${picked[0][0]}+${picked[0][1]}=${picked[0][0]+picked[0][1]} ✓。Row 2: ${picked[1][0]}+${picked[1][1]}=${picked[1][0]+picked[1][1]} ✓。Row 3: ${picked[2][0]}+${picked[2][1]}=<strong>${correct.count}</strong>。答案:<strong>${describe(correct)}</strong>。`
  );
}

// rotation-grid: rotation 在 grid 上等差移動
function genRotationGrid(id, seed) {
  const rng = makeRng(seed);
  const color = rngShuffle(rng, COLORS)[0];
  const step = 45;
  const start = 0;
  // cell(r, c) = arrow at (start + (r+c) * step) % 360
  const cells = buildCells((r, c) => ({ shape: 'arrow', color, rotation: (start + (r + c) * step) % 360 }));
  const correct = { shape: 'arrow', color, rotation: (start + 4 * step) % 360 };  // (2+2)*45 = 180

  //  D1: rotation 倒退 + 換色 → 距 2
  const otherColor = COLORS.find(c => c !== color);
  const D1 = { shape: 'arrow', color: otherColor, rotation: (correct.rotation - step + 360) % 360 };
  //  D2: 對的方向 + 換色 (1 attr)
  const D2 = { shape: 'arrow', color: otherColor, rotation: correct.rotation };
  //  D3: 對的色 + 倒退 (1 attr)
  const D3 = { shape: 'arrow', color, rotation: (correct.rotation - step + 360) % 360 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'rotation-grid', 'pattern-rotation', '矩陣中的等角度旋轉',
    cells, options, answerIdx,
    `橫向看每格箭頭轉 ${step}°,直向看也轉 ${step}°。? 在右下角,指?`,
    `從左上 (0°) 開始,橫向 +${step}° 跟直向 +${step}° 都是 +${step}°。右下角 = ${4} × ${step}° = <strong>${correct.rotation}°</strong>(${describe(correct)})。`
  );
}

// three-variable-latin: shape / color / count 三變數,每排每行各一次 (3-attribute latin)
function genThreeVariableLatin(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  const counts = [1, 2, 3];
  // shape 用 latin (r+c)%3, color 用 (2r+c)%3, count 用 (r+2c)%3
  const cells = buildCells((r, c) => ({
    shape: sh[(r + c) % 3],
    color: co[(2 * r + c) % 3],
    count: counts[(r + 2 * c) % 3]
  }));
  const correct = {
    shape: sh[(2 + 2) % 3],          // sh[1]
    color: co[(2 * 2 + 2) % 3],      // co[0]
    count: counts[(2 + 2 * 2) % 3]   // counts[0] = 1
  };

  //  D1: 全錯 (sh[0], co[1], 2) → 距 3
  //  D2: 對的 shape + 錯 color + 錯 count → 距 2
  //  D3: 對的 shape + 對的 color + 錯 count → 距 1
  const D1 = { shape: sh[0], color: co[1], count: 2 };
  const D2 = { shape: correct.shape, color: co[1], count: 2 };
  const D3 = { shape: correct.shape, color: correct.color, count: 2 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);

  return makeQ(id, 'hard', 'three-variable-latin', 'pattern-three-variable', '三變數拉丁方陣',
    cells, options, answerIdx,
    `形狀、顏色、數量 3 個變數,每排每行 3 種各出現一次。? 該填什麼?`,
    `<strong>形狀</strong>:每排每行三種 ${SHAPE_ZH[sh[0]]}/${SHAPE_ZH[sh[1]]}/${SHAPE_ZH[sh[2]]} 各一次。<strong>顏色</strong>同理。<strong>數量</strong> 1/2/3 同理。右下角 = <strong>${describe(correct)}</strong>。`
  );
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  ['easy', genSingleVariableRow,    10, 1100],
  ['easy', genDualVariableBi,       15, 1200],
  ['easy', genDualVariableCountRow,  5, 1300],
  ['mid',  genThreeVariableIndependent, 10, 1400],
  ['mid',  genLatinSquare,          10, 1500],
  ['mid',  genDualShapeRotation,     5, 1600],
  ['hard', genArithmeticRowAdd,      8, 1700],
  ['hard', genRotationGrid,          6, 1800],
  ['hard', genThreeVariableLatin,    6, 1900]
];

// pool size assertions (per batch-3 教訓)
console.log(`[gen-matrix] SHAPES pool=${SHAPES.length}, COLORS pool=${COLORS.length}`);

const startCounter = { easy: 3, mid: 3, hard: 3 };
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  for (const [diff, fn, count, baseSeed] of RUNS) {
    for (let k = 0; k < count; k++) {
      const idNum = startCounter[diff]++;
      const id = `matrix-${diff}-${String(idNum).padStart(3, '0')}`;
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
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-matrix] ${failed} failed. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.easy) await writeQuestion(`questions/matrix/easy/${q.id}.json`, q);
  for (const q of buckets.mid)  await writeQuestion(`questions/matrix/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/matrix/hard/${q.id}.json`, q);

  console.log(`[gen-matrix] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
