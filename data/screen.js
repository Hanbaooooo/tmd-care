// 双轴筛查：DC/TMD Axis I（躯体/功能）与 Axis II（心理/行为）的自报入口。
// 设计原则：
// 1) 只做「症状群归类 + 构念评分」，不输出诊断名、不输出概率、不给人格标签。
// 2) 每条判断都能回指到用户自己的回答，用户看得见依据。
// 3) Axis I 一律标注「需临床检查确认」；Axis II 一律标注「自报筛查，非正式量表」。

const { RED_FLAGS } = require('./triage');

const FORM_VERSION = 'screen-1.0';

const LIKERT4 = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
];

const FREQ4 = [
  { value: 0, label: '从不' },
  { value: 1, label: '偶尔' },
  { value: 2, label: '经常' },
  { value: 3, label: '几乎每天' },
];

const STEPS = [
  {
    key: 'safety',
    type: 'flags',
    title: '先确认这几种情况',
    hint: '这几项决定你现在该不该先去医院，而不是先做自我管理。都没有就继续。',
  },
  {
    key: 'complaint',
    type: 'questions',
    title: '现在最困扰你的是什么',
    hint: '可多选。选完之后，后面的问题会只问相关的部分，通常 6–9 题就够。',
    questions: [
      {
        key: 'complaint',
        type: 'multi',
        title: '选一个或多个',
        options: [
          { value: 'pain', label: '脸、太阳穴或耳前会痛' },
          { value: 'noise', label: '张闭口有响声' },
          { value: 'stiff', label: '脸酸、发紧，或张口不顺畅' },
          { value: 'unsure', label: '说不清，就是不舒服' },
        ],
      },
    ],
  },
  {
    key: 'pain',
    type: 'questions',
    when: function (a) {
      return has(a.complaint, 'pain') || has(a.complaint, 'stiff') || has(a.complaint, 'unsure');
    },
    title: '疼痛在哪里、什么情况下出现',
    hint: '按最近两周的实际情况选。',
    questions: [
      {
        key: 'sites',
        type: 'multi',
        title: '不适主要在哪些位置？',
        hint: '可多选。左右不用区分，先看区域。',
        options: [
          { value: 'temple', label: '太阳穴' },
          { value: 'preEar', label: '耳前' },
          { value: 'inEar', label: '耳内' },
          { value: 'jawAngle', label: '下颌角' },
          { value: 'masseter', label: '咬东西时脸颊酸' },
          { value: 'unclear', label: '说不清具体位置' },
        ],
      },
      {
        key: 'provoked',
        type: 'single',
        title: '咀嚼、张口或咬紧时，疼痛会改变吗？',
        hint: '这是区分「关节/肌肉性疼痛」与其它疼痛最关键的一问。',
        options: [
          { value: 'yes', label: '会，动下颌时更明显' },
          { value: 'no', label: '不会，和动作无关' },
          { value: 'unsure', label: '没注意过' },
        ],
      },
      {
        key: 'duration',
        type: 'single',
        title: '这个不适持续多久了？',
        options: [
          { value: 'lt1m', label: '不到 1 个月' },
          { value: '1to3m', label: '1–3 个月' },
          { value: '3to6m', label: '3–6 个月' },
          { value: 'gt6m', label: '6 个月以上' },
        ],
      },
      {
        key: 'trauma',
        type: 'single',
        title: '近 3 个月有没有面部外伤、跌倒或拔牙？',
        options: [
          { value: 'no', label: '没有' },
          { value: 'yes', label: '有' },
        ],
      },
    ],
  },
  {
    key: 'joint',
    type: 'questions',
    when: function (a) {
      return (
        has(a.complaint, 'noise') ||
        has(a.complaint, 'pain') ||
        has(a.complaint, 'stiff') ||
        has(a.complaint, 'unsure')
      );
    },
    title: '关节和张口的情况',
    hint: '响声本身不一定代表严重问题，但会影响该先做什么。',
    questions: [
      {
        key: 'noise',
        type: 'single',
        title: '张口或咀嚼时有响声吗？',
        options: [
          { value: 'none', label: '没有' },
          { value: 'click', label: '有「咔哒」样弹响' },
          { value: 'crepitus', label: '有摩擦音或碎裂音' },
          { value: 'unsure', label: '不太确定' },
        ],
      },
      {
        key: 'opening',
        type: 'single',
        title: '张口有没有受限或卡住？',
        options: [
          { value: 'normal', label: '正常' },
          { value: 'slight', label: '略受限，但不影响吃饭' },
          { value: 'limited', label: '明显受限，吃硬的困难' },
          { value: 'locked', label: '卡住过，或现在张不开' },
        ],
      },
      {
        key: 'headache',
        type: 'single',
        title: '过去 30 天，太阳穴一带痛过吗？',
        options: [
          { value: 'none', label: '没有' },
          { value: 'withChew', label: '有，而且咀嚼时加重' },
          { value: 'other', label: '有，但和咀嚼无关' },
          { value: 'unsure', label: '不确定' },
        ],
      },
      {
        key: 'referred',
        type: 'single',
        title: '不适会连到脖子或肩膀吗？',
        hint: '颈部同时有症状时，恢复往往需要更长时间，值得让医生知道。',
        options: [
          { value: 'no', label: '不会' },
          { value: 'yes', label: '会' },
        ],
      },
    ],
  },
  {
    key: 'impact',
    type: 'questions',
    title: '对生活的影响',
    hint: '这一屏问两件事：疼起来有多耽误生活，以及睡得怎么样。',
    questions: [
      {
        key: 'interference',
        type: 'scale',
        title: '过去两周，疼痛多大程度上干扰了你的日常活动？',
        hint: '0 完全没有影响，10 完全无法正常生活。',
        max: 10,
      },
      {
        key: 'sleep',
        type: 'single',
        title: '过去一周，你的睡眠质量如何？',
        options: [
          { value: 5, label: '很好' },
          { value: 4, label: '还可以' },
          { value: 3, label: '一般' },
          { value: 2, label: '比较差' },
          { value: 1, label: '很差' },
        ],
      },
      {
        key: 'nrs',
        type: 'scale',
        title: '过去两周，疼痛平均是几分？',
        hint: '0 无痛，10 能想象的最剧烈疼痛。',
        max: 10,
      },
    ],
  },
];

