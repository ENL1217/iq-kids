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

/**
 * 取得當前實際音量 (從 localStorage 讀,沒設過就用 config 預設)。
 * @param {'correct'|'wrong'} kind
 * @returns {number} 0-1
 */
export function getVolume(kind) {
  const key = `${LS_PREFIX}vol-${kind}`;
  const raw = localStorage.getItem(key);
  if (raw === null) return SOUND_VOLUME[kind];
  const n = parseFloat(raw);
  if (isNaN(n) || n < 0 || n > 1) return SOUND_VOLUME[kind];
  return n;
}

/** 設定音量 (0-1,寫進 localStorage) */
export function setVolume(kind, volume) {
  const clamped = Math.max(0, Math.min(1, volume));
  localStorage.setItem(`${LS_PREFIX}vol-${kind}`, String(clamped));
}

/**
 * 答對:C 大三和弦琶音 + 拍手雜訊
 * 總時長 ~700ms。音量讀 localStorage (使用者可在設定頁調)。
 */
export function playCorrect() {
  if (!soundEnabled()) return;
  const baseVol = getVolume('correct');

  // C5 → E5 → G5 → C6 上行琶音 (bell-like 三角波)
  // 每音 220ms,稍微重疊讓它連貫成一個「升起」的感覺
  const notes = [
    { freq: 523.25, when:   0, dur: 200 },  // C5
    { freq: 659.25, when: 110, dur: 200 },  // E5
    { freq: 783.99, when: 220, dur: 200 },  // G5
    { freq: 1046.5, when: 330, dur: 380 }   // C6 (拉長,當高潮)
  ];
  notes.forEach(n => {
    setTimeout(() => {
      // triangle wave + 微微的 detune 模擬鐘聲泛音
      playTone(n.freq, n.dur, baseVol * 1.4, n.freq * 1.005, 'triangle');
    }, n.when);
  });

  // 收尾:輕量拍手雜訊 (在最後一音中段疊上)
  setTimeout(() => playApplause(450, 0.18), 380);
}

/**
 * 拍手雜訊 — 用 filtered noise burst 模擬掌聲。
 * 不是真實錄音,純算法生成,小聲不擾人但有「氛圍」。
 */
function playApplause(duration = 400, volume = 0.18) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try {
    // 用 noise buffer 當源頭
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * (duration / 1000));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // 多個「掌」: 每秒 ~14 個 clap pulse,每個 pulse 是快速衰減的雜訊
    const claps = 14;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const phase = (t * claps) % 1;
      // 每個 phase 開頭尖銳的 burst (exponential decay)
      const env = Math.exp(-phase * 12);
      const noise = (Math.random() - 0.5) * 2;
      data[i] = noise * env;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // bandpass 讓它聽起來像「掌聲」而不是「沙沙聲」
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;
    // 整體 envelope:fade in fast, fade out slow
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.05);
    gain.gain.setValueAtTime(volume, now + duration / 1000 - 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration / 1000 + 0.05);
  } catch (e) {
    // 靜默
  }
}

/** 答錯:溫和兩聲下行,不刺耳但讓孩子知道要重新想 */
export function playWrong() {
  if (!soundEnabled()) return;
  const baseVol = getVolume('wrong');
  // 兩個音:稍高 → 較低,間隔短
  playTone(440, 160, baseVol * 1.4, 360, 'sine');
  setTimeout(() => playTone(360, 220, baseVol * 1.3, 280, 'sine'), 140);
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
