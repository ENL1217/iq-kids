#!/usr/bin/env node
// tools/gen-numseries.mjs
// 生成「進階數列」題型,程序化產出等差、平方、等比、二階等差、交錯、費氏、階乘、混合運算。

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, idGen, makeRng, rngInt, rngPick, rngShuffle } from './gen-utils.mjs';

const TOPIC = 'numseries';

// ─── 共用:把序列+答案+干擾組成 question ───
function makeQuestion({ id, difficulty, sub_type, skill_code, items, answer, distractors, prompt, hint, explanation, skill }) {
  // 把 answer 跟 distractors 都做為 string 選項 (validator 要求 text)
  const all = [answer, ...distractors];
  // 簡單洗牌(用 sub_type+id hash 當 seed,但其實這裡用順序就行,seeded rng 在外面)
  const seenSet = new Set();
  const uniq = all.filter(v => {
    if (seenSet.has(v)) return false;
    seenSet.add(v);
    return true;
  });
  // 若洗到只剩 < 4,補幾個明顯不對的(answer ± 大幅偏移)
  while (uniq.length < 4) {
    const candidate = answer + (uniq.length + 1) * 7;
    if (!uniq.includes(candidate)) uniq.push(candidate);
  }
  // shuffle 用 id-hash 當 seed,讓相同 id 永遠相同順序
  const seed = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const shuffled = rngShuffle(makeRng(seed), uniq).slice(0, 4);
  // 若 shuffle 切掉答案,把答案塞回去
  if (!shuffled.includes(answer)) {
    shuffled[0] = answer;
  }
  // 最後再洗一次
  const final = rngShuffle(makeRng(seed + 7), shuffled);
  const answerIdx = final.indexOf(answer);

  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt,
    visual: { type: 'number-sequence', items: [...items, '?'] },
    options: final.map(v => ({ text: String(v) })),
    answer: answerIdx,
    hint,
    explanation,
    skill
  };
}

// ─── EASY ───

// 等差數列 (arithmetic): start, step, length
function genArithmeticAsc(id, start, step, length) {
  const items = [];
  for (let i = 0; i < length; i++) items.push(start + step * i);
  const answer = start + step * length;
  const distractors = [answer + 1, answer - 1, answer + step];
  return makeQuestion({
    id, difficulty: 'easy', sub_type: 'arithmetic-ascending',
    skill_code: 'number-arithmetic-series',
    items, answer, distractors,
    prompt: '看看這串數字,每次都加同一個數字,下一個是什麼?',
    hint: `從第一個數字到第二個,加了多少?到第三個呢?都是<strong>+${step}</strong>。最後一個是 ${items[items.length - 1]},再加 ${step} 是多少?`,
    explanation: `每一格都比前一格<strong>多 ${step}</strong>。${items[items.length - 1]} + ${step} = <strong>${answer}</strong>。`,
    skill: '等差數列'
  });
}

// 等差遞減
function genArithmeticDesc(id, start, step, length) {
  const items = [];
  for (let i = 0; i < length; i++) items.push(start - step * i);
  const answer = start - step * length;
  const distractors = [answer + 1, answer - 1, answer + step];
  return makeQuestion({
    id, difficulty: 'easy', sub_type: 'arithmetic-descending',
    skill_code: 'number-arithmetic-series',
    items, answer, distractors,
    prompt: '看看這串數字,每次都減同一個數字,下一個是什麼?',
    hint: `第一個是 ${items[0]},第二個是 ${items[1]},少了多少?都是<strong>−${step}</strong>。最後是 ${items[items.length - 1]},再減 ${step} 是多少?`,
    explanation: `每一格都比前一格<strong>少 ${step}</strong>。${items[items.length - 1]} − ${step} = <strong>${answer}</strong>。`,
    skill: '等差遞減'
  });
}

// 平方數
function genSquares(id, startN, length) {
  const items = [];
  for (let i = 0; i < length; i++) items.push((startN + i) ** 2);
  const nextN = startN + length;
  const answer = nextN * nextN;
  const distractors = [
    answer - (2 * nextN - 1), // 上一個平方
    answer + 1,
    items[items.length - 1] + (items[items.length - 1] - items[items.length - 2]) // 誤以為等差
  ];
  return makeQuestion({
    id, difficulty: 'easy', sub_type: 'square-numbers',
    skill_code: 'number-square',
    items, answer, distractors,
    prompt: '這串數字藏著乘法的祕密,下一個是什麼?',
    hint: `1×1=1, 2×2=4, 3×3=9... 看到了嗎?每一個都是<strong>同樣的數字相乘</strong>。下一個應該是 ${nextN}×${nextN}。`,
    explanation: `這是<strong>平方數</strong>:1², 2², 3²... 接下來是 ${nextN}² = ${nextN}×${nextN} = <strong>${answer}</strong>。`,
    skill: '平方數規律'
  });
}

