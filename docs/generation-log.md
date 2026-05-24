# Generation Log

> 「題庫 Claude」的工作日誌。每一批生成記錄在這裡 — 計畫、來源、自驗、未解疑問。
>
> **規則**:
> - 每批先寫「計畫段」push 給 reviewer,OK 後才開始批量生題
> - 不省略外部閱讀清單(以後擴到 10000 題,要靠這份避免重複)
> - 不確定的題目要列在「待 reviewer 判斷」段
> - 寫作風格:對話、可追溯、不修飾

---

## Batch 3 — sequence (2026-05-24) ✅ DONE

### Reviewer 回覆 (PR #5)
- **Q1 cyclic-count-color seed**: 不擴,seed 不動,我用 dual-attribute-cycle 自己的 label ✅
- **Q2 nested-elements 數量**: 5 題,raw SVG 統一從 `nestedCellRaw()` helper 出 ✅
- **Q3 命名**: 採 `dual-attribute-cycle` (不是 reviewer 原話的 triple-cycle) ✅
- **加碼**: 「對」+「最像錯答」要 ≥ 2 attr 視覺差異,避免「靠看哪個最像就猜」 — 已實作 ✅

### 統計
| 難度 | 數量 | sub_type 分布 |
|------|------|--------------|
| easy | 30 | cyclic-AB 10 / cyclic-ABC 10 / rotation-equal-angle 10 |
| mid  | 25 | accumulative 10 / dual-attribute-cycle 10 / nested-elements 5 |
| hard | 20 | async-variation 8 / grouped-pattern 6 / complex-rotation 6 |
| **總計** | **75** | 8 個 sub_type,覆蓋 schema §3 的 5 個 sequence-* canonical 集 |

從 `sequence-easy-003.json` 起跳,**完全沒動 -001/-002**(spec 作者 seed)。

### 生成器架構
`tools/gen-sequence.mjs`:每 sub_type 一個 generator,共用 `gen-utils.mjs` 的 COLOR_ZH/SHAPE_ZH/makeRng/rngShuffle。
新引入 `cellDistance(a, b)` 算兩 cell 的 attribute 距離,用來自驗 distractor 設計符合 I-RAVEN 約束。
nested-elements 5 題的 raw SVG 全部從 `nestedCellRaw(outer, outerColor, inner, innerColor)` helper 出(per reviewer Q2 要求)。

### 干擾選項 + I-RAVEN 視覺距離抽樣

I-RAVEN 教訓:同題 4 個選項裡,「對」+「最像錯答」如果只差 1 個 attribute,孩子靠「看哪個最像」就能猜。
要混合 distractor 距離:**至少 1 個 distractor 距 ≥ 2 attr**。

自動腳本掃全部 70 題(扣 5 題 nested 用 raw,無法計算 cell distance),確認:
- **0 題** 全部 distractor 都距 1(這是壞例,RAVEN 漏洞)
- 每題至少有 1 個 distractor 距 ≥ 2

抽樣 3 題列「對 vs 最像錯答」視覺距離:

```
sequence-easy-003 (cyclic-AB):  紫圓 :: 藍綠菱形 :: 紫圓 :: 藍綠菱形 :: ?
  correct = 紫圓 (purple circle)
  distances = [1, 2, 2]
  最像錯答 = 「藍綠圓」 (距 1, color 不同 shape 同) — 但其他 2 個 distractor 都距 2,
  整體選項組沒有「mode = 紫」這種統計漏洞

sequence-mid-013 (dual-attribute-cycle): ... → ? = 橘三角
  correct = 橘三角 (orange triangle)
  distances = [2, 1, 1]
  最像錯答 = 「橘方」 (距 1, shape 不同 color 同)
  另一 distractor「黃三角」 (距 1, color 不同 shape 同)
  「黃菱形」距 2
  → 沒有單一 attribute 是 mode

sequence-hard-011 (grouped-pattern):
  correct = 黃 + 第6個shape (距前面5格的形狀都不同)
  distances = [2, 2, 1]
  最像錯答 = 上一格的形狀 (黃色但 shape 重複 → 違反組內形狀不同的規則)
  其他 2 個 distractor 都距 2
```

### 三層自驗
- **Layer 1 (schema)**: `node tools/validate.mjs --strict questions/sequence` → 80/81 pass (1 fail 是 seed mid-001 的 hint 結尾 `!`,不是我的)
- **Layer 2 (答案重算)**: 抽 3 題手算 (easy-003 cyclic-AB / mid-013 dual-attribute-cycle / hard-003 async-variation),答案全對
- **Layer 3 (干擾合理性 + I-RAVEN distance check)**: Python 腳本掃 70 結構化題,0 題踩 RAVEN「全 distractor 距 1」漏洞;3 題抽樣列上方

### 修 bug 過程
- 沒踩到 v2 bug,因為這次寫 PROMPTS 時直接用 sub_type 完整字串(吸取 analogy v1 的教訓)。 throw 沒被觸發 = 第一次跑就成功

