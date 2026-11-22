/* Axis I 体征录入表单（浏览器侧）
 *
 * 字段定义不在这里写死，全部来自 window.HEXIN_DATA.axis1.SECTIONS ——
 * 也就是小程序那份 data/axis1.js，由 server.js 现场打包发出。
 * 加一个体征项，只需要改小程序的数据文件，这个表单自动跟着长出对应控件。
 */
(function () {
  function data() {
    return window.HEXIN_DATA || null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isBlank(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }

  function readValue(axis1, key) {
    var v = axis1[key];
    return isBlank(v) ? '' : v;
  }

  function renderItem(item, value) {
    if (item.type === 'sites') {
      var picked = Array.isArray(value) ? value : [];
      var chips = item.options
        .map(function (o) {
          return (
            '<button type="button" class="ax1-chip' +
            (picked.indexOf(o.key) >= 0 ? ' on' : '') +
            '" data-site="' + o.key + '">' + esc(o.label) + '</button>'
          );
        })
        .join('');
      chips +=
        '<button type="button" class="ax1-chip none' +
        (picked.indexOf('none') >= 0 ? ' on' : '') +
        '" data-site="none">无</button>';
      return (
        '<div class="ax1-item"><div class="ax1-k">' + esc(item.label) + '</div>' +
        '<div class="ax1-chips">' + chips + '</div>' +
        (item.hint ? '<div class="ax1-hint">' + esc(item.hint) + '</div>' : '') +
        '</div>'
      );
    }

    if (item.type === 'single') {
      var seg = item.options
        .map(function (o) {
          return (
            '<button type="button" class="ax1-seg-b' + (value === o.v ? ' on' : '') +
            '" data-k="' + item.key + '" data-v="' + o.v + '">' + esc(o.l) + '</button>'
          );
        })
        .join('');
      return (
        '<div class="ax1-item"><div class="ax1-k">' + esc(item.label) + '</div>' +
        '<div class="ax1-seg">' + seg + '</div></div>'
      );
    }

    if (item.type === 'number') {
      return (
        '<div class="ax1-item ax1-inline"><div class="ax1-k">' + esc(item.label) + '</div>' +
        '<div class="ax1-numwrap"><input class="input ax1-num" type="number" inputmode="numeric" ' +
        'data-k="' + item.key + '" min="' + (item.min != null ? item.min : 0) + '" max="' +
        (item.max != null ? item.max : 80) + '" value="' + (value === '' ? '' : esc(value)) +
        '" placeholder="—"><span class="ax1-unit">' + esc(item.unit || '') + '</span></div></div>'
      );
    }

    return (
      '<div class="ax1-item"><div class="ax1-k">' + esc(item.label) + '</div>' +
      '<input class="input" type="text" data-k="' + item.key + '" value="' +
      esc(value || '') + '" placeholder="' + esc(item.placeholder || '选填') + '"></div>'
    );
  }

  function html(axis1) {
    var d = data();
    if (!d) {
      return '<div class="empty" style="padding:14px 0">数据模块没加载上，刷新一下页面再试。</div>';
    }
    var src = axis1 || {};
    var body = d.axis1.SECTIONS.map(function (sec) {
      var items = sec.items
        .map(function (item) {
          return renderItem(item, readValue(src, item.key));
        })
        .join('');
      return (
        '<div class="ax1-sec"><div class="ax1-t">' + esc(sec.title) + '</div>' +
        (sec.hint ? '<div class="ax1-shint">' + esc(sec.hint) + '</div>' : '') +
        items + '</div>'
      );
    }).join('');

    return (
      '<div class="ax1" id="ax1Form">' +
      '<div class="ax1-hd"><span>按面诊所见勾选，留空的项算未录</span>' +
      '<span class="ax1-prog" id="ax1Prog"></span></div>' +
      body +
      '<div class="ax1-act"><button class="btn btn-primary btn-sm" id="ax1Save">保存体征并重新复核</button>' +
      '<button class="btn btn-ghost btn-sm" id="ax1Clear">清空重填</button></div>' +
      '</div>'
    );
  }

  function read() {
    var d = data();
    var out = {};
    if (!d) return out;

    d.axis1.SECTIONS.forEach(function (sec) {
      sec.items.forEach(function (item) {
        if (item.type === 'sites') {
          var picked = Array.prototype.slice
            .call(document.querySelectorAll('#ax1Form .ax1-chip.on[data-site]'))
            .map(function (b) {
              return b.dataset.site;
            });
          if (picked.length) out[item.key] = picked;
        } else if (item.type === 'single') {
          var on = document.querySelector('#ax1Form .ax1-seg-b.on[data-k="' + item.key + '"]');
          if (on) out[item.key] = on.dataset.v;
        } else {
          var el = document.querySelector('#ax1Form [data-k="' + item.key + '"]');
          var raw = el ? String(el.value || '').trim() : '';
          if (!raw) return;
          if (item.type === 'number') {
            var n = Number(raw);
            if (!isNaN(n)) out[item.key] = n;
          } else {
            out[item.key] = raw;
          }
        }
      });
    });
    return out;
  }

  function progress(axis1) {
    var d = data();
    if (!d) return { complete: false, missing: [], got: 0, total: 0 };
    var c = d.axis1.completeness(axis1);
    var total = d.axis1.REQUIRED.length;
    return { complete: c.complete, missing: c.missing, got: total - c.missing.length, total: total };
  }

  function paintProgress() {
    var el = document.getElementById('ax1Prog');
    if (!el) return;
    var p = progress(read());
    el.textContent = '必填 ' + p.total + ' 项 · 已填 ' + p.got + ' 项' + (p.complete ? ' · 齐了' : '');
    el.className = 'ax1-prog' + (p.complete ? ' ok' : '');
  }

  // 事件用委托：抽屉内容每次重绘，绑在上面的 handler 会丢
  document.addEventListener('click', function (e) {
    var chip = e.target.closest && e.target.closest('#ax1Form .ax1-chip');
    if (chip) {
      var none = chip.dataset.site === 'none';
      if (none) {
        var wasOn = chip.classList.contains('on');
        Array.prototype.forEach.call(
          document.querySelectorAll('#ax1Form .ax1-chip.on'),
          function (b) {
            b.classList.remove('on');
          }
        );
        if (!wasOn) chip.classList.add('on');
      } else {
        var noneB = document.querySelector('#ax1Form .ax1-chip.none');
        if (noneB) noneB.classList.remove('on');
        chip.classList.toggle('on');
      }
      paintProgress();
      return;
    }

    var seg = e.target.closest && e.target.closest('#ax1Form .ax1-seg-b');
    if (seg) {
      var k = seg.dataset.k;
      Array.prototype.forEach.call(
        document.querySelectorAll('#ax1Form .ax1-seg-b[data-k="' + k + '"]'),
        function (b) {
          b.classList.remove('on');
        }
      );
      seg.classList.add('on');
      paintProgress();
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.closest && e.target.closest('#ax1Form')) paintProgress();
  });

  window.HexinAxis1 = {
    available: function () {
      return !!data();
    },
    html: function (axis1) {
      var s = html(axis1);
      // 渲染后立刻补一次进度；调用方随后会把节点插进 DOM
      setTimeout(paintProgress, 0);
      return s;
    },
    read: read,
    progress: progress,
    paintProgress: paintProgress,
    completenessOf: function (axis1) {
      var d = data();
      return d ? d.axis1.completeness(axis1) : { complete: false, missing: [] };
    },
    headlineOf: function (axis1) {
      var d = data();
      return d ? d.axis1.headline(axis1) : '';
    }
  };
})();
