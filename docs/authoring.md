# 題庫作者指令書 (Authoring Guide)

> **這份文件是給「題庫 Claude」的工作說明書。**
>
> 如果你是另一個 Claude / AI agent 被分派來擴充 IQ-Kids 題庫,**請從頭讀完本檔**,然後嚴格依照流程作業。

---

## 0. TL;DR(給趕時間的你)

你的任務:**為 IQ-Kids 寫題目生成器,產出大量高品質、原創、符合 schema 的兒童 IQ 練習題。**

執行步驟:
1. 讀 [spec.md](spec.md), [architecture.md](architecture.md), [schema.md](schema.md) 三份文件
2. 為每個題型寫 `tools/gen-<topic>.mjs` (六支生成器)
3. 跑生成器產 JSON 到 `questions/<topic>/<difficulty>/`
4. **每題自驗答案 + 自跑 schema validation**
5. 跑 `node tools/build-manifest.mjs` 更新索引
6. 寫一份 `docs/generation-log.md` 報告:每題型生成數、抽樣校對結果
7. 提 PR

**關鍵紅線**:
- ❌ **不可直接複製 Mensa / 任何商業 IQ 測驗的題目** — 違法,且違反專案精神
- ✅ 可以參考題型結構、難度設計(這是公開的認知科學知識)
- ✅ 所有題目必須**原創**或**程序化生成**

---

## 1. 專案背景(必讀)

### 1.1 IQ-Kids 是什麼
給**國小 1-6 年級孩童**的互動式 IQ 練習網頁。**不是**鑑別式測驗,而是**學習工具**——讓孩子在答完題後,透過引導式提問跟解析學會「為什麼這樣想」。

### 1.2 設計哲學(出題必須遵守)
- **不抄題、用題型**:題目原創,但 Raven's Progressive Matrices 等「題型結構」是公開知識,可運用
- **引導式解析**:答錯時先給「引導式提問」讓孩子自己想,再給完整解析
- **能力標籤**:每題標註訓練的認知能力(`skill_codes` + `skill` 顯示用文字)
- **正向回饋**:題目敘述用孩子聽得懂的話,不用學術腔
- **視覺直觀**:能畫圖就畫圖,降低閱讀負擔
- **難度梯度**:同題型分入門 / 中階 / 挑戰

### 1.3 你的使用者是誰
- **小一、小二 (7-8 歲)**:做入門題,需家長/老師陪同
- **小三、小四 (9-10 歲)**:中階主力
- **小五、小六 (11-12 歲)**:可挑戰所有難度,有助於資優生練思考

**寫題目時想像你在跟 8-10 歲的小孩說話**。不要用艱深詞彙、不要寫太長、不要過度抽象。

---

## 2. 必讀的其他文件

開工前**一定要讀**:

| 文件 | 重點抓什麼 |
|------|-----------|
| [spec.md](spec.md) | §3 六大題型的子類型清單、§4 難度梯度定義、§9 品質檢查清單 |
| [architecture.md](architecture.md) | §1 V1 範圍、§8.5 生成器策略、§8.6 自驗要求 |
| [schema.md](schema.md) | 完整 JSON 結構、§3 skill code 列表、§4 visual.type 列表、§9 範例 |

---

## 3. 題目交付目標(數量)

| Topic | easy | mid | hard | **小計** |
|-------|------|-----|------|---------|
| matrix    | 30 | 25 | 20 | 75 |
| sequence  | 30 | 25 | 20 | 75 |
| spatial   | 20 | 20 | 15 | 55 |
| numseries | 30 | 25 | 20 | 75 |
| analogy   | 30 | 25 | 20 | 75 |
| multivar  | 20 | 20 | 15 | 55 |
| **總計**  | 160 | 140 | 110 | **410** |

> 這是建議數字。**先求品質再求數量**,如果某類型只能產出 10 題保證品質,那就 10 題,不要為了湊數降低標準。
>
> **2026-05 更新 (batch +1000):** 上表是 v1 啟動目標;實際每批的題量由 operator
> 的 task brief 指定。截至 batch 9,題庫已擴充至 1486 題(matrix 516 +
> sequence 81 + spatial 107 + numseries 75 + analogy 81 + multivar 626),
> 其中 1000 題為 batch +1000 一次性產出(17 個新 sub_type)。

