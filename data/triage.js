// 公众版简短症状梳理：只用于整理症状与就诊信息，不做诊断，不输出分型。
// 安全核对单独成组，先于其他问题出现。

const RED_FLAGS = [
  { key: 'swelling', label: '面部或颈部明显肿胀，或局部发热发红' },
  { key: 'dislocation', label: '张口后闭不上，或明显错位' },
  { key: 'trauma', label: '近期有面部外伤、跌倒或拔牙后疼痛突然加重' },
  { key: 'infection', label: '耳内流液、持续高热，或吞咽、呼吸困难' },
  { key: 'neuro', label: '面部麻木、视力改变、说话不清' },
  { key: 'weight', label: '因为疼痛几乎无法进食，体重明显下降' },
];

const STEPS = [
  {
    key: 'sites',
    title: '不适主要在哪些位置？',
    hint: '可以多选，按你实际的感受选。',
    type: 'multi',
    options: [
      { value: 'temple', label: '太阳穴附近' },
      { value: 'ear', label: '耳前或耳内' },
      { value: 'cheek', label: '面颊部' },
      { value: 'jaw', label: '下颌角或下颌体' },
      { value: 'muscle', label: '咀嚼肌（咬东西时酸）' },
      { value: 'joint', label: '关节本身（张口时有响声或卡）' },
    ],
  },
  {
    key: 'duration',
    title: '这个不适持续多久了？',
    hint: '从第一次出现算起。',
    type: 'single',
    options: [
      { value: 'lt1m', label: '不到 1 个月' },
      { value: '1to3m', label: '1–3 个月' },
      { value: '3to6m', label: '3–6 个月' },
      { value: 'gt6m', label: '6 个月以上' },
    ],
  },
  {
    key: 'aggravate',
    title: '什么情况下会更明显？',
    hint: '可以多选。',
    type: 'multi',
    options: [
      { value: 'chew', label: '咀嚼或咬硬的食物' },
      { value: 'open', label: '张大口、打哈欠' },
      { value: 'clench', label: '紧张或专注时' },
      { value: 'morning', label: '早上起床时' },
      { value: 'stress', label: '压力大或睡不好时' },
      { value: 'none', label: '没有明显规律' },
    ],
  },
  {
    key: 'noise',
    title: '张口或咀嚼时有响声吗？',
    hint: '响声本身不一定代表严重问题，但需要记录。',
    type: 'single',
    options: [
      { value: 'none', label: '没有' },
      { value: 'click', label: '有「咔哒」样弹响' },
      { value: 'crepitus', label: '有摩擦音或碎裂音' },
      { value: 'unsure', label: '不太确定' },
    ],
  },
  {
    key: 'opening',
    title: '张口有没有受限或卡住？',
    hint: '以能否正常进食、说话为参照。',
    type: 'single',
    options: [
      { value: 'normal', label: '正常' },
      { value: 'slight', label: '略受限，但不影响吃饭' },
      { value: 'limited', label: '明显受限，吃硬的东西困难' },
      { value: 'locked', label: '卡住过，或现在张不开' },
    ],
  },
  {
    key: 'burden',
    title: '最近两周，这个不适对生活的影响有多大？',
    hint: '0 为没有影响，10 为完全无法正常生活。',
    type: 'scale',
    min: 0,
    max: 10,
  },
];

// 分诊：只给出「下一步做什么」，不给出诊断名称。
function evaluate(answers, redFlags) {
  const flags = redFlags || [];
  const reasons = [];
  let level = 'self';

  if (flags.length > 0) {
    level = 'urgent';
    reasons.push('你勾的这几项，得尽快让医生看，别先在家观察。');
  }

  const a = answers || {};

  if (level !== 'urgent') {
    if (a.opening === 'locked') {
      level = 'clinic';
      reasons.push('卡住过、或者张不开，得医生查过才知道原因。');
    } else if (a.opening === 'limited') {
      level = 'clinic';
      reasons.push('嘴明显张不大，去口腔科或颞下颌关节专科评一次。');
    }
    if (a.duration === 'gt6m') {
      level = 'clinic';
      reasons.push('不舒服超过半年了，该做一次系统评估，别继续自己看着。');
    }
    if (a.noise === 'crepitus') {
      if (level === 'self') level = 'clinic';
      reasons.push('有摩擦声或碎渣声，得医生听听是从哪来的。');
    }
    if (typeof a.burden === 'number' && a.burden >= 7) {
      if (level === 'self') level = 'clinic';
      reasons.push('已经挺影响生活了，让医生一起看看。');
    }
  }

  const map = {
    urgent: {
      headline: '建议尽快就医',
      actions: [
        '肿、发烫、外伤后突然更疼、张嘴合不上，只要中一条，直接去急诊或口腔急诊。',
        '去医院前别自己使劲掰，也别反复试能张多大。',
        '把这份给医生看，能省不少问诊时间。',
      ],
    },
    clinic: {
      headline: '建议安排一次专科评估',
      actions: [
        '挂号选口腔科、口腔颌面外科，或者颞下颌关节专科。',
        '带上这份摘要，位置、多久了、什么情况更重，都写清了。',
        '等号的这段时间，可以先用六周课程里的放松练习缓一缓。',
      ],
    },
    self: {
      headline: '可以先从自我管理开始',
      actions: [
        '从六周计划第 1 周开始，先做身体扫描，加上「牙齿分开」的提醒。',
        '每天记一次疼痛分数，两周后回看。',
        '两周还没起色，或者嘴张不开、肿起来，就去挂号。',
      ],
    },
  };

  return {
    level,
    headline: map[level].headline,
    actions: map[level].actions,
    reasons,
    redFlags: flags,
  };
}

// 首页/记录页的就诊提示：只看最近记录，不做趋势推断。
function careHint(records) {
  if (!records || records.length === 0) {
    return {
      tone: 'info',
      text: '还没记录。先记一次，以后才有得比。',
    };
  }
  const latest = records[0];
  const nrs = Number(latest.pain_nrs);
  if (!isNaN(nrs) && nrs >= 7) {
    return {
      tone: 'caution',
      text: '最近一次分数偏高。连着两天都这样，联系医生，别光靠练习硬撑。',
    };
  }
  if (records.length < 3) {
    return {
      tone: 'info',
      text: '记录还太少，看不出变化。连着记一周再看。',
    };
  }
  return {
    tone: 'info',
    text: '照现在的节奏记就行。要看变化，至少得连着两周。',
  };
}

// 就医指征分两级：急诊与门诊。八条平铺会读成清单轰炸，患者记不住哪条最要紧
const WHEN_TO_SEE = [
  {
    key: 'emergency',
    title: '今天就急诊',
    hint: '这几条不用观察，直接去口腔急诊或综合急诊。',
    items: [
      '面部或颈部明显肿胀、发热发红',
      '张口后闭不上，或明显错位',
      '耳内流液、持续高热、吞咽或呼吸困难',
      '面部麻木、视力改变、说话不清',
    ],
  },
  {
    key: 'clinic',
    title: '这几天看门诊',
    hint: '不用挂急诊，但别拖过两周。',
    items: [
      '面部外伤、跌倒、拔牙后疼痛突然加重',
      '因为疼痛几乎无法进食，体重明显下降',
      '张口明显受限并持续加重',
      '自我管理两周以上没有任何改善',
    ],
  },
];

const WHEN_TO_SEE_DOCTOR = WHEN_TO_SEE.reduce((acc, g) => acc.concat(g.items), []);

module.exports = { RED_FLAGS, STEPS, evaluate, careHint, WHEN_TO_SEE, WHEN_TO_SEE_DOCTOR };