/* ---------------- 分支：按首屏选择决定后面问什么 ---------------- */

function buildSteps(answers) {
  const a = answers || {};
  return STEPS.filter(function (s) {
    if (typeof s.when !== 'function') return true;
    try {
      return !!s.when(a);
    } catch (err) {
      return true;
    }
  });
}

// 改了首屏选择之后，已经不相关的答案要清掉，避免用旧答案出结果
function pruneAnswers(answers, steps) {
  const a = answers || {};
  const keep = {};
  steps.forEach(function (s) {
    keep[s.key] = true;
    (s.questions || []).forEach(function (q) {
      keep[q.key] = true;
    });
  });
  const out = { redFlags: a.redFlags || [] };
  Object.keys(a).forEach(function (k) {
    if (k === 'redFlags') return;
    if (keep[k]) out[k] = a[k];
  });
  return out;
}

/* ---------------- 计分 ---------------- */

function sum(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce(function (acc, v) {
    const n = Number(v);
    return acc + (isNaN(n) ? 0 : n);
  }, 0);
}

function bandOf(value) {
  if (value < 34) return { key: 'low', label: '不高', tone: 'calm' };
  if (value < 67) return { key: 'mid', label: '中等', tone: 'caution' };
  return { key: 'high', label: '偏高', tone: 'attention' };
}

function has(arr, v) {
  return Array.isArray(arr) && arr.indexOf(v) >= 0;
}

/* ---------------- Axis I ---------------- */

