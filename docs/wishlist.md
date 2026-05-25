# 願望清單 (Wishlist / Backlog)

> 這是 IQ-Kids 的 **未來功能 backlog**。V1 不做的東西、使用者回饋、靈感、技術想法都收在這裡。
>
> **規則**:
> - 新需求不直接開 Issue,先進這裡
> - 要做才把對應 item 升級成 GitHub Issue 排進迭代
> - 完成的 item 標 `done`,搬到本檔底部 §完成紀錄
> - 拒絕的 item 標 `declined`,並寫理由 (避免日後同樣的想法又被討論一次)

**狀態符號**:
- 💭 `idea` — 還沒寫 spec
- 📝 `spec'd` — 有對應的 docs/<feature>.md
- 🚧 `in-progress` — 已開 Issue,branch 上實作中
- ✅ `done` — 已 merge,搬到 §完成紀錄
- 🚫 `declined` — 評估後不做,附理由

**優先級**:
- **P0** — 必做,跟 v1 同等重要,有空就排
- **P1** — 強需求,v1.x 想做
- **P2** — 有價值但不急,v2 候選
- **P3** — 靈感層級,還沒驗證真的有用

---

## 多人 / 後台類 (Tier 3)

### 班級匿名群體分析  `P2` 💭
老師建班級代碼,學生輸入代碼答題,匿名累計。後台顯示「本班最弱題型」。
**需要**:後端服務 (Firebase / Supabase)、設計匿名 session 流程、家長同意機制
**理由 V1 不做**:架構衝擊大,且兒童資料隱私責任重

### 老師後台 (查看班級平均、出題分配)  `P2` 💭
老師可指定特定題庫範圍給班級,看每個 skill 的全班分布

### 家長帳號 (看孩子紀錄)  `P3` 💭
家長 email 註冊,看孩子的雷達圖跟進步曲線
**理由 V1 不做**:需要後端 + 帳號系統 + 兒童監護同意流程

### 全國匿名統計 (opt-in)  `P3` 💭
「全台灣小朋友最常答錯的是 X」這種統計
**理由 V1 不做**:要規模 (>100 使用者) 才有意義

---

## 內容類

### 題庫擴充至 v3 規模 (1000+ 題)  `P1` 💭
v2 目標已達 (471 題)。新目標見 `docs/generation-log.md` Phase A-E roadmap
**進度**:matrix 81、sequence 81、spatial 92、numseries 75、analogy 81、multivar 61 = **471**

### 多語言題庫  `P3` 💭
英文版 / 簡體中文版 / 日文版
**注意**:題目本身要 i18n、視覺型題目可共用,文字型題目要重出

### 跨領域擴充 (數學練習、邏輯謎題)  `P3` 💭
不只 IQ,做成「孩子的腦力訓練平台」

---

## 視覺 / 互動類

### 色盲友善模式  `P1` 💭
形狀+紋理區分,不只靠顏色
**為什麼 P1**:7-10% 男孩有色覺障礙,直接排除目標使用者

### 鍵盤導航  `P2` 💭
ABCD 按鍵選答案,enter 下一題,esc 回主選單
**好處**:加快熟練使用者的操作、無障礙

### 夜間模式  `P3` 💭
深色配色,但要重新驗證色盲友善

### 旋轉觀察互動 (3D 拖曳)  `P3` 💭
立方體題加滑鼠拖曳轉視角
**注意**:會大幅增加 bundle 體積 (Three.js)

### confetti 慶祝粒子效果  `P2` 💭
答對時撒紙花,純 CSS keyframes
**對應 spec**:`architecture.md §6.1` 提過

---

## 紀錄 / 統計類

### 學習熱度與打卡  `P2` 💭
「已連續練習 N 天」「本週練了 N 題」,做正向回饋
**注意**:不要做成 gamification 焦慮源,要溫和

### 進階雷達圖 (skill 細項)  `P2` 💭
不只六大題型,而是每個 skill_code 一個維度。可切換「總覽 6 軸」/「細項依題型展開」兩種模式
**前提**:題庫要有大量題目,且 skill_code 規範完整

### 學習熱度 / 連續打卡  `P2` 💭
「已連續練習 N 天」「本週練了 N 題」「總會話 N 次」做正向回饋
**注意**:不要弄成壓力源,溫和呈現,不要 streak 中斷的紅色警示

### 進步曲線圖  `P2` 💭
SVG 折線圖,每題型在時間軸上的答對率
「我這個月在 spatial 從 40% 進步到 70%」這種

### 成績單 PDF 匯出  `P2` 💭
測驗結束可下載一張漂亮的 PDF 給家長/老師
**注意**:不要只是 html2canvas 截圖,要真的 PDF (jsPDF / pdfkit)

