# IQ-Kids 系統架構決策文件

> 本文件記錄專案重構為「前端 + 題庫資料 + 紀錄系統」三層架構的決策。
> 任何後續實作以本文件為準;若實作中發現本文件描述不正確,先改本文件再寫程式碼。

**版本**:v1 (implemented)
**狀態**:**生效中** — 描述目前正運作的系統設計。新增 / 變更需求請進 [wishlist.md](wishlist.md) 排隊。
**演進歷史**:`iq_brain_explorer.html` (36 題 monolith 版) → v1 拆模組 + 471 題題庫 + 雙 AI 協作流程 (本文件)

---

## 1. 目標與非目標

### 1.1 V1 範圍 — **單人模式**
**V1 的核心邊界:整個系統服務「一個孩子在自己的瀏覽器裡」這個情境。**
- 學習模式:一個孩子練自己的
- 測驗模式:一個孩子考自己的
- 紀錄:存在自己瀏覽器
- 任何「多人 / 班級 / 老師 / 家長後台」的功能 → **進入 [願望清單](wishlist.md),v1 不做**

採類敏捷流程:**新需求先進願望清單**,要做才開 Issue 排進迭代。

### 1.2 目標
- 把單一 HTML monolith 拆成**前端 / 題庫資料 / 文件 / 工具**四層
- 題庫可**無限擴充**(丟一個 JSON 檔就多一題,自動納入隨機抽題池)
- 加**個人紀錄系統**:本地 localStorage,完全匿名,有能力雷達圖
- 加**測驗模式**:無提示、結束才出分,跟「學習模式」並列
- 學習模式加**動畫 + 音效回饋**,且有 mute 開關
- 加**每題回饋按鈕** — 收集「題目太難 / 題目錯 / 答案錯 / 太簡單 / 其他」(詳見 §6.5)
- 部署到 **GitHub Pages** (repo: `iq-kids`)
- 採輕量 **SDD (Spec-Driven Development)** 流程,每個 PR 對應一份 spec

### 1.3 明確不做(non-goals,v1)
- ❌ **不做後端** — 維持純靜態
- ❌ **不收集任何個人資料** — 連匿名 user ID 都不上傳
- ❌ **不做班級/老師後台** (Tier 3,進願望清單)
- ❌ **不做家長帳號 / 看孩子紀錄** (進願望清單)
- ❌ **不做帳號系統 / 登入**
- ❌ **不做跨裝置同步** — 紀錄留在當前瀏覽器,換裝置就重新開始(這是隱私特性,不是 bug)

### 1.3 設計哲學維持
- 不抄題,用題型
- 引導式解析(學習模式才有)
- 能力標籤可累積成能力雷達
- 正向回饋
- 視覺化呈現

---

## 2. 資料夾結構

