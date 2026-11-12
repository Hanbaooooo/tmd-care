const screen = require('../../data/screen');
const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');
const scales = require('../../data/scales');
const weeks = require('../../utils/weeks');

const DRAFT_KEY = 'tmd_screen_draft';

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

Page({
  data: {
    stepIndex: 0,
    total: 0,
    percent: 0,
    stepView: null,
    canNext: false,
    resumed: false,
    saving: false,
    savingText: '',
    isFirst: true,
    stepIndexText: '01',
    weekLabel: '',
  },

  onLoad() {
    this.answers = { redFlags: [] };
    this.steps = screen.buildSteps(this.answers);

    // 每周一次：本周已经做过就明说，不假装是第一次
    const last = local.getScreen();
    const lastAt = last && (last.saved_at || (last.result && last.result.savedAt));
    this.setData({ weekLabel: weeks.isDue(lastAt) ? '每周一次 · 约 2 分钟' : '本周已做过 · 再做会更新本周结果' });

    const draft = this.restoreDraft();
    if (draft) {
      this.answers = draft.answers;
      this.steps = screen.buildSteps(this.answers);
      const idx = this.indexOfKey(draft.stepKey);
      this.setData({ total: this.steps.length, resumed: idx > 0 });
      this.render(idx);
      return;
    }
    this.setData({ total: this.steps.length });
    this.render(0);
  },

  indexOfKey(key) {
    if (!key) return 0;
    for (let i = 0; i < this.steps.length; i += 1) {
      if (this.steps[i].key === key) return i;
    }
    return 0;
  },

  restoreDraft() {
    try {
      const d = wx.getStorageSync(DRAFT_KEY);
      if (!d || !d.answers || !d.answers.complaint) return null;
      return d;
    } catch (err) {
      return null;
    }
  },

  saveDraft(stepKey) {
    try {
      wx.setStorageSync(DRAFT_KEY, { answers: this.answers, stepKey: stepKey, at: Date.now() });
    } catch (err) {
      /* 本地草稿失败不影响流程 */
    }
  },

  clearDraft() {
    try {
      wx.removeStorageSync(DRAFT_KEY);
    } catch (err) {
      /* ignore */
    }
  },

  render(index) {
    this.steps = screen.buildSteps(this.answers);
    const total = this.steps.length;
    const i = Math.max(0, Math.min(index, total - 1));
    const step = this.steps[i];
    const answers = this.answers;
    const view = { key: step.key, type: step.type, title: step.title, hint: step.hint || '' };

    if (step.type === 'flags') {
      view.items = screen.RED_FLAGS.map(function (f) {
        return { key: f.key, label: f.label, checked: (answers.redFlags || []).indexOf(f.key) >= 0 };
      });
      view.count = (answers.redFlags || []).length;
    } else {
      view.questions = step.questions.map(function (q, qi) {
        const out = { key: q.key, type: q.type, title: q.title, hint: q.hint || '', no: pad2(qi + 1) };
        const cur = answers[q.key];

        if (q.type === 'multi') {
          const list = Array.isArray(cur) ? cur : [];
          out.options = q.options.map(function (o) {
            return { value: o.value, label: o.label, checked: list.indexOf(o.value) >= 0 };
          });
        } else if (q.type === 'single') {
          out.options = q.options.map(function (o) {
            return { value: o.value, label: o.label, checked: cur === o.value };
          });
        } else if (q.type === 'scale') {
          const max = q.max || 10;
          const picked = typeof cur === 'number';
          out.scale = [];
          for (let v = 0; v <= max; v += 1) {
            out.scale.push({ value: v, active: picked && v === cur });
          }
          out.valueText = picked ? String(cur) : '未选';
          out.levelText = picked && q.key === 'nrs' ? scales.nrsLevel(cur).label : '';
        } else if (q.type === 'grid') {
          const list = Array.isArray(cur) ? cur : [];
          out.legend = q.legend || '';
          out.rows = q.items.map(function (label, idx) {
            return {
              index: idx,
              label: label,
              options: q.options.map(function (o) {
                return { value: o.value, label: o.label, checked: list[idx] === o.value };
              }),
            };
          });
        }
        return out;
      });
    }

    this.setData({
      stepIndex: i,
      total: total,
      stepView: view,
      percent: Math.round(((i + 1) / total) * 100),
      canNext: this.validate(view),
      isFirst: i === 0,
      stepIndexText: pad2(i + 1),
    });
  },

  validate(view) {
    const answers = this.answers;
    if (view.type === 'flags') return true;
    for (let i = 0; i < view.questions.length; i += 1) {
      const q = view.questions[i];
      const cur = answers[q.key];
      if (q.type === 'multi') {
        if (!cur || !cur.length) return false;
      } else if (q.type === 'grid') {
        if (!cur || cur.length !== q.rows.length) return false;
        for (let j = 0; j < cur.length; j += 1) {
          if (typeof cur[j] !== 'number') return false;
        }
      } else if (q.type === 'scale') {
        if (typeof cur !== 'number') return false;
      } else if (q.type === 'single') {
        if (cur === undefined || cur === null || cur === '') return false;
      }
    }
    return true;
  },

  toggleFlag(e) {
    const key = e.currentTarget.dataset.key;
    const list = (this.answers.redFlags || []).slice();
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1);
    else list.push(key);
    this.answers.redFlags = list;
    this.render(this.data.stepIndex);
  },

  clearFlags() {
    this.answers.redFlags = [];
    this.render(this.data.stepIndex);
  },

  pickOption(e) {
    const qkey = e.currentTarget.dataset.q;
    const value = e.currentTarget.dataset.value;
    const q = this.findQuestion(qkey);
    if (!q) return;
    if (q.type === 'multi') {
      const list = (this.answers[qkey] || []).slice();
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1);
      else list.push(value);
      this.answers[qkey] = list;
    } else {
      this.answers[qkey] = value;
    }
    this.render(this.data.stepIndex);
  },

  pickScale(e) {
    const qkey = e.currentTarget.dataset.q;
    this.answers[qkey] = Number(e.currentTarget.dataset.value);
    this.render(this.data.stepIndex);
  },

  pickGrid(e) {
    const qkey = e.currentTarget.dataset.q;
    const row = Number(e.currentTarget.dataset.row);
    const value = Number(e.currentTarget.dataset.value);
    const list = this.answers[qkey] ? this.answers[qkey].slice() : [];
    list[row] = value;
    this.answers[qkey] = list;
    this.render(this.data.stepIndex);
  },

  findQuestion(qkey) {
    const step = this.steps[this.data.stepIndex];
    if (!step || !step.questions) return null;
    for (let i = 0; i < step.questions.length; i += 1) {
      if (step.questions[i].key === qkey) return step.questions[i];
    }
    return null;
  },

  prev() {
    if (this.data.stepIndex === 0) {
      wx.navigateBack({
        fail: function () {
          wx.switchTab({ url: '/pages/home/home' });
        },
      });
      return;
    }
    this.render(this.data.stepIndex - 1);
  },

  missingKey() {
    const view = this.data.stepView;
    if (!view || view.type === 'flags' || !view.questions) return '';
    const answers = this.answers;
    for (let i = 0; i < view.questions.length; i += 1) {
      const q = view.questions[i];
      const cur = answers[q.key];
      let ok = true;
      if (q.type === 'multi') ok = !!(cur && cur.length);
      else if (q.type === 'scale') ok = typeof cur === 'number';
      else ok = !(cur === undefined || cur === null || cur === '');
      if (!ok) return q.key;
    }
    return '';
  },

  // 这一屏有没答的，滚到那一题，别让人自己找
  scrollToQuestion(key) {
    if (!key) return;
    const query = wx.createSelectorQuery().in(this);
    query.select('#sq-' + key).boundingClientRect();
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
  },

  next() {
    if (!this.data.canNext) {
      wx.showToast({ title: '这一屏还有没答的', icon: 'none' });
      this.scrollToQuestion(this.missingKey());
      return;
    }

    const before = this.steps.length;
    this.answers = screen.pruneAnswers(this.answers, screen.buildSteps(this.answers));
    const steps = screen.buildSteps(this.answers);

    // 首屏改了选择之后分支会变短，停在原地往下走
    if (steps.length < before && this.data.stepIndex >= steps.length - 1) {
      this.render(steps.length - 1);
      this.saveDraft(steps[steps.length - 1].key);
      return;
    }

    if (this.data.stepIndex < steps.length - 1) {
      const nextIndex = this.data.stepIndex + 1;
      this.saveDraft(steps[nextIndex].key);
      this.render(nextIndex);
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
      return;
    }

    this.finish();
  },

  finish() {
    if (this.data.saving) return;
    const result = screen.evaluate(clone(this.answers));
    result.savedAt = new Date().toISOString();
    result.weekKey = weeks.keyOf();

    local.saveScreen(result);
    getApp().globalData.screenResult = result;
    this.clearDraft();

    this.setData({ saving: true, savingText: '正在保存…' });

    session.getSession().then((s) => {
      if (!s) {
        this.setData({ saving: false });
        wx.redirectTo({ url: '/pages/profile/profile?local=1' });
        return null;
      }
      return store
        .saveScreening(result)
        .then((res) => {
          this.setData({ saving: false });
          wx.redirectTo({ url: '/pages/profile/profile?' + (res && res.synced ? 'synced=1' : 'pending=1') });
        })
        .catch(() => {
          this.setData({ saving: false });
          wx.redirectTo({ url: '/pages/profile/profile?pending=1' });
        });
    });
  },
});
