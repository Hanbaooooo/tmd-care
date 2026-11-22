/* 改了小程序 data/*.js 之后跑一次：node web/sync-data.js
   会重新生成 web/js/data-core.js（部署包里用它，因为部署包没有 ../data）。 */
'use strict';

const fs = require('fs');
const path = require('path');
const bundle = require('./lib/data-bundle');

const dataDir = path.resolve(__dirname, '..', 'data');
const out = path.resolve(__dirname, 'js', 'data-core.js');

const code = bundle.build(dataDir);
fs.writeFileSync(out, code, 'utf8');
console.log('[颌心] 已生成 ' + path.relative(process.cwd(), out) + '（' + Buffer.byteLength(code) + ' 字节）');
