/* 云客户端：所有数据都经本站 /api/rpc/* 转发出去（见 server.js）。
   浏览器不直连小程序云，也不接触任何密钥；服务端只放行白名单函数，
   角色分流、口令与就诊边界都在数据库函数里校验。

   发布平台的网关要求请求 URL 带 sharecode 才会种下访问凭证（__wb_rsc）。
   从应用面板 / 预览 iframe 打开时页面 URL 常常是裸的，cookie 又带不过去，
   于是 /api/rpc/* 会被网关 403 拦成一张 HTML 页，前端读到的就是 "Not Found"。
   所以这里给每个请求都补上 sharecode，网关当场 Set-Cookie，后续自然就通了。 */
(function () {
  var DEFAULT_SHARE = 'UYTBFHUV4H';

  function shareCode() {
    try {
      var u = new URL(location.href);
      return u.searchParams.get('sharecode') || DEFAULT_SHARE;
    } catch (e) {
      return DEFAULT_SHARE;
    }
  }

  function withShare(path) {
    try {
      var u = new URL(path, location.href);
      if (!u.searchParams.has('sharecode')) {
        u.searchParams.set('sharecode', shareCode());
      }
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return path;
    }
  }

  function messageOf(err) {
    if (!err) return '未知错误';
    var msg = err.message || String(err);
    if (/gateway_blocked/.test(msg)) {
      return '访问凭证没建立起来。请点页面底部「重新进入」，用完整链接打开一次就好。';
    }
    if (/bad_code/.test(msg)) return '科室口令不正确';
    if (/report_not_found/.test(msg)) return '找不到这份报告';
    if (/visit_not_found/.test(msg)) return '找不到这次就诊';
    if (/bad_token/.test(msg)) return '这个就诊链接无效或已失效';
    if (/already_signed/.test(msg)) return '医生已经签核，不能再改动';
    if (/upstream_unreachable|upstream_timeout/.test(msg)) return '连不上云端，请检查网络后重试';
    if (/Failed to fetch|NetworkError/i.test(msg)) return '网络连接失败，请稍后再试';
    return msg;
  }

  function parseError(status, text) {
    // 网关拦截时返回的是一整页 HTML（"链接不完整"），不是 JSON。
    // 别把 HTML 当错误文案显示给用户，统一标记为凭证问题。
    if ((status === 403 || status === 404 || status === 502) && /<(!doctype|html)/i.test(text)) {
      return new Error('gateway_blocked');
    }
    if (/^\s*Not Found\s*$/i.test(text)) return new Error('gateway_blocked');
    var detail = '';
    try {
      var j = JSON.parse(text);
      detail = j.error_description || j.message || j.error || '';
    } catch (e) {
      detail = text.slice(0, 160);
    }
    return new Error(detail || 'HTTP ' + status);
  }

  function rpc(fn, args) {
    // 相对路径：预览面板若把页面挂在子路径下，绝对 /api/rpc 会打到错的根上返回 Not Found
    return fetch(withShare('api/rpc/' + encodeURIComponent(fn)), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args || {}),
      credentials: 'same-origin'
    })
      .then(function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw parseError(res.status, text);
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error('返回内容无法解析');
          }
        });
      })
      .catch(function (err) {
        var e = new Error(messageOf(err));
        e.raw = err;
        throw e;
      });
  }

  window.HexinCloud = {
    rpc: rpc,
    messageOf: messageOf,
    withShare: withShare,
    shareCode: shareCode
  };
})();
