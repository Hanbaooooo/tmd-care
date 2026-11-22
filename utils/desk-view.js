// 临床工作台的取数与派生逻辑（纯函数，不碰 wx.*）
// 页面只负责渲染，这里负责「一条就诊/报告到底算哪一格」，
// 因为队列分组、顶部漏斗和提醒数字必须用同一套判定，否则数字会互相打脸。

const rules = require('../data/rules');
const axis1Data = require('../data/axis1');

const AX2_KEYS = ['obc', 'gad7', 'phq4', 'jfls8'];
const AX1_KEYS = axis1Data.REQUIRED;

// 队伍分四段：待录入 → 待复核 → 待签核 → 已完成
const BUCKETS = [
  { key: 'input', label: '待录入' },
  { key: 'review', label: '待复核' },
  { key: 'sign', label: '待签核' },
  { key: 'done', label: '已完成' },
];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function dateKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function timeText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function minutesSince(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
}

// 录入进度 = 4 张自评 + 7 项体征，和报告页同一口径
function progressOf(report) {
  const axis2 = (report && report.axis2) || {};
  const axis1 = (report && report.axis1) || {};
  let ax2Got = 0;
  AX2_KEYS.forEach(function (k) {
    if (axis2[k] && typeof axis2[k].score === 'number') ax2Got += 1;
  });
  const comp = axis1Data.completeness(axis1);
  const ax1Got = AX1_KEYS.length - (comp.missing ? comp.missing.length : 0);
  const total = AX2_KEYS.length + AX1_KEYS.length;
  return {
    percent: Math.round(((ax2Got + ax1Got) / total) * 100),
    ax2Done: ax2Got,
    ax1Got: ax1Got,
    axis1Done: !!comp.complete,
  };
}

function hasSelfReport(report) {
  const axis2 = (report && report.axis2) || {};
  return AX2_KEYS.some(function (k) {
    return axis2[k] && typeof axis2[k].score === 'number';
  });
}

function bucketOf(report) {
  if (!report) return 'input';
  if (report.status === 'signed') return 'done';
  if (report.status === 'withdrawn') return 'sign';
  if (!hasSelfReport(report)) return 'input';
  if (report.rule_state === 'priority' || report.rule_state === 'need_more') return 'review';
  if (report.rule_state === 'pending_input') return 'input';
  // 自评交了但体征没录齐：报告还不成立，仍算待录入
  if (!progressOf(report).axis1Done) return 'input';
  return 'sign';
}

function badgeOf(report) {
  if (!report) return { label: '待患者自评', tone: 'note' };
  if (report.status === 'withdrawn') return { label: '已撤回', tone: 'alert' };
  const st = rules.STATES[report.rule_state];
  if (!st) return { label: '待判定', tone: 'note' };
  return { label: st.label, tone: st.tone };
}

function hitText(report) {
  const hits = (report && Array.isArray(report.rule_hits)) ? report.rule_hits : [];
  if (!hits.length) return '未命中风险信号';
  return '命中 ' + hits.length + ' 条 · ' + (hits[0].title || hits[0].ruleId || '');
}

function followUpText(report) {
  const fu = report && report.follow_up;
  if (!fu) return '';
  if (typeof fu === 'string') return fu;
  if (fu.when && fu.text) return fu.when + '：' + fu.text;
  return fu.text || fu.when || '';
}