// 等比數列 ×2
function genGeometricX2(id, start, length) {
  const items = [];
  let cur = start;
  for (let i = 0; i < length; i++) { items.push(cur); cur *= 2; }
  const answer = cur;
  const distractors = [answer / 2 + start, answer + items[items.length - 1], answer - 1];
  return makeQuestion({
    id, difficulty: 'easy', sub_type: 'geometric-x2',
    skill_code: 'number-geometric-series',
    items, answer, distractors,
    prompt: '這串數字每一步變成原本的兩倍,下一個是什麼?',
    hint: `${items[0]} 到 ${items[1]} 變成幾倍?${items[1]} 到 ${items[2]} 呢?都是<strong>×2</strong>。${items[items.length - 1]} × 2 是多少?`,
    explanation: `每一格都是前一格的<strong>2 倍</strong>。${items[items.length - 1]} × 2 = <strong>${answer}</strong>。`,
    skill: '等比數列(×2)'
  });
}

// ─── MID ───

// 二階等差:差為 1,2,3,4...
function genSecondOrder(id, start, firstDiff, length) {
  const items = [start];
  let cur = start;
  let diff = firstDiff;
  for (let i = 0; i < length - 1; i++) {
    cur += diff;
    items.push(cur);
    diff += 1;
  }
  const answer = cur + diff;
  const nextDiff = diff;
  const distractors = [
    cur + (diff - 1), // 沒看出差在遞增
    cur + (diff + 1),
    answer + 1
  ];
  return makeQuestion({
    id, difficulty: 'mid', sub_type: 'second-order-arithmetic',
    skill_code: 'number-second-order',
    items, answer, distractors,
    prompt: '看看相鄰的差,藏著什麼規律?',
    hint: `${items[0]}→${items[1]} 差多少?${items[1]}→${items[2]} 差多少?${items[2]}→${items[3]} 差多少?<strong>差本身</strong>是不是一直在加 1?`,
    explanation: `相鄰兩個的差是 <strong>${firstDiff}, ${firstDiff + 1}, ${firstDiff + 2}...</strong> 每次多 1。最後一個差是 ${nextDiff},所以 ${cur} + ${nextDiff} = <strong>${answer}</strong>。`,
    skill: '二階等差(差再變化)'
  });
}

// 交錯雙串
function genAlternating(id, a0, aStep, b0, bStep, totalLength) {
  // 偶數位用 a 系列(a0, a0+aStep, ...),奇數位用 b 系列
  const items = [];
  let ai = 0, bi = 0;
  for (let i = 0; i < totalLength; i++) {
    if (i % 2 === 0) { items.push(a0 + aStep * ai); ai += 1; }
    else { items.push(b0 + bStep * bi); bi += 1; }
  }
  // ? 落在最後一位 + 1
  // 下一個是哪一系列?
  let answer, nextSeries;
  if (totalLength % 2 === 0) {
    // 下一個是 a 系列
    answer = a0 + aStep * ai;
    nextSeries = 'a';
  } else {
    answer = b0 + bStep * bi;
    nextSeries = 'b';
  }
  const lastItem = items[items.length - 1];
  const distractors = [
    lastItem + (nextSeries === 'a' ? bStep : aStep), // 用錯了步長
    lastItem + 1,
    items[items.length - 2] + (nextSeries === 'a' ? aStep : bStep) // 對的步長但跳錯位置
  ];
  return makeQuestion({
    id, difficulty: 'mid', sub_type: 'alternating-two-streams',
    skill_code: 'number-alternating',
    items, answer, distractors,
    prompt: '這串數字藏著兩條規律,看一個跳一個,下一個是什麼?',
    hint: `只看第 1、3、5 個位置:${items.filter((_, i) => i % 2 === 0).join(', ')} ── 規律是什麼?第 2、4 個位置又是什麼規律?`,
    explanation: `把它拆成兩串:奇數位是 <strong>${a0}, ${a0 + aStep}, ${a0 + aStep * 2}...</strong> (每次 +${aStep});偶數位是 <strong>${b0}, ${b0 + bStep}, ${b0 + bStep * 2}...</strong> (每次 +${bStep})。下一個輪到${nextSeries === 'a' ? '奇數位' : '偶數位'},是 <strong>${answer}</strong>。`,
    skill: '交錯雙串數列'
  });
}

