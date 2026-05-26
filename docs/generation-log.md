# Generation Log

> 「題庫 Claude」的工作日誌。每一批生成記錄在這裡 — 計畫、來源、自驗、未解疑問。
>
> **規則**:
> - 每批先寫「計畫段」push 給 reviewer,OK 後才開始批量生題
> - 不省略外部閱讀清單(以後擴到 10000 題,要靠這份避免重複)
> - 不確定的題目要列在「待 reviewer 判斷」段
> - 寫作風格:對話、可追溯、不修飾

---

## Batch 9 — 邏輯/連續旋轉/巢狀/加法擴充 (2026-05-26) ✅ DONE

### 規格來源
`D:\AI_Project\prompt-for-tilibrary-claude.md`(operator brief)。批前對話釐清三個關鍵:
- **§11 修正版**(commit 0 `d2434b5`):mid 允許多個「主規則軸」,只擋「裝飾性副屬性」(hand length 60% vs 80% 那類肉眼勉強分得出來的微調)。
- **direct-position-mapping easy 20 的 signature 空間**:採「unknown 位置 9 種 × black_cell_size 2 段 × 邊框色 5 種」,實際只用前 18 + 2 個邊框色就湊到 20,沒動到 marker shape 備案。
- **新 skill_code 授權**:4 個(`pattern-logical-overlay`, `pattern-continuous-rotation`, `pattern-position-mapping`, `pattern-tally-add`)— 全部進 `tools/lib.mjs` `VALID_SKILL_CODES` + `docs/schema.md` §3。

### 新 sub_type(17 個,跨 6 個 phase 提交)

| sub_type | topic | easy | mid | hard | total | generator |
|---|---|---|---|---|---|---|
| `tally-h-add` | matrix | 13 | 0 | 0 | 13 | `gen-matrix-tally.mjs` |
| `tally-v-add` | matrix | 12 | 0 | 0 | 12 | 同 |
| `tally-cross-add` | matrix | 0 | 55 | 0 | 55 | 同 |
| `dots-pattern-add` | matrix | 0 | 0 | 25 | 25 | 同 |
| `direct-position-mapping` | matrix | 20 | 0 | 0 | 20 | `gen-matrix-nested.mjs` |
| `inverted-mapping` | matrix | 0 | 30 | 0 | 30 | 同 |
| `row-col-swap` | matrix | 0 | 0 | 15 | 15 | 同 |
| `clockwise-row-step` | matrix | 30 | 0 | 0 | 30 | `gen-matrix-rotation-cont.mjs` |
| `clockwise-col-step` | matrix | 0 | 50 | 0 | 50 | 同 |
| `dual-axis-rotation` | matrix | 0 | 0 | 25 | 25 | 同 |
| `logical-overlay-or` | matrix | 25 | 0 | 0 | 25 | `gen-matrix-logical.mjs` |
| `logical-overlay-and` | matrix | 15 | 50 | 10 | 75 | 同 |
| `logical-overlay-xor` | matrix | 0 | 30 | 30 | 60 | 同 |
| `2var-direction-fill` | multivar | 35 | 65 | 30 | 130 | `gen-multivar-direction-fill.mjs` |
| `2var-count-frame` | multivar | 28 | 50 | 25 | 103 | `gen-multivar-2var-ext.mjs` |
| `2var-shape-line` | multivar | 35 | 70 | 30 | 135 | 同 |
| `3var-position-orbit` | multivar | 37 | 100 | 60 | 197 | `gen-multivar-orbit.mjs` |
| **總計** |  | **250** | **500** | **250** | **1000** |  |

### 新增 visual primitive(9 個,跨 Phase 1 + Phase 4 提交)

Phase 1 (6 個):`clock-hand`, `angle-v`, `triangle-split`, `tally-lines`, `bowtie`, `nested-grid`
Phase 4 (3 個):`line-overlay`, `count-frame`, `shape-line`

全部進 `VALID_VISUAL_TYPES` + `VALID_CELL_TYPES`(新介面 — `cell.type` dispatcher,優先於 `cell.shape`),並寫進 `docs/schema.md` §4.10。

### 新介面:`cell.type` dispatcher

batch +1000 引入,寫進 `docs/schema.md` §4.11。

```
dispatch 順序(renderCellContent):
  1. cell.unknown → "?"
  2. cell.raw → 直接塞 SVG
  3. cell.type ∈ VALID_CELL_TYPES → 走新 primitive (batch +1000)
  4. cell.shape → fallback 到 single-shape 渲染(向後相容)
```

`VALID_VISUAL_TYPES` 跟 `VALID_CELL_TYPES` 分開兩個清單:前者是 option/top-level 用,後者是 matrix-cell-level 用。內容部分重疊,但 lint 用途不同。

### 自驗 (`tools/self-solve.mjs` 新工具)

新寫的批量驗證,支援 4 種 check:
- 預設 → Layer 2 答案重算(每個 sub_type 寫 solver,跟 q.answer 比對)
- `--check-options` → 每題 options.length === 4(batch +1000 hard requirement)
- `--check-dup` → 同 (sub_type, difficulty) signature 唯一
- `--check-balance` → answer index 0-3 χ² p > 0.5(uniformity test,df=3)

整批通過:
```
[self-solve] scanned 1486 files
  solver coverage: 1000 questions (sub_types with solvers: 17)
  ✓ all 1000 solver-checked questions PASS
[--check-options]  ✓ all batch +1000 questions have options.length === 4
[--check-dup]      ✓ all batch +1000 (sub_type, difficulty) have unique signatures
[--check-balance]  all 28 keys with χ² p > 0.93 (最低 logical-overlay-and:hard n=10 p=0.940)
```

### Distractor 設計策略(每 generator 內檔頭文件化)