// 主入口：reports + visits → 队列 / 分组计数 / KPI / 今日漏斗 / 提醒
function build(input) {
  const reports = (input && input.reports) || [];
  const visits = (input && input.visits) || [];
  const today = dateKey(new Date());

  const visitById = {};
  visits.forEach(function (v) {
    visitById[v.id] = v;
  });

  const reportByVisit = {};
  reports.forEach(function (r) {
    if (r.visit_id) reportByVisit[r.visit_id] = r;
  });

  // ---- 队列：报告 + 还没提交自评的就诊 ----
  const rows = [];
  const seenVisit = {};

  reports.forEach(function (r) {
    const v = visitById[r.visit_id] || null;
    if (r.visit_id) seenVisit[r.visit_id] = true;
    const ACT = { review: '复核并签核', sign: '签核报告', input: '补录体征', done: '查看详情' };
    const bucket = bucketOf(r);
    const b = badgeOf(r);
    const p = progressOf(r);
    rows.push({
      key: 'r' + r.id,
      kind: 'report',
      id: r.id,
      visitNo: r.visit_no || (v && v.visit_no) || '#' + r.visit_id,
      timeText: timeText(r.updated_at || r.created_at),
      doctorName: (v && v.doctor_name) || '',
      stateLabel: b.label,
      tone: b.tone,
      percent: p.percent,
      hitText: hitText(r),
      bucket: bucket,
      canReview: bucket === 'review' || bucket === 'sign',
      canView: true,
      actLabel: ACT[bucket] || '查看详情',
      sortTime: new Date(r.updated_at || r.created_at || 0).getTime() || 0,
    });
  });

  visits.forEach(function (v) {
    if (seenVisit[v.id]) return;
    if (v.status === 'done') return;
    rows.push({
      key: 'v' + v.id,
      kind: 'visit',
      id: v.id,
      visitNo: v.visit_no || '#' + v.id,
      timeText: timeText(v.created_at) || v.visit_date || '',
      doctorName: v.doctor_name || '',
      stateLabel: '待患者自评',
      tone: 'note',
      percent: 0,
      hitText: v.visit_date === today ? '今天报到，尚未提交自评' : '未提交自评',
      bucket: 'input',
      canReview: false,
      canView: false,
      actLabel: '',
      sortTime: new Date(v.created_at || 0).getTime() || 0,
    });
  });

  const order = { review: 0, sign: 1, input: 2, done: 3 };
  const rank = function (b) {
    return typeof order[b] === 'number' ? order[b] : 9;
  };
  rows.sort(function (a, b) {
    const d = rank(a.bucket) - rank(b.bucket);
    if (d !== 0) return d;
    return b.sortTime - a.sortTime;
  });

  const tabs = [{ key: 'all', label: '全部', count: rows.length }].concat(
    BUCKETS.map(function (b) {
      return {
        key: b.key,
        label: b.label,
        count: rows.filter(function (r) {
          return r.bucket === b.key;
        }).length,
      };
    })
  );

  // ---- 今日漏斗：只算今天的就诊 ----
  const todayVisits = visits.filter(function (v) {
    return v.visit_date === today;
  });
  const todayReports = todayVisits
    .map(function (v) {
      return reportByVisit[v.id];
    })
    .filter(Boolean);

  const arrived = todayVisits.length;
  const entered = todayReports.filter(hasSelfReport).length;
  const reviewed = todayReports.filter(function (r) {
    return !!r.rule_state;
  }).length;
  const signed = todayReports.filter(function (r) {
    return r.status === 'signed';
  }).length;
  const followed = todayReports.filter(function (r) {
    return r.status === 'signed' && !!r.follow_up;
  }).length;

  const rawFunnel = [
    { key: 'arrived', label: '已报到', value: arrived },
    { key: 'entered', label: '评估录入', value: entered },
    { key: 'reviewed', label: '智能复核', value: reviewed },
    { key: 'signed', label: '报告签核', value: signed },
    { key: 'followed', label: '进入随访', value: followed },
  ];
  let prevDone = true;
  const funnel = rawFunnel.map(function (f) {
    const done = f.value > 0;
    const active = !done && prevDone;
    prevDone = prevDone && done;
    return { key: f.key, label: f.label, value: f.value, done: done, active: active };
  });

  // ---- KPI ----
  const reviewN = rows.filter(function (r) {
    return r.bucket === 'review';
  }).length;
  const signN = rows.filter(function (r) {
    return r.bucket === 'sign';
  }).length;
  const followN = reports.filter(function (r) {
    return r.status === 'signed' && !!r.follow_up;
  }).length;

  const kpi = [
    { key: 'today', label: '今日初诊', value: arrived, unit: '例' },
    { key: 'review', label: '待人工复核', value: reviewN, unit: '例' },
    { key: 'sign', label: '待签核报告', value: signN, unit: '例' },
    { key: 'follow', label: '待随访', value: followN, unit: '例' },
  ];

  // ---- 智能提醒 ----
  const priorityN = reports.filter(function (r) {
    return r.status !== 'signed' && r.rule_state === 'priority';
  }).length;
  const needSignReady = reports.filter(function (r) {
    return r.status !== 'signed' && r.status !== 'withdrawn' && bucketOf(r) === 'sign' && progressOf(r).axis1Done;
  }).length;
  // 报到超过 30 分钟还没提交自评
  const overdueN = visits.filter(function (v) {
    return (
      v.visit_date === today &&
      !reportByVisit[v.id] &&
      v.status !== 'done' &&
      minutesSince(v.created_at) >= 30
    );
  }).length;

  const alerts = [];
  if (priorityN) {
    alerts.push({ key: 'priority', label: '高优先级复核', count: priorityN, hint: '命中风险信号，建议先看', tone: 'alert' });
  }
  if (needSignReady) {
    alerts.push({ key: 'sign', label: '报告待签核', count: needSignReady, hint: '体征已录齐，可直接签核', tone: 'caution' });
  }
  if (overdueN) {
    alerts.push({ key: 'overdue', label: '评估超时', count: overdueN, hint: '报到超 30 分钟仍未提交自评', tone: 'note' });
  }

  // ---- 随访安排 ----
  const followItems = reports
    .filter(function (r) {
      return r.status === 'signed' && !!r.follow_up;
    })
    .slice(0, 3)
    .map(function (r) {
      return {
        key: 'f' + r.id,
        id: r.id,
        visitNo: r.visit_no || '#' + r.visit_id,
        text: followUpText(r),
      };
    });

  return {
    rows: rows,
    tabs: tabs,
    kpi: kpi,
    funnel: funnel,
    todayTotal: arrived,
    alerts: alerts,
    followItems: followItems,
  };
}

module.exports = {
  build: build,
  progressOf: progressOf,
  bucketOf: bucketOf,
  BUCKETS: BUCKETS,
};
