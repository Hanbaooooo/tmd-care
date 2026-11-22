/* 把小程序的数据模块（data/*.js）包成一份能在浏览器里直接跑的脚本。
 *
 * 为什么要有这一步：Axis I 的字段定义、阈值、四类复核状态都必须和小程序同一份代码。
 * 网页里不重写，而是把源文件原样塞进一个 CommonJS shim。
 *
 * 本地开发时 server.js 直接读 ../data，改完就生效；
 * 部署包里没有 ../data，就用这里生成的 js/data-core.js 兜底。
 * 所以改了 data/*.js 之后要跑一次：node sync-data.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ORDER = ['scales', 'axis1', 'rules'];

function build(dataDir) {
  const parts = ORDER.map(function (name) {
    const file = path.join(dataDir, name + '.js');
    const src = fs.readFileSync(file, 'utf8');
    return "def('" + name + "', function (module, exports, require) {\n" + src + '\n});';
  });

  return (
    '/* 自动生成，勿手改。源文件：小程序 data/{scales,axis1,rules}.js；重新生成：node web/sync-data.js */\n' +
    '(function () {\n' +
    '  var reg = {};\n' +
    '  function req(name) {\n' +
    "    var k = String(name).replace(/^\\.\\//, '');\n" +
    "    if (!reg[k]) throw new Error('data module not loaded: ' + k);\n" +
    '    return reg[k].exports;\n' +
    '  }\n' +
    '  function def(name, fn) { var m = { exports: {} }; fn(m, m.exports, req); reg[name] = m; }\n' +
    parts.join('\n') +
    '\n' +
    '  window.HEXIN_DATA = {\n' +
    '    scales: reg.scales.exports,\n' +
    '    axis1: reg.axis1.exports,\n' +
    '    rules: reg.rules.exports\n' +
    '  };\n' +
    '})();\n'
  );
}

module.exports = { build: build, ORDER: ORDER };
