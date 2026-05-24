#!/usr/bin/env node
// tools/gen-spatial.mjs
// 「空間能力」題型,55 題 ── 全部用 cubeStack visual.type
// (cubeNet 跟 foldedPaper 是 reviewer 警告的「未完全驗證」/「stub」區,本批不用)
//
// 3 個 sub_type:
//   - cube-counting-flat (easy): 平鋪或簡單堆,3-7 塊,無遮擋
//   - cube-counting-stacked (mid): 2-3 層,7-12 塊,可能有遮擋
//   - volume-arithmetic (hard): 「N×N×N 還缺幾塊」

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle } from './gen-utils.mjs';

const TOPIC = 'spatial';

const PROMPTS = {
  'cube-counting-flat':     '下面這堆積木,總共有幾塊?',
  'cube-counting-stacked':  '下面這堆積木,總共有幾塊?(包括看不到、被擋住的)',
  'volume-arithmetic':      '要堆成下面寫的大立方體,目前堆好的部分,還缺幾塊才能堆滿?'
};

function makeQ(id, difficulty, sub_type, skill_code, skillZh, layout, size, correct, distractorCounts, hint, explanation, promptOverride) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  // 去重 + 確保有 4 個 distinct
  const all = [correct, ...distractorCounts];
  const seen = new Set();
  const unique = [];
  for (const n of all) {
    if (!seen.has(n)) { seen.add(n); unique.push(n); }
  }
  if (unique.length < 4) {
    throw new Error(`spatial: ${unique.length} unique opts for ${id}, opts=${all}`);
  }
  const seed = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const options = shuffled.map(n => ({ text: `${n} 塊` }));
  const answerIdx = shuffled.indexOf(correct);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: promptOverride || PROMPTS[sub_type],
    visual: { type: 'cubeStack', layout, size },
    options,
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// 計算 layout 中 1 的總數
function countCubes(layout) {
  let n = 0;
  const walk = (a) => {
    if (Array.isArray(a)) a.forEach(walk);
    else n += a === 1 ? 1 : 0;
  };
  walk(layout);
  return n;
}

// ─── EASY (20) ────────────────────────────────────────────────────────
// 預先寫好 20 個 layout (3-7 塊,無遮擋)
const EASY_LAYOUTS = [
  // 1-layer 簡單排列
  { layout: [[[1, 1, 1]]],                          desc: '一排 3 塊' },
  { layout: [[[1, 1, 1, 1]]],                       desc: '一排 4 塊' },
  { layout: [[[1, 1]]],                             desc: '一排 2 塊' },
  { layout: [[[1, 1], [1, 1]]],                     desc: '2×2 共 4 塊' },
  { layout: [[[1, 0], [1, 1]]],                     desc: 'L 形 3 塊' },
  { layout: [[[1, 1], [1, 0]]],                     desc: 'L 形 3 塊 (另一向)' },
  { layout: [[[1, 1, 1], [1, 0, 0]]],               desc: 'L 形 4 塊' },
  { layout: [[[1, 1, 1], [0, 1, 0]]],               desc: 'T 形 4 塊' },
  { layout: [[[0, 1, 0], [1, 1, 1]]],               desc: 'T 形 4 塊倒過來' },
  { layout: [[[1, 0, 1], [1, 1, 1]]],               desc: '凹 5 塊' },
  // 2-layer 無遮擋 (上層全在下層格子之上)
  { layout: [[[1, 1, 1]], [[0, 0, 1]]],             desc: '底 3 + 頂 1 階梯' },
  { layout: [[[1, 1, 1]], [[1, 0, 0]]],             desc: '底 3 + 頂 1 階梯左' },
  { layout: [[[1, 1, 1]], [[0, 1, 0]]],             desc: '底 3 + 頂 1 中間' },
  { layout: [[[1, 1]], [[1, 1]]],                   desc: '兩層 2×1 共 4 塊' },
  { layout: [[[1, 1, 1]], [[1, 1, 0]]],             desc: '底 3 + 頂 2' },
  { layout: [[[1, 1]], [[1, 0]]],                   desc: '底 2 + 頂 1' },
  { layout: [[[1, 1, 1, 1]], [[0, 0, 1, 1]]],       desc: '底 4 + 頂 2 階梯' },
  { layout: [[[1, 1]], [[1, 1]], [[1, 0]]],         desc: '三層階梯 5 塊' },
  { layout: [[[1, 1, 1]], [[1, 1, 1]]],             desc: '兩層 1×3 共 6 塊' },
  { layout: [[[1, 1, 1, 1]], [[1, 0, 0, 0]]],       desc: '底 4 + 頂 1' }
];

