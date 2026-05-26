#!/usr/bin/env node
// tools/gen-matrix-rotation-cont.mjs
// Batch +1000 — 連續旋轉角度 (clock-hand cell.type)
// 3 個 sub_type 共 105 題:
//   clockwise-row-step  easy 30  9 cells row-major arithmetic: angle = base + (3r+c)*step
//   clockwise-col-step  mid  50  9 cells col-major: angle = base + (3c+r)*step
//   dual-axis-rotation  hard 25  angle = base + r*row_step + c*col_step (both non-zero)
//
// distractor (per spec C.2):
//   D1 adjacent-off ±1 step
//   D2 structural-error (repeat-visible / reset-to-start)
//   D3 reverse (倒退 same step) or length-wrong (hard)

import { writeQuestion, validateQuestion } from './lib.mjs';
import {
  baseMeta, makeRng, rngShuffle, signatureOf, BalancedAnswerPlacer, placeOptionsBalanced
} from './gen-utils.mjs';

const TOPIC = 'matrix';
const SKILL_CODE = 'pattern-continuous-rotation';

const PROMPTS = {
  'clockwise-row-step':  '橫向看每格指針轉的角度,? 指向哪邊?',
  'clockwise-col-step':  '直向看每格指針轉的角度,? 指向哪邊?',
  'dual-axis-rotation':  '橫向跟直向指針都在轉,? 指向哪邊?'
};

const SKILLS_ZH = {
  'clockwise-row-step':  '橫向連續角度',
  'clockwise-col-step':  '直向連續角度',
  'dual-axis-rotation':  '雙軸角度等差'
};

const angleLabel = (a) => {
  const dirs = { 0: '↑', 30: '↑↗', 45: '↗', 60: '↗→', 90: '→', 120: '→↘', 135: '↘', 150: '↘↓',
                 180: '↓', 210: '↓↙', 225: '↙', 240: '↙←', 270: '←', 300: '←↖', 315: '↖', 330: '↖↑' };
  return dirs[a] || `${a}°`;
};

function clockDesc(c) {
  if (c.unknown) return '?';
  const len = c.length_ratio === 0.4 ? '短' : '長';
  return `${len}指針 ${c.angle_deg}° ${angleLabel(c.angle_deg)}`;
}

function clockToOpt(c) {
  return {
    text: clockDesc(c),
    visual: {
      type: 'clock-hand',
      angle_deg: c.angle_deg,
      length_ratio: c.length_ratio || 0.7
    }
  };
}

function clockKey(c) {
  return `cl-${c.angle_deg}-${c.length_ratio || 0.7}`;
}

// ─── easy: row-major progression ───────────────────────────────────────