跨 generator 共享的 design language:
- **off-by-one**(算術 / 旋轉題):±1 步、±1 個 line
- **wrong-axis-value**(2var/3var):用對的 axis 算錯誤值
- **axis-swap**(2var):用 row 規則套到 col(反之),刻意觸發「弄反規律」誤解
- **wrong-OP**(logical):算 XOR 但給 AND 結果,反之
- **mirror H/V**(logical):H 或 V 鏡射 correct(line element 翻轉)
- **copy-row-input**(算術 / logical):複製 cell[0] 或 cell[1],「看起來像規律的一部分」
- **repeat-visible**(算術 / 旋轉):複製矩陣內某可見 cell,觸發「填同樣」誤解
- **wrong-mapping**(nested):用另一條 mapping rule(direct vs inverted vs row-col-swap)
- **structural-error**(連續旋轉):reset-to-start、reverse-direction

每題 `distractor_meta` 欄位記錄該題 3 個 distractor 各自的 source label。

### 答案位置平衡器 (`BalancedAnswerPlacer`)

新工具,放在 `gen-utils.mjs`。每題不再隨機 shuffle 4 個 options 後找 answerIdx,改成:
1. 每個 (sub_type, difficulty) 維護一個 [0, 0, 0, 0] bucket
2. 新題的 answerIdx = bucket 中「使用最少」的 index(平手隨機)
3. 確保 χ² 4-bucket uniformity p > 0.93

副效果:同 sub_type 內若 signature 衝突需 retry,placer 已經把 bucket++,造成微小過度平衡。實測 28 個 (sub_type, difficulty) 鍵 χ² p 全部 > 0.93,可接受。

### ID 範圍

| topic | difficulty | 起 | 迄 | 增加數 |
|---|---|---|---|---|
| matrix | easy | matrix-easy-033 | matrix-easy-147 | 115 |
| matrix | mid | matrix-mid-028 | matrix-mid-242 | 215 |
| matrix | hard | matrix-hard-023 | matrix-hard-127 | 105 |
| multivar | easy | multivar-easy-023 | multivar-easy-157 | 135 |
| multivar | mid | multivar-mid-023 | multivar-mid-307 | 285 |
| multivar | hard | multivar-hard-018 | multivar-hard-162 | 145 |

題庫總量 471(batch 8 結束)→ **1486**(batch 9 結束),增加 1015 包括 batch 8 cube-combine 15 題。Batch 9 純增加 1000。

### 響應式 320px 驗收

