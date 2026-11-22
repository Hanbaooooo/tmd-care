const store = require('../../utils/store');
const session = require('../../utils/session');
const local = require('../../utils/local');
const triage = require('../../data/triage');
const scales = require('../../data/scales');
const screen = require('../../data/screen');
const psych = require('../../data/psych');
const weeks = require('../../utils/weeks');
const CONFIG = require('../../data/config');

// 扫码进店时自动建档用的诊所名。改这里就够，不用去动数据库。
const CLINIC_NAME = CONFIG.clinicName || '口腔颌面疼痛专科';

// 这些 scene 都表示「扫了码进来」：1011 扫码 / 1012 长按识别 / 1013 相册二维码 /
// 1047 扫小程序码 / 1048 长按识别小程序码。扫的是诊台那张固定码，没有带参，
// 所以只能靠 scene 判断，不能靠 query。
const SCAN_SCENES = [1011, 1012, 1013, 1047, 1048];
const SCAN_MARK_KEY = 'hexin_scan_bound_day';

// 就诊状态只影响「医师那边看到什么」，不评价病情
const VISIT_STATUS = {
  waiting_self_report: { text: '待自评', tone: 'note', act: '开始自评' },
  submitted: { text: '待医师复核', tone: 'caution', act: '查看报告' },
  signed: { text: '医师已签核', tone: 'calm', act: '查看定稿报告' },
};

function visitView(row) {
  if (!row) {
    return {
      has: false,
      id: null,
      visitNo: '',
      statusText: '未绑定',
      tone: 'note',
      metaText: '',
      actText: '绑定本次就诊',
      nameText: '',
      hasName: false,
    };
  }
  const st = VISIT_STATUS[row.status] || VISIT_STATUS.waiting_self_report;
  const meta = [row.clinic, row.visit_date].filter(Boolean).join(' · ');
  const name = row.owner_name || '';
  return {
    has: true,
    id: row.id,
    visitNo: row.visit_no || '',
    statusText: st.text,
    tone: st.tone,
    metaText: meta,
    actText: st.act,
    nameText: name,
    hasName: !!name,
  };
}

// 本次启动是不是扫码进来的
function launchedByScan() {
  let opt = {};
  try {
    opt = wx.getEnterOptionsSync() || {};
  } catch (err) {
    opt = {};
  }
  if (SCAN_SCENES.indexOf(Number(opt.scene)) >= 0) return true;
  const q = opt.query || {};
  // 兜底：普通链接二维码（?q=）或带参数的码
  return q.src === 'clinic' || q.from === 'scan';
}