### 已知限制
- **accumulative 兩個變體**(用 dots 1-5 或 count 1-4) 各佔 5 題左右,seed-based 隨機抽,可能某些 batch 偏向其中一種。若 reviewer 想要嚴格 5+5 分配可加 forced split
- **rotation step 只用 45° 或 90°**,沒做 30°/60° (那些角度的箭頭視覺旋轉現在的 shapes helper 應該也支援,但保守起見限制在常見角度)
- **dual-attribute-cycle 永遠是 shape 週期 3 + color 週期 2** (合週期 6),沒做其他組合 (e.g. 週期 2+3 或 2+4)。等 reviewer 要不要擴
- **nested-elements 限制 outer ∈ {circle, square, triangle}, inner 同**,因為 raw SVG helper 只實作這 3 種。要支援 star/diamond/hex 需擴 helper

### 提案下一批
**Batch 4: matrix** (75 題)
- 跟 sequence 邏輯接近,但展開成 3×3 矩陣
- 已讀完 RAVEN 文獻 (在 batch 3 用上了),可直接套用「attribute combination」思路
- 從 matrix-easy-003 起跳

---

### v2 修正 (2026-05-24 reviewer reject 後,同 PR #5)

**問題**:reviewer 抓到 6 題 grouped-pattern (hard-011~016) 的 distractor text 是 `"粉紅undefined"` / `"藍綠undefined"` 之類,visual 的 `single-shape` 缺 `shape` 欄位。原 validator 沒抓到(因為 "粉紅undefined" 不是空字串)。

**Root cause**:`genGroupedPattern` 內 `SHAPES.find(s => !shapes.includes(s))` — 但 grouped-pattern 已經用了全部 6 個 SHAPES,find 回傳 `undefined`,組成 cell `{shape: undefined, color: co4}`,`describe()` 內 `SHAPE_ZH[undefined]` 也是 `undefined`,template 串成 `"橘undefined"`。

**修法**:
1. **修 generator (gen-sequence.mjs)**:`D3` 改用 `{shape: shapes[0], color: co4}` — 用已出現過的 shape + 新色,語義上是「冒出第 4 組」,仍屬「跳出規則」的誤解類型,跟 correct 視覺距離 ≥ 2
2. **加 generator-side guard (describe)**:cell 缺 `shape`/`color` 時直接 throw,避免未來再有 silent undefined 流到 text
3. **驗收**:
   - rebase origin/main 拉新版 validator (b012bd5)
   - `node tools/validate.mjs --strict questions/sequence` → 80/81 pass(僅 seed mid-001 hint 結尾 `!`)
   - grep 「undefined」 在 hard-011~016 → 0 hit
   - 抽 hard-013 第 4 個選項驗:現在是「粉紅圓」(有 shape + color 完整 visual)
4. **沒 force-rebase**:單純加 fix commit 進 PR #5

**教訓**:寫 generator 時假設 pool 永遠夠用,沒設想「pool 抽光」邊界。以後 generator 第一行要先 assert `POOL.length > totalNeeded`,或者用 with-fallback 的工具函數。新加的 describe() guard 已經堵住 silent undefined 流出。

**reviewer 的 validator 補強值得記**:`text` 含「undefined / null / NaN」字面 + `single-shape` 缺 `shape` 欄位 — 這兩條規則我也應該在 lib.mjs 那邊吸收當常識,以後新題型 generator 出問題會立刻被抓。

---

## (舊) Batch 3 — sequence (planning, 已 by-passed) 📝

### 既存 6 seed (1/2 各難度,撈自 git 歷史) → 我從 -003 起跳
| ID | sub_type | 視覺手法 |
|----|----------|--------|
| sequence-easy-001 | rotation-equal-angle | 結構化 cell (arrow + rotation) |
| sequence-easy-002 | cyclic-ABC | 結構化 cell (shape + color) |
| sequence-mid-001 | cyclic-count-color | 結構化 cell (shape + count + color) |
| sequence-mid-002 | nested-elements | **raw SVG**(外框 + 內元素同步) |
| sequence-hard-001 | async-variation | 結構化 cell (arrow + rotation + color,不同步) |
| sequence-hard-002 | grouped-pattern | 結構化 cell (shape + color,兩兩分組同色) |

### 目標 75 題 sub_type 分布

| 難度 | 數量 | sub_type | skill_code | 視覺手法 |
|------|------|----------|-----------|--------|
| easy | 30 | cyclic-AB (10) / cyclic-ABC (10) / rotation-equal-angle (10) | sequence-cyclic × 2, sequence-rotation | 純結構化 cell |
| mid  | 25 | accumulative (10) / dual-attribute-cycle (10) / nested-elements (5) | sequence-accumulative, sequence-cyclic, sequence-nested | 結構化 (前 2) + raw (後 1) |
| hard | 20 | async-variation (8) / grouped-pattern (6) / complex-rotation (6) | sequence-async, sequence-grouped, sequence-rotation | 純結構化 cell |
| **總計** | **75** | 8 個 sub_type | 5 個 skill_code 全覆蓋 sequence-* canonical 集 | |

### 視覺策略(per reviewer:儘量結構化,避免 raw)