// 等比 ×3
function genGeometricX3(id, start, length) {
  const items = [];
  let cur = start;
  for (let i = 0; i < length; i++) { items.push(cur); cur *= 3; }
  const answer = cur;
  const distractors = [
    items[items.length - 1] * 2,
    items[items.length - 1] + items[items.length - 2],
    answer + 1
  ];
  return makeQuestion({
    id, difficulty: 'mid', sub_type: 'geometric-x3',
    skill_code: 'number-geometric-series',
    items, answer, distractors,
    prompt: '這串數字每一步都變成原本的幾倍?下一個是什麼?',
    hint: `${items[0]} 到 ${items[1]} 變幾倍?${items[1]} 到 ${items[2]} 呢?都是<strong>×3</strong>!${items[items.length - 1]} × 3 是?`,
    explanation: `每一格都是前一格的 <strong>3 倍</strong>。${items[items.length - 1]} × 3 = <strong>${answer}</strong>。`,
    skill: '等比數列(×3)'
  });
}

// ─── HARD ───

// 費氏 / 類費氏:每項 = 前兩項相加
function genFibonacci(id, a, b, length) {
  const items = [a, b];
  for (let i = 2; i < length; i++) items.push(items[i - 1] + items[i - 2]);
  const answer = items[length - 1] + items[length - 2];
  const distractors = [
    items[length - 1] * 2,
    answer + 1,
    items[length - 1] + items[length - 3]
  ];
  return makeQuestion({
    id, difficulty: 'hard', sub_type: 'fibonacci-like',
    skill_code: 'number-fibonacci',
    items, answer, distractors,
    prompt: '看看相鄰幾個數字,有沒有特別的關係?',
    hint: `${items[0]} + ${items[1]} = ${items[2]}?${items[1]} + ${items[2]} = ${items[3]}?是不是<strong>每一個都等於前兩個相加</strong>?`,
    explanation: `這是<strong>費氏型數列</strong>:每一項 = 前兩項相加。${items[length - 2]} + ${items[length - 1]} = <strong>${answer}</strong>。`,
    skill: '費氏型相加數列'
  });
}

// 階乘相關:1,2,6,24,120 (×1,×2,×3,×4,×5...)
function genFactorial(id, startN, length) {
  // 從 startN! 開始 length 個
  const items = [];
  let f = 1;
  for (let i = 1; i <= startN; i++) f *= i;
  items.push(f);
  for (let i = 1; i < length; i++) {
    f *= (startN + i);
    items.push(f);
  }
  const nextMultiplier = startN + length;
  const answer = items[items.length - 1] * nextMultiplier;
  const distractors = [
    items[items.length - 1] * (nextMultiplier - 1),
    items[items.length - 1] * (nextMultiplier + 1),
    items[items.length - 1] + items[items.length - 2]
  ];
  return makeQuestion({
    id, difficulty: 'hard', sub_type: 'factorial-multiplier',
    skill_code: 'number-factorial',
    items, answer, distractors,
    prompt: '每一步乘的數字不一樣,有看出規律嗎?',
    hint: `${items[0]} → ${items[1]} 是 ×${startN + 1}?${items[1]} → ${items[2]} 是 ×${startN + 2}?乘的數字是不是<strong>每次多 1</strong>?`,
    explanation: `乘數一路變大:×${startN + 1}, ×${startN + 2}, ×${startN + 3}...。最後一步是 ${items[items.length - 1]} × <strong>${nextMultiplier}</strong> = <strong>${answer}</strong>。`,
    skill: '階乘式遞乘數列'
  });
}

// 混合運算 ×a+b
function genMixedOp(id, start, mult, add, length) {
  const items = [start];
  let cur = start;
  for (let i = 1; i < length; i++) { cur = cur * mult + add; items.push(cur); }
  const answer = cur * mult + add;
  const distractors = [
    cur * mult, // 沒加 add
    cur + add,  // 沒乘
    cur * (mult + 1)
  ];
  return makeQuestion({
    id, difficulty: 'hard', sub_type: 'mixed-multiply-add',
    skill_code: 'number-mixed-operation',
    items, answer, distractors,
    prompt: '這串數字每一步做了兩件事,下一個是什麼?',
    hint: `${items[0]} 變成 ${items[1]}:可能是 <strong>×${mult} 再 +${add}</strong>。試試看 ${items[1]} ×${mult}+${add} 對不對?最後一個套同樣公式。`,
    explanation: `每一步是<strong>先 ×${mult},再 +${add}</strong>。${items[items.length - 1]} × ${mult} + ${add} = <strong>${answer}</strong>。`,
    skill: '混合運算數列(×N+M)'
  });
}

// ─── 主流程 ───

const easyQs = [];
const midQs = [];
const hardQs = [];

const easyId = idGen('numseries', 'easy');
const midId = idGen('numseries', 'mid');
const hardId = idGen('numseries', 'hard');

// ─── EASY 30 ───
// 等差遞增 12 題 (step 2-7,start 1-15,length 4)
const ascConfigs = [
  [1, 2, 4], [2, 2, 4], [3, 3, 4], [5, 3, 4], [4, 4, 4], [6, 5, 4],
  [10, 5, 4], [7, 6, 4], [2, 7, 4], [1, 10, 4], [3, 4, 5], [5, 2, 5]
];
for (const [s, st, l] of ascConfigs) easyQs.push(genArithmeticAsc(easyId(), s, st, l));

