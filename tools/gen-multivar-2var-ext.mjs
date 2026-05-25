#!/usr/bin/env node
// tools/gen-multivar-2var-ext.mjs
// Batch +1000 — 2var-count-frame (103) + 2var-shape-line (135)
//
// 2var-count-frame:row 規律=count (1-3),col 規律=frame (none/square/circle)
// 2var-shape-line: row 規律=shape (五選三),col 規律=line direction (四選三)
//
// 兩個 sub_type 共 238 題,都用獨立 primitive (count-frame, shape-line)。

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'multivar';
const SKILL_CODE = 'multivar-2var';

// ───────────────────── 2var-count-frame ─────────────────────

const FRAMES = ['none', 'square', 'circle'];
const COUNTS = [1, 2, 3];

const FRAME_ZH = { none: '無框', square: '方框', circle: '圓框' };

function cfDesc(c) {
  if (c.unknown) return '?';
  return `${FRAME_ZH[c.frame]}+${c.count}點`;
}
function cfToOpt(c) {
  return {
    text: cfDesc(c),
    visual: { type: 'count-frame', frame: c.frame, count: c.count }
  };
}
function cfKey(c) { return `cf-${c.frame}-${c.count}`; }

function* cfAxes() {
  function* perms(arr, k) {
    if (k === 0) { yield []; return; }
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const t of perms(rest, k - 1)) yield [arr[i], ...t];
    }
  }
  const fPerms = [...perms(FRAMES, 3)];   // 6
  const cPerms = [...perms(COUNTS, 3)];   // 6
  for (const fp of fPerms) {
    for (const cp of cPerms) {
      for (const rowIsCount of [true, false]) {
        for (const mi of [8, 4, 0, 2, 6, 1, 3, 5, 7]) {
          yield { framePerm: fp, countPerm: cp, rowIsCount, missingIdx: mi };
        }
      }
    }
  }
}

