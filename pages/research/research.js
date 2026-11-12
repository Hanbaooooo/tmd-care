const store = require('../../utils/store');
const session = require('../../utils/session');
const { SCALES, profileOf } = require('../../data/scales');
const kb = require('../../data/kb');

const EVIDENCE_IDS = ['k31', 'k26', 'k34', 'k35', 'k16', 'k36', 'k13', 'k21', 'k02', 'k27'];

const EVIDENCE = EVIDENCE_IDS.map((id) => kb.sourceById(id)).filter((s) => !!s);

/* ---------------- 版本核对 ----------------
 * OBC 从 12 项简版（0–48）换成了 21 项完整版（0–84）。
 * 老结果没有 version 字段，只能靠 answers 里答到第几题来认。
 * 认出来是旧版，就把这一项标成「旧版」并允许重填 —— 不让两套分数混在一个时间点上。
 */

function answeredCount(row) {
  const a = (row && row.answers) || {};
  let n = 0;
  for (let i = 1; i <= 30; i += 1) {
    const v = a['q' + i];
    if (v !== undefined && v !== null) n = i;
  }
  return n;
}

function itemCountOf(row) {
  if (row && typeof row.item_count === 'number' && row.item_count > 0) return row.item_count;
  const n = answeredCount(row);
  return n || null;
}

function inspect(scaleId, scale, row) {
  if (!row) return { done: false, legacy: false, text: '' };
  const cur = profileOf(scaleId, scale ? scale.version : '');
  const ver = row.version || '';
  const count = itemCountOf(row);

  let legacy = false;
  if (ver) {
    legacy = !!cur.version && ver !== cur.version;
  } else if (count && cur.itemCount) {
    // 没有版本号的老数据：项数对不上就是旧版
    legacy = count !== cur.itemCount;
  }

  if (!legacy) return { done: true, legacy: false, text: '' };
  return {
    done: false,
    legacy: true,
    text: count ? '旧版 ' + count + ' 项' : '旧版',
  };
}

const VISITS = [
  {
    id: 'T0',
    label: 'T0 基线',
    timing: '入组时',
    summary: '填正式量表，加一次 DC/TMD 临床检查。符合条件的人，多做一次下颌运动记录。',
    scales: ['gad7', 'phq4', 'obc', 'jfls8', 'nrs', 'dctmd_sq'],
  },
  {
    id: 'T1',
    label: 'T1 第 6 周',
    timing: '约 6 周',
    summary: '简单问几句，看症状和治疗有没有变化。',
    scales: ['nrs'],
  },
  {
    id: 'T2',
    label: 'T2 第 12 周',
    timing: '约 12 周',
    summary: '情绪、习惯、活动和症状，再测一遍。',
    scales: ['gad7', 'phq4', 'obc', 'jfls8', 'nrs'],
  },
  {
    id: 'T3',
    label: 'T3 第 6 个月',
    timing: '约 6 个月',
    summary: '再测一遍，顺便查有没有新出现的疼。查到线索，就安排临床确认。',
    scales: ['gad7', 'phq4', 'obc', 'jfls8', 'nrs', 'dctmd_sq'],
  },
];

Page({
  data: {
    consented: false,
    hasSession: false,
    agree: false,
    saving: false,
    visits: [],
    legacyCount: 0,
    evidence: EVIDENCE,
  },

  onShow() {
    session.getSession().then((s) => {
      this.setData({ hasSession: !!s });
      if (!s) {
        this.setData({ consented: false });
        return null;
      }
      return Promise.all([store.listConsents(), store.listScaleResults()]).then((res) => {
        const consents = res[0] || [];
        const results = res[1] || [];
        const consented = consents.some((c) => c.track === 'A' && c.consented);
        this.setData({ consented: consented });
        if (consented) this.composeVisits(results);
      });
    });
  },

  composeVisits(results) {
    // results 已按 taken_at 倒序，每个「访视 + 量表」只认最新一条
    const latest = {};
    results.forEach((r) => {
      const key = r.visit + ':' + r.scale_id;
      if (!latest[key]) latest[key] = r;
    });

    let legacyCount = 0;

    const visits = VISITS.map((v) => {
      const scales = v.scales.map((id) => {
        const s = SCALES[id];
        const row = latest[v.id + ':' + id];
        const state = inspect(id, s, row);
        if (state.legacy) legacyCount += 1;
        return {
          id: id,
          short: s ? s.short : id,
          version: s ? s.version : '',
          done: state.done,
          legacy: state.legacy,
          legacyText: state.text,
          visit: v.id,
        };
      });
      const allDone = scales.every((s) => s.done);
      return {
        id: v.id,
        label: v.label,
        timing: v.timing,
        summary: v.summary,
        available: v.id === 'T0' || v.id === 'T1',
        scales: scales,
        statusClass: allDone ? 'done' : '',
      };
    });

    this.setData({ visits: visits, legacyCount: legacyCount });
  },

  toggleAgree() {
    this.setData({ agree: !this.data.agree });
  },

  join() {
    if (!this.data.agree || this.data.saving) return;
    this.setData({ saving: true });
    store
      .setConsent('A', true)
      .then(() => {
        this.setData({ saving: false, consented: true });
        wx.showToast({ title: '已加入 A 线', icon: 'none' });
        this.onShow();
      })
      .catch((err) => {
        this.setData({ saving: false });
        wx.showModal({
          title: '还没登录',
          content: '研究同意和量表要存进研究账户，得先登录。登录后回到这一页再点一次就行。',
          confirmText: '去登录',
          cancelText: '先不参加',
          success: (r) => {
            if (r.confirm) wx.navigateTo({ url: '/pages/login/login?from=research' });
          },
        });
        console.warn('[颞安智护] consent failed', err && err.message);
      });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=research' });
  },

  openScale(e) {
    const scale = e.currentTarget.dataset.scale;
    const visit = e.currentTarget.dataset.visit;
    wx.navigateTo({ url: '/pages/scale/scale?id=' + scale + '&visit=' + visit });
  },
});
