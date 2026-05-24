// web/js/test-mode.js
// 測驗模式 (Tier 1 範圍): 無提示、無解析、限時、完成後才看結果。
// 學習模式還是用 app.js 主流程。

import { renderVisual } from './renderer.js';
import { loadManifest, loadQuestions, pickQuestionIds } from './loader.js';
import { recordAttempt, aggregateByTopic } from './recorder.js';
import { radarChart, radarLegend } from './radar.js';
import { unlockAudio } from './feedback.js';

const TOPICS = {
  matrix:    { emoji: '🎯', name: '矩陣' },
  sequence:  { emoji: '🔄', name: '序列' },
  spatial:   { emoji: '🧊', name: '空間' },
  numseries: { emoji: '🔢', name: '數列' },
  analogy:   { emoji: '🔗', name: '類比' },
  multivar:  { emoji: '🌈', name: '多元' }
};
const LEVELS = ['easy', 'mid', 'hard'];
const LEVEL_LABEL = { easy: '⭐ 入門', mid: '⭐⭐ 中階', hard: '⭐⭐⭐ 挑戰', mixed: '🎲 混合' };

// 測驗 session state
const tstate = {
  manifest: null,
  config: null,        // {topics: [], levels: [], count, timeSec}
  qList: [],
  idx: 0,
  picked: [],          // 每題使用者選的 idx (含 null = 未作答 / 超時)
  startTs: null,
  questionStartTs: null,
  timerHandle: null,
  endByTime: false
};

// ─────────────────────────────────────────────────────────────
// 進入測驗設定頁
// ─────────────────────────────────────────────────────────────
export async function openTestSetup() {
  if (!tstate.manifest) {
    try {
      tstate.manifest = await loadManifest();
    } catch (e) {
      alert('題庫載入失敗,稍後再試');
      return;
    }
  }
  hideAllScreens();
  document.getElementById('testSetupScreen').classList.remove('hide');
  renderSetupChips();
}

