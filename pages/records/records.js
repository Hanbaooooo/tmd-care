const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');
const scales = require('../../data/scales');
const adherence = require('../../utils/adherence');

function formatDate(str) {
  if (!str) return '';
  const parts = String(str).split('-');
  if (parts.length < 3) return str;
  return parts[0] + '年' + parts[1] + '月' + parts[2] + '日';
}

Page({
  data: {
    records: [],
    weekly: null,
    stats: null,
    loading: true,
    localOnly: false,
    subline: '',
    pendingSync: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  refresh() {
    return Promise.all([session.getSession(), store.listRecords(60)]).then((res) => {
      const s = res[0];
      const rows = res[1] || [];

      const records = rows.map(function (r) {
        const level = scales.nrsLevel(r.pain_nrs);
        const extraParts = [];
        if (typeof r.sleep_quality === 'number') extraParts.push('睡眠 ' + r.sleep_quality + '/5');
        if (typeof r.stress === 'number') extraParts.push('紧张 ' + r.stress + '/10');
        if (r.trigger) extraParts.push(triggerLabel(r.trigger));
        if (r.oral_habits && r.oral_habits.length) extraParts.push('口腔行为 ' + r.oral_habits.length + ' 项');
        return {
          id: r.id,
          dateText: formatDate(r.record_date),
          nrs: r.pain_nrs,
          tone: level.tone,
          level: level.label,
          extra: extraParts.length ? extraParts.join(' · ') : '无补充说明',
          raw: r,
        };
      });

      const weekly = rows.length ? adherence.weekly(rows, store.today()) : null;
      const stats = adherence.anchorStats(rows, store.today());

      this.setData({
        loading: false,
        records: records,
        weekly: weekly,
        stats: adherence.display(stats),
        localOnly: !s,
        pendingSync: local.hasPending(),
        subline: rows.length ? '共 ' + rows.length + ' 条记录' : '',
      });
    });
  },

  openRecord(e) {
    const id = e.currentTarget.dataset.id;
    const hit = this.data.records.filter(function (r) {
      return r.id === id;
    })[0];
    if (!hit) return;
    const r = hit.raw;
    const lines = ['日期：' + hit.dateText, '疼痛：' + hit.nrs + '/10（' + hit.level + '）'];
    if (typeof r.sleep_quality === 'number') lines.push('睡眠：' + r.sleep_quality + '/5');
    if (typeof r.stress === 'number') lines.push('紧张：' + r.stress + '/10');
    if (r.trigger) lines.push('最明显：' + triggerLabel(r.trigger));
    if (typeof r.function_limit === 'number') lines.push('生活影响：' + r.function_limit + '/10');
    if (r.oral_habits && r.oral_habits.length) lines.push('口腔行为：' + r.oral_habits.join('、'));
    if (r.note) lines.push('备注：' + r.note);
    wx.showModal({
      title: '记录详情',
      content: lines.join('\n'),
      showCancel: false,
      confirmText: '知道了',
    });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/record-edit/record-edit' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=records' });
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },
});

function triggerLabel(v) {
  const map = {
    work: '工作或学习',
    commute: '通勤路上',
    emotion: '情绪紧张',
    eat: '吃东西',
    screen: '看屏幕',
    none: '无明显诱因',
  };
  return map[v] || v;
}