Phase 1 用 `web/preview/primitives.html` 在 320px viewport(iPhone SE portrait)截圖,6 個 primitive 全部:
- stroke ≥ 2.5 (符合 spec §11 #8)
- 線條對比、3 色填色、dot 點位都看得清楚
- 修一個 `angle-v` dot radius 1.5 → 2 的視覺微調(spec 給 1.5,320px 下幾乎不可見)

### 已知限制 / 未解項目

1. **out-of-repo spec deprecation 標記**:operator brief `prompt-for-tilibrary-claude.md` 的 §C/§D 舊題量數字標記 deprecated 的編輯,被 auto-mode classifier 擋(理由「scope escalation」)。§11 主修正第一刀進去了,§C/§D 標記要 operator 手動加(或開 permission rule)。
2. **3var-position-orbit 用 raw-html**:沒拉成獨立 primitive,因為這個 sub_type 的「3 dots on circle」結構特殊,獨立 primitive 不會被別的 sub_type 復用。若未來有 Q30/Q32 風格的變體 (4 dots / 不同位置),再抽出 primitive。
3. **`angle-v` 3-dot 在 60° spread 偏緊**:測試頁顯示 3 dots 會碰到 V 的兩支線。本批沒題目用到 3-dot,但若後續 sub_type 需要,要重設 layout(或限定 spread ≥ 90°)。

### 給接手 agent 的內化教訓

- **`cell.type` dispatcher 是擴展題型的標準介面**:寫新 sub_type 時,新 primitive 進 `shapes.js` + `lib.mjs` + `renderer.js` 三處,即可在 matrix cell 跟 option 兩層通用。
- **signature 唯一空間先算出來再開生成器**:本批兩個「天然窄」的 sub_type(`direct-position-mapping`, `tally-h-add`)在 Q2 階段就跟 operator 確認過擴充軸。
- **平衡放置器是 χ² p > 0.5 的最便宜解法**:不依賴 RNG 運氣,顯式追蹤 bucket count,新題進最少使用的 index。
- **self-solve.mjs 是 batch 唯一的客觀正確性 gate**:reviewer 試玩抓 bug 是 batch 7-8 的痛苦記憶;這批每個 sub_type 各寫 solver、整批 1000 題 100% pass 才算交付。

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

## Batch 4 — matrix (2026-05-24) ✅ DONE

User 指示「後面全部做完一次檢查」,沒分 planning-PR + done-PR 兩階段,直接生 + push。

### 統計
| 難度 | 數量 | sub_type |
|------|------|----------|
| easy | 30 | single-variable-row 10 / dual-variable-bidirectional 15 / dual-variable-count-row 5 |
| mid  | 25 | three-variable-independent 10 / latin-square 10 / dual-shape-rotation 5 |
| hard | 20 | arithmetic-row-add 8 / rotation-grid 6 / three-variable-latin 6 |
| **總計** | **75** | 9 sub_type, 覆蓋 schema §3 全部 6 個 pattern-* canonical |

### 設計
- 從 matrix-easy-003 起跳,seed -001/-002 不動
- `tools/gen-matrix.mjs` 沿用 sequence 經驗:`describe()` guard, `placeCellOptions` 用 assertion 替 silent fallback, PROMPTS key 直接用 sub_type 字串
- matrix-3x3 9 cells,? 永遠在右下角 (idx 8)
- distractor I-RAVEN 約束:D1 至少 2 attr diff from correct

### 自驗
- L1 strict validate: 81/81 pass (含 6 seed)
- L2 答案: 抽查 3 題 (easy-003 same-row, mid-018 latin, hard-003 arithmetic),邏輯正確
- L3 I-RAVEN distance 掃: 0 題踩漏洞

### 修 bug 過程
1. `genArithmeticRowAdd` 第一版 D3 用 `picked[2][0] * picked[2][1] || 1`,當 a=b=1 時 D3=1 = a = b,觸發我自己加的 `placeCellOptions` assertion (3 distractor 不重複)。改用「count ± 1 換色 + count ± 2 + 換 shape」三套無重複的方案
- 這個 assertion 是從 batch 3 教訓內化來的,**第一次跑就抓到**,沒讓壞題流出

---

## Batch 5 — multivar (2026-05-24) ✅ DONE

### 統計
| 難度 | 數量 | sub_type |
|------|------|----------|
| easy | 20 | 2var-shape-color 10 / 2var-count-color 10 |
| mid  | 20 | 3var-independent 10 / latin-square-3var 10 |
| hard | 15 | 4var 5 / position-swap 5 / attribute-inheritance 5 |
| **總計** | **55** | 7 sub_type,覆蓋 schema §3 全部 6 個 multivar-* canonical |

### 設計
- easy 用 `matrix-2x2` (2×2 = 4 cells),其餘用 `matrix-3x3`
- 從 multivar-easy-003 起跳,seed -001/-002 不動

### 自驗
- L1 strict validate: 61/61 pass(含 6 seed)
- L3 假設 I-RAVEN distance ≥ 2:每個 generator 的 D1 都刻意 2 attr diff

### 修 bug 過程
- `genAttributeInheritance` 第一版 sh/co 隨機抽,可能包含 baseShape='circle' 或 baseColor='white' → 跟 D3/D2 collision → assertion 抓到。改 filter 排除 base
- 又是 placeCellOptions 的 assertion 救了我,沒讓壞題流出

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


---

# Long-term Roadmap — 擴到 2000 題的階段計畫

> 寫於 batch 6 完成後 (450 題)。reviewer 提問「2000 題怎麼做」,本段是我的 plan。
> 每個 phase 完成時把對應段勾 ✅,進度透明。

## 紅線:不爬商業 IQ 站

即使有 browser 控制權限,**不爬 Mensa / IQ Test Prep / 商業題庫**:
- 著作權:題目敘述 / 選項 / 解析受版權保護,「結構性閱讀」跟「擷取衍生作品」界線模糊
- ToS:多數商業 IQ 站 robots.txt 跟 ToS 禁止 scraping
- 兒童產品審查更嚴,輿論一旦質疑「抄」品牌信任崩盤
- **不需要爬就有路可走**:公開學術資源 + 課綱 + CC-licensed 資料集足夠

OK 的「結構性閱讀」清單:
- RAVEN / I-RAVEN 論文 (已用於 batch 3)
- GeeksforGeeks 等教育 blog 的 taxonomy (已用於 batch 2)
- CogAT K-2 sample 描述 (已用於 batch 2)
- TIMSS / PISA 釋出題庫 (公開授權,還沒用)
- K-12 課綱 (公開,還沒用)

## Phase A — 現有 generator 擴量 + 補既有 sub_type (預估 +400,總 850)

每個 generator 隨機 pool / 配置空間都還有擴充空間:
- numseries 75 → 200:對數型 / 2 階等比 / 雙串差等差
- matrix 75 → 150:更多 shape×color 組合 + dual-shape-rotation 擴
- sequence 75 → 150:週期更多變化,4-attribute 同步
- multivar 55 → 100:2x2 / 3x3 沒做的組合
- analogy 75 → 100:補 GeeksforGeeks 提的 `group` / `item-to-category`
- spatial 55 → 短期飽和,等 Phase B

**抗重複機制要先到位**:擴 generator 前要先有 structural fingerprint 比對,不然容易出近似題。

## Phase B — 補齊未覆蓋 skill_code + 新 visual.type (預估 +500,總 1350)

| Skill code | 為什麼還沒做 | 解法 |
|---|---|---|
| `spatial-paper-fold` | foldedPaper renderer 完成 (batch 7) ✅ | batch 7 起做 |
| `spatial-cube-net` | cubeNet 已測,batch 7 大膽用 | batch 7 起做 |
| `spatial-cube-net-invalid` | 同上 | batch 7 起做 |
| `spatial-symmetry-fold` | 同 paper-fold | batch 7 起做 |
| `spatial-mirror` | 純結構 cell + 鏡像規則 | batch 7 起做 |
| `analogy-group` | 我漏了 | 純詞對 pool,~30 題 |
| `analogy-category-member` | 我漏了 | 同上 |
| `pattern-rotation` (matrix) | 只做 6 題 | 擴到 30,加更多角度組合 |

每 sub_type 寫 generator 後 5-30 題,Phase B 總共加 ~500 題。

## Phase C — 外部結構化資料引入 (預估 +600,總 ~2000)

純結構參考,**不抄內容**:
1. **TIMSS 釋出題庫** (IEA,公開授權):看 4/8 年級 pattern/number 題的 difficulty calibration → 校正我們的 3-bucket 難度
2. **K-12 課綱對應**:臺灣 110 課綱、Common Core,看小三會什麼數列、小五會什麼空間
3. **CC-licensed AI 資料集**:RAVEN / I-RAVEN / CLEVR / BIG-Bench-Hard 子集,看 attribute 怎麼組合(只看 algorithm)
4. **教育部素養題**:公開 PDF,可讀

## Phase D — 抗重複 + 品質基礎建設 (與 Phase B/C 平行)

到 1500+ 題 reviewer 沒辦法逐題 spot-check,需要:

```
1. 結構指紋 (structural fingerprint):
   每題算 hash(shape順序, color順序, rule type, count chain),
   新題加入前比對前 N 題,similarity > 0.9 reject

2. 答對率追蹤 (從線上紀錄系統 #9 拉):
   定期看哪些題目答對率 100% (太簡單) 或 < 20% (壞題或太難),
   標記人工 review

3. 多樣性 audit:
   每 100 新題自動產 report — shape/color/sub_type/難度分布,
   確保新批沒偏移到單一 region

4. reviewer 流程工程化:
   - 自動抽 5% spot-check 跑視覺渲染截圖
   - 自動算 I-RAVEN distance + 顯示 outlier
   - reviewer 只看「outlier + 5% 隨機」≈ 30 題/批,不再看全部
```

## Phase E — 眾包 + 多語 (長路)

> 2000 題後的真正擴展路徑:

- GitHub Issue template「家長/老師投稿一題」,CI auto-validate + reviewer 審
- 多語化:analogy/sound 本土性強的可開英文版只做 visual 題
- 學校產品的護城河

## 預估時程

| Phase | 內容 | 工作量 | 預估完成題數 |
|---|---|---|---|
| 完成 | batch 1-6 | (已完成) | 450 |
| Batch 7 | spatial 補完 | 1-2 天 | 480 |
| Phase A | generator 擴量 + 抗重複 | 2-3 天 | 850 |
| Phase B | 新 sub_type + visual.type | 1 週 | 1350 |
| Phase C | 外部結構引入 + 課綱校正 | 2-3 週 | 2000 |
| Phase D | 工程化 (與 B/C 平行) | 1-2 週 | (品質基建) |
| Phase E | 眾包 (持續) | 永遠 | (長期擴展) |

---


## Batch 7 — spatial 補強 (planning, 2026-05-24) 📝 待 review

### 觸發條件
- system Claude 完成 `foldedPaper` renderer (commit 565a758)
- reviewer 給綠燈大膽用 cubeNet (seed 已驗證 2 題)
- Batch 6 留下的「spatial 雷達圖維度單薄」要修

### 目標 31 題,5 個新 sub_type
| 難度 | 數量 | sub_type 分布 | 視覺手法 |
|------|------|-------------|--------|
| easy | 4 | paper-fold-once (4) | composite + foldedPaper |
| mid  | 15 | paper-fold-twice (4) / cube-net-opposite (3) / symmetry-fold (5) / mirror (3) | composite/cubeNet/single-shape |
| hard | 12 | cube-net-opposite (4) / cube-net-invalid (6) / mirror (2) | cubeNet/single-shape |
| **總計** | **31** | 5 新 sub_type | |

### ID 分配
- spatial-easy-023 ~ -026 (4 paper-fold-once)
- spatial-mid-023 ~ -037 (15):
  - -023~-026 paper-fold-twice
  - -027~-029 cube-net-opposite
  - -030~-034 symmetry-fold
  - -035~-037 mirror
- spatial-hard-018 ~ -029 (12):
  - -018~-021 cube-net-opposite
  - -022~-027 cube-net-invalid
  - -028~-029 mirror

### skill_code 覆蓋(全 spatial-* 7 個 canonical)

| skill_code | Batch 1-6 | Batch 7 | 全 coverage |
|---|---|---|---|
| `spatial-paper-fold` | ❌ | ✅ (4+4 題) | ✅ |
| `spatial-cube-counting` | ✅ 40 題 | — | ✅ |
| `spatial-cube-net` | ✅ seed 2 題 | ✅ (3+4 題) | ✅ |
| `spatial-cube-net-invalid` | ❌ | ✅ (6 題) | ✅ |
| `spatial-volume-arithmetic` | ✅ 15 題 | — | ✅ |
| `spatial-mirror` | ❌ | ✅ (3+2 題) | ✅ |
| `spatial-symmetry-fold` | ❌ | ✅ (5 題) | ✅ |

→ batch 7 後 spatial 7 個 skill_code 全覆蓋,雷達圖維度齊。

### 視覺設計策略

**paper-fold (8 題)** — composite 多步驟
```
[flat + fold hint] → [folded half-h] → [folded + hole] → "展開?"
options: 4 個 flat foldedPaper,各自 holes 不同
```
- easy 4 題:1 次對摺 (horizontal 或 vertical) + 1 個洞
- mid 4 題:2 次對摺 = quarter + 1 個洞 (展開後 4 對稱位置)

**cube-net (7 題)** — 純 cubeNet visual
- 7 題都是「哪兩面相對」類型 (跟 seed mid-002 同套路,但 face 配色不同)
- layout 用 `cross`(已驗證);變化是 6 face 上的 label/color 排列

**cube-net-invalid (6 題)** — cubeNet visual + text options
- visual 顯示一個 cubeNet
- prompt: 「下面說法哪個錯?」
- options 是 4 個關於「折起來後哪面跟哪面相對 / 相鄰」的陳述,3 對 1 錯
- 不需要新 visual.type — 純用 cubeNet + text 描述

**symmetry-fold (5 題)** — 反向 paper-fold
- 給「展開後」(flat + 多 holes 對稱排列)
- 問「下列哪種折法+打洞會產生這個結果?」
- options 是 4 個 composite (折法 + 洞位置),選對的
- 比 paper-fold 多一層逆推,難度上 mid 合理

**mirror (5 題)** — single-shape arrow + 鏡像
- 全部用 arrow shape
- prompt: 「下面這個箭頭的鏡像是?」
- visual: 原箭頭 (single-shape)
- options: 4 個 arrow,1 個是對的鏡像,3 個是不同 rotation
- 對「水平鏡像」(across horizontal axis): 0° → 180°, 45° → 135°, 90° → 90°, 135° → 45°...
- 對「垂直鏡像」(across vertical axis): 0° → 0°, 45° → 315°, 90° → 270°...
- mid 3 用水平鏡像 (較簡單,半數角度不變很直觀)
- hard 2 用垂直鏡像 + 角度組合更微妙

### 干擾選項設計 (per sub_type)

| sub_type | D1 (規則內錯位) | D2 (部分對) | D3 (跳出規則) |
|---|---|---|---|
| paper-fold | 對稱方向錯 (水平 vs 垂直) | 洞位置對但少 1 個 | 多出洞 / 隨機位置 |
| cube-net (opposite) | 取相鄰兩面 (錯位但合理) | 取相鄰但是頂底組合 | 完全錯位 |
| cube-net-invalid | 跟對的陳述近似但細節錯 | 表面看似對但忽略 cross 排列 | 完全胡亂陳述 |
| symmetry-fold | 折法對 + 洞位置錯 | 折法錯 + 洞位置對 | 全錯 |
| mirror | 反方向鏡像 (水平錯成垂直) | 旋轉 90° 不是鏡像 | 完全不相關角度 |

每個錯答對應一種具體誤解 — 不踩 RAVEN 漏洞 (沿用 batch 3-6 的 I-RAVEN 約束精神)。

### 工程內化 (從 batch 3-6 學到的)

新 `tools/gen-spatial-supp.mjs` 會帶以下 sanity check (自動跑):
- `describe()` 對 missing 欄位 throw
- `placeOptions()` assert 4 unique (避免 distractor 撞 correct)
- PROMPTS key EXACTLY = sub_type 字串 + throw on missing
- foldedPaper holes[] 用 helper 生成,4 對稱模式 enumerate 出來成 const,不靠 magic number

### 開工前問題 (blocking)

1. **paper-fold 的 visual 太占空間怎麼辦?** composite 內 4 個 foldedPaper 並排,加上 4 個 option 也是 foldedPaper,一題視覺塞 8+ 個圖。需要 reviewer 確認 renderer 處理得了 (我猜 OK 因為 80×80 固定容器,但要確認)。

2. **cube-net-invalid 「陳述」用什麼語氣?** options 是文字描述如「1 號跟 6 號相對」。我計畫:
   - 「1 號跟 6 號相對」(對的)
   - 「2 號跟 5 號相對」(對的)
   - 「3 號跟 4 號相對」(對的)
   - 「1 號跟 3 號相對」(錯 — 它們相鄰不是相對)
   options 文字太統一可能機械,reviewer 看一下口味 OK 嗎?

3. **mirror sub_type 命名**:我把 mid 3 + hard 2 全部 sub_type 設成 `mirror-arrow`(因為都用 arrow shape)。若 reviewer 要分開可改為 `mirror-horizontal` (mid 3) + `mirror-vertical` (hard 2)。

### 等 review,不寫 generator

push 後等回覆。OK 後再生 31 題、跑三層自驗、push 同 PR add commit。


---

### Batch 7 v2 — 生成完成 (同 PR #9 add commit)

### 三項決策實作
| Reviewer Q | 決策 | 實作 |
|---|---|---|
| Q1 paper-fold render | 用 composite (renderer.js:285 verified — `renderComposite` 內建 `flex-wrap: wrap`,小螢幕自動 2×2) | paper-fold-once + twice + symmetry-fold 全用 composite |
| Q2 cube-net-invalid 句型 | 5 句型 rotation,#5「無法折成」當 invalid 題正解 | `STATEMENT_TYPES` const 5 種句型 helper,6 題分 3 invalid (#5 正解) + 3 valid (#5 當 distractor 陷阱) |
| Q3 mirror 命名 | `mirror-arrow` 統一,visual 加 `mirrorAxis` | schema.md §4.9 加 mirrorAxis 欄位文檔 + generator output |

### 31 題分布
| 難度 | 數量 | sub_type | visual.type |
|---|---|---|---|
| easy | 4 | paper-fold-once | composite |
| mid | 4 | paper-fold-twice | composite |
| mid | 3 | cube-net-opposite | cubeNet |
| mid | 5 | symmetry-fold | composite |
| mid | 3 | mirror-arrow (mirrorAxis=horizontal) | composite |
| hard | 4 | cube-net-opposite | cubeNet |
| hard | 6 | cube-net-invalid (3 invalid + 3 valid) | raw-html / cubeNet 混用 |
| hard | 2 | mirror-arrow (mirrorAxis=vertical) | composite |

### 自驗
- L1 strict validate: 92/93 pass(僅 seed easy-002 hint `!` 非我的)
- L2 spot-check 5 sub_type 各 1 題,answer 邏輯正確
- L3 distractor (per I-RAVEN 約束 + Q2 句型 mix):全部 6 cube-net-invalid 用 4 不同句型;mirror 用「錯軸 / +90°偏 / 沒做鏡像」三類

### invalid layout 視覺 (cube-net-invalid 3 題)
用 `customCubeNetSvg(squares)` helper 自繪,3 種非法形狀:
- `row-of-6`:6 格全一排,topologically 不能折立方體
- `L-broken`:4 格一排 + 2 格垂直懸掛,正方數對但配置錯
- `T-broken`:3 格一排 + 3 格垂直懸掛從錯位起點

### 改 schema.md §4.9 (一個小擴充,user 明確要求)
加 `single-shape.mirrorAxis` metadata 欄位,純 metadata,renderer 不顯示。
這是 cross-territory 改動 (schema 是 system Claude 領地),user 明確指示寫進去。

### spatial canonical skill code 覆蓋達成 ✅
| skill code | Batch 1-6 | Batch 7 | 全覆蓋 |
|---|---|---|---|
| spatial-cube-counting | ✅ 40 | — | ✅ |
| spatial-volume-arithmetic | ✅ 15 | — | ✅ |
| spatial-paper-fold | ❌ | ✅ 8 | ✅ |
| spatial-cube-net | ✅ seed 2 | ✅ 7 | ✅ |
| spatial-cube-net-invalid | ❌ | ✅ 6 | ✅ |
| spatial-symmetry-fold | ❌ | ✅ 5 | ✅ |
| spatial-mirror | ❌ | ✅ 5 | ✅ |

雷達圖 spatial 軸 7 維度齊。

### 未來增強建議
- paper-fold 目前 hole 數限 1-3。若擴 hard 用 4-5 個洞 + 三次對摺 (eighth) 可加 5-10 題
- mirror sub-pool 可擴 horizontal/vertical 各 10 題 (現只 5 題);需更多 (角度, axis) 組合
- cube-net 可考慮多面對應陳述題型 (除了 opposite/adjacent,還有「哪 3 個面圍著 X」)

### v3 fix — cube-net-opposite distractor 多解 bug (PR #9 reviewer 抓到)

**問題**:`genCubeNetOpposite` 第一版 distractor 用「其他 2 組相對 pair + 1 組相鄰 pair」。但**立方體只有 3 組相對面**,其他 2 組「相對 pair」(例如 correctPair=(1,6),distractor=(2,4) 跟 (3,5))**也是真的相對面**! 4 個選項裡有 3 個都是 true,多解 bug。

**修法**:distractor 池改成 **12 組相鄰面**:
```
立方體相鄰面 (12 unordered pairs):
  top(1)    鄰 front(2)/right(3)/back(4)/left(5)
  bottom(6) 鄰 front(2)/right(3)/back(4)/left(5)
  front(2)  鄰 right(3)/left(5)
  back(4)   鄰 right(3)/left(5)
```
每題從 12 組相鄰中 seed-shuffle 抽 3 組,陳述為「X 號與 Y 號相對」 — 句型對但實際 X Y 相鄰,kid 選了就是「沒在腦中折立方體,只看 label 數字湊配對」的具體誤解。

**也修了** explanation:之前寫死 (1,6) 案例,改成根據 `correctPair` 動態描述 (頂底 / 前後 / 左右)。

**驗證** (3 題 spot-check 都對):
```
mid-027 (correctPair (1,6)): 1-6 相對 ✓ / 4-3 相鄰 / 6-4 相鄰 / 6-2 相鄰
mid-028 (correctPair (2,4)): 2-4 相對 ✓ / 1-4 相鄰 / 1-2 相鄰 / 6-4 相鄰
hard-018 (correctPair (1,6)): 1-6 相對 ✓ / 2-3 相鄰 / 4-3 相鄰 / 6-5 相鄰
```

每題 1 真 3 假,無多解。

**教訓**:寫 distractor 時不只要「結構對但語義錯」,還要驗證每個 distractor 真的是錯的。立方體相對面這種「對」的 statement,跨 pair 排列出來會自動踩雷。

### v4 fix — symmetry-fold 多解 bug (reviewer 試玩 mid-033 抓到)

**問題**:reviewer 試 mid-033 回報「B 跟 C 看起來都可以是正解」。掃 5 題 symmetry-fold 發現 **3 題有 bug**:
- mid-031: B = C 完全相同 (因 config.x=0.5, 1-x=x)
- mid-032: B = C 完全相同 (同上)
- mid-033: B 跟 C 物理上同個 fold (half-v 視覺沒標 fold edge,所以 half-v(0.4) 跟 half-v(0.6) 是「同一張紙從左半看 vs 右半看」)

**Root cause (兩層)**:
1. **D1 = (1-cx, cy) 對 vertical fold 是物理等價** — half-v 沒標 fold edge,kid 可解讀半張紙是「左半」也可是「右半」,half-v(cx) ≡ half-v(1-cx) 物理上同個 fold
2. **genSymmetryFold bypass 了 placeOptions assertion** — 我之前在 PR #5 學到 placeOptions assert 4 unique,但這個 function 沒用,所以 mid-031/032 的 literal 重複沒被抓到

**修法**:
1. D1 改根據 fold 方向選擇換軸:
   ```
   horizontal fold (ambiguity 在 y): D1 換 x → 安全
   vertical fold   (ambiguity 在 x): D1 換 y → 安全
   ```
   具體 d1Hole 計算:`y_new = cy > 0.5 ? cy - 0.3 : cy + 0.3` (vertical fold) 或對應 x (horizontal fold)。這樣 D1 跟 correct 的 unfold 一定差至少 0.3 在某軸,絕不會物理等價

2. **改用 placeOptions** 取代 inline shuffle,自動 assert 4 unique (lesson from PR #5 內化)

**驗證 (5 題全部 spot-check)**:
```
mid-030 (horiz,0.3,0.4): D1=(0.6,0.4) — x 不同,無多解 ✓
mid-031 (vert,0.5,0.35): D1=(0.5,0.65) — y 不同 ✓ (B 跟 C 不再相同)
mid-032 (horiz,0.5,0.3):  D1=(0.8,0.3) — x 不同 ✓
mid-033 (vert,0.4,0.6):  D1=(0.4,0.3) — y 不同,B 跟 C 不再 mirror 等價 ✓
mid-034 (horiz,0.7,0.5): D1=(0.4,0.5) — x 不同 ✓
```

**新內化教訓**:
1. **每個 sub_type generator 都該用 placeOptions / 等價 assertion** — 不要 inline shuffle bypass。批量檢查 batch 7 其他 generator (genCubeNetOpposite / genCubeNetInvalid) 也有 inline shuffle 但因 distractor pool 結構不會撞 correct,沒踩雷
2. **half-paper render 沒標 fold edge → kid 可解讀任一側** — 設計 distractor 時要把這當「合法解讀」一起算,不只看 generator 內的 mathematical unfold。Renderer 改 (system Claude 領地) 是更好的長期解法 (例如 fold edge 畫粗黑線或加箭頭),但目前用 generator-side 約束處理
3. **物理等價 ≠ 數值相等** — 同一個物理 fold-and-punch 可以有多種數值表示 (因 half-paper side 解讀)。distractor 必須跟 correct 在「全部物理表示」都不同,不能只看一個

### v5 fix — mirror-arrow 全 5 題答案標錯軸 + D2/D3 duplicate

**問題**:reviewer 試玩 mid-037 (axis=horizontal, 225°=↙) 跟 hard-028 (axis=vertical, 45°=↗) 都回報「題目誤導 / 不清楚」。檢查發現:

#### Bug 1: mirrorRotation 公式整個 SWAP
我原本寫:
```js
if (axis === 'horizontal') return (360 - rotation) % 360;  // ← 這是 vertical 公式
else                       return (180 - rotation + 360) % 360;  // ← 這是 horizontal
```

但物理上:
- **水平軸鏡射 (上下翻 / flip Y)**: cos(θ′) = -cos(θ) → θ′ = 180° - θ
- **垂直軸鏡射 (左右翻 / flip X)**: sin(θ′) = -sin(θ) → θ′ = 360° - θ

mid-037 (上下翻 225°): 我算 135° (↘),正解 315° (↖)。
hard-028 (左右翻 45°): 我算 135° (↘),正解 315° (↖)。
**全部 5 題答案標錯軸**(雖然 unfold 字面數值是對的,但被指派到錯誤的 axis label,所以 user 看到題目敘述上下翻而答案是左右翻的結果)。

#### Bug 2: D2/D3 duplicate
D2 = (correctMirror + 90) % 360, D3 = cfg.rotation。某些 config 兩者撞:
- mid-037: D2 = (135+90)%360 = 225° = cfg.rotation = D3 → mid-037 options [A]↘ [B]↙ [C]↖ [D]↙(B 跟 D 都 ↙ 重複)
- inline shuffle bypass 了 placeOptions 所以沒擋

#### Fix
1. **mirrorRotation 兩公式對調** + 更新 explanation 文字
2. **distractor 用 candidate priority list**:wrongMirror → original → (correct+90/180/45/135/...),逐個試,只取 3 個跟 correctMirror 跟 cfg.rotation 都不重複的
3. **改用 placeOptions assertion** 替 inline shuffle

#### Verified (Python truth-table 5/5 PASS)
```
mid-035 axis=horizontal rot=45  expected=135 got=135  opts=[315,45,135,225]
mid-036 axis=horizontal rot=135 expected=45  got=45   opts=[225,45,135,90]
mid-037 axis=horizontal rot=225 expected=315 got=315  opts=[315,45,135,225]
hard-028 axis=vertical  rot=45  expected=315 got=315  opts=[315,45,0,135]
hard-029 axis=vertical  rot=90  expected=270 got=270  opts=[90,315,0,270]
```
0 duplicate,answer 都對 axis 跟物理正確。

#### 內化教訓 (跨 v3/v4/v5 三輪 fix 累積)
1. **inline shuffle = anti-pattern**,所有 generator 都該用 placeOptions
2. **物理推導 > 字面類比** — 我寫 `mirrorRotation` 時用「直覺看起來像」分軸,沒推 cos/sin。寫物理時要從第一性原理 (這次 cos/sin → 鏡射方向) 推
3. **生完即驗** — 三輪 fix 都是 reviewer 試玩抓的。我應該在 generator 內加 truth-table sanity test (每個 generator 內建 5-10 個 hard-coded (input, expected output) pair,跑完 assert)

對應 batch 7 spatial-hard-001 (seed,非我的):
- author = human-george,**不在我管轄區**
- 視覺是 raw-html 自繪 SVG,內容是 cube-net-invalid type
- 答案邏輯看起來正確 (「★和黃■在相對的面」是假陳述,因為他們在展開圖中央列相鄰,折起來是相鄰不是相對)
- user 「怪怪的」可能是:1) raw-html 視覺不清, 2)「相對/相鄰」對小學生抽象, 3) 折立方體 mental 操作對 5-6 年級也偏難
- **建議 human-george / reviewer 自己 review 這題的視覺跟難度定位**

