const course = require('../../data/course');
const store = require('../../utils/store');
const session = require('../../utils/session');

Page({
  data: {
    week: course.WEEKS[0],
    learnDone: false,
    practiceDone: false,
    practiceCount: 0,
    reviewDone: false,
    reflection: '',
    saving: false,
    signedIn: false,
    quickOpen: false,
  },

  onLoad(options) {
    const weekNo = Number((options && options.week) || 1);
    const week = course.getWeek(weekNo) || course.WEEKS[0];
    this.progress = {
      learn_done: false,
      practice_done: false,
      review_done: false,
      practice_count: 0,
      reflection: '',
    };
    this.setData({ week: week });
    wx.setNavigationBarTitle({ title: '第 ' + week.week + ' 周' });
    this.loadProgress(week.week);
  },

  loadProgress(weekNo) {
    session.getSession().then((s) => {
      this.setData({ signedIn: !!s });
      return store.listProgress().then((rows) => {
        const hit = rows.filter((r) => Number(r.week) === weekNo)[0];
        if (!hit) return;
        this.progress = {
          learn_done: !!hit.learn_done,
          practice_done: !!hit.practice_done,
          review_done: !!hit.review_done,
          practice_count: hit.practice_count || 0,
          reflection: hit.reflection || '',
        };
        this.setData({
          learnDone: !!hit.learn_done,
          practiceDone: !!hit.practice_done,
          practiceCount: hit.practice_count || 0,
          reviewDone: !!hit.review_done,
          reflection: hit.reflection || '',
        });
      });
    });
  },

  persist(patch, successText) {
    const merged = {
      learn_done: this.progress.learn_done,
      practice_done: this.progress.practice_done,
      review_done: this.progress.review_done,
      practice_count: this.progress.practice_count,
      reflection: this.progress.reflection,
    };
    Object.keys(patch).forEach((k) => {
      merged[k] = patch[k];
    });

    return store
      .upsertProgress(this.data.week.week, merged)
      .then(() => {
        this.progress = merged;
        if (successText) wx.showToast({ title: successText, icon: 'none' });
        return merged;
      })
      .catch((err) => {
        console.warn('[颞安智护] progress save failed', err && err.message);
        wx.showModal({
          title: '尚未同步',
          content: '没存上，可能是网络。你写的内容还在这一页。',
          showCancel: false,
        });
        return null;
      });
  },

  markLearn() {
    this.persist({ learn_done: true }, '已标记读完').then((merged) => {
      if (!merged) return;
      this.setData({ learnDone: true });
    });
  },

  doPractice() {
    const next = (this.progress.practice_count || 0) + 1;
    this.persist({ practice_done: true, practice_count: next }, '记录一次练习').then((merged) => {
      if (!merged) return;
      this.setData({ practiceDone: true, practiceCount: next });
    });
  },

  toggleQuick() {
    this.setData({ quickOpen: !this.data.quickOpen });
  },

  onReflection(e) {
    this.setData({ reflection: e.detail.value });
  },

  saveReview() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    this.persist(
      { review_done: true, reflection: this.data.reflection, learn_done: true },
      '本周已完成'
    ).then((merged) => {
      if (!merged) {
        this.setData({ saving: false });
        return;
      }
      this.setData({ saving: false, reviewDone: true, learnDone: true });
    });
  },

  prevWeek() {
    const n = this.data.week.week - 1;
    if (n < 1) return;
    wx.redirectTo({ url: '/pages/week/week?week=' + n });
  },

  nextWeek() {
    const n = this.data.week.week + 1;
    if (n > 6) return;
    wx.redirectTo({ url: '/pages/week/week?week=' + n });
  },
});