| sub_type | items[] cell 用什麼欄位 | option visual.type |
|----------|----------------------|------------------|
| cyclic-AB | shape + color | single-shape |
| cyclic-ABC | shape + color | single-shape |
| rotation-equal-angle | shape:arrow + rotation | single-shape |
| accumulative | shape + count (用 multiShape 1-4) OR dots 1-6 | single-shape (含 count/dots) |
| dual-attribute-cycle | shape + color(兩個獨立週期,長度不同) | single-shape |
| nested-elements (5 題) | **raw SVG**(外框形狀 + 內元素,兩個獨立規律) | raw-html |
| async-variation | shape + rotation + color(其中兩個改變速度不同) | single-shape |
| grouped-pattern | shape + color(兩兩或三三同色,形狀逐格變) | single-shape |
| complex-rotation | shape:arrow + rotation + color(輪轉) | single-shape |

**raw 只用在 nested-elements 的 5 題**,因為 schema 沒提供「外框 + 內元素」原生結構。其他 70 題全結構化 cell。

### 干擾選項設計 (per I-RAVEN 教訓)

**讀完 I-RAVEN 文獻學到的:** 原始 RAVEN 把 distractor 設計成「對的答案改一個 attribute」,結果 distractor 集合的眾數(mode)就是正解 — context-blind 模型靠統計就破題。lesson:**不要全部 distractor 都是「對的答案改一個 attribute」**,要混合錯誤類型。

我的對策(每題 3 個錯答,3 種類別不同):

| sub_type | (a) 規則內錯位 | (b) 部分規則對 | (c) 跳出規則 |
|----------|--------------|-------------|------------|
| cyclic-AB / ABC | 拿前一個 cycle 位置 | 對的形狀錯顏色 / 對的顏色錯形狀 | 完全新形狀 |
| rotation | 反方向 / 多轉一格 | 對的角度錯形狀 | 不在角度集合內的角度 |
| accumulative | 同上一個 / 上一個 +2 | count 對 shape 錯 | 完全不同 shape |
| dual-attribute-cycle | 兩 cycle 都錯一格 | A cycle 對 B 錯 / B 對 A 錯 | 新元素 |
| nested-elements | 外框錯 內對 / 反之 | 兩個都換到別的循環位置 | 不在組合空間內的元素 |
| async-variation | 把不同步當同步 | 對的快變數錯的慢變數 / 反之 | 完全跳脫規律 |
| grouped-pattern | 跟前一格同色同形(忽略分組) | 對的顏色錯形狀(等於本組已用) | 跨組的元素 |
| complex-rotation | 只轉沒換色 / 只換色沒轉 | 對的色錯的角度 / 反之 | 完全脫節 |

每個錯答都對應一種具體誤解,**不全是「對的答案改一個 attribute」**。避開 RAVEN 的統計漏洞。

### 外部閱讀清單

