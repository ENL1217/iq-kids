// web/js/feedback-form.js
// 每題回饋按鈕 + modal + 送出邏輯。
// V1 設計參考 docs/architecture.md §6.5

import { FEEDBACK_ENDPOINT, LS_PREFIX } from './config.js';

const QUEUE_KEY = `${LS_PREFIX}feedback-queue`;

// 針對單題的 chips (沿用)
const FEEDBACK_CHIPS_QUESTION = [
  { id: 'too-hard',     emoji: '😵', label: '太難了' },
  { id: 'too-easy',     emoji: '😴', label: '太簡單' },
  { id: 'unclear',      emoji: '🤔', label: '題目敘述不清楚' },
  { id: 'wrong-q',      emoji: '❌', label: '我覺得題目錯了' },
  { id: 'wrong-a',      emoji: '❌', label: '我覺得答案錯了' },
  { id: 'visual-broken',emoji: '🎨', label: '視覺亂掉 / 看不清楚' },
  { id: 'other',        emoji: '💡', label: '其他想法' }
];

// 針對整個系統 / 網站的 chips
const FEEDBACK_CHIPS_SYSTEM = [
  { id: 'feature',         emoji: '💡', label: '功能建議' },
  { id: 'bug',             emoji: '🐛', label: '網站 bug' },
  { id: 'ui',              emoji: '🎨', label: 'UI / 視覺問題' },
  { id: 'mobile',          emoji: '📱', label: '手機體驗' },
  { id: 'topic-suggestion',emoji: '🎯', label: '希望多哪類題目' },
  { id: 'praise',          emoji: '🌟', label: '稱讚 / 感謝' },
  { id: 'other',           emoji: '💭', label: '其他想法' }
];

let _activeModal = null;

/**
 * 開啟回饋 modal。
 * @param {object} ctx - 當前題目 context
 *   ctx.question  — 題目物件 (id/topic/difficulty)
 *   ctx.mode      — 'learn' | 'test' | 'system'
 *   ctx.status    — 'unanswered' | 'correct' | 'wrong' | 'n/a'
 *   ctx.picked_idx — 0-based,使用者選了哪個 (若已答)
 */
export function openFeedbackForm(ctx) {
  if (_activeModal) closeModal();
  const modal = buildModal(ctx);
  document.body.appendChild(modal);
  _activeModal = modal;
  // 動畫:fade in
  requestAnimationFrame(() => modal.classList.add('show'));
}

/**
 * 系統 / 網站層級的回饋 (非針對單題)。
 * 送到同一個 Google Sheet,但 question_id = "__system__" 方便篩選。
 */
export function openSystemFeedback() {
  openFeedbackForm({
    question: { id: '__system__', topic: '__system__', difficulty: '__system__' },
    mode: 'system',
    status: 'n/a',
    picked_idx: null
  });
}

function closeModal() {
  if (!_activeModal) return;
  const m = _activeModal;
  _activeModal = null;
  m.classList.remove('show');
  setTimeout(() => m.remove(), 200);
}

