# 題目 JSON Schema 規範

> 本文定義 IQ-Kids 題庫的 JSON 結構。所有題目 `questions/**/*.json` 都必須符合本規範。
> validator: `tools/validate.mjs` 會逐題檢查。

**版本**:schema-v1
**對應**:`docs/architecture.md` §3

---

## 1. 完整 Schema (TypeScript-flavored)

```typescript
type Question = {
  // ─── 識別 ───
  id: string;              // 唯一識別,格式 "<topic>-<difficulty>-<3位數>"  e.g. "matrix-easy-001"
  topic: Topic;            // 六選一
  difficulty: Difficulty;  // 三選一
  sub_type: string;        // 自由字串,描述子題型 (spec.md §3 列了參考清單)
  skill_codes: string[];   // 對應 §3 的 canonical skill code 列表 (至少 1 個)

  // ─── 後設資訊 ───
  created_at: string;      // ISO date "YYYY-MM-DD"
  author: string;          // "claude-generated" / "human-george" / "claude-curated" / ...
  inspired_by?: string;    // 若參考某種題型結構,如 "raven-matrix-style" (非必填)
  tags?: string[];         // 自由標籤,給未來搜尋用

  // ─── 題目內容 ───
  prompt: string;          // 引導語,**不可劇透規律類型** (spec.md §3.1)
  visual: VisualSpec;      // 結構化視覺,由 renderer 分派 (§4)
  options: Option[];       // 3-4 個選項
  answer: number;          // 0-based,必須 < options.length
  hint: string;            // 答錯時的引導式提問 (**問句**,不是答案)
  explanation: string;     // 完整解析,可含 <strong> 標籤
  skill: string;           // 顯示用 skill 名稱 (中文短句),配合 skill_codes 的第一個
};

type Topic = "matrix" | "sequence" | "spatial" | "numseries" | "analogy" | "multivar";
type Difficulty = "easy" | "mid" | "hard";

type Option = {
  text: string;            // 必填,選項文字 (用於 a11y + 沒有圖示時的後備顯示)
  visual?: VisualSpec;     // 選填,選項的視覺,通常是 single-shape 或局部 cells
};

type VisualSpec =
  | MatrixSpec
  | SequenceRowSpec
  | NumberSequenceSpec
  | AnalogyRowSpec
  | CubeStackSpec
  | CubeNetSpec          // future
  | FoldedPaperSpec      // future
  | SingleShapeSpec
  | CompositeSpec;       // 多視覺組合
```

---

## 2. 識別命名規則

### 2.1 `id` 格式
```
<topic>-<difficulty>-<3位數>
```
- 三位數從 `001` 開始,**不重複**
- 例:`matrix-easy-001`, `sequence-hard-027`

### 2.2 檔名
JSON 檔名跟 ID 一致:
```
questions/matrix/easy/matrix-easy-001.json
```

### 2.3 `topic` 取值
| 值 | 中文 | 對應 spec.md |
|----|------|--------------|
| `matrix`    | 矩陣推理 | §3.1 |
| `sequence`  | 圖形序列 | §3.2 |
| `spatial`   | 空間能力 | §3.3 |
| `numseries` | 進階數列 | §3.4 |
| `analogy`   | 類比推理 | §3.5 |
| `multivar`  | 多元素變化矩陣 | §3.6 |

### 2.4 `difficulty` 取值
| 值 | 中文 | spec |
|----|------|------|
| `easy` | 入門 ⭐ | §4 單變數 |
| `mid`  | 中階 ⭐⭐ | §4 雙變數 |
| `hard` | 挑戰 ⭐⭐⭐ | §4 三變數+ |

---

## 3. Skill Codes 規範表

`skill_codes` 必須從這個 canonical 列表選(至少一個)。**避免同樣能力出現不同寫法**(否則雷達圖會散開)。

