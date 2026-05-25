#!/usr/bin/env node
// tools/gen-multivar-direction-fill.mjs
// Batch +1000 — 2var-direction-fill (130 items)
//   easy 35 / mid 65 / hard 30
// 用 angle-v primitive。row 規律決定 orientation,col 規律決定 dots(或反之)。
// hard 加 spread_deg 第三軸變化(以「結構性」非裝飾性方式)。
//
// distractor:
//   D1 wrong-orientation (rotate to a wrong direction)
//   D2 wrong-dots (off-by-one or copy another col)
//   D3 axis-swap (用相反規律算)

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'multivar';
const SKILL_CODE = 'multivar-2var';
const SUB_TYPE = '2var-direction-fill';

const PROMPT = '橫向看方向、直向看點數(或反過來),? 是哪個?';
const SKILL_ZH = '方向+點數雙變數';

const ORIENTATIONS = ['up', 'down', 'left', 'right'];
const DOT_VALUES = [0, 1, 2, 3];

const ORIENT_ZH = { up: '開口朝上 V', down: '開口朝下 Λ', left: '開口朝左 >', right: '開口朝右 <' };

function avDesc(c) {
  if (c.unknown) return '?';
  return `${ORIENT_ZH[c.orientation]} ${c.dots}點`;
}
function avToOpt(c) {
  return {
    text: avDesc(c),
    visual: {
      type: 'angle-v',
      orientation: c.orientation,
      spread_deg: c.spread_deg || 60,
      dots: c.dots
    }
  };
}
function avKey(c) {
  return `av-${c.orientation}-${c.dots}-${c.spread_deg || 60}`;
}

// ─── 生成器 ────────────────────────────────────────────────────────────

function genDirFill(id, difficulty, seed, placer, opts) {
  const rng = makeRng(seed);
  const {
    rowOrients,    // 3 distinct from ORIENTATIONS (one per row)
    colDots,       // 3 distinct from DOT_VALUES (one per col)
    spread_deg,    // 30, 60, 90, 120
    rowDeterminesOrient,  // true → row=orient, col=dots; false → swap
    missingIdx
  } = opts;

  const cellAt = (r, c) => {
    const o = rowDeterminesOrient ? rowOrients[r] : rowOrients[c];
    const d = rowDeterminesOrient ? colDots[c] : colDots[r];
    return { type: 'angle-v', orientation: o, spread_deg, dots: d };
  };

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      cells.push(i === missingIdx ? { unknown: true } : cellAt(r, c));
    }
  }

  const mr = Math.floor(missingIdx / 3), mc = missingIdx % 3;
  const correctOrient = rowDeterminesOrient ? rowOrients[mr] : rowOrients[mc];
  const correctDots   = rowDeterminesOrient ? colDots[mc]    : colDots[mr];
  const correct = { orientation: correctOrient, dots: correctDots, spread_deg };

  const candidates = [];
  // D1 wrong-orientation: use a different orientation from the 3 in use
  for (const o of rowOrients) {
    if (o !== correctOrient) candidates.push({ orientation: o, dots: correctDots, spread_deg, _why: `wrong-orient-${o}` });
  }
  // D2 wrong-dots: use a different dots value
  for (const d of colDots) {
    if (d !== correctDots) candidates.push({ orientation: correctOrient, dots: d, spread_deg, _why: `wrong-dots-${d}` });
  }
  // D3 axis-swap: use opposite-axis rule (swap mr/mc roles)
  const swappedOrient = rowDeterminesOrient ? rowOrients[mc] : rowOrients[mr];
  const swappedDots   = rowDeterminesOrient ? colDots[mr]    : colDots[mc];
  if (swappedOrient !== correctOrient || swappedDots !== correctDots) {
    candidates.push({ orientation: swappedOrient, dots: swappedDots, spread_deg, _why: 'axis-swap' });
  }
  // D4 both wrong
  for (const o of rowOrients) {
    for (const d of colDots) {
      if (o !== correctOrient && d !== correctDots) {
        candidates.push({ orientation: o, dots: d, spread_deg, _why: `both-wrong-${o}-${d}` });
        break;
      }
    }
    if (candidates.some(c => c._why?.startsWith('both-wrong'))) break;
  }

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([avKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(avKey(d))) { seen.add(avKey(d)); distractors.push(d); }
  }
  // fallback: arbitrary unused (orient, dots) combos
  for (const o of ORIENTATIONS) {
    for (const d of DOT_VALUES) {
      if (distractors.length >= 3) break;
      const cand = { orientation: o, dots: d, spread_deg, _why: 'fill' };
      if (!seen.has(avKey(cand))) { seen.add(avKey(cand)); distractors.push(cand); }
    }
    if (distractors.length >= 3) break;
  }
  const distMeta = distractors.map(d => ({ o: d.orientation, dots: d.dots, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, `${SUB_TYPE}:${difficulty}`, rng, placer, avToOpt, avKey
  );

  const axisLabel = rowDeterminesOrient ? '橫向看方向,直向看點數' : '直向看方向,橫向看點數';
  return {
    id,
    ...baseMeta(TOPIC, difficulty, SUB_TYPE, [SKILL_CODE]),
    prompt: PROMPT,
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `${axisLabel}。? 在第 ${mr+1} 排第 ${mc+1} 行,該排是 ${ORIENT_ZH[correctOrient]},該行是 ${correctDots} 點。`,
    explanation: `<strong>${axisLabel}</strong>:每 ${rowDeterminesOrient ? '排' : '行'}固定一個方向(${rowOrients.map(o => ORIENT_ZH[o]).join('/')})、每 ${rowDeterminesOrient ? '行' : '排'}固定一個點數(${colDots.join('/')})。? = <strong>${ORIENT_ZH[correctOrient]} + ${correctDots} 點</strong>。`,
    skill: SKILL_ZH,
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solver ────────────────────────────────────────────────────────────

export const solvers = {
  [SUB_TYPE]: (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;
    // Determine which axis is orientation by checking row consistency
    // If all cells in row mr (excluding unknown) have same orientation → row=orient
    let rowOrient = null, allSameRow = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowOrient === null) rowOrient = cell.orientation;
      else if (cell.orientation !== rowOrient) { allSameRow = false; break; }
    }
    let colOrient = null, allSameCol = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colOrient === null) colOrient = cell.orientation;
      else if (cell.orientation !== colOrient) { allSameCol = false; break; }
    }
    // Also check dots
    let rowDots = null, allSameDotsRow = true;
    for (let c = 0; c < 3; c++) {
      const cell = cells[mr * 3 + c];
      if (cell.unknown) continue;
      if (rowDots === null) rowDots = cell.dots;
      else if (cell.dots !== rowDots) { allSameDotsRow = false; break; }
    }
    let colDots = null, allSameDotsCol = true;
    for (let r = 0; r < 3; r++) {
      const cell = cells[r * 3 + mc];
      if (cell.unknown) continue;
      if (colDots === null) colDots = cell.dots;
      else if (cell.dots !== colDots) { allSameDotsCol = false; break; }
    }

    let expectedOrient, expectedDots;
    if (allSameRow && allSameDotsCol) {
      // row=orient, col=dots
      expectedOrient = rowOrient;
      expectedDots = colDots;
    } else if (allSameCol && allSameDotsRow) {
      // col=orient, row=dots
      expectedOrient = colOrient;
      expectedDots = rowDots;
    } else {
      return -1;
    }
    return q.options.findIndex(o =>
      o.visual.orientation === expectedOrient && o.visual.dots === expectedDots
    );
  }
};