function newVisitNo() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  const tail = String(Math.floor(Math.random() * 9000) + 1000);
  return 'V' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + tail;
}

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
    // 本次就诊：候诊扫码后建立，之后所有填写都挂在它下面
    visit: {
      has: false,
      id: null,
      visitNo: '',
      statusText: '',
      tone: 'note',
      metaText: '',
      actText: '绑定本次就诊',
    },
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
    lastRecord: null,
    careHint: { tone: 'info', text: '' },
    pendingSync: false,
    weeklyRemind: true,
    screenWeek: { due: false, since: null, text: '' },
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.setData({ greeting: greetingText(), dateLine: dateLine() });
    this.refresh().then(() => {
      this.maybeBindFromScan();
    });
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
      store.currentVisit(),
    ]).then((res) => {
      const s = res[0];
      const records = res[1] || [];
      const progress = res[2] || [];
      const consents = res[3] || [];
      const todayRec = res[4];
      const screenResult = res[5];
      const visitRow = res[6];

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
        visit: visitView(visitRow),
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
        if (res.confirm) wx.switchTab({ url: '/pages/care/care' });
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

    this.setData({
      lastRecord: lastRecord,
      careHint: triage.careHint(records),
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
    wx.showToast({ title: '六周计划已下线', icon: 'none' });
  },

  goTriage() {
    wx.navigateTo({ url: '/pages/triage/triage?mode=visit' });
  },

  /* ---------- 本次就诊 ---------- */

  // 扫码进店就当候诊：直接把「本次就诊」建好，不再让患者自己点一次「绑定」。
  // 只在「扫码启动 + 今天还没就诊 + 今天没自动建过」时执行一次。
  maybeBindFromScan() {
    if (this._bindTried) return;
    this._bindTried = true;
    if (!launchedByScan() || this.data.visit.has) return;

    let boundDay = '';
    try {
      boundDay = wx.getStorageSync(SCAN_MARK_KEY) || '';
    } catch (err) {
      boundDay = '';
    }
    if (boundDay === store.today()) return;
    this.autoCreateVisit();
  },

  autoCreateVisit() {
    const self = this;
    if (this._autoBusy) return;
    this._autoBusy = true;
    const done = () => {
      this._autoBusy = false;
    };

    // 没有会话先静默登录：wx.login 拿 code 不需要用户点任何东西
    session
      .getSession()
      .then(function (s) {
        return s || (session.canWechatLogin() ? session.signInWithWechat() : null);
      })
      .then(function (s) {
        if (!s) throw new Error('no-session');
        return store.createVisit({
          visit_no: newVisitNo(),
          clinic: CLINIC_NAME,
          status: 'waiting_self_report',
          source: 'scan',
        });
      })
      .then(function (row) {
        done();
        if (!row) throw new Error('empty');
        try {
          wx.setStorageSync(SCAN_MARK_KEY, store.today());
        } catch (err) {}
        self.setData({ visit: visitView(row), signedIn: true });
        self.askName(true);
      })
      .catch(function () {
        done();
        // 失败不弹错：卡片还在，患者点一下就是手动绑定
      });
  },

  askName(first) {
    const self = this;
    if (!this.data.visit.has) return;
    wx.showModal({
      title: first ? '留个称呼' : '修改称呼',
      editable: true,
      placeholderText: '如：王女士（医师认人用）',
      content: this.data.visit.nameText || '',
      confirmText: '保存',
      cancelText: first ? '稍后' : '取消',
      success(res) {
        if (!res.confirm) return;
        const name = String(res.content || '')
          .trim()
          .slice(0, 20);
        store.updateVisitName(self.data.visit.id, name).then(function (row) {
          if (!row) {
            wx.showToast({ title: '没保存上，稍后再试', icon: 'none' });
            return;
          }
          self.setData({ visit: visitView(row) });
        });
      },
    });
  },

  editName() {
    if (!this.data.visit.has) return;
    this.askName(false);
  },

  // 没有就诊时点一下：建一条。真实场景由诊所二维码带参，演示时直接生成。
  bindVisit() {
    const self = this;
    if (!this.data.signedIn) {
      wx.showModal({
        title: '先登录',
        content: '登录后这次的填写才能和就诊记录对上，医师在诊室里才看得到。',
        confirmText: '去登录',
        success(res) {
          if (res.confirm) self.goLogin();
        },
      });
      return;
    }
    wx.showLoading({ title: '正在建立…' });
    store
      .createVisit({
        visit_no: newVisitNo(),
        clinic: CLINIC_NAME,
        status: 'waiting_self_report',
        source: 'manual',
      })
      .then(function (row) {
        wx.hideLoading();
        if (!row) throw new Error('未返回就诊记录');
        self.setData({ visit: visitView(row) });
        self.askName(true);
      })
      .catch(function (err) {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || '建立失败', icon: 'none' });
      });
  },

  onVisitCard() {
    if (!this.data.visit.has) {
      this.bindVisit();
      return;
    }
    if (this.data.visit.statusText === '待自评') {
      wx.navigateTo({ url: '/pages/psych/psych' });
      return;
    }
    this.goReport();
  },

  goReport() {
    const id = this.data.visit.id;
    wx.navigateTo({ url: id ? '/pages/report/report?visit=' + id : '/pages/report/report' });
  },

  goDesk() {
    wx.navigateTo({ url: '/pages/desk/desk' });
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=home' });
  },
});