### 矩陣 (matrix-*)
- `pattern-row-identification` — 橫向規律識別
- `pattern-bidirectional` — 雙向(橫直)規律推理
- `pattern-three-variable` — 三變數規律
- `pattern-arithmetic` — 算術運算(相加/相減)
- `pattern-latin-square` — 拉丁方陣
- `pattern-rotation` — 旋轉規律
- `pattern-logical-overlay` — 線條集合的布林運算 (XOR/OR/AND) ★ batch +1000
- `pattern-continuous-rotation` — 連續角度等差旋轉 (時鐘指針) ★ batch +1000
- `pattern-position-mapping` — 巢狀位置追蹤 (大 cell 索引 ↔ 小 grid 內位置) ★ batch +1000
- `pattern-tally-add` — 線條/點陣加法 (perceptual grouping,跟 arithmetic 不同) ★ batch +1000

### 序列 (sequence-*)
- `sequence-cyclic` — 循環規律 (ABAB / ABC)
- `sequence-rotation` — 等角度旋轉
- `sequence-nested` — 巢狀變化(外框+內部)
- `sequence-async` — 不同步變化
- `sequence-grouped` — 分組規律
- `sequence-accumulative` — 累積增加

### 空間 (spatial-*)
- `spatial-paper-fold` — 折紙打洞
- `spatial-cube-counting` — 立方體計數
- `spatial-cube-net` — 立方體展開圖
- `spatial-cube-net-invalid` — 展開圖判斷錯誤
- `spatial-volume-arithmetic` — 立體乘法
- `spatial-mirror` — 鏡像
- `spatial-symmetry-fold` — 對稱折紙還原
- `spatial-cube-combination` — 立方體組合(兩堆方塊合起來等於哪一堆)

### 數列 (number-*)
- `number-arithmetic-series` — 等差數列
- `number-geometric-series` — 等比數列
- `number-square` — 平方數
- `number-second-order` — 二階等差
- `number-alternating` — 交錯雙串
- `number-fibonacci` — 費氏數列
- `number-factorial` — 階乘
- `number-mixed-operation` — 混合運算

### 類比 (analogy-*)
- `analogy-function` — 功能類比 (鳥:翅膀)
- `analogy-antonym` — 反義詞
- `analogy-location` — 工作場所
- `analogy-sound` — 聲音
- `analogy-material` — 原料追溯
- `analogy-part-whole` — 部分與整體
- `analogy-causal` — 因果關係
- `analogy-degree` — 程度副詞

### 多元變化 (multivar-*)
- `multivar-2var` — 雙變數獨立
- `multivar-3var` — 三變數獨立
- `multivar-4var` — 四變數獨立
- `multivar-latin` — 拉丁方陣
- `multivar-position-swap` — 位置交換
- `multivar-attribute-inheritance` — 屬性繼承

> **新增 skill code 流程**:在 generation log 提出新 code → 我 review → 加入本表。**不要私自亂加**。

---

## 4. Visual Spec 規範

`visual` 是結構化物件,renderer 根據 `type` 分派到對應的繪圖函數。

### 4.1 `matrix-3x3`
3×3 格子矩陣,9 個 cells。

```json
{
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
}
```

**每個 cell 可有的欄位**:
- `shape`:`circle | square | triangle | star | diamond | hex | arrow | dots`
- `color`:見 §5 顏色表
- `count`:1-4,顯示多個同形狀(用 `multiShape`)
- `rotation`:角度(只對 arrow 有意義)
- `dots`:1-6,顯示骰子點數
- `unknown`:`true` → 顯示「?」(整個矩陣只能有一個)

### 4.2 `matrix-2x2`
同 `matrix-3x3` 但 `cells` 長度 4。

### 4.3 `sequence-row`
一排格子,通常 4-6 個。

```json
{
  "type": "sequence-row",
  "items": [
    {"shape": "arrow", "rotation": 0, "color": "pink"},
    {"shape": "arrow", "rotation": 45, "color": "pink"},
    {"shape": "arrow", "rotation": 90, "color": "pink"},
    {"unknown": true}
  ]
}
```

### 4.4 `number-sequence`
數字序列。

```json
{
  "type": "number-sequence",
  "items": [3, 6, 9, 12, "?"]
}
```
- 已知數字用 number,未知用字串 `"?"`