---

## Batch 8 — spatial-cube-combine (2026-05-25) ✅ DONE

### 觸發
Reviewer 拍照丟「奧林匹克小學數學考前特訓」第 42 頁問題 10 — 「左邊兩堆方塊拼起來 = 右邊哪一堆」。掃了現有 spatial 7 個 canonical skill code,沒有覆蓋這個。Reviewer 拍板做 cube-combine (純 spatial 補強,不擴新 topic)。

### 統計
| 難度 | 數量 | sub_type | visual |
|------|------|----------|--------|
| mid  | 8 | cube-combine-match | composite[ cubeStack A + "+" + cubeStack B + "=" + "?" ] |
| hard | 7 | cube-combine-match | 同上 |
| **總計** | **15** | 1 新 sub_type | options 4 個 cubeStack |

### 新 skill_code
`spatial-cube-combination` 加進 `lib.mjs` VALID_SKILL_CODES + `schema.md` §3。spatial 軸現在 8 個 skill_code 覆蓋。

### Generator 設計
`tools/gen-spatial-combine.mjs`:每題手動 curate (A_layout, B_layout, correct, d1, d2, d3),無 procedural generation (combination 規則複雜,手 curate 控制品質)。

**Distractor 設計 (一致套路)**:
- D1: 對的數,錯的形 (心智組合錯位)
- D2: correct - 1 塊 (漏算)
- D3: correct + 1 塊 (多算)

