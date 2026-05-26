#!/usr/bin/env node
// tools/gen-multivar-orbit.mjs
// Batch +1000 — 3var-position-orbit (197 items)
//   easy 37 / mid 100 / hard 60
//
// 每 cell = 3 個彩色 dot 在圓周 (中心 25,25,半徑 12) 上 3 個固定位置:
//   pos0 = top (25, 13)
//   pos1 = bottom-right (35, 31)
//   pos2 = bottom-left (15, 31)
// 3 個 dot 顏色 (例 pink/teal/yellow) 永遠是這 3 種,但每 cell 的「位置分配」不同。
// rotation k (k ∈ {0,1,2}):cell 內 dot color 順序 = baseColors rotated by k。
// 矩陣規律:cell(r,c).rotation = (r*rowStep + c*colStep + base) % 3
//   (rowStep, colStep) ∈ {0,1,2}^2 with at least one non-zero
//
// 用 raw 字串 + composite 描述 cell 視覺(此題型已有 raw 前例,gen-sequence.mjs)。

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'multivar';
const SKILL_CODE = 'multivar-3var';
const SUB_TYPE = '3var-position-orbit';

const PROMPT = '3 個小圓繞中心轉,? 應該是哪個位置安排?';
const SKILL_ZH = '三元素旋轉位置';

const POSITIONS = [[25, 13], [35, 31], [15, 31]];
const COLOR_HEX = {
  pink: '#FF6B9D', teal: '#4ECDC4', yellow: '#FFD93D',
  purple: '#9B7EDE', orange: '#FF9F45', blue: '#5B9DEC'
};
const INK = '#2D2A4A';

// 旋轉 k → colors 順序:colors[(0+k)%3], colors[(1+k)%3], colors[(2+k)%3]
function placedColors(baseColors, k) {
  return [0, 1, 2].map(i => baseColors[(i + k) % 3]);
}

function cellSvg(baseColors, k) {
  const placed = placedColors(baseColors, k);
  let out = '';
  // light center mark
  out += `<circle cx="25" cy="25" r="1.5" fill="#CCC"/>`;
  for (let i = 0; i < 3; i++) {
    const [x, y] = POSITIONS[i];
    const c = COLOR_HEX[placed[i]] || '#FF6B9D';
    out += `<circle cx="${x}" cy="${y}" r="5.5" fill="${c}" stroke="${INK}" stroke-width="1.5"/>`;
  }
  return out;
}

function orbitDesc(c) {
  if (c.unknown) return '?';
  const placed = placedColors(c.baseColors, c.rotation);
  return `${placed.join('/')}`;
}

function orbitToOpt(c) {
  return {
    text: orbitDesc(c),
    visual: { type: 'raw-html', html: `<svg width="50" height="50" viewBox="0 0 50 50">${cellSvg(c.baseColors, c.rotation)}</svg>` }
  };
}

function orbitKey(c) {
  return `or-${c.baseColors.join('/')}-${c.rotation}`;
}

// ─── generator ─────────────────────────────────────────────────────────

