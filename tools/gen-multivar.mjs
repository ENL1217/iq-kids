#!/usr/bin/env node
// tools/gen-multivar.mjs
// 「多元素變化矩陣」題型,7 個 sub_type 共 55 題。
// 內化 batch 3-4 教訓:describe guard / assertion / sub_type-key PROMPTS / I-RAVEN distance ≥ 2

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle, COLOR_ZH, SHAPE_ZH } from './gen-utils.mjs';

const TOPIC = 'multivar';

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'];
const COLORS = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];

const PROMPTS = {
  '2var-shape-color':         '橫向看一個變數,直向看另一個。? 應該是?',
  '2var-count-color':         '橫向看顏色,直向看數量。? 是?',
  '3var-independent':         '形狀、顏色、數量 3 個變數一起變,? 是?',
  'latin-square-3var':        '每排每行 3 種形狀各出現一次,? 該填什麼?',
  '4var':                     '形狀、顏色、數量、方向 4 個都在變,? 是?',
  'position-swap':            '看每排的位置怎麼輪轉,? 應該是哪一個?',
  'attribute-inheritance':    '前兩格的特徵組合到第三格,? 是?'
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
  if (unique.length < 4) {
    throw new Error(`placeCellOptions: ${unique.length} unique opts. Seed=${seedId}, opts=${JSON.stringify(all)}`);
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const opts = shuffled.map(cellToOption);
  const answerIdx = shuffled.findIndex(c => describe(c) === describe(correct));
  return { options: opts, answerIdx };
}

function makeQ(id, difficulty, sub_type, skill_code, skillZh, visualType, cells, options, answerIdx, hint, explanation) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: PROMPTS[sub_type],
    visual: { type: visualType, cells },
    options,
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// matrix-2x2 cells 4 個,? 在 idx 3 (右下)
function build2x2(rowColFn) {
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      if (r === 1 && c === 1) cells.push({ unknown: true });
      else cells.push(rowColFn(r, c));
    }
  }
  return cells;
}

// matrix-3x3
function build3x3(rowColFn) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 2 && c === 2) cells.push({ unknown: true });
      else cells.push(rowColFn(r, c));
    }
  }
  return cells;
}

// ─── EASY (20) ────────────────────────────────────────────────────────

// 2var-shape-color: 2x2,shape 橫變,color 直變
function gen2VarShapeColor(id, seed) {
  const rng = makeRng(seed);
  const [s0, s1] = rngShuffle(rng, SHAPES).slice(0, 2);
  const [c0, c1] = rngShuffle(rng, COLORS).slice(0, 2);
  const cells = build2x2((r, c) => ({ shape: [s0, s1][c], color: [c0, c1][r] }));
  const correct = { shape: s1, color: c1 };
  // D1: (s0,c0) 距 2 ✓
  // D2: 對 shape + 別 color
  // D3: 對 color + 別 shape
  const D1 = { shape: s0, color: c0 };
  const D2 = { shape: s1, color: c0 };
  const D3 = { shape: s0, color: c1 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'easy', '2var-shape-color', 'multivar-2var', '雙變數獨立 (形+色)',
    'matrix-2x2', cells, options, answerIdx,
    `橫向變形狀 (${SHAPE_ZH[s0]}→${SHAPE_ZH[s1]}),直向變顏色 (${COLOR_ZH[c0]}→${COLOR_ZH[c1]})。? 是?`,
    `橫向:${SHAPE_ZH[s0]}→${SHAPE_ZH[s1]}。直向:${COLOR_ZH[c0]}→${COLOR_ZH[c1]}。右下角 = <strong>${describe(correct)}</strong>。`
  );
}

// 2var-count-color: 2x2,count 橫變 (1→2),color 直變
function gen2VarCountColor(id, seed) {
  const rng = makeRng(seed);
  const shape = rngShuffle(rng, SHAPES)[0];
  const [c0, c1] = rngShuffle(rng, COLORS).slice(0, 2);
  const cells = build2x2((r, c) => ({ shape, color: [c0, c1][r], count: c + 1 }));
  const correct = { shape, color: c1, count: 2 };
  const otherShape = SHAPES.find(s => s !== shape);
  // D1: 數量錯 + 顏色錯 → 距 2
  // D2: 對 count + 別 color
  // D3: 對 color + 別 count
  const D1 = { shape, color: c0, count: 1 };
  const D2 = { shape, color: c0, count: 2 };
  const D3 = { shape, color: c1, count: 1 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'easy', '2var-count-color', 'multivar-2var', '雙變數獨立 (數+色)',
    'matrix-2x2', cells, options, answerIdx,
    `橫向數量 1→2,直向顏色 ${COLOR_ZH[c0]}→${COLOR_ZH[c1]}。? 是?`,
    `橫向 +1 個,直向換色。右下角 = <strong>${describe(correct)}</strong>。`
  );
}

// ─── MID (20) ─────────────────────────────────────────────────────────

