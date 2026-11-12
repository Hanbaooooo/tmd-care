const course = require('../../data/course');
const store = require('../../utils/store');
const session = require('../../utils/session');

Page({
  data: {
    buildTag: '',
    weeks: [],
    currentWeek: null,
    doneCount: 0,
    percent: 0,
    signedIn: false,
  },

  onReady() {
    this.probe();
  },

  // 临时诊断：把窗口高度与 .page 盒子高度打到屏幕上
  probe() {
    let w = {};
    try {
      w = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    } catch (e) {
      w = {};
    }
    wx.createSelectorQuery()
      .select('.page')
      .boundingClientRect((r) => {
        const wh = Math.round(w.windowHeight || 0);
        const sh = Math.round(w.screenHeight || 0);
        const ph = r ? Math.round(r.height) : -1;
        this.setData({ buildTag: 'B2110 W' + wh + ' S' + sh + ' P' + ph });
      })
      .exec();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  refresh() {
    return session.getSession().then((s) => {
      this.setData({ signedIn: !!s });
      return store.listProgress().then((rows) => {
        this.compose(rows || []);
      });
    });
  },

  compose(progress) {
    const map = {};
    progress.forEach((p) => {
      map[p.week] = p;
    });

    let currentWeek = null;
    const weeks = course.WEEKS.map((w) => {
      const p = map[w.week] || {};
      const item = {
        week: w.week,
        title: w.title,
        learn_done: !!p.learn_done,
        practice_done: !!p.practice_done,
        review_done: !!p.review_done,
        isCurrent: false,
      };
      if (!currentWeek && !item.review_done) {
        currentWeek = { week: w.week, title: w.title, summary: w.summary };
        item.isCurrent = true;
      }
      return item;
    });

    const doneCount = weeks.filter((w) => w.review_done).length;

    this.setData({
      weeks: weeks,
      currentWeek: currentWeek,
      doneCount: doneCount,
      percent: Math.round((doneCount / weeks.length) * 100),
    });
  },

  openWeek(e) {
    const week = e.currentTarget.dataset.week;
    wx.navigateTo({ url: '/pages/week/week?week=' + week });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
});