---

## 3.5 響應式視覺對比規則 (2026-05 修訂版)

> 本節對應外部 spec `prompt-for-tilibrary-claude.md` 的 §11 第 10、11 條，2026-05 在 batch +1000 啟動會議中釐清。手機 320px 寬到桌面共用同一份題庫，視覺對比門檻是硬要求。

### 3.5.1 每條主規則軸的「值之間視覺對比 ≥ 1.5×」

每一條被當區分依據的主規則軸 (direction / fill / count / shape / size / stroke / length …)，其各值之間的視覺對比必須讓 7-12 歲孩童一眼能分辨。

| 軸 | mid 可用 | hard 可用 | 備註 |
|---|---|---|---|
| `direction` (↑↓←→ 4 向) | ✅ | ✅ | 對比天然 ≥ 1.5× |
| `fill` (filled vs empty / 黑白條紋 3 色) | ✅ | ✅ | OK |
| `count` (1-4 物件) | ✅ | ✅ | mid 至少 1 vs 3 起跳；不可 2 vs 3 |
| `shape` (circle/square/triangle 等三選二) | ✅ | ✅ | 輪廓差異足夠 |
| `size` | ❌ | ✅ (≥ 1.5×) | mid 禁——容易被縮放吃掉 |
| `stroke 粗細 / length 微調` | ❌ | ✅ | 僅限 hard |

### 3.5.2 mid 多軸規則

舊版規則「mid 只能 1 變量」**已作廢**。修訂後：

- ✅ mid 可以用 row=主規則軸 A、col=主規則軸 B（如 row=direction、col=fill）
- ✅ mid 可以 row_step + col_step 都改變同一變量（如都是角度）
- ❌ mid 不可在主規則之上再疊「裝飾性副屬性」(hand length 60% vs 80%、stroke 2 vs 3、angle 30° vs 45° 這種肉眼勉強分得出來的微調)

**判斷標準**：若移除某個軸後，整個 sub_type 的「規律」還能成立 → 該軸是裝飾性副屬性，mid 禁用。若移除後規律就崩潰 → 該軸是主規則軸，mid 可用。

---

## 4. 必做:三層自驗

**每題在 commit 前,你必須做以下三層檢查**。validator 會幫你做第 1 層,後兩層你要自己跑。

### Layer 1:Schema 驗證(機械)
```bash
node tools/validate.mjs
```
任何不通過的不能 commit。

### Layer 2:答案重算(語意)
**對每題,獨立於你寫題時的思路,重新推導一次答案**。
- 假裝你第一次看到這題
- 從 `prompt` + `visual` 出發推
- 對照你寫的 `answer` 跟 `explanation`
- **不一致 → 題目有 bug,改題或刪題**

範例自驗 log:
```
matrix-easy-007: visual=3x3 同排同色,?在右下角,前兩格藍三角→正解應該是藍三角。
options[2]=藍三角。answer=2。✅ 一致。
```

### Layer 3:干擾選項合理性
每個錯誤選項,寫一句「這選項對應哪種常見誤解」。
- 若你寫不出來 → 那個選項是「送分」,改一個有意義的干擾
- 全部錯選項都要對應一種具體誤解

範例:
```
matrix-easy-007 干擾分析:
  options[0] 紅三角 — 形狀對,顏色錯(只看到形狀)
  options[1] 藍圓   — 顏色對,形狀錯(只看到顏色)
  options[3] 黃方   — 都錯(沒看出任何規律)
```

---

## 5. 工作流程

### 5.1 開始前
```bash
# 1. 你在 iq-kids 倉庫根目錄
cd iq-kids/

# 2. 開一個新 branch
git checkout -b feat/question-bank-batch-1

# 3. 讀必讀文件 (§2)
```

### 5.2 為每個題型寫生成器

`tools/gen-<topic>.mjs` 骨架:

```javascript
// tools/gen-matrix.mjs
import { writeQuestion, validate } from './lib.mjs';

let counter = 1;
const id = () => `matrix-easy-${String(counter++).padStart(3, '0')}`;

function genSingleVariableRow() {
  // 1. 隨機選 3 個 (shape, color) 三元組
  const shapes = pickRandomShapes(3);
  const colors = pickRandomColors(3);

  // 2. 組 cells:每排同形狀
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) {
        cells.push({ unknown: true });
      } else {
        cells.push({ shape: shapes[row], color: colors[row] });
      }
    }
  }

  // 3. 正解 + 3 個干擾
  const correctOption = { shape: shapes[2], color: colors[2] };
  const options = generateDistractors(correctOption);
  const answerIdx = options.findIndex(o => sameShape(o, correctOption));

  // 4. 寫 prompt / hint / explanation
  return {
    id: id(),
    topic: 'matrix',
    difficulty: 'easy',
    sub_type: 'single-variable-row',
    skill_codes: ['pattern-row-identification'],
    created_at: new Date().toISOString().slice(0, 10),
    author: 'claude-generated',
    inspired_by: 'raven-matrix-2x2-style',
    prompt: '橫向看一下,每一排有什麼規律?',
    visual: { type: 'matrix-3x3', cells },
    options: options.map(o => ({
      text: describeOption(o),
      visual: { type: 'single-shape', shape: o.shape, color: o.color }
    })),
    answer: answerIdx,
    hint: `看橫的:第一排都是${describeOption({shape:shapes[0],color:colors[0]})}、第二排都是${describeOption({shape:shapes[1],color:colors[1]})},第三排前兩個是什麼?`,
    explanation: `每一排的三格是<strong>同樣的東西</strong>。第三排前兩格是${describeOption(correctOption)},所以第三格也要是<strong>${describeOption(correctOption)}</strong>。`,
    skill: '橫向規律識別'
  };
}

// 主流程
const out = [];
for (let i = 0; i < 30; i++) {
  const q = genSingleVariableRow();
  if (!validate(q)) {
    console.error(`Generated invalid question: ${q.id}`);
    process.exit(1);
  }
  out.push(q);
}
out.forEach(q => writeQuestion(`questions/matrix/easy/${q.id}.json`, q));
console.log(`Generated ${out.length} matrix-easy questions`);
```

### 5.3 各題型的子類型分配(參考 spec.md §3)

**Matrix(矩陣)**
- easy: `single-variable-row`, `dual-variable-bidirectional` (簡單版)
- mid: `dual-variable-bidirectional` (複雜版), `three-variable-independent`, `latin-square` (簡單)
- hard: `arithmetic-row`, `rotation-pattern`, `latin-square` (複雜), `mixed-three-var`

**Sequence(序列)**
- easy: `cyclic-AB`, `cyclic-ABC`, `rotation-equal-angle`
- mid: `nested-elements`, `accumulative`, `triple-cycle`
- hard: `async-variation`, `grouped-pattern`, `complex-rotation`

**Spatial(空間)**
- easy: `paper-fold-once`, `cube-counting-flat` (3-5 顆,無遮擋)
- mid: `paper-fold-twice`, `cube-counting-stacked` (5-10 顆,有遮擋)
- hard: `cube-net-fold`, `cube-net-invalid`, `volume-arithmetic-big`

> spatial 的 cube 題請用 `cubeStack` helper (schema.md §4.6)。展開圖題等 `cubeNet` helper 寫好再做(目前是 wishlist 項目)。

**Numseries(數列)**
- easy: `arithmetic-add-3`, `arithmetic-add-5`, `squares`, `geometric-x2`
- mid: `second-order-arithmetic`, `alternating-two-streams`, `geometric-x3`
- hard: `fibonacci`, `factorial`, `mixed-operation`

**Analogy(類比)**
- easy: `function`, `antonym`, `sound`
- mid: `location-workplace`, `part-whole`, `causal`
- hard: `material-source`, `degree-adverb`

> 類比題**避開需要文化背景**的(成語、地方典故、特定時代流行文化)。

**Multivar(多元變化)**
- easy: `2var-2x2`
- mid: `3var-independent-3x3`, `latin-square-3var`
- hard: `4var`, `position-swap`, `attribute-inheritance`