### Truth-table sanity check (新做法,值得保留)
generator 內建 assert:
```js
if (cN !== aN + bN) throw new Error(`${id}: correct ${cN} != A(${aN}) + B(${bN})`);
if (d1N !== cN)      throw new Error(`d1 should match correct count`);
if (d2N !== cN - 1)  throw new Error(`d2 should be correct-1`);
if (d3N !== cN + 1)  throw new Error(`d3 should be correct+1`);
```

**第一次跑就抓到 2 個 config 數錯**:
- mid-042 (我寫的 d3 只 4 塊,該 5 塊)
- mid-045 (我宣稱 correct 4 塊,A+B 應該 5 塊)

兩個都改完才能 gen。**這就是 mirror-arrow v5 fix 提的「generator 內建 sanity check 」做法,batch 8 首發。**

### 三層自驗
- L1 strict validate: 107/108 pass (僅 seed easy-002 hint `!`,非我的)
- L2 cube count: 全部 15 題自動 assert 對得起來
- L3 distractor: 每題 D1/D2/D3 三類具體誤解 + placeOptions assertion (4 unique)

### 已知限制 / 設計取捨
- **Option text 都標「N 塊」**:有時 D1 跟 correct 同數(D1 是對的數錯的形),text 看起來重複。**這是故意的** — 強制 kid 看 visual 區分形狀,不能靠 text 數字偷答。對視障 user 不友善 (screen reader 念兩個「2 塊」),但這 sub_type 本質是空間視覺題,沒視覺等於沒辦法做
- 15 題各自手 curate,**沒有 procedural generation**。要擴到 50+ 題需要設計通用 combine 演算法 (兩 layout overlay + collision check),目前手 curate 夠用
- 「兩堆怎麼拼」的物理規則沒明確指定 (kid 要看 4 個 options 推回去)。書上原題用箭頭暗示拼法,我用「總個數對 + 形狀對」雙條件,實質一樣

