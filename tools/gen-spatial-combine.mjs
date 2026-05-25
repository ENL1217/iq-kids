#!/usr/bin/env node
// tools/gen-spatial-combine.mjs
// Batch 8: spatial cube-combine — 15 題,新 sub_type cube-combine-match
// 「左邊兩堆方塊拼起來,等於右邊哪一堆?」
//
// 視覺結構:composite[ cubeStack A, text "+", cubeStack B, text "=", text "?" ]
// 選項 4 個 cubeStack (1 正解 + 3 干擾):
//   D1: 對的個數但形狀錯 (心智組合錯位)
//   D2: 個數少 1 (漏算 B 的某塊)
//   D3: 個數多 1 (重複算或多加一塊)
//
// 教訓內化:用 placeOptions 4-unique assertion (絕不 inline shuffle)
// truth-table 風格 sanity check:每題的 correct.totalCubes == A.totalCubes + B.totalCubes

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle } from './gen-utils.mjs';

const TOPIC = 'spatial';
const SUB_TYPE = 'cube-combine-match';
const SKILL_CODE = 'spatial-cube-combination';
const SKILL_ZH = '立方體組合配對';
const PROMPT = '左邊兩堆方塊拼起來,等於右邊哪一堆?';

// 數一個 layout 裡有幾個 1 (= 立方體數)
function countCubes(layout) {
  let n = 0;
  const walk = (a) => {
    if (Array.isArray(a)) a.forEach(walk);
    else if (a === 1) n += 1;
  };
  walk(layout);
  return n;
}

// 包裝 cubeStack 成 option
function asOption(layout, label) {
  return {
    text: label,
    visual: { type: 'cubeStack', layout, size: 22 }
  };
}