```
iq-kids/                         ← GitHub repo root
├── README.md                    ← 專案介紹、線上 demo 連結、貢獻指引
├── LICENSE                      ← MIT (建議)
├── .gitignore                   ← node_modules, .DS_Store...
│
├── docs/                        ← 規格與設計文件 (不上線)
│   ├── spec.md                  ← 從 brain_explorer_spec.md 搬過來
│   ├── architecture.md          ← 本檔
│   ├── schema.md                ← 題目 JSON schema 規範 (待寫)
│   ├── authoring.md             ← 怎麼出題的作者手冊 (待寫)
│   └── recording.md             ← 紀錄系統規格 (待寫)
│
├── web/                         ← 前端 (GitHub Pages 部署目標)
│   ├── index.html               ← 主程式入口
│   ├── preview.html             ← 單題預覽工具 (作者除錯用)
│   ├── css/
│   │   └── style.css            ← 全部樣式
│   ├── js/
│   │   ├── app.js               ← 主流程 (state 機、screen 切換)
│   │   ├── shapes.js            ← 基本 SVG helper (circle, square...)
│   │   ├── iso.js               ← cubeStack 系列 (等角投影)
│   │   ├── renderer.js          ← visual spec → HTML 分派器
│   │   ├── validator.js         ← schema 驗證
│   │   ├── loader.js            ← fetch manifest + 題目
│   │   ├── recorder.js          ← 個人紀錄 (localStorage)
│   │   ├── feedback.js          ← 動畫 + 音效
│   │   └── stats.js             ← 雷達圖、錯題回顧
│   └── assets/
│       └── audio/               ← 音效檔 (或全用 Web Audio 生成,本資料夾留空)
│
├── questions/                   ← 題庫 (純資料,GitHub Pages 也服務這裡)
│   ├── manifest.json            ← 索引: 每個 topic/difficulty 有哪些題 ID
│   ├── matrix/
│   │   ├── easy/
│   │   │   ├── matrix-easy-001.json
│   │   │   └── ...
│   │   ├── mid/
│   │   └── hard/
│   ├── sequence/
│   ├── spatial/
│   ├── numseries/
│   ├── analogy/
│   └── multivar/
│
├── tools/                       ← 本地開發腳本 (Node.js,不上線)
│   ├── validate.mjs             ← 批次驗證所有題目符合 schema
│   ├── build-manifest.mjs       ← 掃 questions/ 自動產生 manifest
│   └── import.mjs               ← (未來) 從外部來源轉檔
│
└── iso_demo.html                ← (暫留) helper 沙盒,日後移入 web/preview/
```

**為什麼這樣切?**
- `web/` 獨立 → GitHub Pages 可設「serve from /web」,跟 docs 隔離
- `questions/` 跟 `web/` 同層 → 前端用相對路徑 `../questions/manifest.json` fetch (或 Pages root 設在 repo root,則用 `questions/manifest.json`)
- `tools/` 是 Node 腳本,不會被 Pages 部署(沒 index.html)
- `docs/` 純文件,不需上線

---

## 3. 題目 JSON Schema (草案)

> 完整 schema 細節寫在 `docs/schema.md`,本節給「重點骨架」。

### 3.1 一題 JSON 範例
```json
{
  "id": "matrix-easy-001",
  "topic": "matrix",
  "difficulty": "easy",
  "sub_type": "single-variable-row",
  "skill_codes": ["pattern-row-identification"],
  "created_at": "2026-05-24",
  "author": "claude+george",
  "tags": ["raven-2x2", "shape"],

  "prompt": "橫向看一下,每一排有什麼規律?",

  "visual": {
    "type": "matrix-3x3",
    "cells": [
      {"shape": "circle", "color": "pink"},
      {"shape": "circle", "color": "pink"},
      {"shape": "circle", "color": "pink"},
      {"shape": "square", "color": "teal"},
      {"shape": "square", "color": "teal"},
      {"shape": "square", "color": "teal"},
      {"shape": "triangle", "color": "yellow"},
      {"shape": "triangle", "color": "yellow"},
      {"unknown": true}
    ]
  },

  "options": [
    {"visual": {"type": "single-shape", "shape": "circle", "color": "pink"}, "text": "粉紅圓"},
    {"visual": {"type": "single-shape", "shape": "triangle", "color": "yellow"}, "text": "黃三角"},
    {"visual": {"type": "single-shape", "shape": "square", "color": "teal"}, "text": "藍綠方"},
    {"visual": {"type": "single-shape", "shape": "star", "color": "pink"}, "text": "粉紅星"}
  ],

  "answer": 1,
  "hint": "看橫的:第一排都是粉紅圓、第二排都是藍綠方,第三排前兩個是什麼?",
  "explanation": "每一排的三格是<strong>同樣的東西</strong>。第三排前兩格是黃色三角形,所以第三格也要是<strong>黃色三角形</strong>。",
  "skill": "橫向規律識別"
}
```

