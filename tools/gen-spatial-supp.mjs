#!/usr/bin/env node
// tools/gen-spatial-supp.mjs
// Batch 7:spatial 補強 — 31 題,5 個新 sub_type,補完 spatial-* 7 個 canonical skill code
//
// Reviewer 拍板 (PR #9):
// Q1 paper-fold 視覺密度 → 用 composite (renderer 已內建 flex-wrap,見 renderer.js:285),
//    若要強制 raw-html wrapper 才能滿足 reviewer 對「8+ foldedPaper 並排」的擔憂,
//    本批用 composite (結構化優先) + PR comment 註明 renderer 自動 wrap
// Q2 cube-net-invalid options → 混 5 種句型 rotation,#5「無法折成」當 invalid case 正解
// Q3 mirror 命名 → sub_type 統一 'mirror-arrow',visual 加 mirrorAxis 欄位

import { writeQuestion, validateQuestion } from './lib.mjs';
import { baseMeta, makeRng, rngShuffle } from './gen-utils.mjs';

const TOPIC = 'spatial';

const PROMPTS = {
  'paper-fold-once':   '對摺一次,在指定位置打洞。展開後紙上會有什麼樣的洞?',
  'paper-fold-twice':  '對摺兩次,在指定位置打洞。展開後是什麼樣子?',
  'cube-net-opposite': '這個立方體展開圖,折起來後哪兩個面是相對的?',
  'cube-net-invalid':  '看這個展開圖,下面說法哪個是正確的?',
  'symmetry-fold':     '看展開後的結果,猜猜原本是怎麼折跟打洞的?',
  'mirror-arrow':      '下面這個箭頭的鏡像是哪一個?'
};

function makeQ(id, difficulty, sub_type, skill_code, skillZh, visual, options, answerIdx, hint, explanation) {
  if (!PROMPTS[sub_type]) throw new Error(`Missing PROMPT for sub_type: ${sub_type}`);
  return {
    id,
    ...baseMeta(TOPIC, difficulty, sub_type, [skill_code]),
    prompt: PROMPTS[sub_type],
    visual,
    options,
    answer: answerIdx,
    hint,
    explanation,
    skill: skillZh
  };
}

// ─── 工具:洗牌 options 但確定 4 個 unique ────────────────────────────
function placeOptions(correct, distractors, seedId) {
  const seed = [...seedId].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const all = [correct, ...distractors];
  const seen = new Set();
  const unique = [];
  for (const o of all) {
    const k = JSON.stringify(o);
    if (!seen.has(k)) { seen.add(k); unique.push(o); }
  }
  if (unique.length < 4) {
    throw new Error(`placeOptions: ${unique.length} unique opts for ${seedId}`);
  }
  const shuffled = rngShuffle(makeRng(seed), unique.slice(0, 4));
  const correctKey = JSON.stringify(correct);
  const answerIdx = shuffled.findIndex(o => JSON.stringify(o) === correctKey);
  return { options: shuffled, answerIdx };
}

// ─── 1. paper-fold-once (4 easy) ──────────────────────────────────────
// 對摺一次 + 打洞 + 展開
// 視覺:composite[ flat+foldHint | → | half + hole | → | flat? ]

// 給定一次對摺 (horizontal=上下對摺 → half-h) + half 上一個洞 (x_h, y_h)
// 展開後洞位置:
//   horizontal fold: (x_h, y_h/2) 跟 (x_h, 1 - y_h/2)
//   vertical fold:   (x_h/2, y_h) 跟 (1 - x_h/2, y_h)
function unfoldOnce(foldDir, holeOnHalf) {
  const { x, y } = holeOnHalf;
  if (foldDir === 'horizontal') {
    return [{ x, y: y / 2 }, { x, y: 1 - y / 2 }];
  } else {
    return [{ x: x / 2, y }, { x: 1 - x / 2, y }];
  }
}

