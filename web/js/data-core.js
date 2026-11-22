/* 自动生成，勿手改。源文件：小程序 data/{scales,axis1,rules}.js；重新生成：node web/sync-data.js */
(function () {
  var reg = {};
  function req(name) {
    var k = String(name).replace(/^\.\//, '');
    if (!reg[k]) throw new Error('data module not loaded: ' + k);
    return reg[k].exports;
  }
  function def(name, fn) { var m = { exports: {} }; fn(m, m.exports, req); reg[name] = m; }
def('scales', function (module, exports, require) {
// A 线研究任务使用的正式量表。
// 只有单独同意参加 A 线研究后才出现；公众流程不展示、不自动并入分析。
// 所有条目均标注来源与审核状态，reviewStatus = 'pending' 表示需专业审核后才可用于正式采集。

const LIKERT_4 = [
  { label: '根本没有', value: 0 },
  { label: '有几天', value: 1 },
  { label: '一半以上的时间', value: 2 },
  { label: '几乎每天', value: 3 },
];

// OBC 21 项：前两题问的是睡觉时的情况，锚点按「晚」计；其余按白天频率计。
// 两套锚点都与原量表逐字一致，不要在题目之间混用。
const OBC_SLEEP = [
  { label: '从来没有', value: 0 },
  { label: '每月<1晚', value: 1 },
  { label: '每月1-3晚', value: 2 },
  { label: '每周1-3晚', value: 3 },
  { label: '每周4-7晚', value: 4 },
];

const OBC_DAY = [
  { label: '从来没有', value: 0 },
  { label: '很少', value: 1 },
  { label: '有时', value: 2 },
  { label: '大部分时间', value: 3 },
  { label: '总是', value: 4 },
];

const NRS_LEVELS = [
  { min: 0, max: 0, label: '无痛', tone: 'calm' },
  { min: 1, max: 3, label: '轻度', tone: 'calm' },
  { min: 4, max: 6, label: '中度', tone: 'caution' },
  { min: 7, max: 10, label: '重度', tone: 'danger' },
];

/* ---------------- 版本档案 ----------------
 * OBC 换过版本：旧版 12 项（0–48），现行 21 项（0–84）。
 * 题目数、总分、阈值都不同，两组分数不能放一起算，也不能互相套阈值。
 * 每条结果都把 version / item_count / score_max 一起存下来，分析时按版本分层。
 */

const OBC_FULL = 'OBC-21 完整版';
const OBC_BRIEF = '简版 12 项';

const VERSION_PROFILES = {
  obc: {
    [OBC_FULL]: {
      version: OBC_FULL,
      itemCount: 21,
      max: 84,
      bands: [
        { max: 16, label: '低' },
        { max: 24, label: '偏高' },
        { max: 84, label: '高' },
      ],
      deprecated: false,
      note: '21 项合计 0–84 分。分级阈值用于内部比较，不作为诊断依据。',
    },
    [OBC_BRIEF]: {
      version: OBC_BRIEF,
      itemCount: 12,
      max: 48,
      // 旧版当时没有定分级，这里不拿新阈值反套旧分数
      bands: null,
      deprecated: true,
      note: '旧版 12 项，满分 48。与现行 21 项（满分 84）题目数和总分都不同，分数不可直接比较，也不套用现行分级。',
    },
  },
};

const SCALES = {
  gad7: {
    id: 'gad7',
    name: 'GAD-7 广泛性焦虑量表',
    short: 'GAD-7',
    version: '2013-05-12 中文版',
    instruction: '过去 2 周内，下列问题是如何困扰你的？',
    options: LIKERT_4,
    items: [
      '感到紧张、焦虑或不安',
      '无法停止或控制的忧虑',
      '对各种事情过于担心',
      '很难放松',
      '过于焦躁不安，以致难以平静地坐着',
      '容易恼怒或被激惹',
      '害怕会发生不好的事情',
    ],
    extra: {
      type: 'single',
      question: '如果你对以上任一问题打钩，该问题对你完成工作、照料家事或与他人相处造成了多大困难？',
      options: ['一点也不困难', '有点困难', '非常困难', '极度困难'],
    },
    scoring: {
      min: 0,
      max: 21,
      bands: [
        { max: 4, label: '无明显焦虑症状' },
        { max: 9, label: '轻度' },
        { max: 14, label: '中度' },
        { max: 21, label: '重度' },
      ],
      note: '总分用来分级、和前后对比，不用来下诊断。',
    },
    source: 'Spitzer RL, et al. Arch Intern Med. 2006;166(10):1092-1097；DC/TMD 量表集（2013-05-12 版）。',
    reviewStatus: 'pending',
  },

  nrs: {
    id: 'nrs',
    name: '疼痛数字评定量表',
    short: 'NRS',
    version: 'NRS 0–10',
    instruction: '请选择最能代表您此刻疼痛程度的数字。0 为无痛，10 为能想象的最剧烈疼痛。',
    type: 'scale-10',
    levels: NRS_LEVELS,
    scoring: {
      min: 0,
      max: 10,
      note: '0 不疼；1–3 轻度；4–6 中度；7–10 重度。',
    },
    source: '疼痛评估量表应用的中国专家共识（2020 版），附录 4：NRS 0～10 版。',
    reviewStatus: 'approved',
  },

  phq4: {
    id: 'phq4',
    name: 'PHQ-4 四条目情绪筛查',
    short: 'PHQ-4',
    version: 'PHQ-4',
    instruction: '过去 2 周内，下列问题是如何困扰你的？',
    options: LIKERT_4,
    items: [
      '感到紧张、焦虑或不安',
      '无法停止或控制的忧虑',
      '做事没有兴趣或愉悦感',
      '感觉低落、郁闷或没有希望',
    ],
    scoring: {
      min: 0,
      max: 12,
      bands: [
        { max: 2, label: '无明显困扰' },
        { max: 5, label: '轻度' },
        { max: 8, label: '中度' },
        { max: 12, label: '重度' },
      ],
      note: '前两题看情绪低落（0–6 分），后两题看紧张担忧（0–6 分）。哪一组到 3 分以上，就该再细评一次。',
    },
    source: 'Kroenke K, et al. Psychother Psychosom. 2009；中国人群纵向测量不变性研究（PHQ-4 中文版）。',
    reviewStatus: 'pending',
  },

  obc: {
    id: 'obc',
    name: '口腔行为清单',
    short: 'OBC',
    version: OBC_FULL,
    instruction: '在最近 1 个月内，你进行下列活动有多频繁？如果活动的频率不同，选择较高的选项。',
    options: OBC_DAY,
    // 按题切换锚点：sleep 用于前两题（以「晚」为单位），day 用于其余 19 题
    itemOptions: { sleep: OBC_SLEEP, day: OBC_DAY },
    items: [
      { text: '就你所知，在睡觉时咬牙或磨牙', night: true },
      { text: '睡姿会压迫下颌（如俯卧或侧卧）', night: true },
      { text: '醒着时磨牙' },
      { text: '醒着时紧咬牙' },
      { text: '在不进食的时候，会挤压、碰触或将牙齿合在一起（即上下颌牙齿接触）' },
      { text: '在没有紧咬或将上下牙合在一起时，固定、变紧或绷紧肌肉' },
      { text: '将下颌向前或向一侧伸出或停留' },
      { text: '用舌头用力顶牙齿' },
      { text: '把舌头放在牙齿之间' },
      { text: '啃咬、咀嚼或玩弄舌头、颊或嘴唇' },
      { text: '把下颌保持在僵硬或紧张的姿势，如撑住或护住下颌' },
      { text: '用牙齿含住或咬住物品，如头发、烟斗、铅笔、钢笔、手指、手指甲等' },
      { text: '嚼口香糖' },
      { text: '演奏需要用嘴或下颌的乐器（如木管乐器、铜管乐器、弦乐器）' },
      { text: '用手倚住下颌，如用手托住或撑住下巴' },
      { text: '只用一侧咀嚼食物' },
      { text: '在三餐之间进食（指食用需要咀嚼的食物）' },
      { text: '持续说话（如讲课、销售、客服）' },
      { text: '唱歌' },
      { text: '打呵欠' },
      { text: '把电话放在头和肩膀之间' },
    ],
    scoring: {
      min: 0,
      max: 84,
      bands: [
        { max: 16, label: '低' },
        { max: 24, label: '偏高' },
        { max: 84, label: '高' },
      ],
      note: '21 项合计 0–84 分，分数越高，说明这些动作出现得越频繁。分级阈值用于内部比较，不作为诊断依据。旧版 12 项（0–48）的分数不能和这里比。',
    },
    source: 'Oral Behaviours Checklist（OBC，21 项）；DC/TMD Axis II 评估工具集中文版；中国 TMD 患者 OBC 因子分析（Front Neurol 2023）。',
    reviewStatus: 'pending',
  },

  jfls8: {
    id: 'jfls8',
    name: '下颌功能受限量表（8 项）',
    short: 'JFLS-8',
    version: 'JFLS-8',
    instruction: '请指出以下各项活动在过去一个月内的受限程度。如果因过于困难而完全不做该项活动，请选择 10；如果是出于疼痛或困难以外的其他原因而不做该项活动，该项请勿勾选。',
    type: 'grid-10',
    items: [
      '嚼韧性食物',
      '嚼鸡肉（如用炉子烤的）',
      '食用不需要咀嚼的柔软食物（如土豆泥、苹果酱、布丁、糊状食物）',
      '嘴张大到可以用茶杯喝水',
      '吞咽',
      '打哈欠',
      '说话',
      '微笑',
    ],
    scoring: {
      min: 0,
      max: 10,
      note: '取 8 项的平均分（0–10）。分数越高，说明动作受限制越明显。',
    },
    source: 'Jaw Functional Limitation Scale-8/20（DC/TMD Axis II 工具集）。',
    reviewStatus: 'pending',
  },

  dctmd_sq: {
    id: 'dctmd_sq',
    name: 'DC/TMD 症状问卷（自报部分）',
    short: 'DC/TMD SQ',
    version: '中文版结构',
    instruction: '请按过去 30 天的实际情况回答。本问卷只是症状登记，不能替代临床检查。',
    type: 'structured',
    groups: [
      {
        key: 'pain_sites',
        question: '过去 30 天内，以下区域是否出现过疼痛？',
        type: 'multi',
        options: ['右侧颞部', '左侧颞部', '右耳前', '左耳前', '右耳内', '左耳内', '右侧下颌', '左侧下颌'],
      },
      {
        key: 'pain_duration',
        question: '这种疼痛持续了多久？',
        type: 'single',
        options: ['不足 1 个月', '1–3 个月', '3–6 个月', '6 个月以上'],
      },
      {
        key: 'pain_aggravate',
        question: '以下动作是否会让疼痛加重？（可多选）',
        type: 'multi',
        options: ['张口', '咀嚼', '咬紧', '说话', '打哈欠', '无明显诱因'],
      },
      {
        key: 'joint_noise',
        question: '过去 30 天内，张口或咀嚼时是否听到或感觉到关节弹响、摩擦音？',
        type: 'single',
        options: ['没有', '有，仅弹响', '有，摩擦音或碎裂音', '不确定'],
      },
      {
        key: 'locking',
        question: '是否出现下颌卡住、闭不上或张不开的情况？',
        type: 'single',
        options: ['没有', '有，但能自行恢复', '有，需要动作才能恢复', '有，当前仍受限'],
      },
      {
        key: 'headache',
        question: '过去 30 天内，颞部区域是否出现过头痛？',
        type: 'single',
        options: ['没有', '有', '不确定'],
      },
    ],
    scoring: null,
    source: 'DC/TMD 症状问卷（Schiffman E, et al. J Oral Facial Pain Headache. 2014）；中文版 Axis I 检查者间信度研究（CRANIO 2023）。',
    reviewStatus: 'pending',
    caveat: '本页仅采集自报症状。原始 DC/TMD 中文评估工具文件在本机无法完整解析，条目文本须与官方中文版逐条核对后才能用于正式研究采集。',
  },
};

const VISIT_PLAN = [
  { id: 'T0', label: 'T0 基线', timing: '入组时', items: ['GAD-7', 'PHQ-4', 'OBC', 'JFLS-8', 'NRS', 'DC/TMD 症状问卷', 'DC/TMD Axis I 临床检查', '数字面弓（符合条件者）'] },
  { id: 'T1', label: 'T1 第 6 周', timing: '约 6 周', items: ['NRS', '症状变化核查', '课程完成情况'] },
  { id: 'T2', label: 'T2 第 12 周', timing: '约 12 周', items: ['GAD-7', 'PHQ-4', 'OBC', 'JFLS-8', 'NRS', '功能影响'] },
  { id: 'T3', label: 'T3 第 6 个月', timing: '约 6 个月', items: ['GAD-7', 'PHQ-4', 'OBC', 'JFLS-8', 'NRS', '新发疼痛症状筛查'] },
];

/* ---------------- 版本与分级 ---------------- */

// 取某个量表的现行版本号
function currentVersion(scaleId) {
  const s = SCALES[scaleId];
  return s ? s.version : '';
}

// 取某个版本的能力档案：题目数、满分、分级阈值
// version 为空时按现行版本处理，并在 fromLegacy 里标出来，方便调用方提示
function profileOf(scaleId, version) {
  const s = SCALES[scaleId];
  const table = VERSION_PROFILES[scaleId];
  const v = version || currentVersion(scaleId);

  if (table && table[v]) {
    return Object.assign({ source: 'declared' }, table[v]);
  }

  // 没有登记的版本：不假装它是现行版本，也不拿现行阈值去套
  const itemCount = s && s.items ? s.items.length : null;
  const max = s && s.scoring ? s.scoring.max : null;
  const hasVersions = !!table;
  return {
    version: v,
    itemCount: itemCount,
    max: max,
    bands: hasVersions ? null : (s && s.scoring ? s.scoring.bands : null) || null,
    deprecated: hasVersions && v !== currentVersion(scaleId),
    unknown: hasVersions,
    source: 'fallback',
    note: hasVersions ? '这个版本没有登记，分级与计分口径需要人工确认。' : '',
  };
}

// 按版本分级：旧版本没有阈值就返回空，绝不用新阈值套旧分数
function bandOf(scaleId, score, version) {
  const p = profileOf(scaleId, version);
  if (!p || !p.bands) return '';
  const bands = p.bands;
  for (let i = 0; i < bands.length; i += 1) {
    if (score <= bands[i].max) return bands[i].label;
  }
  return bands[bands.length - 1].label;
}

// 现行版本的分级（老调用保持可用）
function band(scaleId, score) {
  return bandOf(scaleId, score, currentVersion(scaleId));
}

function nrsLevel(score) {
  const n = Number(score);
  for (let i = 0; i < NRS_LEVELS.length; i += 1) {
    if (n >= NRS_LEVELS[i].min && n <= NRS_LEVELS[i].max) return NRS_LEVELS[i];
  }
  return NRS_LEVELS[0];
}

module.exports = {
  SCALES,
  VISIT_PLAN,
  band,
  bandOf,
  profileOf,
  currentVersion,
  VERSION_PROFILES,
  OBC_FULL,
  OBC_BRIEF,
  nrsLevel,
  NRS_LEVELS,
};

});
def('axis1', function (module, exports, require) {
// DC/TMD Axis I 结构化记录（医师面诊录入）
//
// 设计原则（改之前先读）：
// 1) 这里只记录「查到了什么」——部位、毫米数、有无杂音，不写诊断结论。
//    诊断是医师的事，系统只负责把随诊信息整理成可复核的结构。
// 2) 每个字段都有稳定的 key。报告上每条提示都要能指回它的 fieldKey，
//    这样医师点开提示能看到「是哪一项、什么数值触发的」。这是可溯源的基础。
// 3) 新增字段只往后加，不要改已有 key —— 旧记录里存的是 key，改名会读不出来。

const AXIS1_VERSION = 'AxisI-1.0';

// 触诊部位。左右分开记，因为单侧与双侧的处理路径不同。
const SITES = [
  { key: 'temple_r', label: '右侧颞部' },
  { key: 'temple_l', label: '左侧颞部' },
  { key: 'masseter_r', label: '右侧咬肌' },
  { key: 'masseter_l', label: '左侧咬肌' },
  { key: 'pretragus_r', label: '右耳前' },
  { key: 'pretragus_l', label: '左耳前' },
  { key: 'joint_r', label: '右关节区' },
  { key: 'joint_l', label: '左关节区' },
];

// 关节区部位（用于判定「关节源性」倾向）
const JOINT_KEYS = ['pretragus_r', 'pretragus_l', 'joint_r', 'joint_l'];
// 肌肉部位（用于判定「肌源性」倾向）
const MUSCLE_KEYS = ['temple_r', 'temple_l', 'masseter_r', 'masseter_l'];

const SECTIONS = [
  {
    key: 'palpation',
    title: '触诊',
    hint: '按到的疼，是不是患者平时说的那处疼',
    items: [
      {
        key: 'palpation_sites',
        type: 'sites',
        label: '熟悉性疼痛部位',
        options: SITES,
        hint: '可多选。只勾患者认作「就是这里」的部位，单纯压痛不算',
      },
      {
        key: 'familiar_reproduce',
        type: 'single',
        label: '检查是否再现主诉疼痛',
        options: [
          { v: 'yes', l: '再现' },
          { v: 'partial', l: '部分再现' },
          { v: 'no', l: '未再现' },
        ],
      },
    ],
  },
  {
    key: 'rom',
    title: '下颌运动',
    hint: '单位毫米，量上下切缘间距',
    items: [
      { key: 'mio', type: 'number', label: '最大主动张口', unit: 'mm', min: 0, max: 80 },
      { key: 'pio', type: 'number', label: '最大被动张口', unit: 'mm', min: 0, max: 80 },
      {
        key: 'open_pain',
        type: 'single',
        label: '张口时再现熟悉疼痛',
        options: [
          { v: 'yes', l: '是' },
          { v: 'no', l: '否' },
        ],
      },
      { key: 'lateral_r', type: 'number', label: '右侧方运动', unit: 'mm', min: 0, max: 20 },
      { key: 'lateral_l', type: 'number', label: '左侧方运动', unit: 'mm', min: 0, max: 20 },
      { key: 'protrusion', type: 'number', label: '前伸运动', unit: 'mm', min: 0, max: 20 },
    ],
  },
  {
    key: 'noise',
    title: '关节杂音',
    hint: '开闭口时触诊加听诊',
    items: [
      {
        key: 'noise_r',
        type: 'single',
        label: '右侧',
        options: [
          { v: 'none', l: '无' },
          { v: 'click', l: '弹响' },
          { v: 'crepitus', l: '摩擦音' },
        ],
      },
      {
        key: 'noise_l',
        type: 'single',
        label: '左侧',
        options: [
          { v: 'none', l: '无' },
          { v: 'click', l: '弹响' },
          { v: 'crepitus', l: '摩擦音' },
        ],
      },
    ],
  },
  {
    key: 'locking',
    title: '锁结',
    items: [
      {
        key: 'locking',
        type: 'single',
        label: '本次检查',
        options: [
          { v: 'none', l: '无' },
          { v: 'closed', l: '闭锁（张不开）' },
          { v: 'open', l: '开锁（闭不上）' },
        ],
      },
      {
        key: 'locking_freq',
        type: 'single',
        label: '近一个月发生次数',
        options: [
          { v: '0', l: '没有' },
          { v: '1', l: '1–2 次' },
          { v: '3', l: '3 次以上' },
        ],
      },
    ],
  },
  {
    key: 'imaging',
    title: '影像与补充',
    items: [
      {
        key: 'imaging',
        type: 'single',
        label: '影像',
        options: [
          { v: 'none', l: '未做' },
          { v: 'cbct', l: 'CBCT' },
          { v: 'mri', l: 'MRI' },
        ],
      },
      {
        key: 'imaging_note',
        type: 'text',
        label: '影像结论',
        placeholder: '如：双侧关节盘前移位，右侧不可复',
      },
      {
        key: 'axis1_note',
        type: 'text',
        label: '医师补充',
        placeholder: '选填',
      },
    ],
  },
];

// 必填项：缺这些，Axis I 就算「未完成」，报告状态只能是「待补录」
const REQUIRED = ['palpation_sites', 'familiar_reproduce', 'mio', 'pio', 'noise_r', 'noise_l', 'locking'];

function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Axis I 是否录完。返回 { complete, missing: [itemKey] }
function completeness(a) {
  const src = a || {};
  const missing = REQUIRED.filter(function (k) {
    return isBlank(src[k]);
  });
  return { complete: missing.length === 0, missing: missing };
}

// 把 Axis I 的原始值整理成「提示」列表。
// 注意：这些是体征层面的观察，不是诊断。报告上必须原样带这句限定。
function derive(a) {
  const src = a || {};
  const out = [];

  function push(key, text, fieldKey, level) {
    out.push({ key: key, text: text, fieldKey: fieldKey, level: level || 'note' });
  }

  // 'none' 是「明确触过、没有熟悉性疼痛部位」的显式标记。
  // 空数组表示「还没查」，两者临床上完全不同，不能混为一谈——
  // 所以 completeness() 把 [] 当作缺项，把 ['none'] 当作已完成。
  const rawSites = Array.isArray(src.palpation_sites) ? src.palpation_sites : [];
  const sites = rawSites.filter(function (k) {
    return k !== 'none';
  });
  const muscleHit = MUSCLE_KEYS.filter(function (k) {
    return sites.indexOf(k) >= 0;
  });
  const jointHit = JOINT_KEYS.filter(function (k) {
    return sites.indexOf(k) >= 0;
  });

  if (muscleHit.length) {
    push('palp_muscle', '触诊在咀嚼肌区再现熟悉疼痛（' + muscleHit.length + ' 处）', 'palpation_sites', 'caution');
  }
  if (jointHit.length) {
    push('palp_joint', '触诊在关节区再现熟悉疼痛（' + jointHit.length + ' 处）', 'palpation_sites', 'caution');
  }
  if (rawSites.length && sites.length === 0) {
    push('palp_none', '未触到熟悉性疼痛部位', 'palpation_sites', 'note');
  }

  if (typeof src.mio === 'number' && src.mio < 40) {
    push('mio_low', '最大主动张口 ' + src.mio + ' mm，低于 40 mm', 'mio', 'alert');
  }
  if (typeof src.mio === 'number' && typeof src.pio === 'number' && src.pio - src.mio >= 5) {
    push(
      'passive_gap',
      '被动张口比主动多 ' + (src.pio - src.mio) + ' mm，提示限制可能来自肌肉而非关节',
      'pio',
      'caution'
    );
  }

  const noiseR = src.noise_r;
  const noiseL = src.noise_l;
  if (noiseR === 'crepitus' || noiseL === 'crepitus') {
    push('crepitus', '关节区闻及摩擦音，提示关节面退行性改变可能', 'noise_r', 'caution');
  }
  if (noiseR === 'click' || noiseL === 'click') {
    push('click', '开闭口可闻及弹响', 'noise_r', 'note');
  }

  if (src.locking === 'closed') {
    push('locked_closed', '检查时呈闭锁（张不开）', 'locking', 'alert');
  }
  if (src.locking === 'open') {
    push('locked_open', '检查时呈开锁（闭不上），需当次处理', 'locking', 'alert');
  }
  if (src.locking === 'none' && src.locking_freq && src.locking_freq !== '0') {
    push('locking_history', '本次未锁结，但近一个月有发生（' + (src.locking_freq === '1' ? '1–2 次' : '3 次以上') + '）', 'locking_freq', 'caution');
  }

  return out;
}

// 给报告用的一行摘要：优先说最要紧的一条，没有就说「未见明显体征记录」
function headline(a) {
  const list = derive(a);
  const rank = { alert: 3, caution: 2, note: 1 };
  let best = null;
  list.forEach(function (h) {
    if (!best || (rank[h.level] || 0) > (rank[best.level] || 0)) best = h;
  });
  return best ? best.text : '未见明显阳性体征记录';
}

module.exports = {
  AXIS1_VERSION,
  SITES,
  SECTIONS,
  REQUIRED,
  JOINT_KEYS,
  MUSCLE_KEYS,
  completeness,
  derive,
  headline,
  isBlank,
};

});
def('rules', function (module, exports, require) {
// 四类复核状态判定
//
// 状态只有四个，含义是「医师下一步该做什么」，不是病情轻重：
//   待补录 pending_input   —— 面诊信息还没录，报告不成立
//   需补充评估 need_more   —— 有缺项或前后不一致，先补再判
//   优先人工复核 priority  —— 命中风险信号，这个病例先看
//   常规记录 routine       —— 没命中任何信号，按常规流程走
//
// 重要（对外必须一致说）：
//   「优先人工复核」只表示病例复核的先后顺序，**不代表患病概率**，也不是诊断分级。
//   这一句在报告页、项目介绍页、README 里都必须原样出现。
//
// 每条命中都带 ruleId / ruleVersion / threshold / sourceItems，
// 报告上点开一条提示，就能看到「哪张量表、哪个字段、卡在什么阈值」。

const scales = require('./scales');
const axis1 = require('./axis1');

const RULE_VERSION = 'rules-1.0';

const STATES = {
  routine: {
    key: 'routine',
    label: '常规记录',
    tone: 'calm',
    action: '按常规流程处理',
    severity: 0,
  },
  pending_input: {
    key: 'pending_input',
    label: '待补录',
    tone: 'note',
    action: '先完成 Axis I 结构化记录',
    severity: 1,
  },
  need_more: {
    key: 'need_more',
    label: '需补充评估',
    tone: 'caution',
    action: '补齐缺项或澄清不一致后再判',
    severity: 2,
  },
  priority: {
    key: 'priority',
    label: '优先人工复核',
    tone: 'alert',
    action: '优先复核，确认是否需要转诊',
    severity: 3,
  },
};

const STATE_ORDER = ['priority', 'need_more', 'pending_input', 'routine'];

// 阈值集中在这里，改阈值只改这一处，报告上的说明会跟着变
const THRESHOLDS = {
  obc: 24, // OBC-21（0–84）> 24 记为「高」
  gad7: 10, // GAD-7（0–21）≥ 10
  phq4: 6, // PHQ-4（0–12）≥ 6
  jfls8: 5, // JFLS-8 均分（0–10）≥ 5
  nrs: 7, // NRS（0–10）≥ 7
  mio: 40, // 最大主动张口 < 40 mm
  passiveGap: 5, // 被动 − 主动 ≥ 5 mm
};

function num(v) {
  return typeof v === 'number' && !isNaN(v) ? v : null;
}

function push(list, ruleId, state, title, detail, threshold, sourceItems, level) {
  list.push({
    ruleId: ruleId,
    ruleVersion: RULE_VERSION,
    state: state,
    title: title,
    detail: detail,
    threshold: threshold,
    sourceItems: sourceItems || [],
    level: level || STATES[state].tone,
  });
}

/**
 * input:
 *   axis2: { obc:{score,version}, gad7:{score}, phq4:{score}, jfls8:{score}, nrs:{score} }
 *   missing: ['obc', ...]   // Axis II 里缺填的量表
 *   axis1: { ... }          // Axis I 原始记录
 */
function evaluate(input) {
  const src = input || {};
  const a2 = src.axis2 || {};
  const a1 = src.axis1 || {};
  const hits = [];

  /* ---------- Axis II ---------- */

  const obc = a2.obc || {};
  const obcScore = num(obc.score);
  if (obcScore !== null) {
    const profile = scales.profileOf('obc', obc.version);
    const band = scales.bandOf('obc', obcScore, obc.version);
    if (!band) {
      // 旧版 12 项或未登记版本：绝不跨版本套阈值
      push(
        hits,
        'R-AX2-OBC-VER',
        'need_more',
        'OBC 版本无法分级',
        '这条结果来自「' + (obc.version || '未标注版本') + '」，与现行的 OBC-21（0–84）不是同一套口径，需要重填后才能判读。',
        '版本须为 ' + scales.OBC_FULL,
        ['obc']
      );
    } else if (obcScore > THRESHOLDS.obc) {
      push(
        hits,
        'R-AX2-OBC',
        'priority',
        '口腔行为清单偏高',
        'OBC ' + obcScore + '/84，处于「' + band + '」档。提示存在较频繁的口腔不良行为，需在面诊时确认并给出针对性建议。',
        'OBC-21 > ' + THRESHOLDS.obc,
        ['obc']
      );
    }
  }

  const gad = a2.gad7 || {};
  const gadScore = num(gad.score);
  if (gadScore !== null && gadScore >= THRESHOLDS.gad7) {
    push(
      hits,
      'R-AX2-GAD7',
      'priority',
      '焦虑评分达到中度以上',
      'GAD-7 ' + gadScore + '/21。情绪因素可能参与疼痛维持，建议面诊时关注，必要时转心理支持。',
      'GAD-7 ≥ ' + THRESHOLDS.gad7,
      ['gad7']
    );
  }

  const phq = a2.phq4 || {};
  const phqScore = num(phq.score);
  if (phqScore !== null && phqScore >= THRESHOLDS.phq4) {
    push(
      hits,
      'R-AX2-PHQ4',
      'priority',
      '情绪筛查达到中度以上',
      'PHQ-4 ' + phqScore + '/12。抑郁与焦虑症状同时存在，建议纳入复核。',
      'PHQ-4 ≥ ' + THRESHOLDS.phq4,
      ['phq4']
    );
  }

  const jfls = a2.jfls8 || {};
  const jflsScore = num(jfls.score);
  if (jflsScore !== null && jflsScore >= THRESHOLDS.jfls8) {
    push(
      hits,
      'R-AX2-JFLS8',
      'priority',
      '下颌功能受限明显',
      'JFLS-8 均分 ' + jflsScore.toFixed(1) + '/10。日常咀嚼、张口等活动受影响较大。',
      'JFLS-8 ≥ ' + THRESHOLDS.jfls8,
      ['jfls8']
    );
  }

  const nrs = a2.nrs || {};
  const nrsScore = num(nrs.score);
  if (nrsScore !== null && nrsScore >= THRESHOLDS.nrs) {
    push(
      hits,
      'R-AX2-NRS',
      'priority',
      '疼痛强度偏高',
      'NRS ' + nrsScore + '/10。',
      'NRS ≥ ' + THRESHOLDS.nrs,
      ['nrs']
    );
  }

  const missing = Array.isArray(src.missing) ? src.missing : [];
  if (missing.length) {
    push(
      hits,
      'R-AX2-MISSING',
      'need_more',
      'Axis II 有未完成项',
      '缺 ' + missing.length + ' 项：' + missing.join('、') + '。缺项会让判定失去依据。',
      '必需量表全部完成',
      missing
    );
    // 有缺项时，上面的高分判定仍保留，但整体状态至少是「需补充评估」
  }

  // 四张量表一个数都没有：这不是「都正常」，是「还没做」。
  // 少了这一条，患者没自评的病例会被判成「常规记录」，等于把缺项当成了阴性。
  const anyAxis2 = ['obc', 'gad7', 'phq4', 'jfls8'].some(function (k) {
    const v = a2[k] || {};
    return num(v.score) !== null;
  });
  if (!anyAxis2) {
    push(
      hits,
      'R-AX2-EMPTY',
      'need_more',
      '尚未完成 Axis II 自评',
      '四张量表都没有读到分数，本次无法按双轴判读。请患者先完成自评，或由医师补录后再出报告。',
      '至少完成一张量表',
      ['axis2']
    );
  }

  /* ---------- Axis I ---------- */

  const comp = axis1.completeness(a1);
  if (!comp.complete) {
    push(
      hits,
      'R-AX1-MISSING',
      'pending_input',
      'Axis I 尚未录入完成',
      '缺 ' + comp.missing.length + ' 项关键体征：' + comp.missing.join('、') + '。报告在此之前不成立。',
      'Axis I 必填项全部录入',
      comp.missing
    );
  }

  const mio = num(a1.mio);
  if (mio !== null && mio < THRESHOLDS.mio) {
    push(
      hits,
      'R-AX1-MIO',
      'priority',
      '最大主动张口受限',
      '主动张口 ' + mio + ' mm，低于 ' + THRESHOLDS.mio + ' mm。需确认是关节源性还是肌源性限制。',
      'MIO < ' + THRESHOLDS.mio + ' mm',
      ['mio']
    );
  }

  const pio = num(a1.pio);
  if (mio !== null && pio !== null && pio - mio >= THRESHOLDS.passiveGap) {
    push(
      hits,
      'R-AX1-PASSIVE',
      'need_more',
      '主动与被动张口差距明显',
      '被动 ' + pio + ' mm、主动 ' + mio + ' mm，差 ' + (pio - mio) + ' mm。提示限制可能来自肌肉，需结合触诊确认。',
      '被动 − 主动 ≥ ' + THRESHOLDS.passiveGap + ' mm',
      ['mio', 'pio']
    );
  }

  if (a1.locking === 'closed' || a1.locking === 'open') {
    push(
      hits,
      'R-AX1-LOCK',
      'priority',
      '检查时存在锁结',
      a1.locking === 'closed' ? '呈闭锁（张不开），需当次处理。' : '呈开锁（闭不上），需当次复位处理。',
      'locking ∈ {closed, open}',
      ['locking']
    );
  }

  if (a1.noise_r === 'crepitus' || a1.noise_l === 'crepitus') {
    push(
      hits,
      'R-AX1-CREPITUS',
      'need_more',
      '关节区摩擦音',
      '提示关节面退行性改变可能，建议结合影像确认。',
      'crepitus 出现于任一侧',
      ['noise_r', 'noise_l']
    );
  }

  // 前后不一致：自报与检查对不上，是最需要澄清的一类
  const reportPain = num(a2.nrs ? a2.nrs.score : null);
  const familiar = a1.familiar_reproduce;
  if (reportPain !== null && reportPain <= 2 && familiar === 'yes') {
    push(
      hits,
      'R-XCHECK-LOWHIGH',
      'need_more',
      '自报疼痛轻，但检查再现了熟悉疼痛',
      '自评 NRS ' + reportPain + '/10，面诊触诊却再现主诉疼痛。需确认评估时点与用药情况。',
      'NRS ≤ 2 且 familiar_reproduce = yes',
      ['nrs', 'familiar_reproduce']
    );
  }
  if (reportPain !== null && reportPain >= THRESHOLDS.nrs && familiar === 'no') {
    push(
      hits,
      'R-XCHECK-HIGHLOW',
      'need_more',
      '自报疼痛重，但检查未再现',
      '自评 NRS ' + reportPain + '/10，面诊未再现熟悉疼痛。需确认部位描述是否一致。',
      'NRS ≥ ' + THRESHOLDS.nrs + ' 且 familiar_reproduce = no',
      ['nrs', 'familiar_reproduce']
    );
  }

  /* ---------- 取最高级别作为主状态 ---------- */

  let state = STATES.routine;
  hits.forEach(function (h) {
    const s = STATES[h.state];
    if (s && s.severity > state.severity) state = s;
  });

  // 同级别内按 STATE_ORDER 稳定排序，报告上先看最要紧的
  hits.sort(function (x, y) {
    const d = STATES[y.state].severity - STATES[x.state].severity;
    if (d !== 0) return d;
    return STATE_ORDER.indexOf(x.state) - STATE_ORDER.indexOf(y.state);
  });

  return {
    ruleVersion: RULE_VERSION,
    state: state,
    hits: hits,
    axis1Complete: comp.complete,
    axis1Missing: comp.missing,
    summary: state.label + '：' + (hits.length ? hits[0].title : '未命中风险信号'),
  };
}

// 给列表/首页用的一行
function digest(result) {
  if (!result) return '';
  return result.state ? result.state.label : '';
}

module.exports = {
  RULE_VERSION,
  STATES,
  THRESHOLDS,
  evaluate,
  digest,
};

});
  window.HEXIN_DATA = {
    scales: reg.scales.exports,
    axis1: reg.axis1.exports,
    rules: reg.rules.exports
  };
})();