### 3.2 重點欄位變化(vs 原規格)
| 欄位 | 原 spec | 新版 | 為什麼改 |
|------|--------|------|---------|
| `visual` | HTML 字串 | **結構化物件** `{type, ...}` | 可序列化、AI 好生成、樣式統一 |
| `options[].html` | HTML 字串 | `options[].visual` 物件 | 同上 |
| `id` | (沒有) | `"matrix-easy-001"` | 紀錄系統需要唯一識別 |
| `skill_codes` | (沒有) | `["pattern-row-identification"]` | 同 skill 文字可能不同寫法,需 canonical ID 才能聚合到雷達圖 |
| `sub_type` | (規格有列但 schema 沒) | 加上 | 之後可篩選「只練拉丁方陣」 |

### 3.3 已知的 visual.type
(完整列表寫在 `docs/schema.md`,初版包含)
- `matrix-3x3` / `matrix-2x2`
- `sequence-row` (序列題,一排格子)
- `cubeStack` (立方體堆,用 layout 陣列)
- `cubeNet` (立方體展開圖)
- `foldedPaper` (折紙)
- `number-sequence` (數列題)
- `analogy-row` (A:B :: C:?)
- `single-shape` (單一形狀,用於選項)

---

## 4. 紀錄系統 (Tier 1)

> 完整規格在 `docs/recording.md`,本節給核心設計。

### 4.1 儲存位置
**只用 localStorage**,key 命名:
- `iq-kids:profile` — 使用者資料(無識別資訊,只記偏好)
- `iq-kids:attempts` — 答題紀錄陣列
- `iq-kids:settings` — 音效開關等

### 4.2 紀錄一次答題 (schema)
```json
{
  "ts": 1716537600000,
  "question_id": "matrix-easy-001",
  "topic": "matrix",
  "difficulty": "easy",
  "skill_codes": ["pattern-row-identification"],
  "answer_idx": 1,
  "correct": true,
  "duration_ms": 8500,
  "mode": "learn"
}
```

### 4.3 衍生指標
從 attempts 算出:
- **每題型答對率** → 雷達圖六軸
- **每個 skill_code 答對率** → 細項弱點
- **錯題清單** → 結算頁「再練錯題」按鈕
- **學習熱度** → 「你已經練習 N 題,連續 N 天打卡」(暫不做,後續可加)

### 4.4 隱私
- 沒有姓名、生日、學校、email
- 沒有任何上傳
- 清瀏覽器資料 → 紀錄消失(這是 feature 不是 bug,符合兒童資料最小化原則)
- 「設定」頁有「清除我的紀錄」按鈕

---

## 5. 測驗模式 (Tier 2)

### 5.1 進入點
主選單最下方加一張「📝 綜合測驗」卡片,跟現有六題型並列。

### 5.2 流程
```
測驗設定頁
  選擇:題型範圍 (六選多 / 隨機綜合)
  選擇:難度 (easy / mid / hard / 混合)
  選擇:題數 (10 / 20 / 30)
  選擇:時限 (無限 / 10 分 / 20 分)
  → [開始測驗]
  ↓
測驗進行頁
  上方:倒數計時 + 進度條
  中間:題目 (跟學習模式同一個 renderer)
  下方:選項
  ⚠️ 沒有 hint、沒有解析、選了就不能改
  ↓
測驗結束頁
  總分 (% + 評語)
  時間 (用了 X 分 Y 秒)
  能力雷達圖 (本次)
  逐題回顧 (這時才看詳解)
  [產生成績單] [回主選單]
```

### 5.3 成績單
- 用 SVG 在頁面內畫
- 提供「截圖」按鈕(html2canvas 或直接 SVG 匯出 PNG)
- 不上傳,只在本機產生

### 5.4 前提條件
**題庫每題型至少 10 題以上才能做有意義的測驗**(否則重複出題)。所以測驗模式上線前,要先把 Phase 1 題庫擴充到每題型每難度 8+ 題 = 144 題以上。

---

## 6. 學習模式回饋:動畫 + 音效