function buildAxis1(a) {
  const sites = a.sites || [];
  const muscleSite = has(sites, 'temple') || has(sites, 'masseter') || has(sites, 'jawAngle');
  const jointSite = has(sites, 'preEar') || has(sites, 'inEar');
  const provoked = a.provoked === 'yes';
  const noise = a.noise || 'none';
  const opening = a.opening || 'normal';
  const chronic = a.duration === 'gt6m';

  const groups = [];

  if (provoked && (muscleSite || (!jointSite && sites.length > 0))) {
    groups.push({
      id: 'myalgia',
      label: '肌肉性疼痛',
      plain: '疼的位置在咀嚼肌或太阳穴一带，吃硬东西、咬紧牙时会跟着变。这是肌肉来源的疼痛最常见的样子。',
      basis: ['疼在太阳穴、面颊或下颌角一带', '动下颌时疼痛会跟着变'],
      needs: ['医生按一按咀嚼肌，看哪里压痛、范围多大', '分清是局部肌肉痛，还是更大范围的痛'],
    });
  }

  // 有摩擦音时，即便不适位置不在耳前，也属于关节面改变要提示的情况
  if (
    noise === 'click' ||
    noise === 'crepitus' ||
    opening === 'limited' ||
    opening === 'locked' ||
    jointSite
  ) {
    const parts = [];
    if (noise === 'click') parts.push('张闭口有弹响');
    if (noise === 'crepitus') parts.push('有摩擦音');
    if (opening === 'limited' || opening === 'locked') parts.push('张口受限或卡住');
    if (jointSite) parts.push('不适在耳前或耳内');
    if (opening === 'locked') {
      groups.push({
        id: 'locking',
        label: '张口受限或卡住',
        plain: '有过张不开、或者张到一半卡住的情况。这种要先让医生查清楚是关节还是肌肉卡住，比先做练习更要紧。',
        basis: parts,
        needs: ['量一下最大张口度，看看张嘴的轨迹', '确认是不是关节盘移位后回不去'],
      });
    } else {
      groups.push({
        id: 'intra',
        label: noise === 'crepitus' ? '关节面磨损' : '关节盘移位',
        plain:
          noise === 'crepitus'
            ? '有摩擦音或碎裂音，通常说明关节面已经有些改变。得靠拍片或专科检查确认，光靠练习判断不了。'
            : '耳前不舒服、张闭口还有弹响，多半是关节盘的位置变了。有响声不代表病得重，但要医生确认是哪一种。',
        basis: parts,
        needs: ['医生听关节声音是什么样、什么时候出现', '必要时拍片看关节盘的位置'],
      });
    }
  }

  if (a.headache === 'withChew') {
    groups.push({
      id: 'headache',
      label: '咀嚼引起的头痛',
      plain: '太阳穴一带头痛，而且咀嚼时更明显。这类要先和偏头痛、紧张性头痛分开。',
      basis: ['太阳穴一带头痛', '咀嚼时更明显'],
      needs: ['和偏头痛、紧张性头痛区分开', '记一记头痛和动下颌在时间上对不对得上'],
    });
  }

  let primary = null;
  let secondary = [];
  if (groups.length === 1) {
    primary = groups[0];
  } else if (groups.length > 1) {
    primary = {
      id: 'mixed',
      label: '几种情况混在一起',
      plain:
        '你的回答同时指向' +
        groups.map(function (g) { return '「' + g.label + '」'; }).join('与') +
        '。混在一起很常见，先管哪一块，得医生看完检查结果再定。',
      basis: groups.reduce(function (acc, g) { return acc.concat(g.basis.slice(0, 1)); }, []),
      needs: ['医生查清主要来源，再决定先管肌肉还是关节'],
    };
    secondary = groups;
  }

  const findings = [];
  if (chronic) findings.push('不适已经超过半年，该做一次系统评估，别继续自己观察。');
  if (a.trauma === 'yes') findings.push('近 3 个月有过外伤或拔牙，要先排除结构上的问题。');
  if (a.referred === 'yes') findings.push('不适连到脖子和肩膀。脖子也有症状时，恢复通常更慢。');
  if (a.headache === 'other') findings.push('有头痛，但不随咀嚼变，大概率和下颌没关系。');

  return {
    primary: primary,
    secondary: secondary,
    groups: groups,
    findings: findings,
  };
}

/* ---------------- Axis II ---------------- */

