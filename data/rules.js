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
