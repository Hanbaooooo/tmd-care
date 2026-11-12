const session = require('../../utils/session');
const local = require('../../utils/local');
const store = require('../../utils/store');

Page({
  data: {
    ready: false,
    wechatAvailable: false,
    emailOpen: false,
    step: 'start',
    email: '',
    code: '',
    sending: false,
    verifying: false,
    wechatBusy: false,
    error: '',
    pendingText: '',
  },

  onLoad(query) {
    this.challenge = null;
    this.forced = !!(query && query.force);
    this.setData({ wechatAvailable: session.canWechatLogin() });

    // 上次已经明确选过「先不登录」，就不再拦第二次
    if (!this.forced && local.isSkipLogin()) {
      this.goHome();
      return;
    }

    // 会话查询最多等 2.5 秒，避免网络慢时卡在「正在准备」
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500));

    Promise.race([session.getSession().catch(() => null), timeout])
      .then((s) => {
        if (s) {
          local.setSkipLogin(false);
          this.goHome();
          return;
        }
        this.setData({
          ready: true,
          pendingText: local.hasPending()
            ? '手机上有还没传上去的记录，登录后会自动补。'
            : '',
        });
      })
      .catch(() => {
        this.setData({ ready: true });
      });
  },

  goHome() {
    wx.switchTab({
      url: '/pages/home/home',
      fail: () => wx.reLaunch({ url: '/pages/home/home' }),
    });
  },

  /* ---------------- 微信一键登录 ---------------- */

  onWechat() {
    if (this.data.wechatBusy) return;
    if (!this.data.wechatAvailable) {
      this.setData({ emailOpen: true });
      return;
    }
    this.setData({ wechatBusy: true, error: '' });
    session
      .signInWithWechat()
      .then((s) => this.afterLogin(s))
      .catch((err) => {
        this.setData({
          wechatBusy: false,
          error: (err && err.message) || '微信登录没走完，先用邮箱吧',
        });
      });
  },

  /* ---------------- 邮箱验证码 ---------------- */

  toggleEmail() {
    this.setData({ emailOpen: !this.data.emailOpen, error: '' });
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value, error: '' });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value, error: '' });
  },

  onSendCode() {
    const email = (this.data.email || '').trim();
    if (!email || email.indexOf('@') < 0) {
      this.setData({ error: '请填写有效的邮箱地址' });
      return;
    }
    if (this.data.sending) return;
    this.setData({ sending: true, error: '' });
    session
      .sendEmailCode(email)
      .then((challenge) => {
        this.challenge = challenge;
        this.setData({ step: 'code', sending: false });
      })
      .catch((err) => {
        this.setData({ sending: false, error: (err && err.message) || '验证码没发出去，过会儿再试' });
      });
  },

  onVerify() {
    const code = (this.data.code || '').trim();
    if (code.length < 4) {
      this.setData({ error: '请输入收到的验证码' });
      return;
    }
    if (this.data.verifying) return;
    this.setData({ verifying: true, error: '' });
    session
      .verifyEmailCode(this.challenge, code)
      .then((s) => this.afterLogin(s))
      .catch((err) => {
        this.setData({ verifying: false, error: (err && err.message) || '验证码不正确或已过期' });
      });
  },

  onBackEmail() {
    this.challenge = null;
    this.setData({ step: 'start', code: '', error: '' });
  },

  /* ---------------- 收尾 ---------------- */

  afterLogin(s) {
    getApp().globalData.session = s || null;
    local.setSkipLogin(false);
    local.setOnboarded(true);
    local.setLocalMode(false);
    this.setData({ wechatBusy: false, verifying: false });

    store
      .syncPending()
      .catch(() => null)
      .then((res) => {
        const n = res && res.synced ? res.synced : 0;
        wx.showToast({ title: n ? '已登录，补同步 ' + n + ' 条' : '已登录', icon: 'none' });
        setTimeout(() => this.goHome(), 600);
      });
  },

  skip() {
    local.setSkipLogin(true);
    local.setOnboarded(true);
    local.setLocalMode(true);
    this.goHome();
  },
});
