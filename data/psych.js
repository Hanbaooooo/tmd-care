/* ==========================================================
   心理与行为量表（DC/TMD Axis II）
   题目与选项按原量表完整收录，未做删减或改写：
   · GAD-7   广泛性焦虑量表 7 题 · 0–3 计分 · 总分 0–21
   · PHQ-4   患者健康问卷 4 题 · 0–3 计分 · 总分 0–12
   · OBC-21  口腔行为清单 21 题 · 0–4 计分 · 总分 0–84
   · JFLS-8  下颌功能受限量表 8 题 · 0–10 计分 · 总分 0–80
   ========================================================== */

// 题库版本。改题目或计分就升这个号，旧结果靠它区分口径。
const PSYCH_VERSION = 'psych-1.1';

const LIKERT4 = [
  { value: 0, label: '根本没有' },
  { value: 1, label: '有几天' },
  { value: 2, label: '一半以上的时间' },
  { value: 3, label: '几乎每天' },
];

// OBC 睡眠相关的两题用「晚」为单位的次数锚点，其余用白天频率锚点
const OBC_SLEEP = [
  { value: 0, label: '从来没有' },
  { value: 1, label: '每月<1晚' },
  { value: 2, label: '每月1-3晚' },
  { value: 3, label: '每周1-3晚' },
  { value: 4, label: '每周4-7晚' },
];

const OBC_DAY = [
  { value: 0, label: '从来没有' },
  { value: 1, label: '很少' },
  { value: 2, label: '有时' },
  { value: 3, label: '大部分时间' },
  { value: 4, label: '总是' },
];

const JFLS10 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (v) {
  return { value: v, label: String(v) };
});

const GAD7_ITEMS = [
  '感到紧张、焦虑或不安',
  '无法停止或控制的忧虑',
  '对各种事情过于担心',
  '很难放松',
  '过于焦躁不安，以致难以平静地坐着',
  '容易恼怒或被激惹',
  '害怕会发生不好的事情',
];

const PHQ4_ITEMS = [
  '感到紧张、焦虑或不安',
  '无法停止或控制的忧虑',
  '做事没有兴趣或愉悦感',
  '感觉低落、郁闷或没有希望',
];

const OBC_ITEMS = [
  { text: '就你所知，在睡觉时咬牙或磨牙', night: true },
  { text: '睡姿会压迫下颌（如俯卧或侧卧）', night: true },
  { text: '醒着时磨牙', night: false },
  { text: '醒着时紧咬牙', night: false },
  { text: '在不进食的时候，会挤压、碰触或将牙齿合在一起（即上下颌牙齿接触）', night: false },
  { text: '在没有紧咬或将上下牙合在一起时，固定、变紧或绷紧肌肉', night: false },
  { text: '将下颌向前或向一侧伸出或停留', night: false },
  { text: '用舌头用力顶牙齿', night: false },
  { text: '把舌头放在牙齿之间', night: false },
  { text: '啃咬、咀嚼或玩弄舌头、颊或嘴唇', night: false },
  { text: '把下颌保持在僵硬或紧张的姿势，如撑住或护住下颌', night: false },
  { text: '用牙齿含住或咬住物品，如头发、烟斗、铅笔、钢笔、手指、手指甲等', night: false },
  { text: '嚼口香糖', night: false },
  { text: '演奏需要用嘴或下颌的乐器（如木管乐器、铜管乐器、弦乐器）', night: false },
  { text: '用手倚住下颌，如用手托住或撑住下巴', night: false },
  { text: '只用一侧咀嚼食物', night: false },
  { text: '在三餐之间进食（指食用需要咀嚼的食物）', night: false },
  { text: '持续说话（如讲课、销售、客服）', night: false },
  { text: '唱歌', night: false },
  { text: '打呵欠', night: false },
  { text: '把电话放在头和肩膀之间', night: false },
];

const JFLS_ITEMS = [
  '嚼韧性食物',
  '嚼鸡肉（如用炉子烤的）',
  '食用不需要咀嚼的柔软食物（如土豆泥、苹果酱、布丁、糊状食物）',
  '嘴张大到可以用茶杯喝水',
  '吞咽',
  '打哈欠',
  '说话',
  '微笑',
];

/* ---------------- 分段 ---------------- */

function buildQuestions(items, options, type) {
  return items.map(function (it, i) {
    const text = typeof it === 'string' ? it : it.text;
    const opts = typeof options === 'function' ? options(it) : options;
    return {
      key: 'q' + (i + 1),
      no: String(i + 1).padStart(2, '0'),
      text: text,
      type: type,
      options: opts.map(function (o) {
        return { value: o.value, label: o.label, checked: false };
      }),
      value: null,
    };
  });
}

