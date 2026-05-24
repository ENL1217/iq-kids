// web/js/settings.js
// 設定 modal — 整合三處散落的設定:音效、紀錄、回饋 queue、關於

import {
  soundEnabled, toggleSound, getVolume, setVolume, playCorrect, playWrong
} from './feedback.js';
import {
  lifetimeStats, exportAttempts, clearAttempts
} from './recorder.js';
import { getFeedbackQueue, exportFeedbackQueue, clearFeedbackQueue } from './feedback-form.js';

let _activeModal = null;

export function openSettings() {
  if (_activeModal) closeSettings();
  const modal = buildModal();
  document.body.appendChild(modal);
  _activeModal = modal;
  requestAnimationFrame(() => modal.classList.add('show'));
}

export function closeSettings() {
  if (!_activeModal) return;
  const m = _activeModal;
  _activeModal = null;
  m.classList.remove('show');
  setTimeout(() => m.remove(), 200);
}

function buildModal() {
  const root = document.createElement('div');
  root.className = 'settings-modal-root fb-modal-root';

  const lifetime = lifetimeStats();
  const fbQueueCount = getFeedbackQueue().length;
  const correctVol = Math.round(getVolume('correct') * 100);
  const wrongVol = Math.round(getVolume('wrong') * 100);
  const soundOn = soundEnabled();

  root.innerHTML = `
    <div class="fb-backdrop"></div>
    <div class="settings-modal" role="dialog" aria-label="設定">
      <div class="fb-header">
        <div class="fb-title">⚙️ 設定</div>
        <button type="button" class="fb-close" aria-label="關閉">×</button>
      </div>

      <!-- 音效 -->
      <div class="settings-section">
        <div class="settings-section-title">🔊 音效</div>

        <label class="settings-toggle-row">
          <span class="settings-label">啟用音效</span>
          <input type="checkbox" id="setSoundOn" ${soundOn ? 'checked' : ''}>
          <span class="settings-toggle-switch"></span>
        </label>

        <div class="settings-slider-row">
          <span class="settings-label">答對音量</span>
          <input type="range" id="setVolCorrect" min="0" max="100" value="${correctVol}" class="settings-slider">
          <span class="settings-slider-value" id="setVolCorrectVal">${correctVol}</span>
          <button type="button" class="settings-test-btn" id="testCorrect" title="試聽">🔉</button>
        </div>

        <div class="settings-slider-row">
          <span class="settings-label">答錯音量</span>
          <input type="range" id="setVolWrong" min="0" max="100" value="${wrongVol}" class="settings-slider">
          <span class="settings-slider-value" id="setVolWrongVal">${wrongVol}</span>
          <button type="button" class="settings-test-btn" id="testWrong" title="試聽">🔉</button>
        </div>
      </div>

      <!-- 紀錄 -->
      <div class="settings-section">
        <div class="settings-section-title">📊 我的學習紀錄</div>
        <div class="settings-stats">
          <div>累計答對 <strong>${lifetime.correct}</strong> 題 / 共 <strong>${lifetime.total}</strong> 題${lifetime.total > 0 ? ` · 答對率 ${Math.round(lifetime.rate * 100)}%` : ''}</div>
        </div>
        <div class="settings-button-row">
          <button type="button" class="settings-btn" id="exportRecBtn">📤 匯出紀錄 JSON</button>
          <button type="button" class="settings-btn danger" id="clearRecBtn">🗑 清除紀錄</button>
        </div>
      </div>

      <!-- 回饋 queue -->
      <div class="settings-section">
        <div class="settings-section-title">💬 我送過的回饋</div>
        <div class="settings-stats">
          ${fbQueueCount > 0
            ? `本機暫存 <strong>${fbQueueCount}</strong> 筆未送出回饋 (網路斷線時自動 queue)`
            : `沒有本機暫存的回饋。送出的回饋已寫進 Google Sheet`}
        </div>
        <div class="settings-button-row">
          <button type="button" class="settings-btn" id="exportFbBtn" ${fbQueueCount === 0 ? 'disabled' : ''}>📤 匯出回饋 JSON</button>
          <button type="button" class="settings-btn danger" id="clearFbBtn" ${fbQueueCount === 0 ? 'disabled' : ''}>🗑 清空 queue</button>
        </div>
      </div>

      <!-- 關於 -->
      <div class="settings-section">
        <div class="settings-section-title">ℹ️ 關於</div>
        <div class="settings-about">
          <div class="settings-about-row">📚 題庫:<strong id="setBankSize">載入中...</strong></div>
          <div class="settings-about-row">🔒 資料只存本機,絕不上傳到任何伺服器</div>
          <div class="settings-about-row">📄 開源 (MIT) · <a href="https://github.com/ENL1217/iq-kids" target="_blank" rel="noopener" class="settings-link">GitHub</a></div>
        </div>
        <div class="settings-button-row">
          <a href="about.html" class="settings-btn">💗 關於這個專案</a>
        </div>
      </div>

      <div class="fb-toast" aria-live="polite" id="setToast"></div>
    </div>
  `;

  // 事件繫結
  root.querySelector('.fb-backdrop').addEventListener('click', closeSettings);
  root.querySelector('.fb-close').addEventListener('click', closeSettings);

  // 音效開關
  root.querySelector('#setSoundOn').addEventListener('change', e => {
    if (e.target.checked !== soundEnabled()) toggleSound();
  });

  // 音量 sliders
  const correctSlider = root.querySelector('#setVolCorrect');
  const correctVal = root.querySelector('#setVolCorrectVal');
  correctSlider.addEventListener('input', () => {
    correctVal.textContent = correctSlider.value;
    setVolume('correct', correctSlider.value / 100);
  });
  const wrongSlider = root.querySelector('#setVolWrong');
  const wrongVal = root.querySelector('#setVolWrongVal');
  wrongSlider.addEventListener('input', () => {
    wrongVal.textContent = wrongSlider.value;
    setVolume('wrong', wrongSlider.value / 100);
  });
  root.querySelector('#testCorrect').addEventListener('click', () => playCorrect());
  root.querySelector('#testWrong').addEventListener('click', () => playWrong());

  // 紀錄管理
  root.querySelector('#exportRecBtn').addEventListener('click', () => {
    const r = exportAttempts();
    if (!r.ok) {
      showToast(root, '還沒有紀錄可匯出。先玩幾題吧!', 'warn');
    } else {
      showToast(root, `匯出 ${r.count} 筆 ✨`, 'ok');
    }
  });
  root.querySelector('#clearRecBtn').addEventListener('click', () => {
    if (!confirm('確定要清除所有答題紀錄嗎?這個動作無法復原。')) return;
    clearAttempts();
    showToast(root, '紀錄已清除', 'ok');
    setTimeout(() => closeSettings(), 1200);
  });

  // 回饋 queue
  root.querySelector('#exportFbBtn').addEventListener('click', () => {
    const ok = exportFeedbackQueue();
    showToast(root, ok ? '匯出回饋 JSON ✨' : 'queue 是空的', ok ? 'ok' : 'warn');
  });
  root.querySelector('#clearFbBtn').addEventListener('click', () => {
    if (!confirm('清空回饋 queue?這些回饋會永久消失。')) return;
    clearFeedbackQueue();
    showToast(root, 'queue 已清空', 'ok');
    setTimeout(() => closeSettings(), 1200);
  });

  // 載入題庫數量 (async,從 manifest)
  fetch('./questions/manifest.json').then(r => r.json()).then(m => {
    let total = 0;
    for (const t of Object.values(m.topics || {})) {
      total += (t.easy?.length || 0) + (t.mid?.length || 0) + (t.hard?.length || 0);
    }
    const el = root.querySelector('#setBankSize');
    if (el) el.textContent = `${total} 題 (持續擴充中)`;
  }).catch(() => {
    const el = root.querySelector('#setBankSize');
    if (el) el.textContent = '(無法載入)';
  });

  // ESC 關閉
  root._escHandler = (e) => { if (e.key === 'Escape') closeSettings(); };
  document.addEventListener('keydown', root._escHandler);

  return root;
}

function showToast(root, msg, kind = 'ok') {
  const toast = root.querySelector('#setToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `fb-toast show ${kind}`;
  setTimeout(() => toast.classList.remove('show'), 2000);
}