// ─── variant axes ──────────────────────────────────────────────────────

function* perms(arr, k) {
  if (k === 0) { yield []; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const tail of perms(rest, k - 1)) yield [arr[i], ...tail];
  }
}

function* allAxes(includeSpread) {
  const SPREADS = includeSpread ? [30, 60, 90, 120] : [60];
  const orientPerms = [...perms(ORIENTATIONS, 3)];   // 24
  const dotsPerms = [...perms(DOT_VALUES, 3)];       // 24
  for (const sp of SPREADS) {
    for (const ro of orientPerms) {
      for (const cd of dotsPerms) {
        for (const rdo of [true, false]) {
          for (const mi of [8, 4, 0, 2, 6, 1, 3, 5, 7]) {
            yield { rowOrients: ro, colDots: cd, spread_deg: sp,
                    rowDeterminesOrient: rdo, missingIdx: mi };
          }
        }
      }
    }
  }
}

const RUNS = [
  { diff: 'easy', target: 35, seed: 80001, includeSpread: false },
  { diff: 'mid',  target: 65, seed: 81001, includeSpread: false },
  { diff: 'hard', target: 30, seed: 82001, includeSpread: true  }   // hard 加 spread 變化
];

// multivar ID 起點:easy 23, mid 23, hard 18
const ID_START = { easy: 23, mid: 23, hard: 18 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const { diff, target, seed: baseSeed, includeSpread } of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const axisList = [...allAxes(includeSpread)];
    const rng0 = makeRng(baseSeed);
    const shuffled = rngShuffle(rng0, axisList);
    for (const opts of shuffled) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `multivar-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = genDirFill(id, diff, seed++, placer, opts);
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
    stats[`${SUB_TYPE}:${diff}`] = { target, made };
    if (made < target) console.warn(`⚠️  ${SUB_TYPE} (${diff}): only ${made}/${target}`);
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
if (basename(process.argv[1] || '').includes('gen-multivar-direction-fill')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-multivar-direction-fill] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-multivar-direction-fill] balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
