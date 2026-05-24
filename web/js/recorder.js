// web/js/recorder.js
// 個人答題紀錄系統 — 完全本地、完全匿名。
// 資料儲存在 localStorage,清瀏覽器就消失 (符合兒童資料最小化原則)。

import { LS_PREFIX } from './config.js';

const ATTEMPTS_KEY = `${LS_PREFIX}attempts`;
const MAX_ATTEMPTS = 1000;  // localStorage 上限 5MB,1000 筆綽綽有餘

/**
 * 一筆答題紀錄 schema:
 *   { ts, question_id, topic, difficulty, skill_codes, correct, duration_ms, mode }
 */

/** 新增一筆紀錄 */
export function recordAttempt(attempt) {
  const all = getAttempts();
  all.push({ ts: Date.now(), ...attempt });
  // FIFO truncate 避免爆 localStorage
  while (all.length > MAX_ATTEMPTS) all.shift();
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all));
  } catch (e) {
    // QuotaExceededError: 砍一半再試
    while (all.length > MAX_ATTEMPTS / 2) all.shift();
    try { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(all)); } catch (e2) {}
  }
}

/** 取得所有紀錄 (依時間遞增排列) */
export function getAttempts() {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

/** 清除全部紀錄 */
export function clearAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
}

/**
 * 依題型聚合:回傳每題型的 total / correct / rate
 * 輸入可選 attempts (預設全部),用於只看某 session
 */
export function aggregateByTopic(attempts = getAttempts()) {
  const out = {};
  for (const a of attempts) {
    if (!out[a.topic]) out[a.topic] = { total: 0, correct: 0, rate: 0 };
    out[a.topic].total++;
    if (a.correct) out[a.topic].correct++;
  }
  for (const k of Object.keys(out)) {
    out[k].rate = out[k].total === 0 ? 0 : out[k].correct / out[k].total;
  }
  return out;
}

/** 依 skill_code 聚合,給未來進階雷達圖用 */
export function aggregateBySkill(attempts = getAttempts()) {
  const out = {};
  for (const a of attempts) {
    for (const sk of (a.skill_codes || [])) {
      if (!out[sk]) out[sk] = { total: 0, correct: 0, rate: 0 };
      out[sk].total++;
      if (a.correct) out[sk].correct++;
    }
  }
  for (const k of Object.keys(out)) {
    out[k].rate = out[k].total === 0 ? 0 : out[k].correct / out[k].total;
  }
  return out;
}

/** 取最近 N 筆錯題,最新的在前 */
export function getRecentWrong(n = 20) {
  return getAttempts().filter(a => !a.correct).slice(-n).reverse();
}

/** 取某個 session 範圍的錯題 (用 ts 起始點) */
export function getWrongSince(tsStart) {
  return getAttempts().filter(a => !a.correct && a.ts >= tsStart);
}

/** 總題數 / 總對數 */
export function lifetimeStats() {
  const attempts = getAttempts();
  const correct = attempts.filter(a => a.correct).length;
  return {
    total: attempts.length,
    correct,
    rate: attempts.length === 0 ? 0 : correct / attempts.length
  };
}

/** 匯出成下載 JSON */
export function exportAttempts() {
  const data = getAttempts();
  if (data.length === 0) return { ok: false, reason: 'empty' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iq-kids-records-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
  return { ok: true, count: data.length };
}
