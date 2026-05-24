// tools/lib.mjs
// 共用常數與工具。題庫生成器跟驗證器都會 import。

export const TOPICS = ['matrix', 'sequence', 'spatial', 'numseries', 'analogy', 'multivar'];
export const DIFFICULTIES = ['easy', 'mid', 'hard'];

export const VALID_COLORS = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue', 'white', 'ink'];
export const VALID_SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hex', 'arrow', 'dots'];

export const VALID_VISUAL_TYPES = [
  'matrix-3x3',
  'matrix-2x2',
  'sequence-row',
  'number-sequence',
  'analogy-row',
  'cubeStack',
  'cubeNet',
  'foldedPaper',
  'single-shape',
  'composite',
  'text',     // 純文字節點 (組合視覺中使用)
  'raw-html'  // 過渡用 escape hatch (折紙、custom 立方體展開圖等手刻 SVG)。新題目應優先用結構化 type
];

// 從 schema.md §3 同步而來。新增 skill code 要先更新 schema.md。
export const VALID_SKILL_CODES = new Set([
  // matrix
  'pattern-row-identification',
  'pattern-bidirectional',
  'pattern-three-variable',
  'pattern-arithmetic',
  'pattern-latin-square',
  'pattern-rotation',
  // sequence
  'sequence-cyclic',
  'sequence-rotation',
  'sequence-nested',
  'sequence-async',
  'sequence-grouped',
  'sequence-accumulative',
  // spatial
  'spatial-paper-fold',
  'spatial-cube-counting',
  'spatial-cube-net',
  'spatial-cube-net-invalid',
  'spatial-volume-arithmetic',
  'spatial-mirror',
  'spatial-symmetry-fold',
  // number
  'number-arithmetic-series',
  'number-geometric-series',
  'number-square',
  'number-second-order',
  'number-alternating',
  'number-fibonacci',
  'number-factorial',
  'number-mixed-operation',
  // analogy
  'analogy-function',
  'analogy-antonym',
  'analogy-location',
  'analogy-sound',
  'analogy-material',
  'analogy-part-whole',
  'analogy-causal',
  'analogy-degree',
  // multivar
  'multivar-2var',
  'multivar-3var',
  'multivar-4var',
  'multivar-latin',
  'multivar-position-swap',
  'multivar-attribute-inheritance'
]);

// 禁詞:AI 自言自語、模型自我揭露
export const TABOO_WORDS = [
  '等等', '不對!', '我們重看', '重看:',
  'Claude', 'claude', 'GPT', 'gpt',
  'AI', '人工智慧', '語言模型', '訓練資料'
];

// ID 格式: <topic>-<difficulty>-<3 digits>
export const ID_REGEX = /^(matrix|sequence|spatial|numseries|analogy|multivar)-(easy|mid|hard)-(\d{3})$/;