### 6.1 答對
**動畫**:
- 選項按鈕綠色 + 彈跳(`pop` 動畫,scale 1.0 → 1.15 → 1.0)
- 全螢幕飄出 confetti 粒子(純 CSS keyframes,不用 library)
- 隨機慶祝 emoji(維持原本 🎉⭐🌟✨🎊)
**音效**:
- 短促清脆的「叮!」(上升音 600Hz → 900Hz,150ms)
- Web Audio API 生成 sine wave,不用音檔
- 音量 0.3 (溫和不嚇人)

### 6.2 答錯
**動畫**:
- 選項按鈕紅色 + 左右輕微 shake(平移 ±4px,3 次,180ms)
- 正確答案同時標綠 + 慢慢「呼吸」(opacity 1.0 → 0.6 → 1.0)
**音效**:
- 低沉柔和的「嗯~」(下降音 400Hz → 300Hz,200ms)
- 絕對不能是電玩 buzzer 那種刺耳音
- 音量 0.25

### 6.3 Mute 開關
- 主選單右上角放小喇叭圖示 🔊 / 🔇
- 點擊切換 + 存 localStorage
- 預設值:第一次造訪 → 開啟音效,但播第一個音效前先彈一個小提示「點任意處啟用音效」(瀏覽器 autoplay policy 要求 user gesture)

### 6.4 為什麼用 Web Audio 不用 mp3 / wav 檔?
- 不增加 asset 體積、不增加 fetch 請求
- 音色可隨時調整(改幾個數字),不用換檔
- 維持「無依賴」精神
- 將來需要更豐富音效再加 `web/assets/audio/`

### 6.5 每題回饋按鈕

**動機**:作者(George)需要使用者回饋來優化題庫品質。哪題太難、哪題答案錯、哪題視覺亂,使用者最清楚。

#### UI
- 答題卡片右下角放小按鈕 `💬 回饋這題`
- 點擊 → modal 跳出:
  ```
  ┌─ 回饋這一題 ────────────────────────┐
  │ 想說什麼? (可多選)                    │
  │ [😵 太難了]  [😴 太簡單]              │
  │ [🤔 題目敘述不清楚]                   │
  │ [❌ 我覺得題目錯了]                   │
  │ [❌ 我覺得答案錯了]                   │
  │ [🎨 視覺亂掉 / 看不清楚]              │
  │ [💡 其他想法...]                      │
  │                                       │
  │ 補充說明 (選填):                      │
  │ [____________________________]        │
  │                                       │
  │ [取消]                    [送出]      │
  └───────────────────────────────────────┘
  ```

#### 自動附帶 context(不需使用者填)
- `question_id`
- `topic` / `difficulty`
- 答題狀態(尚未作答 / 答對 / 答錯)
- 選擇了哪個選項(若已答)
- `mode`(learn / test)
- `viewport` (寬x高,幫助診斷視覺 bug)
- `user_agent` (瀏覽器/裝置型號)
- timestamp

**沒有**:姓名、IP、地理位置、cookies、追蹤 ID。

#### 送出機制 — V1 用「Google Sheets via Apps Script」
**設計核心:不跳轉視窗、靜默 POST、UI 保持可愛風格一致**。

##### 前端流程
```
使用者點「💬 回饋這題」
  → 自家風格 modal 打開 (粉紅+黃+藍配色,圓角粗邊)
  → 勾 chips + (選填) 自由文字
  → 按「送出」
  → fetch POST 到 Google Apps Script Web App endpoint
  → 顯示「謝謝你的回饋 ✨」toast
  → 1.5 秒後 modal 自動關閉
  ⚠️ 整個過程不換頁、不彈視窗
```

##### 後端設定步驟(部署時做一次)
1. George 用自己的 Google 帳號開一張 Spreadsheet,命名 `IQ-Kids Feedback`
2. 標題列:`時間 / 題目ID / 類型 / 評語 / 題型 / 難度 / 答題狀態 / 瀏覽器 / 視窗大小 / mode`
3. 工具 → 應用程式指令碼 → 貼以下程式碼:
   ```javascript
   function doPost(e) {
     const d = JSON.parse(e.postData.contents);
     SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow([
       new Date(), d.question_id, (d.types||[]).join(','), d.comment||'',
       d.topic, d.difficulty, d.status, d.user_agent, d.viewport, d.mode
     ]);
     return ContentService.createTextOutput(JSON.stringify({ok:true}))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```
