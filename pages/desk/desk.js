const store = require('../../utils/store');
const rules = require('../../data/rules');

const FILTERS = [
  { key: 'draft', label: '待处理' },
  { key: 'signed', label: '已签核' },
  { key: 'all', label: '全部' },
];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

Page({
  data: {
    loading: true,
    filter: 'draft',
    tabs: [],
    rows: [],
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
    return store
      .listReports('')
      .then(function (list) {
        self.all = list || [];
        self.render();
      })
      .catch(function () {
        self.all = [];
        self.render();
      });
  },

  render() {
    const all = this.all || [];
    const filter = this.data.filter;

    const tabs = FILTERS.map(function (f) {
      const count =
        f.key === 'all'
          ? all.length
          : all.filter(function (r) {
              return r.status === f.key;
            }).length;
      return { key: f.key, label: f.label, count: count };
    });

    const picked = all.filter(function (r) {
      if (filter === 'all') return true;
      if (filter === 'draft') return r.status === 'draft';
      return r.status === filter;
    });

    const rows = picked.map(function (r) {
      const st = rules.STATES[r.rule_state] || null;
      const hits = Array.isArray(r.rule_hits) ? r.rule_hits : [];
      return {
        id: r.id,
        visitNo: r.visit_no || '#' + r.visit_id,
        stateLabel: st ? st.label : '未判定',
        tone: st ? st.tone : 'note',
        hitText: hits.length ? '命中 ' + hits.length + ' 条 · ' + hits[0].title : '未命中风险信号',
        signed: r.status === 'signed',
        timeText: fmt(r.updated_at || r.created_at),
      };
    });

    this.setData({ loading: false, tabs: tabs, rows: rows });
  },

  pickFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.key }, () => {
      this.render();
    });
  },

  openDetail(e) {
    wx.navigateTo({ url: '/pages/desk-detail/desk-detail?id=' + e.currentTarget.dataset.id });
  },
});
