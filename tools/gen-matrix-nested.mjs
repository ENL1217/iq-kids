#!/usr/bin/env node
// tools/gen-matrix-nested.mjs
// Batch +1000 — 巢狀位置追蹤
// 3 個 sub_type 共 65 題:
//   direct-position-mapping   easy 20   小 grid 內黑塊位置 = 大 cell 在 3x3 的 row-major 索引
//   inverted-mapping          mid  30   小 grid 內位置 = 8 - 大 cell 索引 (180° 旋轉)
//   row-col-swap              hard 15   大 cell (r,c) → 小 grid (c,r) (轉置)
//
// 用戶授權的 signature 唯一空間擴充(Q2):
//   (1) 變化 unknown 位置 9 種 ×
//   (2) black_cell_size normal/large 2 段 ×
//   (3) 邊框色 5 色 = 90 種變體 (其中 direct-easy 只取 20、mid 取 30、hard 取 15)

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'matrix';
const SKILL_CODE = 'pattern-position-mapping';

const PROMPTS = {
  'direct-position-mapping':  '每個大格裡的黑塊位置,跟它在大 3×3 的位置一樣。? 裡黑塊在哪?',
  'inverted-mapping':         '黑塊位置跟大格位置左右上下對稱。? 裡黑塊在哪?',
  'row-col-swap':             '大格的橫直位置交換 = 小 grid 的位置。? 裡黑塊在哪?'
};

const SKILLS_ZH = {
  'direct-position-mapping': '位置直接對應',
  'inverted-mapping':        '位置反向對應',
  'row-col-swap':            '行列交換對應'
};

// ─── mapping rules ─────────────────────────────────────────────────────

const MAPPINGS = {
  'direct-position-mapping': (r, c) => r * 3 + c,
  'inverted-mapping':         (r, c) => 8 - (r * 3 + c),
  'row-col-swap':             (r, c) => c * 3 + r
};

// ─── visual helpers ────────────────────────────────────────────────────

function buildCell(filledIdx, opts) {
  return {
    type: 'nested-grid',
    filled_cells: [filledIdx],
    black_cell_size: opts.size,
    ...(opts.fill_shape ? { fill_shape: opts.fill_shape } : {}),
    ...(opts.fill_color ? { fill_color: opts.fill_color } : {}),
    ...(opts.border_color ? { border_color: opts.border_color } : {})
  };
}

function cellDesc(c) {
  if (c.unknown) return '?';
  const pos = c.filled_cells[0];
  const row = Math.floor(pos / 3), col = pos % 3;
  const labels = ['左上', '上中', '右上', '中左', '中', '中右', '左下', '下中', '右下'];
  return labels[pos] || `pos${pos}`;
}

function cellToOpt(c) {
  return {
    text: cellDesc(c),
    visual: {
      type: 'nested-grid',
      filled_cells: c.filled_cells.slice(),
      black_cell_size: c.black_cell_size,
      ...(c.fill_shape ? { fill_shape: c.fill_shape } : {}),
      ...(c.fill_color ? { fill_color: c.fill_color } : {}),
      ...(c.border_color ? { border_color: c.border_color } : {})
    }
  };
}

function uniqKeyCell(c) {
  return `n-${c.filled_cells.join(',')}-${c.black_cell_size || 'n'}-${c.fill_shape || 's'}-${c.border_color || 'i'}`;
}

// 把 pos (0-8) 視為 (r, c),做鏡射/轉動;回傳新 pos
function mirrorH(p) { const r = Math.floor(p / 3), c = p % 3; return r * 3 + (2 - c); }
function mirrorV(p) { const r = Math.floor(p / 3), c = p % 3; return (2 - r) * 3 + c; }
function rotate90(p) { const r = Math.floor(p / 3), c = p % 3; return c * 3 + (2 - r); }
function adjacent(p, dir) {
  const r = Math.floor(p / 3), c = p % 3;
  let nr = r, nc = c;
  if (dir === 'up')    nr--; else if (dir === 'down')  nr++;
  else if (dir === 'left') nc--; else if (dir === 'right') nc++;
  if (nr < 0 || nr > 2 || nc < 0 || nc > 2) return null;
  return nr * 3 + nc;
}

