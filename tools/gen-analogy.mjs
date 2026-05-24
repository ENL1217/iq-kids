#!/usr/bin/env node
// tools/gen-analogy.mjs
// 生成「類比推理」題型,8 個 sub_type 共 75 題。
//
// 策略 (Q1 review:採 B):同 sub_type 統一 prompt,跨 sub_type 有變化。
// 干擾選項 (Q2 review):4 種來源全部「結構對但語義錯」,無隨機。
//   - same-pool: 同類別其他 pair 的 b (相同關係類型,錯具體配對)
//   - reverse:  反方向 / 對應角色錯位 (抓「不看順序」的孩子)
//   - cross:    跨類別語意 (跟主題相關但關係類型錯)
// degree (Q3 review): explanation 必須點明「程度差異」,不寫「意思一樣」。
//
// 命名規則:從 -003 起跳, -001/-002 是 spec 作者保留題,絕不覆寫。

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, idGen, makeRng, rngPick, rngShuffle } from './gen-utils.mjs';

const TOPIC = 'analogy';
const TODAY = new Date().toISOString().slice(0, 10);

// ─── PROMPTS (per Q1: 同 sub_type 統一) ────────────────────────────────
// Key 必須 EXACTLY 等於 sub_type 字串 (不要轉 camelCase)
const PROMPTS = {
  // (legacy function — 拆 sub-pool 後不再使用,留著當保險)
  'function':              '左邊是「東西跟它的用途」,右邊也要一樣!',
  // v2 split:
  'function-body-sense':   '左邊是「器官跟它的動作」,右邊也要對!',
  'function-animal-part':  '左邊是「動物跟牠最特別的身體部位」,右邊也要對!',
  'function-tool':         '左邊是「工具跟它的用途」,右邊也要對!',
  'antonym':               '前面兩個是相反詞,後面也要找相反詞!',
  'location-workplace':    '左邊是「人或動物跟牠常在的地方」,右邊也要對!',
  'sound':                 '左邊是「動物跟牠的叫聲」,右邊也要對!',
  'causal':                '前面是「先發生跟結果」,後面也要對應!',
  'material-source':       '前面是「成品跟它的原料」,後面也要找原料!',
  'part-whole':            '前面是「小部分跟整體」,後面也要對應!',
  'degree-intensity':      '前面兩個是「同一件事,但右邊更強烈」,後面也要對!'
};

// ─── POOLS ──────────────────────────────────────────────────────────────
// 每個 entry:{ a, b, ...sub_type 專屬的干擾欄位 }
//
// (b) 反方向 distractor:用「action 的對象/結果」這種反推會卡住的詞
// (c) 跨類別 distractor:跟 a 在主題上有關但關係錯誤的詞

// function 拆 3 sub-pool (per reviewer v2):身體部位→感官 / 動物→身體部位 / 工具→用途
// 每個 sub-pool 各 5 題,合計 15 (保 easy bucket = 30 per authoring.md;
// reviewer 提的 10 each = 30 函數 + 15 antonym 會讓 easy 變 45,等 reviewer 拍板要不要擴)

const FUNCTION_BODY_SENSE_POOL = [
  // a=感官器官, b=該器官的主要動作
  { a: '眼睛',   b: '看',   reverse: '影像', cross: '臉' },
  { a: '耳朵',   b: '聽',   reverse: '聲音', cross: '頭' },
  { a: '鼻子',   b: '聞',   reverse: '味道', cross: '臉頰' },
  { a: '舌頭',   b: '嚐',   reverse: '味道', cross: '嘴巴' },
  { a: '手指',   b: '摸',   reverse: '質感', cross: '指甲' },
  { a: '牙齒',   b: '咬',   reverse: '骨頭', cross: '嘴唇' },
  { a: '腳',     b: '走',   reverse: '路',   cross: '鞋子' }
];

const FUNCTION_ANIMAL_PART_POOL = [
  // a=動物, b=該動物特徵的身體部位 (鳥:翅膀, 魚:鰭 是 -001 保留,不放)
  { a: '兔子',     b: '長耳朵', reverse: '草',     cross: '尾巴' },
  { a: '大象',     b: '長鼻子', reverse: '水',     cross: '耳朵' },
  { a: '長頸鹿',   b: '長脖子', reverse: '葉子',   cross: '斑點' },
  { a: '袋鼠',     b: '袋子',   reverse: '寶寶',   cross: '腳' },
  { a: '烏龜',     b: '硬殼',   reverse: '保護',   cross: '小腳' },
  { a: '螃蟹',     b: '鉗子',   reverse: '夾',     cross: '殼' },
  { a: '蝸牛',     b: '殼',     reverse: '黏液',   cross: '觸角' },
  { a: '刺蝟',     b: '尖刺',   reverse: '敵人',   cross: '小腳' }
];

