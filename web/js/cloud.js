/* 云客户端：所有数据都经本站 /api/rpc/* 转发出去（见 server.js）。
   浏览器不直连小程序云，也不接触任何密钥；服务端只放行白名单函数，
   角色分流、口令与就诊边界都在数据库函数里校验。 */
(function () {
  function messageOf(err) {
    if (!err) return '未知错误';
    var msg = err.message || String(err);
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
    return fetch('/api/rpc/' + encodeURIComponent(fn), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args || {})
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

  window.HexinCloud = { rpc: rpc, messageOf: messageOf };
})();
