// web/js/feedback.js
// 學習模式的視聽回饋:Web Audio API 音效 + DOM 動畫粒子。
// 完全不用音檔/圖片,純算法生成。

import { SOUND_VOLUME, LS_PREFIX } from './config.js';

// ──────────────────────────────────────────────────────────────
// AUDIO (Web Audio API)
// ──────────────────────────────────────────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (_audioCtx) return _audioCtx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
    return _audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * 播放一個 tone。
 * @param {number} freqStart - 起始頻率 Hz
 * @param {number} duration - 持續時間 ms
 * @param {number} volume - 音量 0-1
 * @param {number|null} freqEnd - 結束頻率;有的話會 ramp
 * @param {string} type - 波形 'sine' | 'triangle' | 'square'
 */
function playTone(freqStart, duration, volume, freqEnd = null, type = 'sine') {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration / 1000);
    }
    // 緩入緩出避免 click
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

    osc.start(now);
    osc.stop(now + duration / 1000 + 0.05);
  } catch (e) {
    // 靜默失敗,音效失敗不應該影響學習
  }
}

/** 答對:短促上升的「叮!」 */
export function playCorrect() {
  if (!soundEnabled()) return;
  playTone(660, 90, SOUND_VOLUME.correct, 880, 'sine');
  setTimeout(() => playTone(880, 120, SOUND_VOLUME.correct, 1100, 'sine'), 80);
}

/** 答錯:低沉柔和「嗯~」(絕不能像電玩 buzzer) */
export function playWrong() {
  if (!soundEnabled()) return;
  playTone(380, 220, SOUND_VOLUME.wrong, 280, 'sine');
}

/** 點擊聲(輕、不會打斷思考) */
export function playClick() {
  if (!soundEnabled()) return;
  playTone(800, 30, 0.1, null, 'sine');
}

// ──────────────────────────────────────────────────────────────
// MUTE TOGGLE (localStorage)
// ──────────────────────────────────────────────────────────────
const SOUND_KEY = `${LS_PREFIX}sound`;

export function soundEnabled() {
  return localStorage.getItem(SOUND_KEY) !== 'off';
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
}

export function toggleSound() {
  const newState = !soundEnabled();
  setSoundEnabled(newState);
  return newState;
}

/** 在第一次 user gesture 後解鎖 audio context (iOS Safari 限制) */
export function unlockAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// ──────────────────────────────────────────────────────────────
// CONFETTI (DOM 粒子,純 Web Animations API)
// ──────────────────────────────────────────────────────────────
const CONFETTI_EMOJIS = ['🎉', '⭐', '🌟', '✨', '🎊', '💫', '🌈'];

/** 答對時撒小 emoji 粒子。9-12 個,從畫面中央向四周飛出。 */
export function burstConfetti(count = 10) {
  for (let i = 0; i < count; i++) {
    spawnParticle();
  }
}

function spawnParticle() {
  const particle = document.createElement('div');
  particle.textContent = CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)];
  particle.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    pointer-events: none;
    z-index: 1000;
    font-size: ${20 + Math.random() * 28}px;
    user-select: none;
    will-change: transform, opacity;
  `;
  document.body.appendChild(particle);

  // 隨機飛行方向:300-500px 半徑,角度 360°
  const angle = Math.random() * Math.PI * 2;
  const distance = 200 + Math.random() * 280;
  const dx = Math.cos(angle) * distance;
  const dy = Math.sin(angle) * distance - 80;  // 偏上一點,模擬重力剛開始
  const rotation = (Math.random() - 0.5) * 720;
  const scale = 0.7 + Math.random() * 0.8;

  particle.animate([
    {
      transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)',
      opacity: 1
    },
    {
      transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5}px)) scale(${scale}) rotate(${rotation * 0.5}deg)`,
      opacity: 1,
      offset: 0.4
    },
    {
      transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 120}px)) scale(${scale * 0.7}) rotate(${rotation}deg)`,
      opacity: 0
    }
  ], {
    duration: 1100 + Math.random() * 300,
    easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)',
    fill: 'forwards'
  });

  setTimeout(() => particle.remove(), 1600);
}

// ──────────────────────────────────────────────────────────────
// PULSE / SHAKE — 加強現有 CSS 動畫 (option 已有 pop/shake,這裡是「補強」)
// ──────────────────────────────────────────────────────────────

/** 在正解按鈕上加一層「呼吸」高亮,提示「對的答案長這樣」 */
export function highlightCorrect(optionEl) {
  if (!optionEl) return;
  optionEl.animate([
    { boxShadow: '0 0 0 0 rgba(107, 203, 119, 0.6)' },
    { boxShadow: '0 0 0 12px rgba(107, 203, 119, 0)' }
  ], {
    duration: 1200,
    iterations: 2,
    easing: 'ease-out'
  });
}