function genCountFrame(id, difficulty, seed, placer, opts) {
  const rng = makeRng(seed);
  const { framePerm, countPerm, rowIsCount, missingIdx } = opts;
  const cellAt = (r, c) => {
    const count = rowIsCount ? countPerm[r] : countPerm[c];
    const frame = rowIsCount ? framePerm[c] : framePerm[r];
    return { type: 'count-frame', frame, count };
  };

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      cells.push(i === missingIdx ? { unknown: true } : cellAt(r, c));
    }
  }
  const mr = Math.floor(missingIdx / 3), mc = missingIdx % 3;
  const correctCount = rowIsCount ? countPerm[mr] : countPerm[mc];
  const correctFrame = rowIsCount ? framePerm[mc] : framePerm[mr];
  const correct = { frame: correctFrame, count: correctCount };

  const candidates = [];
  for (const f of framePerm) if (f !== correctFrame) candidates.push({ frame: f, count: correctCount, _why: `wrong-frame-${f}` });
  for (const n of countPerm) if (n !== correctCount) candidates.push({ frame: correctFrame, count: n, _why: `wrong-count-${n}` });
  // axis-swap
  const swapFrame = rowIsCount ? framePerm[mr] : framePerm[mc];
  const swapCount = rowIsCount ? countPerm[mc] : countPerm[mr];
  if (swapFrame !== correctFrame || swapCount !== correctCount) {
    candidates.push({ frame: swapFrame, count: swapCount, _why: 'axis-swap' });
  }
  // both wrong
  for (const f of framePerm) for (const n of countPerm) {
    if (f !== correctFrame && n !== correctCount) {
      candidates.push({ frame: f, count: n, _why: 'both-wrong' });
      break;
    }
    if (candidates.some(c => c._why === 'both-wrong')) break;
  }

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([cfKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(cfKey(d))) { seen.add(cfKey(d)); distractors.push(d); }
  }
  for (const f of FRAMES) for (const n of COUNTS) {
    if (distractors.length >= 3) break;
    const cand = { frame: f, count: n, _why: 'fill' };
    if (!seen.has(cfKey(cand))) { seen.add(cfKey(cand)); distractors.push(cand); }
  }
  const distMeta = distractors.map(d => ({ frame: d.frame, count: d.count, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, `2var-count-frame:${difficulty}`, rng, placer, cfToOpt, cfKey
  );

  const axisLabel = rowIsCount ? '橫向看點數,直向看外框' : '直向看點數,橫向看外框';
  return {
    id,
    ...baseMeta(TOPIC, difficulty, '2var-count-frame', [SKILL_CODE]),
    prompt: '橫向跟直向看不同的東西(框跟點數),? 是哪個?',
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `${axisLabel}。? 在第 ${mr+1} 排第 ${mc+1} 行。`,
    explanation: `<strong>${axisLabel}</strong>:該排 ${correctCount} 點、該行 ${FRAME_ZH[correctFrame]}。? = <strong>${FRAME_ZH[correctFrame]} + ${correctCount} 點</strong>。`,
    skill: '外框+數量雙變數',
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ───────────────────── 2var-shape-line ─────────────────────

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hex'];
const LINES = ['horizontal', 'vertical', 'diag-1', 'diag-2'];

const SHAPE_ZH = { circle: '圓', square: '方', triangle: '三角', diamond: '菱形', hex: '六邊形' };
const LINE_ZH = { horizontal: '橫線', vertical: '直線', 'diag-1': '主對角線', 'diag-2': '副對角線' };

function slDesc(c) {
  if (c.unknown) return '?';
  return `${SHAPE_ZH[c.shape]}穿${LINE_ZH[c.line]}`;
}
function slToOpt(c) {
  return { text: slDesc(c), visual: { type: 'shape-line', shape: c.shape, line: c.line } };
}
function slKey(c) { return `sl-${c.shape}-${c.line}`; }

function* slAxes() {
  function* perms(arr, k) {
    if (k === 0) { yield []; return; }
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const t of perms(rest, k - 1)) yield [arr[i], ...t];
    }
  }
  const sPerms = [...perms(SHAPES, 3)];   // 60
  const lPerms = [...perms(LINES, 3)];    // 24
  // limit explosion: yield in shuffled order
  for (const sp of sPerms) {
    for (const lp of lPerms) {
      for (const rowIsShape of [true, false]) {
        for (const mi of [8, 4, 0, 2, 6, 1, 3, 5, 7]) {
          yield { shapePerm: sp, linePerm: lp, rowIsShape, missingIdx: mi };
        }
      }
    }
  }
}

function genShapeLine(id, difficulty, seed, placer, opts) {
  const rng = makeRng(seed);
  const { shapePerm, linePerm, rowIsShape, missingIdx } = opts;
  const cellAt = (r, c) => {
    const shape = rowIsShape ? shapePerm[r] : shapePerm[c];
    const line = rowIsShape ? linePerm[c] : linePerm[r];
    return { type: 'shape-line', shape, line };
  };
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      cells.push(i === missingIdx ? { unknown: true } : cellAt(r, c));
    }
  }
  const mr = Math.floor(missingIdx / 3), mc = missingIdx % 3;
  const correctShape = rowIsShape ? shapePerm[mr] : shapePerm[mc];
  const correctLine  = rowIsShape ? linePerm[mc]  : linePerm[mr];
  const correct = { shape: correctShape, line: correctLine };

  const candidates = [];
  for (const s of shapePerm) if (s !== correctShape) candidates.push({ shape: s, line: correctLine, _why: `wrong-shape-${s}` });
  for (const l of linePerm) if (l !== correctLine) candidates.push({ shape: correctShape, line: l, _why: `wrong-line-${l}` });
  const swapShape = rowIsShape ? shapePerm[mc] : shapePerm[mr];
  const swapLine  = rowIsShape ? linePerm[mr]  : linePerm[mc];
  if (swapShape !== correctShape || swapLine !== correctLine) {
    candidates.push({ shape: swapShape, line: swapLine, _why: 'axis-swap' });
  }
  for (const s of shapePerm) {
    for (const l of linePerm) {
      if (s !== correctShape && l !== correctLine) {
        candidates.push({ shape: s, line: l, _why: 'both-wrong' });
        break;
      }
    }
    if (candidates.some(c => c._why === 'both-wrong')) break;
  }
  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([slKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(slKey(d))) { seen.add(slKey(d)); distractors.push(d); }
  }
  for (const s of SHAPES) for (const l of LINES) {
    if (distractors.length >= 3) break;
    const cand = { shape: s, line: l, _why: 'fill' };
    if (!seen.has(slKey(cand))) { seen.add(slKey(cand)); distractors.push(cand); }
  }
  const distMeta = distractors.map(d => ({ shape: d.shape, line: d.line, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, `2var-shape-line:${difficulty}`, rng, placer, slToOpt, slKey
  );

  const axisLabel = rowIsShape ? '橫向看形狀,直向看穿過的線' : '直向看形狀,橫向看穿過的線';
  return {
    id,
    ...baseMeta(TOPIC, difficulty, '2var-shape-line', [SKILL_CODE]),
    prompt: '形狀跟穿過的線都在變,? 是哪個?',
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `${axisLabel}。? 在第 ${mr+1} 排第 ${mc+1} 行。`,
    explanation: `<strong>${axisLabel}</strong>:該排是 ${SHAPE_ZH[correctShape]},該行的線方向是 ${LINE_ZH[correctLine]}。? = <strong>${SHAPE_ZH[correctShape]} 穿 ${LINE_ZH[correctLine]}</strong>。`,
    skill: '形狀+穿線方向雙變數',
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solvers ───────────────────────────────────────────────────────────

function buildAxisInferringSolver(getValueFn, expectedFromAxes) {
  return (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;
    // Check row mr consistency for each attribute
    return expectedFromAxes(q, cells, mr, mc);
  };
}

export const solvers = {
  '2var-count-frame': (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;
    // Determine which axis is count vs frame by row mr consistency
    let rowFrame = null, rowFrameSame = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowFrame === null) rowFrame = cell.frame;
      else if (cell.frame !== rowFrame) rowFrameSame = false;
    }
    let rowCount = null, rowCountSame = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowCount === null) rowCount = cell.count;
      else if (cell.count !== rowCount) rowCountSame = false;
    }
    let colFrame = null, colFrameSame = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colFrame === null) colFrame = cell.frame;
      else if (cell.frame !== colFrame) colFrameSame = false;
    }
    let colCount = null, colCountSame = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colCount === null) colCount = cell.count;
      else if (cell.count !== colCount) colCountSame = false;
    }
    let exp;
    if (rowCountSame && colFrameSame) exp = { count: rowCount, frame: colFrame };
    else if (rowFrameSame && colCountSame) exp = { count: colCount, frame: rowFrame };
    else return -1;
    return q.options.findIndex(o => o.visual.count === exp.count && o.visual.frame === exp.frame);
  },
  '2var-shape-line': (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;
    let rowShape = null, rowShapeSame = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowShape === null) rowShape = cell.shape;
      else if (cell.shape !== rowShape) rowShapeSame = false;
    }
    let rowLine = null, rowLineSame = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowLine === null) rowLine = cell.line;
      else if (cell.line !== rowLine) rowLineSame = false;
    }
    let colShape = null, colShapeSame = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colShape === null) colShape = cell.shape;
      else if (cell.shape !== colShape) colShapeSame = false;
    }
    let colLine = null, colLineSame = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colLine === null) colLine = cell.line;
      else if (cell.line !== colLine) colLineSame = false;
    }
    let exp;
    if (rowShapeSame && colLineSame) exp = { shape: rowShape, line: colLine };
    else if (rowLineSame && colShapeSame) exp = { shape: colShape, line: rowLine };
    else return -1;
    return q.options.findIndex(o => o.visual.shape === exp.shape && o.visual.line === exp.line);
  }
};

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS_CF = [
  { diff: 'easy', target: 28, seed: 100001 },
  { diff: 'mid',  target: 50, seed: 101001 },
  { diff: 'hard', target: 25, seed: 102001 }
];
const RUNS_SL = [
  { diff: 'easy', target: 35, seed: 110001 },
  { diff: 'mid',  target: 70, seed: 111001 },
  { diff: 'hard', target: 30, seed: 112001 }
];