// 3var-independent: 3x3,shape (row 變),color (col 變),count (diag)
function gen3VarIndependent(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // shape 橫向變 (每 col 不同),color 直向變 (每 row 不同),count 每 row 同
  const cells = build3x3((r, c) => ({ shape: sh[c], color: co[r], count: r + 1 }));
  const correct = { shape: sh[2], color: co[2], count: 3 };

  const D1 = { shape: sh[0], color: co[0], count: 1 };   // 距 3
  const D2 = { shape: sh[2], color: co[0], count: 3 };   // 距 1
  const D3 = { shape: sh[0], color: co[2], count: 3 };   // 距 1
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'mid', '3var-independent', 'multivar-3var', '三變數獨立',
    'matrix-3x3', cells, options, answerIdx,
    `形狀橫向變,顏色直向變,數量每排 +1。? 是?`,
    `形狀:${SHAPE_ZH[sh[0]]}→${SHAPE_ZH[sh[1]]}→${SHAPE_ZH[sh[2]]}。顏色:${COLOR_ZH[co[0]]}→${COLOR_ZH[co[1]]}→${COLOR_ZH[co[2]]}。數量 1→2→3。右下角 = <strong>${describe(correct)}</strong>。`
  );
}

// latin-square-3var: 3 種 shape 在 3x3 中每排每行各出現一次
function genLatinSquare3Var(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  // shape 用 (r+c)%3, color 用 (2r+c)%3
  const cells = build3x3((r, c) => ({ shape: sh[(r + c) % 3], color: co[(2 * r + c) % 3] }));
  const correct = { shape: sh[(2 + 2) % 3], color: co[(2 * 2 + 2) % 3] };  // sh[1], co[0]

  const D1 = { shape: sh[0], color: co[1] };
  const D2 = { shape: correct.shape, color: co[1] };
  const D3 = { shape: sh[0], color: correct.color };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'mid', 'latin-square-3var', 'multivar-latin', '拉丁方陣 (3 形+3 色)',
    'matrix-3x3', cells, options, answerIdx,
    `每排每行 3 種形狀各 1 次,3 種顏色也各 1 次。? 填?`,
    `這是雙拉丁方陣。形狀缺 <strong>${SHAPE_ZH[correct.shape]}</strong>,顏色缺 <strong>${COLOR_ZH[correct.color]}</strong>。答案 <strong>${describe(correct)}</strong>。`
  );
}

// ─── HARD (15) ────────────────────────────────────────────────────────

// 4var: shape, color, count, rotation (用 arrow + 旋轉)
// 但 multivar 用一般 shape,4 個變數會超出 cell schema 範圍
// 改用 shape, color, count + 「邊框 vs 實心」用 rotation 等?
// 實際:用 shape, color, count + size (透過 count 模擬大小)... 不容易
// 退一步:shape, color, count + 「+/-」(用第 2 個 shape 表示) 也難
// 改用 arrow + rotation 當 4 個 attr:shape=arrow 固定, color/count/rotation 變動 (3 attr) + 加 dots(?)
// 退而求其次:四個變數但只變 3 個,記載為 multivar-4var 的近似
function gen4Var(id, seed) {
  const rng = makeRng(seed);
  // 用 arrow + color + count + rotation 四個變數
  const co = rngShuffle(rng, COLORS).slice(0, 3);
  const rots = [0, 90, 180];
  // shape 永遠 arrow; color 橫變; count 直變 (但 arrow 不適合 count > 1,改用 shape 變)
  // 重新設計:shape 橫變 (3 種),color 直變,count 對角線,rotation 反對角線?
  // 太複雜。簡化:shape (橫) + color (直) + count (對角) — 跟 3var 一樣 + count
  const sh = rngShuffle(rng, SHAPES.filter(s => s !== 'arrow' && s !== 'dots')).slice(0, 3);
  const cells = build3x3((r, c) => ({ shape: sh[c], color: co[r], count: ((r + c) % 3) + 1 }));
  const correct = { shape: sh[2], color: co[2], count: ((2 + 2) % 3) + 1 };  // count = 2

  const D1 = { shape: sh[0], color: co[0], count: 1 };
  const D2 = { shape: sh[2], color: co[0], count: 2 };
  const D3 = { shape: sh[0], color: co[2], count: 3 };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'hard', '4var', 'multivar-4var', '四變數規律',
    'matrix-3x3', cells, options, answerIdx,
    `橫變形狀,直變顏色,數量隨對角線變化。? 是?`,
    `形狀 ${SHAPE_ZH[sh[0]]}→${SHAPE_ZH[sh[1]]}→${SHAPE_ZH[sh[2]]} (橫)。顏色 ${COLOR_ZH[co[0]]}→${COLOR_ZH[co[1]]}→${COLOR_ZH[co[2]]} (直)。數量隨對角線 (r+c) % 3 + 1。右下 r=2 c=2: count=2。答案 <strong>${describe(correct)}</strong>。`
  );
}