### 內化教訓 (batch 8 帶到 batch 9+ 的工作流)
**Truth-table sanity check 第一性實踐**:寫 generator 時,**先想清楚「correct 跟 distractor 之間的數學關係該滿足什麼」,寫進 assert**。這次 cube-combine 我用:
- `cN = aN + bN` (combination 數學恆等)
- `d1N = cN` (D1 同數)
- `d2N = cN - 1`, `d3N = cN + 1` (相差 1 的常見誤解)

future generator 都該想清楚這類 invariant,寫進 assert。reviewer 試玩抓的 bug (cube-net-opposite multi-answer / symmetry-fold ambiguity / mirror-arrow axis swap) 都是因為**沒寫這類 invariant assert**,讓 silent bug 流出。

### 提案下一批 (假設批准)
**Batch 9 候選** (回到 Phase A — 既有 generator 擴量):
- numseries 75 → 200 (拓對數型 / 2 階等比 / 雙串差等差)
- matrix 75 → 150 (更多 shape×color)
- sequence / multivar 類似擴
- 預期 +400 題,總 ~880

或 Phase B 補 `analogy-group` / `analogy-category-member` (~50 題)。


### v2 fix — cube-combine 多解 (reviewer 試玩抓到)

**問題**:reviewer 試 v1 後回報 — 拼合方向沒指定,所以 D1「對的數錯的形」實際是另一種合法拼法。例如 1+1=2,correct 是橫排 2 塊,D1 是直疊 2 塊 — 兩者都是 1+1 的合法拼法 (一個並排一個堆),都對。15 題全中。

