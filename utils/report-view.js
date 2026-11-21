// 报告页与医师工作台共用的展示逻辑。
// 两处都在渲染同一份 axis2 / 同一条 rule_hits，规则只写一遍，避免两边对不上。

const AX2_META = [
  { key: 'obc', name: '口腔行为清单 OBC-21', max: 84 },
  { key: 'gad7', name: '广泛性焦虑 GAD-7', max: 21 },
  { key: 'phq4', name: '情绪筛查 PHQ-4', max: 12 },
  { key: 'jfls8', name: '下颌功能受限 JFLS-8', max: 10 },
  { key: 'nrs', name: '当前疼痛 NRS', max: 10 },
];

const ACTION_TEXT = {
  adopt: '采纳系统提示',
  modify: '修改后采纳',
  withdraw: '已撤回',
};

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  );
}

function fmtShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 分级文字里出现这些词，就按更重的色调显示
function toneOf(band) {
  if (!band) return 'calm';
  if (/高|重|明显|频繁|总是/.test(band)) return 'alert';
  if (/中|偏高|有时|部分/.test(band)) return 'caution';
  return 'calm';
}

// axis2 → 报告行。分母从记录里读，不写死（OBC 从 48 改过 84）
function ax2Rows(axis2) {
  const src = axis2 || {};
  const rows = [];
  AX2_META.forEach(function (m) {
    const item = src[m.key];
    if (!item || typeof item.score !== 'number') return;
    const max = item.max || m.max;
    const isAvg = m.key === 'jfls8';
    rows.push({
      key: m.key,
      name: m.name,
      display: isAvg ? item.score.toFixed(1) + ' / ' + max : item.score + ' / ' + max,
      percent: Math.max(2, Math.min(100, Math.round((item.score / max) * 100))),
      band: item.band || '',
      tone: toneOf(item.band),
    });
  });
  return rows;
}

module.exports = {
  AX2_META,
  ACTION_TEXT,
  fmtTime,
  fmtShort,
  toneOf,
  ax2Rows,
};
