#!/usr/bin/env node
// tools/gen-matrix-logical.mjs
// Batch +1000 — 邏輯疊加 (line-overlay primitive)
// 3 個 sub_type 共 160 題:
//   logical-overlay-or   easy 25                row[2] = OR(row[0], row[1])
//   logical-overlay-and  easy 15, mid 50, hard 10  AND
//   logical-overlay-xor  mid 30, hard 30           XOR
//
// 每 cell 是 6 個 line element 的子集(top_h/bottom_h/left_v/right_v/diag_main/diag_anti)。
// 難度由「alphabet 大小」決定:easy=2, mid=4, hard=6。
//
// distractor (per spec C.1):
//   D1 wrong-OP        用錯誤 OP 算出來的結果
//   D2 mirror          H 或 V 鏡射 correct
//   D3 random-subset   抄 cell[0] 或 cell[1]
//   D3 alt: one-off, extreme, repeat-visible

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'matrix';
const SKILL_CODE = 'pattern-logical-overlay';

const ALL_LINES = ['top_h', 'bottom_h', 'left_v', 'right_v', 'diag_main', 'diag_anti'];

const PROMPTS = {
  'logical-overlay-or':  '把前兩格的線疊起來,? 應該有哪些線?',
  'logical-overlay-and': '前兩格都有的線才保留,? 應該有哪些線?',
  'logical-overlay-xor': '前兩格相同的線消失、不同的線保留,? 應該有哪些線?'
};

const SKILLS_ZH = {
  'logical-overlay-or':  '線條聯集 (OR)',
  'logical-overlay-and': '線條交集 (AND)',
  'logical-overlay-xor': '線條對稱差 (XOR)'
};

const OP_FNS = {
  or:  (a, b) => new Set([...a, ...b]),
  and: (a, b) => new Set([...a].filter(x => b.has(x))),
  xor: (a, b) => {
    const s = new Set();
    for (const x of a) if (!b.has(x)) s.add(x);
    for (const x of b) if (!a.has(x)) s.add(x);
    return s;
  }
};

// ─── set helpers ───────────────────────────────────────────────────────

function toSortedArray(s) {
  return [...s].sort((a, b) => ALL_LINES.indexOf(a) - ALL_LINES.indexOf(b));
}
function setKey(s) { return toSortedArray(s).join('|'); }
function setEq(a, b) { return setKey(a) === setKey(b); }

// horizontal mirror swaps left_v ↔ right_v and diag_main ↔ diag_anti
const H_MIRROR = { top_h: 'top_h', bottom_h: 'bottom_h', left_v: 'right_v', right_v: 'left_v',
                   diag_main: 'diag_anti', diag_anti: 'diag_main' };
const V_MIRROR = { top_h: 'bottom_h', bottom_h: 'top_h', left_v: 'left_v', right_v: 'right_v',
                   diag_main: 'diag_anti', diag_anti: 'diag_main' };
function mirrorSet(s, mir) {
  const out = new Set();
  for (const x of s) out.add(mir[x]);
  return out;
}

// random subset of alphabet (each line independently 0.5)
function randomSubset(rng, alphabet) {
  const s = new Set();
  for (const a of alphabet) if (rng() < 0.5) s.add(a);
  return s;
}

// describe a set in Chinese
const LINE_ZH = { top_h: '上橫', bottom_h: '下橫', left_v: '左直', right_v: '右直', diag_main: '主對角', diag_anti: '副對角' };
function setDesc(s) {
  const arr = toSortedArray(s);
  if (arr.length === 0) return '空';
  return arr.map(l => LINE_ZH[l]).join('+');
}

function lineCellToOpt(s) {
  return {
    text: setDesc(s),
    visual: { type: 'line-overlay', lines: toSortedArray(s) }
  };
}
function lineCellKey(s) { return setKey(s); }

// ─── core generator ────────────────────────────────────────────────────