**Reviewer 提兩種解**:
1. 題目明確指定拼合方向 (不能轉方向)
2. 答案最好不要有一樣數量的方塊

採 (2) 簡單可靠。

**修法**:全部 15 題 distractor 重設計,**4 個 options cube count 全部不同**:
- D1 = correct - 1 (漏算)
- D2 = correct + 1 (多算)
- D3 = correct ± 2 (更偏)

Truth-check 升級成 `Set(counts).size === 4` assertion,自動擋 same-count 重出江湖。

**驗證 (Python audit 全 15 題 distinct)**:
```
mid-038~045: counts [1,2,3,4] / [2,3,4,5] / ... 全 4 distinct
hard-030~036: counts [4,5,6,7] / [3,4,5,6] / ... 全 4 distinct
```
0 多解,0 same-count。

**取捨**:失去部分 spatial reasoning (kid 可純數 A+B 找對應數量選項,不需在「同數異形」之間判斷拼法方向),換零多解。Reviewer 偏好這 trade-off。

**Explanation 更新**:從「對的數但形狀錯、漏一塊、多一塊都不是答案」改成「其他選項的個數都不對 — 先把兩堆方塊各數一遍,加起來就找得到答案」— 更符合新 distractor 設計。

**累積 batch 7-8 教訓**:multi-answer bug 是 generator 第一大坑,跨 4 個 sub_type 都踩過:
1. cube-net-opposite (v3): distractor 用其他「相對 pair」但那也是真陳述
2. symmetry-fold (v4): D1 物理等價於 correct
3. mirror-arrow (v5): D2 跟 D3 數值偶撞
4. cube-combine (v8-v2): D1 是另一種合法拼法

**統一防護**:寫 distractor 時除 placeOptions 4-unique assertion,還要驗 truth value (cube-combine 用 cube count distinct,cube-net 用 adjacent-pair pool,mirror 用 truth-table 公式)。
