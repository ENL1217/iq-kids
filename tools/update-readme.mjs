#!/usr/bin/env node
// =============================================================
// update-readme.mjs
//
// Scan questions/<topic>/<difficulty>/*.json, compute counts,
// and rewrite the auto-managed section in README.md / README.en.md
// (delimited by <!-- AUTO-COUNT-START --> and <!-- AUTO-COUNT-END -->).
//
// Run manually:   node tools/update-readme.mjs
// Triggered by CI: .github/workflows/auto-readme.yml on push to main
//                  with questions/** changes
//
// Exits 0 with no-op if counts haven't changed.
// =============================================================

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const TOPICS = [
  { key: 'matrix',    zh: '🎯 矩陣推理',   en: '🎯 Matrix Reasoning  ' },
  { key: 'sequence',  zh: '🔄 圖形序列',   en: '🔄 Visual Sequence   ' },
  { key: 'spatial',   zh: '🧊 空間能力',   en: '🧊 Spatial Reasoning ' },
  { key: 'numseries', zh: '🔢 進階數列',   en: '🔢 Number Series     ' },
  { key: 'analogy',   zh: '🔗 類比推理',   en: '🔗 Verbal Analogy    ' },
  { key: 'multivar',  zh: '🌈 多元素變化', en: '🌈 Multi-attribute   ' },
];

const DIFFICULTIES = ['easy', 'mid', 'hard'];

async function count(topic, difficulty) {
  const dir = join(ROOT, 'questions', topic, difficulty);
  try {
    const files = await readdir(dir);
    return files.filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

async function gather() {
  const counts = {};
  let total = 0;
  for (const t of TOPICS) {
    counts[t.key] = {};
    let topicTotal = 0;
    for (const d of DIFFICULTIES) {
      const n = await count(t.key, d);
      counts[t.key][d] = n;
      topicTotal += n;
    }
    counts[t.key].total = topicTotal;
    total += topicTotal;
  }
  return { counts, total };
}

function makeZhSection(counts, total) {
  let out = `**${total} 題**,六大題型 × 三種難度,持續擴充中:\n\n`;
  out += `| 題型 | easy ⭐ | mid ⭐⭐ | hard ⭐⭐⭐ | 總計 |\n`;
  out += `|------|---------|---------|----------|------|\n`;
  for (const t of TOPICS) {
    const c = counts[t.key];
    out += `| ${t.zh} | ${c.easy} | ${c.mid} | ${c.hard} | ${c.total} |\n`;
  }
  out += `| **合計** | | | | **${total}** |\n`;
  return out;
}

function makeEnSection(counts, total) {
  let out = `**${total} questions** across six topics and three difficulty levels, growing:\n\n`;
  out += `| Topic | Easy ⭐ | Mid ⭐⭐ | Hard ⭐⭐⭐ | Total |\n`;
  out += `|-------|---------|---------|----------|-------|\n`;
  for (const t of TOPICS) {
    const c = counts[t.key];
    out += `| ${t.en} | ${c.easy} | ${c.mid} | ${c.hard} | ${c.total} |\n`;
  }
  out += `| **Total**             | | | | **${total}** |\n`;
  return out;
}

async function updateFile(path, newSection) {
  const full = await readFile(path, 'utf-8');
  const startMarker = '<!-- AUTO-COUNT-START -->';
  const endMarker = '<!-- AUTO-COUNT-END -->';
  const startIdx = full.indexOf(startMarker);
  const endIdx = full.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`${path}: missing AUTO-COUNT markers`);
  }
  const before = full.substring(0, startIdx + startMarker.length);
  const after = full.substring(endIdx);
  const replaced = `${before}\n${newSection}${after}`;
  if (replaced === full) {
    return false; // no change
  }
  await writeFile(path, replaced);
  return true;
}

async function main() {
  const { counts, total } = await gather();
  console.log(`Total questions found: ${total}`);
  console.log('Per-topic:', Object.fromEntries(
    Object.entries(counts).map(([k, v]) => [k, v.total])
  ));

  const zhSection = makeZhSection(counts, total);
  const enSection = makeEnSection(counts, total);

  const zhChanged = await updateFile(join(ROOT, 'README.md'), zhSection);
  const enChanged = await updateFile(join(ROOT, 'README.en.md'), enSection);

  if (zhChanged || enChanged) {
    console.log(`✓ Updated: ${[zhChanged && 'README.md', enChanged && 'README.en.md'].filter(Boolean).join(', ')}`);
  } else {
    console.log('No README changes needed.');
  }
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