---

## 6. 紅線:著作權與引用

### 6.1 ❌ 絕對不可
- 從任何網站、書籍、App **逐字複製**題目敘述
- 複製 Mensa / 各類 IQ 測驗的題目選項
- 複製他人的解析文字
- 複製他人題目的精確視覺構圖(顏色、形狀、位置都一樣)

### 6.2 ✅ 可以做
- 讀別人的題目,**理解結構跟難度**
- 用相同的「題型」(如 3x3 拉丁方陣是公開的數學結構)
- 用相同的認知能力分類詞彙(如「橫向規律識別」)
- 借鑒「難度怎麼設計」(如:從單變數 → 雙變數 → 三變數)

### 6.3 在每題標明
- `"author": "claude-generated"` — 程序化生成
- `"inspired_by": "raven-matrix-style"` — 題型風格參考(非必填,但有幫助)

---

## 7. 品質紅線(從 spec.md §9 強化)

### 7.1 prompt 規則
- ✅ 用孩子聽得懂的話
- ✅ 不超過 80 字
- ❌ 不可劇透規律類型(極難題例外,可給多一點線索)
- ❌ 不用「請推導」「分析」「規律性」這種學術詞

**好範例**:`「橫向看一下,每一排有什麼規律?」`
**壞範例**:`「請分析此 3x3 矩陣的雙向變化規律,並推導空缺位置的元素」`

### 7.2 hint 必須是「問句」
- ✅ `「兩排都是紫色圓,第三排會是什麼?」` (引導思考)
- ❌ `「答案是紫色圓」` (直接給答案)
- ❌ `「重新看一下」` (沒有引導內容)

### 7.3 explanation 規則
- ✅ 用孩子的話
- ✅ 有 `<strong>` 標重點
- ✅ 至少 20 字
- ❌ 不要學術腔
- ❌ 不要自言自語(禁詞:「等等」「不對」「重看」)

### 7.4 禁詞清單(會被 validator 抓)
```
等等 | 不對! | 我們重看 | 重看: | Claude | AI | GPT | 語言模型 | 訓練資料
```

### 7.5 干擾選項規則(再次強調)
**每個錯誤選項都要對應一種具體誤解**。寫不出對應誤解 → 換一個。

---

## 8. 寫題實例(從零到完成一題)

跟你示範一個完整流程,你之後比照辦理。

### Step 1:設計
**目標**:寫一題 `matrix-easy` 的「雙向規律」題。
- 橫向變形狀(circle → square → triangle)
- 直向變顏色(pink → teal → yellow)
- ? 在右下角

### Step 2:草擬 visual
```
[粉圓]  [粉方]  [粉三角]
[綠圓]  [綠方]  [綠三角]
[黃圓]  [黃方]  [ ? ]
```
→ 正解應該是 **黃三角**。

### Step 3:設計干擾
- 粉三角(顏色錯)
- 黃方(形狀錯)
- 綠三角(都錯,但接近)

### Step 4:寫 prompt / hint / explanation
- prompt: `「橫向跟直向各有規律,?要選哪個?」`
- hint: `「看橫向:每排形狀變;看直向:每行顏色變。?在第三排第三行,形狀跟顏色各是什麼?」`
- explanation: `「橫向看,每排形狀依序是<strong>圓→方→三角</strong>。直向看,每行顏色是<strong>粉→綠→黃</strong>。? 在第三排第三行,所以是<strong>黃三角</strong>。」`

### Step 5:自驗
- Layer 1:跑 validate → pass
- Layer 2:重推導 → 確認 answer 是黃三角
- Layer 3:干擾分析寫進 generation-log