// ─── core generator ────────────────────────────────────────────────────

function makeNested(id, difficulty, subType, seed, placer, opts) {
  const rng = makeRng(seed);
  const mapFn = MAPPINGS[subType];
  const missingIdx = opts.missingIdx;   // 0-8
  const r = Math.floor(missingIdx / 3), col = missingIdx % 3;
  const correctPos = mapFn(r, col);

  // build 9 cells: 8 visible + 1 unknown
  const cells = [];
  for (let i = 0; i < 9; i++) {
    if (i === missingIdx) {
      cells.push({ unknown: true });
    } else {
      const rr = Math.floor(i / 3), cc = i % 3;
      cells.push(buildCell(mapFn(rr, cc), opts));
    }
  }

  // correct option spec
  const correct = {
    filled_cells: [correctPos],
    black_cell_size: opts.size,
    fill_shape: opts.fill_shape,
    fill_color: opts.fill_color,
    border_color: opts.border_color
  };

  // distractors (spec C.3)
  const candidates = [];
  // D1 off-by-one (adjacent)
  for (const dir of ['up', 'down', 'left', 'right']) {
    const p = adjacent(correctPos, dir);
    if (p !== null) candidates.push({ ...correct, filled_cells: [p], _why: `off-by-one-${dir}` });
  }
  // D2 wrong mapping: use ANOTHER mapping's pos for the same (r, col)
  for (const otherSub of Object.keys(MAPPINGS)) {
    if (otherSub === subType) continue;
    const p = MAPPINGS[otherSub](r, col);
    if (p !== correctPos) candidates.push({ ...correct, filled_cells: [p], _why: `wrong-mapping-${otherSub}` });
  }
  // D3a mirror H + V
  const mh = mirrorH(correctPos);
  if (mh !== correctPos) candidates.push({ ...correct, filled_cells: [mh], _why: 'mirror-H' });
  const mv = mirrorV(correctPos);
  if (mv !== correctPos && mv !== mh) candidates.push({ ...correct, filled_cells: [mv], _why: 'mirror-V' });
  // D3b rotate 90°
  const r90 = rotate90(correctPos);
  if (r90 !== correctPos && r90 !== mh && r90 !== mv) candidates.push({ ...correct, filled_cells: [r90], _why: 'rotate-90' });

  // shuffle + dedup
  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([uniqKeyCell(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(uniqKeyCell(d))) { seen.add(uniqKeyCell(d)); distractors.push(d); }
  }
  // fallback: any unused pos 0-8
  for (let p = 0; p < 9 && distractors.length < 3; p++) {
    const d = { ...correct, filled_cells: [p], _why: 'fill' };
    if (!seen.has(uniqKeyCell(d))) { seen.add(uniqKeyCell(d)); distractors.push(d); }
  }

  const distMeta = distractors.map(d => ({ pos: d.filled_cells[0], source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, `${subType}:${difficulty}`, rng, placer, cellToOpt, uniqKeyCell
  );

  const posLabel = ['左上', '上中', '右上', '中左', '中', '中右', '左下', '下中', '右下'][correctPos];
  const missLabel = ['左上', '上中', '右上', '中左', '中', '中右', '左下', '下中', '右下'][missingIdx];

  const hintMap = {
    'direct-position-mapping':  `每個大格內的小 grid,黑塊位置 = 該大格在 3×3 的位置。? 在 ${missLabel},所以黑塊應該在?`,
    'inverted-mapping':         `小 grid 黑塊位置跟大格位置「上下左右都對稱」(180° 旋轉)。? 在 ${missLabel}。`,
    'row-col-swap':             `把大格的「橫直」對調當小 grid 位置。? 在 ${missLabel},橫直對調?`
  };

  const explMap = {
    'direct-position-mapping':  `每個大格 (r,c) 的小 grid 內,黑塊在第 r*3+c 格。? 在 ${missLabel} (r=${r}, c=${col}),所以黑塊在 <strong>${posLabel}</strong>(pos=${correctPos})。`,
    'inverted-mapping':         `黑塊位置 = 8 − (r*3+c) = 8 − ${r * 3 + col} = <strong>${correctPos}</strong>(${posLabel})。`,
    'row-col-swap':             `大格 (r,c)=(${r},${col}),交換後 (c,r)=(${col},${r}),對應小 grid 位置 c*3+r = <strong>${correctPos}</strong>(${posLabel})。`
  };

  return {
    id,
    ...baseMeta(TOPIC, difficulty, subType, [SKILL_CODE]),
    prompt: PROMPTS[subType],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: hintMap[subType],
    explanation: explMap[subType],
    skill: SKILLS_ZH[subType],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── variant axes 列舉(per user's Q2 approved combo) ──────────────────
// 優先序:(1) missingIdx → (2) size → (3) border_color → (4) marker shape

const SIZES = ['normal', 'large'];
const BORDERS = [null, 'pink', 'teal', 'yellow', 'orange'];  // null = default ink
const MARKERS = ['square', 'circle', 'triangle'];

function* variantAxes() {
  // priority sweep:先 (1)+(2),再加 (3),最後 (4)
  // 9 missing × 2 sizes = 18 base
  for (const size of SIZES) {
    for (let m = 0; m < 9; m++) {
      yield { missingIdx: m, size, border_color: null, fill_shape: 'square' };
    }
  }
  // border color variants (add only when needed beyond 18)
  for (const bc of BORDERS.slice(1)) {
    for (let m = 0; m < 9; m++) {
      yield { missingIdx: m, size: 'normal', border_color: bc, fill_shape: 'square' };
    }
  }
  // marker shape variants (last-resort fallback)
  for (const fs of MARKERS.slice(1)) {
    for (let m = 0; m < 9; m++) {
      yield { missingIdx: m, size: 'normal', border_color: null, fill_shape: fs };
    }
  }
}

// ─── solvers ───────────────────────────────────────────────────────────

export const solvers = {};
for (const [sub, fn] of Object.entries(MAPPINGS)) {
  solvers[sub] = (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const r = Math.floor(idx / 3), c = idx % 3;
    const expectedPos = fn(r, c);
    return q.options.findIndex(o => o.visual.filled_cells && o.visual.filled_cells[0] === expectedPos);
  };
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  { sub: 'direct-position-mapping', diff: 'easy', target: 20, seed: 60001 },
  { sub: 'inverted-mapping',        diff: 'mid',  target: 30, seed: 61001 },
  { sub: 'row-col-swap',            diff: 'hard', target: 15, seed: 62001 }
];

// ID 起點:matrix easy 33+25(tally)=58, mid 28+55=83, hard 23+25=48
const ID_START = { easy: 58, mid: 83, hard: 48 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const { sub, diff, target, seed: baseSeed } of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const axes = [...variantAxes()];
    // 用 RNG shuffle axes 順序(讓 missingIdx 在 batch 內也分散)
    const rng0 = makeRng(baseSeed);
    const shuffledAxes = rngShuffle(rng0, axes);
    for (const opts of shuffledAxes) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `matrix-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = makeNested(id, diff, sub, seed++, placer, opts);
      if (sigs.has(q.signature)) continue;
      const v = validateQuestion(q);
      if (!v.valid) {
        console.error(`❌ ${id} invalid: ${v.errors.join('; ')}`);
        continue;
      }
      sigs.add(q.signature);
      buckets[diff].push(q);
      made++;
    }
    counter[diff] += made;
    stats[`${sub}:${diff}`] = { target, made };
    if (made < target) {
      console.warn(`⚠️  ${sub} (${diff}): only ${made}/${target} unique signatures (axes exhausted)`);
    }
  }

  if (write) {
    for (const diff of ['easy', 'mid', 'hard']) {
      for (const q of buckets[diff]) {
        await writeQuestion(`questions/matrix/${diff}/${q.id}.json`, q);
      }
    }
  }
  return { buckets, stats, balance: placer.report() };
}

import { basename } from 'node:path';
if (basename(process.argv[1] || '').includes('gen-matrix-nested')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-matrix-nested] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-matrix-nested] answer balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
