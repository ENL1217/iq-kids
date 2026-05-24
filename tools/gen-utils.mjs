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
