/* 颌心临床工作台 · 静态站 + 云函数同域代理
 *
 * 为什么需要这个代理：
 * 医生端要读的是「小程序那套数据库」。小程序云服务对来源域名做了精确匹配，
 * 浏览器从网页域名直接请求会被 403（access_denied: origin not allowed）。
 * 服务端请求不带 Origin 头，不受该限制——所以这里做一层同域转发，
 * 浏览器只跟本站的 /api/rpc/* 说话，跨域问题就不存在了。
 *
 * 安全边界仍然在数据库里：科室口令 + 函数白名单，前端拿不到表，也调不到白名单外的函数。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;
const CLOUD_BASE = 'https://mp-api.app.workbuddy.host';
const CLOUD_KEY =
  process.env.HEXIN_CLOUD_KEY ||
  'wbpk_zvQKo2tqFcVjHyRU3wojbq_Ys476JsYUzSoP8Pkxzst2iBgBelX6u64';

// 只放行医生端用到的函数，别的一律不转发
const ALLOWED = new Set([
  'tmd_desk_login',
  'tmd_desk_queue',
  'tmd_desk_sign',
  'tmd_desk_withdraw',
  'tmd_desk_save_axis1'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function proxyRpc(fn, rawBody, res) {
  if (!ALLOWED.has(fn)) {
    return sendJson(res, 404, { error: 'unknown_rpc' });
  }

  let payload = '{}';
  if (rawBody && rawBody.trim()) {
    try {
      JSON.parse(rawBody);
      payload = rawBody;
    } catch (e) {
      return sendJson(res, 400, { error: 'bad_json' });
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(function () {
    ctrl.abort();
  }, 15000);

  // 注意：这里刻意不带 Origin 头，服务端请求按小程序来源处理
  fetch(CLOUD_BASE + '/.cloud/database/rest/rpc/' + encodeURIComponent(fn), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wb-webapp-access-key': CLOUD_KEY
    },
    body: payload,
    signal: ctrl.signal
  })
    .then(function (up) {
      return up.text().then(function (text) {
        clearTimeout(timer);
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          return sendJson(res, 502, { error: 'upstream_not_json', detail: text.slice(0, 200) });
        }
        // 上游把数据库报错放在 error / message 里，原样透传，前端按文案判断
        if (!up.ok) return sendJson(res, up.status, data);
        sendJson(res, 200, data);
      });
    })
    .catch(function (err) {
      clearTimeout(timer);
      const aborted = err && err.name === 'AbortError';
      sendJson(res, 504, {
        error: aborted ? 'upstream_timeout' : 'upstream_unreachable',
        detail: (err && err.message) || ''
      });
    });
}

// 根目录下这些文件是部署用的，不对外提供，避免源码与前缀被下载
const DENY = new Set(['/server.js', '/package.json', '/package-lock.json', '/sync-data.js']);

/* ---------- 把小程序的数据模块原样喂给浏览器 ----------
 *
 * Axis I 的字段定义（data/axis1.js 的 SECTIONS）、阈值与四类复核状态（data/rules.js）
 * 都必须和小程序用同一份代码。所以这里不在网页里重写一遍，而是把源文件包一层
 * CommonJS shim 直接发出去——改小程序那边，网页这边自动跟着变。
 *
 * 两种来源：
 *   本地开发 —— 直接读 ../data（改完刷新即生效）
 *   部署环境 —— 部署包里没有 ../data，退回 js/data-core.js（node sync-data.js 生成）
 */
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PREBUILT_DATA = path.join(__dirname, 'js', 'data-core.js');
const dataBundle = require('./lib/data-bundle');

function buildDataBundle(res) {
  let body = null;
  let source = 'source';

  try {
    body = dataBundle.build(DATA_DIR);
  } catch (e) {
    source = 'prebuilt';
    try {
      body = fs.readFileSync(PREBUILT_DATA, 'utf8');
    } catch (e2) {
      return sendJson(res, 500, { error: 'data_unavailable' });
    }
  }

  res.writeHead(200, {
    'content-type': 'application/javascript; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-data-source': source
  });
  res.end(body);
}

function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (DENY.has(rel) || /^\/\./.test(rel) || rel.indexOf('/lib/') === 0) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }
  const target = path.normalize(path.join(ROOT, rel));
  if (target.indexOf(ROOT) !== 0) {
    res.writeHead(403);
    return res.end('forbidden');
  }

  fs.stat(target, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'content-length': stat.size,
      'cache-control': path.extname(target) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (url.pathname.indexOf('/api/rpc/') === 0) {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }
    const fn = url.pathname.slice('/api/rpc/'.length);
    return readBody(req, 256 * 1024)
      .then(function (body) {
        proxyRpc(fn, body, res);
      })
      .catch(function () {
        sendJson(res, 400, { error: 'bad_request' });
      });
  }

  if (url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname === '/api/data/core.js') {
    return buildDataBundle(res);
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('[颌心] serving on ' + PORT);
});