### 4.5 `analogy-row`
A : B :: C : ? 版型。

```json
{
  "type": "analogy-row",
  "pairs": [
    { "a": {"text": "鳥", "emoji": "🐦"}, "b": {"text": "翅膀", "emoji": "🪶"} },
    { "a": {"text": "魚", "emoji": "🐟"}, "b": {"unknown": true} }
  ]
}
```
emoji 選填,有的話畫面更豐富。

### 4.6 `cubeStack` ⭐ 已實作
立方體堆,用 3D 陣列。

```json
{
  "type": "cubeStack",
  "layout": [
    [[1, 1, 1]],
    [[0, 0, 1]]
  ],
  "size": 28
}
```
- `layout`:1D / 2D / 3D 陣列(see iso_demo.html)
- `size`:單位立方體邊長 px (預設 24)

### 4.7 `cubeNet` (future)
立方體展開圖。

```json
{
  "type": "cubeNet",
  "layout": "cross",
  "faces": [
    { "position": "top",    "label": "1", "color": "yellow" },
    { "position": "front",  "label": "2", "color": "teal" },
    { "position": "right",  "label": "3", "color": "pink" },
    { "position": "back",   "label": "4", "color": "purple" },
    { "position": "left",   "label": "5", "color": "orange" },
    { "position": "bottom", "label": "6", "color": "blue" }
  ]
}
```
- `layout`:`"cross" | "T" | "L"`(常見展開圖樣式)
- `position` 取值:`top / front / right / back / left / bottom`
- 每面可有 `label`(文字)、`color`、或 `icon`(emoji)

### 4.8 `foldedPaper` ⭐ 已實作
折紙打洞題。實際使用通常配合 `composite` 串多個狀態。

```json
{
  "type": "foldedPaper",
  "layout": "flat",
  "foldHint": "horizontal",
  "label": "對摺線"
}
```

**欄位**:
- `layout`:
  - `"flat"` (預設) — 完整方形
  - `"half-h"` — 上下對摺後的半張 (高度 1/2)
  - `"half-v"` — 左右對摺後的半張 (寬度 1/2)
  - `"quarter"` — 對摺兩次的 1/4
- `foldHint`: `"horizontal"` | `"vertical"` | array of those — 在 flat 紙上畫虛線提示「對摺線」
- `holes`: `[{x: 0-1, y: 0-1}]` — 洞的相對位置 (粉紅圓 + 黑邊)
- `label`: 紙下方的說明文字

**容器尺寸固定** (80×80 + padding,所有 layout 都用相同容器),這樣多步驟在 `composite` 內並排時對齊。

**多步驟用法範例**:

```json
{
  "type": "composite",
  "arrangement": "horizontal",
  "items": [
    {"type": "foldedPaper", "layout": "flat", "foldHint": "horizontal", "label": "對摺線"},
    {"type": "text", "content": "→"},
    {"type": "foldedPaper", "layout": "half-h", "holes": [{"x": 0.33, "y": 0.5}]},
    {"type": "text", "content": "展開?"}
  ]
}
```

**已知限制 (v1)**:
- 不自動計算「展開後」洞的對稱位置 — 由出題者在 options 裡分別指定各種對稱結果 (這也是 IQ 題的本質:讓孩子推理出對稱結果)
- 只支援 0/1/2 次對摺 (`quarter`)
- 洞顏色固定粉紅。日後若要多種顏色再擴 `holeColor`

### 4.9 `single-shape`
單一形狀,主要用於選項。

```json
{
  "type": "single-shape",
  "shape": "circle",
  "color": "pink",
  "count": 2
}
```

**選用欄位** (rotation 鏡像題用):
- `mirrorAxis`: `"horizontal"` | `"vertical"` — 標明這個 arrow 是某個鏡像問題裡「原始」或「鏡像」cell 的對稱軸。**純 metadata,renderer 不顯示**;用於未來雷達圖 / 弱項分析 group by 方向。

例:
```json
{
  "type": "single-shape",
  "shape": "arrow",
  "rotation": 45,
  "color": "pink",
  "mirrorAxis": "horizontal"
}
```

