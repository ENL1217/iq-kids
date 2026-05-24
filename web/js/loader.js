// web/js/loader.js
// 從 questions/ 載入題目。

let _manifestCache = null;

/** 載入 manifest.json,結果會 cache 一次。 */
export async function loadManifest() {
  if (_manifestCache) return _manifestCache;
  const res = await fetch('./questions/manifest.json');
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  _manifestCache = await res.json();
  return _manifestCache;
}

/** 載入一個指定題目 ID,自動推斷路徑。 */
export async function loadQuestion(id) {
  const m = id.match(/^([a-z]+)-([a-z]+)-\d+$/);
  if (!m) throw new Error(`Invalid question id format: ${id}`);
  const [, topic, difficulty] = m;
  const url = `./questions/${topic}/${difficulty}/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load question ${id}: ${res.status}`);
  return res.json();
}

/** 並行載入多題。 */
export async function loadQuestions(ids) {
  return Promise.all(ids.map(loadQuestion));
}

/** 從 topic+difficulty 抽 N 題:優先沒答過的,然後最久沒答的。 */
export function pickQuestionIds(allIds, n, history = []) {
  // history: 最近答過的 ID 陣列 (從 recorder 取)
  const unseen = allIds.filter(id => !history.includes(id));
  const seen = allIds.filter(id => history.includes(id));
  const pool = [...shuffle(unseen), ...shuffle(seen)];
  return pool.slice(0, Math.min(n, allIds.length));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
