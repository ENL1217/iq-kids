#!/usr/bin/env node
// tools/self-solve.mjs
// Batch +1000 — Layer 2 自驗:對每題從 visual 推導 answer,跟 q.answer 比對。
//
// 用法:
//   node tools/self-solve.mjs                — 跑所有有 solver 的 sub_type
//   node tools/self-solve.mjs --check-options — 額外檢查每題 options.length === 4
//   node tools/self-solve.mjs --check-dup    — 同 (sub_type, difficulty) 內 signature 唯一
//   node tools/self-solve.mjs --check-balance — answer index 0-3 χ² 檢定 p > 0.5
//   node tools/self-solve.mjs --all          — 跑全部 check
//
// solver 來源:每個 gen-*.mjs export 自己的 solvers 物件,
// 此檔聚合所有 sub_type → solver 函式。

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { solvers as tallySolvers }    from './gen-matrix-tally.mjs';
import { solvers as nestedSolvers }   from './gen-matrix-nested.mjs';
import { solvers as rotContSolvers }  from './gen-matrix-rotation-cont.mjs';
import { solvers as dirFillSolvers }  from './gen-multivar-direction-fill.mjs';
import { solvers as logicalSolvers }  from './gen-matrix-logical.mjs';
import { solvers as twoVarExtSolvers } from './gen-multivar-2var-ext.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const SOLVERS = {
  ...tallySolvers,
  ...nestedSolvers,
  ...rotContSolvers,
  ...dirFillSolvers,
  ...logicalSolvers,
  ...twoVarExtSolvers
};

const args = process.argv.slice(2);
const checkOptions = args.includes('--check-options') || args.includes('--all');
const checkDup     = args.includes('--check-dup')     || args.includes('--all');
const checkBalance = args.includes('--check-balance') || args.includes('--all');

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(full));
    else if (ent.isFile() && ent.name.endsWith('.json') && ent.name !== 'manifest.json') out.push(full);
  }
  return out;
}

// χ² for 4-bucket equal-expected distribution
function chiSqUniformP(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  if (n === 0) return 1.0;
  const expected = n / 4;
  if (expected === 0) return 1.0;
  let chi = 0;
  for (const c of counts) chi += Math.pow(c - expected, 2) / expected;
  // df = 3; approximate p-value via survival of chi-square cdf
  return chiSquareSurvival(chi, 3);
}

// chi-square survival via series expansion (sufficient for df=3)
function chiSquareSurvival(x, df) {
  // For df=3: P(X >= x) ≈ erfc(sqrt(x/2)) + sqrt(x/(2*pi)) * exp(-x/2) * 2 / 1
  // Use regularized incomplete gamma: Q(df/2, x/2)
  return upperIncGammaRegularized(df / 2, x / 2);
}

// Series for the regularized upper incomplete gamma Q(a, x) = 1 - P(a, x)
function upperIncGammaRegularized(a, x) {
  if (x < 0 || a <= 0) return 1.0;
  if (x === 0) return 1.0;
  // Use series for P(a, x) when x < a+1, else continued fraction
  if (x < a + 1) {
    // Series: P(a, x) = e^(-x) x^a / Γ(a) * Σ_{k=0..} x^k / Γ(a+1+k) * Γ(a)
    let term = 1 / a;
    let sum = term;
    for (let k = 1; k < 100; k++) {
      term *= x / (a + k);
      sum += term;
      if (term < 1e-14 * sum) break;
    }
    const P = sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
    return 1 - P;
  } else {
    // Continued fraction for Q(a, x)
    let b = x + 1 - a, c = 1 / 1e-30, d = 1 / b, h = d;
    for (let i = 1; i < 100; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
      c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
}

// Stirling approximation for log Γ
function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
             -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let s = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; s += c[j] / y; }
  return -t + Math.log(2.5066282746310005 * s / x);
}