function genPaperFoldOnce(id, configIdx) {
  // configs: [foldDir, holeX, holeY]
  // 限制 hole 在 half 內 (相對於 half-h 是 0-1 範圍,但 y 通常 < 0.7 以免靠摺線)
  const CONFIGS = [
    ['horizontal', 0.25, 0.4],
    ['horizontal', 0.5,  0.3],
    ['vertical',   0.4,  0.3],
    ['vertical',   0.5,  0.6]
  ];
  const [foldDir, hx, hy] = CONFIGS[configIdx];
  const halfLayout = foldDir === 'horizontal' ? 'half-h' : 'half-v';
  const correctHoles = unfoldOnce(foldDir, { x: hx, y: hy });

  // 視覺步驟:
  //  1. flat + foldHint (虛線提示對摺處) label「先沿虛線對摺」
  //  2. → (text arrow)
  //  3. half + hole label「打洞」
  //  4. → label「展開?」
  const visual = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: 'flat', foldHint: foldDir, label: '對摺線' },
      { type: 'text', content: '→' },
      { type: 'foldedPaper', layout: halfLayout, holes: [{ x: hx, y: hy }], label: '打洞' },
      { type: 'text', content: '展開?' }
    ],
    gap: 10
  };

  // 干擾選項 (4 個 flat foldedPaper,各種洞位置):
  //  Correct: 對的對稱 2 洞
  //  D1 (規則內錯位): 對稱軸錯 (用另一方向對稱)
  //  D2 (部分對): 對的位置但只 1 個洞 (沒對稱展開)
  //  D3 (跳出規則): 3 個洞 (多算了)
  const correctOpt = { type: 'foldedPaper', layout: 'flat', holes: correctHoles };

  const wrongAxisHoles = foldDir === 'horizontal'
    ? [{ x: hx, y: hy / 2 }, { x: 1 - hx, y: hy / 2 }]   // 錯成 vertical 對稱
    : [{ x: hx / 2, y: hy }, { x: hx / 2, y: 1 - hy }];   // 錯成 horizontal 對稱
  const D1 = { type: 'foldedPaper', layout: 'flat', holes: wrongAxisHoles };
  const D2 = { type: 'foldedPaper', layout: 'flat', holes: [correctHoles[0]] };
  const D3 = { type: 'foldedPaper', layout: 'flat', holes: [...correctHoles, { x: 0.5, y: 0.5 }] };

  const { options, answerIdx } = placeOptions(correctOpt, [D1, D2, D3], id);
  const optionsWithText = options.map((v, i) => ({
    text: `選項 ${'ABCD'[i]}`,   // 不顯示洞數 (避免送分)
    visual: v
  }));
  // 補正 text 描述 (text 是後加的,answer 已在 options 中,只是換 text)
  return makeQ(id, 'easy', 'paper-fold-once', 'spatial-paper-fold', '對摺打洞展開',
    visual, optionsWithText, answerIdx,
    `紙沿 ${foldDir === 'horizontal' ? '橫' : '直'} 摺線對摺後,在半張紙上打了 1 個洞。展開後對摺線兩側會各有 1 個洞 (鏡像對稱)。哪張紙是對的?`,
    `對摺後打 1 個洞,展開時兩層紙都會有洞,對稱在<strong>${foldDir === 'horizontal' ? '橫' : '直'}向對摺線</strong>兩側。所以展開後共 <strong>2 個洞</strong>,位置鏡像對稱。`
  );
}

// ─── 2. paper-fold-twice (4 mid) ──────────────────────────────────────
// 對摺兩次 (quarter) + 打洞 → 展開後 4 個對稱洞
function unfoldTwice(holeOnQuarter) {
  // quarter 在左上角 (x: 0-0.5, y: 0-0.5)
  // 展開後 4 對稱:(x, y), (1-x, y), (x, 1-y), (1-x, 1-y) where x = hx/2, y = hy/2
  // wait 不對。quarter 是紙摺成 1/4 後在 quarter 內 coord,展開要還原到 flat coord
  // 假設 quarter 是「先 horizontal 摺再 vertical 摺」結果,quarter 區域是左上 1/4
  // hole 在 quarter 上 (qx, qy) where 0 ≤ qx, qy ≤ 1 (相對 quarter)
  // 對應 flat 上的位置 = (qx/2, qy/2) 跟 3 個對稱: (1-qx/2, qy/2), (qx/2, 1-qy/2), (1-qx/2, 1-qy/2)
  const { x: qx, y: qy } = holeOnQuarter;
  const x1 = qx / 2, y1 = qy / 2;
  return [
    { x: x1,         y: y1         },
    { x: 1 - x1,     y: y1         },
    { x: x1,         y: 1 - y1     },
    { x: 1 - x1,     y: 1 - y1     }
  ];
}

