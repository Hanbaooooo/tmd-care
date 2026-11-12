// 依从率与周报告：把「有没有在用」变成一个可以算出来的分母。
// 注意：66.7% 只是 B 线 per-protocol 的预设阈值，患者端不显示「不合格」。

const EFFECTIVE_EXPOSURE = 66.7;
const COURSE_WEEKS = 6;

function toDate(str) {
  const p = String(str || '').split('-');
  if (p.length < 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
}

function dayDiff(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / ms);
}

function dateKey(d) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

function hasAnchor(r) {
  return !!r && (r.anchor_done === true || typeof r.pain_nrs === 'number');
}

/* ---------------- 日锚点依从 ---------------- */

// 窗口起点 = 首条记录日；不足 7 天按实际天数算，不把新用户算成低依从
function anchorStats(records, todayStr) {
  const rows = records || [];
  const today = toDate(todayStr) || new Date();
  const dates = rows.map(function (r) { return toDate(r.record_date); }).filter(Boolean);
  if (!dates.length) {
    return { days: 0, done: 0, rate: 0, window: 0, empty: true };
  }
  dates.sort(function (a, b) { return a - b; });
  const start = dates[0];
  const rawWindow = dayDiff(today, start) + 1;
  const window = Math.max(1, Math.min(rawWindow, 56));

  const hit = {};
  rows.forEach(function (r) {
    if (hasAnchor(r)) hit[r.record_date] = true;
  });
  let done = 0;
  for (let i = 0; i < window; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    if (hit[dateKey(d)]) done += 1;
  }
  return {
    days: window,
    done: done,
    rate: Math.round((done / window) * 100),
    window: window,
    empty: false,
  };
}

/* ---------------- 周课程完成 ---------------- */

function courseStats(progress) {
  const rows = progress || [];
  let done = 0;
  rows.forEach(function (p) {
    if (p.review_done) done += 1;
  });
  return {
    done: done,
    total: COURSE_WEEKS,
    percent: Math.round((done / COURSE_WEEKS) * 100),
    effective: done >= 5,
  };
}

/* ---------------- 患者端展示 ---------------- */

// 只给「记录的天数」和「本周有没有变化」，不写「你依从性差」
function display(stats) {
  if (!stats || stats.empty) {
    return { text: '还没有记录', hint: '记第一天之后，这里会显示你实际记录的天数。' };
  }
  return {
    text: '最近 ' + stats.days + ' 天里记录了 ' + stats.done + ' 天',
    hint:
      stats.done >= 5
        ? '这个密度足够看出变化。'
        : '不用补记录，接着记就行；缺几天不影响判断。',
  };
}

/* ---------------- 周报告 ---------------- */

function avg(list) {
  if (!list.length) return null;
  const sum = list.reduce(function (a, b) { return a + b; }, 0);
  return Math.round((sum / list.length) * 10) / 10;
}

function weekRange(offset, todayStr) {
  const today = toDate(todayStr) || new Date();
  const end = new Date(today.getTime() - offset * 7 * 86400000);
  const start = new Date(end.getTime() - 6 * 86400000);
  return { start: start, end: end };
}

function weekly(records, todayStr, screenDigest) {
  const rows = records || [];
  const cur = weekRange(0, todayStr);
  const prev = weekRange(1, todayStr);

  const thisWeek = rows.filter(function (r) {
    const d = toDate(r.record_date);
    return d && d >= cur.start && d <= cur.end;
  });
  const lastWeek = rows.filter(function (r) {
    const d = toDate(r.record_date);
    return d && d >= prev.start && d <= prev.end;
  });

  const curNrs = thisWeek
    .map(function (r) { return r.pain_nrs; })
    .filter(function (v) { return typeof v === 'number'; });
  const prevNrs = lastWeek
    .map(function (r) { return r.pain_nrs; })
    .filter(function (v) { return typeof v === 'number'; });

  const curAvg = avg(curNrs);
  const prevAvg = avg(prevNrs);

  let compareText;
  let tone = 'info';
  if (curAvg === null) {
    compareText = '本周还没有可比较的疼痛数字。';
  } else if (prevAvg === null) {
    compareText = '这是第一周有数字的一周，下周开始可以对比。本周均值 ' + curAvg + '。';
  } else {
    const delta = Math.round((curAvg - prevAvg) * 10) / 10;
    if (Math.abs(delta) < 1) {
      compareText = '和上周差不多（本周均值 ' + curAvg + '，上周 ' + prevAvg + '）。';
    } else if (delta < 0) {
      compareText = '比上周低 ' + Math.abs(delta) + ' 分（本周 ' + curAvg + '，上周 ' + prevAvg + '）。';
      tone = 'good';
    } else {
      compareText = '比上周高 ' + delta + ' 分（本周 ' + curAvg + '，上周 ' + prevAvg + '）。';
      tone = 'caution';
    }
  }

  // 下周一件事：只给一件，避免变成任务清单
  let nextThing;
  if (thisWeek.length === 0) {
    nextThing = '下周先做一件事：每天记一个疼痛数字。';
  } else if (thisWeek.length < 3) {
    nextThing = '下周把记录的次数提到 3 天以上，不用每天都记全。';
  } else if (tone === 'caution') {
    nextThing = '下周不加新练习，先把每天的觉察记录做满 7 天。';
  } else if (screenDigest && screenDigest.dominant) {
    nextThing = '下周继续第 ' + (screenDigest.focusWeek || 2) + ' 周，把「' + screenDigest.dominant + '」这一项再练一轮。';
  } else {
    nextThing = '下周保持现在的节奏，周末回来看一次趋势。';
  }

  return {
    daysRecorded: thisWeek.filter(hasAnchor).length,
    totalDays: 7,
    curAvg: curAvg,
    prevAvg: prevAvg,
    compareText: compareText,
    tone: tone,
    nextThing: nextThing,
    daily: buildDaily(thisWeek, cur),
    empty: rows.length === 0,
  };
}

function buildDaily(rows, range) {
  const map = {};
  rows.forEach(function (r) {
    if (typeof r.pain_nrs === 'number') map[r.record_date] = r.pain_nrs;
  });
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(range.start.getTime() + i * 86400000);
    const key = dateKey(d);
    const v = map[key];
    out.push({
      key: key,
      label: String(d.getDate()),
      value: typeof v === 'number' ? v : null,
      height: typeof v === 'number' ? Math.max(8, Math.round((v / 10) * 100)) : 0,
    });
  }
  return out;
}

module.exports = {
  EFFECTIVE_EXPOSURE,
  COURSE_WEEKS,
  anchorStats,
  courseStats,
  display,
  weekly,
  dateKey,
};