function genLogical(id, difficulty, subType, op, alphabet, seed, placer) {
  const rng = makeRng(seed);
  const opFn = OP_FNS[op];

  // pick 3 rows, each with (a, b) and c = a op b
  // ensure no boring row (e.g. a=b=∅ → all empty)
  const rows = [];
  let safety = 0;
  while (rows.length < 3 && safety < 200) {
    const a = randomSubset(rng, alphabet);
    const b = randomSubset(rng, alphabet);
    const c = opFn(a, b);
    // ensure not all empty
    if (a.size === 0 && b.size === 0 && c.size === 0) { safety++; continue; }
    // dedupe rows to keep matrix interesting
    const rkey = `${setKey(a)}/${setKey(b)}/${setKey(c)}`;
    if (rows.some(r => r._key === rkey)) { safety++; continue; }
    rows.push({ a, b, c, _key: rkey });
    safety++;
  }
  if (rows.length < 3) return null;

  const cells = [];
  for (let r = 0; r < 3; r++) {
    const { a, b, c } = rows[r];
    cells.push({ type: 'line-overlay', lines: toSortedArray(a) });
    cells.push({ type: 'line-overlay', lines: toSortedArray(b) });
    if (r === 2) cells.push({ unknown: true });
    else cells.push({ type: 'line-overlay', lines: toSortedArray(c) });
  }

  const correctSet = rows[2].c;
  const cellA = rows[2].a, cellB = rows[2].b;

  // distractors
  const candidates = [];
  // D1 wrong-OP
  for (const otherOp of ['or', 'and', 'xor']) {
    if (otherOp === op) continue;
    const wrong = OP_FNS[otherOp](cellA, cellB);
    if (!setEq(wrong, correctSet)) candidates.push({ set: wrong, _why: `wrong-op-${otherOp}` });
  }
  // D2 H-mirror, V-mirror
  const hMir = mirrorSet(correctSet, H_MIRROR);
  if (!setEq(hMir, correctSet)) candidates.push({ set: hMir, _why: 'h-mirror' });
  const vMir = mirrorSet(correctSet, V_MIRROR);
  if (!setEq(vMir, correctSet) && !setEq(vMir, hMir)) candidates.push({ set: vMir, _why: 'v-mirror' });
  // D3 random-subset: copy cellA or cellB
  if (!setEq(cellA, correctSet)) candidates.push({ set: cellA, _why: 'copy-a' });
  if (!setEq(cellB, correctSet) && !setEq(cellB, cellA)) candidates.push({ set: cellB, _why: 'copy-b' });
  // D3 one-off: add/remove a line
  for (const line of alphabet) {
    if (candidates.length >= 8) break;
    const tweak = new Set(correctSet);
    if (tweak.has(line)) tweak.delete(line); else tweak.add(line);
    if (!setEq(tweak, correctSet)) candidates.push({ set: tweak, _why: `one-off-${line}` });
  }
  // D3 extreme: empty + full alphabet
  const empty = new Set();
  if (!setEq(empty, correctSet)) candidates.push({ set: empty, _why: 'extreme-empty' });
  const full = new Set(alphabet);
  if (!setEq(full, correctSet)) candidates.push({ set: full, _why: 'extreme-full' });
  // D3 repeat-visible: row 0 or row 1's c
  if (!setEq(rows[0].c, correctSet)) candidates.push({ set: rows[0].c, _why: 'repeat-row0-c' });
  if (!setEq(rows[1].c, correctSet) && !setEq(rows[1].c, rows[0].c)) candidates.push({ set: rows[1].c, _why: 'repeat-row1-c' });

  // shuffle + dedup
  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([lineCellKey(correctSet)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(lineCellKey(d.set))) {
      seen.add(lineCellKey(d.set));
      distractors.push(d);
    }
  }
  if (distractors.length < 3) return null;

  const distMeta = distractors.map(d => ({ set: toSortedArray(d.set), source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correctSet, distractors.map(d => d.set),
    `${subType}:${difficulty}`, rng, placer,
    lineCellToOpt, lineCellKey
  );

  const opLabel = { or: '聯集 (兩格的線都加進來)', and: '交集 (兩格都有的線才留)', xor: '對稱差 (兩格相同的消失,只有一格有的留)' }[op];
  return {
    id,
    ...baseMeta(TOPIC, difficulty, subType, [SKILL_CODE]),
    prompt: PROMPTS[subType],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `第 3 排前兩格是 ${setDesc(cellA)} 跟 ${setDesc(cellB)}。${opLabel}。`,
    explanation: `每一排前兩格用 <strong>${op.toUpperCase()}</strong>(${opLabel})得第三格。Row1: ${setDesc(rows[0].a)} ${op.toUpperCase()} ${setDesc(rows[0].b)} = ${setDesc(rows[0].c)}。Row2: ${setDesc(rows[1].a)} ${op.toUpperCase()} ${setDesc(rows[1].b)} = ${setDesc(rows[1].c)}。Row3: ${setDesc(cellA)} ${op.toUpperCase()} ${setDesc(cellB)} = <strong>${setDesc(correctSet)}</strong>。`,
    skill: SKILLS_ZH[subType],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solvers ───────────────────────────────────────────────────────────
function solverFor(op) {
  return (q) => {
    const cells = q.visual.cells;
    // Row 3 = idx 6, 7, 8. idx 8 is unknown.
    const a = new Set(cells[6].lines || []);
    const b = new Set(cells[7].lines || []);
    const expected = OP_FNS[op](a, b);
    const expectedKey = setKey(expected);
    return q.options.findIndex(o => {
      const optKey = (o.visual.lines || []).slice().sort((x, y) => ALL_LINES.indexOf(x) - ALL_LINES.indexOf(y)).join('|');
      return optKey === expectedKey;
    });
  };
}
export const solvers = {
  'logical-overlay-or':  solverFor('or'),
  'logical-overlay-and': solverFor('and'),
  'logical-overlay-xor': solverFor('xor')
};

// ─── alphabet pool by size ─────────────────────────────────────────────
// 為了 signature 唯一性,easy/mid/hard 都用整個 ALL_LINES 當 alphabet,
// 但 RNG subset 大小由 maxLines 控制(easy 平均 ~3 線,mid ~3 線,hard ~3 線)。
// 實際的關鍵變化:alphabet 子集大小 + (a, b) 配對 + row 三個的組合。

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  // sub, diff, op, target, baseSeed
  { sub: 'logical-overlay-or',  diff: 'easy', op: 'or',  target: 25, seed: 90001 },
  { sub: 'logical-overlay-and', diff: 'easy', op: 'and', target: 15, seed: 91001 },
  { sub: 'logical-overlay-and', diff: 'mid',  op: 'and', target: 50, seed: 92001 },
  { sub: 'logical-overlay-and', diff: 'hard', op: 'and', target: 10, seed: 93001 },
  { sub: 'logical-overlay-xor', diff: 'mid',  op: 'xor', target: 30, seed: 94001 },
  { sub: 'logical-overlay-xor', diff: 'hard', op: 'xor', target: 30, seed: 95001 }
];

// matrix ID 起點(after Phase 3): easy 108 (33+45+30), mid 163 (28+85+50), hard 88 (23+40+25)
const ID_START = { easy: 108, mid: 163, hard: 88 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const { sub, diff, op, target, seed: baseSeed } of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed, attempts = 0;
    while (made < target && attempts < target * 100) {
      const idNum = counter[diff] + made;
      const id = `matrix-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = genLogical(id, diff, sub, op, ALL_LINES, seed++, placer);
      attempts++;
      if (!q) continue;
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
    stats[`${sub}:${diff}`] = { target, made, attempts };
    if (made < target) console.warn(`⚠️  ${sub} (${diff}): only ${made}/${target} after ${attempts}`);
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
if (basename(process.argv[1] || '').includes('gen-matrix-logical')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-matrix-logical] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-matrix-logical] balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