/**
 * 驗證一題的結構與內容。
 * 回傳 { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateQuestion(q, opts = {}) {
  const errors = [];
  const warnings = [];

  // ─── 結構檢查 ───
  const required = ['id', 'topic', 'difficulty', 'prompt', 'visual', 'options', 'answer', 'hint', 'explanation', 'skill', 'skill_codes'];
  for (const f of required) {
    if (q[f] === undefined || q[f] === null) errors.push(`missing required field: ${f}`);
  }
  if (errors.length) return { valid: false, errors, warnings };

  // id 格式
  if (!ID_REGEX.test(q.id)) errors.push(`id format invalid: ${q.id} (expect <topic>-<difficulty>-<3digits>)`);
  const idMatch = q.id.match(ID_REGEX);
  if (idMatch) {
    if (idMatch[1] !== q.topic) errors.push(`id topic (${idMatch[1]}) != q.topic (${q.topic})`);
    if (idMatch[2] !== q.difficulty) errors.push(`id difficulty (${idMatch[2]}) != q.difficulty (${q.difficulty})`);
  }

  // topic / difficulty enum
  if (!TOPICS.includes(q.topic)) errors.push(`invalid topic: ${q.topic}`);
  if (!DIFFICULTIES.includes(q.difficulty)) errors.push(`invalid difficulty: ${q.difficulty}`);

  // options 長度
  if (!Array.isArray(q.options)) {
    errors.push('options must be an array');
  } else {
    if (q.options.length < 3 || q.options.length > 4) {
      errors.push(`options length must be 3-4, got ${q.options.length}`);
    }
    for (let i = 0; i < q.options.length; i++) {
      if (!q.options[i].text || typeof q.options[i].text !== 'string') {
        errors.push(`options[${i}].text missing or not string`);
      }
    }
  }

  // answer 範圍
  if (typeof q.answer !== 'number' || !Number.isInteger(q.answer)) {
    errors.push('answer must be an integer');
  } else if (Array.isArray(q.options) && (q.answer < 0 || q.answer >= q.options.length)) {
    errors.push(`answer ${q.answer} out of options range [0, ${q.options.length - 1}]`);
  }

  // visual.type 已知
  if (q.visual && typeof q.visual === 'object') {
    if (!VALID_VISUAL_TYPES.includes(q.visual.type)) {
      errors.push(`unknown visual.type: ${q.visual.type}`);
    }
  } else {
    errors.push('visual must be an object');
  }

  // single-shape 必須有 shape 欄位 (抓 generator 沒填齊的 bug)
  // 也檢查 options[].visual 裡的 single-shape
  const checkSingleShape = (spec, where) => {
    if (spec && spec.type === 'single-shape' && !spec.shape) {
      errors.push(`${where}: single-shape visual missing 'shape' field`);
    }
  };
  if (q.visual) checkSingleShape(q.visual, 'visual');
  if (Array.isArray(q.options)) {
    q.options.forEach((opt, i) => {
      if (opt.visual) checkSingleShape(opt.visual, `options[${i}].visual`);
    });
  }

  // text 不可含字面 "undefined" / "null" / "NaN" (generator 模板字串炸了的訊號)
  const checkLiteral = (text, where) => {
    if (typeof text !== 'string') return;
    for (const bad of ['undefined', 'null', 'NaN']) {
      if (text.includes(bad)) errors.push(`${where} contains literal "${bad}" (generator template likely failed)`);
    }
  };
  if (Array.isArray(q.options)) {
    q.options.forEach((opt, i) => checkLiteral(opt.text, `options[${i}].text`));
  }
  checkLiteral(q.prompt, 'prompt');
  checkLiteral(q.hint, 'hint');
  checkLiteral(q.explanation, 'explanation');

  // skill_codes 至少 1 個,且都在 canonical
  if (!Array.isArray(q.skill_codes) || q.skill_codes.length === 0) {
    errors.push('skill_codes must be a non-empty array');
  } else {
    for (const sc of q.skill_codes) {
      if (!VALID_SKILL_CODES.has(sc)) errors.push(`unknown skill_code: ${sc}`);
    }
  }

  // ─── 內容檢查 ───
  // 禁詞
  const combinedText = [q.prompt, q.hint, q.explanation, q.skill, ...(q.options || []).map(o => o.text)].join(' ');
  for (const word of TABOO_WORDS) {
    if (combinedText.includes(word)) errors.push(`taboo word found: "${word}"`);
  }

  // 長度檢查
  if (q.prompt && q.prompt.length > 80) warnings.push(`prompt too long: ${q.prompt.length} chars (recommend <= 80)`);
  if (q.explanation && q.explanation.replace(/<[^>]+>/g, '').length < 20) {
    warnings.push(`explanation too short: ${q.explanation.length} chars (recommend >= 20)`);
  }

  // hint 應該是問句
  if (q.hint && !q.hint.match(/[?？]$|[。.]$/)) {
    warnings.push('hint should end with ? or 。 (looks like it might be incomplete)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 寫一題到指定路徑,自動建立資料夾。
 */
export async function writeQuestion(filePath, q) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(q, null, 2) + '\n', 'utf8');
}