function renderSetupChips() {
  // 題型 chips
  const topicWrap = document.getElementById('setupTopics');
  topicWrap.innerHTML = Object.entries(TOPICS).map(([key, t]) => {
    const counts = LEVELS.map(d => tstate.manifest.topics[key]?.[d]?.length || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    const disabled = total === 0 ? 'disabled' : '';
    return `<button type="button" class="setup-chip topic-chip active" data-topic="${key}" ${disabled}>
      <span class="chip-emoji">${t.emoji}</span>
      <span class="chip-text">${t.name}</span>
      <span class="chip-count">(${total})</span>
    </button>`;
  }).join('');
  topicWrap.querySelectorAll('.topic-chip:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });

  // 難度 chips (預設 easy)
  const levelWrap = document.getElementById('setupLevels');
  levelWrap.innerHTML = LEVELS.concat(['mixed']).map(l => {
    const active = l === 'easy' ? 'active' : '';
    return `<button type="button" class="setup-chip level-chip ${active}" data-level="${l}">${LEVEL_LABEL[l]}</button>`;
  }).join('');
  levelWrap.querySelectorAll('.level-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      // 單選 OR 「混合」+任一: 簡化:單選即可,「混合」會展開為 easy+mid+hard
      levelWrap.querySelectorAll('.level-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 題數 chips
  const countWrap = document.getElementById('setupCount');
  const counts = [10, 20, 30];
  countWrap.innerHTML = counts.map(c =>
    `<button type="button" class="setup-chip count-chip ${c === 10 ? 'active' : ''}" data-count="${c}">${c} 題</button>`
  ).join('');
  countWrap.querySelectorAll('.count-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      countWrap.querySelectorAll('.count-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 時限 chips
  const timeWrap = document.getElementById('setupTime');
  const times = [
    { v: 0,    label: '無限' },
    { v: 600,  label: '10 分' },
    { v: 1200, label: '20 分' },
    { v: 1800, label: '30 分' }
  ];
  timeWrap.innerHTML = times.map((t, i) =>
    `<button type="button" class="setup-chip time-chip ${i === 1 ? 'active' : ''}" data-time="${t.v}">${t.label}</button>`
  ).join('');
  timeWrap.querySelectorAll('.time-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      timeWrap.querySelectorAll('.time-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 即時更新「目前題庫可抽 N 題」摘要
  topicWrap.querySelectorAll('.topic-chip').forEach(btn => {
    btn.addEventListener('click', updateSetupSummary);
  });
  levelWrap.querySelectorAll('.level-chip').forEach(btn => {
    btn.addEventListener('click', updateSetupSummary);
  });
  countWrap.querySelectorAll('.count-chip').forEach(btn => {
    btn.addEventListener('click', updateSetupSummary);
  });
  updateSetupSummary();
}

function updateSetupSummary() {
  const summary = document.getElementById('setupSummary');
  if (!summary) return;
  const cfg = readSetupConfig();
  const available = countAvailable(cfg);
  const actual = Math.min(available, cfg.count);
  if (available === 0) {
    summary.innerHTML = `<span class="warn">⚠ 你選的範圍裡沒有題目,請至少選一個題型</span>`;
    document.getElementById('startTestBtn').disabled = true;
  } else if (actual < cfg.count) {
    summary.innerHTML = `📦 範圍內共有 ${available} 題;本次抽 <strong>${actual}</strong> 題(不夠 ${cfg.count})`;
    document.getElementById('startTestBtn').disabled = false;
  } else {
    summary.innerHTML = `📦 範圍內共有 ${available} 題,本次抽 <strong>${cfg.count}</strong> 題`;
    document.getElementById('startTestBtn').disabled = false;
  }
}

function readSetupConfig() {
  const topics = [...document.querySelectorAll('#setupTopics .topic-chip.active')]
    .filter(b => !b.disabled)
    .map(b => b.dataset.topic);
  const levelChip = document.querySelector('#setupLevels .level-chip.active');
  const level = levelChip ? levelChip.dataset.level : 'easy';
  const levels = level === 'mixed' ? ['easy', 'mid', 'hard'] : [level];
  const countChip = document.querySelector('#setupCount .count-chip.active');
  const count = countChip ? parseInt(countChip.dataset.count, 10) : 10;
  const timeChip = document.querySelector('#setupTime .time-chip.active');
  const timeSec = timeChip ? parseInt(timeChip.dataset.time, 10) : 0;
  return { topics, levels, count, timeSec };
}

function countAvailable(cfg) {
  let n = 0;
  for (const t of cfg.topics) {
    for (const l of cfg.levels) {
      n += tstate.manifest.topics[t]?.[l]?.length || 0;
    }
  }
  return n;
}

// ─────────────────────────────────────────────────────────────
// 開始測驗
// ─────────────────────────────────────────────────────────────
export async function startTest() {
  const cfg = readSetupConfig();
  if (cfg.topics.length === 0) {
    alert('請至少選一個題型');
    return;
  }
  const available = countAvailable(cfg);
  if (available === 0) {
    alert('這個範圍裡沒有題目');
    return;
  }
  cfg.count = Math.min(cfg.count, available);
  tstate.config = cfg;
  tstate.idx = 0;
  tstate.picked = new Array(cfg.count).fill(null);
  tstate.endByTime = false;
  tstate.startTs = Date.now();

  // 跨題型/難度 pool,shuffle,取 count
  const pool = [];
  for (const t of cfg.topics) {
    for (const l of cfg.levels) {
      const ids = tstate.manifest.topics[t]?.[l] || [];
      for (const id of ids) pool.push(id);
    }
  }
  const shuffled = shuffle(pool).slice(0, cfg.count);

  unlockAudio();
  hideAllScreens();
  document.getElementById('testQuizScreen').classList.remove('hide');
  document.getElementById('testQuizArea').innerHTML = '<div class="loading">載入測驗題目中</div>';
  try {
    tstate.qList = await loadQuestions(shuffled);
  } catch (e) {
    document.getElementById('testQuizArea').innerHTML =
      `<div class="render-error">載入失敗:${e.message}</div>`;
    return;
  }
  startTimerIfNeeded();
  renderTestQuestion();
}

function startTimerIfNeeded() {
  clearInterval(tstate.timerHandle);
  const t = document.getElementById('testTimer');
  if (!tstate.config.timeSec) {
    t.textContent = '⏱ 無限';
    t.classList.remove('timer-warn', 'timer-critical');
    return;
  }
  const endAt = tstate.startTs + tstate.config.timeSec * 1000;
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    t.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
    t.classList.toggle('timer-warn', remaining <= 60 && remaining > 10);
    t.classList.toggle('timer-critical', remaining <= 10);
    if (remaining <= 0) {
      clearInterval(tstate.timerHandle);
      tstate.endByTime = true;
      showTestResults();
    }
  };
  tick();
  tstate.timerHandle = setInterval(tick, 250);
}

function renderTestQuestion() {
  const q = tstate.qList[tstate.idx];
  const total = tstate.qList.length;
  tstate.questionStartTs = Date.now();

  document.getElementById('testProgress').style.width = ((tstate.idx) / total * 100) + '%';
  document.getElementById('testProgressText').textContent =
    `第 ${tstate.idx + 1} 題 / 共 ${total} 題 · ${TOPICS[q.topic]?.emoji} ${TOPICS[q.topic]?.name} · ${LEVEL_LABEL[q.difficulty]}`;

  const hasVisualOpts = q.options.some(o => o.visual);
  const optClass = hasVisualOpts ? 'shape-options' : 'text-options';
  const optionsHtml = q.options.map((opt, i) => {
    const visualHtml = opt.visual ? renderVisual(opt.visual) : '';
    return `<button class="option test-option" data-idx="${i}" onclick="onTestSelect(${i})">
      <span class="label">${['A','B','C','D'][i]}</span>
      ${visualHtml}
      <span class="opt-text">${opt.text}</span>
    </button>`;
  }).join('');

  const isLast = tstate.idx === total - 1;
  document.getElementById('testQuizArea').innerHTML = `
    <div class="card test-card">
      <span class="card-badge">${TOPICS[q.topic]?.emoji} ${TOPICS[q.topic]?.name}</span>
      <span class="card-stars">${LEVEL_LABEL[q.difficulty]}</span>
      <div class="question-text">${q.prompt}</div>
      <div class="question-visual">${renderVisual(q.visual)}</div>
      <div class="options ${optClass}">${optionsHtml}</div>
      <div class="test-actions">
        <button class="btn btn-ghost" onclick="onTestPrev()" ${tstate.idx === 0 ? 'disabled' : ''}>← 上一題</button>
        <button class="btn btn-ghost" onclick="onTestSkip()">跳過</button>
        <button class="btn btn-primary" onclick="onTestNext()">${isLast ? '完成測驗 🏁' : '下一題 →'}</button>
      </div>
    </div>
  `;

  // 還原 picked 狀態 (使用者回頭看可以保持選擇)
  const picked = tstate.picked[tstate.idx];
  if (picked !== null && picked !== undefined) {
    const btn = document.querySelector(`.test-option[data-idx="${picked}"]`);
    if (btn) btn.classList.add('test-picked');
  }
}

export function onTestSelect(idx) {
  // 紀錄選擇,但測驗模式不會立刻給回饋
  tstate.picked[tstate.idx] = idx;
  document.querySelectorAll('.test-option').forEach((btn, i) => {
    btn.classList.toggle('test-picked', i === idx);
  });
}

export function onTestPrev() {
  if (tstate.idx > 0) {
    tstate.idx--;
    renderTestQuestion();
  }
}

export function onTestSkip() {
  // 留 null,前進
  if (tstate.idx < tstate.qList.length - 1) {
    tstate.idx++;
    renderTestQuestion();
  } else {
    showTestResults();
  }
}

export function onTestNext() {
  if (tstate.idx < tstate.qList.length - 1) {
    tstate.idx++;
    renderTestQuestion();
  } else {
    showTestResults();
  }
}

export function confirmExitTest() {
  if (!confirm('測驗還沒結束,離開會放棄目前答題紀錄。確定離開?')) return;
  clearInterval(tstate.timerHandle);
  hideAllScreens();
  document.getElementById('menuScreen').classList.remove('hide');
}

// ─────────────────────────────────────────────────────────────
// 結算
// ─────────────────────────────────────────────────────────────
function showTestResults() {
  clearInterval(tstate.timerHandle);
  const endTs = Date.now();
  const elapsedMs = endTs - tstate.startTs;

  // 對答案 + 寫紀錄 (mode='test')
  let correct = 0;
  for (let i = 0; i < tstate.qList.length; i++) {
    const q = tstate.qList[i];
    const picked = tstate.picked[i];
    const isCorrect = picked === q.answer;
    if (isCorrect) correct++;
    recordAttempt({
      question_id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      skill_codes: q.skill_codes || [],
      answer_idx: picked,
      correct: isCorrect,
      duration_ms: i === tstate.qList.length - 1 ? endTs - tstate.questionStartTs : 0,  // 細粒度時間沒抓,只記最後一題
      mode: 'test'
    });
  }

  const total = tstate.qList.length;
  const rate = Math.round(correct / total * 100);
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);

  let comment;
  if (tstate.endByTime) comment = `時間到!答對 ${correct} / ${total}`;
  else if (rate === 100) comment = `完美 100 分!🌟 你真厲害!`;
  else if (rate >= 80)   comment = `表現很棒!🚀`;
  else if (rate >= 60)   comment = `不錯喔!再多練幾次會更好 💪`;
  else                   comment = `辛苦了,我們一起繼續加油 🌱`;

  hideAllScreens();
  document.getElementById('testResultScreen').classList.remove('hide');
  document.getElementById('testFinalScore').textContent = comment;
  document.getElementById('testStatCorrect').textContent = correct;
  document.getElementById('testStatTotal').textContent = total;
  document.getElementById('testStatRate').textContent = rate + '%';
  document.getElementById('testStatTime').textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

  // 雷達 (cumulative)
  document.getElementById('testRadarSlot').innerHTML = `
    <div class="radar-section">
      <div class="radar-section-title">🌈 累計能力雷達</div>
      <div class="radar-wrap">${radarChart(aggregateByTopic(), { size: 300 })}</div>
      ${radarLegend(aggregateByTopic())}
    </div>
  `;

  // 逐題回顧 (這裡才看答案)
  renderTestReview();
}

function renderTestReview() {
  const list = document.getElementById('testReviewList');
  const html = tstate.qList.map((q, i) => {
    const picked = tstate.picked[i];
    const isCorrect = picked === q.answer;
    const status = picked === null ? 'skip' : (isCorrect ? 'right' : 'wrong');
    const pickedLabel = picked === null ? '未作答' : `你選 ${['A','B','C','D'][picked]}`;
    const correctLabel = `正解 ${['A','B','C','D'][q.answer]}`;
    return `<div class="review-item review-${status}">
      <div class="review-row">
        <span class="review-no">#${i + 1}</span>
        <span class="review-topic">${TOPICS[q.topic]?.emoji} ${TOPICS[q.topic]?.name} · ${LEVEL_LABEL[q.difficulty]}</span>
        <span class="review-status">${status === 'right' ? '✓' : status === 'wrong' ? '✗' : '–'}</span>
      </div>
      <div class="review-prompt">${q.prompt}</div>
      <div class="review-answers">
        <span class="review-picked">${pickedLabel}</span>
        ${status !== 'right' ? `<span class="review-correct">${correctLabel}</span>` : ''}
      </div>
      ${status !== 'right' ? `<details class="review-detail">
        <summary>看解析</summary>
        <div class="hint-question">${q.hint}</div>
        <div class="explanation">${q.explanation}</div>
        <div class="skill-tag">✨ ${q.skill}</div>
      </details>` : ''}
    </div>`;
  }).join('');
  list.innerHTML = html;
}

export function startNewTest() {
  openTestSetup();
}

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hideAllScreens() {
  ['menuScreen', 'quizScreen', 'finalScreen', 'testSetupScreen', 'testQuizScreen', 'testResultScreen']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hide');
    });
}
