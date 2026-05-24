# Apps Script 安全強化 setup

這份文件給你 (或未來接手的人) 設定 Google Apps Script feedback endpoint 用的範本，
含 rate limit、長度檢查、Origin 驗證、honeypot 等防護。

對應到 `web/js/config.js` 裡的 `FEEDBACK_ENDPOINT`。

---

## 為什麼需要這些防護

`config.js` hardcode 的 endpoint 等於**全網路任何人都能 POST**。風險：

1. **DoS / spam**: 攻擊者可一秒打數百下,吃光你 Google 帳號每日 Apps Script 額度 (~90 分鐘執行時間/天),
   會連帶**影響你帳號上其他 Apps Script 服務**。
2. **Sheet 灌爆**: 不限長度可灌幾十萬列垃圾。
3. **以你 Google 身分執行**: Apps Script 部署為 `Execute as: Me + Anyone` (匿名兒童需要),
   表示任何人 POST 時是用**你的 Google 權限**跑 — `appsscript.json` 的 oauthScopes 不能太寬。

---

## Step 1: appsscript.json (scope 鎖到最小)

進 Apps Script project → 左側「Project Settings」⚙️ → 勾「Show 'appsscript.json' manifest file」。

回到編輯器,點 `appsscript.json`,確保**只有** `spreadsheets` scope:

```json
{
  "timeZone": "Asia/Taipei",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

⚠️ **絕對不要出現**:
- `https://www.googleapis.com/auth/drive` — 全 Drive 讀寫
- `https://www.googleapis.com/auth/gmail.send` — 寄信
- `https://www.googleapis.com/auth/calendar` — 行事曆
- `https://www.googleapis.com/auth/contacts` — 聯絡人
- `https://www.googleapis.com/auth/script.external_request` — 對外 fetch (除非真的需要)

如果你 code 沒用到這些 service,oauthScopes 應該是空的或只有 spreadsheets。

---

## Step 2: doPost.gs (rate limit + 長度檢查 + Origin)

整個 `Code.gs` 換成以下版本:

```javascript
// =============================================================
// IQ-Kids feedback endpoint — security-hardened v2
//
// 設計筆記:
//   - 此 script 為 container-bound (從 Sheet 內建立),所以用
//     getActiveSpreadsheet() 不需要 SHEET_ID 常數
//   - 欄位順序 + 名稱必須對齊 web/js/feedback-form.js buildPayload()
//
// Protections:
//   1. Origin/Referer 白名單 — 只接受 GitHub Pages 站點
//   2. 欄位白名單 + 長度上限 — 防超長 payload
//   3. PropertiesService rate limit — 同一 client hash 60 秒最多 5 筆
//   4. Honeypot 欄位 — bot 若填會被拒
//   5. 最小化 response — 不洩露內部狀態
// =============================================================

const ALLOWED_ORIGINS = ['https://enl1217.github.io'];

// 欄位上限 (字元數) — key 對應前端 buildPayload 欄位名稱
const LIMITS = {
  question_id: 50,
  topic: 30,
  difficulty: 10,
  status: 20,
  mode: 20,
  comment: 500,
  user_agent: 200,
  viewport: 20
};

// Rate limit: 同一 client hash 在 RATE_WINDOW_SEC 秒內最多 RATE_MAX 筆
const RATE_WINDOW_SEC = 60;
const RATE_MAX = 5;

function doPost(e) {
  try {
    // ① Origin / Referer 檢查
    const origin = (e.headers && (e.headers.Origin || e.headers.origin)) || '';
    const referer = (e.headers && (e.headers.Referer || e.headers.referer)) || '';
    const sourceOk = ALLOWED_ORIGINS.some(allowed =>
      origin.startsWith(allowed) || referer.startsWith(allowed)
    );
    // 本地測試可能沒 origin,放行;有 origin 但不在白名單則 reject
    if (!sourceOk && origin) {
      return jsonResponse({ status: 'rejected', reason: 'origin' });
    }

    // ② Parse payload
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse({ status: 'rejected', reason: 'parse' });
    }

    // ③ Honeypot (bot 會填,真使用者看不到)
    if (payload.website && payload.website.length > 0) {
      return jsonResponse({ status: 'ok' });
    }

    // ④ 欄位白名單 + 長度檢查
    const cleaned = {};
    for (const [key, max] of Object.entries(LIMITS)) {
      const val = payload[key];
      if (typeof val === 'string' && val.length > 0) {
        cleaned[key] = val.substring(0, max);
      }
    }
    // types 是 array,轉成 comma-joined string
    if (Array.isArray(payload.types)) {
      cleaned.types = payload.types.slice(0, 5)
        .map(t => String(t).substring(0, 30))
        .join(',');
    }

    // 必要欄位:至少要有 question_id (單題回饋) 或 comment (system feedback)
    if (!cleaned.question_id && !cleaned.comment) {
      return jsonResponse({ status: 'rejected', reason: 'missing_field' });
    }

    // ⑤ Rate limit (per-client hash via UA + referer)
    const props = PropertiesService.getScriptProperties();
    const clientHash = hashClient(payload, e);
    const rateKey = 'rate:' + clientHash;
    const now = Math.floor(Date.now() / 1000);
    const rateData = JSON.parse(props.getProperty(rateKey) || '{"count":0,"windowStart":0}');
    if (now - rateData.windowStart > RATE_WINDOW_SEC) {
      rateData.windowStart = now;
      rateData.count = 0;
    }
    rateData.count++;
    if (rateData.count > RATE_MAX) {
      props.setProperty(rateKey, JSON.stringify(rateData));
      return jsonResponse({ status: 'rejected', reason: 'rate_limit' });
    }
    props.setProperty(rateKey, JSON.stringify(rateData));

    // ⑥ 寫入 Sheet (沿用 getActiveSpreadsheet,欄位順序對齊舊資料)
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow([
      new Date(),
      cleaned.question_id || '',
      cleaned.types || '',
      cleaned.comment || '',
      cleaned.topic || '',
      cleaned.difficulty || '',
      cleaned.status || '',
      cleaned.user_agent || '',
      cleaned.viewport || '',
      cleaned.mode || ''
    ]);

    return jsonResponse({ status: 'ok' });
  } catch (err) {
    return jsonResponse({ status: 'error' });
  }
}

function doGet(e) {
  return jsonResponse({ status: 'not_found' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function hashClient(payload, e) {
  const ua = (payload.user_agent || '').substring(0, 50);
  const ref = (e.headers && e.headers.Referer) || '';
  const raw = ua + '|' + ref;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h) + raw.charCodeAt(i);
    h |= 0;
  }
  return String(h);
}
```