// 等差遞減 6 題
const descConfigs = [
  [20, 2, 4], [30, 3, 4], [25, 5, 4], [40, 4, 4], [18, 3, 5], [50, 6, 4]
];
for (const [s, st, l] of descConfigs) easyQs.push(genArithmeticDesc(easyId(), s, st, l));

// 平方數 6 題 (starting n: 1..3, length 4..5)
const sqConfigs = [
  [1, 4], [2, 4], [3, 4], [1, 5], [2, 5], [4, 4]
];
for (const [s, l] of sqConfigs) easyQs.push(genSquares(easyId(), s, l));

// 等比 ×2 6 題
const x2Configs = [
  [1, 4], [2, 4], [3, 4], [1, 5], [4, 4], [5, 4]
];
for (const [s, l] of x2Configs) easyQs.push(genGeometricX2(easyId(), s, l));

// ─── MID 25 ───
// 二階等差 9 題
const soConfigs = [
  [1, 1, 5], [2, 1, 5], [3, 2, 5], [1, 2, 5], [4, 1, 5], [2, 3, 5],
  [5, 1, 6], [1, 3, 5], [10, 1, 5]
];
for (const [s, d, l] of soConfigs) midQs.push(genSecondOrder(midId(), s, d, l));

// 交錯雙串 8 題
const altConfigs = [
  [2, 2, 10, 2, 6],   // 2,10,4,12,6,14 ; ? = 8
  [1, 3, 20, 5, 6],   // 1,20,4,25,7,30 ; ? = 10
  [5, 1, 50, 10, 6],
  [3, 2, 1, 2, 6],
  [10, 5, 100, 10, 6],
  [2, 3, 1, 4, 5],
  [4, 1, 8, 2, 6],
  [1, 5, 2, 5, 6]
];
for (const [a0, as, b0, bs, l] of altConfigs) midQs.push(genAlternating(midId(), a0, as, b0, bs, l));

// 等比 ×3 8 題
const x3Configs = [
  [1, 4], [2, 4], [3, 4], [1, 5], [4, 4], [5, 4], [2, 5], [10, 4]
];
for (const [s, l] of x3Configs) midQs.push(genGeometricX3(midId(), s, l));

// ─── HARD 20 ───
// 費氏 7 題
const fibConfigs = [
  [1, 1, 5], [1, 2, 5], [2, 3, 5], [1, 1, 6], [1, 3, 5], [2, 5, 5], [3, 4, 5]
];
for (const [a, b, l] of fibConfigs) hardQs.push(genFibonacci(hardId(), a, b, l));

// 階乘式遞乘 6 題
const factConfigs = [
  [1, 4],  // 1,2,6,24,? = 120
  [1, 5],  // 1,2,6,24,120,? = 720
  [2, 4],  // 2,6,24,120,? = 720
  [1, 3],  // 1,2,6,? = 24
  [2, 3],  // 2,6,24,? = 120
  [3, 4]   // 6,24,120,720,? = 5040
];
for (const [s, l] of factConfigs) hardQs.push(genFactorial(hardId(), s, l));

// 混合 ×N+M 7 題
const mixConfigs = [
  [1, 2, 1, 4],  // 1,3,7,15,? = 31
  [1, 3, 1, 4],  // 1,4,13,40,? = 121
  [2, 2, 1, 4],  // 2,5,11,23,? = 47
  [1, 2, 3, 4],  // 1,5,13,29,? = 61
  [2, 3, 2, 4],  // 2,8,26,80,? = 242
  [1, 2, 2, 5],  // 1,4,10,22,46,? = 94
  [3, 2, 1, 4]   // 3,7,15,31,? = 63
];
for (const [s, m, a, l] of mixConfigs) hardQs.push(genMixedOp(hardId(), s, m, a, l));

// ─── 驗證並寫出 ───
async function main() {
  const all = [...easyQs, ...midQs, ...hardQs];
  let failed = 0;
  for (const q of all) {
    const res = validateQuestion(q);
    if (!res.valid) {
      console.error(`❌ ${q.id}: ${res.errors.join('; ')}`);
      failed += 1;
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-numseries] ${failed} questions failed validation. Aborting.`);
    process.exit(1);
  }
  for (const q of easyQs) await writeQuestion(`questions/numseries/easy/${q.id}.json`, q);
  for (const q of midQs) await writeQuestion(`questions/numseries/mid/${q.id}.json`, q);
  for (const q of hardQs) await writeQuestion(`questions/numseries/hard/${q.id}.json`, q);
  console.log(`[gen-numseries] easy=${easyQs.length}, mid=${midQs.length}, hard=${hardQs.length}, total=${all.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