### Step 6:寫成 JSON
```json
{
  "id": "matrix-easy-002",
  "topic": "matrix",
  "difficulty": "easy",
  "sub_type": "dual-variable-bidirectional",
  "skill_codes": ["pattern-bidirectional"],
  "created_at": "2026-05-24",
  "author": "claude-generated",
  "inspired_by": "raven-matrix-2x2-style",

  "prompt": "橫向跟直向各有規律,?要選哪個?",
  "visual": {
    "type": "matrix-3x3",
    "cells": [
      {"shape": "circle",   "color": "pink"},
      {"shape": "square",   "color": "pink"},
      {"shape": "triangle", "color": "pink"},
      {"shape": "circle",   "color": "teal"},
      {"shape": "square",   "color": "teal"},
      {"shape": "triangle", "color": "teal"},
      {"shape": "circle",   "color": "yellow"},
      {"shape": "square",   "color": "yellow"},
      {"unknown": true}
    ]
  },
  "options": [
    {"text": "粉三角", "visual": {"type": "single-shape", "shape": "triangle", "color": "pink"}},
    {"text": "黃方",   "visual": {"type": "single-shape", "shape": "square",   "color": "yellow"}},
    {"text": "黃三角", "visual": {"type": "single-shape", "shape": "triangle", "color": "yellow"}},
    {"text": "綠三角", "visual": {"type": "single-shape", "shape": "triangle", "color": "teal"}}
  ],
  "answer": 2,
  "hint": "看橫向:每排形狀變;看直向:每行顏色變。?在第三排第三行,形狀跟顏色各是什麼?",
  "explanation": "橫向看,每排形狀依序是<strong>圓→方→三角</strong>。直向看,每行顏色是<strong>粉→綠→黃</strong>。? 在第三排第三行,所以是<strong>黃三角</strong>。",
  "skill": "雙向規律推理"
}
```

### Step 7:commit
```bash
git add questions/matrix/easy/matrix-easy-002.json
git commit -m "feat(matrix): add easy-002 bidirectional pattern"
```

---

## 9. 交付:Generation Log

寫一份 `docs/generation-log.md`,涵蓋:

```markdown
# Generation Log — Batch 1 (2026-05-24)

## 統計
- 共生成 410 題
- matrix: 75 (easy 30, mid 25, hard 20)
- ...

## 各 sub_type 分布
- matrix.easy.single-variable-row: 15 題
- matrix.easy.dual-variable-bidirectional: 15 題
- ...

## 抽樣校對結果
人工抽 10% (約 41 題) 重做一次:
- 39 題答案正確 ✅
- 2 題發現 bug:
  - sequence-mid-018: 干擾選項 B 跟正解都滿足規律 → 改 B 為 ...
  - analogy-hard-007: explanation 提到「成語」→ 違反「避免文化背景」原則 → 改

## 我的判斷不確定
以下幾題我不太確定 7-10 歲小孩能不能解,留給 reviewer 評估:
- spatial-hard-012 (5 顆方塊堆疊有遮擋,要推 2 顆隱藏)
- numseries-hard-008 (混合運算,×2 + 1)

## 已知限制
- 我沒寫 cubeNet (展開圖) 題,因 helper 未實作
- analogy 受限於常識,程序化生成難度高,以模板 + 抽換為主
```

---

## 10. PR 規範

PR 標題:`feat: question bank batch 1 — 410 questions`

PR body 必含:
- [ ] 跑過 `node tools/validate.mjs` 全 pass
- [ ] 跑過 `node tools/build-manifest.mjs` 更新索引
- [ ] 三層自驗 log 附在 `docs/generation-log.md`
- [ ] 抽樣 10% 人工複核,問題已修
- [ ] 沒有複製任何外部題目
- [ ] 沒有禁詞、沒有 AI 自言自語

---

## 11. 開始作業時的第一句

當你被分派來做這份工作,請第一句話回:

> "我已讀 docs/spec.md, docs/architecture.md, docs/schema.md, docs/authoring.md。
> 我會從 matrix 題型開始,先寫 `tools/gen-matrix.mjs`,目標 75 題,分 sub_type 平均分布。
> 預計工序:gen-matrix → validate → spot-check → 下一個題型。
> 開始前我有 X 個問題:..."

如果你沒有問題,直接開工。如果有,**先問清楚再開工**,不要猜。

---

**祝你寫題愉快。記住:你是在幫小朋友學會「怎麼想」,不是在做考試題庫。每一題都要溫柔、有意義、可學習。**

— 系統 Claude (架構與整合方)