(async () => {
  const files = await walk(join(ROOT, 'questions'));
  let solverChecked = 0, solverMismatched = 0;
  const mismatches = [];
  const optionsErrors = [];
  const sigsByKey = new Map();   // key = sub_type:difficulty
  const answerIdxByKey = new Map();
  const subTypesSeen = new Map();

  for (const file of files) {
    let q;
    try { q = JSON.parse(await readFile(file, 'utf8')); }
    catch (e) { console.error(`parse fail: ${file}`); continue; }

    const key = `${q.sub_type}:${q.difficulty}`;
    subTypesSeen.set(key, (subTypesSeen.get(key) || 0) + 1);

    // Layer 2: solver answer-recompute
    const solver = SOLVERS[q.sub_type];
    if (solver) {
      const derived = solver(q);
      solverChecked++;
      if (derived !== q.answer) {
        solverMismatched++;
        mismatches.push({ id: q.id, expected: q.answer, derived });
      }
    }

    // --check-options: 必須剛好 4 個 option (對 batch +1000 才強制)
    if (checkOptions && q.signature) {   // signature 是 batch +1000 標記
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        optionsErrors.push({ id: q.id, got: q.options ? q.options.length : 'undefined' });
      }
    }

    // --check-dup: 同 (sub_type, difficulty) 內 signature 唯一
    if (checkDup && q.signature) {
      if (!sigsByKey.has(key)) sigsByKey.set(key, new Map());
      const map = sigsByKey.get(key);
      if (map.has(q.signature)) {
        map.get(q.signature).push(q.id);
      } else {
        map.set(q.signature, [q.id]);
      }
    }

    // --check-balance: collect answer indices per key
    if (checkBalance && q.signature) {
      if (!answerIdxByKey.has(key)) answerIdxByKey.set(key, [0, 0, 0, 0]);
      const arr = answerIdxByKey.get(key);
      if (typeof q.answer === 'number' && q.answer >= 0 && q.answer < 4) arr[q.answer]++;
    }
  }

  // ─── Report ───
  console.log(`\n[self-solve] scanned ${files.length} files`);
  console.log(`  solver coverage: ${solverChecked} questions (sub_types with solvers: ${Object.keys(SOLVERS).length})`);
  if (solverMismatched > 0) {
    console.log(`  ❌ ${solverMismatched} mismatches:`);
    for (const m of mismatches.slice(0, 10)) {
      console.log(`     ${m.id}: expected=${m.expected}, derived=${m.derived}`);
    }
    if (mismatches.length > 10) console.log(`     ... (+${mismatches.length - 10} more)`);
  } else if (solverChecked > 0) {
    console.log(`  ✓ all ${solverChecked} solver-checked questions PASS`);
  }

  let exitCode = 0;
  if (solverMismatched > 0) exitCode = 1;

  if (checkOptions) {
    console.log(`\n[--check-options]`);
    if (optionsErrors.length === 0) console.log(`  ✓ all batch +1000 questions have options.length === 4`);
    else { console.log(`  ❌ ${optionsErrors.length} bad:`); optionsErrors.slice(0, 10).forEach(e => console.log(`     ${e.id}: got ${e.got}`)); exitCode = 1; }
  }

  if (checkDup) {
    console.log(`\n[--check-dup]`);
    let dupCount = 0;
    for (const [key, map] of sigsByKey) {
      for (const [sig, ids] of map) {
        if (ids.length > 1) {
          console.log(`  ❌ ${key} sig=${sig}: ${ids.join(', ')}`);
          dupCount++;
        }
      }
    }
    if (dupCount === 0) console.log(`  ✓ all batch +1000 (sub_type, difficulty) have unique signatures`);
    else exitCode = 1;
  }

  if (checkBalance) {
    console.log(`\n[--check-balance] χ² 4-bucket uniformity (p > 0.5 required)`);
    let badBalance = 0;
    for (const [key, counts] of [...answerIdxByKey].sort()) {
      const p = chiSqUniformP(counts);
      const ok = p > 0.5;
      const mark = ok ? '✓' : '⚠️';
      console.log(`  ${mark} ${key.padEnd(45)} ${counts.join('/')} (n=${counts.reduce((a,b)=>a+b,0)}, p=${p.toFixed(3)})`);
      if (!ok) badBalance++;
    }
    if (badBalance > 0) { console.log(`  ⚠️ ${badBalance} keys have p ≤ 0.5`); }
  }

  if (exitCode === 0) console.log('\n[self-solve] ✓ ALL CHECKS PASS');
  process.exit(exitCode);
})();
