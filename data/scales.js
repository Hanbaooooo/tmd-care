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
