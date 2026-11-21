const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');
const scales = require('../../data/scales');

const HABITS = [
  { key: 'clench', label: '紧咬牙关' },
  { key: 'contact', label: '上下牙接触' },
  { key: 'morning', label: '睡醒面部发紧' },
  { key: 'one_side', label: '单侧咀嚼' },
  { key: 'bite_lip', label: '咬唇或咬颊' },
  { key: 'hand', label: '用手托下颌' },
];

const TRIGGERS = [
  { value: 'work', label: '工作或学习' },
  { value: 'commute', label: '通勤路上' },
  { value: 'emotion', label: '情绪紧张时' },
  { value: 'eat', label: '吃东西时' },
  { value: 'screen', label: '长时间看屏幕' },
  { value: 'none', label: '没有明显诱因' },
];

const SLEEP = [
  { value: 5, label: '很好' },
  { value: 4, label: '还可以' },
  { value: 3, label: '一般' },
  { value: 2, label: '比较差' },
  { value: 1, label: '很差' },
];

Page({
  data: {
    date: '',
    nrs: 4,
    limit: 3,
    stress: 3,
    sleep: 4,
    trigger: '',
    note: '',
    nrsLevelText: '中度',
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    stressScale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    sleepOptions: SLEEP,
    triggerOptions: TRIGGERS,
    habitOptions: [],
    saving: false,
    errorMsg: '',
    savedLocal: false,
  },

  onLoad() {
    const today = store.today();
    const existing = local.getRecord(today);
    this.nrsTouched = !!existing && typeof existing.pain_nrs === 'number';

    this.applyRecord(existing, today);

    this.recent = [];
    store.listRecords(10).then((rows) => {
      this.recent = (rows || []).filter(function (r) {
        return r.record_date !== today && typeof r.pain_nrs === 'number';
      });
    });

    // 换设备时本机没有今天的记录，但账号里可能有：不能让默认值把真实记录覆盖掉
    store.todayRecord().then((row) => {
      if (!row || this.nrsTouched) return;
      this.applyRecord(row, today);
      this.nrsTouched = true;
    });
  },

  applyRecord(rec, today) {
    const habitOptions = HABITS.map((h) => ({
      key: h.key,
      label: h.label,
      checked: !!(rec && (rec.oral_habits || []).indexOf(h.label) >= 0),
    }));
    this.setData({
      date: today,
      habitOptions: habitOptions,
      nrsLevelText: scales.nrsLevel(
        rec && typeof rec.pain_nrs === 'number' ? rec.pain_nrs : 4
      ).label,
      nrs: rec && typeof rec.pain_nrs === 'number' ? rec.pain_nrs : 4,
      sleep: rec && rec.sleep_quality ? rec.sleep_quality : 4,
      stress: rec && typeof rec.stress === 'number' ? rec.stress : 3,
      trigger: (rec && rec.trigger) || '',
      limit: rec && typeof rec.function_limit === 'number' ? rec.function_limit : 3,
      note: (rec && rec.note) || '',
    });
  },

  onDate(e) {
    this.setData({ date: e.detail.value });
  },

  pickNrs(e) {
    const v = Number(e.currentTarget.dataset.value);
    this.nrsTouched = true;
    this.setData({ nrs: v, nrsLevelText: scales.nrsLevel(v).label });
  },

  onNrs(e) {
    const v = e.detail.value;
    this.nrsTouched = true;
    this.setData({ nrs: v, nrsLevelText: scales.nrsLevel(v).label });
  },

  pickStress(e) {
    this.setData({ stress: Number(e.currentTarget.dataset.value) });
  },

  pickSleep(e) {
    this.setData({ sleep: Number(e.currentTarget.dataset.value) });
  },

  pickTrigger(e) {
    const v = e.currentTarget.dataset.value;
    this.setData({ trigger: this.data.trigger === v ? '' : v });
  },

  onLimit(e) {
    this.setData({ limit: e.detail.value });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  toggleHabit(e) {
    const key = e.currentTarget.dataset.key;
    const habitOptions = this.data.habitOptions.map((h) => {
      if (h.key !== key) return h;
      return { key: h.key, label: h.label, checked: !h.checked };
    });
    this.setData({ habitOptions: habitOptions });
  },

  save() {
    if (this.data.saving) return;

    // 滑块有个默认位置，没动过就存会把默认值当成真实感受
    if (!this.nrsTouched) {
      wx.showModal({
        title: '先确认疼痛分数',
        content: '现在停在 ' + this.data.nrs + ' 分。如果不是你此刻的感觉，回去拖一下滑块再存。',
        confirmText: '就是 ' + this.data.nrs + ' 分',
        cancelText: '回去改',
        success: (r) => {
          if (!r.confirm) return;
          this.nrsTouched = true;
          this.save();
        },
      });
      return;
    }

    this.setData({ saving: true, errorMsg: '' });

    const habits = this.data.habitOptions.filter((h) => h.checked).map((h) => h.label);

    store
      .saveRecord({
        record_date: this.data.date,
        pain_nrs: this.data.nrs,
        sleep_quality: this.data.sleep,
        stress: this.data.stress,
        trigger: this.data.trigger || null,
        function_limit: this.data.limit,
        oral_habits: habits,
        note: this.data.note,
        anchor_done: true,
      })
      .then((res) => {
        this.setData({ saving: false, savedLocal: !(res && res.synced) });
        wx.showToast({ title: res && res.synced ? '已记录' : '已存本机', icon: 'none' });

        if (this.shouldEscalate(this.data.nrs)) {
          this.escalate();
          return;
        }
        setTimeout(() => {
          wx.navigateBack({
            fail: () => wx.switchTab({ url: '/pages/records/records' }),
          });
        }, 500);
      })
      .catch((err) => {
        console.warn('[颌心] record save failed', err && err.message);
        this.setData({
          saving: false,
          errorMsg: '没存上。你填的东西还在这一页，再试一次。',
        });
      });
  },

  // NRS ≥7，或比最近三次均值高出 3 分以上
  shouldEscalate(nrs) {
    if (typeof nrs !== 'number') return false;
    if (nrs >= 7) return true;
    const vals = (this.recent || [])
      .slice(0, 3)
      .map(function (r) { return r.pain_nrs; })
      .filter(function (v) { return typeof v === 'number'; });
    if (vals.length < 2) return false;
    const avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    return nrs - avg >= 3;
  },

  escalate() {
    wx.showModal({
      title: '这次比平时明显高',
      content:
        '先别加练。看看现在该做什么，或者把今天的状况生成摘要带给医生。记录已经存了，不耽误你接着用。',
      confirmText: '看该做什么',
      cancelText: '回到记录',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/care/care' });
        } else {
          wx.switchTab({ url: '/pages/records/records' });
        }
      },
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=record' });
  },
});
