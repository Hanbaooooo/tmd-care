const store = require('../../utils/store');
const rules = require('../../data/rules');
const axis1Data = require('../../data/axis1');
const view = require('../../utils/report-view');

// Axis I 字段 key → 中文名，用于「还差哪几项」
function axis1LabelMap() {
  const map = {};
  axis1Data.SECTIONS.forEach(function (sec) {
    sec.items.forEach(function (it) {
      map[it.key] = it.label;
    });
  });
  return map;
}

Page({
  data: {
    loading: true,
    hasReport: false,
    signed: false,
    visitNo: '',
    clinic: '',
    visitDate: '',
    doctorName: '',
    state: null,
    ruleVersion: '',
    completion: 0,
    missingText: '',
    axis1Done: false,
    axis1Lines: [],
    axis1Note: '',
    axis2Rows: [],
    hits: [],
    actionText: '',
    doctorNote: '',
    signedBy: '',
    signedAtText: '',
    followUpText: '',
  },

  onLoad(query) {
    this.visitId = query && query.visit ? query.visit : '';
    this.reportId = query && query.id ? query.id : '';
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

    const job = self.reportId
      ? store.getReportById(self.reportId)
      : self.visitId
      ? store.getReport(self.visitId)
      : store.currentVisit().then(function (v) {
          if (!v) return null;
          self.visitId = v.id;
          return store.getReport(v.id);
        });

    return Promise.resolve(job)
      .then(function (report) {
        if (!report) {
          self.setData({ loading: false, hasReport: false });
          return null;
        }
        self.report = report;
        const visitJob = report.visit_id ? store.getVisit(report.visit_id) : Promise.resolve(null);
        return visitJob.then(function (visit) {
          self.render(report, visit);
        });
      })
      .catch(function (err) {
        console.warn('[颌心] report load failed', err && err.message);
        self.setData({ loading: false, hasReport: false });
      });
  },

  render(report, visit) {
    // 患者端只看签核稿：有快照就用快照，没快照说明还没定稿
    const signed = report.status === 'signed' && !!report.patient_snapshot;
    const src = signed ? report.patient_snapshot : report;

    const axis2 = src.axis2 || {};
    const axis1 = src.axis1 || {};

    const rows = view.ax2Rows(axis2);
    const lines = axis1Data.derive(axis1);
    const comp = axis1Data.completeness(axis1);

    // 完成度 = 4 张自评 + 7 项体征
    const ax2Have = ['obc', 'gad7', 'phq4', 'jfls8'].filter(function (k) {
      return axis2[k] && typeof axis2[k].score === 'number';
    }).length;
    const total = 4 + axis1Data.REQUIRED.length;
    const got = ax2Have + (axis1Data.REQUIRED.length - comp.missing.length);
    const completion = Math.round((got / total) * 100);

    const labelMap = axis1LabelMap();
    const missingNames = [];
    view.AX2_META.forEach(function (m) {
      if (['obc', 'gad7', 'phq4', 'jfls8'].indexOf(m.key) < 0) return;
      if (!(axis2[m.key] && typeof axis2[m.key].score === 'number')) {
        missingNames.push(m.name.split(' ').pop());
      }
    });
    comp.missing.forEach(function (k) {
      missingNames.push(labelMap[k] || k);
    });

    const hits = (src.rule_hits || []).map(function (h) {
      return Object.assign({}, h, {
        open: false,
        sourceText: (h.sourceItems || [])
          .map(function (k) {
            return labelMap[k] || String(k).toUpperCase();
          })
          .join('、'),
      });
    });

    const state = rules.STATES[src.rule_state] || null;

    const fu = src.follow_up;
    let followUpText = '';
    if (typeof fu === 'string') followUpText = fu;
    else if (fu && fu.text) followUpText = fu.when ? fu.when + '：' + fu.text : fu.text;

    this.setData({
      loading: false,
      hasReport: true,
      signed: signed,
      visitNo: (visit && visit.visit_no) || report.visit_no || '',
      clinic: (visit && visit.clinic) || '',
      visitDate: (visit && visit.visit_date) || '',
      doctorName: (visit && visit.doctor_name) || '',
      state: state,
      ruleVersion: src.rule_version || '',
      completion: completion,
      missingText: missingNames.slice(0, 5).join('、') + (missingNames.length > 5 ? ' 等' : ''),
      axis1Done: comp.complete,
      axis1Lines: lines,
      axis1Note: axis1.axis1_note || '',
      axis2Rows: rows,
      hits: hits,
      actionText: view.ACTION_TEXT[src.doctor_action] || '尚未给出复核意见',
      doctorNote: src.doctor_note || '',
      signedBy: src.signed_by || '',
      signedAtText: view.fmtTime(src.signed_at),
      followUpText: followUpText,
    });
  },

  toggleHit(e) {
    const i = Number(e.currentTarget.dataset.i);
    const hits = this.data.hits.slice();
    if (!hits[i]) return;
    hits[i] = Object.assign({}, hits[i], { open: !hits[i].open });
    this.setData({ hits: hits });
  },

  goAssess() {
    wx.navigateTo({ url: '/pages/psych/psych' });
  },
});