4. 部署 → 新增部署作業 → 類型「網路應用程式」→ 執行身分「我」→ 存取權「任何人」
5. 拿到 endpoint URL (`https://script.google.com/macros/s/.../exec`)
6. 把這個 URL 設定到前端 `web/js/feedback.js` 的 `FEEDBACK_ENDPOINT` 常數

##### 好處
- 使用者**零門檻**:點按鈕、填表、送出,完整體驗在我們自家 UI 內
- George **看資料就開那張 Sheet**,可排序、篩選、加備註、給朋友看
- 完全免費,Google 額度極寬鬆
- 資料是 George 的,不依賴第三方服務生死

##### 備援
即使網路不通 / endpoint 掛掉,**也先存一份到 localStorage** (`iq-kids:feedback-queue`)。
下次成功送出時自動把 queue 沖出去。設定頁有「匯出我的回饋 JSON」按鈕當第二備援。

##### v1.5 升級路徑
若 Apps Script 額度不夠或想要更多功能(自動 email George、過濾 spam),改成:
- **Cloudflare Workers + Email Routing** — 自架輕量 endpoint
- 只要改 `FEEDBACK_ENDPOINT` 一個變數,前端零修改

---

## 7. 隨機抽題演算法

### 7.1 流程
```javascript
// 1. 啟動時載入 manifest
const manifest = await fetch('questions/manifest.json').then(r => r.json());

// 2. 使用者選「矩陣 → 入門」
const allIds = manifest.topics.matrix.easy;  // 假設有 10 題

// 3. 抽題策略
function pickQuestions(allIds, n, history) {
  // history 是 recorder 給的「最近答過的題目 ID 列表」
  // 優先抽沒答過的;沒答過的不夠就抽答過最久的
  const unseen = allIds.filter(id => !history.includes(id));
  const seen = allIds.filter(id => history.includes(id));
  const pool = [...shuffle(unseen), ...shuffle(seen)];
  return pool.slice(0, n);
}

// 4. 並行 fetch
const questions = await Promise.all(
  pickedIds.map(id => fetch(`questions/${topic}/${difficulty}/${id}.json`).then(r => r.json()))
);
```

### 7.2 每關抽幾題?
- 預設 5 題/關(現在 6 張卡片每張各 2 題太少)
- 設定頁可調 3 / 5 / 10
- 題庫不足時自動降為實際題數,不出錯

---

## 8. SDD 工作流程

### 8.1 每個功能的步驟
```
1. 開 GitHub Issue,描述功能
2. 我在 docs/<feature>.md 寫 spec
3. 你在 Issue 留言 review (請改 / 同意)
4. 同意後我開 branch (feature/<name>),實作
5. PR (連到 Issue),內含:
   - 改動摘要
   - 對應 spec 段落
   - 驗證步驟 (如:跑 validate.mjs、開 preview 看)
6. 你 review PR → merge
7. 關閉 Issue
```

### 8.2 commit 訊息規範
```
<type>: <subject>

<body 描述為什麼這樣改>

Refs: #<issue-number>
```
type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### 8.3 對應到接下來的 Issue 規劃