| # | 來源 | 學到什麼 | 是否擷取題目/視覺 |
|---|------|---------|----------------|
| 1 | [RAVEN project page (wellyzhang)](https://wellyzhang.github.io/project/raven.html) | 404 已下架,跳過 | 無 |
| 2 | [RAVEN GitHub](https://github.com/WellyZhang/RAVEN) | RAVEN 採 attributed stochastic image grammar,單一 generator 跑 7 種圖形配置;具體 attribute 細節在 src/dataset/Attribute.py | 無 |
| 3 | [RAVEN Attribute.py](https://github.com/WellyZhang/RAVEN/blob/master/src/dataset/Attribute.py) | **7 種屬性**:Number, Type (shape), Size, Color, Angle (rotation), Uniformity, Position;每屬性離散值集合,用 index 操作而非 raw value | 無 |
| 4 | [I-RAVEN-X paper (2510.17496)](https://arxiv.org/pdf/2510.17496) + survey on RPM | **核心教訓**:RAVEN 原版 distractor 是「對的答案改一個 attribute」→ context-blind 模型靠 mode 就能破題。I-RAVEN 用 attribute bisection tree 平衡。我的對策見上方表 | 無 |
| 5 | [A-I-RAVEN paper](https://arxiv.org/html/2406.11061v2) | 進一步改良,確認 distractor 多樣性是關鍵 | 無 |

**避開:** RAVEN 用的是 3×3 matrix 完整 generator,我只做 1×6 sequence。完整 generator 對我太重型,我採「sub_type 各自小生成器 + 共用 pool」設計。

### 生成器架構
`tools/gen-sequence.mjs` + 共用 `tools/gen-utils.mjs`:
- 每個 sub_type 一個 generator function
- 共用 SHAPE_POOL, COLOR_POOL (避免每題都圓圓方方)
- 共用 cycleNext / rotationNext / accumulativeNext 等 helper
- 5 個 nested-elements 題的 raw SVG 用 template function 生(不每題手刻)

### 開工前問題 (blocking)

1. **既存 sequence-mid-001 的 sub_type 是 `cyclic-count-color`** (不在 reviewer 推薦清單 cyclic-AB/ABC/rotation)。我:
   - (A) 沿用這個 sub_type,加 0 題(尊重 seed 作者)
   - (B) 自己生 0 題 cyclic-count-color,完全用 reviewer 推薦的 8 個 sub_type
   - 預設 (B),seed 那 1 題已存在,我不擴
2. **nested-elements 是否真的要做 5 題?** 它需要 raw SVG(reviewer 警告儘量避免)。三個選項:
   - (A) 維持 5 題:raw 確實是這 sub_type 的唯一表達方式
   - (B) 改 3 題:raw 量降低,但 mid bucket 變 23 題
   - (C) 改 0 題 + 把 5 題挪到 accumulative/dual-attribute(各 +2-3 題):mid 仍 25 題,完全 0 raw
   - 預設 (A),理由:sequence-mid-002 seed 已示範 raw 的用法,renderer 已 work
3. **dual-attribute-cycle 命名**:reviewer 寫的是 "triple-cycle"。我理解你的意思是「比 easy 的 single attribute 循環更複雜的 mid 版」,但 "triple" 字面是「3 個循環」。我採用更精確的 `dual-attribute-cycle`(兩個獨立 cycle attribute)。若 reviewer 堅持 "triple-cycle" 命名我會改

### 草樣 — 預定生成的前 3 題

```json
// sequence-easy-003 (cyclic-AB)
{
  "items": [
    {"shape":"circle","color":"pink"}, {"shape":"square","color":"teal"},
    {"shape":"circle","color":"pink"}, {"shape":"square","color":"teal"},
    {"unknown":true}
  ],
  "answer": "粉圓",
  "distractors": ["藍綠方"(=當前位置非下一個), "粉方"(shape對color錯), "藍綠圓"(color對shape錯)]
}

// sequence-mid-003 (accumulative)
{
  "items": [
    {"shape":"circle","color":"pink","count":1}, {"shape":"circle","color":"pink","count":2},
    {"shape":"circle","color":"pink","count":3}, {"shape":"circle","color":"pink","count":4},
    {"unknown":true}
  ],
  "answer": "5 個粉圓",
  "distractors": ["4 個"(沒加), "3 個"(倒退), "5 個粉方"(count對shape錯)]
}

// sequence-hard-003 (complex-rotation)
{
  "items": [
    {"shape":"arrow","rotation":0,"color":"pink"},
    {"shape":"arrow","rotation":45,"color":"teal"},
    {"shape":"arrow","rotation":90,"color":"yellow"},
    {"shape":"arrow","rotation":135,"color":"pink"},
    {"unknown":true}
  ],
  "answer": "藍綠 ↓(180°)",
  "distractors": ["粉 ↓"(色 cycle 看錯), "藍綠 →(90°)"(角度倒退), "黃 ↓"(色 cycle 跳一格)]
}
```

### 等 review

不寫 generator code、不生 questions,直到 reviewer 對以下三項拍板:
1. **既存 cyclic-count-color seed** 處理(A/B)
2. **nested-elements 數量**(5/3/0)
3. **dual-attribute-cycle 命名**(我提的 vs reviewer 的 triple-cycle)

push 後等回覆。

---

## Batch 1 — numseries (2026-05-24) ✅ DONE

### 統計
| 難度 | 數量 | sub_type 分布 |
|------|------|--------------|
| easy | 30 | arithmetic-ascending 12 / arithmetic-descending 6 / square-numbers 6 / geometric-x2 6 |
| mid  | 25 | second-order-arithmetic 9 / alternating-two-streams 8 / geometric-x3 8 |
| hard | 20 | fibonacci-like 7 / factorial-multiplier 6 / mixed-multiply-add 7 |
| **總計** | **75** | |

### 生成器
`tools/gen-numseries.mjs` + `tools/gen-utils.mjs`。
全程序化:每個 sub_type 一個 generator function,接受 (start, step, length) 等參數,輸出含 prompt/hint/explanation 的 question 物件。

### 外部參考
**無**。完全用公開數學概念(等差、平方、等比、二階等差、費氏、階乘、混合運算)。沒讀任何外部 IQ 題庫。

### 三層自驗
- Layer 1 (schema):`node tools/validate.mjs --strict questions/numseries` → 75/75 pass
- Layer 2 (答案重算):人工抽 5 題重推導 → 5/5 正確
  - numseries-easy-001 [1,3,5,7,?] → 9 ✓
  - numseries-easy-019 [1,4,9,16,?] → 25 ✓
  - numseries-mid-001 [1,2,4,7,11,?] → 16 ✓
  - numseries-mid-010 [2,10,4,12,6,14,?] → 8 ✓
  - numseries-hard-001 [1,1,2,3,5,?] → 8 ✓
- Layer 3 (干擾選項):每題 3 個干擾都對應誤解類型,例:
  - arithmetic: ±1 (數錯步長), +step (重複一次)
  - second-order: +(prev diff) (沒看出差遞增), +(diff+1)
  - fibonacci: ×2 (誤以為等比), +1 (隨便加), 前+前前前 (相加位置錯)

### 已知限制
- 部分交錯雙串題(altConfigs 中 step 相同的)規律較弱,如 [2,10,4,12,6,14] 兩串都 +2。可解但稍鈍。如 reviewer 覺得需強化可改 generator,讓兩串 step 必不同。
- 部分 fall-back 干擾(distractor 去重後不足 4 個時)只是 answer+7*k 偏移,品質普通。約影響 5-10 題。

### Reviewer 回饋(2026-05-24)
> 「語氣 / 難度 / 引導語都 OK,沒特別問題」

→ 不調整 numseries 生成器,直接開下一批。

---

## Batch 2 — analogy (2026-05-24) ✅ DONE

### Reviewer 回覆(Q1/Q2/Q3)
- **Q1 prompt**: 採 (B) 同 sub_type 統一 ✅
- **Q2 干擾**: 拿掉「隨機」,改為 4 種「結構對但語義錯」 ✅
- **Q3 degree**: 維持 6 題 hard,explanation 必須點明「程度差異」非「同義」 ✅

### 統計
| 難度 | 數量 | sub_type 分布 |
|------|------|--------------|
| easy | 30 | function 15 / antonym 15 |
| mid  | 25 | location-workplace 10 / sound 10 / causal 5 |
| hard | 20 | material-source 8 / part-whole 6 / degree-intensity 6 |
| **總計** | **75** | 8 個 sub_type 全覆蓋 |

從 `analogy-easy-003.json` 起跳,**完全沒動 -001/-002**(spec 作者保留題)。

### 生成器
`tools/gen-analogy.mjs`:每個 sub_type 一個 word-pair pool(8 個 pool,~90 對),從 pool 抽兩對組成 (p1, p2) 題目。共用 `tools/gen-utils.mjs`。

### 干擾選項設計(per Q2 review)
四類分配到每個 sub_type,**無任何隨機 distractor**,每個錯答都「為什麼錯」說得出來:

| 類型 | function/location/sound/causal/material/part-whole | antonym/degree |
|------|---|---|
| (a) 同類 B | pool 內別組的 b(關係型對,具體配對錯) | 同 |
| (b) 反方向 | entry.reverse(動作的對象/結果) | (antonym) 同類 A;(degree) p2.a 本身(同義詞陷阱) |
| (c) 跨類別 | entry.cross(主題相關但關係錯) | (antonym) entry.related;(degree) 別組 a |

### 抽樣干擾分析(8 題逐項說明)

```
analogy-easy-003: 牙齒:咬 :: 耳朵:?
  options: 看 / 頭 / 聲音 / [聽]✓
    看   = function pool 別組 b
    聲音 = 反方向 (耳朵的「結果」是聲音,不是用途)
    頭   = 跨類別 (耳朵在頭上,部位非功能)

analogy-easy-018: 黑:白 :: 開心:?
  options: 小 / 大 / 安靜 / [難過]✓
    小   = antonym pool 別組 b
    大   = antonym pool 別組 a (反義詞但跟「開心」無關)
    安靜 = 跨類別 (開心跟安靜同情緒領域但非反義)

analogy-mid-003: 消防員:消防局 :: 蜘蛛:?
  options: 八隻腳 / 蟲子 / [蜘蛛網]✓ / 教室
    八隻腳 = 跨類別 (蜘蛛特徵非地點)
    蟲子   = 反方向 (蜘蛛吃的對象,非住處)
    教室   = 別組 b (老師的地點)

analogy-mid-013: 牛:哞 :: 豬:?
  options: 泥巴 / 尾巴 / 咩 / [噗噗]✓
    泥巴 = 反方向 (豬常在的東西,非叫聲)
    尾巴 = 跨類別 (豬的身體部位)
    咩   = 別組 b (羊的叫聲)

analogy-mid-022: 馬:嘶 :: 牛:?
  options: 咩 / 草 / [哞]✓ / 牛奶
    咩   = 別組 b (羊的叫聲)
    草   = 反方向 (牛吃的東西)
    牛奶 = 跨類別 (牛的產出)

analogy-hard-003: 牛奶:乳牛 :: 糖:?
  options: [甘蔗]✓ / 甜 / 糖罐 / 蜜蜂
    甜   = 跨類別 (糖的特性非原料)
    糖罐 = 反方向 (裝糖的容器)
    蜜蜂 = 別組 b (蜂蜜的原料)

analogy-hard-015: 葉子:樹 :: 鏡頭:?
  options: [相機]✓ / 照片 / 車子 / 腳架
    照片 = 反方向 (鏡頭的產出非整體)
    車子 = 別組 b (輪子的整體)
    腳架 = 跨類別 (相機配件,跟鏡頭並列非整體)

analogy-hard-020: 微笑:大笑 :: 摸:?
  options: 盯 / 摸 / 看 / [抓]✓
    盯 = 別組 b (看的強烈版)
    摸 = 同義詞陷阱 (p2.a 本身,測試「程度更強」是否被誤判成「同義」)
    看 = 別組 a (完全不同類動作)
```

### 三層自驗
- Layer 1 (schema):`node tools/validate.mjs questions/analogy` → 81/81 pass(其中 6 題是 -001/-002 seed,我的 75 題全 pass 無 errors 無 warnings)
- Layer 2 (答案重算):上面 8 題已逐項列出,全部正確
- Layer 3 (干擾合理性):同上 8 題已寫出每個錯答的誤解類型

### 修 bug 過程(透明 log)
1. **function pool 太小**:原 12 對抽不出 15 題 → 加到 18 對(雨傘/吸管/叉子/湯匙/橡皮擦/繩子)
2. **中文短詞 explanation 過短**:antonym 1-char 詞題 strip-HTML 後 < 20 字觸發 warning → 加描述變 30+ 字
3. **PROMPTS lookup bug (critical)**:key 寫 `material`/`partWhole`/`degree` 但 sub_type 字串是 `material-source`/`part-whole`/`degree-intensity`,30 題 mid+hard 全部 fallback 到 function prompt。改 key 跟 sub_type 字串一致 + 加 `throw` 防 silent 後備

### 外部閱讀清單

| # | 來源 | 學到什麼 | 是否擷取題目 |
|---|------|---------|-------------|
| 1 | [ReasonEra 47 datasets](https://reasonera.medium.com/47-open-source-datasets-for-abstract-logical-and-inductive-reasoning-puzzles-plus-the-tool-that-117ea4fdfb44) | 47 個資料集多為 matrix/spatial/LLM training,**沒有兒童 verbal analogy 專屬資料集** | 無 |
| 2 | [github.com/topics/iq-test](https://github.com/topics/iq-test) | 主流專案幾乎都做 RPM 視覺,沒人切細 sub_type,我們的雙標記比業界精細 | 無 |
| 3 | [GeeksforGeeks Verbal Analogies](https://www.geeksforgeeks.org/aptitude/verbal-analogies-types-with-examples/) | 6 大類:Synonym/Antonym, Group, Function, Degree, Item-to-Category, Cause-Effect。**Group / Item-to-Category 我們沒有**,未來可加 | 無 |
| 4 | [Unstop 9-subtype](https://unstop.com/blog/verbal-analogy-explained) | 9 子型(serial-reasoning/conditional 等)對 7-12 歲太抽象,**不採用** | 無 |
| 5 | [CogAT K-2 sample](https://elmacademyprep.com/cogat-verbal/) | K-2 用 2×2 picture matrix,我們 A:B::C:? 結構合適 7+ | 無 |

**RAVEN / WellyZhang**:留到 Batch 3 (matrix) 才讀。

### 已知限制 / 留給 reviewer 判斷
1. **同類器官互相配對**:function pool 有「眼睛/耳朵/鼻子/嘴巴/牙齒」5 個頭部器官,若 p1/p2 都從這 5 個抽,題目像「眼睛:看 :: 耳朵:?」— 兩個都是頭部器官。若覺得太單調可加 sub-pool 區隔(器官 vs 工具)
2. **sound pool 鴨呱 / 青蛙呱呱**:1 字 vs 2 字差異,小朋友能分辨;若想避免重疊感可移其一
3. **degree 題 p2.a 出現在選項**(如 hard-020 的「摸」):這是 pedagogical 設計(同義詞陷阱)還是看起來怪?要 reviewer 拍板

### 提案下一批
**Batch 3:sequence** (75 題)
- easy 30:cyclic-AB / cyclic-ABC / rotation-equal-angle
- mid 25:nested-elements / accumulative / triple-cycle
- hard 20:async-variation / grouped-pattern / complex-rotation
- 不讀外部資源(視覺序列規律是公開概念)
- 從 sequence-easy-003 起跳

---

### v2 修正 (2026-05-24, 同 PR #4 內第二 commit)

Reviewer 對 batch 2 給了 3 個調整,本次全部修完:

**1. function 拆 3 sub-pool**(避免同類器官互配的單調感)
- 舊:`function` 15 題,pool 內混器官/工具/動物
- 新:拆成 3 個 sub_type 各 5 題(總計 15 不變,保 easy bucket = 30):
  - `function-body-sense` (5 題):眼睛/耳朵/鼻子/舌頭/手指/牙齒/腳
  - `function-animal-part` (5 題):兔子:長耳朵 / 大象:長鼻子 / 長頸鹿/袋鼠/烏龜/螃蟹/蝸牛/刺蝟
  - `function-tool` (5 題):剪刀/鎚子/鉛筆/鑰匙/掃把/雨傘/吸管/湯匙/橡皮擦/繩子
- 3 個 sub_type 都用同個 skill_code `analogy-function`(雷達圖維度不變,純內部多樣化)
- ⚠️ **與 reviewer 提的「10 題 each = 30 total」不同**:那會讓 easy bucket = function 30 + antonym 15 = 45,超過 authoring.md §3 的 easy=30。我採 5+5+5 保 easy=30。**若 reviewer 想擴 easy 至 45 我可以再加 15 題,等拍板**

**2. 鴨:呱 → 鴨:嘎嘎**(避免跟 青蛙:呱呱 混淆)
- 純 pool 一行改:`{ a: '鴨', b: '嘎嘎', ... }`

**3. degree 拿掉「p2.a 自己」當干擾**
- 舊:distractor (b) 用 `p2.a` 作同義詞陷阱 → reviewer 認為對 7-12 歲是 confusing 而非 pedagogical
- 新:改用「別組 a #1」+「別組 a #2」(兩個不同類別的「微弱版」動作)
- 驗證:6 題 degree 用 Python 腳本逐項檢查 `p2.a in options`,**全部 False**
- 範例 analogy-hard-020: 微笑:大笑 :: 摸:抓
  - 舊 options: 盯 / 摸 / 看 / [抓] ← 摸 = p2.a 自指
  - 新 options: 盯 / 看 / 涼 / [抓] ← 全部別組 a 或 b,無自指

### v2 三層自驗
- Layer 1:`node tools/validate.mjs questions/analogy` → 81/81 pass(同 v1)
- Layer 2:重新跑 spot-check 3 個 function sub_type + 鴨題 + 全 6 degree 題,prompts/answers/distractors 都對
- Layer 3:degree 6 題自動腳本驗證 `p2.a` 不出現在 options

### v2 修 bug 過程
- `Missing PROMPT for sub_type: function-body-sense` — 拆 sub_type 後忘了加新 PROMPTS key,被 `throw` 抓到(就是上次加的防後備在發揮作用)。補 3 個新 key 修完

---

## (舊)Batch 2 — analogy (planning, 已 by-passed) 📝

### 目標
75 題,從 `analogy-easy-003.json` 起跳(-001/-002 是 spec 作者保留題,不動)。

### 既存 6 題 sub_type 配置(從 git 撈回的 spec 作者原作)
| ID | sub_type | 範例關係 |
|----|----------|---------|
| analogy-easy-001 | function | 鳥:翅膀 :: 魚:鰭 |
| analogy-easy-002 | antonym | 熱:冷 :: 高:矮 |
| analogy-mid-001 | location-workplace | 廚師:廚房 :: 醫生:醫院 |
| analogy-mid-002 | sound | 小狗:汪 :: 小貓:喵 |
| analogy-hard-001 | material-source | 紙:樹 :: 麵包:小麥 |
| analogy-hard-002 | part-whole | 手指:手 :: 花瓣:花 |

→ 我**沿用**這個難度梯度:function/antonym 屬 easy,location/sound 屬 mid,material/part-whole 屬 hard。

### 計畫 sub_type 分布

| 難度 | 數量 | sub_type 分布 | 對應 skill code |
|------|------|-------------|-----------------|
| easy | 30 | function 15 / antonym 15 | analogy-function, analogy-antonym |
| mid  | 25 | location 10 / sound 10 / causal 5 | analogy-location, analogy-sound, analogy-causal |
| hard | 20 | material 8 / part-whole 6 / degree 6 | analogy-material, analogy-part-whole, analogy-degree |
| **總計** | **75** | 8 個 sub_type,覆蓋 schema §3 全部 analogy skill code | |

### 生成策略
**模板 + 詞對池**(不是純隨機程序化,因為語意關係要人工 curate):
1. 每個 sub_type 建一個 word-pair pool(`tools/gen-analogy.mjs` 內 const 陣列)
2. 生成器從 pool 隨機抽 2 對:(A,B) 跟 (C,D),題目顯示 `A:B :: C:?`,正解是 D
3. 干擾選項從 4 個來源:
   - 干擾 1:同 pool 其他對的 B(混淆同類別不同對)
   - 干擾 2:C 的相關詞但錯方向(part-whole 互換、antonym 重複)
   - 干擾 3:語意干擾(同主題但錯關係,例 material 題塞個 location)
   - 干擾 4(備用):隨機其他類別的詞,確保 4 個選項

### Word-pair pool 規模(暫定)
| sub_type | pool 目標 | 可組合題數(N×(N-1)) | 取題 |
|----------|----------|---------------------|------|
| function | 12 對 | 132 | 15 |
| antonym | 18 對 | 306 | 15 |
| location | 12 對 | 132 | 10 |
| sound | 12 對 | 132 | 10 |
| causal | 8 對 | 56 | 5 |
| material | 10 對 | 90 | 8 |
| part-whole | 10 對 | 90 | 6 |
| degree | 8 對 | 56 | 6 |

理論可組超過 75,但實際會去重(同正解詞不能重複出現太多次)+ 篩掉語意衝突組合(例 antonym 連到本身就是反義詞鏈)。

### 外部閱讀清單

| # | 來源 | 用途 | 學到什麼 | 是否擷取題目 |
|---|------|------|---------|-------------|
| 1 | [ReasonEra 47 datasets](https://reasonera.medium.com/47-open-source-datasets-for-abstract-logical-and-inductive-reasoning-puzzles-plus-the-tool-that-117ea4fdfb44) | 找 analogy-friendly 公開資料集 | 47 個資料集多為 matrix / spatial / LLM training,**沒有兒童 verbal analogy 專屬資料集**。GSM8K 標「grade school」但其實是給 ML benchmark 用 | 無 |
| 2 | [github.com/topics/iq-test](https://github.com/topics/iq-test) | 看別人 schema 怎麼設計 | 主流 React/JS 專案幾乎都做 RPM 視覺,沒人切細 sub_type,我們的 `sub_type` + `skill_codes` 雙標記比業界精細 | 無 |
| 3 | [GeeksforGeeks Verbal Analogies](https://www.geeksforgeeks.org/aptitude/verbal-analogies-types-with-examples/) | 找 analogy 類別 taxonomy | 6 大類:Synonym/Antonym, Group, Function, Degree, Item-to-Category, Cause-Effect。**Group 跟 Item-to-Category 我們沒有**,未來可加 `analogy-group`、`analogy-category-member` skill code | 無 |
| 4 | [Unstop 9-subtype](https://unstop.com/blog/verbal-analogy-explained) | 找更細的關係分類 | 9 子型(descriptive/action/reciprocal/associative/linear-order/serial-reasoning/conditional 等)— **對 7-12 歲太抽象**,不採用 | 無 |
| 5 | [CogAT K-2 sample](https://elmacademyprep.com/cogat-verbal/) | 驗證年齡適配 | K-2 用 2×2 picture matrix 形式,我們 A:B::C:? 結構合適 7+。**未來可考慮加 `picture` 版** | 無 |

**RAVEN / WellyZhang 兩個來源**:對 matrix 強相關,留到 Batch 3 (matrix) 時讀,本批跳過。

### 開工前問題(blocking)

1. **既存 6 題的 prompt 措辭**:每題 prompt 不一樣(「左邊兩個的關係...」「想想看...」「這次的關係比較細...」)。我寫 75 題時要:
   - (A) 用單一固定 prompt(更一致,但變單調)
   - (B) 為每個 sub_type 寫 1 個固定 prompt(7 種)
   - (C) 每難度寫 1 個固定 prompt(3 種,跟既存風格相符)
   - (D) 完全跟既存風格走,每題隨機從 3-5 個變體挑

   傾向 (B):同 sub_type 統一語氣,跨 sub_type 有變化。**請拍板**。

2. **干擾選項中文化**:既存 analogy-mid-002 (sound) 干擾是「魚 / 喵 / 可愛」,「魚」跟「可愛」是語意干擾(物件 vs 形容詞)。我計畫的 4 種干擾來源(同類別 B / 反方向 / 跨類別 / 隨機)是否符合這個 spec 作者的口味?**請看一兩題範例後拍板**。

3. **degree 子型對 7-12 歲的難度**:degree 是「程度副詞」(笑 → 大笑、看 → 盯),需要對動詞細緻度的語感。我感覺對小三以下偏難,但 spec 列為 hard。是否維持?或我把 degree 改成 6 題保守數量(我已照此計畫)?

### 草樣 — 我預定生成的前 3 題(請看看風格)

```json
// analogy-easy-003 (function)
{
  "prompt": "左邊兩個東西的關係,右邊也要一樣!",
  "pairs": [{"a": "眼睛", "b": "看"}, {"a": "耳朵", "b": "?"}],
  "options": ["聽", "聲音", "頭", "聞"],
  "answer": 0,
  "explanation": "<strong>眼睛</strong>是用來<strong>看</strong>的,<strong>耳朵</strong>是用來<strong>聽</strong>的。",
  "hint": "眼睛在幫我們做什麼?耳朵呢?"
}

// analogy-easy-018 (antonym)
{
  "prompt": "想想看,前面兩個是相反詞,後面也要找相反詞!",
  "pairs": [{"a": "白天", "b": "晚上"}, {"a": "亮", "b": "?"}],
  "options": ["暗", "燈", "太陽", "看"],
  "answer": 0
}

// analogy-mid-008 (sound)
{
  "prompt": "左邊是動物跟牠叫聲的關係,右邊也要對!",
  "pairs": [{"a": "牛", "b": "哞"}, {"a": "羊", "b": "?"}],
  "options": ["咩", "草", "白", "山"]
}
```

### 等 review

我**不**動 generator code、不寫 questions,直到 reviewer 對以下三項拍板:
1. prompt 寫法策略 (A/B/C/D)
2. 干擾選項口味
3. degree 難度

push 後等回覆。

---

## Batch 6 — spatial (2026-05-24) ✅ DONE

### 統計
| 難度 | 數量 | sub_type |
|------|------|----------|
| easy | 20 | cube-counting-flat (20 個 curated layout) |
| mid  | 20 | cube-counting-stacked (20 個 curated layout) |
| hard | 15 | volume-arithmetic (N=3/4/5 三種,layerCount 1-4 變化) |
| **總計** | **55** | 3 sub_type,覆蓋 schema §3 的 spatial-cube-counting 跟 spatial-volume-arithmetic |

### 設計
**全部 cubeStack visual,無 cubeNet 無 raw-html。** 理由:
- reviewer 警告 cubeNet 只跑過 1 題,可能有 edge case
- foldedPaper renderer 是 stub,折紙題目前用 raw-html (但本批不做折紙)

未覆蓋的 spatial-* skill codes:`spatial-paper-fold`, `spatial-cube-net`, `spatial-cube-net-invalid`, `spatial-mirror`, `spatial-symmetry-fold`。這些等對應 renderer/helper 完成再開 batch 7 補。

### 自驗
- L1 strict validate: 61/61 pass (seed easy-002 hint `!` 非我的)
- L2 layout cube count 用 `countCubes()` helper 從 layout 計算,跟 hint/explanation 一致
- L3 distractor: ±1/±2/2倍 等常見誤算,volume-arithmetic 額外加「忘了減」「倒減」「用單層」三種具體誤解

### 已知限制
- spatial sub_type 只覆蓋 2 個 skill code,雷達圖 spatial 那一軸維度單薄
- 等 foldedPaper helper / cubeNet 完整測試後再 batch 7 補(預期 paper-fold + cube-net 各 ~20 題)