// position-swap: 每排 cells 的位置依規則輪轉
function genPositionSwap(id, seed) {
  const rng = makeRng(seed);
  const sh = rngShuffle(rng, SHAPES).slice(0, 3);
  const color = rngShuffle(rng, COLORS)[0];
  // Row 0: A B C
  // Row 1: C A B  (right rotate by 1)
  // Row 2: B C ?  (right rotate by 1 from row 1 → B C A)
  // 即 cell(r, c) = sh[(c - r + 3) % 3]
  const cells = build3x3((r, c) => ({ shape: sh[(c - r + 3) % 3], color }));
  const correct = { shape: sh[(2 - 2 + 3) % 3], color };  // sh[0]

  const otherColor = COLORS.find(c => c !== color);
  // D1: 別位置 + 換色 → 距 2
  // D2: 別位置 (預期左/右一個 → sh[2]) 同色 → 距 1
  // D3: 對的位置 + 換色 → 距 1
  const D1 = { shape: sh[1], color: otherColor };
  const D2 = { shape: sh[2], color };
  const D3 = { shape: correct.shape, color: otherColor };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'hard', 'position-swap', 'multivar-position-swap', '位置輪轉',
    'matrix-3x3', cells, options, answerIdx,
    `每一排是上一排向右輪轉 1 格。Row 2 是 ${SHAPE_ZH[sh[1]]}/${SHAPE_ZH[sh[2]]}/?,? 應該是?`,
    `位置每排右輪轉一格:Row 0: ${SHAPE_ZH[sh[0]]}/${SHAPE_ZH[sh[1]]}/${SHAPE_ZH[sh[2]]} → Row 1: ${SHAPE_ZH[sh[2]]}/${SHAPE_ZH[sh[0]]}/${SHAPE_ZH[sh[1]]} → Row 2: ${SHAPE_ZH[sh[1]]}/${SHAPE_ZH[sh[2]]}/<strong>${SHAPE_ZH[correct.shape]}</strong>。答案 <strong>${describe(correct)}</strong>。`
  );
}

// attribute-inheritance: 每排 cell3 = cell1 shape + cell2 color
function genAttributeInheritance(id, seed) {
  const rng = makeRng(seed);
  const baseColor = 'white';
  const baseShape = 'circle';
  // sh / co 都要排除 base,不然 correct 跟 D3/D2 會撞
  const sh = rngShuffle(rng, SHAPES.filter(s => s !== baseShape)).slice(0, 3);
  const co = rngShuffle(rng, COLORS.filter(c => c !== baseColor)).slice(0, 3);
  // Row r: cell(r,0) = (sh[r], baseColor); cell(r,1) = (baseShape, co[r]); cell(r,2) = (sh[r], co[r])
  // ? at (2,2)
  const cells = build3x3((r, c) => {
    if (c === 0) return { shape: sh[r], color: baseColor };
    if (c === 1) return { shape: baseShape, color: co[r] };
    return { shape: sh[r], color: co[r] };   // c === 2
  });
  const correct = { shape: sh[2], color: co[2] };

  // D1: 別 shape + 別 color → 距 2 ✓
  // D2: 對 shape + 別 color (用 baseColor 白) → 距 1
  // D3: 對 color + baseShape (圓) → 距 1
  const D1 = { shape: sh[0], color: co[0] };
  const D2 = { shape: correct.shape, color: baseColor };
  const D3 = { shape: baseShape, color: correct.color };
  const { options, answerIdx } = placeCellOptions(correct, [D1, D2, D3], id);
  return makeQ(id, 'hard', 'attribute-inheritance', 'multivar-attribute-inheritance', '屬性繼承',
    'matrix-3x3', cells, options, answerIdx,
    `每排第 3 格繼承前兩格的特徵 (第 1 格的形狀 + 第 2 格的顏色)。? 是?`,
    `Row 2 第 1 格 shape = ${SHAPE_ZH[sh[2]]},第 2 格 color = ${COLOR_ZH[co[2]]}。組合 = <strong>${describe(correct)}</strong>。`
  );
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  ['easy', gen2VarShapeColor,       10, 2100],
  ['easy', gen2VarCountColor,       10, 2200],
  ['mid',  gen3VarIndependent,      10, 2300],
  ['mid',  genLatinSquare3Var,      10, 2400],
  ['hard', gen4Var,                  5, 2500],
  ['hard', genPositionSwap,          5, 2600],
  ['hard', genAttributeInheritance,  5, 2700]
];

const startCounter = { easy: 3, mid: 3, hard: 3 };
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  for (const [diff, fn, count, baseSeed] of RUNS) {
    for (let k = 0; k < count; k++) {
      const idNum = startCounter[diff]++;
      const id = `multivar-${diff}-${String(idNum).padStart(3, '0')}`;
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
    console.error(`\n[gen-multivar] ${failed} failed. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.easy) await writeQuestion(`questions/multivar/easy/${q.id}.json`, q);
  for (const q of buckets.mid)  await writeQuestion(`questions/multivar/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/multivar/hard/${q.id}.json`, q);

  console.log(`[gen-multivar] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