function genOrbit(id, difficulty, seed, placer, opts) {
  const rng = makeRng(seed);
  const { baseColors, rowStep, colStep, base, missingIdx } = opts;

  const cellRotation = (r, c) => ((r * rowStep + c * colStep + base) % 3 + 3) % 3;

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (i === missingIdx) cells.push({ unknown: true });
      else cells.push({ raw: cellSvg(baseColors, cellRotation(r, c)) });
    }
  }

  const mr = Math.floor(missingIdx / 3), mc = missingIdx % 3;
  const correctRot = cellRotation(mr, mc);
  const correct = { baseColors, rotation: correctRot };

  const candidates = [];
  // D1 wrong rotation (one of the other 2 rotations)
  for (let k = 0; k < 3; k++) {
    if (k !== correctRot) candidates.push({ baseColors, rotation: k, _why: `wrong-rot-${k}` });
  }
  // D2 different base color order (swap 2 colors)
  if (baseColors.length === 3) {
    const swapped = [baseColors[1], baseColors[0], baseColors[2]];
    candidates.push({ baseColors: swapped, rotation: correctRot, _why: 'swap-colors-01' });
    const swapped2 = [baseColors[0], baseColors[2], baseColors[1]];
    candidates.push({ baseColors: swapped2, rotation: correctRot, _why: 'swap-colors-12' });
    const rev = [baseColors[2], baseColors[1], baseColors[0]];
    candidates.push({ baseColors: rev, rotation: correctRot, _why: 'reverse' });
  }
  // D3 axis-swap rule
  const swappedRot = ((mc * rowStep + mr * colStep + base) % 3 + 3) % 3;
  if (swappedRot !== correctRot) candidates.push({ baseColors, rotation: swappedRot, _why: 'axis-swap' });

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([orbitKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(orbitKey(d))) { seen.add(orbitKey(d)); distractors.push(d); }
  }
  // fallback
  if (distractors.length < 3) {
    for (let k = 0; k < 3 && distractors.length < 3; k++) {
      const cand = { baseColors, rotation: k, _why: 'fill-rot' };
      if (!seen.has(orbitKey(cand))) { seen.add(orbitKey(cand)); distractors.push(cand); }
    }
  }

  const distMeta = distractors.map(d => ({ colors: d.baseColors.join('/'), rot: d.rotation, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, `${SUB_TYPE}:${difficulty}`, rng, placer, orbitToOpt, orbitKey
  );

  return {
    id,
    ...baseMeta(TOPIC, difficulty, SUB_TYPE, [SKILL_CODE]),
    prompt: PROMPT,
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `3 個小圓的位置會按照規律旋轉。每往下一排轉 ${rowStep}×120° = ${rowStep*120}°,每往右一格轉 ${colStep}×120° = ${colStep*120}°。`,
    explanation: `公式:cell(r,c) 旋轉 = (r×${rowStep} + c×${colStep} + ${base}) mod 3。? 在 (${mr},${mc}),旋轉 = (${mr}×${rowStep} + ${mc}×${colStep} + ${base}) mod 3 = <strong>${correctRot}</strong>,對應 3 色順序 <strong>${placedColors(baseColors, correctRot).join('/')}</strong>。`,
    skill: SKILL_ZH,
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solver ────────────────────────────────────────────────────────────
// 從 visible cells 推導規律:抓 cells[0]、cells[1] (or any pair) 算 colStep,
// cells[0]、cells[3] 算 rowStep。但 unknown 可能落在這些 anchor 上,需要 robust 推導。
// 解法:從 raw SVG 中 parse 出 dot 顏色順序,推 rotation,再 fit (rowStep, colStep, base)。

const HEX_TO_COLOR = {};
for (const [k, v] of Object.entries(COLOR_HEX)) HEX_TO_COLOR[v.toLowerCase()] = k;

function parseCellRotation(raw, baseColors) {
  // raw 包含 3 個 <circle ...fill="#XXXXXX"> 對應 3 個固定位置。
  // 我們抓「pos0 (cx=25, cy=13)」的 fill 顏色,在 baseColors 中找索引,該索引 = k % 3 對應的 baseColors[k % 3]
  // 即 placed[0] = baseColors[k] → k = baseColors.indexOf(placed[0])
  const m = raw.match(/<circle cx="25" cy="13" r="5\.5" fill="([^"]+)"/);
  if (!m) return null;
  const hex = m[1].toLowerCase();
  const colorName = HEX_TO_COLOR[hex];
  if (!colorName) return null;
  return baseColors.indexOf(colorName);
}

function extractBaseColors(cells) {
  // baseColors 是 cell(0,0) 的 3 個 dot 顏色 (top, br, bl) — 即 placed when rotation k0=cells[0]'s rotation
  // 但我們不知 k0。最簡單:對每個 visible cell,抓 (pos0, pos1, pos2) 的 3 色,任 cell 的 3 色 set 都一樣 (= baseColors set)。
  // 找第一個 visible cell:
  for (const cell of cells) {
    if (cell.unknown) continue;
    if (!cell.raw) continue;
    const mAll = [...cell.raw.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="5\.5" fill="([^"]+)"/g)];
    if (mAll.length !== 3) continue;
    // map (cx, cy) → which position
    const placed = ['', '', ''];
    for (const m of mAll) {
      const cx = +m[1], cy = +m[2];
      let posIdx;
      if (cx === 25 && cy === 13) posIdx = 0;
      else if (cx === 35 && cy === 31) posIdx = 1;
      else if (cx === 15 && cy === 31) posIdx = 2;
      else continue;
      placed[posIdx] = HEX_TO_COLOR[m[3].toLowerCase()];
    }
    return placed;   // 這就是 cell 0,0 (或第一個 visible) 的 placed colors
  }
  return null;
}

export const solvers = {
  [SUB_TYPE]: (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;

    // 抓第一個 visible cell 的 placed colors 當「reference」(它的 rotation 視為 k_ref)
    // 然後對其他 visible cell,parse rotation,找出規律
    let refCell = null, refIdx = -1;
    for (let i = 0; i < 9; i++) {
      if (!cells[i].unknown && cells[i].raw) { refCell = cells[i]; refIdx = i; break; }
    }
    if (!refCell) return -1;

    // ref placed colors = baseColors rotated by k_ref → for solver purposes,
    // treat refCell as the new "base" with k_ref = 0
    const refPlaced = ['', '', ''];
    const mAll = [...refCell.raw.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="5\.5" fill="([^"]+)"/g)];
    for (const m of mAll) {
      const cx = +m[1], cy = +m[2];
      let posIdx;
      if (cx === 25 && cy === 13) posIdx = 0;
      else if (cx === 35 && cy === 31) posIdx = 1;
      else if (cx === 15 && cy === 31) posIdx = 2;
      else continue;
      refPlaced[posIdx] = HEX_TO_COLOR[m[3].toLowerCase()];
    }

    const refR = Math.floor(refIdx / 3), refC = refIdx % 3;

    // For each visible cell, compute its rotation relative to refPlaced
    // cell rotation k means cell.pos0 color = refPlaced[k]
    function rotOfCell(cellRaw) {
      const ma = [...cellRaw.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="5\.5" fill="([^"]+)"/g)];
      for (const m of ma) {
        const cx = +m[1], cy = +m[2];
        if (cx === 25 && cy === 13) {
          const cName = HEX_TO_COLOR[m[3].toLowerCase()];
          return refPlaced.indexOf(cName);
        }
      }
      return -1;
    }

    // Build {r, c, rot} for visible cells
    const observations = [];
    for (let i = 0; i < 9; i++) {
      if (cells[i].unknown) continue;
      const r = Math.floor(i / 3), c = i % 3;
      const rot = rotOfCell(cells[i].raw);
      if (rot < 0) return -1;
      observations.push({ r, c, rot });
    }

    // fit: rot = (r * rowStep + c * colStep + base) mod 3
    // try all (rowStep, colStep, base) ∈ {0,1,2}^3
    let solution = null;
    for (let rs = 0; rs < 3 && !solution; rs++) {
      for (let cs = 0; cs < 3 && !solution; cs++) {
        for (let b = 0; b < 3 && !solution; b++) {
          let ok = true;
          for (const o of observations) {
            const pred = ((o.r * rs + o.c * cs + b) % 3 + 3) % 3;
            if (pred !== o.rot) { ok = false; break; }
          }
          if (ok) solution = { rs, cs, b };
        }
      }
    }
    if (!solution) return -1;
    const expectedRot = ((mr * solution.rs + mc * solution.cs + solution.b) % 3 + 3) % 3;
    // expected pos0 color = refPlaced[expectedRot]
    const expectedPos0Color = refPlaced[expectedRot];
    // match against options
    for (let i = 0; i < q.options.length; i++) {
      const html = q.options[i].visual.html || '';
      const m = html.match(/<circle cx="25" cy="13" r="5\.5" fill="([^"]+)"/);
      if (!m) continue;
      const optColor = HEX_TO_COLOR[m[1].toLowerCase()];
      // also need: option's other 2 positions show refPlaced rotated correctly
      // For uniqueness, just check pos0 color + that base color set matches
      const allMatches = [...html.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="5\.5" fill="([^"]+)"/g)];
      if (allMatches.length !== 3) continue;
      const optPlaced = ['', '', ''];
      for (const am of allMatches) {
        const cx = +am[1], cy = +am[2];
        let posIdx;
        if (cx === 25 && cy === 13) posIdx = 0;
        else if (cx === 35 && cy === 31) posIdx = 1;
        else if (cx === 15 && cy === 31) posIdx = 2;
        else continue;
        optPlaced[posIdx] = HEX_TO_COLOR[am[3].toLowerCase()];
      }
      // expected placed = [refPlaced[(0+expectedRot)%3], refPlaced[(1+expectedRot)%3], refPlaced[(2+expectedRot)%3]]
      const expectedPlaced = [0, 1, 2].map(i => refPlaced[(i + expectedRot) % 3]);
      if (optPlaced[0] === expectedPlaced[0] && optPlaced[1] === expectedPlaced[1] && optPlaced[2] === expectedPlaced[2]) {
        return i;
      }
    }
    return -1;
  }
};

