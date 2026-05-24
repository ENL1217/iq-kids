# Contributing to IQ-Kids

歡迎加入!這份文件是寫給**想貢獻程式碼或題目**的人。給家長/老師看的請看 [README.md](README.md)。

---

## 🗂️ 專案結構

```
iq-kids/
├── docs/                    ← 規格與設計文件
│   ├── spec.md              ← 設計哲學、題型分類、難度梯度
│   ├── architecture.md      ← 系統架構決策(必讀)
│   ├── schema.md            ← 題目 JSON schema 規範
│   ├── authoring.md         ← 出題指引(給題庫貢獻者)
│   └── wishlist.md          ← 未來功能 backlog
│
├── web/                     ← 前端 (GitHub Pages 服務這裡)
│   ├── index.html           ← 主程式入口
│   ├── preview/             ← 預覽工具、helper demo
│   ├── css/
│   ├── js/                  ← 模組化 JS
│   └── assets/
│
├── questions/               ← 題庫資料 (JSON)
│   ├── manifest.json        ← 索引(可被前端 fetch)
│   ├── matrix/easy/*.json
│   ├── matrix/mid/*.json
│   └── ... 其他題型
│
└── tools/                   ← 本地開發腳本 (Node.js)
    ├── validate.mjs         ← 批次驗證題目 schema
    ├── build-manifest.mjs   ← 掃 questions/ 自動產生 manifest
    └── gen-<topic>.mjs      ← 各題型的程序化生成器
```

完整架構決策見 [docs/architecture.md](docs/architecture.md)。

---

## 🚀 本地開發

### Prerequisites
- Git
- Node.js (建議 18+) — 跑 `tools/*.mjs` 需要
- 任何能服務靜態檔的方式(本地預覽用)

### 🌳 多 Agent / 多分支同時工作 (Worktree)

本專案有時會有**多個 AI agent 平行作業**(系統開發 + 題庫生成)。
如果只用一個資料夾共用 git repo,HEAD 會互搶導致 commit 跑錯分支。

正規解法:**git worktree** — 一個 repo,多個資料夾,各自鎖定不同分支。

```
D:\AI_Project\IQ              ← 系統 Claude(主開發者),永遠 main
D:\AI_Project\IQ-content      ← 內容 Claude(題庫),feat/question-bank-batch-X
```

設定:
```bash
cd D:\AI_Project\IQ
git worktree add ..\IQ-content feat/question-bank-batch-2-analogy
```

之後內容 Claude 開新分支(從 `IQ-content` 內):
```bash
cd D:\AI_Project\IQ-content

# ⚠ 不能用 git checkout main, 因為 main 被 IQ 主資料夾鎖住
# (一個分支只能在一個 worktree 裡 checkout)
# 改用 fetch + branch from origin/main:
git fetch origin
git checkout -b feat/question-bank-batch-3-sequence origin/main
```

優點:
- HEAD 不會被另一個 agent 切走
- 兩邊 working tree 完全獨立
- 共用 .git/ objects,push/pull 都通同一個 origin
- 移除:`git worktree remove ..\IQ-content`

注意事項:
- **EOL CRLF/LF 噪音**:Windows worktree 切換時 git 可能顯示一堆 modified 檔案,
  實際 `git diff` 是 0 字節差異(純行尾符號)。不 add 那些檔案即可,別擔心。
- **分支唯一**:同一個分支只能在一個 worktree 裡 checkout。要切回 main 必須先
  `cd D:\AI_Project\IQ` (主 worktree)。

詳見 `git help worktree`。

### 🔁 Sync feature branch with main:用 merge,不要 rebase

從 batch 4 開始,feature 分支拉 main 用 `merge` 不要 `rebase`,理由:

```bash
# 在 worktree 內,要把 feature 分支同步到最新 main:
cd D:\AI_Project\IQ-content
git fetch origin
git merge origin/main          # ✅ 用這個
# 不要 git rebase origin/main  # ❌ 會改寫 commit chain → 強制 push
```

- `merge` 加一個 merge commit,你的 history 不變,普通 `git push` 即可
- `rebase` 改寫 commit chain,push 必須 `--force` (有風險,需單獨授權)

PR 合進 main 是用 squash 或 merge commit,所以 feature 分支 history 線性不線性
其實不重要。merge 流程比較不會踩坑。

### 🚫 Force-push 政策

