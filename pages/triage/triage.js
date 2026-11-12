const triage = require('../../data/triage');
const store = require('../../utils/store');

function buildQuestions() {
  return triage.STEPS.map((s) => {
    const q = {
      key: s.key,
      title: s.title,
      hint: s.hint,
      type: s.type,
      options: [],
      value: '',
    };
    if (s.options) {
      q.options = s.options.map((o) => ({ value: o.value, label: o.label, checked: false }));
    }
    return q;
  });
}

Page({
  data: {
    mode: 'symptom',
    stage: 'safety',
    redFlags: [],
    hasFlag: false,
    qIndex: 0,
    total: 0,
    progressPercent: 0,
    q: null,
    scaleValue: 5,
    canNext: false,
    result: null,
    saving: false,
  },

  onLoad(options) {
    const redFlags = triage.RED_FLAGS.map((f) => ({
      key: f.key,
      label: f.label,
      checked: false,
    }));
    this.questions = buildQuestions();
    this.answers = {};
    this.setData({
      mode: (options && options.mode) || 'symptom',
      redFlags: redFlags,
      total: this.questions.length,
      scaleValue: 5,
    });
  },

  toggleFlag(e) {
    const key = e.currentTarget.dataset.key;
    const redFlags = this.data.redFlags.map((f) => {
      if (f.key !== key) return f;
      return { key: f.key, label: f.label, checked: !f.checked };
    });
    const hasFlag = redFlags.some((f) => f.checked);
    this.setData({ redFlags: redFlags, hasFlag: hasFlag });
  },

  afterSafety() {
    if (this.data.hasFlag) {
      const flags = this.data.redFlags.filter((f) => f.checked).map((f) => f.label);
      const result = triage.evaluate({}, flags);
      this.setData({ stage: 'result', result: result });
      return;
    }
    this.enterQuestion(0);
  },

  enterQuestion(index) {
    const q = this.questions[index];
    this.setData({
      stage: 'question',
      qIndex: index,
      q: q,
      progressPercent: Math.round(((index + 1) / this.questions.length) * 100),
      canNext: this.checkCanNext(q),
      scaleValue: index === this.questions.length - 1 ? 5 : this.data.scaleValue,
    });
  },

  checkCanNext(q) {
    if (!q) return false;
    if (q.type === 'scale') return true;
    if (q.type === 'single') return !!q.value;
    return q.options.some((o) => o.checked);
  },

  toggleOption(e) {
    const value = e.currentTarget.dataset.value;
    const q = this.questions[this.data.qIndex];
    if (q.type === 'single') {
      q.options = q.options.map((o) => ({
        value: o.value,
        label: o.label,
        checked: o.value === value,
      }));
      q.value = value;
    } else {
      q.options = q.options.map((o) => {
        if (o.value !== value) return o;
        return { value: o.value, label: o.label, checked: !o.checked };
      });
    }
    this.setData({ q: q, canNext: this.checkCanNext(q) });
  },

  onScaleChange(e) {
    this.setData({ scaleValue: e.detail.value });
  },

  collect(q) {
    if (q.type === 'scale') {
      this.answers[q.key] = this.data.scaleValue;
      return;
    }
    if (q.type === 'single') {
      this.answers[q.key] = q.value;
      return;
    }
    this.answers[q.key] = q.options.filter((o) => o.checked).map((o) => o.value);
  },

  next() {
    if (!this.data.canNext) {
      wx.showToast({ title: '先选一项再继续', icon: 'none' });
      return;
    }
    const q = this.questions[this.data.qIndex];
    this.collect(q);

    if (this.data.qIndex + 1 >= this.questions.length) {
      this.finish();
      return;
    }
    this.enterQuestion(this.data.qIndex + 1);
  },

  prev() {
    if (this.data.qIndex === 0) {
      this.setData({ stage: 'safety' });
      return;
    }
    const q = this.questions[this.data.qIndex];
    this.collect(q);
    this.enterQuestion(this.data.qIndex - 1);
  },

  finish() {
    const flags = this.data.redFlags.filter((f) => f.checked).map((f) => f.label);
    const result = triage.evaluate(this.answers, flags);
    this.setData({ stage: 'result', result: result });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  buildSummary() {
    const a = this.answers || {};
    const q = this.questions;
    const labelOf = (key, value) => {
      const target = q.filter((item) => item.key === key)[0];
      if (!target || !target.options) return value;
      const hit = target.options.filter((o) => o.value === value)[0];
      return hit ? hit.label : value;
    };
    const listOf = (key) => {
      const arr = a[key] || [];
      return arr.map((v) => labelOf(key, v));
    };

    return {
      generated_at: new Date().toISOString(),
      sites: listOf('sites'),
      duration: labelOf('duration', a.duration),
      triggers: listOf('aggravate'),
      noise: labelOf('noise', a.noise),
      opening: labelOf('opening', a.opening),
      burden: typeof a.burden === 'number' ? a.burden : null,
      red_flags: this.data.redFlags.filter((f) => f.checked).map((f) => f.label),
      care_level: this.data.result ? this.data.result.level : 'self',
      next_step: this.data.result ? this.data.result.headline : '',
    };
  },

  saveAndSummary() {
    if (this.data.saving) return;
    this.setData({ saving: true });

    const summary = this.buildSummary();
    const app = getApp();
    app.globalData.summaryDraft = summary;

    const payload = {
      locations: summary.sites,
      duration: summary.duration,
      triggers: summary.triggers,
      red_flags: summary.red_flags,
      care_level: summary.care_level,
      summary: summary,
    };

    store
      .saveTriage(payload)
      .then(() => {
        this.setData({ saving: false });
        wx.navigateTo({ url: '/pages/summary/summary?synced=1' });
      })
      .catch((err) => {
        this.setData({ saving: false });
        console.warn('[颞安智护] triage save failed', err && err.message);
        wx.showModal({
          title: '尚未同步',
          content: '这份没存到云端，可能还没登录。可以先看摘要，登录后再存。',
          confirmText: '查看摘要',
          showCancel: false,
          success: () => {
            wx.navigateTo({ url: '/pages/summary/summary?synced=0' });
          },
        });
      });
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },
});