const SECTIONS = [
  {
    key: 'gad7',
    name: 'GAD-7',
    sub: '广泛性焦虑症',
    instruct: '过去 2 周内，下列问题是如何困扰你的？',
    legend: '根本没有 0 · 有几天 1 · 一半以上的时间 2 · 几乎每天 3',
    type: 'opt4',
    questions: buildQuestions(GAD7_ITEMS, LIKERT4, 'opt4'),
  },
  {
    key: 'phq4',
    name: 'PHQ-4',
    sub: '患者健康问卷-4',
    instruct: '过去 2 周内，下列问题是如何困扰你的？',
    legend: '根本没有 0 · 有几天 1 · 一半以上的时间 2 · 几乎每天 3',
    type: 'opt4',
    questions: buildQuestions(PHQ4_ITEMS, LIKERT4, 'opt4'),
  },
  {
    key: 'obc',
    name: 'OBC',
    sub: '口腔行为清单 · 21 项',
    instruct: '在最近 1 个月内，你进行下列活动有多频繁？如果活动的频率不同，选择较高的选项。',
    legend: '睡眠两题按「晚」计，其余按白天频率',
    type: 'opt5',
    questions: buildQuestions(
      OBC_ITEMS,
      function (it) {
        return it.night ? OBC_SLEEP : OBC_DAY;
      },
      'opt5'
    ),
  },
  {
    key: 'jfls',
    name: 'JFLS-8',
    sub: '下颌功能受限量表（8 项）',
    instruct: '请指出以下各项活动在过去一个月内的受限程度。如果因过于困难而完全不做该项活动，请选择 10；如果是出于疼痛或困难以外的其他原因而不做该项活动，该项请勿勾选。',
    legend: '0 不受限 · 10 严重受限',
    type: 'opt11',
    questions: buildQuestions(JFLS_ITEMS, JFLS10, 'opt11'),
  },
];

/* ---------------- 计分与解读 ---------------- */

function sum(list) {
  return (list || []).reduce(function (a, b) {
    return a + (Number(b) || 0);
  }, 0);
}

function gadBand(total) {
  if (total >= 15) {
    return {
      band: '重度',
      tone: 'alert',
      text: '分数到了这一档，焦虑已经不轻。尽快找专业的人聊一次，别自己扛。',
    };
  }
  if (total >= 10) {
    return {
      band: '中度',
      tone: 'note',
      text: '焦虑已经在影响日常了，值得正式评一次。同时可以从第 3 周的放松练习开始。',
    };
  }
  if (total >= 5) {
    return {
      band: '轻度',
      tone: 'moss',
      text: '有点焦虑，还不算重。先把呼吸和身体扫描练起来，两周后再测一次。',
    };
  }
  return { band: '无或极轻', tone: 'moss', text: '焦虑不明显。' };
}

function phqBand(total) {
  if (total >= 9) {
    return {
      band: '重度',
      tone: 'alert',
      text: '心理上的困扰偏重，尽快找人帮忙。',
    };
  }
  if (total >= 6) {
    return {
      band: '中度',
      tone: 'note',
      text: '困扰已经比较明显，值得正式评一次。',
    };
  }
  if (total >= 3) {
    return {
      band: '轻度',
      tone: 'moss',
      text: '有些情绪和担心，属于常见范围。',
    };
  }
  return { band: '无或极轻', tone: 'moss', text: '心理上的困扰不明显。' };
}

function obcBand(total, frequent) {
  if (total >= 25) {
    return {
      band: '高',
      tone: 'alert',
      text:
        '口腔习惯偏多（有 ' + frequent + ' 项经常或总是出现）。这些动作你多半没察觉，却一直在给关节和肌肉加负担。六周课程里最先要改的就是它。',
    };
  }
  if (total >= 17) {
    return {
      band: '偏高',
      tone: 'note',
      text: '口腔习惯略多（有 ' + frequent + ' 项经常或总是出现）。挑最频繁的两三项，换成别的动作。',
    };
  }
  return {
    band: '低',
    tone: 'moss',
    text: '口腔习惯不多，保持留意就行。',
  };
}

function jflsBand(total) {
  if (total >= 40) {
    return {
      band: '明显受限',
      tone: 'alert',
      text: '下颌活动受限明显，吃东西、张嘴都受影响了。安排一次专科评估。',
    };
  }
  if (total >= 20) {
    return {
      band: '中度受限',
      tone: 'note',
      text: '有几个动作受限。先看哪几项分最高，再针对着练。',
    };
  }
  if (total >= 5) {
    return {
      band: '轻度受限',
      tone: 'moss',
      text: '个别动作有点受限，日常大多还正常。',
    };
  }
  return { band: '几乎不受限', tone: 'moss', text: '下颌活动基本正常。' };
}

