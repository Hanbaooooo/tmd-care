const store = require('../../utils/store');
const session = require('../../utils/session');
const rules = require('../../data/rules');
const axis1Data = require('../../data/axis1');
const view = require('../../utils/report-view');

const NUM_KEYS = ['mio', 'pio', 'lateral_r', 'lateral_l', 'protrusion'];

function labelMap() {
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
    visitNo: '',
    clinic: '',
    visitDate: '',
    ruleVersion: rules.RULE_VERSION,
    state: null,
    hits: [],
    axis2Rows: [],
    sections: [],
    form: {},
    siteChecked: {},
    doctorNote: '',
    followUp: '',
    signed: false,
    signedBy: '',
    signedAtText: '',
    saving: false,
    signing: false,
  },

  onLoad(query) {
    this.reportId = query && query.id ? query.id : '';
    this.labels = labelMap();
    this.formData = {};
    this.load();
  },

  load() {
    const self = this;
    if (!self.reportId) {
      self.setData({ loading: false, hasReport: false });
      return Promise.resolve();
    }
    return store
      .getReportById(self.reportId)
      .then(function (report) {
        if (!report) {
          self.setData({ loading: false, hasReport: false });
          return;
        }
        self.report = report;
        const a1 = report.axis1 || {};

        // 表单初值：数组字段单独处理，数字转字符串交给 input
        const form = {};
        const siteChecked = {};
        axis1Data.SECTIONS.forEach(function (sec) {
          sec.items.forEach(function (it) {
            if (it.type === 'sites') {
              const arr = Array.isArray(a1[it.key]) ? a1[it.key].slice() : [];
              form[it.key] = arr;
              (it.options || []).forEach(function (o) {
                siteChecked[o.key] = arr.indexOf(o.key) >= 0;
              });
              return;
            }
            if (it.type === 'number') {
              const v = a1[it.key];
              form[it.key] = typeof v === 'number' ? String(v) : '';
              return;
            }
            form[it.key] = a1[it.key] || '';
          });
        });

        // 必填标记交给视图，避免在 wxml 里写死字段名
        const sections = axis1Data.SECTIONS.map(function (sec) {
          return {
            key: sec.key,
            title: sec.title,
            hint: sec.hint || '',
            items: sec.items.map(function (it) {
              return Object.assign({}, it, {
                required: axis1Data.REQUIRED.indexOf(it.key) >= 0,
              });
            }),
          };
        });

        self.formData = Object.assign({}, form);

        self.setData({
          loading: false,
          hasReport: true,
          visitNo: report.visit_no || '#' + report.visit_id,
          ruleVersion: report.rule_version || rules.RULE_VERSION,
          axis2Rows: view.ax2Rows(report.axis2),
          sections: sections,
          form: form,
          siteChecked: siteChecked,
          doctorNote: report.doctor_note || '',
          followUp: (report.follow_up && report.follow_up.text) || '',
          signed: report.status === 'signed',
          signedBy: report.signed_by || '',
          signedAtText: view.fmtTime(report.signed_at),
        });

        self.recalc();

        if (report.visit_id) {
          store.getVisit(report.visit_id).then(function (v) {
            if (!v) return;
            self.setData({ clinic: v.clinic || '', visitDate: v.visit_date || '' });
          });
        }
      })
      .catch(function (err) {
        console.warn('[颌心] desk detail load failed', err && err.message);
        self.setData({ loading: false, hasReport: false });
      });
  },

  // 表单 → axis1 原始记录。空值不写，避免把「没查」写成「正常」
  payload() {
    const src = this.formData || {};
    const out = {};
    Object.keys(src).forEach(function (k) {
      const v = src[k];
      if (Array.isArray(v)) {
        out[k] = v.slice();
        return;
      }
      if (v === '' || v === null || v === undefined) return;
      out[k] = NUM_KEYS.indexOf(k) >= 0 ? Number(v) : v;
    });
    return out;
  },

  recalc() {
    const axis1 = this.payload();
    const ev = rules.evaluate({ axis2: (this.report && this.report.axis2) || {}, axis1: axis1 });

    // 保留用户已展开的条目，避免每敲一个字就折叠回去
    const prev = {};
    (this.data.hits || []).forEach(function (h) {
      prev[h.ruleId] = h.open;
    });
    const labels = this.labels;
    const hits = ev.hits.map(function (h) {
      return Object.assign({}, h, {
        open: !!prev[h.ruleId],
        sourceText: (h.sourceItems || [])
          .map(function (k) {
            return labels[k] || String(k).toUpperCase();
          })
          .join('、'),
      });
    });

    this.lastEval = ev;
    this.setData({ state: ev.state, hits: hits });
  },

  /* ---------- 表单交互 ---------- */

  onNumber(e) {
    // 数字输入不回写 data.form：回写会让光标跳到末尾
    this.formData[e.currentTarget.dataset.key] = e.detail.value;
    this.recalc();
  },

  onText(e) {
    this.formData[e.currentTarget.dataset.key] = e.detail.value;
    this.recalc();
  },

  pickSingle(e) {
    const key = e.currentTarget.dataset.key;
    this.formData[key] = e.currentTarget.dataset.v;
    const form = Object.assign({}, this.data.form);
    form[key] = this.formData[key];
    this.setData({ form: form }, () => {
      this.recalc();
    });
  },

  toggleSite(e) {
    const key = e.currentTarget.dataset.key;
    let arr = (this.formData.palpation_sites || []).slice();
    const i = arr.indexOf(key);

    if (key === 'none') {
      // 「无」与具体部位互斥
      arr = i >= 0 ? [] : ['none'];
    } else if (i >= 0) {
      arr.splice(i, 1);
    } else {
      arr = arr.filter(function (k) {
        return k !== 'none';
      });
      arr.push(key);
    }
    this.formData.palpation_sites = arr;

    // 整组重算：互斥操作会同时改动多个勾选状态
    const checked = {};
    arr.forEach(function (k) {
      checked[k] = true;
    });

    const form = Object.assign({}, this.data.form, { palpation_sites: arr });
    this.setData({ form: form, siteChecked: checked }, () => {
      this.recalc();
    });
  },

  onNote(e) {
    this.setData({ doctorNote: e.detail.value });
  },

  onFollow(e) {
    this.setData({ followUp: e.detail.value });
  },

  toggleHit(e) {
    const i = Number(e.currentTarget.dataset.i);
    const hits = this.data.hits.slice();
    if (!hits[i]) return;
    hits[i] = Object.assign({}, hits[i], { open: !hits[i].open });
    this.setData({ hits: hits });
  },

  /* ---------- 保存与签核 ---------- */

  saveDraft() {
    const self = this;
    if (self.data.saving) return Promise.resolve();
    const ev = self.lastEval || rules.evaluate({ axis2: {}, axis1: self.payload() });
    self.setData({ saving: true });

    return store
      .saveReport({
        visit_id: self.report.visit_id,
        visit_no: self.report.visit_no,
        axis2: self.report.axis2,
        axis1: self.payload(),
        rule_state: ev.state.key,
        rule_hits: ev.hits,
        rule_version: ev.ruleVersion,
        doctor_note: self.data.doctorNote,
        follow_up: self.data.followUp ? { text: self.data.followUp } : null,
        doctor_action: self.report.doctor_action || 'adopt',
      })
      .then(function () {
        self.setData({ saving: false });
        wx.showToast({ title: '已暂存', icon: 'none' });
      })
      .catch(function (err) {
        self.setData({ saving: false });
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      });
  },

  sign() {
    const self = this;
    if (self.data.signing) return;

    const ev = self.lastEval;
    if (ev && !ev.axis1Complete) {
      wx.showModal({
        title: 'Axis I 还没录完',
        content: '缺 ' + ev.axis1Missing.length + ' 项关键体征。现在签核，报告会停在「待补录」。建议先补完再签。',
        confirmText: '仍然签核',
        cancelText: '回去补',
        success(res) {
          if (res.confirm) self.doSign();
        },
      });
      return;
    }
    self.doSign();
  },

  doSign() {
    const self = this;
    const ev = self.lastEval || rules.evaluate({ axis2: {}, axis1: self.payload() });
    self.setData({ signing: true });

    const nameJob = new Promise(function (resolve) {
      session
        .getSession()
        .then(function (s) {
          resolve((s && s.user && s.user.name) || '接诊医师');
        })
        .catch(function () {
          resolve('接诊医师');
        });
    });

    return nameJob
      .then(function (doctorName) {
        return store.signReport(self.report.id, {
          axis1: self.payload(),
          axis2: self.report.axis2,
          rule_state: ev.state.key,
          rule_hits: ev.hits,
          rule_version: ev.ruleVersion,
          doctor_note: self.data.doctorNote,
          doctor_action: 'adopt',
          follow_up: self.data.followUp ? { text: self.data.followUp } : null,
          doctor_name: doctorName,
        });
      })
      .then(function (row) {
        if (self.report.visit_id) store.updateVisitStatus(self.report.visit_id, 'signed');
        self.setData({
          signing: false,
          signed: true,
          signedBy: (row && row.signed_by) || '',
          signedAtText: view.fmtTime(row && row.signed_at),
        });
        wx.showToast({ title: '已签核，患者端可见', icon: 'none' });
      })
      .catch(function (err) {
        self.setData({ signing: false });
        wx.showToast({ title: (err && err.message) || '签核失败', icon: 'none' });
      });
  },

  withdraw() {
    const self = this;
    wx.showModal({
      title: '撤回签核',
      content: '撤回后患者端立刻看不到这份报告，需要重新签核才会恢复。',
      confirmText: '撤回',
      confirmColor: '#96564A',
      success(res) {
        if (!res.confirm) return;
        store
          .withdrawReport(self.report.id, '医师撤回')
          .then(function () {
            if (self.report.visit_id) store.updateVisitStatus(self.report.visit_id, 'submitted');
            self.setData({ signed: false, signedBy: '', signedAtText: '' });
            wx.showToast({ title: '已撤回', icon: 'none' });
          })
          .catch(function (err) {
            wx.showToast({ title: (err && err.message) || '撤回失败', icon: 'none' });
          });
      },
    });
  },
});