const DIM_META = {
  distress: {
    label: '情绪负担',
    construct: '情绪困扰（参照 PHQ-4）',
    low: '情绪上的负担不突出。',
    high: '情绪负担偏重的时候，肌肉更难放松，不适也更容易被注意到。',
    action: '先做第 1 周的 3 分钟身体扫描，第 3 周的想法重评对你最相关。',
  },
  worry: {
    label: '对症状的在意',
    construct: '对症状的在意程度',
    low: '对症状的在意还在可控范围。',
    high: '注意力容易一直停在不适上，越盯越明显。',
    action: '第 3 周「把想法放远一点」的练习，专门处理这一类担忧。',
  },
  interference: {
    label: '疼痛对生活的影响',
    construct: '疼痛对生活的影响（0–10）',
    low: '疼痛对日常活动影响不大。',
    high: '疼起来明显耽误事。重点不是忍，而是把活动量和节奏拆细。',
    action: '第 4 周的行为实验适合你：范围小、时间短、有可观察结果。',
  },
  habit: {
    label: '口腔习惯',
    construct: '口腔习惯（参照 OBC）',
    low: '白天牙齿咬紧、磨牙这类动作不多。',
    high: '白天牙齿总碰在一起、不自觉咬紧。这一类最容易在两周内改掉。',
    action: '第 2 周的觉察记录是起点，配合每天 3 次随机提醒。',
  },
  nrs: {
    label: '疼痛强度',
    construct: '平均疼痛（0–10 分）',
    low: '平均疼痛在中等以下，先把记录做起来。',
    high: '平均疼痛偏高，这类情况先调整活动节奏，不要硬扛。',
    action: '第 1 周先建立每日数字记录，第 4 周再谈活动量。',
  },
  sleep: {
    label: '睡眠不足',
    construct: '睡眠质量（1–5 分）',
    low: '睡眠不是当前的主要负担。',
    high: '睡不好和疼痛会互相拖。先把入睡这一段稳住，比加练管用。',
    action: '第 5 周的腹式呼吸与渐进放松放在睡前做。',
  },
};

function buildAxis2(a) {
  // 临床页只做「症状 + 功能」：心理与行为量表已独立到 pages/psych，
  // 所以这里按「有哪些作答」动态建维度，缺项不补零。
  const raw = [];

  if (a.interference !== undefined) {
    const v = Number(a.interference) || 0;
    raw.push({
      key: 'interference',
      value: Math.round((v / 10) * 100),
      detail: '干扰 ' + v + '/10',
    });
  }
  if (a.sleep !== undefined) {
    const sleep = Number(a.sleep) || 3;
    raw.push({
      key: 'sleep',
      value: Math.round(((5 - sleep) / 4) * 100),
      detail: '睡眠自评 ' + sleep + '/5',
    });
  }
  if (a.nrs !== undefined) {
    const nrs = Number(a.nrs) || 0;
    raw.push({
      key: 'nrs',
      value: Math.round((nrs / 10) * 100),
      detail: '疼痛 ' + nrs + '/10',
    });
  }

  const dims = raw.map(function (d) {
    const meta = DIM_META[d.key] || DIM_META.interference;
    const band = bandOf(d.value);
    return {
      key: d.key,
      label: meta.label,
      construct: meta.construct,
      value: d.value,
      detail: d.detail,
      band: band.label,
      tone: band.tone,
      text: d.value >= 67 ? meta.high : meta.low,
      action: meta.action,
    };
  });

  const sorted = dims.slice().sort(function (x, y) {
    return y.value - x.value;
  });
  const top = sorted[0];
  const dominant = top && top.value >= 40 ? top : null;

  const notes = [];
  const byKey = {};
  dims.forEach(function (d) {
    byKey[d.key] = d;
  });
  if (byKey.interference && byKey.sleep && byKey.interference.value >= 67 && byKey.sleep.value >= 50) {
    notes.push('疼得影响生活，又睡不好，这两件会互相拖。先把睡眠稳住，白天通常会轻一点。');
  }
  if (byKey.nrs && byKey.nrs.value >= 70) {
    notes.push('平时疼得偏高。先每天记个数字，两周后看走势，比单看某一天准。');
  }

  return {
    dims: dims,
    dominant: dominant,
    notes: notes,
    summary: dominant
      ? '这次最突出的是「' + dominant.label + '」（' + dominant.detail + '）。' + dominant.text
      : dims.length
      ? '各项都不高，说明现在的困扰主要在局部症状本身。情绪和习惯那部分，可以另外做一次评估。'
      : '这次只记了症状和活动情况，没有可以比较的项目。',
  };
}

