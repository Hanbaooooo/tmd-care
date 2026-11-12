// 周节律：以「本周一」作为一周的键，避免 ISO 周号跨年时的歧义
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function startOfWeek(date) {
  const d = date ? new Date(date) : new Date();
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7; // 周一为一周起点
  x.setDate(x.getDate() - offset);
  return x;
}

function keyOf(date) {
  const x = startOfWeek(date);
  return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
}

// 本周还剩几天（用于文案，不用于判定）
function daysLeftInWeek(date) {
  const d = date ? new Date(date) : new Date();
  const offset = (d.getDay() + 6) % 7;
  return 7 - offset - 1;
}

// 传入上次完成时间，判断本周是否还没做
function isDue(lastAt, now) {
  if (!lastAt) return true;
  const d = new Date(lastAt);
  if (isNaN(d.getTime())) return true;
  return keyOf(d) !== keyOf(now || new Date());
}

// 距上次多少天，用于「已经 9 天没复查」这类说明
function daysSince(lastAt) {
  if (!lastAt) return null;
  const d = new Date(lastAt);
  if (isNaN(d.getTime())) return null;
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date();
  const now = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((now - a) / 86400000);
}

module.exports = {
  startOfWeek,
  keyOf,
  daysLeftInWeek,
  isDue,
  daysSince,
};
