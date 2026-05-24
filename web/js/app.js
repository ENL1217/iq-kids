// web/js/app.js
// 主流程:選單、答題、結算。
// 用 loader 從 JSON 載入題庫,用 renderer 把結構化 visual 變成 HTML。

import { renderVisual } from './renderer.js';
import { loadManifest, loadQuestions, pickQuestionIds } from './loader.js';
import {
  playCorrect, playWrong, playClick, burstConfetti, highlightCorrect,
  soundEnabled, toggleSound, unlockAudio
} from './feedback.js';
import { openFeedbackForm } from './feedback-form.js';
import { QUESTIONS_PER_LEVEL } from './config.js';

const TOPICS = {
  matrix:    { emoji: '🎯', name: '矩陣推理',   desc: '3×3 經典題型,找出橫和直的規律', cls: 'matrix' },
  sequence:  { emoji: '🔄', name: '圖形序列',   desc: '形狀、顏色、旋轉的規律變化',     cls: 'sequence' },
  spatial:   { emoji: '🧊', name: '空間能力',   desc: '折紙、立方體展開、方塊計數',     cls: 'spatial' },
  numseries: { emoji: '🔢', name: '進階數列',   desc: '從等差到費氏,數字裡的秘密',     cls: 'numseries' },
  analogy:   { emoji: '🔗', name: '類比推理',   desc: 'A 之於 B,如同 C 之於?',         cls: 'analogy' },
  multivar:  { emoji: '🌈', name: '多元素變化', desc: '同時追蹤形狀、顏色、數量等多變數', cls: 'multivar' }
};

const LEVEL_LABEL = { easy: '⭐ 入門', mid: '⭐⭐ 中階', hard: '⭐⭐⭐ 挑戰' };
const LEVEL_SHORT = { easy: '入門', mid: '中階', hard: '挑戰' };

const state = {
  topic: null,
  level: null,
  qList: [],
  idx: 0,
  correct: 0,
  answered: false,
  lastPicked: null,
  manifest: null
};

// ──────────────────────────────────────────────────────────────
async function init() {
  try {
    state.manifest = await loadManifest();
  } catch (e) {
    showFatalError(`載入題庫索引失敗:${e.message}`);
    return;
  }
  renderMenu();
  renderMuteButton();

  // 把流程函數掛上 window 供 inline onclick 呼叫
  Object.assign(window, {
    startLevel, goMenu, restartLevel, selectAnswer, nextQuestion,
    onMuteClick, onFeedbackClick
  });

  // 任意 user gesture 後解鎖 audio (iOS Safari)
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown',     unlockAudio, { once: true });
}

function renderMuteButton() {
  const btn = document.getElementById('muteBtn');
  if (!btn) return;
  btn.textContent = soundEnabled() ? '🔊' : '🔇';
  btn.title = soundEnabled() ? '音效開啟(點擊靜音)' : '音效靜音(點擊開啟)';
}

function onMuteClick() {
  toggleSound();
  renderMuteButton();
  if (soundEnabled()) playClick();
}

function onFeedbackClick() {
  const q = state.qList[state.idx];
  if (!q) return;
  const status = !state.answered ? 'unanswered'
                : state.lastPicked === q.answer ? 'correct' : 'wrong';
  openFeedbackForm({
    question: q,
    mode: 'learn',
    status,
    picked_idx: state.lastPicked ?? null
  });
}

function showFatalError(msg) {
  document.getElementById('menuGrid').innerHTML =
    `<div class="render-error" style="grid-column:1/-1;">${msg}</div>`;
}

// ──────────────────────────────────────────────────────────────
function renderMenu() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = Object.entries(TOPICS).map(([key, t]) => {
    const counts = ['easy', 'mid', 'hard'].map(d => state.manifest.topics[key]?.[d]?.length || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    const btn = (level, idx) => {
      const n = counts[idx];
      const disabled = n === 0 ? 'disabled' : '';
      const cls = ['easy', 'mid', 'hard'][idx];
      return `<button class="diff-btn ${cls}" ${disabled} onclick="startLevel('${key}','${level}')">${LEVEL_LABEL[level]} (${n})</button>`;
    };
    return `
      <div class="topic-card ${t.cls}">
        <span class="topic-emoji">${t.emoji}</span>
        <div class="topic-name">${t.name}</div>
        <div class="topic-desc">${t.desc}</div>
        <div class="topic-count">題庫:${total} 題</div>
        <div class="difficulty-row">
          ${btn('easy', 0)}
          ${btn('mid', 1)}
          ${btn('hard', 2)}
        </div>
      </div>
    `;
  }).join('');
}

// ──────────────────────────────────────────────────────────────
async function startLevel(topic, level) {
  state.topic = topic;
  state.level = level;
  state.idx = 0;
  state.correct = 0;
  state.answered = false;

  document.getElementById('menuScreen').classList.add('hide');
  document.getElementById('finalScreen').classList.add('hide');
  document.getElementById('quizScreen').classList.remove('hide');
  document.getElementById('quizArea').innerHTML = `<div class="loading">載入題目中</div>`;
  document.getElementById('progress').style.width = '0%';
  document.getElementById('progressText').textContent = `${TOPICS[topic].name} · ${LEVEL_LABEL[level]} · 準備中`;

  const allIds = state.manifest.topics[topic]?.[level] || [];
  if (allIds.length === 0) {
    document.getElementById('quizArea').innerHTML =
      `<div class="render-error">這個關卡還沒有題目,等題庫擴充中 ✨</div>
       <div style="margin-top:16px;"><button class="btn btn-ghost" onclick="goMenu()">回主選單</button></div>`;
    return;
  }

  const picked = pickQuestionIds(allIds, QUESTIONS_PER_LEVEL);
  try {
    state.qList = await loadQuestions(picked);
  } catch (e) {
    document.getElementById('quizArea').innerHTML =
      `<div class="render-error">載入題目失敗:${e.message}</div>`;
    return;
  }
  renderQuestion();
}