function buildModal(ctx) {
  const root = document.createElement('div');
  root.className = 'fb-modal-root';

  const isSystem = ctx.mode === 'system';
  const chips = isSystem ? FEEDBACK_CHIPS_SYSTEM : FEEDBACK_CHIPS_QUESTION;
  const title = isSystem ? '💡 對網站有想法?' : '💬 回饋這一題';
  const placeholder = isSystem
    ? '想分享什麼都歡迎:功能建議、bug、想多看到什麼題目、整體感想...'
    : '告訴我們你的想法,讓題目更好...';

  const chipsHtml = chips.map(c => `
    <button type="button" class="fb-chip" data-chip="${c.id}">
      <span class="fb-chip-emoji">${c.emoji}</span>
      <span class="fb-chip-label">${c.label}</span>
    </button>
  `).join('');

  const qid = ctx.question?.id || '(unknown)';
  // 系統回饋不顯示題目 ID,顯示「整個網站」標籤
  const headerSubHtml = isSystem
    ? `<div class="fb-qid"><span class="fb-tag fb-tag-sys">🌐 對整個網站的回饋</span></div>`
    : `<div class="fb-qid">題目編號:<code>${qid}</code></div>`;

  root.innerHTML = `
    <div class="fb-backdrop"></div>
    <div class="fb-modal" role="dialog" aria-label="${title}">
      <div class="fb-header">
        <div class="fb-title">${title}</div>
        <button type="button" class="fb-close" aria-label="關閉">×</button>
      </div>
      ${headerSubHtml}
      <div class="fb-section-label">想說什麼?可以多選</div>
      <div class="fb-chips">${chipsHtml}</div>
      <div class="fb-section-label">補充說明 (選填)</div>
      <textarea class="fb-textarea" placeholder="${placeholder}" maxlength="500"></textarea>
      <div class="fb-footer">
        <button type="button" class="btn btn-ghost fb-cancel">取消</button>
        <button type="button" class="btn btn-primary fb-send">送出 ✨</button>
      </div>
      <div class="fb-toast" aria-live="polite"></div>
    </div>
  `;

  // 事件繫結
  root.querySelector('.fb-backdrop').addEventListener('click', closeModal);
  root.querySelector('.fb-close').addEventListener('click', closeModal);
  root.querySelector('.fb-cancel').addEventListener('click', closeModal);

  // chips toggle
  root.querySelectorAll('.fb-chip').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  // send
  root.querySelector('.fb-send').addEventListener('click', async () => {
    const selectedChips = [...root.querySelectorAll('.fb-chip.selected')].map(b => b.dataset.chip);
    const comment = root.querySelector('.fb-textarea').value.trim();

    if (selectedChips.length === 0 && !comment) {
      showToast(root, '至少選一個或寫一點補充?', 'warn');
      return;
    }

    const payload = buildPayload(ctx, selectedChips, comment);
    const sendBtn = root.querySelector('.fb-send');
    sendBtn.disabled = true;
    sendBtn.textContent = '送出中...';

    const result = await submitFeedback(payload);
    if (result.ok) {
      showToast(root, `謝謝你的回饋 ✨${result.queued ? '（已暫存,下次自動送出）' : ''}`, 'ok');
      setTimeout(closeModal, 1500);
    } else {
      sendBtn.disabled = false;
      sendBtn.textContent = '送出 ✨';
      showToast(root, `送出失敗,已暫存:${result.error}`, 'warn');
      setTimeout(closeModal, 2000);
    }
  });

  // ESC 關閉
  root._escHandler = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', root._escHandler);
  setTimeout(() => {
    if (!_activeModal) document.removeEventListener('keydown', root._escHandler);
  }, 0);

  return root;
}

function showToast(root, msg, kind = 'ok') {
  const toast = root.querySelector('.fb-toast');
  toast.textContent = msg;
  toast.className = `fb-toast show ${kind}`;
}

function buildPayload(ctx, types, comment) {
  return {
    question_id: ctx.question?.id || 'unknown',
    topic: ctx.question?.topic || '',
    difficulty: ctx.question?.difficulty || '',
    types,
    comment,
    status: ctx.status || 'unanswered',
    picked_idx: ctx.picked_idx ?? null,
    correct_idx: ctx.question?.answer ?? null,
    mode: ctx.mode || 'learn',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    user_agent: navigator.userAgent,
    ts: new Date().toISOString()
  };
}

// ──────────────────────────────────────────────────────────────
// SUBMIT — try POST,失敗或無 endpoint 就 queue 到 localStorage
// ──────────────────────────────────────────────────────────────
async function submitFeedback(payload) {
  // 沒設 endpoint → 直接存 queue
  if (!FEEDBACK_ENDPOINT) {
    enqueueFeedback(payload);
    return { ok: true, queued: true };
  }

  try {
    const res = await fetch(FEEDBACK_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',  // Google Apps Script 的 doPost CORS 不好處理,no-cors 模式可送但讀不到 response
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // text/plain 避免 preflight
      body: JSON.stringify(payload)
    });
    // no-cors mode: response opaque,假設成功
    return { ok: true, queued: false };
  } catch (e) {
    enqueueFeedback(payload);
    return { ok: false, error: e.message, queued: true };
  }
}

function enqueueFeedback(payload) {
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    queue.push(payload);
    // 上限 100 筆,避免 localStorage 爆
    while (queue.length > 100) queue.shift();
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // 靜默
  }
}

/** 取得目前 queue 內容 (給「匯出回饋 JSON」用) */
export function getFeedbackQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

/** 清空 queue */
export function clearFeedbackQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/** 匯出成 JSON 檔讓使用者下載 */
export function exportFeedbackQueue() {
  const queue = getFeedbackQueue();
  if (queue.length === 0) return false;
  const blob = new Blob([JSON.stringify(queue, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iq-kids-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return true;
}