- ❌ **main 永遠零 force tolerance**。任何理由都不可 `git push --force` 到 main
- ⚠️ feature 分支若 rebase 後需要 force-push:
  - 必須用 `--force-with-lease` (safe variant,遠端被別人推過就拒絕)
  - 必須是該分支的唯一作者
  - 必須有 reviewer 明確授權 (不能自己決定)
  - PR comment 或 commit message 註明「user-authorized force-with-lease」
- 一般情況用 merge 流程避免 force-push 需求 (見上一段)

### 本地預覽
靜態網頁,選一個方法:

```bash
# 方法 1:Python (內建)
cd web && python -m http.server 8000
# 開 http://localhost:8000

# 方法 2:Node http-server
npx http-server web -p 8000

# 方法 3:VSCode Live Server 套件
# 對 web/index.html 按右鍵 → "Open with Live Server"
```

⚠️ **不要直接 `file://` 開 index.html** — fetch 題庫 JSON 會被 CORS 擋。

### 驗證題庫
```bash
node tools/validate.mjs
# 會掃 questions/**/*.json,任何不合 schema 的題目報錯
```

### 自動產生 manifest
```bash
node tools/build-manifest.mjs
# 掃 questions/ 把所有題目 ID 寫進 questions/manifest.json
```

---

## 📝 怎麼貢獻題目

請看 [docs/authoring.md](docs/authoring.md)(出題完整指引)。

**TL;DR**:
1. 讀 [docs/spec.md](docs/spec.md) 理解設計哲學跟題型分類
2. 讀 [docs/schema.md](docs/schema.md) 了解 JSON 格式
3. 在 `questions/<topic>/<difficulty>/` 加一個新的 `<topic>-<difficulty>-<id>.json`
4. 跑 `node tools/validate.mjs` 確認過
5. 跑 `node tools/build-manifest.mjs` 更新索引
6. 開 PR

**重要原則**:
- ❌ **絕對不複製他人題目**(Mensa、教科書、線上 IQ 站) — 違反著作權跟本專案精神
- ✅ 可以參考題型結構、難度設計、認知能力分類(這些是公開知識)
- ✅ 自己想題目、自己畫視覺、自己寫解析
- ✅ 用生成器 (`tools/gen-<topic>.mjs`) 程序化產

---

## 💻 怎麼貢獻程式碼

### 開發流程(輕量 SDD)
1. 找一個 [Issues](../../issues) 或 [docs/wishlist.md](docs/wishlist.md) 上的項目
2. 如果改動超過 100 行,**先在 issue 留言討論方向**
3. 在 docs/ 寫對應 spec(若需要)
4. 開 branch:`feature/<short-name>` 或 `fix/<short-name>`
5. 小 commit、清楚的 commit message
6. PR 連到 issue,附上「我跑了什麼驗證」的勾選清單

### Commit Message 格式
```
<type>: <subject>

<body 說明為什麼這樣改>

Refs: #<issue-number>
```
type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### Code Style
- 純 vanilla JS,**不引入 framework**(這是 spec 級的決策,不要違反)
- 用 `const`/`let`,不用 `var`
- 函數小、職責單一
- 命名:`camelCase` for vars/functions, `PascalCase` for constructors, `UPPER_CASE` for constants
- SVG 用 helper 函數產生,**不要寫超過 50 行的 inline SVG 字串**

### PR Review Checklist
- [ ] 跑過 `node tools/validate.mjs` (若改題庫)
- [ ] 在瀏覽器實際開過修改的頁面,功能正常
- [ ] 沒有 `console.log` debug 殘留
- [ ] 沒有禁詞:「等等」「不對!」「我們重看」「重看:」(這些是 AI 自言自語訊號)
- [ ] 更新對應 docs(若改 schema 或架構)

---

## 🐛 回報 Bug

[開新 Issue](../../issues/new),附上:
- 瀏覽器跟版本
- 重現步驟
- 預期 vs 實際行為
- 截圖(如果是視覺 bug)

---

## 📚 延伸閱讀

- [docs/architecture.md](docs/architecture.md) — 為什麼這樣設計
- [docs/spec.md](docs/spec.md) — 教學設計哲學
- [docs/schema.md](docs/schema.md) — 題目 JSON 格式
- [docs/authoring.md](docs/authoring.md) — 出題指引
- [docs/wishlist.md](docs/wishlist.md) — 未來想做的事

---

**Made with care for kids who think. 歡迎加入 🧠✨**