const FUNCTION_TOOL_POOL = [
  // a=工具, b=工具的用途動作
  { a: '剪刀',   b: '剪',   reverse: '紙',   cross: '刀' },
  { a: '鎚子',   b: '敲',   reverse: '釘子', cross: '木板' },
  { a: '鉛筆',   b: '寫',   reverse: '字',   cross: '紙' },
  { a: '鑰匙',   b: '開',   reverse: '門',   cross: '鎖' },
  { a: '掃把',   b: '掃',   reverse: '灰塵', cross: '畚箕' },
  { a: '雨傘',   b: '擋雨', reverse: '水珠', cross: '雨衣' },
  { a: '吸管',   b: '吸',   reverse: '果汁', cross: '杯子' },
  { a: '湯匙',   b: '舀',   reverse: '湯',   cross: '碗' },
  { a: '橡皮擦', b: '擦',   reverse: '錯字', cross: '鉛筆盒' },
  { a: '繩子',   b: '綁',   reverse: '結',   cross: '蝴蝶結' }
];

const ANTONYM_POOL = [
  // a, b 互為反義;related = 跟 a 同主題但不是反義的詞
  { a: '大',   b: '小',   related: '圓' },
  { a: '高',   b: '矮',   related: '胖' },
  { a: '長',   b: '短',   related: '直' },
  { a: '寬',   b: '窄',   related: '深' },
  { a: '厚',   b: '薄',   related: '硬' },
  { a: '多',   b: '少',   related: '滿' },
  { a: '重',   b: '輕',   related: '大' },
  { a: '快',   b: '慢',   related: '穩' },
  { a: '強',   b: '弱',   related: '勇' },
  { a: '硬',   b: '軟',   related: '冷' },
  { a: '黑',   b: '白',   related: '亮' },
  { a: '上',   b: '下',   related: '中' },
  { a: '前',   b: '後',   related: '旁' },
  { a: '早',   b: '晚',   related: '快' },
  { a: '新',   b: '舊',   related: '貴' },
  { a: '開',   b: '關',   related: '門' },
  { a: '開心', b: '難過', related: '安靜' },
  { a: '乾',   b: '濕',   related: '冷' }
];

const LOCATION_POOL = [
  // a=人/動物, b=常在的地方 (廚師/醫生 是 -001 保留題,本 pool 不放)
  { a: '老師',     b: '教室',     reverse: '學生',   cross: '黑板' },
  { a: '警察',     b: '警察局',   reverse: '小偷',   cross: '警棍' },
  { a: '消防員',   b: '消防局',   reverse: '火災',   cross: '水管' },
  { a: '農夫',     b: '農田',     reverse: '稻米',   cross: '鋤頭' },
  { a: '漁夫',     b: '漁港',     reverse: '魚',     cross: '網子' },
  { a: '飛行員',   b: '飛機',     reverse: '天空',   cross: '機票' },
  { a: '郵差',     b: '郵局',     reverse: '信',     cross: '腳踏車' },
  { a: '店員',     b: '商店',     reverse: '客人',   cross: '收銀機' },
  { a: '蜜蜂',     b: '蜂巢',     reverse: '蜂蜜',   cross: '花朵' },
  { a: '蜘蛛',     b: '蜘蛛網',   reverse: '蟲子',   cross: '八隻腳' },
  { a: '螞蟻',     b: '蟻穴',     reverse: '糖',     cross: '觸角' },
  { a: '蝙蝠',     b: '山洞',     reverse: '夜晚',   cross: '翅膀' }
];

