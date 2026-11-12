const triage = require('../../data/triage');
const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

Page({
  data: {
    whenToSee: triage.WHEN_TO_SEE,
    hasSummary: false,
    summaryDate: '',
    hasResearch: false,
    signedIn: false,
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    session.getSession().then((s) => {
      this.setData({ signedIn: !!s });
      return Promise.all([store.latestSummary(), store.listConsents()]).then((res) => {
        const summary = res[0];
        const consents = res[1] || [];
        this.setData({
          hasSummary: !!summary,
          summaryDate: summary ? '生成于 ' + formatDate(summary.created_at) : '',
          hasResearch: consents.some((c) => c.track === 'A' && c.consented),
        });
      });
    });
  },

  startTriage() {
    wx.navigateTo({ url: '/pages/triage/triage?mode=symptom' });
  },

  openSummary() {
    wx.navigateTo({ url: '/pages/summary/summary?synced=1' });
  },

  goAnxin() {
    wx.navigateTo({ url: '/pages/anxin/anxin' });
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goResearch() {
    wx.navigateTo({ url: '/pages/research/research' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=care' });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后，这台手机上就看不到你的记录了。数据还在账号里，重新登录就能看到。',
      success: (res) => {
        if (!res.confirm) return;
        session.signOut().then(() => {
          getApp().globalData.session = null;
          local.setSkipLogin(false);
          wx.reLaunch({ url: '/pages/welcome/welcome?force=1' });
        });
      },
    });
  },
});