function genEasy(id, index) {
  const { layout, desc } = EASY_LAYOUTS[index];
  const correct = countCubes(layout);
  // distractor: ±1, ±2, 2倍 (取不重複前 3 個)
  const candidates = [correct - 1, correct + 1, correct - 2, correct + 2, correct * 2, Math.max(1, correct - 3)];
  const distractors = [];
  const used = new Set([correct]);
  for (const c of candidates) {
    if (c >= 1 && !used.has(c) && distractors.length < 3) {
      distractors.push(c);
      used.add(c);
    }
  }
  return makeQ(id, 'easy', 'cube-counting-flat', 'spatial-cube-counting', '立體方塊計數',
    layout, 28, correct, distractors,
    `仔細數每一塊。提示:${desc}。`,
    `這堆積木是「${desc}」,合計 <strong>${correct} 塊</strong>。`
  );
}

// ─── MID (20) ─────────────────────────────────────────────────────────
// 2-3 層,7-12 塊,有些位置在後方/底層被前面方塊遮擋
const MID_LAYOUTS = [
  // 3-layer 階梯
  { layout: [[[1, 1, 1]], [[1, 1, 0]], [[1, 0, 0]]],           desc: '3 層階梯' },
  { layout: [[[1, 1, 1, 1]], [[1, 1, 1, 0]], [[1, 1, 0, 0]]],  desc: '3 層長階梯' },
  { layout: [[[1, 1], [1, 1]], [[1, 1], [1, 1]]],              desc: '2 層 2×2 共 8 塊' },
  { layout: [[[1, 1, 1], [1, 1, 1]], [[0, 1, 0], [0, 1, 0]]],  desc: '底 6 + 頂 2 (中間 2 列)' },
  { layout: [[[1, 1, 1], [1, 1, 1]], [[1, 1, 1], [0, 0, 0]]],  desc: '底 6 + 頂前排 3 (後排被前排擋一部分)' },
  { layout: [[[1, 1, 1], [1, 1, 1], [1, 1, 1]]],               desc: '3×3 共 9 塊 (平面但要數仔細)' },
  { layout: [[[1, 1], [1, 1]], [[1, 0], [0, 1]]],              desc: '2 層 2×2 + 對角頂 2' },
  { layout: [[[1, 1, 1]], [[1, 1, 1]], [[1, 1, 1]]],           desc: '3 層 1×3 = 9 塊' },
  { layout: [[[1, 1], [1, 1]], [[1, 1], [1, 0]]],              desc: '底 4 + 上 3' },
  { layout: [[[1, 1, 1, 1]], [[1, 1, 1, 1]]],                  desc: '2 層 1×4 = 8 塊' },
  { layout: [[[1, 1, 1]], [[1, 1, 1]], [[1, 1, 0]]],           desc: '3 層遞減 (3+3+2)' },
  { layout: [[[1, 1, 1, 1]], [[0, 1, 1, 0]], [[0, 0, 1, 0]]],  desc: '3 層金字塔' },
  { layout: [[[1, 1, 1], [1, 1, 1]], [[1, 1, 1], [1, 1, 1]]],  desc: '2 層 2×3 = 12 塊' },
  { layout: [[[1, 1, 1]], [[1, 0, 1]], [[1, 0, 1]]],           desc: '3 層 ㄇ 字' },
  { layout: [[[1, 1, 1], [1, 1, 1]]],                          desc: '1 層 2×3 = 6 塊' },
  { layout: [[[1, 1, 1]], [[1, 1, 0]]],                        desc: '2 層階梯 5 塊' },
  { layout: [[[1, 1], [1, 1]], [[1, 1], [0, 1]]],              desc: '2×2 底 + 3 個頂' },
  { layout: [[[1, 1, 1, 1], [1, 1, 1, 1]]],                    desc: '1 層 2×4 = 8 塊' },
  { layout: [[[1, 1, 1]], [[1, 1, 1]], [[1, 1, 0]], [[1, 0, 0]]], desc: '4 層階梯 (3+3+2+1=9)' },
  { layout: [[[1, 1, 1, 1]], [[1, 1, 0, 0]], [[1, 0, 0, 0]]],  desc: '3 層遞減 (4+2+1=7)' }
];