// ──────────────────────────────────────────────────────────────
function renderQuestion() {
  state.answered = false;
  const q = state.qList[state.idx];
  const topic = TOPICS[state.topic];
  const levelLabel = LEVEL_LABEL[state.level];

  document.getElementById('progress').style.width = (state.idx / state.qList.length * 100) + '%';
  document.getElementById('progressText').textContent =
    `${topic.name} · ${levelLabel} · 第 ${state.idx + 1} 題 / 共 ${state.qList.length} 題`;

  const hasVisualOptions = q.options.some(o => o.visual);
  const optClass = hasVisualOptions ? 'shape-options' : 'text-options';

  const optionsHtml = q.options.map((opt, i) => {
    const visualHtml = opt.visual ? renderVisual(opt.visual) : '';
    return `
      <button class="option" data-idx="${i}" onclick="selectAnswer(${i})">
        <span class="label">${['A','B','C','D'][i]}</span>
        ${visualHtml}
        <span class="opt-text">${opt.text}</span>
      </button>
    `;
  }).join('');

  document.getElementById('quizArea').innerHTML = `
    <div class="card">
      <span class="card-badge">${topic.emoji} ${topic.name}</span>
      <span class="card-stars">${levelLabel}</span>
      <div class="question-text">${q.prompt}</div>
      <div class="question-visual">${renderVisual(q.visual)}</div>
      <div class="options ${optClass}">${optionsHtml}</div>
      <div class="feedback" id="feedback"></div>
      <div class="actions" id="actions" style="display:none;">
        <button class="btn btn-primary" onclick="nextQuestion()">
          ${state.idx < state.qList.length - 1 ? '下一題 →' : '看成績 🏁'}
        </button>
      </div>
      <button class="feedback-btn" onclick="onFeedbackClick()" title="回饋這一題">
        💬 回饋這題
      </button>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
function selectAnswer(idx) {
  if (state.answered) return;
  state.answered = true;
  state.lastPicked = idx;
  const q = state.qList[state.idx];
  const correct = idx === q.answer;
  if (correct) state.correct++;

  const optionEls = document.querySelectorAll('.option');
  optionEls.forEach((btn, i) => {
    btn.disabled = true;
    if (i === idx) btn.classList.add(correct ? 'correct' : 'incorrect');
    if (i === q.answer && !correct) btn.classList.add('correct');
  });

  const feedback = document.getElementById('feedback');
  feedback.classList.add('show', correct ? 'correct' : 'incorrect');

  if (correct) {
    feedback.innerHTML = `
      <div class="feedback-header"><span class="feedback-emoji">🎉</span>答對了!</div>
      <div class="explanation">${q.explanation}</div>
      <div class="skill-tag">✨ 練到的能力:${q.skill}</div>
    `;
    // 視聽回饋:音效 + 大 emoji + confetti 粒子
    playCorrect();
    showCelebration();
    burstConfetti(10);
  } else {
    feedback.innerHTML = `
      <div class="feedback-header"><span class="feedback-emoji">💪</span>沒關係,我們一起想想!</div>
      <div class="hint-question">${q.hint}</div>
      <div class="explanation">${q.explanation}</div>
      <div class="skill-tag">✨ 練習重點:${q.skill}</div>
    `;
    // 答錯回饋:溫和音效 + 正解高亮 (shake 已在 .option.incorrect CSS)
    playWrong();
    highlightCorrect(optionEls[q.answer]);
  }
  document.getElementById('actions').style.display = 'flex';
}

// ──────────────────────────────────────────────────────────────
function nextQuestion() {
  state.idx++;
  if (state.idx >= state.qList.length) showFinal();
  else renderQuestion();
}

// ──────────────────────────────────────────────────────────────
function showFinal() {
  document.getElementById('progress').style.width = '100%';
  document.getElementById('quizScreen').classList.add('hide');
  document.getElementById('finalScreen').classList.remove('hide');

  const rate = Math.round(state.correct / state.qList.length * 100);
  const topic = TOPICS[state.topic];
  const levelShort = LEVEL_SHORT[state.level];
  let comment;
  if (rate === 100)      comment = `${topic.name}·${levelShort}關 完美通關!🌟`;
  else if (rate >= 80)   comment = `${topic.name}·${levelShort}關 表現很棒!🚀`;
  else if (rate >= 60)   comment = `${topic.name}·${levelShort}關 持續加油!💪`;
  else                   comment = `${topic.name}·${levelShort}關 多練幾次會更好!🌱`;

  document.getElementById('finalScore').textContent = comment;
  document.getElementById('statCorrect').textContent = state.correct;
  document.getElementById('statTotal').textContent = state.qList.length;
  document.getElementById('statRate').textContent = rate + '%';
}

// ──────────────────────────────────────────────────────────────
function goMenu() {
  document.getElementById('quizScreen').classList.add('hide');
  document.getElementById('finalScreen').classList.add('hide');
  document.getElementById('menuScreen').classList.remove('hide');
}

function restartLevel() {
  startLevel(state.topic, state.level);
}

function showCelebration() {
  const el = document.getElementById('celebration');
  el.textContent = ['🎉', '⭐', '🌟', '✨', '🎊'][Math.floor(Math.random() * 5)];
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

// 開機
init();
