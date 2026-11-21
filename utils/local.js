// 本机优先存储：未登录时所有内容都存在本机，登录后自动补同步。
// 目的：登录不该是使用门槛，也不该让用户填完的东西消失。

const KEYS = {
  records: 'tmd_local_records',
  progress: 'tmd_local_progress',
  screen: 'tmd_local_screen',
  psych: 'tmd_local_psych',
  pending: 'tmd_local_pending',
  onboarded: 'tmd_onboarded',
  localMode: 'tmd_local_mode',
  skipLogin: 'tmd_skip_login',
  weeklyRemind: 'tmd_weekly_remind',
};

function read(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    if (v === '' || v === null || v === undefined) return fallback;
    return v;
  } catch (err) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (err) {
    console.warn('[颌心] local write failed', key, err && err.message);
    return false;
  }
}

function today() {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}

/* ---------------- 症状记录（按日期合并） ---------------- */

function normalizeRecord(row) {
  return {
    id: row.id || 'local-' + row.record_date,
    record_date: row.record_date || today(),
    pain_nrs: typeof row.pain_nrs === 'number' ? row.pain_nrs : null,
    sleep_quality: typeof row.sleep_quality === 'number' ? row.sleep_quality : null,
    stress: typeof row.stress === 'number' ? row.stress : null,
    trigger: row.trigger || null,
    function_limit: typeof row.function_limit === 'number' ? row.function_limit : null,
    oral_habits: Array.isArray(row.oral_habits) ? row.oral_habits : [],
    note: row.note || null,
    anchor_done: !!row.anchor_done,
    clench_noticed: typeof row.clench_noticed === 'boolean' ? row.clench_noticed : null,
    created_at: row.created_at || new Date().toISOString(),
    local: true,
    pending: row.pending !== false,
  };
}

function listRecords(limit) {
  const rows = read(KEYS.records, []);
  const sorted = rows
    .slice()
    .sort(function (a, b) {
      return String(b.record_date).localeCompare(String(a.record_date));
    });
  return sorted.slice(0, limit || 30);
}

function getRecord(date) {
  const rows = read(KEYS.records, []);
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].record_date === date) return rows[i];
  }
  return null;
}

// 同一天重复记录时合并字段，不覆盖已有内容
function upsertRecord(payload) {
  const rows = read(KEYS.records, []);
  const date = payload.record_date || today();
  let target = null;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].record_date === date) {
      target = rows[i];
      break;
    }
  }
  const merged = normalizeRecord(
    Object.assign({}, target || { record_date: date }, payload, { record_date: date, pending: true })
  );
  if (target) {
    const idx = rows.indexOf(target);
    rows[idx] = merged;
  } else {
    rows.push(merged);
  }
  write(KEYS.records, rows);
  markPending();
  return merged;
}

/* ---------------- 课程进度 ---------------- */

function listProgress() {
  const map = read(KEYS.progress, {});
  return Object.keys(map)
    .map(function (k) {
      return map[k];
    })
    .sort(function (a, b) {
      return a.week - b.week;
    });
}

function upsertProgress(week, patch) {
  const map = read(KEYS.progress, {});
  const cur = map[week] || {
    week: week,
    learn_done: false,
    practice_done: false,
    review_done: false,
    practice_count: 0,
    reflection: null,
  };
  const next = Object.assign({}, cur, patch, { week: week, pending: true });
  map[week] = next;
  write(KEYS.progress, map);
  markPending();
  return next;
}

/* ---------------- 筛查结果 ---------------- */

function getScreen() {
  const v = read(KEYS.screen, null);
  return v && v.result ? v : null;
}

function saveScreen(result) {
  const payload = { result: result, saved_at: new Date().toISOString(), pending: true };
  write(KEYS.screen, payload);
  markPending();
  return payload;
}

/* ---------------- 心理量表结果 ---------------- */

function getPsych() {
  const v = read(KEYS.psych, null);
  return v && v.result ? v : null;
}

function savePsych(result) {
  const payload = { result: result, saved_at: new Date().toISOString(), pending: true };
  write(KEYS.psych, payload);
  markPending();
  return payload;
}

/* ---------------- 待同步 ---------------- */

function markPending() {
  write(KEYS.pending, Date.now());
}

function hasPending() {
  const rows = read(KEYS.records, []);
  const progress = read(KEYS.progress, {});
  const screen = read(KEYS.screen, null);
  return (
    rows.some(function (r) { return r.pending !== false; }) ||
    Object.keys(progress).some(function (k) { return progress[k].pending !== false; }) ||
    !!(screen && screen.pending)
  );
}

function clearPendingFlags() {
  const rows = read(KEYS.records, []);
  write(
    KEYS.records,
    rows.map(function (r) { return Object.assign({}, r, { pending: false }); })
  );
  const map = read(KEYS.progress, {});
  Object.keys(map).forEach(function (k) {
    map[k] = Object.assign({}, map[k], { pending: false });
  });
  write(KEYS.progress, map);
  const screen = read(KEYS.screen, null);
  if (screen) write(KEYS.screen, Object.assign({}, screen, { pending: false }));
}

/* ---------------- 引导状态 ---------------- */

function isOnboarded() {
  return read(KEYS.onboarded, false) === true;
}

function setOnboarded(v) {
  write(KEYS.onboarded, !!v);
}

function isLocalMode() {
  return read(KEYS.localMode, false) === true;
}

function setLocalMode(v) {
  write(KEYS.localMode, !!v);
}

// 只在「本次明确选择先不登录」时置真，下次启动就不再拦一次
function isSkipLogin() {
  return read(KEYS.skipLogin, false) === true;
}

function setSkipLogin(v) {
  write(KEYS.skipLogin, !!v);
}

// 每周复查提醒：默认开启，用户可关
function isWeeklyRemind() {
  return read(KEYS.weeklyRemind, true) !== false;
}

function setWeeklyRemind(v) {
  write(KEYS.weeklyRemind, !!v);
}

function clearAll() {
  Object.keys(KEYS).forEach(function (k) {
    try {
      wx.removeStorageSync(KEYS[k]);
    } catch (err) {
      /* ignore */
    }
  });
}

module.exports = {
  KEYS,
  today,
  read,
  write,
  listRecords,
  getRecord,
  upsertRecord,
  listProgress,
  upsertProgress,
  getScreen,
  saveScreen,
  getPsych,
  savePsych,
  markPending,
  hasPending,
  clearPendingFlags,
  isOnboarded,
  setOnboarded,
  isLocalMode,
  setLocalMode,
  isSkipLogin,
  setSkipLogin,
  isWeeklyRemind,
  setWeeklyRemind,
  clearAll,
};