function genPaperFoldTwice(id, configIdx) {
  // 4 種 hole 位置
  const CONFIGS = [
    { x: 0.3, y: 0.4 },
    { x: 0.5, y: 0.5 },
    { x: 0.4, y: 0.3 },
    { x: 0.6, y: 0.6 }
  ];
  const hole = CONFIGS[configIdx];
  const correctHoles = unfoldTwice(hole);

  const visual = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: 'flat', foldHint: ['horizontal', 'vertical'], label: '兩條摺線' },
      { type: 'text', content: '→' },
      { type: 'foldedPaper', layout: 'quarter', holes: [hole], label: '打洞' },
      { type: 'text', content: '展開?' }
    ],
    gap: 10
  };

  // 干擾:
  //  D1 (規則內錯位): 只展開 1 次 (2 洞而非 4)
  //  D2 (部分對): 4 洞但對稱錯 (例如全在同 1/4 內)
  //  D3 (跳出規則): 5+ 洞
  const correctOpt = { type: 'foldedPaper', layout: 'flat', holes: correctHoles };
  const D1 = { type: 'foldedPaper', layout: 'flat', holes: [correctHoles[0], correctHoles[1]] };
  const D2 = {
    type: 'foldedPaper', layout: 'flat',
    holes: [
      { x: hole.x / 2, y: hole.y / 2 },
      { x: hole.x / 2 + 0.1, y: hole.y / 2 + 0.1 },
      { x: hole.x / 2, y: hole.y / 2 + 0.2 },
      { x: hole.x / 2 + 0.2, y: hole.y / 2 }
    ]
  };
  const D3 = { type: 'foldedPaper', layout: 'flat', holes: [...correctHoles, { x: 0.5, y: 0.5 }] };

  const { options, answerIdx } = placeOptions(correctOpt, [D1, D2, D3], id);
  const optionsWithText = options.map((v, i) => ({
    text: `選項 ${'ABCD'[i]}`,   // 不顯示洞數 (避免送分)
    visual: v
  }));
  return makeQ(id, 'mid', 'paper-fold-twice', 'spatial-paper-fold', '兩次對摺打洞展開',
    visual, optionsWithText, answerIdx,
    `兩次對摺 (橫一次 + 直一次) 後紙變成原來的 1/4。在這 1/4 上打 1 個洞,展開後會有幾個洞?它們會怎麼分布?`,
    `兩次對摺後紙疊成 <strong>4 層</strong>,打 1 個洞穿透 4 層。展開後有 <strong>4 個對稱洞</strong>,分布在橫摺線跟直摺線各兩側 (4 個象限各 1 個)。`
  );
}

// ─── 3. cube-net-opposite (3 mid + 4 hard) ────────────────────────────
// 立方體 cross 展開圖:中間 4 個圍成側面,top/bottom 跟它們相鄰
// 相對面 pairs (cross layout): (top, bottom), (left, right), (front, back)
function genCubeNetOpposite(id, configIdx, difficulty) {
  // 7 個 face label/color 組合
  const COLOR_POOL = ['pink', 'teal', 'yellow', 'purple', 'orange', 'blue'];
  const SHUFFLES = [
    [0, 1, 2, 3, 4, 5],
    [1, 2, 3, 4, 5, 0],
    [2, 3, 4, 5, 0, 1],
    [3, 4, 5, 0, 1, 2],
    [4, 5, 0, 1, 2, 3],
    [5, 0, 1, 2, 3, 4],
    [0, 2, 4, 1, 3, 5]
  ];
  const shuffle = SHUFFLES[configIdx % SHUFFLES.length];
  const POSITIONS = ['top', 'front', 'right', 'back', 'left', 'bottom'];
  const faces = POSITIONS.map((pos, i) => ({
    position: pos,
    label: String(i + 1),
    color: COLOR_POOL[shuffle[i]]
  }));
  // 正解:top 跟 bottom 相對 (label 1 跟 6)
  // 但 face 排列是 top=1, front=2, right=3, back=4, left=5, bottom=6
  // 所以 top↔bottom 是 1↔6, front↔back 是 2↔4, left↔right 是 5↔3

  // cross layout 相對面只有 3 組:(top,bottom)=(1,6), (front,back)=(2,4), (left,right)=(3,5)
  // 隨機選一組當正解
  const OPPOSITE_PAIRS = [['1', '6'], ['2', '4'], ['3', '5']];
  const correctPair = OPPOSITE_PAIRS[configIdx % 3];
  const correctText = `${correctPair[0]} 號與 ${correctPair[1]} 號相對`;

  // 干擾池 (per reviewer 修正):
  // 用 12 組相鄰面當 distractor — 「X 號與 Y 號相對」但實際 X Y 相鄰才是合理錯答
  // 絕對不能用「其他 2 組相對」當 distractor (那 2 組陳述也是真的,造成多解)
  //
  // 立方體相鄰面:每個面有 4 個相鄰,12 組(unordered)
  //   top(1) 鄰 front(2)/right(3)/back(4)/left(5)
  //   bottom(6) 鄰 front(2)/right(3)/back(4)/left(5)
  //   front(2) 鄰 right(3)/left(5)
  //   back(4) 鄰 right(3)/left(5)
  const ADJACENT_PAIRS = [
    ['1', '2'], ['1', '3'], ['1', '4'], ['1', '5'],
    ['6', '2'], ['6', '3'], ['6', '4'], ['6', '5'],
    ['2', '3'], ['2', '5'],
    ['4', '3'], ['4', '5']
  ];
  // 從 12 組相鄰中抽 3 個當 distractor (seed-deterministic)
  const distractorSeed = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const pickedAdj = rngShuffle(makeRng(distractorSeed + 99), ADJACENT_PAIRS).slice(0, 3);

  const optTexts = [
    correctText,
    `${pickedAdj[0][0]} 號與 ${pickedAdj[0][1]} 號相對`,
    `${pickedAdj[1][0]} 號與 ${pickedAdj[1][1]} 號相對`,
    `${pickedAdj[2][0]} 號與 ${pickedAdj[2][1]} 號相對`
  ];
  const seed = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const shuffled = rngShuffle(makeRng(seed), optTexts);
  const answerIdx = shuffled.indexOf(correctText);

  // 給孩子的 explanation 解釋為何「correctPair 才是相對」+ 為何 distractor (相鄰) 不對
  const pairDesc = {
    '1,6': '頂面跟底面 (top-bottom)',
    '2,4': '前面跟後面 (front-back)',
    '3,5': '右面跟左面 (right-left)'
  }[correctPair.join(',')] || '相對面';

  return makeQ(id, difficulty, 'cube-net-opposite', 'spatial-cube-net', '立方體展開想像 (相對面)',
    { type: 'cubeNet', layout: 'cross', faces },
    shuffled.map(t => ({ text: t })),
    answerIdx,
    `cross 展開圖中,中間那排 (位置 left/front/right/back) 折起來變成<strong>四個側面</strong>。立方體只有<strong>3 組相對面</strong>:頂底、前後、左右。摺起來想想哪兩個 label 會剛好背對背?`,
    `cross 展開圖摺起來後,只有 <strong>3 組</strong>相對面:1-6 (頂底)、2-4 (前後)、3-5 (左右)。本題的正解是 <strong>${correctText}</strong> — 就是<strong>${pairDesc}</strong>那一組。其他三個選項裡的兩個 label 其實是<strong>相鄰</strong>而不是相對 (它們在立方體上共用一條摺邊)。`
  );
}

