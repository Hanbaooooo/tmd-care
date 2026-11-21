const psych = require('../../data/psych');
const local = require('../../utils/local');
const store = require('../../utils/store');
const rules = require('../../data/rules');
const scales = require('../../data/scales');

const TOTAL = psych.SECTIONS.length;

// 心理评估结果 → 报告用的 axis2。
// JFLS-8 记的是 8 项合计（0–80），报告按均分（0–10）展示与判定，这里换算一次。
function buildAxis2(result) {
  const map = {};
  (result.scores || []).forEach(function (s) {
    map[s.key] = s;
  });
  const out = {};
  if (map.obc) {
    out.obc = {
      score: map.obc.value,
      max: map.obc.max,
      band: map.obc.band,
      version: scales.OBC_FULL,
    };
  }
  if (map.gad7) out.gad7 = { score: map.gad7.value, max: 21, band: map.gad7.band };
  if (map.phq4) out.phq4 = { score: map.phq4.value, max: 12, band: map.phq4.band };
  if (map.jfls) {
    out.jfls8 = {
      score: Number((map.jfls.value / 8).toFixed(1)),
      max: 10,
      band: map.jfls.band,
    };
  }
  return out;
}

function dayText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getMonth() + 1 + ' 月 ' + d.getDate() + ' 日';
}

Page({
  data: {
    idx: 0,
    total: TOTAL,
    percent: 25,
    section: null,
    answered: 0,
    canNext: false,
    result: null,
    fromHistory: false,
    historyLine: '',
    saving: false,
  },

  onLoad() {
    this.answers = {};
    this.missKey = null;

    // 上一次的结果先给人看，想更新再点「再测一次」，不要一进来就把人推进 84 道题
    const saved = local.getPsych();
    if (saved && saved.result) {
      const d = psych.digest(saved.result);
      if (d) {
        const day = dayText(saved.saved_at || saved.result.savedAt);
        let line = day ? '这是 ' + day + ' 那次的结果。' : '这是上一次的结果。';
        line += d.stale
          ? '那次用的是旧版题目，分数和现在这套不一样，不能直接比，建议重测一次。'
          : '想看看现在的状态，就再测一次。';
        this.setData({ result: saved.result, fromHistory: true, historyLine: line });
        return;
      }
    }

    this.render(0);
  },

  buildSection(i) {
    const src = psych.SECTIONS[i];
    const self = this;
    const questions = src.questions.map(function (q) {
      const key = src.key + '.' + q.key;
      return {
        key: q.key,
        no: q.no,
        text: q.text,
        type: q.type,
        miss: self.missKey === q.key,
        options: q.options.map(function (o) {
          return {
            value: o.value,
            label: o.label,
            checked: self.answers[key] === o.value,
          };
        }),
      };
    });
    return {
      key: src.key,
      name: src.name,
      sub: src.sub,
      instruct: src.instruct,
      legend: src.legend,
      type: src.type,
      questions: questions,
    };
  },

  render(i) {
    const section = this.buildSection(i);
    const answered = section.questions.filter((q) => {
      return this.answers[section.key + '.' + q.key] !== undefined;
    }).length;
    this.setData({
      idx: i,
      percent: Math.round(((i + 1) / TOTAL) * 100),
      section: section,
      answered: answered,
      canNext: answered === section.questions.length,
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  pick(e) {
    const q = e.currentTarget.dataset.q;
    const v = Number(e.currentTarget.dataset.v);
    this.answers[this.data.section.key + '.' + q] = v;
    if (this.missKey === q) this.missKey = null;
    this.render(this.data.idx);
  },

  // 漏答时不只弹提示：直接滚到第一道没答的题，并把它标出来
  jumpToMissing() {
    const section = this.data.section;
    if (!section) return;
    const miss = section.questions.filter((q) => {
      return this.answers[section.key + '.' + q.key] === undefined;
    })[0];
    if (!miss) return;

    this.missKey = miss.key;
    this.render(this.data.idx);

    // setData 之后再量位置，否则拿到的是高亮之前的布局
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#item-' + miss.key).boundingClientRect();
      query.selectViewport().scrollOffset();
      query.exec((res) => {
        const rect = res && res[0];
        const scroll = res && res[1];
        if (!rect) return;
        wx.pageScrollTo({
          scrollTop: (scroll ? scroll.scrollTop : 0) + rect.top - 90,
          duration: 280,
        });
      });
    }, 60);
  },

  next() {
    if (!this.data.canNext) {
      const left = this.data.section.questions.length - this.data.answered;
      wx.showToast({
        title: '还有 ' + left + ' 题没选，已经跳过去了',
        icon: 'none',
      });
      this.jumpToMissing();
      return;
    }
    if (this.data.idx === TOTAL - 1) {
      this.finish();
      return;
    }
    this.missKey = null;
    this.render(this.data.idx + 1);
  },

  prev() {
    if (this.data.idx === 0) {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/home/home' }),
      });
      return;
    }
    this.missKey = null;
    this.render(this.data.idx - 1);
  },

  finish() {
    const result = psych.evaluate(this.answers);
    local.savePsych(result);
    this.setData({ saving: false, result: result, fromHistory: false, historyLine: '' });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    this.submitToVisit(result);
  },

  // 绑定过本次就诊就落一份报告：此刻还没有 Axis I，状态自然是「待补录」
  submitToVisit(result) {
    const self = this;
    store
      .currentVisit()
      .then(function (v) {
        if (!v) return null;
        const axis2 = buildAxis2(result);
        const ev = rules.evaluate({ axis2: axis2, axis1: {} });
        return store
          .saveReport({
            visit_id: v.id,
            visit_no: v.visit_no,
            axis2: axis2,
            axis1: {},
            rule_state: ev.state.key,
            rule_hits: ev.hits,
            rule_version: ev.ruleVersion,
          })
          .then(function () {
            return store.updateVisitStatus(v.id, 'submitted');
          })
          .then(function () {
            self.hasReport = true;
          });
      })
      .catch(function (err) {
        console.warn('[颌心] submit report failed', err && err.message);
      });
  },

  again() {
    this.answers = {};
    this.missKey = null;
    this.setData({ result: null, fromHistory: false, historyLine: '' });
    this.render(0);
  },

  goHome() {
    wx.switchTab({
      url: '/pages/home/home',
      fail: () => wx.reLaunch({ url: '/pages/home/home' }),
    });
  },

  goReport() {
    wx.navigateTo({ url: '/pages/report/report' });
  },
});