function genMid(id, index) {
  const { layout, desc } = MID_LAYOUTS[index];
  const correct = countCubes(layout);
  const candidates = [correct - 1, correct + 1, correct - 2, correct + 2, correct - 3, correct + 3];
  const distractors = [];
  const used = new Set([correct]);
  for (const c of candidates) {
    if (c >= 1 && !used.has(c) && distractors.length < 3) {
      distractors.push(c);
      used.add(c);
    }
  }
  return makeQ(id, 'mid', 'cube-counting-stacked', 'spatial-cube-counting', '立體方塊計數 (含遮擋)',
    layout, 24, correct, distractors,
    `這堆形狀是「${desc}」。記得也要算被擋住、看不到的方塊。`,
    `這堆是「${desc}」,合計 <strong>${correct} 塊</strong>。<strong>有些在後排或底層的方塊會被前面擋住,但還是要算進去。</strong>`
  );
}

// ─── HARD (15) ────────────────────────────────────────────────────────
// volume-arithmetic: 目標 N×N×N,現有部分,還缺幾塊?
// 15 題:N=3 (5 題), N=4 (5 題), N=5 (5 題);每題現有部分不同

function genHard(id, N, layerCount) {
  // layout: layerCount 個 N×N 完整層 (代表「已堆好底下幾層」)
  const layout = [];
  for (let z = 0; z < layerCount; z++) {
    const layer = [];
    for (let y = 0; y < N; y++) {
      layer.push(Array(N).fill(1));
    }
    layout.push(layer);
  }
  const target = N * N * N;
  const have = N * N * layerCount;
  const need = target - have;

  // distractors:
  //  D1: target (忘了減已堆好的)
  //  D2: have (倒減)
  //  D3: N*N (誤用單層)
  const D1 = target;
  const D2 = have;
  const D3 = N * N;
  // ensure unique
  const candidates = [D1, D2, D3, need + 1, need - 1, need + N];
  const distractors = [];
  const used = new Set([need]);
  for (const c of candidates) {
    if (c >= 1 && !used.has(c) && distractors.length < 3) {
      distractors.push(c);
      used.add(c);
    }
  }
  return makeQ(id, 'hard', 'volume-arithmetic', 'spatial-volume-arithmetic', '立體乘法 (還缺幾塊)',
    layout, N === 5 ? 16 : N === 4 ? 20 : 24, need, distractors,
    `目標:堆成 <strong>${N}×${N}×${N}</strong> 大立方體。算一下:${N}³ = ? 已經有 ? 塊,還差幾塊?`,
    `${N}×${N}×${N} = <strong>${target} 塊</strong>(目標)。目前 ${layerCount} 層 × ${N}×${N} = <strong>${have} 塊</strong>(已完成)。還缺 <strong>${target} − ${have} = ${need} 塊</strong>。`,
    `要堆成 ${N}×${N}×${N} 的大立方體 (總共 ${target} 塊小立方),目前堆好了下面的部分,還缺幾塊才能堆滿?`
  );
}

// 15 題 hard 配置 (N, layerCount):
const HARD_CONFIGS = [
  [3, 1], [3, 2],
  [4, 1], [4, 2], [4, 3],
  [5, 1], [5, 2], [5, 3], [5, 4],
  [3, 1], [3, 2],   // 重複 N=3 兩題 (不同 seed → 不同 distractor 順序)
  [4, 1], [4, 2],
  [5, 2], [5, 3]
];

// ─── 主流程 ────────────────────────────────────────────────────────────

const startCounter = { easy: 3, mid: 3, hard: 3 };
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  for (let k = 0; k < 20; k++) {
    const id = `spatial-easy-${String(startCounter.easy++).padStart(3, '0')}`;
    buckets.easy.push(genEasy(id, k));
  }
  for (let k = 0; k < 20; k++) {
    const id = `spatial-mid-${String(startCounter.mid++).padStart(3, '0')}`;
    buckets.mid.push(genMid(id, k));
  }
  for (let k = 0; k < 15; k++) {
    const id = `spatial-hard-${String(startCounter.hard++).padStart(3, '0')}`;
    const [N, lc] = HARD_CONFIGS[k];
    buckets.hard.push(genHard(id, N, lc));
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
    console.error(`\n[gen-spatial] ${failed} failed. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.easy) await writeQuestion(`questions/spatial/easy/${q.id}.json`, q);
  for (const q of buckets.mid)  await writeQuestion(`questions/spatial/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/spatial/hard/${q.id}.json`, q);

  console.log(`[gen-spatial] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