const SOUND_POOL = [
  // a=動物, b=叫聲 (小狗/小貓 是 -002 保留題,本 pool 不放)
  { a: '牛',     b: '哞',     reverse: '草',     cross: '牛奶' },
  { a: '羊',     b: '咩',     reverse: '草原',   cross: '羊毛' },
  { a: '雞',     b: '咕咕',   reverse: '蛋',     cross: '雞冠' },
  { a: '鴨',     b: '嘎嘎',   reverse: '池塘',   cross: '蹼' },
  { a: '豬',     b: '噗噗',   reverse: '泥巴',   cross: '尾巴' },
  { a: '馬',     b: '嘶',     reverse: '草原',   cross: '馬鞍' },
  { a: '蜜蜂',   b: '嗡',     reverse: '花',     cross: '蜂蜜' },
  { a: '青蛙',   b: '呱呱',   reverse: '池塘',   cross: '荷葉' },
  { a: '麻雀',   b: '啾啾',   reverse: '樹枝',   cross: '羽毛' },
  { a: '老鼠',   b: '吱吱',   reverse: '起司',   cross: '尾巴' },
  { a: '烏鴉',   b: '嘎嘎',   reverse: '電線桿', cross: '黑色' },
  { a: '獅子',   b: '吼',     reverse: '草原',   cross: '鬃毛' }
];

const CAUSAL_POOL = [
  // a=原因, b=結果
  { a: '太陽',   b: '亮',     reverse: '雲',     cross: '熱' },
  { a: '火',     b: '熱',     reverse: '木柴',   cross: '煙' },
  { a: '雨',     b: '濕',     reverse: '雲',     cross: '雨傘' },
  { a: '雪',     b: '冷',     reverse: '冬天',   cross: '雪人' },
  { a: '跑步',   b: '流汗',   reverse: '操場',   cross: '心跳快' },
  { a: '受傷',   b: '痛',     reverse: '醫生',   cross: '流血' },
  { a: '吃飯',   b: '飽',     reverse: '飯',     cross: '碗' },
  { a: '喝水',   b: '解渴',   reverse: '杯子',   cross: '水壺' }
];

const MATERIAL_POOL = [
  // a=成品, b=原料 (紙:樹, 麵包:小麥 是 -001 保留題)
  { a: '牛奶',     b: '乳牛',     reverse: '杯子',   cross: '起司' },
  { a: '蜂蜜',     b: '蜜蜂',     reverse: '罐子',   cross: '花' },
  { a: '雞蛋',     b: '雞',       reverse: '蛋殼',   cross: '雞窩' },
  { a: '巧克力',   b: '可可豆',   reverse: '糖果紙', cross: '甜' },
  { a: '衣服',     b: '棉花',     reverse: '衣架',   cross: '工廠' },
  { a: '糖',       b: '甘蔗',     reverse: '糖罐',   cross: '甜' },
  { a: '茶',       b: '茶葉',     reverse: '茶杯',   cross: '熱水' },
  { a: '豆腐',     b: '黃豆',     reverse: '盤子',   cross: '湯' }
];

const PART_WHOLE_POOL = [
  // a=部分, b=整體 (手指:手, 花瓣:花 是 -002 保留題)
  { a: '葉子',   b: '樹',       reverse: '森林',   cross: '綠色' },
  { a: '輪子',   b: '車子',     reverse: '馬路',   cross: '汽油' },
  { a: '屋頂',   b: '房子',     reverse: '社區',   cross: '磚塊' },
  { a: '鈕扣',   b: '衣服',     reverse: '衣櫃',   cross: '布' },
  { a: '鏡片',   b: '眼鏡',     reverse: '視力',   cross: '鏡框' },
  { a: '鞋帶',   b: '鞋子',     reverse: '腳',     cross: '鞋盒' },
  { a: '把手',   b: '門',       reverse: '房間',   cross: '鑰匙' },
  { a: '琴鍵',   b: '鋼琴',     reverse: '音樂廳', cross: '音樂' },
  { a: '螢幕',   b: '電腦',     reverse: '桌子',   cross: '滑鼠' },
  { a: '鏡頭',   b: '相機',     reverse: '照片',   cross: '腳架' }
];

const DEGREE_POOL = [
  // a=程度較弱, b=程度較強 (同類動作/狀態)
  // explanation 必須點明「程度差異」(per Q3 review)
  { a: '微笑',   b: '大笑',     category: '笑的動作',     intensifier: '更開心、聲音更大' },
  { a: '看',     b: '盯',       category: '用眼睛',       intensifier: '更專心、看更久' },
  { a: '走',     b: '跑',       category: '腳的動作',     intensifier: '速度更快' },
  { a: '涼',     b: '冷',       category: '溫度低',       intensifier: '更冷' },
  { a: '暖',     b: '熱',       category: '溫度高',       intensifier: '更熱' },
  { a: '喜歡',   b: '愛',       category: '正面情感',     intensifier: '感情更深' },
  { a: '拍',     b: '打',       category: '手碰東西',     intensifier: '力氣更大' },
  { a: '摸',     b: '抓',       category: '手接觸',       intensifier: '力道更強、會留痕' }
];

