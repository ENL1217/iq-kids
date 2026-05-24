// web/js/config.js
// 集中所有可調整的設定。日後改值不需要改主邏輯。

/**
 * 回饋送出 endpoint (Google Apps Script Web App URL)
 * 設定步驟見 docs/architecture.md §6.5
 *
 * Endpoint 對應 George 的 Google Sheet (IQ-Kids Feedback)。
 * 送出失敗時自動 fallback 到 localStorage queue (feedback-form.js)。
 *
 * 若要換 endpoint:直接改這裡,不用動其他檔案。
 */
export const FEEDBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzgCxJ6ssvM9JaEyNr8OXdz8jSBODAlWf2IFcNDtKIbo0PB1a-Z_hs0Nfwd2duNMNKh/exec';

/** 每關預設抽幾題;題庫不足會自動降為實際題數 */
export const QUESTIONS_PER_LEVEL = 5;

/** 音效預設音量 (0-1)。
 *  使用者可在設定頁的 slider 調整 (存 localStorage iq-kids:vol-correct / vol-wrong)。
 *  playCorrect/playWrong 內部還會再乘 1.3-1.4 倍 (因為 user feedback 認為太小聲)。
 *  之後想再調大,改這裡或 feedback.js 的 multiplier 都可以。 */
export const SOUND_VOLUME = {
  correct: 0.4,
  wrong:   0.32
};

/** 弱項推薦的 minimum sample size — 答過 ≥ N 題才會被判斷為弱項 */
export const WEAKNESS_MIN_SAMPLES = 3;
/** 弱項推薦的 rate threshold — 答對率 < N 才推薦再練 */
export const WEAKNESS_RATE_THRESHOLD = 0.7;

/** localStorage key prefix */
export const LS_PREFIX = 'iq-kids:';