// ─── 4. cube-net-invalid (6 hard) ─────────────────────────────────────
// 5 種句型 rotate,#5 是「無法折成立方體」(在 invalid layout 題當正解)
// 6 題:3 invalid layout (raw SVG) + 3 valid layout (cubeNet structured)
// invalid layout 由 raw SVG 畫,例如 6 squares in a row, broken cross, etc.

function customCubeNetSvg(squares) {
  // squares: [{col, row, label, color}]
  const faceSize = 40;
  const INK = '#2D2A4A';
  const COLOR_MAP = { pink: '#FF6B9D', teal: '#4ECDC4', yellow: '#FFD93D', purple: '#9B7EDE', orange: '#FF9F45', blue: '#5B9DEC', white: '#FFFFFF' };
  const maxCol = Math.max(...squares.map(s => s.col));
  const maxRow = Math.max(...squares.map(s => s.row));
  const W = (maxCol + 1) * faceSize + 20;
  const H = (maxRow + 1) * faceSize + 20;
  const parts = squares.map(s => {
    const x = s.col * faceSize + 10;
    const y = s.row * faceSize + 10;
    const fill = COLOR_MAP[s.color] || '#FFFFFF';
    const textColor = (s.color === 'purple' || s.color === 'ink') ? 'white' : INK;
    return `<rect x="${x}" y="${y}" width="${faceSize}" height="${faceSize}" fill="${fill}" stroke="${INK}" stroke-width="2.5"/>` +
           `<text x="${x + faceSize/2}" y="${y + faceSize/2 + 6}" text-anchor="middle" font-size="18" font-weight="900" fill="${textColor}">${s.label}</text>`;
  }).join('');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
}

// 5 種句型 (per reviewer 拍板 Q2)
const STATEMENT_TYPES = {
  opposite:   (a, b) => `${a} 號與 ${b} 號是相對面`,
  adjacent:   (a, b) => `${a} 號與 ${b} 號在折成立方體後相鄰`,
  topBottom:  (a, b) => `折好後從上方看,${a} 在頂面,${b} 在底面`,
  shareFold:  (a, b) => `${a} 號與 ${b} 號共用同一條摺線`,
  invalid:    ()     => `這個展開圖無法折成立方體`
};