### 4.10 Batch +1000 新增 primitive (option-layer single-visual)

下列 6 個 visual type 是 batch +1000 新增的「單一視覺元件」,viewBox 統一 `0 0 50 50`。
**兩種使用層次**:
- **option 層 (top-level visual.type)**:當作 `options[i].visual.type` 直接使用。
- **matrix cell 層 (cell.type)**:在 `matrix-3x3` / `matrix-2x2` / `sequence-row` 的 cell 內,用 `cell.type` 取代 `cell.shape` 來指定這些 primitive(見 §4.11 cell.type dispatcher)。

#### 4.10.1 `clock-hand`
時鐘指針。0° = 12 點鐘,順時針為正。
```json
{ "type": "clock-hand", "angle_deg": 90, "length_ratio": 0.7, "dot_radius": 2 }
```
- `angle_deg`: 0-359
- `length_ratio`: `0.4` (短指針,hard 第二屬性) 或 `0.7` (長指針,easy/mid 預設)
- `dot_radius`: 圓心點半徑,預設 2

#### 4.10.2 `angle-v`
V 字形。`orientation` 表示「開口方向」。
```json
{ "type": "angle-v", "orientation": "up", "spread_deg": 60, "dots": 2 }
```
- `orientation`: `"up" | "down" | "left" | "right"` (開口朝哪邊;up = 頂點在下方 25,35,V 形)
- `spread_deg`: 兩線間開角,30° (尖) / 60° (典型) / 120° (平)
- `dots`: 0-3,凹側內的黑色實心圓數

#### 4.10.3 `triangle-split`
方形被對角線切成兩個三角形分別填色。
```json
{ "type": "triangle-split", "diagonal": "TL-BR", "top_fill": "white", "bottom_fill": "black" }
```
- `diagonal`: `"TL-BR"` (左上→右下) 或 `"TR-BL"` (右上→左下)
- `top_fill`, `bottom_fill`: `"black" | "white" | "gray"`
- **Convention**:從對角線起點起逆時針的第一個三角形 = `top`(視覺位置可能不在「上方」)

#### 4.10.4 `tally-lines`
線條數量(橫線、直線各 0-3,可同時)。
```json
{ "type": "tally-lines", "h_count": 2, "v_count": 1 }
```

#### 4.10.5 `bowtie`
雙三角形(蝴蝶結)。
```json
{ "type": "bowtie", "orientation": "horizontal", "left_fill": "black", "right_fill": "striped" }
```
- `orientation`: `"horizontal" | "vertical"`
- `left_fill`, `right_fill`: `"black" | "white" | "striped"`(striped 是 45° 斜紋)

#### 4.10.6 `nested-grid`
小 3×3 grid,某些格子填色。
```json
{ "type": "nested-grid", "filled_cells": [4], "black_cell_size": "normal",
  "fill_color": "ink", "fill_shape": "square", "border_color": "ink" }
```
- `filled_cells`: 0-8 的索引陣列 (0=左上, 4=中, 8=右下)
- `black_cell_size`: `"normal"` (60% cell) 或 `"large"` (80% cell)
- `fill_color`: 填色,預設 `ink`(可用 `pink`/`teal` 等做 direct-position-mapping 變體)
- `fill_shape`: `"square" | "circle" | "triangle"` 填色形狀(預設 square)
- `border_color`: 小 grid 邊框色,預設 `ink`

---

### 4.11 cell.type dispatcher (batch +1000 新增介面)

`matrix-3x3` / `matrix-2x2` / `sequence-row` 的每個 cell 預設用 `cell.shape` 對應到 `single-shape`-style 渲染。**新介面**:cell 可指定 `cell.type` 從 §4.10 的 primitive 列表選一個 visual,renderer 會優先 dispatch 到該 primitive。

```json
{
  "type": "matrix-3x3",
  "cells": [
    { "type": "clock-hand", "angle_deg": 0,   "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 30,  "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 60,  "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 90,  "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 120, "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 150, "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 180, "length_ratio": 0.7 },
    { "type": "clock-hand", "angle_deg": 210, "length_ratio": 0.7 },
    { "unknown": true }
  ]
}
```