// 洗牌 + 找 answer index;assert 4 unique by JSON.stringify
function placeOptions(correctOpt, distractors, seedId) {
  const seed = [...seedId].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const all = [correctOpt, ...distractors];
  const seen = new Set();
  const unique = [];
  for (const o of all) {
    const k = JSON.stringify(o.visual);   // 去重看 visual,不看 text label
    if (!seen.has(k)) { seen.add(k); unique.push(o); }
  }
  if (unique.length < 4) {
    throw new Error(`placeOptions: only ${unique.length} unique opts for ${seedId}`);
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const correctKey = JSON.stringify(correctOpt.visual);
  const answerIdx = shuffled.findIndex(o => JSON.stringify(o.visual) === correctKey);
  return { options: shuffled, answerIdx };
}

// ─── 15 題配置 ────────────────────────────────────────────────────────
// 每題:{ A, B, correct, distractors: [3 個], desc }
// A + B 拼起來 = correct (A.cubes + B.cubes = correct.cubes)
// distractors 設計:
//   d1 = "right count, wrong shape" (心智組合錯位)
//   d2 = "missing 1 cube" (漏一塊)
//   d3 = "extra 1 cube" (多一塊)

// 命名約定:
//   1Box   = [[[1]]] 單塊
//   1x2H   = [[[1, 1]]] 橫向 2 塊
//   2OnTop = [[[1]], [[1]]] 垂直 2 塊
//   L3     = [[[1, 1], [1, 0]]] L 形 3 塊
//   等等

const CONFIGS = [
  // ─── MID (8 題) ───
  {
    diff: 'mid',
    A: [[[1]]],
    B: [[[1]]],
    correct: [[[1, 1]]],                // 2 顆橫排
    d1:      [[[1]], [[1]]],            // 2 顆直疊 (對的數,錯的排列)
    d2:      [[[1]]],                   // 1 顆 (漏 1)
    d3:      [[[1, 1, 1]]],             // 3 顆橫排 (多 1)
    desc: '1 塊 + 1 塊 = 橫排 2 塊'
  },
  {
    diff: 'mid',
    A: [[[1]]],
    B: [[[1, 1]]],
    correct: [[[1, 1, 1]]],
    d1:      [[[1, 1]], [[1, 0]]],      // L-shape 3 塊
    d2:      [[[1, 1]]],                // 2 塊
    d3:      [[[1, 1, 1, 1]]],          // 4 塊橫排
    desc: '1 塊 + 橫排 2 塊 = 橫排 3 塊'
  },
  {
    diff: 'mid',
    A: [[[1]], [[1]]],                  // 2 塊直疊
    B: [[[1]]],
    correct: [[[1, 1]], [[1, 0]]],      // L 形:底 2 + 上 1 (3 塊)
    d1:      [[[1, 1, 1]]],             // 3 塊橫排
    d2:      [[[1]], [[1]]],            // 2 塊
    d3:      [[[1, 1]], [[1, 1]]],      // 2x2 = 4 塊
    desc: '2 塊直疊 + 1 塊 = L 形 3 塊'
  },
  {
    diff: 'mid',
    A: [[[1, 1]]],
    B: [[[1]]],
    correct: [[[1, 1]], [[1, 0]]],      // L 形 3 塊
    d1:      [[[1, 1, 1]]],             // 3 塊橫排 (對的數,錯的形)
    d2:      [[[1, 1]]],                // 2 塊
    d3:      [[[1, 1]], [[1, 1]]],      // 2x2 = 4 塊
    desc: '橫排 2 塊 + 1 塊 = L 形 3 塊'
  },
  {
    diff: 'mid',
    A: [[[1, 1]]],
    B: [[[1, 1]]],
    correct: [[[1, 1], [1, 1]]],        // 2x2 平面 = 4 塊
    d1:      [[[1, 1]], [[1, 1]]],      // 2x2 立疊 = 4 塊 (對的數,錯的排列)
    d2:      [[[1, 1, 1]]],             // 3 塊
    d3:      [[[1, 1, 1], [1, 1, 0]]],  // 5 塊 (correct+1)
    desc: '橫排 2 + 橫排 2 = 2×2 平面 4 塊'
  },
  {
    diff: 'mid',
    A: [[[1, 1], [1, 0]]],              // L 形 3 塊
    B: [[[1]]],
    correct: [[[1, 1], [1, 1]]],        // 2x2 平面 4 塊
    d1:      [[[1, 1]], [[1, 1]]],      // 2 層 1x2 = 4 塊
    d2:      [[[1, 1], [1, 0]]],        // L 3 塊 (漏 1)
    d3:      [[[1, 1, 1], [1, 1, 0]]],  // 5 塊 (多 1)
    desc: 'L 形 3 塊 + 1 塊 = 2×2 平面 4 塊'
  },
  {
    diff: 'mid',
    A: [[[1]], [[1]]],
    B: [[[1]], [[1]]],
    correct: [[[1, 1]], [[1, 1]]],      // 2x1 底 + 2x1 頂 = 4 塊
    d1:      [[[1, 1], [1, 1]]],        // 2x2 平面 4 塊
    d2:      [[[1]], [[1]], [[1]]],     // 3 塊直疊
    d3:      [[[1, 1, 1]], [[1, 1, 0]]],// 5 塊
    desc: '2 塊直疊 + 2 塊直疊 = 雙層 2×1 共 4 塊'
  },
  {
    diff: 'mid',
    A: [[[1, 1]]],                          // 橫排 2 塊
    B: [[[1, 1]], [[1, 0]]],                // L: 底 2 + 頂 1 = 3 塊
    correct: [[[1, 1, 1]], [[1, 1, 0]]],    // 底 3 + 頂 2 = 5 塊 (階梯)
    d1:      [[[1, 1, 1, 1, 1]]],           // 5 塊橫排 (對的數,錯的形)
    d2:      [[[1, 1, 1]], [[1, 0, 0]]],    // 4 塊
    d3:      [[[1, 1, 1]], [[1, 1, 1]]],    // 6 塊
    desc: '橫排 2 + L 形 3 = 階梯 5 塊'
  },

  // ─── HARD (7 題) ───
  {
    diff: 'hard',
    A: [[[1, 1, 1]]],
    B: [[[1, 1]]],
    correct: [[[1, 1, 1]], [[1, 1, 0]]], // 底 3 + 頂 2 (階梯 5 塊)
    d1:      [[[1, 1, 1], [1, 1, 0]]],   // 平面 5 塊
    d2:      [[[1, 1]], [[1, 1]]],       // 4 塊
    d3:      [[[1, 1, 1]], [[1, 1, 1]]], // 6 塊
    desc: '橫排 3 + 橫排 2 = 階梯 5 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1], [1, 1]]],               // 2x2 平面 = 4 塊
    B: [[[1]]],
    correct: [[[1, 1], [1, 1]], [[1, 0], [0, 0]]],  // 2x2 底 + 角落 1 = 5 塊
    d1:      [[[1, 1, 1], [1, 1, 0]]],   // 5 塊平面
    d2:      [[[1, 1], [1, 1]]],         // 4 塊
    d3:      [[[1, 1], [1, 1]], [[1, 1], [0, 0]]],  // 6 塊
    desc: '2×2 平面 4 + 1 塊 = 4+1 角落疊 5 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1], [1, 1]]],               // 2x2 平面 = 4 塊
    B: [[[1, 1]]],                       // 2 塊橫排
    correct: [[[1, 1], [1, 1]], [[1, 1], [0, 0]]], // 2x2 底 + 1x2 頂 = 6 塊
    d1:      [[[1, 1, 1], [1, 1, 1]]],   // 6 塊平面
    d2:      [[[1, 1], [1, 1]], [[1, 0], [0, 0]]], // 5 塊
    d3:      [[[1, 1], [1, 1]], [[1, 1], [1, 0]]], // 7 塊
    desc: '2×2 + 橫排 2 = 雙層階梯 6 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1, 1]]],
    B: [[[1, 1, 1]]],
    correct: [[[1, 1, 1], [1, 1, 1]]],   // 2x3 平面 6 塊
    d1:      [[[1, 1, 1]], [[1, 1, 1]]], // 2 層 1x3 6 塊
    d2:      [[[1, 1, 1], [1, 1, 0]]],   // 5 塊
    d3:      [[[1, 1, 1], [1, 1, 1], [1, 0, 0]]], // 7 塊
    desc: '橫排 3 + 橫排 3 = 2×3 平面 6 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1], [1, 0]]],               // L 3 塊
    B: [[[1, 1], [1, 0]]],               // L 3 塊
    correct: [[[1, 1], [1, 1]], [[1, 0], [1, 0]]],   // 2x2 底 + 1x2 邊 = 6 塊
    d1:      [[[1, 1, 1], [1, 1, 1]]],   // 2x3 平面 6 塊
    d2:      [[[1, 1], [1, 1]], [[1, 0], [0, 0]]],   // 5 塊
    d3:      [[[1, 1], [1, 1]], [[1, 1], [1, 0]]],   // 7 塊
    desc: '兩個 L 形 3 塊 = 雙層組合 6 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1]], [[1, 1]]],             // 2 層 1x2 4 塊
    B: [[[1, 1]], [[1, 1]]],             // 2 層 1x2 4 塊
    correct: [[[1, 1], [1, 1]], [[1, 1], [1, 1]]],   // 2x2x2 = 8 塊
    d1:      [[[1, 1, 1, 1]], [[1, 1, 1, 1]]],       // 2 層 1x4 8 塊
    d2:      [[[1, 1], [1, 1]], [[1, 1], [1, 0]]],   // 7 塊
    d3:      [[[1, 1], [1, 1]], [[1, 1], [1, 1]], [[1, 0], [0, 0]]], // 9 塊
    desc: '兩個雙層 4 塊組 = 2×2×2 立方體 8 塊'
  },
  {
    diff: 'hard',
    A: [[[1, 1]], [[1, 0]]],               // 小階梯 3 塊
    B: [[[1, 1]], [[1, 0]]],               // 小階梯 3 塊
    correct: [[[1, 1, 1], [1, 1, 1]]],     // 2x3 平面 6 塊
    d1:      [[[1, 1, 1]], [[1, 1, 1]]],   // 6 塊雙層 1x3 (對的數,錯的形)
    d2:      [[[1, 1, 1], [1, 1, 0]]],     // 5 塊
    d3:      [[[1, 1, 1], [1, 1, 1], [1, 0, 0]]], // 7 塊
    desc: '小階梯 3 塊 + 小階梯 3 塊 = 2×3 平面 6 塊'
  }
];

// 移除 skip 的題 (上面的設計失敗那題)
const validCfgs = CONFIGS.filter(c => !c.skip);

function makeQ(cfg, id) {
  const aN = countCubes(cfg.A);
  const bN = countCubes(cfg.B);
  const cN = countCubes(cfg.correct);
  // sanity:correct = A + B
  if (cN !== aN + bN) {
    throw new Error(`${id}: correct ${cN} != A(${aN}) + B(${bN}). desc=${cfg.desc}`);
  }
  const d1N = countCubes(cfg.d1);
  const d2N = countCubes(cfg.d2);
  const d3N = countCubes(cfg.d3);
  // distractor truth check:d1 = correct count (right count, wrong shape),
  //                       d2 = correct-1 (missing one), d3 = correct+1 (extra one)
  if (d1N !== cN)      throw new Error(`${id}: d1 ${d1N} != correct ${cN} (should be same count). desc=${cfg.desc}`);
  if (d2N !== cN - 1)  throw new Error(`${id}: d2 ${d2N} != correct-1 ${cN-1}. desc=${cfg.desc}`);
  if (d3N !== cN + 1)  throw new Error(`${id}: d3 ${d3N} != correct+1 ${cN+1}. desc=${cfg.desc}`);

  const correctOpt = asOption(cfg.correct, `${cN} 塊`);
  // 3 個 distractor 都用「N 塊」label,讓 visual 而非 text 是 discrimination 主軸
  const D1 = asOption(cfg.d1, `${d1N} 塊`);
  const D2 = asOption(cfg.d2, `${d2N} 塊`);
  const D3 = asOption(cfg.d3, `${d3N} 塊`);

  const { options, answerIdx } = placeOptions(correctOpt, [D1, D2, D3], id);

  const visual = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'cubeStack', layout: cfg.A, size: 22 },
      { type: 'text', content: '+' },
      { type: 'cubeStack', layout: cfg.B, size: 22 },
      { type: 'text', content: '=' },
      { type: 'text', content: '?' }
    ],
    gap: 8
  };

  return {
    id,
    ...baseMeta(TOPIC, cfg.diff, SUB_TYPE, [SKILL_CODE]),
    prompt: PROMPT,
    visual,
    options,
    answer: answerIdx,
    hint: `左邊兩堆各有幾塊?A 有 <strong>${aN}</strong> 塊,B 有 <strong>${bN}</strong> 塊,拼起來 ${aN}+${bN}=<strong>${cN}</strong> 塊。再看哪一堆的形狀剛好可以從左邊兩堆組合出來。`,
    explanation: `A 有 ${aN} 塊,B 有 ${bN} 塊,拼起來總共 <strong>${aN} + ${bN} = ${cN} 塊</strong>。除了個數對,形狀也要對 — 拼起來剛好是「${cfg.desc.split('=')[1]?.trim() || cfg.desc}」。對的數但形狀錯、漏一塊、多一塊都不是答案。`,
    skill: SKILL_ZH
  };
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const startCounter = { mid: 38, hard: 30 };  // mid 接 37 後,hard 接 29 後
const buckets = { mid: [], hard: [] };

async function main() {
  for (const cfg of validCfgs) {
    const id = `spatial-${cfg.diff}-${String(startCounter[cfg.diff]++).padStart(3, '0')}`;
    buckets[cfg.diff].push(makeQ(cfg, id));
  }

  let failed = 0;
  for (const diff of ['mid', 'hard']) {
    for (const q of buckets[diff]) {
      const res = validateQuestion(q);
      if (!res.valid) {
        console.error(`❌ ${q.id}: ${res.errors.join('; ')}`);
        failed += 1;
      }
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-spatial-combine] ${failed} failed. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.mid)  await writeQuestion(`questions/spatial/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/spatial/hard/${q.id}.json`, q);

  console.log(`[gen-spatial-combine] mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