function genCubeNetInvalid(id, configIdx) {
  // 6 configs (3 invalid + 3 valid)
  const CONFIGS = [
    { invalid: true, layout: 'row-of-6' },
    { invalid: true, layout: 'L-broken' },
    { invalid: true, layout: 'T-broken' },
    { invalid: false, validPair: ['1', '6'] },   // top-bottom
    { invalid: false, validPair: ['2', '4'] },   // front-back
    { invalid: false, validPair: ['3', '5'] }    // left-right
  ];
  const cfg = CONFIGS[configIdx];

  let visual, correctStatement, distractors;

  if (cfg.invalid) {
    // invalid layout: 用 raw-html 畫
    let squares;
    if (cfg.layout === 'row-of-6') {
      squares = Array.from({ length: 6 }, (_, i) => ({ col: i, row: 0, label: String(i + 1), color: 'white' }));
    } else if (cfg.layout === 'L-broken') {
      // 4 in row + 2 stacked off the end (但位置怪)
      squares = [
        { col: 0, row: 0, label: '1', color: 'white' },
        { col: 1, row: 0, label: '2', color: 'white' },
        { col: 2, row: 0, label: '3', color: 'white' },
        { col: 3, row: 0, label: '4', color: 'white' },
        { col: 3, row: 1, label: '5', color: 'white' },
        { col: 3, row: 2, label: '6', color: 'white' }
      ];
    } else {
      // T-broken: 3 squares 一排,3 squares 另一排但錯位
      squares = [
        { col: 0, row: 0, label: '1', color: 'white' },
        { col: 1, row: 0, label: '2', color: 'white' },
        { col: 2, row: 0, label: '3', color: 'white' },
        { col: 0, row: 1, label: '4', color: 'white' },
        { col: 0, row: 2, label: '5', color: 'white' },
        { col: 0, row: 3, label: '6', color: 'white' }
      ];
    }
    visual = { type: 'raw-html', html: customCubeNetSvg(squares) };
    correctStatement = STATEMENT_TYPES.invalid();
    // 干擾:3 個錯誤陳述(對於這個 invalid layout 沒一個成立,但句型輪流抽)
    distractors = [
      STATEMENT_TYPES.opposite('1', '6'),
      STATEMENT_TYPES.adjacent('2', '3'),
      STATEMENT_TYPES.topBottom('1', '6')
    ];
  } else {
    // valid layout: cross,正解是 validPair 的「相對面」陳述
    const POSITIONS = ['top', 'front', 'right', 'back', 'left', 'bottom'];
    const faces = POSITIONS.map((pos, i) => ({ position: pos, label: String(i + 1), color: 'white' }));
    visual = { type: 'cubeNet', layout: 'cross', faces };
    const [a, b] = cfg.validPair;
    correctStatement = STATEMENT_TYPES.opposite(a, b);
    // 干擾混 5 句型 (扣掉用過的 opposite),包括 invalid 陷阱
    distractors = [
      STATEMENT_TYPES.invalid(),   // 陷阱:這個其實是 valid layout
      STATEMENT_TYPES.adjacent(a, b),
      STATEMENT_TYPES.topBottom('1', '2')  // 1 在頂面對,但 2 不是底面
    ];
  }

  const allOpts = [correctStatement, ...distractors];
  const seed = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 0);
  const shuffled = rngShuffle(makeRng(seed), allOpts);
  const answerIdx = shuffled.indexOf(correctStatement);

  return makeQ(id, 'hard', 'cube-net-invalid', 'spatial-cube-net-invalid', '立方體展開圖判斷',
    visual,
    shuffled.map(t => ({ text: t })),
    answerIdx,
    cfg.invalid
      ? `看這個展開圖的形狀,6 個方格的排列方式能不能折成立方體?有沒有相鄰但不該相鄰的方格?`
      : `cross 展開圖摺起來後,top-bottom / front-back / left-right 各組是相對的。仔細想想哪個陳述跟摺起來的事實一致。`,
    cfg.invalid
      ? `這個展開圖<strong>不能</strong>折成立方體 — 6 個方格的排列方式違反了 cube net 的拓樸結構。立方體的展開圖必須是 11 種特定 hexomino 之一,「${cfg.layout}」不在其中。所以正解是 <strong>${correctStatement}</strong>。`
      : `這是 cross 展開圖,合法。中間排 (2-3-4-5) 摺成側面,top (1) 跟 bottom (6) 為頂底面。本題 <strong>${cfg.validPair[0]} 跟 ${cfg.validPair[1]}</strong> 確實是相對面 (cross 的標準配對)。`
  );
}

// ─── 5. symmetry-fold (5 mid) ─────────────────────────────────────────
// 反向 paper-fold:給展開後的 hole 圖案,問原本怎麼折+打洞
// visual: 展開後的 flat foldedPaper (固定 hole pattern)
// options: 4 個 (foldDir + hole position) 配置,1 對 3 錯