**dispatch 順序**(`web/js/renderer.js` 的 `renderCellContent`):
1. `cell.unknown` → 顯示「?」
2. `cell.raw` → 直接塞 SVG 字串 (legacy escape hatch)
3. **`cell.type` ∈ `VALID_CELL_TYPES` → 走新 primitive dispatch**(batch +1000)
4. `cell.shape` → fallback 到舊 single-shape 渲染(向後相容)

**為什麼分 `VALID_VISUAL_TYPES` 跟 `VALID_CELL_TYPES`**:
- `VALID_VISUAL_TYPES` 是 top-level 的視覺類型(`q.visual.type` 跟 `options[i].visual.type`),包括 matrix-3x3、composite、single-shape 等 layout 型 + 6 個新 primitive。
- `VALID_CELL_TYPES` 是 matrix/sequence cell 層的 primitive 列表(只有 6 個新 primitive,不會出現 matrix-3x3 這種 layout 型)。
- 兩者目前內容部分重疊,但**用途不同**,分開有助於 lint 出「在 cell 裡誤用 layout 型」的錯誤。

---

### 4.12 `composite` (組合)
多個視覺水平排列。

```json
{
  "type": "composite",
  "arrangement": "horizontal",
  "items": [
    { "type": "single-shape", "shape": "circle", "color": "pink" },
    { "type": "text", "content": "→" },
    { "type": "single-shape", "shape": "circle", "color": "pink", "count": 2 }
  ],
  "gap": 12
}
```

---

## 5. 顏色表

`color` 欄位只能用 **named color**,不可直接寫 hex。

| name | hex | 用途 |
|------|-----|------|
| `pink`   | `#FF6B9D` | 主強調色 |
| `teal`   | `#4ECDC4` | 輔助 |
| `yellow` | `#FFD93D` | 高亮 |
| `purple` | `#9B7EDE` | 紫 |
| `orange` | `#FF9F45` | 橘 |
| `blue`   | `#5B9DEC` | 藍 |
| `white`  | `#FFFFFF` | 中性 |
| `ink`    | `#2D2A4A` | 深紫黑(邊框、文字) |

→ 新加顏色要先寫進 §5 並更新 `web/js/shapes.js` 的 `COLORS` 常數。

---

## 6. Options 規範

```json
"options": [
  { "text": "粉紅圓",  "visual": {"type": "single-shape", "shape": "circle", "color": "pink"} },
  { "text": "黃三角",  "visual": {"type": "single-shape", "shape": "triangle", "color": "yellow"} },
  { "text": "藍綠方",  "visual": {"type": "single-shape", "shape": "square", "color": "teal"} },
  { "text": "粉紅星",  "visual": {"type": "single-shape", "shape": "star", "color": "pink"} }
]
```

### 6.1 數量
- 至少 3 個,最多 4 個
- 純文字題(類比、數列)可 4 個全文字選項

### 6.2 干擾選項設計
每個錯誤選項都必須對應一種「**常見的錯誤思路**」。在 generation log 寫清楚每個錯誤選項代表什麼誤解。例:
- 正解:`square + teal`
- 干擾 A:`circle + teal` — 只認對顏色,看錯形狀
- 干擾 B:`square + pink` — 只認對形狀,看錯顏色
- 干擾 C:`star + pink` — 都認錯

**不要**放完全無關的隨機選項(等於送分)。

### 6.3 答案唯一性
- 設計後重新推導 3 次,確保沒有第二種合理解法
- 干擾選項不可剛好也滿足同一規律(會多解)

---

## 7. Manifest.json 規範

```json
{
  "version": 1,
  "generated_at": "2026-05-24T10:00:00Z",
  "topics": {
    "matrix": {
      "easy": ["matrix-easy-001", "matrix-easy-002", "matrix-easy-003"],
      "mid":  ["matrix-mid-001", "matrix-mid-002"],
      "hard": ["matrix-hard-001"]
    },
    ...
  }
}
```

**不要手改**,跑 `node tools/build-manifest.mjs` 自動產生。