function genRowStep(id, seed, placer, opts = {}) {
  const rng = makeRng(seed);
  const step = opts.step;
  const base = opts.base;
  const len = 0.7;
  // cells[r][c] = (base + (3r + c) * step) % 360
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 2 && c === 2) cells.push({ unknown: true });
      else cells.push({ type: 'clock-hand', angle_deg: (base + (3 * r + c) * step) % 360, length_ratio: len });
    }
  }
  const correctAngle = (base + 8 * step) % 360;
  const correct = { angle_deg: correctAngle, length_ratio: len };

  const candidates = [];
  // D1 adjacent-off
  candidates.push({ angle_deg: (correctAngle + step) % 360, length_ratio: len, _why: 'one-step-extra' });
  candidates.push({ angle_deg: (correctAngle - step + 360) % 360, length_ratio: len, _why: 'one-step-short' });
  // D2 structural: repeat-visible (use cell 7 angle)
  const visAngle7 = (base + 7 * step) % 360;
  candidates.push({ angle_deg: visAngle7, length_ratio: len, _why: 'repeat-visible-cell7' });
  // D2 alt: reset-to-start (back to base)
  if (base !== correctAngle) candidates.push({ angle_deg: base, length_ratio: len, _why: 'reset-to-start' });
  // D3 reverse direction
  const revAngle = (base - 8 * step + 720) % 360;
  if (revAngle !== correctAngle) candidates.push({ angle_deg: revAngle, length_ratio: len, _why: 'reverse-direction' });

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([clockKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  // fallback fill with arbitrary distinct angle
  for (let i = 1; distractors.length < 3 && i < 12; i++) {
    const d = { angle_deg: (correctAngle + i * 30) % 360, length_ratio: len, _why: 'fill' };
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ angle: d.angle_deg, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'clockwise-row-step:easy', rng, placer, clockToOpt, clockKey
  );

  return {
    id,
    ...baseMeta(TOPIC, 'easy', 'clockwise-row-step', [SKILL_CODE]),
    prompt: PROMPTS['clockwise-row-step'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `每格的指針都比上一格再轉 ${step}°,從左到右、再往下繼續。`,
    explanation: `9 個格子按 row-major 順序,每格<strong>順時針轉 ${step}°</strong>:第 1 格 ${base}°,第 9 格 = ${base}° + 8×${step}° = <strong>${correctAngle}°</strong>(${angleLabel(correctAngle)})。`,
    skill: SKILLS_ZH['clockwise-row-step'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── mid: col-major progression + 可變 missingIdx ───────────────────────

function genColStep(id, seed, placer, opts = {}) {
  const rng = makeRng(seed);
  const step = opts.step;
  const base = opts.base;
  const missingIdx = opts.missingIdx;
  const len = 0.7;
  // cells[r][c] = (base + (3c + r) * step) % 360
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      if (i === missingIdx) cells.push({ unknown: true });
      else cells.push({ type: 'clock-hand', angle_deg: (base + (3 * c + r) * step) % 360, length_ratio: len });
    }
  }
  const mr = Math.floor(missingIdx / 3), mc = missingIdx % 3;
  const correctAngle = (base + (3 * mc + mr) * step) % 360;
  const correct = { angle_deg: correctAngle, length_ratio: len };

  const candidates = [];
  candidates.push({ angle_deg: (correctAngle + step) % 360, length_ratio: len, _why: 'one-step-extra' });
  candidates.push({ angle_deg: (correctAngle - step + 360) % 360, length_ratio: len, _why: 'one-step-short' });
  // repeat-visible: pick any other cell's angle
  for (let i = 0; i < 9; i++) {
    if (i === missingIdx) continue;
    const ri = Math.floor(i / 3), ci = i % 3;
    const ang = (base + (3 * ci + ri) * step) % 360;
    if (ang !== correctAngle) { candidates.push({ angle_deg: ang, length_ratio: len, _why: `repeat-visible-${i}` }); break; }
  }
  candidates.push({ angle_deg: base, length_ratio: len, _why: 'reset-to-start' });
  // wrong-direction: use row-step formula instead of col-step
  const wrongRowStepAngle = (base + (3 * mr + mc) * step) % 360;
  if (wrongRowStepAngle !== correctAngle) candidates.push({ angle_deg: wrongRowStepAngle, length_ratio: len, _why: 'wrong-axis-row' });

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([clockKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  for (let i = 1; distractors.length < 3 && i < 12; i++) {
    const d = { angle_deg: (correctAngle + i * 30) % 360, length_ratio: len, _why: 'fill' };
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ angle: d.angle_deg, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'clockwise-col-step:mid', rng, placer, clockToOpt, clockKey
  );

  return {
    id,
    ...baseMeta(TOPIC, 'mid', 'clockwise-col-step', [SKILL_CODE]),
    prompt: PROMPTS['clockwise-col-step'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `這次是<strong>直向</strong>看:每往下一格指針轉 ${step}°,每換一列也轉 ${step}°(但走 column 順序)。`,
    explanation: `9 個格子按 column-major 順序,每格<strong>順時針轉 ${step}°</strong>:? 在第 ${mr+1} 排第 ${mc+1} 行,對應序號 ${3*mc + mr},角度 = ${base}° + ${3*mc + mr}×${step}° = <strong>${correctAngle}°</strong>(${angleLabel(correctAngle)})。`,
    skill: SKILLS_ZH['clockwise-col-step'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── hard: dual-axis with optional length variation ────────────────────

function genDualAxis(id, seed, placer, opts = {}) {
  const rng = makeRng(seed);
  const rowStep = opts.rowStep;
  const colStep = opts.colStep;
  const base = opts.base;
  const lengthPattern = opts.lengthPattern;   // 'all-long', 'by-row', 'by-col'
  const lenForCell = (r, c) => {
    if (lengthPattern === 'by-row') return r % 2 === 0 ? 0.7 : 0.4;
    if (lengthPattern === 'by-col') return c % 2 === 0 ? 0.7 : 0.4;
    return 0.7;
  };

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (r === 2 && c === 2) cells.push({ unknown: true });
      else cells.push({
        type: 'clock-hand',
        angle_deg: (base + r * rowStep + c * colStep) % 360,
        length_ratio: lenForCell(r, c)
      });
    }
  }
  const correctAngle = (base + 2 * rowStep + 2 * colStep) % 360;
  const correctLen = lenForCell(2, 2);
  const correct = { angle_deg: correctAngle, length_ratio: correctLen };

  const candidates = [];
  // D1 adjacent-off (角度 ±rowStep or ±colStep)
  candidates.push({ angle_deg: (correctAngle + rowStep) % 360, length_ratio: correctLen, _why: 'one-row-extra' });
  candidates.push({ angle_deg: (correctAngle - colStep + 360) % 360, length_ratio: correctLen, _why: 'one-col-short' });
  // D2 length-wrong (hard-only二屬性錯)
  if (lengthPattern !== 'all-long') {
    const wrongLen = correctLen === 0.7 ? 0.4 : 0.7;
    candidates.push({ angle_deg: correctAngle, length_ratio: wrongLen, _why: 'length-wrong' });
  }
  // D2 alt: swap row/col contributions
  const swappedAngle = (base + 2 * colStep + 2 * rowStep) % 360;   // same total; not useful
  // use mixed-up wrong-axis: just row contribution
  const onlyRow = (base + 2 * rowStep) % 360;
  if (onlyRow !== correctAngle) candidates.push({ angle_deg: onlyRow, length_ratio: correctLen, _why: 'only-row' });
  const onlyCol = (base + 2 * colStep) % 360;
  if (onlyCol !== correctAngle && onlyCol !== onlyRow) candidates.push({ angle_deg: onlyCol, length_ratio: correctLen, _why: 'only-col' });
  // D3 reverse
  const revAngle = (base - 2 * rowStep - 2 * colStep + 720) % 360;
  if (revAngle !== correctAngle) candidates.push({ angle_deg: revAngle, length_ratio: correctLen, _why: 'reverse' });
  // repeat-visible
  candidates.push({ angle_deg: (base + 1 * rowStep + 1 * colStep) % 360, length_ratio: correctLen, _why: 'repeat-cell-1-1' });

  const shuf = rngShuffle(rng, candidates);
  const seen = new Set([clockKey(correct)]);
  const distractors = [];
  for (const d of shuf) {
    if (distractors.length >= 3) break;
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  for (let i = 1; distractors.length < 3 && i < 12; i++) {
    const d = { angle_deg: (correctAngle + i * 30) % 360, length_ratio: correctLen, _why: 'fill' };
    if (!seen.has(clockKey(d))) { seen.add(clockKey(d)); distractors.push(d); }
  }
  const distMeta = distractors.map(d => ({ angle: d.angle_deg, length: d.length_ratio, source: d._why }));
  const { options, answerIdx } = placeOptionsBalanced(
    correct, distractors, 'dual-axis-rotation:hard', rng, placer, clockToOpt, clockKey
  );

  const lenNote = lengthPattern !== 'all-long' ? `;指針長短也跟著 ${lengthPattern === 'by-row' ? '排' : '行'}變` : '';
  return {
    id,
    ...baseMeta(TOPIC, 'hard', 'dual-axis-rotation', [SKILL_CODE]),
    prompt: PROMPTS['dual-axis-rotation'],
    visual: { type: 'matrix-3x3', cells },
    options, answer: answerIdx,
    hint: `橫向每格 +${colStep}°,直向每排 +${rowStep}°${lenNote}。右下角 = ?`,
    explanation: `公式:angle = ${base}° + r × ${rowStep}° + c × ${colStep}°。右下角 r=2, c=2:angle = ${base}° + 2×${rowStep}° + 2×${colStep}° = <strong>${correctAngle}°</strong>(${angleLabel(correctAngle)})${lengthPattern !== 'all-long' ? `,長度 = ${correctLen}` : ''}。`,
    skill: SKILLS_ZH['dual-axis-rotation'],
    distractor_meta: distMeta,
    signature: signatureOf(cells)
  };
}

// ─── solvers ───────────────────────────────────────────────────────────
export const solvers = {
  'clockwise-row-step': (q) => {
    const cells = q.visual.cells;
    // base = cells[0].angle_deg; step = cells[1].angle - cells[0].angle (mod 360)
    const c0 = cells[0].angle_deg, c1 = cells[1].angle_deg;
    const step = ((c1 - c0) % 360 + 360) % 360;
    const expected = (c0 + 8 * step) % 360;
    return q.options.findIndex(o => o.visual.angle_deg === expected);
  },
  'clockwise-col-step': (q) => {
    const cells = q.visual.cells;
    const idx = cells.findIndex(c => c.unknown);
    const mr = Math.floor(idx / 3), mc = idx % 3;
    // rule: angle(r,c) = base + (3c + r) * step;  fit base/step from any visible pair
    const visible = [];
    for (let i = 0; i < 9; i++) {
      if (cells[i].unknown) continue;
      const r = Math.floor(i / 3), c = i % 3;
      visible.push({ k: 3 * c + r, angle: cells[i].angle_deg });
    }
    let step = null, base = null;
    outer:
    for (let a = 0; a < visible.length; a++) {
      for (let b = a + 1; b < visible.length; b++) {
        const dk = visible[b].k - visible[a].k;
        if (dk === 0) continue;
        for (let wrap = 0; wrap <= 2; wrap++) {
          const numer = ((visible[b].angle - visible[a].angle) % 360 + 360) % 360 + 360 * wrap;
          if (numer % dk !== 0) continue;
          const cand = numer / dk;
          if (cand <= 0 || cand > 180) continue;
          const candBase = ((visible[a].angle - visible[a].k * cand) % 360 + 360) % 360;
          // verify against all visible
          let ok = true;
          for (const v of visible) {
            const exp = ((candBase + v.k * cand) % 360 + 360) % 360;
            if (exp !== v.angle) { ok = false; break; }
          }
          if (ok) { step = cand; base = candBase; break outer; }
        }
      }
    }
    if (step === null) return -1;
    const expected = ((base + (3 * mc + mr) * step) % 360 + 360) % 360;
    return q.options.findIndex(o => o.visual.angle_deg === expected);
  },
  'dual-axis-rotation': (q) => {
    const cells = q.visual.cells;
    // base = cells[0,0] = cells[0].angle_deg
    const base = cells[0].angle_deg;
    // colStep = cells[0,1] - base = cells[1].angle_deg - base
    const colStep = ((cells[1].angle_deg - base) % 360 + 360) % 360;
    // rowStep = cells[1,0] - base = cells[3].angle_deg - base
    const rowStep = ((cells[3].angle_deg - base) % 360 + 360) % 360;
    const expected = (base + 2 * rowStep + 2 * colStep) % 360;
    // Also match length
    const expectedLen = cells[8] && cells[8].unknown ? null : null;
    // determine expected length: same as cells[2,2] would be — derive from pattern
    // cells[0].length and cells[2].length define by-row pattern (row 0)
    const l00 = cells[0].length_ratio, l01 = cells[1].length_ratio, l02 = cells[2].length_ratio;
    const l10 = cells[3].length_ratio, l20 = cells[6].length_ratio;
    let len = 0.7;
    if (l00 === l01 && l01 === l02 && l00 !== l10) {
      // by-row pattern: row 2 same as row 0 (r=0 even, r=2 even → same)
      len = l00;
    } else if (l00 === l10 && l10 === l20 && l00 !== l01) {
      // by-col pattern: col 2 same as col 0 (c=0 even, c=2 even → same)
      len = l00;
    } else if (l00 === l01 && l01 === l02 && l00 === l10) {
      // all same
      len = l00;
    } else {
      len = l00;   // best guess
    }
    return q.options.findIndex(o => o.visual.angle_deg === expected && (o.visual.length_ratio || 0.7) === len);
  }
};

// ─── variant axes ───────────────────────────────────────────────────────

function* easyAxes() {
  const STEPS = [30, 45, 60];
  for (const step of STEPS) {
    for (let b = 0; b < 360; b += 30) yield { step, base: b };
  }
}

function* midAxes() {
  const STEPS = [30, 45, 60];
  for (const step of STEPS) {
    for (let b = 0; b < 360; b += 30) {
      for (const missingIdx of [8, 4, 0, 2, 6, 1, 3, 5, 7]) {
        yield { step, base: b, missingIdx };
      }
    }
  }
}

function* hardAxes() {
  const STEPS = [30, 45, 60, 90];
  const PATTERNS = ['all-long', 'by-row', 'by-col'];
  for (const rowStep of STEPS) {
    for (const colStep of STEPS) {
      for (let b = 0; b < 360; b += 60) {
        for (const lp of PATTERNS) yield { rowStep, colStep, base: b, lengthPattern: lp };
      }
    }
  }
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const RUNS = [
  { sub: 'clockwise-row-step', diff: 'easy', target: 30, fn: genRowStep,   axes: easyAxes, seed: 70001 },
  { sub: 'clockwise-col-step', diff: 'mid',  target: 50, fn: genColStep,   axes: midAxes,  seed: 71001 },
  { sub: 'dual-axis-rotation', diff: 'hard', target: 25, fn: genDualAxis,  axes: hardAxes, seed: 72001 }
];

// ID 起點:matrix-easy 78 (33+45), matrix-mid 113 (28+85), matrix-hard 63 (23+40)
const ID_START = { easy: 78, mid: 113, hard: 63 };
const placer = new BalancedAnswerPlacer();

export async function generate({ idStart = ID_START, write = true } = {}) {
  const buckets = { easy: [], mid: [], hard: [] };
  const counter = { ...idStart };
  const stats = {};

  for (const { sub, diff, target, fn, axes, seed: baseSeed } of RUNS) {
    const sigs = new Set();
    let made = 0, seed = baseSeed;
    const axisList = [...axes()];
    const rng0 = makeRng(baseSeed);
    const shuffled = rngShuffle(rng0, axisList);
    for (const opts of shuffled) {
      if (made >= target) break;
      const idNum = counter[diff] + made;
      const id = `matrix-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = fn(id, seed++, placer, opts);
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
    if (made < target) console.warn(`⚠️  ${sub} (${diff}): only ${made}/${target}`);
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
if (basename(process.argv[1] || '').includes('gen-matrix-rotation-cont')) {
  generate().then(({ stats, balance }) => {
    console.log('[gen-matrix-rotation-cont] stats:', JSON.stringify(stats, null, 2));
    console.log('[gen-matrix-rotation-cont] balance:', JSON.stringify(balance, null, 2));
  }).catch(e => { console.error(e); process.exit(1); });
}
