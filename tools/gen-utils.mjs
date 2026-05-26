// tools/gen-utils.mjs
// 題庫生成器共用工具。中文敘述、shuffle、seeded random、describe option 等。

// ─── 中文名稱對照 ───
export const COLOR_ZH = {
  pink: '粉紅', teal: '藍綠', yellow: '黃', purple: '紫',
  orange: '橘', blue: '藍', white: '白'
};

export const SHAPE_ZH = {
  circle: '圓', square: '方', triangle: '三角',
  star: '星星', diamond: '菱形', hex: '六邊形',
  arrow: '箭頭', dots: '點點'
};

// 描述一個 single-shape:回傳 "粉紅圓" / "藍綠星星" / "黃三角"
export function describeShape(s) {
  const color = COLOR_ZH[s.color] || s.color;
  const shape = SHAPE_ZH[s.shape] || s.shape;
  const base = `${color}${shape}`;
  if (s.count && s.count > 1) return `${s.count} 個${base}`;
  return base;
}

// 用於選項 text 欄位
export function optionText(s) {
  return describeShape(s);
}

// ─── 顏色 / 形狀池 ───
export const COLOR_POOL = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];
export const SHAPE_POOL = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex'];

// ─── Seeded RNG (mulberry32) ───
// 用 seed 確保每次跑生成器產出相同結果,方便除錯與重現
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function rngShuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 從 pool 中抽 n 個不重複
export function rngPickN(rng, pool, n) {
  return rngShuffle(rng, pool).slice(0, n);
}

// ─── ID 生成 ───
export function idGen(topic, difficulty) {
  let counter = 0;
  return () => {
    counter += 1;
    return `${topic}-${difficulty}-${String(counter).padStart(3, '0')}`;
  };
}

// ─── 形狀相等比較 ───
export function shapeEq(a, b) {
  return a.shape === b.shape && a.color === b.color
    && (a.count || 1) === (b.count || 1)
    && (a.rotation || 0) === (b.rotation || 0);
}

// 把正解 + 干擾選項排序成 options 陣列,回傳 {options, answerIdx}
export function shuffleOptions(rng, correct, distractors) {
  const all = [correct, ...distractors];
  const shuffled = rngShuffle(rng, all);
  const answerIdx = shuffled.findIndex(o => shapeEq(o, correct));
  return { shuffled, answerIdx };
}

// ─── 通用 metadata ───
export const TODAY = new Date().toISOString().slice(0, 10);

export function baseMeta(topic, difficulty, sub_type, skill_codes, inspired_by) {
  return {
    topic,
    difficulty,
    sub_type,
    skill_codes,
    created_at: TODAY,
    author: 'claude-generated',
    ...(inspired_by ? { inspired_by } : {})
  };
}

// ─── Batch +1000 新增 ──────────────────────────────────────────────────

import { createHash } from 'node:crypto';

/** 把任意物件正規化:keys 排序、undefined 排除。回傳穩定 JSON 字串。 */
export function canonicalJson(obj) {
  function sortClone(o) {
    if (o === null || typeof o !== 'object') return o;
    if (Array.isArray(o)) return o.map(sortClone);
    const out = {};
    Object.keys(o).sort().forEach(k => {
      if (o[k] !== undefined) out[k] = sortClone(o[k]);
    });
    return out;
  }
  return JSON.stringify(sortClone(obj));
}

/** Cell 陣列或任意 visual params 的 signature (SHA-1 前 12 碼)。 */
export function signatureOf(obj) {
  return createHash('sha1').update(canonicalJson(obj)).digest('hex').slice(0, 12);
}

/** (sub_type, difficulty) 的 answer index 0-3 平衡放置器:每次回最少用的 bucket。 */
export class BalancedAnswerPlacer {
  constructor() { this.buckets = new Map(); }
  next(key, rng) {
    if (!this.buckets.has(key)) this.buckets.set(key, [0, 0, 0, 0]);
    const c = this.buckets.get(key);
    const minC = Math.min(...c);
    const cand = [0, 1, 2, 3].filter(i => c[i] === minC);
    const idx = cand[Math.floor(rng() * cand.length)];
    c[idx]++;
    return idx;
  }
  report() {
    const out = {};
    for (const [k, v] of this.buckets) out[k] = v.slice();
    return out;
  }
}

/** 把 correct + ≥3 distractor 放成 4 個 option;answerIdx 由 placer 決定平衡。
 *  uniqKey: cell → 字串 (de-dup);cellToOption: cell → {text, visual}。 */
export function placeOptionsBalanced(correct, distractors, key, rng, placer, cellToOption, uniqKey) {
  const all = [correct, ...distractors];
  const seen = new Set();
  const unique = [];
  for (const c of all) {
    const k = uniqKey(c);
    if (!seen.has(k)) { seen.add(k); unique.push(c); }
  }
  if (unique.length < 4) {
    throw new Error(`placeOptionsBalanced: ${unique.length}<4 unique opts. key=${key}, opts=${JSON.stringify(all)}`);
  }
  const correctIdx = placer.next(key, rng);
  const options = new Array(4);
  options[correctIdx] = cellToOption(unique[0]);
  const slots = [0, 1, 2, 3].filter(i => i !== correctIdx);
  const distOrder = rngShuffle(rng, [1, 2, 3]);
  slots.forEach((slot, j) => options[slot] = cellToOption(unique[distOrder[j]]));
  return { options, answerIdx: correctIdx };
}

/** matrix-3x3 cells:9 個,? 預設在 (2,2)=idx 8;可指定 missingIdx 0-8。 */
export function build3x3Cells(rowColFn, missingIdx = 8) {
  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      cells.push(i === missingIdx ? { unknown: true } : rowColFn(r, c));
    }
  }
  return cells;
}