### 多語言介面切換 (Phase 2 原生 i18n)  `P2` 💭
**Phase 1 已完成** (Google Translate widget + 手寫英文 about 頁,見 §完成紀錄)。
Phase 2 才是真正原生 i18n:

- 新增 `web/js/i18n.js`,定義 `messages = { 'zh-TW': {...}, 'en': {...} }`
- 偵測順序:localStorage `iq-kids:lang` > URL `?lang=` > `navigator.language` > 'zh-TW' 預設
- HTML 標 `data-i18n="key"` 自動翻譯
- 設定頁加語言下拉選單
- 題目 JSON 加 `prompt_en` / `hint_en` / `explanation_en` 欄位

**為什麼降到 P2**:Phase 1 (Google Translate + 手翻 about) 已經涵蓋了 80% 使用情境。Phase 2 工作量大 (題庫內容 i18n 是 471 題 × 4 個 field),且現在沒有英文使用者反映迫切需求。等真有需求再做。

---

## 工程類

### PWA (離線可用)  `P3` 💭
Service Worker + manifest.json,可加到桌面當 app 用
**對 v1 影響**:結構 OK,新加一個 SW 即可,不衝突

### 題庫匯入工具 (從外部來源)  `P1` 💭
寫 `tools/import.mjs`,把符合著作權的外部來源轉成本系統 schema
**前提**:逐個來源確認授權 (公版 / CC / 自製)

### 題目分享連結  `P2` 💭
「我覺得這題很有趣,分享給朋友」→ 產生短連結直達該題
**注意**:可能誘發抄答案,要想清楚 UX

### Feedback 升級成 Formspree / 自家後端  `P1` 💭
若 v1 用 GitHub Issue 收到的回饋太少 (家長/老師上不去),換成 webform
**對應 spec**:`architecture.md §6.5` 已預留切換點

### 自定網域  `P3` 💭
從 `<user>.github.io/iq-kids` 換成 `iq-kids.tw` 之類

---

## 教學 / 解析類

### 影片解說模式  `P3` 💭
某些難題附短影片講解,放 `web/assets/videos/`
**注意**:影片大,要走 Drive 或 YouTube embed,不放 GitHub

### 「自己出題」模式  `P3` 💭
讓孩子自己設計題目,可分享給朋友考
**注意**:UX 設計挑戰大,門檻要低

### 解題步驟動畫  `P2` 💭
解析不只文字,用 SVG 動畫一步步演示「為什麼答案是 B」

---

## §完成紀錄

(此區記錄已實作的 wishlist 項目。格式:`[YYYY-MM-DD] item — 對應 commit / PR`)

- `[2026-05-24]` **立方體展開圖 helper (cubeNet)** P1 — `7a5b73e` 等 (helper 在 renderer.js + cubeNet.js,Batch 6/7 全部用上)
- `[2026-05-24]` **折紙打洞 helper (foldedPaper)** P1 — `565a758` (renderer.js renderFoldedPaper)
- `[2026-05-24]` **程序化題目生成器** P1 — 各 topic 都有 `tools/gen-<topic>.mjs`,batch 2-7 共產生 ~450 題
- `[2026-05-24]` **題庫擴充至 v2 規模 (300+ 題)** P1 — 達 **471 題**,新目標見 docs/generation-log.md Phase A-E roadmap
- `[2026-05-24]` **CI 自動驗證題庫** P1 — `pages.yml` workflow 在 deploy 前跑 `node tools/validate.mjs` (strict)
- `[2026-05-25]` **多語言介面切換 Phase 1** P1 — `9bb2770` Google Translate widget 嵌主頁 + about 頁 / `0e75070` LLM 品質英文 about.en.html / `8d9f806` 隱私強化拿掉 user_agent 收集。Phase 2 (原生 i18n) 降為 P2 候選
- `[2026-05-25]` **設定頁整合 + 弱項推薦 CTA** (沒在 backlog 但作為 Tier 1 完成) — `8f50703` web/js/settings.js + recorder.js findWeakest
- `[2026-05-25]` **單題預覽工具 web/preview/q.html** (沒在 backlog,後來需求發現) — `a7a8667`
- `[2026-05-25]` **安全強化 (Apps Script rate limit + CSP + Actions SHA pin)** (沒在 backlog,security audit 後加) — `311324b` / `e35810f` / `8d9f806`

---

## §已拒絕

(此區記錄評估後不做的項目。格式:`[YYYY-MM-DD] item — 理由`)

(尚無項目)

---

**怎麼新增願望?**
- 你想到 → 直接編輯本檔加進對應分類
- 從使用者回饋升上來 → 開新 GitHub Issue 標 `wishlist`,順便編輯本檔
- 從 v1 reviewer 提出 → 記在本檔並 link 到對應討論