function genSymmetryFold(id, configIdx) {
  // 5 configs,每個給一個展開後 holes pattern
  // 我們從 paper-fold-once 的展開結果取
  const CONFIGS = [
    { foldDir: 'horizontal', halfHole: { x: 0.3, y: 0.4 } },
    { foldDir: 'vertical',   halfHole: { x: 0.5, y: 0.35 } },
    { foldDir: 'horizontal', halfHole: { x: 0.5, y: 0.3 } },
    { foldDir: 'vertical',   halfHole: { x: 0.4, y: 0.6 } },
    { foldDir: 'horizontal', halfHole: { x: 0.7, y: 0.5 } }
  ];
  const cfg = CONFIGS[configIdx];
  const unfoldHoles = unfoldOnce(cfg.foldDir, cfg.halfHole);

  // visual: flat 加 unfoldHoles (給「展開後的結果」)
  const visual = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: 'flat', holes: unfoldHoles, label: '展開後' },
      { type: 'text', content: '← 原本怎麼折+打洞?' }
    ],
    gap: 10
  };

  // 選項:4 個 (foldDir + hole on half) 配置,1 對 3 錯
  const halfLayout = cfg.foldDir === 'horizontal' ? 'half-h' : 'half-v';
  const wrongLayout = cfg.foldDir === 'horizontal' ? 'half-v' : 'half-h';
  const wrongDir = cfg.foldDir === 'horizontal' ? 'vertical' : 'horizontal';

  // 設計 D1 (對的方向但 hole 位置錯):
  // ⚠️ v1 bug 教訓:不能用 (1-x, y) — 對 vertical fold 是物理等價 (half-v 視覺沒標 fold edge,
  //    半張紙可被解讀為「左半」或「右半」,half-v(0.4) 跟 half-v(0.6) 物理上 = 同個 fold)
  // 對 horizontal fold 也類似:half-h(x, y) ≡ half-h(x, 1-y) 物理等價
  // 所以 D1 必須改「不沿 fold 軸對稱的」位置:
  //   vertical fold → 換 y (沿 fold 軸方向換,不在等價軸上)
  //   horizontal fold → 換 x (沿 fold 軸方向換)
  let d1Hole;
  if (cfg.foldDir === 'horizontal') {
    // 橫摺 fold axis is x;ambiguity 在 y(top/bottom 解讀)。換 x 是安全的
    d1Hole = { x: cfg.halfHole.x > 0.5 ? cfg.halfHole.x - 0.3 : cfg.halfHole.x + 0.3, y: cfg.halfHole.y };
  } else {
    // 直摺 fold axis is y;ambiguity 在 x(left/right 解讀)。換 y 安全
    d1Hole = { x: cfg.halfHole.x, y: cfg.halfHole.y > 0.5 ? cfg.halfHole.y - 0.3 : cfg.halfHole.y + 0.3 };
  }

  const correctOpt = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: halfLayout, holes: [cfg.halfHole], label: cfg.foldDir === 'horizontal' ? '橫摺' : '直摺' }
    ]
  };
  const D1 = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: halfLayout, holes: [d1Hole], label: cfg.foldDir === 'horizontal' ? '橫摺' : '直摺' }
    ]
  };
  // D2: 錯的方向但 hole 位置對
  const D2 = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: wrongLayout, holes: [cfg.halfHole], label: wrongDir === 'horizontal' ? '橫摺' : '直摺' }
    ]
  };
  // D3: 全錯
  const D3 = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      { type: 'foldedPaper', layout: wrongLayout, holes: [{ x: 0.5, y: 0.5 }], label: wrongDir === 'horizontal' ? '橫摺' : '直摺' }
    ]
  };

  // 用 placeOptions 確保 4 unique (lesson from PR #5 — 之前 bypass 這個 assertion 造成 mid-031/032 出 B==C)
  const { options: shuffled, answerIdx } = placeOptions(correctOpt, [D1, D2, D3], id);

  return makeQ(id, 'mid', 'symmetry-fold', 'spatial-symmetry-fold', '對稱折紙還原',
    visual,
    shuffled.map((v, i) => ({ text: `選項 ${'ABCD'[i]}`, visual: v })),
    answerIdx,
    `展開後有 2 個洞,它們是怎麼對稱的?橫的對稱(上下鏡像)還是直的對稱(左右鏡像)?從這個提示判斷原本怎麼折。`,
    `展開後 2 個洞如果是<strong>${cfg.foldDir === 'horizontal' ? '上下鏡像' : '左右鏡像'}</strong>,代表原本沿<strong>${cfg.foldDir === 'horizontal' ? '橫向' : '直向'}</strong>對摺。摺起來後紙是 ${cfg.foldDir === 'horizontal' ? '上下對齊' : '左右對齊'},打 1 個洞穿透 2 層,展開就還原成 2 個對稱洞。`
  );
}

