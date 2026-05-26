#!/usr/bin/env node
// tools/gen-matrix-tally.mjs
// Batch +1000 — 線條/點陣加法 (perceptual grouping)
// 4 個 sub_type 共 105 題:
//   tally-h-add        easy 13   row[2].h = row[0].h + row[1].h
//   tally-v-add        easy 12   同上但用直線
//   tally-cross-add    mid  55   h 跟 v 都加,雙軸獨立規律
//   dots-pattern-add   hard 25   點數加 (用 dots primitive,count 1-6)
//
// distractor 設計 (per spec C.4):
//   D1 off-by-one  正解 ±1
//   D2 copy-row    複製 row[0] 或 row[1] 的值 (axis-swap for cross)
//   D3 multiplication-trick / extreme

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer,
  placeOptionsBalanced, build3x3Cells
} from './gen-utils.mjs';

const TOPIC = 'matrix';
const SKILL_CODE = 'pattern-tally-add';

const PROMPTS = {
  'tally-h-add':       '橫線數量在加,?裡有幾條橫線?',
  'tally-v-add':       '直線數量在加,?裡有幾條直線?',
  'tally-cross-add':   '橫線跟直線數量都在加,?是哪一格?',
  'dots-pattern-add':  '前兩格的點數加起來等於第三格,?有幾個點?'
};

const SKILLS_ZH = {
  'tally-h-add':       '橫線加法',
  'tally-v-add':       '直線加法',
  'tally-cross-add':   '橫直雙軸加法',
  'dots-pattern-add':  '點陣加法'
};

// ─── helpers ───────────────────────────────────────────────────────────

function tallyDesc(c) {
  if (c.unknown) return '?';
  const h = c.h_count || 0, v = c.v_count || 0;
  if (h && v) return `${h} 橫 ${v} 直`;
  if (h) return `${h} 條橫線`;
  if (v) return `${v} 條直線`;
  return '空白';
}
function tallyToOpt(c) {
  return { text: tallyDesc(c),
           visual: { type: 'tally-lines', h_count: c.h_count || 0, v_count: c.v_count || 0 } };
}
function tallyKey(c) { return `t-${c.h_count || 0}-${c.v_count || 0}`; }

function dotsDesc(c) { return c.unknown ? '?' : `${c.count} 個點`; }
function dotsToOpt(c) {
  return { text: dotsDesc(c),
           visual: { type: 'single-shape', shape: 'dots', count: c.count } };
}
function dotsKey(c) { return `d-${c.count}`; }

// ─── tally-h-add (easy 13) ─────────────────────────────────────────────
// pattern (a,b) → row = [a, b, a+b]; constraints a,b ≥ 0, a+b ≤ 3, !(a===0 && b===0)
const H_PATTERNS = [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[2,0],[2,1],[3,0]];

