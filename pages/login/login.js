const session = require('../../utils/session');
const store = require('../../utils/store');
const local = require('../../utils/local');

Page({
  data: {
    hasSession: false,
    wechatAvailable: false,
    step: 'start',
    email: '',
    code: '',
    sending: false,
    verifying: false,
    wechatBusy: false,
    error: '',
    pendingText: '',
    emailOpen: false,
  },

  onLoad(query) {
    this.challenge = null;
    this.from = (query && query.from) || '';
    this.setData({
      wechatAvailable: session.canWechatLogin(),
      pendingText: local.hasPending() ? '手机上有还没传上去的记录，登录后会自动补。' : '手机上的记录会跟着这次登录一起传上去。',
    });
    session.getSession().then((s) => {
      this.setData({ hasSession: !!s, step: s ? 'done' : 'start' });
    });
  },

  /* ---------------- 微信一键登录 ---------------- */

  onWechat() {
    if (this.data.wechatBusy) return;
    if (!this.data.wechatAvailable) {
      wx.showModal({
        title: '微信登录暂不可用',
        content: '现在是体验版，微信一键登录要等正式版。先用邮箱验证码，或者直接进去用，记录都存在手机上。',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }
    this.setData({ wechatBusy: true, error: '' });
    session
      .signInWithWechat()
      .then((s) => this.afterLogin(s))
      .catch((err) => {
        this.setData({ wechatBusy: false, error: (err && err.message) || '微信登录未完成' });
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
        this.setData({ sending: false, error: (err && err.message) || '验证码发送失败，请稍后再试' });
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

  onBack() {
    this.challenge = null;
    this.setData({ step: 'start', code: '', error: '' });
  },

  /* ---------------- 登录后的收尾 ---------------- */

  afterLogin(s) {
    getApp().globalData.session = s || null;
    local.setLocalMode(false);
    local.setSkipLogin(false);
    this.setData({ hasSession: true, step: 'done', wechatBusy: false, verifying: false });

    store
      .syncPending()
      .catch(() => null)
      .then((res) => {
        const n = res && res.synced ? res.synced : 0;
        wx.showToast({ title: n ? '已登录，补同步 ' + n + ' 条' : '已登录', icon: 'none' });
        setTimeout(() => this.goBack(), 700);
      });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/home' }),
    });
  },

  skip() {
    local.setLocalMode(true);
    local.setOnboarded(true);
    local.setSkipLogin(true);
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/home' }),
    });
  },

  onSignOut() {
    session.signOut().then(() => {
      this.setData({ hasSession: false, step: 'start' });
      wx.showToast({ title: '已退出登录', icon: 'none' });
    });
  },
});