/* ---------------- 就医等级 ---------------- */

function careLevel(redFlags, a) {
  if (redFlags && redFlags.length) {
    return {
      level: 'urgent',
      headline: '建议尽快就医',
      text: '你勾的这些得医生当面看，先别自己练。',
    };
  }
  const opening = a.opening || 'normal';
  if (opening === 'locked' || opening === 'limited') {
    return {
      level: 'clinic',
      headline: '建议安排一次专科评估',
      text: '张不开或卡住，要先量一量、查一查，再定怎么练。',
    };
  }
  if (a.noise === 'crepitus') {
    return {
      level: 'clinic',
      headline: '建议安排一次专科评估',
      text: '有摩擦音或碎裂音，得医生分清是从哪来的。自我管理可以同时做，但代替不了检查。',
    };
  }
  if (a.duration === 'gt6m') {
    return {
      level: 'clinic',
      headline: '建议安排一次专科评估',
      text: '不适超过半年了，值得做一次系统评估，别继续自己看着。',
    };
  }
  if (a.trauma === 'yes') {
    return {
      level: 'clinic',
      headline: '建议安排一次专科评估',
      text: '有过外伤或拔牙，要先排除结构上的问题。',
    };
  }
  if (Number(a.interference) >= 7) {
    return {
      level: 'clinic',
      headline: '建议安排一次专科评估',
      text: '已经挺影响生活了，让医生一起看看。',
    };
  }
  return {
    level: 'self',
    headline: '可以先从自我管理开始',
    text: '目前没有要马上就医的迹象。先从六周课程和每天记录开始。',
  };
}

/* ---------------- 行动建议 ---------------- */

function buildPlan(axis2, care) {
  const focus = [];
  const dominant = axis2.dominant;
  if (care.level !== 'self') {
    focus.push(1);
    return {
      focusWeeks: [1],
      firstAction: '把这份结果带去就诊，把勾的情况给医生看。',
      recordHint: '就诊前每天记一次疼痛分数和张口情况，医生判断起来更快。',
      weeks: '等评估结果出来，再从第 1 周开始。',
    };
  }
  if (dominant && dominant.key === 'habit') {
    focus.push(2, 1);
  } else if (dominant && (dominant.key === 'distress' || dominant.key === 'worry')) {
    focus.push(1, 3);
  } else if (dominant && dominant.key === 'sleep') {
    focus.push(5, 1);
  } else if (dominant && dominant.key === 'interference') {
    focus.push(4, 1);
  } else {
    focus.push(1, 2);
  }

  return {
    focusWeeks: focus,
    firstAction:
      focus[0] === 2
        ? '今天先做第 2 周的情境觉察：找出最容易紧咬的三个时刻。'
        : focus[0] === 5
        ? '今晚睡前先做一次 5 分钟呼吸练习。'
        : '今天先做一次 3 分钟身体扫描，只观察，不要求放松。',
    recordHint: '连续记 7 天，第 8 天再回看趋势；中间缺几天不影响判断。',
    weeks: '先从第 ' + focus[0] + ' 周开始，另一项在第 ' + focus[1] + ' 周补上。',
  };
}

/* ---------------- 依据与缺口 ---------------- */

// 每条结论都配「支持依据」和「仍不能确定」，避免用户把归类读成诊断
function buildCertainty(axis1, care, a) {
  const basis = [];
  axis1.groups.forEach(function (g) {
    g.basis.forEach(function (b) {
      if (basis.indexOf(b) < 0) basis.push(b);
    });
  });
  if (a.duration) {
    const map = { lt1m: '不到 1 个月', '1to3m': '1–3 个月', '3to6m': '3–6 个月', gt6m: '6 个月以上' };
    if (map[a.duration]) basis.push('不适持续 ' + map[a.duration]);
  }
  if (care.level !== 'self') basis.push('筛查结论：' + care.headline);

  const missing = [
    '没按过咀嚼肌、没量过最大张口度，分不清疼是肌肉还是关节来的。',
    '没有拍片，看不出关节盘在哪、关节面有没有变。',
  ];
  if (a.headache === 'withChew') {
    missing.push('没和偏头痛、紧张性头痛区分开，头痛从哪来还说不准。');
  }
  if (a.referred === 'yes') {
    missing.push('脖子也有症状，得一起查。只治下颌往往不够。');
  }
  if (!a.redFlags || !a.redFlags.length) {
    missing.push('这次没勾急诊的情况，不等于别的病都排除了。');
  }

  return {
    basis: basis,
    missing: missing,
    label: '这是按症状归的一类，不是诊断',
  };
}