// ─── 6. mirror-arrow (3 mid + 2 hard) ─────────────────────────────────
// sub_type 統一 'mirror-arrow',visual 加 mirrorAxis 欄位 (per Q3)
//
// ⚠️ v2 fix:之前 horizontal/vertical 兩個公式整個 swap,
// 造成全部 5 題答案標錯軸。reviewer 試玩 mid-037 + hard-028 抓到。
//
// 物理推導 (rotation = CW from up):
//   North 分量 = cos(θ), East 分量 = sin(θ)
//
// horizontal axis mirror (上下翻 = 翻 Y 分量 = 翻 North 分量):
//   cos(θ') = -cos(θ) → θ' = 180° - θ
//   0° (↑) ↔ 180° (↓);  45° (↗) ↔ 135° (↘);  90° (→) 不變;  225° (↙) ↔ 315° (↖)
//
// vertical axis mirror (左右翻 = 翻 X 分量 = 翻 East 分量):
//   sin(θ') = -sin(θ) → θ' = -θ = 360° - θ
//   0° (↑) 不變;  45° (↗) ↔ 315° (↖);  90° (→) ↔ 270° (←);  135° (↘) ↔ 225° (↙)

function mirrorRotation(rotation, axis) {
  if (axis === 'horizontal') {
    // 上下翻: 翻 Y 分量, θ' = 180 - θ
    return (180 - rotation + 360) % 360;
  } else {
    // 左右翻: 翻 X 分量, θ' = 360 - θ
    return (360 - rotation) % 360;
  }
}

function genMirrorArrow(id, difficulty, configIdx) {
  // 5 configs (mid 用 horizontal,hard 用 vertical)
  const CONFIGS = [
    // mid (axis = horizontal)
    { axis: 'horizontal', rotation: 45 },
    { axis: 'horizontal', rotation: 135 },
    { axis: 'horizontal', rotation: 225 },
    // hard (axis = vertical)
    { axis: 'vertical', rotation: 45 },
    { axis: 'vertical', rotation: 90 }
  ];
  const cfg = CONFIGS[configIdx];
  const color = ['pink', 'teal', 'yellow', 'purple', 'orange'][configIdx];
  const original = { type: 'single-shape', shape: 'arrow', rotation: cfg.rotation, color };
  // 加 mirrorAxis (per Q3 review,純 metadata,non-display)
  original.mirrorAxis = cfg.axis;

  // visual: composite 原始箭頭 + 對稱軸提示
  const visual = {
    type: 'composite',
    arrangement: 'horizontal',
    items: [
      original,
      { type: 'text', content: cfg.axis === 'horizontal' ? '──(上下翻)──→' : '│(左右翻)│→' }
    ],
    gap: 12
  };

  const correctMirror = mirrorRotation(cfg.rotation, cfg.axis);
  const correctOpt = { type: 'single-shape', shape: 'arrow', rotation: correctMirror, color };

  // v2 fix:distractor 選 3 個跟 correctMirror 跟 cfg.rotation 都不一樣的角度
  // 之前 D2/D3 偶爾撞 (e.g. mid-037 因為 (135+90)%360 = 225 = cfg.rotation)
  // 改成 candidate priority list:wrong-axis-mirror > original > +90 > +180 > 其他
  const wrongMirror = mirrorRotation(cfg.rotation, cfg.axis === 'horizontal' ? 'vertical' : 'horizontal');
  const candidates = [
    wrongMirror,                              // 規則內錯位:用錯軸鏡像 (canonical misconception)
    cfg.rotation,                             // 部分對:沒做鏡像 (kid 忘了翻)
    (correctMirror + 90) % 360,
    (correctMirror + 180) % 360,
    (correctMirror + 45) % 360,
    (correctMirror + 135) % 360,
    (correctMirror + 270) % 360,
    (correctMirror + 225) % 360,
    (correctMirror + 315) % 360
  ];
  const seen = new Set([correctMirror]);
  const distractorRots = [];
  for (const r of candidates) {
    if (distractorRots.length >= 3) break;
    if (!seen.has(r)) { distractorRots.push(r); seen.add(r); }
  }
  if (distractorRots.length < 3) {
    throw new Error(`genMirrorArrow ${id}: only ${distractorRots.length} unique distractors`);
  }
  const D1 = { type: 'single-shape', shape: 'arrow', rotation: distractorRots[0], color };
  const D2 = { type: 'single-shape', shape: 'arrow', rotation: distractorRots[1], color };
  const D3 = { type: 'single-shape', shape: 'arrow', rotation: distractorRots[2], color };

  // 用 placeOptions assertion 保險 (lesson 已內化:不再 inline shuffle bypass)
  const { options: shuffled, answerIdx } = placeOptions(correctOpt, [D1, D2, D3], id);

  const dirText = { 0: '↑', 45: '↗', 90: '→', 135: '↘', 180: '↓', 225: '↙', 270: '←', 315: '↖' };
  return makeQ(id, difficulty, 'mirror-arrow', 'spatial-mirror', '箭頭鏡像',
    visual,
    shuffled.map(o => ({ text: dirText[o.rotation] || `${o.rotation}°`, visual: o })),
    answerIdx,
    `${cfg.axis === 'horizontal' ? '上下翻 (沿橫軸鏡射)' : '左右翻 (沿直軸鏡射)'}。原箭頭指 ${dirText[cfg.rotation]}。鏡像後指?`,
    `${cfg.axis === 'horizontal' ? '上下翻 (橫軸鏡射): 上下顛倒,左右不變。公式 θ′ = 180° − θ' : '左右翻 (直軸鏡射): 左右顛倒,上下不變。公式 θ′ = 360° − θ'}。原本 ${cfg.rotation}° (${dirText[cfg.rotation]}) → 鏡射後 <strong>${correctMirror}°</strong> (${dirText[correctMirror]})。`
  );
}

