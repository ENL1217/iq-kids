# Generation Log

> 「題庫 Claude」的工作日誌。每一批生成記錄在這裡 — 計畫、來源、自驗、未解疑問。
>
> **規則**:
> - 每批先寫「計畫段」push 給 reviewer,OK 後才開始批量生題
> - 不省略外部閱讀清單(以後擴到 10000 題,要靠這份避免重複)
> - 不確定的題目要列在「待 reviewer 判斷」段
> - 寫作風格:對話、可追溯、不修飾

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

## Batch 2 — analogy (planning, 2026-05-24) 📝 待 review

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
