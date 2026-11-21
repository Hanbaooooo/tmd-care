const { cloud } = require('./cloud');

// 会话缓存：一次启动内多处调用不再重复请求
const CACHE_MS = 20000;
let cachedSession = null;
let cachedAt = 0;
let inflight = null;

function unwrapSession(res) {
  if (!res) return null;
  const data = res.data !== undefined ? res.data : res;
  if (!data) return null;
  return data.session || data;
}

function normalize(session) {
  if (!session || !session.user) return null;
  return session;
}

function getSession(opts) {
  const force = opts && opts.force;
  if (!force && cachedAt && Date.now() - cachedAt < CACHE_MS) {
    return Promise.resolve(cachedSession);
  }
  if (!cloud) return Promise.resolve(null);
  if (inflight) return inflight;

  inflight = Promise.resolve()
    .then(function () {
      return cloud.auth.getSession();
    })
    .then(function (res) {
      cachedSession = normalize(unwrapSession(res));
      cachedAt = Date.now();
      inflight = null;
      return cachedSession;
    })
    .catch(function (err) {
      console.warn('[颌心] getSession failed', err && err.message);
      cachedSession = null;
      cachedAt = Date.now();
      inflight = null;
      return null;
    });
  return inflight;
}

function setSession(session) {
  cachedSession = normalize(session);
  cachedAt = Date.now();
}

function peek() {
  return cachedAt ? cachedSession : null;
}

/* ---------------- 微信登录 ---------------- */

function miniProgramAppId() {
  try {
    const info = wx.getAccountInfoSync();
    const id = info && info.miniProgram && info.miniProgram.appId;
    if (!id || id === 'touristappid') return '';
    return id;
  } catch (err) {
    return '';
  }
}

function canWechatLogin() {
  return !!miniProgramAppId();
}

function wxLogin() {
  return new Promise(function (resolve, reject) {
    wx.login({
      success: function (res) {
        if (res && res.code) resolve(res.code);
        else reject(new Error('微信未返回登录凭证'));
      },
      fail: function () {
        reject(new Error('微信登录未完成'));
      },
    });
  });
}

function signInWithWechat() {
  if (!cloud) return Promise.reject(new Error('云服务未初始化'));
  const appId = miniProgramAppId();
  if (!appId) {
    return Promise.reject(
      new Error('当前是体验版 AppID，微信一键登录暂不可用，请用邮箱验证码登录')
    );
  }
  return wxLogin()
    .then(function (code) {
      return cloud.auth.signInWithWechat(code, appId);
    })
    .then(function (res) {
      const session = normalize(unwrapSession(res));
      if (!session) throw new Error('微信登录未返回有效会话');
      setSession(session);
      return session;
    });
}

/* ---------------- 邮箱验证码 ---------------- */

function sendEmailCode(email) {
  if (!cloud) return Promise.reject(new Error('云服务未初始化'));
  return Promise.resolve()
    .then(function () {
      return cloud.auth.signInWithOtp({ email: email });
    })
    .then(function (res) {
      return res && res.data !== undefined ? res.data : res;
    });
}

// challenge 由 sendEmailCode 返回，验证码校验通过即登录成功
function verifyEmailCode(challenge, token) {
  if (!challenge || typeof challenge.verify !== 'function') {
    return Promise.reject(new Error('验证会话已失效，请重新获取验证码'));
  }
  return Promise.resolve()
    .then(function () {
      return challenge.verify({ token: token });
    })
    .then(function (res) {
      const session = normalize(unwrapSession(res));
      if (!session) throw new Error('验证码不正确或已过期');
      setSession(session);
      return session;
    });
}

function signOut() {
  if (!cloud) return Promise.resolve();
  cachedSession = null;
  cachedAt = Date.now();
  return Promise.resolve()
    .then(function () {
      return cloud.auth.signOut();
    })
    .catch(function () {});
}

module.exports = {
  getSession,
  setSession,
  peek,
  sendEmailCode,
  verifyEmailCode,
  signInWithWechat,
  canWechatLogin,
  signOut,
};