// ─── 主流程 ────────────────────────────────────────────────────────────

const startCounter = { easy: 23, mid: 23, hard: 18 };
const buckets = { easy: [], mid: [], hard: [] };

async function main() {
  // easy: paper-fold-once 4
  for (let k = 0; k < 4; k++) {
    const id = `spatial-easy-${String(startCounter.easy++).padStart(3, '0')}`;
    buckets.easy.push(genPaperFoldOnce(id, k));
  }
  // mid: paper-fold-twice 4 + cube-net-opposite 3 + symmetry-fold 5 + mirror 3
  for (let k = 0; k < 4; k++) {
    const id = `spatial-mid-${String(startCounter.mid++).padStart(3, '0')}`;
    buckets.mid.push(genPaperFoldTwice(id, k));
  }
  for (let k = 0; k < 3; k++) {
    const id = `spatial-mid-${String(startCounter.mid++).padStart(3, '0')}`;
    buckets.mid.push(genCubeNetOpposite(id, k, 'mid'));
  }
  for (let k = 0; k < 5; k++) {
    const id = `spatial-mid-${String(startCounter.mid++).padStart(3, '0')}`;
    buckets.mid.push(genSymmetryFold(id, k));
  }
  for (let k = 0; k < 3; k++) {
    const id = `spatial-mid-${String(startCounter.mid++).padStart(3, '0')}`;
    buckets.mid.push(genMirrorArrow(id, 'mid', k));
  }
  // hard: cube-net-opposite 4 + cube-net-invalid 6 + mirror 2
  for (let k = 0; k < 4; k++) {
    const id = `spatial-hard-${String(startCounter.hard++).padStart(3, '0')}`;
    buckets.hard.push(genCubeNetOpposite(id, k + 3, 'hard'));   // +3 to use diff configs from mid
  }
  for (let k = 0; k < 6; k++) {
    const id = `spatial-hard-${String(startCounter.hard++).padStart(3, '0')}`;
    buckets.hard.push(genCubeNetInvalid(id, k));
  }
  for (let k = 0; k < 2; k++) {
    const id = `spatial-hard-${String(startCounter.hard++).padStart(3, '0')}`;
    buckets.hard.push(genMirrorArrow(id, 'hard', k + 3));   // configs 3, 4 (vertical)
  }

  let failed = 0;
  for (const diff of ['easy', 'mid', 'hard']) {
    for (const q of buckets[diff]) {
      const res = validateQuestion(q);
      if (!res.valid) {
        console.error(`❌ ${q.id}: ${res.errors.join('; ')}`);
        failed += 1;
      }
    }
  }
  if (failed > 0) {
    console.error(`\n[gen-spatial-supp] ${failed} failed. Aborting.`);
    process.exit(1);
  }

  for (const q of buckets.easy) await writeQuestion(`questions/spatial/easy/${q.id}.json`, q);
  for (const q of buckets.mid)  await writeQuestion(`questions/spatial/mid/${q.id}.json`, q);
  for (const q of buckets.hard) await writeQuestion(`questions/spatial/hard/${q.id}.json`, q);

  console.log(`[gen-spatial-supp] easy=${buckets.easy.length}, mid=${buckets.mid.length}, hard=${buckets.hard.length}, total=${buckets.easy.length + buckets.mid.length + buckets.hard.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