// multivar ID 起點 (after Phase 3 direction-fill):
//   easy 58 (23+35), mid 88 (23+65), hard 48 (18+30)
const ID_START = { easy: 58, mid: 88, hard: 48 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  // count-frame
  for (const { diff, target, seed: baseSeed } of RUNS_CF) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const axisList = [...cfAxes()];
    const rng0 = makeRng(baseSeed);
    const shuffled = rngShuffle(rng0, axisList);
    for (const opts of shuffled) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `multivar-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = genCountFrame(id, diff, seed++, placer, opts);
      if (sigs.has(q.signature)) continue;
      const v = validateQuestion(q);
      if (!v.valid) { console.error(`❌ ${id} ${v.errors.join('; ')}`); continue; }
      sigs.add(q.signature);
      buckets[diff].push(q);
      made++;
    }
    counter[diff] += made;
    stats[`2var-count-frame:${diff}`] = { target, made };
    if (made < target) console.warn(`⚠️  2var-count-frame (${diff}): ${made}/${target}`);
  }

  // shape-line
  for (const { diff, target, seed: baseSeed } of RUNS_SL) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const rng0 = makeRng(baseSeed);
    const gen = slAxes();
    const sample = [];
    for (const a of gen) {
      sample.push(a);
      if (sample.length >= target * 30) break;
    }
    const shuffled = rngShuffle(rng0, sample);
    for (const opts of shuffled) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `multivar-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = genShapeLine(id, diff, seed++, placer, opts);
      if (sigs.has(q.signature)) continue;
      const v = validateQuestion(q);
      if (!v.valid) { console.error(`❌ ${id} ${v.errors.join('; ')}`); continue; }
      sigs.add(q.signature);
      buckets[diff].push(q);
      made++;
    }
    counter[diff] += made;
    stats[`2var-shape-line:${diff}`] = { target, made };
    if (made < target) console.warn(`⚠️  2var-shape-line (${diff}): ${made}/${target}`);
  }

  if (write) {
    for (const diff of ['easy', 'mid', 'hard']) {
      for (const q of buckets[diff]) {
        await writeQuestion(`questions/multivar/${diff}/${q.id}.json`, q);
      }
    }
  }
  return { buckets, stats, balance: placer.report() };
}

import { basename } from 'node:path';
if (basename(process.argv[1] || '').includes('gen-multivar-2var-ext')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-multivar-2var-ext] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-multivar-2var-ext] balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
