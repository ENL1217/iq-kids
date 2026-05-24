#!/usr/bin/env node
// tools/validate.mjs
// 批次驗證 questions/**/*.json 是否符合 schema。
// 用法: node tools/validate.mjs [--strict] [path-prefix]
//   --strict: warning 也算 fail
//   path-prefix: 只驗指定資料夾, e.g. node tools/validate.mjs questions/matrix

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateQuestion } from './lib.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const pathArg = args.find(a => !a.startsWith('--')) || 'questions';
const SEARCH_DIR = join(ROOT, pathArg);

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT') return out;
    throw e;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...await walk(full));
    } else if (ent.isFile() && ent.name.endsWith('.json') && ent.name !== 'manifest.json') {
      out.push(full);
    }
  }
  return out;
}

(async () => {
  const files = await walk(SEARCH_DIR);
  if (files.length === 0) {
    console.log(`[validate] no question files found under ${relative(ROOT, SEARCH_DIR)}/`);
    process.exit(0);
  }

  let passed = 0, failed = 0, warned = 0;
  const failureDetails = [];

  for (const file of files) {
    let q;
    try {
      q = JSON.parse(await readFile(file, 'utf8'));
    } catch (e) {
      failed++;
      failureDetails.push({ file, errors: [`JSON parse error: ${e.message}`] });
      continue;
    }

    // 檢查檔名跟 id 一致
    const expectedFilename = `${q.id}.json`;
    const actualFilename = basename(file);
    const filenameErrors = [];
    if (actualFilename !== expectedFilename) {
      filenameErrors.push(`filename ${actualFilename} != ${expectedFilename}`);
    }

    const result = validateQuestion(q);
    const allErrors = [...filenameErrors, ...result.errors];

    if (allErrors.length > 0) {
      failed++;
      failureDetails.push({ file, errors: allErrors, warnings: result.warnings });
    } else {
      passed++;
      if (result.warnings.length > 0) {
        warned++;
        if (strict) {
          failed++;
          failureDetails.push({ file, errors: [], warnings: result.warnings, strict: true });
        }
      }
    }
  }

  // ─── 輸出 ───
  console.log(`\n[validate] ${files.length} files scanned`);
  console.log(`  passed:  ${passed}${warned ? ` (${warned} with warnings)` : ''}`);
  console.log(`  failed:  ${failed}`);

  if (failureDetails.length > 0) {
    console.log('\n--- failures ---');
    for (const f of failureDetails) {
      console.log(`\n${relative(ROOT, f.file)}`);
      if (f.errors.length > 0) {
        for (const e of f.errors) console.log(`  ✗ ${e}`);
      }
      if (f.warnings && f.warnings.length > 0) {
        const prefix = f.strict ? '✗ (strict)' : '!';
        for (const w of f.warnings) console.log(`  ${prefix} ${w}`);
      }
    }
    process.exit(1);
  }

  console.log('\n[validate] ✓ all questions valid');
})();