function genTallyHAdd(id, seed, placer) {
  const rng = makeRng(seed);
  // pick 3 distinct row patterns; place last as the "unknown row"
  const picked = rngShuffle(rng, H_PATTERNS).slice(0, 3);
  const cells = build3x3Cells((r, c) => {
    const [a, b] = picked[r];
    const h = c === 0 ? a : c === 1 ? b : a + b;
    return { type: 'tally-lines', h_count: h, v_count: 0 };
  });
  const [a, b] = picked[2];
  const correctH = a + b;
  const correct = { h_count: correctH, v_count: 0 };
  // distractor pool
  const candidates = [];
  // D1 off-by-one (±1)
  for (const delta of [-1, 1]) {
    const h = correctH + delta;
    if (h >= 0 && h <= 3) candidates.push({ h_count: h, v_count: 0, _why: `off-by-one ${delta}` });
  }
  // D2 copy row[0]/row[1]
  if (a !== correctH) candidates.push({ h_count: a, v_count: 0, _why: 'copy-row0' });
  if (b !== correctH && b !== a) candidates.push({ h_count: b, v_count: 0, _why: 'copy-row1' });
  // D3 multiplication trick
  const mul = a * b;
  if (mul !== correctH && mul >= 0 && mul <= 3) candidates.push({ h_count: mul, v_count: 0, _why: 'multiplication-trick' });
  // D3 alt: subtraction
  const sub = Math.abs(a - b);
  if (sub !== correctH && sub !== mul && sub >= 0 && sub <= 3) candidates.push({ h_count: sub, v_count: 0, _why: 'subtraction-trick' });
  // dedup
  const seen = new Set([tallyKey(correct)]);
  const distractors = [];
  for (const d of candidates) {
    if (distractors.length >= 3) break;
    if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
  }
  // fill any remaining with simple 0..3 not used yet
  for (let h = 0; h <= 3 && distractors.length < 3; h++) {
    const d = { h_count: h, v_count: 0, _why: 'fill' };
    if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ value: d.h_count, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'tally-h-add:easy', rng, placer, tallyToOpt, tallyKey
  );
  return {
    id,
    ...baseMeta(TOPIC, 'easy', 'tally-h-add', [SKILL_CODE]),
    prompt: PROMPTS['tally-h-add'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `把第 3 排前兩格的橫線數加起來。前兩格是 ${a} 跟 ${b} 條,?應該是?`,
    explanation: `每一排:<strong>前兩格相加 = 第三格</strong>。Row1 ${picked[0][0]}+${picked[0][1]}=${picked[0][0]+picked[0][1]}。Row2 ${picked[1][0]}+${picked[1][1]}=${picked[1][0]+picked[1][1]}。Row3 ${a}+${b}=<strong>${correctH}</strong>。所以 ? = <strong>${correctH} 條橫線</strong>。`,
    skill: SKILLS_ZH['tally-h-add'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── tally-v-add (easy 12) ─────────────────────────────────────────────
// 跟 h-add 對稱
function genTallyVAdd(id, seed, placer) {
  const rng = makeRng(seed);
  const picked = rngShuffle(rng, H_PATTERNS).slice(0, 3);
  const cells = build3x3Cells((r, c) => {
    const [a, b] = picked[r];
    const v = c === 0 ? a : c === 1 ? b : a + b;
    return { type: 'tally-lines', h_count: 0, v_count: v };
  });
  const [a, b] = picked[2];
  const correctV = a + b;
  const correct = { h_count: 0, v_count: correctV };
  const candidates = [];
  for (const delta of [-1, 1]) {
    const v = correctV + delta;
    if (v >= 0 && v <= 3) candidates.push({ h_count: 0, v_count: v, _why: `off-by-one ${delta}` });
  }
  if (a !== correctV) candidates.push({ h_count: 0, v_count: a, _why: 'copy-row0' });
  if (b !== correctV && b !== a) candidates.push({ h_count: 0, v_count: b, _why: 'copy-row1' });
  const mul = a * b;
  if (mul !== correctV && mul >= 0 && mul <= 3) candidates.push({ h_count: 0, v_count: mul, _why: 'multiplication-trick' });
  const sub = Math.abs(a - b);
  if (sub !== correctV && sub !== mul && sub >= 0 && sub <= 3) candidates.push({ h_count: 0, v_count: sub, _why: 'subtraction-trick' });
  const seen = new Set([tallyKey(correct)]);
  const distractors = [];
  for (const d of candidates) {
    if (distractors.length >= 3) break;
    if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
  }
  for (let v = 0; v <= 3 && distractors.length < 3; v++) {
    const d = { h_count: 0, v_count: v, _why: 'fill' };
    if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ value: d.v_count, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'tally-v-add:easy', rng, placer, tallyToOpt, tallyKey
  );
  return {
    id,
    ...baseMeta(TOPIC, 'easy', 'tally-v-add', [SKILL_CODE]),
    prompt: PROMPTS['tally-v-add'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `把第 3 排前兩格的直線數加起來。前兩格是 ${a} 跟 ${b} 條,?應該是?`,
    explanation: `每一排:<strong>前兩格相加 = 第三格</strong>。Row1 ${picked[0][0]}+${picked[0][1]}=${picked[0][0]+picked[0][1]}。Row2 ${picked[1][0]}+${picked[1][1]}=${picked[1][0]+picked[1][1]}。Row3 ${a}+${b}=<strong>${correctV}</strong>。所以 ? = <strong>${correctV} 條直線</strong>。`,
    skill: SKILLS_ZH['tally-v-add'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── tally-cross-add (mid 55) ──────────────────────────────────────────
// h 跟 v 都加;雙軸獨立。pattern (ha,hb,va,vb) → row [(ha,va),(hb,vb),(ha+hb,va+vb)]
function genTallyCrossAdd(id, seed, placer) {
  const rng = makeRng(seed);
  // pick 3 rows, each row has (ha, hb) and (va, vb) independently
  // ensure ha+hb ≤ 3, va+vb ≤ 3, !(both 0,0)
  function pickRow(rng) {
    let ha, hb, va, vb, tries = 0;
    do {
      ha = Math.floor(rng() * 4);
      hb = Math.floor(rng() * 4);
      va = Math.floor(rng() * 4);
      vb = Math.floor(rng() * 4);
      tries++;
    } while ((ha + hb > 3 || va + vb > 3 || (ha === 0 && hb === 0 && va === 0 && vb === 0)) && tries < 50);
    return [ha, hb, va, vb];
  }
  const rows = [pickRow(rng), pickRow(rng), pickRow(rng)];
  const cells = build3x3Cells((r, c) => {
    const [ha, hb, va, vb] = rows[r];
    const h = c === 0 ? ha : c === 1 ? hb : ha + hb;
    const v = c === 0 ? va : c === 1 ? vb : va + vb;
    return { type: 'tally-lines', h_count: h, v_count: v };
  });
  const [ha, hb, va, vb] = rows[2];
  const correctH = ha + hb, correctV = va + vb;
  const correct = { h_count: correctH, v_count: correctV };
  // distractors
  const candidates = [];
  // D1 off-by-one on h or v
  if (correctH + 1 <= 3) candidates.push({ h_count: correctH + 1, v_count: correctV, _why: 'h+1' });
  if (correctH - 1 >= 0) candidates.push({ h_count: correctH - 1, v_count: correctV, _why: 'h-1' });
  if (correctV + 1 <= 3) candidates.push({ h_count: correctH, v_count: correctV + 1, _why: 'v+1' });
  if (correctV - 1 >= 0) candidates.push({ h_count: correctH, v_count: correctV - 1, _why: 'v-1' });
  // D2 axis-swap (swap correct h and v)
  if (correctH !== correctV) candidates.push({ h_count: correctV, v_count: correctH, _why: 'axis-swap' });
  // D3 copy row[0] or row[1]
  candidates.push({ h_count: ha, v_count: va, _why: 'copy-row0' });
  candidates.push({ h_count: hb, v_count: vb, _why: 'copy-row1' });
  // shuffle candidates then dedup
  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([tallyKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (d.h_count < 0 || d.h_count > 3 || d.v_count < 0 || d.v_count > 3) continue;
    if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
  }
  // fill if needed
  for (let h = 0; h <= 3 && distractors.length < 3; h++) {
    for (let v = 0; v <= 3 && distractors.length < 3; v++) {
      const d = { h_count: h, v_count: v, _why: 'fill' };
      if (!seen.has(tallyKey(d))) { seen.add(tallyKey(d)); distractors.push(d); }
    }
  }
  const distMeta = distractors.map(d => ({ h: d.h_count, v: d.v_count, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'tally-cross-add:mid', rng, placer, tallyToOpt, tallyKey
  );
  return {
    id,
    ...baseMeta(TOPIC, 'mid', 'tally-cross-add', [SKILL_CODE]),
    prompt: PROMPTS['tally-cross-add'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `橫線:${ha}+${hb}=?,直線:${va}+${vb}=?,兩個都要算。`,
    explanation: `<strong>橫線</strong>每排前兩格相加:Row3 ${ha}+${hb}=<strong>${correctH}</strong>。<strong>直線</strong>同理:Row3 ${va}+${vb}=<strong>${correctV}</strong>。所以 ? = <strong>${correctH} 橫 + ${correctV} 直</strong>。`,
    skill: SKILLS_ZH['tally-cross-add'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── dots-pattern-add (hard 25) ────────────────────────────────────────
// 點數加法,sum ≤ 6 (dots primitive 上限)
function genDotsPatternAdd(id, seed, placer) {
  const rng = makeRng(seed);
  function pickRow(rng) {
    let a, b, tries = 0;
    do {
      a = 1 + Math.floor(rng() * 5);   // 1-5
      b = 1 + Math.floor(rng() * 5);
      tries++;
    } while (a + b > 6 && tries < 50);
    return [a, b];
  }
  const rows = [pickRow(rng), pickRow(rng), pickRow(rng)];
  const cells = build3x3Cells((r, c) => {
    const [a, b] = rows[r];
    const n = c === 0 ? a : c === 1 ? b : a + b;
    return { shape: 'dots', count: n };
  });
  const [a, b] = rows[2];
  const correctN = a + b;
  const correct = { count: correctN };
  const candidates = [];
  if (correctN + 1 <= 6) candidates.push({ count: correctN + 1, _why: 'off-by-one+' });
  if (correctN - 1 >= 1) candidates.push({ count: correctN - 1, _why: 'off-by-one-' });
  if (a !== correctN) candidates.push({ count: a, _why: 'copy-row0' });
  if (b !== correctN && b !== a) candidates.push({ count: b, _why: 'copy-row1' });
  const mul = a * b;
  if (mul !== correctN && mul >= 1 && mul <= 6) candidates.push({ count: mul, _why: 'multiplication' });
  const sub = Math.abs(a - b);
  if (sub !== correctN && sub >= 1 && sub <= 6) candidates.push({ count: sub, _why: 'subtraction' });
  const seen = new Set([dotsKey(correct)]);
  const distractors = [];
  const shuf = rngShuffle(rng, candidates);
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(dotsKey(d))) { seen.add(dotsKey(d)); distractors.push(d); }
  }
  for (let n = 1; n <= 6 && distractors.length < 3; n++) {
    const d = { count: n, _why: 'fill' };
    if (!seen.has(dotsKey(d))) { seen.add(dotsKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ value: d.count, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'dots-pattern-add:hard', rng, placer, dotsToOpt, dotsKey
  );
  return {
    id,
    ...baseMeta(TOPIC, 'hard', 'dots-pattern-add', [SKILL_CODE]),
    prompt: PROMPTS['dots-pattern-add'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `第 3 排前兩格是 ${a} 跟 ${b} 個點,加起來是?`,
    explanation: `每一排:<strong>前兩格點數相加 = 第三格</strong>。Row1 ${rows[0][0]}+${rows[0][1]}=${rows[0][0]+rows[0][1]}。Row2 ${rows[1][0]}+${rows[1][1]}=${rows[1][0]+rows[1][1]}。Row3 ${a}+${b}=<strong>${correctN}</strong>。? = <strong>${correctN} 個點</strong>。`,
    skill: SKILLS_ZH['dots-pattern-add'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solver (for self-solve.mjs) ───────────────────────────────────────
export const solvers = {
  'tally-h-add': (q) => {
    const c = q.visual.cells;
    // Row 3 = idx 6, 7, 8. idx 8 is ?
    const a = c[6].h_count, b = c[7].h_count;
    const target = a + b;
    return q.options.findIndex(o => (o.visual.h_count || 0) === target && (o.visual.v_count || 0) === 0);
  },
  'tally-v-add': (q) => {
    const c = q.visual.cells;
    const a = c[6].v_count, b = c[7].v_count;
    const target = a + b;
    return q.options.findIndex(o => (o.visual.v_count || 0) === target && (o.visual.h_count || 0) === 0);
  },
  'tally-cross-add': (q) => {
    const c = q.visual.cells;
    const th = c[6].h_count + c[7].h_count;
    const tv = c[6].v_count + c[7].v_count;
    return q.options.findIndex(o => o.visual.h_count === th && o.visual.v_count === tv);
  },
  'dots-pattern-add': (q) => {
    const c = q.visual.cells;
    const a = c[6].count, b = c[7].count;
    const target = a + b;
    return q.options.findIndex(o => o.visual.count === target);
  }
};

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  ['easy', 'tally-h-add',       genTallyHAdd,       13, 50001],
  ['easy', 'tally-v-add',       genTallyVAdd,       12, 51001],
  ['mid',  'tally-cross-add',   genTallyCrossAdd,   55, 52001],
  ['hard', 'dots-pattern-add',  genDotsPatternAdd,  25, 53001]
];

// ID 起點:easy 033, mid 028, hard 023 (現有 max + 1)
const ID_START = { easy: 33, mid: 28, hard: 23 };

const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const [diff, sub, fn, target, baseSeed] of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed, attempts = 0;
    while (made < target && attempts < target * 30) {
      const idNum = counter[diff] + made;
      const id = `matrix-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = fn(id, seed++, placer);
      attempts++;
      if (sigs.has(q.signature)) continue;
      sigs.add(q.signature);
      // validate immediately
      const v = validateQuestion(q);
      if (!v.valid) {
        console.error(`❌ ${id} invalid: ${v.errors.join('; ')}`);
        continue;
      }
      buckets[diff].push(q);
      made++;
    }
    counter[diff] += made;
    stats[`${sub}:${diff}`] = { target, made, attempts };
    if (made < target) {
      console.warn(`⚠️  ${sub} (${diff}): only ${made}/${target} unique signatures after ${attempts} attempts`);
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

// 直接 invoke (Windows path-safe)
import { basename } from 'node:path';
if (basename(process.argv[1] || '').includes('gen-matrix-tally')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-matrix-tally] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-matrix-tally] answer balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
