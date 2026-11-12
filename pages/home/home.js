const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');
const course = require('../../data/course');
const triage = require('../../data/triage');
const scales = require('../../data/scales');
const screen = require('../../data/screen');
const psych = require('../../data/psych');
const weeks = require('../../utils/weeks');
const CONFIG = require('../../data/config');

function greetingText() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function dateLine() {
  const d = new Date();
  return d.getMonth() + 1 + '月' + d.getDate() + '日 · ' + WEEK[d.getDay()];
}

function formatDate(str) {
  if (!str) return '';
  const parts = String(str).split('-');
  if (parts.length < 3) return str;
  return parts[1] + '月' + parts[2] + '日';
}

Page({
  data: {
    greeting: '你好',
    dateLine: '',
    signedIn: false,
    needsScreen: false,
    screenDigest: null,
    psychDigest: null,
    justSaved: false,
    anchor: {
      open: false,
      done: false,
      nrs: null,
      clench: null,
      saving: false,
      pending: false,
      levelText: '',
      display: '—',
      tail: '点一下，用一个数字开始',
    },
    scale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    // 课程只给位置，不给内容：标题与摘要留在六周计划页，避免两处重复
    planState: { text: '' },
    lastRecord: null,
    careHint: { tone: 'info', text: '' },
    hasResearch: false,
    researchHint: '',
    pendingSync: false,
    weeklyRemind: true,
    screenWeek: { due: false, since: null, text: '' },
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setData({ greeting: greetingText(), dateLine: dateLine() });
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  refresh() {
    return Promise.all([
      session.getSession(),
      store.listRecords(30),
      store.listProgress(),
      store.listConsents(),
      store.todayRecord(),
      store.latestScreening(),
    ]).then((res) => {
      const s = res[0];
      const records = res[1] || [];
      const progress = res[2] || [];
      const consents = res[3] || [];
      const todayRec = res[4];
      const screenResult = res[5];

      const digest = screenResult && screenResult.axis1 ? screen.digest(screenResult) : null;

      // 每周一次复查：本周没做就提醒，做了就只留一行状态
      const lastScreenAt =
        screenResult && (screenResult.savedAt || screenResult.created_at || screenResult.saved_at);
      const weekDue = !!digest && weeks.isDue(lastScreenAt);
      const since = weeks.daysSince(lastScreenAt);

      const psychSaved = local.getPsych();
      const psychDigest = psychSaved ? psych.digest(psychSaved.result) : null;

      this.setData({
        signedIn: !!s,
        needsScreen: !digest,
        screenDigest: digest,
        psychDigest: psychDigest,
        pendingSync: local.hasPending(),
        weeklyRemind: local.isWeeklyRemind(),
        screenWeek: {
          due: weekDue,
          since: since,
          text: !digest
            ? '还没做过'
            : weekDue
              ? since && since > 0
                ? '上次是 ' + since + ' 天前'
                : '本周还没做'
              : '本周已完成',
        },
      });

      this.composeAnchor(todayRec, records);
      this.compose(records, progress, consents);
    });
  },

  /* ---------------- 每日锚点 ---------------- */

  composeAnchor(todayRec, records) {
    const done = !!(todayRec && (todayRec.anchor_done || typeof todayRec.pain_nrs === 'number'));
    const nrs = todayRec && typeof todayRec.pain_nrs === 'number' ? todayRec.pain_nrs : null;
    const clench = todayRec && typeof todayRec.clench_noticed === 'boolean' ? todayRec.clench_noticed : null;

    // 圆里只放一个数：有记录显示分数，没有就留白，不伪造数值
    let display = '—';
    let tail = '点一下，用一个数字开始';

    if (nrs !== null) {
      display = String(nrs);
      const today = store.today();
      const prev = (records || []).filter(
        (r) => r.record_date !== today && typeof r.pain_nrs === 'number'
      )[0];
      if (!prev) {
        tail = '第一条记录，往后才有参照';
      } else {
        const diff = nrs - prev.pain_nrs;
        if (diff <= -2) tail = '比上次轻 ' + Math.abs(diff) + ' 分';
        else if (diff >= 2) tail = '比上次重 ' + diff + ' 分';
        else tail = '和上次差不多';
      }
    } else if (clench !== null) {
      tail = '今天记下了紧咬的觉察';
    }

    this.setData({
      anchor: {
        open: !done,
        done: done,
        nrs: nrs,
        clench: clench,
        saving: false,
        pending: false,
        levelText: nrs === null ? '' : scales.nrsLevel(nrs).label,
        display: display,
        tail: tail,
      },
    });
  },

  toggleAnchor() {
    if (this.data.anchor.done) {
      wx.showToast({ title: '今天已经记过了', icon: 'none' });
      return;
    }
    this.setData({ 'anchor.open': !this.data.anchor.open });
  },

  pickNrs(e) {
    const v = Number(e.currentTarget.dataset.value);
    this.setData({
      'anchor.nrs': v,
      'anchor.levelText': scales.nrsLevel(v).label,
    });
  },

  pickClench(e) {
    const v = e.currentTarget.dataset.value === 'yes';
    this.setData({ 'anchor.clench': this.data.anchor.clench === v ? null : v });
  },

  saveAnchor() {
    const a = this.data.anchor;
    if (a.saving) return;
    if (typeof a.nrs !== 'number' && typeof a.clench !== 'boolean') {
      wx.showToast({ title: '至少选一个', icon: 'none' });
      return;
    }
    this.setData({ 'anchor.saving': true });

    store
      .saveAnchor({ pain_nrs: a.nrs, clench_noticed: a.clench })
      .then((res) => {
        this.setData({
          'anchor.saving': false,
          'anchor.done': true,
          'anchor.open': false,
          'anchor.pending': !(res && res.synced),
          pendingSync: local.hasPending(),
        });
        wx.showToast({ title: res && res.synced ? '已记录' : '已存本机', icon: 'none' });
        this.checkEscalation(a.nrs);
        this.refresh().then(() => {
          this.flashSaved();
        });
      })
      .catch(() => {
        this.setData({ 'anchor.saving': false });
        wx.showToast({ title: '没保存成功，再试一次', icon: 'none' });
      });
  },

  // 让圆里的数字轻落一次，作为保存成功的唯一动效
  flashSaved() {
    this.setData({ justSaved: false });
    setTimeout(() => {
      this.setData({ justSaved: true });
    }, 40);
    setTimeout(() => {
      this.setData({ justSaved: false });
    }, 760);
  },

  // 疼痛明显高于最近几次时，不要静默保存
  checkEscalation(nrs) {
    if (typeof nrs !== 'number' || nrs < 7) return;
    wx.showModal({
      title: '今天这个数字偏高',
      content:
        '疼痛到 ' +
        nrs +
        ' 分时，先别加练。可以先做两件事：看一遍需要就医的情况，或者把今天的状态生成一份摘要带给医生。',
      confirmText: '看该做什么',
      cancelText: '先不用',
      success: (res) => {
        if (res.confirm) wx.navigateTo({ url: '/pages/anxin/anxin?topic=flare' });
      },
    });
  },

  dismissAnchorPending() {
    this.setData({ 'anchor.pending': false });
  },

  /* ---------------- 课程位置 ---------------- */

  compose(records, progress, consents) {
    this.records = records;
    const last = records.length ? records[0] : null;
    let lastRecord = null;
    if (last) {
      const level = scales.nrsLevel(last.pain_nrs);
      lastRecord = {
        date: formatDate(last.record_date),
        nrs: last.pain_nrs,
        level: level.label,
        tone: level.tone,
        extra: typeof last.sleep_quality === 'number' ? '睡眠 ' + last.sleep_quality + '/5' : '已记录',
      };
    }

    const done = {};
    progress.forEach((p) => {
      if (p.review_done) done[p.week] = true;
    });
    let nextWeek = null;
    for (let i = 0; i < course.WEEKS.length; i += 1) {
      if (!done[course.WEEKS[i].week]) {
        nextWeek = course.WEEKS[i];
        break;
      }
    }
    const started = progress.length > 0;

    const aLine = consents.filter((c) => c.track === 'A' && c.consented)[0];
    const hasResearch = !!aLine;

    const planState = !nextWeek
      ? { text: '六周已完成' }
      : started
        ? { text: '进行到第 ' + nextWeek.week + ' 周' }
        : { text: '还没开始' };

    this.setData({
      planState: planState,
      lastRecord: lastRecord,
      careHint: triage.careHint(records),
      hasResearch: hasResearch,
      researchHint: hasResearch ? 'A 线研究任务与回访安排' : '',
    });
  },

  /* ---------------- 跳转 ---------------- */

  /* ---------------- 每周复查 ---------------- */

  onWeekCard() {
    if (this.data.screenWeek.due) {
      wx.navigateTo({ url: '/pages/screen/screen' });
      return;
    }
    this.goProfile();
  },

  onWeeklyRemind(e) {
    const on = !!e.detail.value;
    local.setWeeklyRemind(on);
    this.setData({ weeklyRemind: on });
    if (!on) return;

    const tmpl = CONFIG.weeklyTemplateId;
    if (!tmpl) {
      wx.showToast({ title: '已开启，打开时会提醒你', icon: 'none' });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [tmpl],
      success: () => wx.showToast({ title: '已开启每周提醒', icon: 'none' }),
      fail: () => wx.showToast({ title: '已开启应用内提醒', icon: 'none' }),
    });
  },

  goPsych() {
    wx.navigateTo({ url: '/pages/psych/psych' });
  },

  goScreen() {
    wx.navigateTo({ url: '/pages/screen/screen' });
  },

  goRecords() {
    wx.switchTab({ url: '/pages/records/records' });
  },

  goRecordEdit() {
    wx.navigateTo({ url: '/pages/record-edit/record-edit' });
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goTriage() {
    wx.navigateTo({ url: '/pages/triage/triage?mode=visit' });
  },

  goAnxin() {
    wx.navigateTo({ url: '/pages/anxin/anxin' });
  },

  goResearch() {
    wx.navigateTo({ url: '/pages/research/research' });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=home' });
  },
});
