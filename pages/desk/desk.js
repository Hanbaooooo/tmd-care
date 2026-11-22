const store = require('../../utils/store');
const view = require('../../utils/desk-view');

Page({
  data: {
    loading: true,
    filter: 'all',
    tabs: [],
    rows: [],
    kpi: [],
    funnel: [],
    alerts: [],
    followItems: [],
    todayTotal: 0,
    total: 0,
  },

  onShow() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  load() {
    const self = this;
    self.setData({ loading: true });
    return Promise.all([store.listReports(''), store.listVisits(60)])
      .then(function (res) {
        self.shape = view.build({ reports: res[0] || [], visits: res[1] || [] });
        self.render();
      })
      .catch(function (err) {
        console.warn('[颌心] desk load failed', err && err.message);
        self.shape = view.build({ reports: [], visits: [] });
        self.render();
      });
  },

  render() {
    const s =
      this.shape ||
      { rows: [], tabs: [], kpi: [], funnel: [], alerts: [], followItems: [], todayTotal: 0 };
    const filter = this.data.filter;
    const rows = s.rows.filter(function (r) {
      return filter === 'all' || r.bucket === filter;
    });

    this.setData({
      loading: false,
      tabs: s.tabs,
      kpi: s.kpi,
      funnel: s.funnel,
      alerts: s.alerts,
      followItems: s.followItems,
      todayTotal: s.todayTotal,
      total: s.rows.length,
      rows: rows,
    });
  },

  pickFilter(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ filter: key }, () => {
      this.render();
    });
  },

  tapKpi(e) {
    const map = { today: 'all', review: 'review', sign: 'sign', follow: 'done' };
    const key = map[e.currentTarget.dataset.key];
    if (!key) return;
    this.setData({ filter: key }, () => {
      this.render();
    });
  },

  tapAlert(e) {
    const map = { priority: 'review', sign: 'sign', overdue: 'input' };
    const key = map[e.currentTarget.dataset.key];
    if (!key) return;
    this.setData({ filter: key }, () => {
      this.render();
    });
  },

  openRow(e) {
    const ds = e.currentTarget.dataset;
    if (ds.kind === 'visit') {
      wx.showToast({ title: '患者尚未提交自评', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/desk-detail/desk-detail?id=' + ds.id });
  },

  openReport(e) {
    wx.navigateTo({ url: '/pages/report/report?id=' + e.currentTarget.dataset.id });
  },
});