/* ---------------- 汇总 ---------------- */

function evaluate(answers) {
  const a = answers || {};
  const redFlags = a.redFlags || [];
  const axis1 = buildAxis1(a);
  const axis2 = buildAxis2(a);
  const care = careLevel(redFlags, a);
  const plan = buildPlan(axis2, care);
  const certainty = buildCertainty(axis1, care, a);

  let impression;
  if (redFlags.length) {
    impression = '你勾的这些要优先让医生看。这页只是就诊时的参考。';
  } else if (axis1.primary) {
    impression =
      axis1.primary.id === 'mixed'
        ? '你的回答同时指向好几种情况。这是按症状归的，不是诊断。'
        : '你的回答最接近「' + axis1.primary.label + '」。这是按症状归的一类，不是诊断。';
  } else {
    impression = '这次回答没指向典型的下颌问题。可以先记着看，必要时再评。';
  }

  return {
    version: FORM_VERSION,
    answers: a,
    redFlags: redFlags,
    axis1: axis1,
    axis2: axis2,
    care: care,
    plan: plan,
    certainty: certainty,
    impression: impression,
  };
}

/* ---------------- 转成就诊摘要 ---------------- */

function labelOf(qKey, value) {
  for (let i = 0; i < STEPS.length; i += 1) {
    const qs = STEPS[i].questions || [];
    for (let j = 0; j < qs.length; j += 1) {
      const q = qs[j];
      if (q.key !== qKey || !q.options) continue;
      const hit = q.options.filter(function (o) {
        return o.value === value;
      })[0];
      if (hit) return hit.label;
    }
  }
  return value;
}

// 筛查结果页点「生成摘要」时，用这次筛查的作答直接拼一份，别让人再答一遍
function toSummary(result) {
  const a = (result && result.answers) || {};
  const flagLabels = (a.redFlags || []).map(function (k) {
    const hit = RED_FLAGS.filter(function (f) {
      return f.key === k;
    })[0];
    return hit ? hit.label : k;
  });

  return {
    generated_at: new Date().toISOString(),
    sites: (a.sites || []).map(function (v) {
      return labelOf('sites', v);
    }),
    duration: a.duration ? labelOf('duration', a.duration) : '',
    triggers: a.provoked === 'yes' ? ['咀嚼、张口或咬紧时更明显'] : [],
    noise: a.noise ? labelOf('noise', a.noise) : '',
    opening: a.opening ? labelOf('opening', a.opening) : '',
    burden: typeof a.nrs === 'number' ? a.nrs : null,
    red_flags: flagLabels,
    care_level: result && result.care ? result.care.level : 'self',
    next_step: result && result.care ? result.care.headline : '',
    from: 'screen',
  };
}

// 首页摘要用
function digest(result) {  if (!result) return null;
  return {
    label: result.axis1.primary ? result.axis1.primary.label : '没看到典型表现',
    dominant: result.axis2.dominant ? result.axis2.dominant.label : '各项都不突出',
    care: result.care.headline,
    careLevel: result.care.level,
  };
}

const BOUNDARY = [
  '第一部分是按症状归的一类。到底是不是，要医生按一按、量一量，必要时拍片才知道。',
  '这页只问症状和活动情况。情绪和习惯那部分，在「心理与行为评估」里单独做。',
  '这里不给概率，不测人格，也不会把心理分数折算成关节的毛病。',
];

module.exports = {
  FORM_VERSION,
  STEPS,
  RED_FLAGS,
  buildSteps,
  pruneAnswers,
  evaluate,
  digest,
  toSummary,
  BOUNDARY,
  bandOf,
};