// ─── variant axes ──────────────────────────────────────────────────────

const COLOR_NAMES = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];

function* permsOf(arr, k) {
  if (k === 0) { yield []; return; }
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const t of permsOf(rest, k - 1)) yield [arr[i], ...t];
  }
}

function* axesOrbit(allowZeroStep) {
  // (rowStep, colStep) ∈ {0..2}^2 with at least one non-zero
  // base ∈ {0..2}
  // baseColors: pick 3 of 6 colors, permutated → 120 combos
  const colorPerms = [...permsOf(COLOR_NAMES, 3)];   // 120
  for (const cp of colorPerms) {
    for (let rs = 0; rs < 3; rs++) {
      for (let cs = 0; cs < 3; cs++) {
        if (!allowZeroStep && rs === 0 && cs === 0) continue;
        if (rs === 0 && cs === 0) continue;   // never useful
        for (let b = 0; b < 3; b++) {
          for (const mi of [8, 4, 0, 2, 6, 1, 3, 5, 7]) {
            yield { baseColors: cp, rowStep: rs, colStep: cs, base: b, missingIdx: mi };
          }
        }
      }
    }
  }
}

const RUNS = [
  { diff: 'easy', target: 37,  seed: 120001, allowZeroStep: false },
  { diff: 'mid',  target: 100, seed: 121001, allowZeroStep: false },
  { diff: 'hard', target: 60,  seed: 122001, allowZeroStep: false }
];

// multivar ID 起點 (after Phase 4 2var-ext):
//   easy 121 (58+63), mid 208 (88+120), hard 103 (48+55)
const ID_START = { easy: 121, mid: 208, hard: 103 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const { diff, target, seed: baseSeed, allowZeroStep } of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const gen = axesOrbit(allowZeroStep);
    const sample = [];
    for (const a of gen) {
      sample.push(a);
      if (sample.length >= target * 30) break;
    }
    const rng0 = makeRng(baseSeed);
    const shuffled = rngShuffle(rng0, sample);
    for (const opts of shuffled) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `multivar-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = genOrbit(id, diff, seed++, placer, opts);
      if (sigs.has(q.signature)) continue;
      const v = validateQuestion(q);
      if (!v.valid) { console.error(`❌ ${id} ${v.errors.join('; ')}`); continue; }
      sigs.add(q.signature);
      buckets[diff].push(q);
      made++;
    }
    counter[diff] += made;
    stats[`${SUB_TYPE}:${diff}`] = { target, made };
    if (made < target) console.warn(`⚠️  ${SUB_TYPE} (${diff}): ${made}/${target}`);
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
if (basename(process.argv[1] || '').includes('gen-multivar-orbit')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-multivar-orbit] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-multivar-orbit] balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
