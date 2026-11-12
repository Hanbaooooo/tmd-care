const { SCALES, bandOf, profileOf, nrsLevel } = require('../../data/scales');
const store = require('../../utils/store');
const session = require('../../utils/session');

const VISIT_LABEL = {
  T0: 'T0 基线',
  T1: 'T1 第 6 周',
  T2: 'T2 第 12 周',
  T3: 'T3 第 6 个月',
};

Page({
  data: {
    scale: null,
    visit: 'T0',
    visitLabel: 'T0 基线',
    mode: 'likert',
    questions: [],
    extraOptions: [],
    hasExtra: false,
    gridItems: [],
    groups: [],
    nrsValue: 0,
    scoreText: '',
    bandText: '',
    scoreNote: '',
    saving: false,
    missIdx: -1,
    errorMsg: '',
  },

  onLoad(options) {
    const id = (options && options.id) || 'gad7';
    const visit = (options && options.visit) || 'T0';
    const scale = SCALES[id];
    if (!scale) {
      this.setData({ errorMsg: '未找到这份量表' });
      return;
    }
    this.scaleId = id;

    let mode = 'likert';
    if (scale.type === 'scale-10') mode = 'nrs';
    else if (scale.type === 'grid-10') mode = 'grid';
    else if (scale.type === 'structured') mode = 'structured';

    const patch = {
      scale: scale,
      visit: visit,
      visitLabel: VISIT_LABEL[visit] || visit,
      mode: mode,
      scoreNote: scale.scoring ? scale.scoring.note : '',
    };

    if (mode === 'likert') {
      const questions = scale.items.map((item, idx) => {
        const text = typeof item === 'string' ? item : item.text;
        // 按题切换锚点：OBC 前两题按「晚」计，其余按白天频率计
        const opts =
          scale.itemOptions && item && item.night ? scale.itemOptions.sleep : scale.options;
        return {
          idx: idx,
          text: text,
          hint: scale.itemOptions && item && item.night ? '这一题按「晚」数' : '',
          value: null,
          options: opts.map((o) => ({
            value: o.value,
            label: o.label,
            checked: false,
          })),
        };
      });
      patch.questions = questions;
      patch.hasExtra = !!scale.extra;
      if (scale.extra) {
        patch.extraOptions = scale.extra.options.map((label, i) => ({
          value: i,
          label: label,
          checked: false,
        }));
      }
    } else if (mode === 'nrs') {
      patch.nrsValue = 0;
    } else if (mode === 'grid') {
      patch.gridItems = scale.items.map((text, idx) => ({ idx: idx, text: text, value: 0 }));
    } else if (mode === 'structured') {
      patch.groups = scale.groups.map((g) => ({
        key: g.key,
        question: g.question,
        type: g.type,
        options: g.options.map((label, i) => ({
          value: String(i),
          label: label,
          checked: false,
        })),
      }));
    }

    this.setData(patch);
    wx.setNavigationBarTitle({ title: scale.short });
  },

  pickOption(e) {
    const qi = Number(e.currentTarget.dataset.q);
    const value = e.currentTarget.dataset.value;
    const questions = this.data.questions;
    const q = questions[qi];
    q.value = value;
    q.options = q.options.map((o) => ({
      value: o.value,
      label: o.label,
      checked: o.value === value,
    }));
    const patch = { questions: questions };
    if (this.data.missIdx === qi) {
      patch.missIdx = -1;
      patch.errorMsg = '';
    }
    this.setData(patch);
    this.recalc();
  },

  // 漏答时滚到第一道没答的题，并把它标出来
  jumpToMissing() {
    const miss = this.data.questions.filter((q) => q.value === null)[0];
    if (!miss) return;
    this.setData({ missIdx: miss.idx });

    // setData 之后再量位置，否则拿到的是高亮之前的布局
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('#q-' + miss.idx).boundingClientRect();
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

  pickExtra(e) {
    const value = Number(e.currentTarget.dataset.value);
    const extraOptions = this.data.extraOptions.map((o) => ({
      value: o.value,
      label: o.label,
      checked: o.value === value,
    }));
    this.setData({ extraOptions: extraOptions });
  },

  onNrs(e) {
    this.setData({ nrsValue: e.detail.value });
    this.recalc();
  },

  onGrid(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const gridItems = this.data.gridItems;
    gridItems[idx].value = e.detail.value;
    this.setData({ gridItems: gridItems });
    this.recalc();
  },

  pickGroup(e) {
    const gi = Number(e.currentTarget.dataset.g);
    const value = e.currentTarget.dataset.value;
    const groups = this.data.groups;
    const g = groups[gi];
    if (g.type === 'multi') {
      g.options = g.options.map((o) => ({
        value: o.value,
        label: o.label,
        checked: o.value === value ? !o.checked : o.checked,
      }));
    } else {
      g.options = g.options.map((o) => ({
        value: o.value,
        label: o.label,
        checked: o.value === value,
      }));
    }
    this.setData({ groups: groups });
  },

  recalc() {
    const mode = this.data.mode;
    const scale = this.data.scale;

    if (mode === 'nrs') {
      const v = this.data.nrsValue;
      const level = nrsLevel(v);
      this.setData({ scoreText: v + ' / 10', bandText: level.label });
      return;
    }

    if (mode === 'grid') {
      const vals = this.data.gridItems.map((i) => i.value);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      this.setData({ scoreText: avg.toFixed(1) + ' / 10', bandText: '取 8 项平均分' });
      return;
    }

    if (mode === 'likert') {
      const answered = this.data.questions.filter((q) => q.value !== null);
      const sum = answered.reduce((a, q) => a + Number(q.value), 0);
      const total = scale.items.length;
      const text = sum + ' / ' + scale.scoring.max;
      this.setData({
        scoreText: answered.length === total ? text : text + '（已答 ' + answered.length + '/' + total + '）',
        bandText: answered.length === total ? bandOf(this.scaleId, sum, scale.version) : '',
      });
    }
  },

  buildAnswers() {
    const mode = this.data.mode;
    if (mode === 'nrs') return { value: this.data.nrsValue };
    if (mode === 'grid') return {
      values: this.data.gridItems.map((i) => i.value),
    };
    if (mode === 'structured') {
      const out = {};
      this.data.groups.forEach((g) => {
        const picked = g.options.filter((o) => o.checked).map((o) => o.label);
        out[g.key] = g.type === 'multi' ? picked : picked[0] || '';
      });
      return out;
    }
    const out = {};
    this.data.questions.forEach((q, i) => {
      out['q' + (i + 1)] = q.value;
    });
    if (this.data.hasExtra) {
      const picked = this.data.extraOptions.filter((o) => o.checked)[0];
      out.extra = picked ? picked.label : '';
    }
    return out;
  },

  computeScore() {
    const mode = this.data.mode;
    if (mode === 'nrs') return this.data.nrsValue;
    if (mode === 'grid') {
      const vals = this.data.gridItems.map((i) => i.value);
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    }
    if (mode === 'likert') {
      return this.data.questions.reduce((a, q) => a + Number(q.value || 0), 0);
    }
    return null;
  },

  save() {
    if (this.data.saving) return;

    const mode = this.data.mode;
    if (mode === 'likert') {
      const missing = this.data.questions.filter((q) => q.value === null);
      if (missing.length) {
        this.setData({
          errorMsg: '还有 ' + missing.length + ' 道题没答。这个量表要全答完，已经跳到第一道。',
        });
        this.jumpToMissing();
        return;
      }
    }

    session.getSession().then((s) => {
      if (!s) {
        this.setData({ errorMsg: '还没登录，答案都在这一页，登录后可以直接交。' });
        wx.showModal({
          title: '还差一步登录',
          content: '研究量表要存进研究账户，登录后才能交。你现在填的答案不会丢。',
          confirmText: '去登录',
          cancelText: '先不交',
          success: (r) => {
            if (r.confirm) wx.navigateTo({ url: '/pages/login/login?from=scale' });
          },
        });
        return;
      }
      this.setData({ saving: true, errorMsg: '' });
      const scale = this.data.scale;
      const profile = profileOf(this.scaleId, scale.version);
      store
        .saveScaleResult({
          scale_id: this.scaleId,
          visit: this.data.visit,
          score: this.computeScore(),
          answers: this.buildAnswers(),
          // 版本三件套一起写：以后分析靠它分层
          version: scale.version,
          item_count: profile.itemCount,
          score_max: profile.max,
        })
        .then(() => {
          this.setData({ saving: false });
          wx.showToast({ title: '已提交', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 500);
        })
        .catch((err) => {
          console.warn('[颞安智护] scale save failed', err && err.message);
          this.setData({ saving: false, errorMsg: '没交上去，可能是网络问题。答案还在这一页。' });
        });
    });
  },
});