| # | Issue | Spec 檔 | 預計 |
|---|-------|---------|------|
| 1 | Repo 初始化 + 資料夾搬遷 | (本檔) | 小 |
| 2 | 題目 JSON schema | docs/schema.md | 中 |
| 3 | 題庫遷移 (36 題 → JSON) | (機械活) | 中 |
| 4 | Visual renderer | (繼承 #2) | 大 |
| 5 | 主檔重構成模組化 | docs/architecture.md §2 | 中 |
| 6 | 預覽工具 | docs/authoring.md | 小 |
| 7 | 紀錄系統 | docs/recording.md | 中 |
| 8 | 雷達圖 + 錯題回顧 | docs/recording.md | 小 |
| 9 | 動畫 + 音效 | (本檔 §6.1-6.4) | 中 |
| 10 | **每題回饋按鈕** | (本檔 §6.5) | 小 |
| 11 | 部署 GitHub Pages | (本檔 §9) | 小 |
| 12 | 題庫擴充至 100+ 題 | (依 spec.md) | 巨大,可分多 PR |
| 13 | 測驗模式 | (本檔 §5) | 大,#12 完成後 |

---

## 8.5 題庫生成策略

### 8.5.1 為什麼用「生成器」而不是「爬資料」
經過調研:
- **網路上能找到的 IQ 題庫**(Mensa 風格網站、書籍掃描) 多半有著作權,直接抄寫違法
- **學術資料集**(RAVEN, I-RAVEN) 授權 OK 但設計給 AI benchmark 用,對小朋友太抽象太硬
- **中國 K12 考試系統** 內容跟我們無關
- → **直接複用任何外部題目都不適合**

**改採生成器策略**:
- 每個題型寫一支生成器 `tools/gen-<topic>.mjs`
- 程序化產生符合 schema 的 JSON 題目
- 完全自製,版權零問題,可控難度梯度
- **允許參考** Mensa 等的「題型結構」「規律設計」這些公開的認知科學知識
- **絕不直接複製**他人題目內容

### 8.5.2 生成器骨架
```javascript
// tools/gen-matrix.mjs
import { writeQuestion, validateQuestion } from './lib.mjs';

function genSingleVariableRow(seed) {
  // 隨機選 3 個形狀、3 個顏色 → 拼成「每排同形狀」的 3×3
  // 隨機決定哪格是 ?
  // 生成 4 個選項(1 正解 + 3 合理干擾)
  // 寫對應 prompt / hint / explanation
  return { id, prompt, visual, options, answer, hint, explanation, skill, ... };
}

const questions = [];
for (let i = 0; i < 30; i++) {
  const q = genSingleVariableRow(i);
  if (!validateQuestion(q)) throw new Error(`Invalid: ${q.id}`);
  questions.push(q);
}
questions.forEach(q => writeQuestion(`questions/matrix/easy/${q.id}.json`, q));
```

### 8.5.3 引用政策(防著作權問題)
- ✅ 可以**讀** Mensa / Raven 的題目,理解結構
- ✅ 可以**參考**他們的難度分級邏輯
- ✅ 可以用**他們提到的認知能力名詞**(這是學術詞彙不是著作)
- ❌ 不可逐字複製題目敘述、選項、解析
- ❌ 不可複製圖案的精確構圖(雖然視覺差異化容易,寫成程式生成本來就會不同)
- 每題 JSON 加 `"author": "claude-generated", "inspired_by": "raven-matrix-style"` 標明來源類型(若有)

---

## 8.6 雙 Claude 協作模型

### 8.6.1 角色分工
| | **本 Claude (系統)** | **題庫 Claude (內容)** |
|---|---|---|
| 設計 schema | ✅ | – |
| 寫 validator / renderer | ✅ | – |
| 重構主檔、上 Pages | ✅ | – |
| 寫題目生成器 | – | ✅ |
| 跑生成器產 JSON | – | ✅ |
| **自驗答案正確** | – | ✅ **(關鍵職責)** |
| **自跑 validate** | – | ✅ |
| review 題庫 PR | ✅ | – |
| 整合進前端 | ✅ | – |

### 8.6.2 交接介面
**「題庫 Claude」收到的東西**(George 把以下文件丟給他):
1. `docs/architecture.md` (本檔) — 整體背景
2. `docs/spec.md` — 設計哲學 + 題型細節
3. `docs/schema.md` — 完整 JSON schema 規範
4. `docs/authoring.md` — **給他的指令書**(怎麼做、怎麼自驗、放哪個資料夾)
5. `tools/validate.mjs` — 寫好的驗證工具
6. `questions/` 空資料夾結構

**「題庫 Claude」交回的東西**:
1. `tools/gen-<topic>.mjs` × 6 支生成器
2. `questions/<topic>/<difficulty>/*.json` 大量題目
3. 更新後的 `questions/manifest.json`
4. 一份 `docs/generation-log.md` 記錄各題型生成數量、抽樣校對結果

### 8.6.3 自驗要求
題庫 Claude 必須對每題做 **三層自驗**,沒過就不能 commit:
1. **Schema 驗證** — `validate(q)` 通過 (七大欄位、type 正確、answer 在 options 範圍內)
2. **答案重算** — 用解析裡的規則**重新推導一次答案**,結果要跟 `q.answer` 一致
3. **干擾選項合理性** — 每個錯誤選項都要對應一個「常見誤解」,寫在 generation log 中

---

## 9. 部署

### 9.1 環境
- **GitHub repo**: `iq-kids`(public)
- **GitHub Pages**:
  - Source: `main` branch
  - Folder: `/web`(或 root,看 #1 決定)
  - 結果 URL: `https://<username>.github.io/iq-kids/`

### 9.2 自定網域(future)
保留可能性,不在 v1 範圍。

### 9.3 CI/CD
v1 先不做。日後可加 GitHub Actions:
- PR 時跑 `tools/validate.mjs` 確認題庫合法
- merge 後自動部署 Pages(GitHub Pages 預設就做了)

---

## 10. 風險與未決議題

| 項目 | 風險 | 緩解 |
|------|------|------|
| Web Audio 在 iOS Safari 需 user gesture | 第一次答題沒聲音 | 進入測驗前彈一個「點此啟動音效」 |
| localStorage 5MB 上限 | 答題紀錄太多會塞滿 | 自動 truncate 最舊紀錄,只留最近 1000 筆 |
| 老師/家長想看紀錄 | Tier 1 紀錄只留瀏覽器 | 提供「匯出 JSON」按鈕讓家長自己存 |
| 兒童使用者隱私 | 第三方 fonts 載入算追蹤? | Google Fonts 可改 self-host,但對 PII 影響極小;v1 維持 CDN |
| GitHub Pages 限額 | 100GB/月 流量 | 題庫純 JSON,單題 < 5KB,千題也只 5MB;不用擔心 |

---

## 11. 決議紀錄

| # | 議題 | 結論 | 日期 |
|---|------|------|------|
| 1 | 資料夾結構 | 採 §2 版本,`iso_demo.html` 移到 `web/preview/` | 2026-05-24 |
| 2 | Visual schema | 結構化物件 `{type, ...}` | 2026-05-24 |
| 3 | 紀錄儲存 | localStorage,換瀏覽器就重來,符合隱私最小化 | 2026-05-24 |
| 4 | 測驗時限 | 依題數動態,基準約 1 分鐘/題 | 2026-05-24 |
| 5 | 音效 | Web Audio API 生成 tone,不放音檔 | 2026-05-24 |
| 6 | 回饋送出機制 | **Google Sheets + Apps Script**,前端靜默 POST | 2026-05-24 |
| 7 | README | **兩份**:`README.md`(使用者) + `CONTRIBUTING.md`(開發者) | 2026-05-24 |
| 8 | License | **全 MIT**(程式碼 + 題目都 MIT),George 不告人 | 2026-05-24 |
| 9 | 題庫策略 | **生成器為主**,可參考 Mensa 結構但不複製題目 | 2026-05-24 |
| 10 | 工作分工 | 本 Claude 系統 + 驗證,題庫 Claude 內容 + 自驗 | 2026-05-24 |

---

**END OF DRAFT-2**

> 修訂歷史
> - draft-1 (2026-05-24): 初版,涵蓋 Tier 1+2 紀錄系統、音效動畫、SDD 流程
> - draft-2 (2026-05-24): 落版,§6.5 改 Google Sheets,新增 §8.5 生成器策略 + §8.6 雙 Claude 協作模型,§11 改成決議紀錄
