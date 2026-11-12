const store = require('../../utils/store');

Page({
  data: {
    synced: true,
    summary: null,
    siteText: '',
    triggerText: '',
    burdenText: '',
    flagText: '',
  },

  onLoad(options) {
    const synced = !(options && options.synced === '0');
    const draft = getApp().globalData.summaryDraft;
    if (draft) {
      this.render(draft, synced);
      return;
    }
    store.latestSummary().then((row) => {
      if (row && row.content) {
        this.render(row.content, true);
      } else {
        this.setData({ synced: synced, summary: null });
      }
    });
  },

  render(summary, synced) {
    const siteText = (summary.sites || []).join('、') || '未填写';
    const triggerText = (summary.triggers || []).join('、') || '未填写';
    const burdenText =
      typeof summary.burden === 'number' ? summary.burden + ' / 10' : '未填写';
    const flagText = (summary.red_flags || []).join('；');
    this.setData({
      synced: synced,
      summary: summary,
      siteText: siteText,
      triggerText: triggerText,
      burdenText: burdenText,
      flagText: flagText,
    });
  },

  copyText() {
    const s = this.data.summary;
    if (!s) return;
    const lines = [
      '就诊摘要（你自己说的，不是诊断）',
      '不适位置：' + this.data.siteText,
      '持续时间：' + (s.duration || '未填写'),
      '加重情况：' + this.data.triggerText,
      '关节声音：' + (s.noise || '未填写'),
      '张口情况：' + (s.opening || '未填写'),
      '生活影响：' + this.data.burdenText,
    ];
    if (this.data.flagText) lines.push('需要医生注意：' + this.data.flagText);
    if (s.next_step) lines.push('建议下一步：' + s.next_step);

    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => {
        wx.showToast({ title: '已复制', icon: 'none' });
      },
    });
  },

  goCare() {
    wx.switchTab({ url: '/pages/care/care' });
  },

  goTriage() {
    wx.redirectTo({ url: '/pages/triage/triage' });
  },
});
