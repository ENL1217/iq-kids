// web/js/config.js
// 集中所有可調整的設定。日後改值不需要改主邏輯。

/**
 * 回饋送出 endpoint (Google Apps Script Web App URL)
 * 設定步驟見 docs/architecture.md §6.5
 *
 * 為空字串時:
 *   - 回饋按鈕仍可開啟 modal、收集資料
 *   - 送出時資料只存 localStorage queue,不上傳
 *   - 設定頁可手動「匯出回饋 JSON」
 */
export const FEEDBACK_ENDPOINT = '';

/** 每關預設抽幾題;題庫不足會自動降為實際題數 */
export const QUESTIONS_PER_LEVEL = 5;

/** 音效預設音量 (0-1)。
 *  playCorrect/playWrong 內部還會再乘 1.3-1.4 倍 (因為 user feedback 認為太小聲)。
 *  之後想再調大,改這裡或 feedback.js 的 multiplier 都可以。 */
export const SOUND_VOLUME = {
  correct: 0.4,
  wrong:   0.32
};

/** localStorage key prefix */
export const LS_PREFIX = 'iq-kids:';