---

## Step 3: 前端加 honeypot 欄位 (擋 dumb bot)

在 `web/js/feedback-form.js` 的 modal HTML 加一個隱藏欄位:

```html
<!-- Honeypot — 機器人會自動填,真使用者看不到 -->
<input type="text" name="website" id="fb-honeypot" autocomplete="off"
       tabindex="-1" style="position:absolute; left:-9999px; visibility:hidden;">
```

送出時把這個欄位的 value 加到 payload (即使是空字串)。Server 端會檢查若有值就拒絕。

---

## Step 4: 部署 Apps Script

1. 在 Apps Script editor 右上「Deploy」→「Manage deployments」
2. 找到現有 deployment → 編輯 (鉛筆 icon)
3. 「New version」(每次改 code 都要建新版,否則 endpoint 仍跑舊版)
4. 設定:
   - **Execute as**: `Me (enl1217@gmail.com)`
   - **Who has access**: `Anyone`
5. 「Deploy」
6. **URL 不會變**,所以 `config.js` 的 FEEDBACK_ENDPOINT 不用改

⚠️ **如果你只按 Save 而沒 Deploy New version,改動不會生效。**

---

## Step 5: 驗證

部署完後從瀏覽器 console 跑一次 feedback,看 Sheet 是否有新列。
然後測試:

```javascript
// 在 https://enl1217.github.io/iq-kids/ 的 console 跑
// (1) 正常送出
fetch('https://script.google.com/macros/s/AKfycb.../exec', {
  method: 'POST', mode: 'no-cors',
  body: JSON.stringify({type: 'system', comment: 'test'})
});
// → 應該 OK,Sheet 多一列

// (2) 連續打 10 次 — 觀察是否被 rate limit 擋
for (let i = 0; i < 10; i++) {
  fetch('https://script.google.com/macros/s/AKfycb.../exec', {
    method: 'POST', mode: 'no-cors',
    body: JSON.stringify({type: 'system', comment: 'spam ' + i})
  });
}
// → 前 5 筆會進 sheet,後 5 筆會被擋 (但 no-cors 前端看不到)
//   你可以開 Apps Script Executions 看哪些被 reject

// (3) 灌超長 comment
fetch('https://script.google.com/macros/s/AKfycb.../exec', {
  method: 'POST', mode: 'no-cors',
  body: JSON.stringify({type: 'system', comment: 'x'.repeat(10000)})
});
// → 進 sheet 後 comment 欄會被截到 500 字
```

驗證完畢後可以在 Apps Script 左側「Executions」看流量曲線。

---

## 異常時的緊急處理

如果有人攻擊你的 endpoint:

1. **立即停用**: Apps Script → Deploy → Manage deployments → Archive deployment (這個 URL 立刻失效,你帳號其他 Apps Script 不受影響)
2. **清理 Sheet**: 把 spam 列刪掉
3. **重新部署**: 改一下 code (或不改,只是 New version) → 拿到新 URL → 更新 `config.js` 的 FEEDBACK_ENDPOINT → 推 main → 重新 deploy

整個過程約 10 分鐘,使用者只是這段時間送不出 feedback (前端 fallback 到 localStorage queue,等下次成功時補送)。