// ─── 通用工具 ──────────────────────────────────────────────────────────

function makeBaseQuestion(id, difficulty, sub_type, skill_code, skillZh, p1, p2, options, answerIdx, hint, explanation) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: PROMPTS[sub_type],
    visual: {
      type: 'analogy-row',
      pairs: [
        { a: { text: p1.a }, b: { text: p1.b } },
        { a: { text: p2.a }, b: { unknown: true } }
      ]
    },
    options: options.map(t => ({ text: t })),
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// shuffle 4 個選項並算 answer index;answer 一定保留
function placeOptions(correct, d1, d2, d3, seed) {
  const all = [correct, d1, d2, d3];
  // 去重(可能 distractor 撞到 correct 或彼此)
  const seen = new Set();
  const unique = [];
  for (const o of all) {
    if (!seen.has(o)) { seen.add(o); unique.push(o); }
  }
  // 若不足 4 個,補一個明顯不相干的填充(從 ANTONYM_POOL.related 拿)
  // 這只是 fallback,正常 generator 設計都會給 4 個獨立 distractor
  let i = 0;
  while (unique.length < 4) {
    const filler = ANTONYM_POOL[i % ANTONYM_POOL.length].related;
    if (!seen.has(filler)) { seen.add(filler); unique.push(filler); }
    i += 1;
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  return { options: shuffled, answer: shuffled.indexOf(correct) };
}

function hashSeed(id) {
  return [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
}

// ─── EASY:function 三個 sub-pool 各自的 generator (v2 per reviewer) ──────

// (1) 身體部位 → 感官動作
function genFunctionBodySense(id, p1, p2) {
  const otherB = FUNCTION_BODY_SENSE_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(p2.b, otherB, p2.reverse, p2.cross, hashSeed(id));
  return makeBaseQuestion(
    id, 'easy', 'function-body-sense', 'analogy-function', '感官功能類比',
    p1, p2, options, answer,
    `${p1.a}是用來做什麼?那${p2.a}呢?`,
    `<strong>${p1.a}</strong>是用來<strong>${p1.b}</strong>的,<strong>${p2.a}</strong>是用來<strong>${p2.b}</strong>的。題目在問「<strong>器官的主要動作</strong>」。`
  );
}

// (2) 動物 → 特徵身體部位
function genFunctionAnimalPart(id, p1, p2) {
  const otherB = FUNCTION_ANIMAL_PART_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(p2.b, otherB, p2.reverse, p2.cross, hashSeed(id));
  return makeBaseQuestion(
    id, 'easy', 'function-animal-part', 'analogy-function', '動物特徵類比',
    p1, p2, options, answer,
    `${p1.a}的特別身體部位是${p1.b}。那${p2.a}的特別部位是什麼?`,
    `<strong>${p1.a}</strong>最特別的身體部位是<strong>${p1.b}</strong>,<strong>${p2.a}</strong>最特別的身體部位是<strong>${p2.b}</strong>。題目在問「<strong>動物身上最顯眼的部位</strong>」。`
  );
}

// (3) 工具 → 用途
function genFunctionTool(id, p1, p2) {
  const otherB = FUNCTION_TOOL_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(p2.b, otherB, p2.reverse, p2.cross, hashSeed(id));
  return makeBaseQuestion(
    id, 'easy', 'function-tool', 'analogy-function', '工具用途類比',
    p1, p2, options, answer,
    `${p1.a}是用來${p1.b}的。那${p2.a}是用來做什麼?`,
    `<strong>${p1.a}</strong>是用來<strong>${p1.b}</strong>的,<strong>${p2.a}</strong>是用來<strong>${p2.b}</strong>的。題目在問「<strong>工具的用途</strong>」。`
  );
}

// ─── EASY:antonym (15 題) ──────────────────────────────────────────────
function genAntonym(id, p1, p2) {
  // (a) 同類:別組的 b
  const otherB = ANTONYM_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  // (b) synonym 陷阱:用 a 的「同方向」詞(此處沒有 synonym 欄位,用別組 a 代替表示「字典裡的另一個形容詞」)
  const otherA = ANTONYM_POOL.find(p => p.a !== p1.a && p.a !== p2.a && p.a !== otherB).a;
  // (c) 跨主題:同領域但非反義
  const cross = p2.related;
  const { options, answer } = placeOptions(p2.b, otherB, otherA, cross, hashSeed(id));
  return makeBaseQuestion(
    id, 'easy', 'antonym', 'analogy-antonym', '反義詞類比',
    p1, p2, options, answer,
    `${p1.a}跟${p1.b}是相反詞。那${p2.a}的相反是什麼?`,
    `<strong>${p1.a}</strong>跟<strong>${p1.b}</strong>是相反詞,意思剛好相反。同樣的,<strong>${p2.a}</strong>的相反就是<strong>${p2.b}</strong>。找相反詞要找<strong>意思對立</strong>的那一個。`
  );
}

// ─── MID:location (10 題) ──────────────────────────────────────────────
function genLocation(id, p1, p2) {
  const otherB = LOCATION_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(
    p2.b, otherB, p2.reverse, p2.cross, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'mid', 'location-workplace', 'analogy-location', '工作/生活地點類比',
    p1, p2, options, answer,
    `${p1.a}常在${p1.b}。那${p2.a}常在哪裡?`,
    `<strong>${p1.a}</strong>常待的地方是<strong>${p1.b}</strong>,<strong>${p2.a}</strong>常待的地方是<strong>${p2.b}</strong>。題目在問「<strong>地方</strong>」,不是工具或對象。`
  );
}

// ─── MID:sound (10 題) ─────────────────────────────────────────────────
function genSound(id, p1, p2) {
  const otherB = SOUND_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(
    p2.b, otherB, p2.reverse, p2.cross, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'mid', 'sound', 'analogy-sound', '動物叫聲類比',
    p1, p2, options, answer,
    `${p1.a}的叫聲是${p1.b}。那${p2.a}的叫聲呢?`,
    `<strong>${p1.a}</strong>的叫聲是「<strong>${p1.b}</strong>」,所以同樣的關係,<strong>${p2.a}</strong>的叫聲是「<strong>${p2.b}</strong>」。題目在問的是<strong>動物發出的聲音</strong>。`
  );
}

// ─── MID:causal (5 題) ─────────────────────────────────────────────────
function genCausal(id, p1, p2) {
  const otherB = CAUSAL_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(
    p2.b, otherB, p2.reverse, p2.cross, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'mid', 'causal', 'analogy-causal', '因果關係類比',
    p1, p2, options, answer,
    `${p1.a}會造成${p1.b}。那${p2.a}會造成什麼?`,
    `<strong>${p1.a}</strong>會造成<strong>${p1.b}</strong>,<strong>${p2.a}</strong>會造成<strong>${p2.b}</strong>。兩組都是「<strong>原因 → 結果</strong>」的關係,要找直接造成的那個結果。`
  );
}

// ─── HARD:material (8 題) ──────────────────────────────────────────────
function genMaterial(id, p1, p2) {
  const otherB = MATERIAL_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(
    p2.b, otherB, p2.reverse, p2.cross, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'hard', 'material-source', 'analogy-material', '原料追溯類比',
    p1, p2, options, answer,
    `${p1.a}是用什麼做的?那${p2.a}呢?要追到「原料」,不是中間步驟。`,
    `<strong>${p1.a}</strong>是從<strong>${p1.b}</strong>做出來的,<strong>${p2.a}</strong>是從<strong>${p2.b}</strong>做出來的。要追到「<strong>最一開始</strong>的材料」,不是中間的加工步驟。`
  );
}

// ─── HARD:part-whole (6 題) ────────────────────────────────────────────
function genPartWhole(id, p1, p2) {
  const otherB = PART_WHOLE_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const { options, answer } = placeOptions(
    p2.b, otherB, p2.reverse, p2.cross, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'hard', 'part-whole', 'analogy-part-whole', '部分與整體類比',
    p1, p2, options, answer,
    `${p1.a}是${p1.b}的一部分。那${p2.a}是什麼的一部分?`,
    `<strong>${p1.a}</strong>是<strong>${p1.b}</strong>的一個小部分,合起來才是完整的<strong>${p1.b}</strong>。同樣的,<strong>${p2.a}</strong>是<strong>${p2.b}</strong>的一個小部分。題目在問「整體」是什麼。`
  );
}

// ─── HARD:degree (6 題) ────────────────────────────────────────────────
// 干擾 v2 (per reviewer:不可用 p2.a 自己當干擾,孩子會覺得 confusing):
//   (a) 同類:別組 b (其他類型的「強烈版」動作)
//   (b) 別組 a #1 (其他類型的「微弱版」動作)
//   (c) 別組 a #2 (再另一個類型的「微弱版」動作)
function genDegree(id, p1, p2) {
  const otherB = DEGREE_POOL.find(p => p.b !== p1.b && p.b !== p2.b).b;
  const otherA1 = DEGREE_POOL.find(p => p.a !== p1.a && p.a !== p2.a && p.a !== otherB).a;
  const otherA2 = DEGREE_POOL.find(p =>
    p.a !== p1.a && p.a !== p2.a && p.a !== otherB && p.a !== otherA1
  ).a;
  const { options, answer } = placeOptions(
    p2.b, otherB, otherA1, otherA2, hashSeed(id)
  );
  return makeBaseQuestion(
    id, 'hard', 'degree-intensity', 'analogy-degree', '程度副詞類比',
    p1, p2, options, answer,
    `${p1.a}跟${p1.b}是同一類,但${p1.b}更強。${p2.a}更強的版本是什麼?`,
    `<strong>${p1.b}</strong>比<strong>${p1.a}</strong>${p1.intensifier}(同樣是${p1.category})。<strong>${p2.b}</strong>比<strong>${p2.a}</strong>${p2.intensifier}(同樣是${p2.category})。注意:這不是同義詞,而是「程度更強」。`
  );
}

// ─── 主流程:從 pool 抽 pair 配對 ───────────────────────────────────────

/**
 * 從 pool 抽 count 個「(p1, p2) pair」,每個 entry 至多當 p2(答案位)一次,
 * 避免同樣的 b 在多題出現。
 */
function pickPairs(pool, count, rngSeed) {
  const rng = makeRng(rngSeed);
  // 洗牌出「答案 pair」順序
  const answerOrder = rngShuffle(rng, pool.map((_, i) => i)).slice(0, count);
  const pairs = [];
  for (const ai of answerOrder) {
    // 為這個 answer pair 找一個示範 pair (p1),不能等於自己
    let p1Idx;
    do {
      p1Idx = Math.floor(rng() * pool.length);
    } while (p1Idx === ai);
    pairs.push([pool[p1Idx], pool[ai]]);
  }
  return pairs;
}

// ─── 配置與執行 ────────────────────────────────────────────────────────

const RUNS = [
  // [difficulty, gen function, pool, count, seed offset]
  ['easy', genFunctionBodySense,  FUNCTION_BODY_SENSE_POOL,  5,  11],
  ['easy', genFunctionAnimalPart, FUNCTION_ANIMAL_PART_POOL, 5,  12],
  ['easy', genFunctionTool,       FUNCTION_TOOL_POOL,        5,  13],
  ['easy', genAntonym,            ANTONYM_POOL,              15, 22],
  ['mid',  genLocation,           LOCATION_POOL,             10, 33],
  ['mid',  genSound,              SOUND_POOL,                10, 44],
  ['mid',  genCausal,             CAUSAL_POOL,                5, 55],
  ['hard', genMaterial,           MATERIAL_POOL,              8, 66],
  ['hard', genPartWhole,          PART_WHOLE_POOL,            6, 77],
  ['hard', genDegree,             DEGREE_POOL,                6, 88]
];

const startCounter = { easy: 3, mid: 3, hard: 3 };  // 從 -003 起跳 (-001/-002 是 spec 保留)
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  for (const [diff, fn, pool, count, seed] of RUNS) {
    const pairs = pickPairs(pool, count, seed);
    for (const [p1, p2] of pairs) {
      const idNum = startCounter[diff]++;
      const id = `analogy-${diff}-${String(idNum).padStart(3, '0')}`;
      const q = fn(id, p1, p2);
      buckets[diff].push(q);
    }
  }

  // 驗證
  let failed = 0;
  for (const diff of ['easy', 'mid', 'hard']) {
    for (const q of buckets[diff]) {
      const res = validateQuestion(q);
      if (!res.valid) {
        console.error(`❌ ${q.id}: ${res.errors.join('; ')}`);
        failed += 1;
      }
      if (res.warnings && res.warnings.length) {
        console.warn(`! ${q.id}: ${res.warnings.join('; ')}`);
      }
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-analogy] ${failed} questions failed validation. Aborting.`);
    process.exit(1);
  }

  // 寫出
  for (const q of buckets.easy)  await writeQuestion(`questions/analogy/easy/${q.id}.json`, q);
  for (const q of buckets.mid)   await writeQuestion(`questions/analogy/mid/${q.id}.json`, q);
  for (const q of buckets.hard)  await writeQuestion(`questions/analogy/hard/${q.id}.json`, q);

  console.log(`[gen-analogy] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