/* ---------------- 结论与心理画像 ---------------- */

// 画像不是诊断，只是把这四个分数翻译成一段能看懂的话。
// 判定顺序按「最该先处理的那件事」排，命中一条就停。
function portraitOf(gad, phq, obc, jfls, frequent) {
  const anxHigh = gad >= 10 || phq >= 6;
  const anxMid = !anxHigh && (gad >= 5 || phq >= 3);
  const obcHigh = obc >= 25;
  const obcMid = !obcHigh && obc >= 17;
  const jflsHigh = jfls >= 20;
  const jflsMid = !jflsHigh && jfls >= 5;

  const high = [];
  const mid = [];
  if (anxHigh) high.push('情绪');
  else if (anxMid) mid.push('情绪');
  if (obcHigh) high.push('口腔习惯');
  else if (obcMid) mid.push('口腔习惯');
  if (jflsHigh) high.push('下颌活动');
  else if (jflsMid) mid.push('下颌活动');

  // 结论要和画像同一个口径：先看有没有高的，再看有没有停在中间的
  let conclusion;
  if (!high.length && !mid.length) {
    conclusion = '四项都落在低位，没有哪一项跳出来。';
  } else if (!high.length) {
    conclusion = '没有哪一项算高，' + mid.join('、') + '停在中间。';
  } else if (high.length === 1) {
    conclusion = '四项里，只有' + high[0] + '这一项偏高。';
  } else if (high.length === 2) {
    conclusion = '四项里，' + high[0] + '和' + high[1] + '偏高。';
  } else {
    conclusion = '四项里，' + high[0] + '、' + high[1] + '、' + high[2] + '都偏高。';
  }

  // 有时 21 题全选「有时」，总分上去了，但没有一项到「经常」，措辞要跟着变
  const freqPhrase =
    frequent > 0 ? '有 ' + frequent + ' 项经常或总是出现' : '多数动作落在「有时」这一档';

  let p;
  if (anxHigh && jflsHigh) {
    p = {
      title: '疼和情绪在互相拖',
      text:
        '情绪这块分数不低，下颌活动也受了限。这两件事常常一起走：越疼越烦，越烦越绷，绷回去又更疼。光靠忍，很难自己把这个循环断掉。' +
        (obcHigh ? '口腔习惯这一块也偏多（' + freqPhrase + '），能一起改就别放着。' : ''),
      act: '先止痛（少嚼硬的、局部冷敷），再把第 3 周的放松练习提前做。两周没缓，找医生看一次。',
      tone: 'alert',
    };
  } else if (jflsHigh) {
    p = {
      title: '卡点在「张不开、嚼不动」',
      text:
        '情绪和习惯都还不算突出，主要问题是几个动作已经明显受限。这类情况自己练能帮一点，但得先弄清楚关节里到底是什么状况。',
      act: '安排一次专科评估，把这一页的结果一起带过去。',
      tone: 'note',
    };
  } else if (anxHigh && obcHigh) {
    p = {
      title: '绷得太久，还在使劲',
      text:
        '焦虑分偏高，口腔习惯也偏多（' +
        freqPhrase +
        '）。但下颌活动还保得住 —— 这多半说明关节没大毛病，是肌肉整天在替你扛。好消息是，这种状态改起来最快。',
      act: '白天每隔一阵，让上下牙分开、舌尖轻抵上颚。第 2 周就从这个开始。',
      tone: 'note',
    };
  } else if (anxHigh) {
    p = {
      title: '先紧的是情绪',
      text:
        '焦虑或情绪这块分数偏高，口腔习惯还不算多。有时候疼是从「绷着」开始的：人一紧，肩膀、脖子、下颌跟着一起紧。',
      act: '把第 3 周的呼吸和身体扫描练起来，每天三五分钟就够。',
      tone: 'note',
    };
  } else if (obcHigh) {
    p = {
      title: '习惯在悄悄使劲',
      text:
        '情绪还算稳，但口腔动作不少（' +
        freqPhrase +
        '）：紧咬、托腮、单侧嚼。单次都不重，一天几百次加起来，就是关节和肌肉的日常负担。',
      act: '挑最频繁的两三项先换掉，不用 21 项一起改。',
      tone: 'note',
    };
  } else if (anxMid || obcMid || jflsMid) {
    p = {
      title: '有点累，但还撑得住',
      text:
        '几项都在中间：没有哪一项报警，也没有哪一项完全没事。这种状态最容易被忽略 —— 因为不难受，人就继续绷着。',
      act: '每天记一个疼痛数字，四周后再测一次，看曲线往哪边走。',
      tone: 'moss',
    };
  } else {
    p = {
      title: '现在还算稳',
      text: '四项都在低位：情绪、习惯、活动都没什么可担心的。',
      act: '保持每周记一次，四周后再测一遍。',
      tone: 'moss',
    };
  }

  // 画像里提到哪一周，按钮就把人送到哪一周，别让人自己找
  let week = 1;
  if (anxHigh && jflsHigh) week = 3;
  else if (jflsHigh) week = 1;
  else if (anxHigh && obcHigh) week = 2;
  else if (anxHigh) week = 3;
  else if (obcHigh) week = 2;

  return {
    conclusion: conclusion,
    title: p.title,
    text: p.text,
    act: p.act,
    tone: p.tone,
    week: week,
  };
}