---

## 8. 驗證規則 (validate.mjs 會檢查)

### 8.1 結構檢查
- [x] 七大欄位都有值:`id`, `topic`, `difficulty`, `prompt`, `visual`, `options`, `answer`, `hint`, `explanation`, `skill`
- [x] `id` 符合命名規則,跟檔名一致
- [x] `topic` / `difficulty` 是允許的 enum
- [x] `options.length` >= 3 && <= 4
- [x] `answer` 是整數,0 <= answer < options.length
- [x] `visual.type` 是已知 type
- [x] `skill_codes` 至少 1 個,且都在 §3 列表內

### 8.2 內容檢查
- [x] 沒有禁詞:`等等`, `不對!`, `我們重看`, `重看:` (AI 自言自語訊號)
- [x] 沒有提到 `Claude`, `AI`, `訓練資料`, `語言模型`
- [x] `prompt` 不超過 80 字
- [x] `explanation` 至少 20 字 (太短 = 沒解析)
- [x] `hint` 結尾有 `?` 或 `。` (確認是引導句不是答案)

### 8.3 視覺檢查 (建議,非強制)
- 渲染後 SVG 元素數量合理
- 答案 visual 跟正確選項 visual 結構一致

---

## 9. 完整範例

### 9.1 matrix-easy-001 (取代 web/index.html 裡 matrix.easy[0])

```json
{
  "id": "matrix-easy-001",
  "topic": "matrix",
  "difficulty": "easy",
  "sub_type": "single-variable-row",
  "skill_codes": ["pattern-row-identification"],
  "created_at": "2026-05-24",
  "author": "human-george",
  "inspired_by": "raven-matrix-2x2-style",

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
    {"text": "粉紅圓", "visual": {"type": "single-shape", "shape": "circle", "color": "pink"}},
    {"text": "黃三角", "visual": {"type": "single-shape", "shape": "triangle", "color": "yellow"}},
    {"text": "藍綠方", "visual": {"type": "single-shape", "shape": "square", "color": "teal"}},
    {"text": "粉紅星", "visual": {"type": "single-shape", "shape": "star", "color": "pink"}}
  ],

  "answer": 1,
  "hint": "看橫的:第一排都是粉紅圓、第二排都是藍綠方,第三排前兩個是什麼?",
  "explanation": "每一排的三格是<strong>同樣的東西</strong>。第三排前兩格是黃色三角形,所以第三格也要是<strong>黃色三角形</strong>。",
  "skill": "橫向規律識別"
}
```

### 9.2 spatial-easy-002 (取代 web/index.html 裡的數方塊題)

```json
{
  "id": "spatial-easy-002",
  "topic": "spatial",
  "difficulty": "easy",
  "sub_type": "cube-counting-no-hidden",
  "skill_codes": ["spatial-cube-counting"],
  "created_at": "2026-05-24",
  "author": "human-george",

  "prompt": "下面這堆積木,總共有幾塊?(包括看不到、被擋住的)",

  "visual": {
    "type": "cubeStack",
    "layout": [
      [[1, 1, 1]],
      [[0, 0, 1]]
    ],
    "size": 28
  },

  "options": [
    {"text": "3 塊"},
    {"text": "4 塊"},
    {"text": "5 塊"},
    {"text": "6 塊"}
  ],

  "answer": 1,
  "hint": "底層看得到 3 塊方塊。上面還有<strong>第 4 塊</strong>。沒有被擋住的喔!",
  "explanation": "底層有 <strong>3 塊</strong>方塊排成一排,上層有 <strong>1 塊</strong>疊在最右邊那塊上面。總共 <strong>3 + 1 = 4 塊</strong>。",
  "skill": "立體方塊計數"
}
```

---

## 10. 未來擴充

新增 `visual.type` 流程:
1. 在 `docs/wishlist.md` 或 issue 提案
2. 我寫對應的 renderer (`web/js/renderer.js`)
3. 加進本檔 §4
4. 加進 validator 的已知 type 列表
5. 題庫 Claude 才能開始用

---

**END OF schema-v1**