function evaluate(answers) {
  const a = answers || {};
  const g = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
    return Number(a['gad7.q' + (i + 1)]) || 0;
  });
  const p = [0, 1, 2, 3].map(function (i) {
    return Number(a['phq4.q' + (i + 1)]) || 0;
  });
  const o = OBC_ITEMS.map(function (_, i) {
    return Number(a['obc.q' + (i + 1)]) || 0;
  });
  const j = JFLS_ITEMS.map(function (_, i) {
    return Number(a['jfls.q' + (i + 1)]) || 0;
  });

  const gadTotal = sum(g);
  const phqTotal = sum(p);
  const obcTotal = sum(o);
  const obcFrequent = o.filter(function (v) {
    return v >= 3;
  }).length;
  const jflsTotal = sum(j);

  const gb = gadBand(gadTotal);
  const pb = phqBand(phqTotal);
  const ob = obcBand(obcTotal, obcFrequent);
  const jb = jflsBand(jflsTotal);

  const scores = [
    {
      key: 'gad7',
      label: '焦虑 GAD-7',
      value: gadTotal,
      max: 21,
      percent: Math.round((gadTotal / 21) * 100),
      band: gb.band,
      tone: gb.tone,
      text: gb.text,
    },
    {
      key: 'phq4',
      label: '心理困扰 PHQ-4',
      value: phqTotal,
      max: 12,
      percent: Math.round((phqTotal / 12) * 100),
      band: pb.band,
      tone: pb.tone,
      text: pb.text,
    },
    {
      key: 'obc',
      label: '口腔行为 OBC',
      value: obcTotal,
      max: 84,
      percent: Math.round((obcTotal / 84) * 100),
      band: ob.band,
      tone: ob.tone,
      text: ob.text,
    },
    {
      key: 'jfls',
      label: '下颌功能 JFLS-8',
      value: jflsTotal,
      max: 80,
      percent: Math.round((jflsTotal / 80) * 100),
      band: jb.band,
      tone: jb.tone,
      text: jb.text,
    },
  ];

  const notes = [];
  if (phqTotal >= 6) {
    notes.push('PHQ-4 偏高的时候，疼起来会更难受。先把情绪稳住，再看下颌本身。');
  }
  if (obcTotal >= 17) {
    notes.push('紧咬牙、白天牙齿不自觉相碰、习惯托腮，是很常见的下颌相关不良习惯。您可以在之后逐步调整改善。');
  }
  if (jflsTotal >= 20) {
    notes.push('JFLS-8 里分数最高那项，就是最该先练的动作。不用每项都练。');
  }
  if (gadTotal >= 10) {
    notes.push('焦虑分高的时候，别靠反复张嘴试「还疼不疼」，越试越紧张。');
  }

  return {
    version: PSYCH_VERSION,
    savedAt: new Date().toISOString(),
    answers: a,
    scores: scores,
    phq2: p[0] + p[1],
    gad2: p[2] + p[3],
    obcFrequent: obcFrequent,
    notes: notes,
    portrait: portraitOf(gadTotal, phqTotal, obcTotal, jflsTotal, obcFrequent),
  };
}

function digest(result) {
  if (!result || !result.scores) return null;
  const map = {};
  result.scores.forEach(function (s) {
    map[s.key] = s;
  });
  // 分母从结果里读，不要写死：OBC 从 12 项（48）改过 21 项（84）
  const obcMax = map.obc && map.obc.max ? map.obc.max : 84;
  const jflsMax = map.jfls && map.jfls.max ? map.jfls.max : 80;
  return {
    gad: 'GAD-7 ' + map.gad7.value + '/21',
    obc: 'OBC ' + map.obc.value + '/' + obcMax,
    jfls: 'JFLS-8 ' + map.jfls.value + '/' + jflsMax,
    band: map.gad7.band,
    date: result.savedAt || '',
    version: result.version || '',
    stale: (result.version || '') !== PSYCH_VERSION,
  };
}

module.exports = {
  PSYCH_VERSION,
  SECTIONS,
  OBC_ITEMS,
  JFLS_ITEMS,
  GAD7_ITEMS,
  PHQ4_ITEMS,
  evaluate,
  digest,
};
