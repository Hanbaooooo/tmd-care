/* 患者端自评（网页版）
 *
 * 和小程序 pages/psych 用的是同一份题库与计分：data/psych.js。
 * 网页不重写题目、不重设计分，只把 SECTIONS 渲染成可点的控件。
 *
 * 入口是一道门：患者在首页输「就诊号 + 姓名」，服务端校验后把 session 交给本页。
 * 本页不收姓名、不建就诊，提交时只带 session + 就诊号，数据库按这两个值认记录。
 */
(function () {
  'use strict';

  var DATA = window.HEXIN_DATA;
  if (!DATA || !DATA.psych || !DATA.rules) {
    document.body.innerHTML =
      '<div class="err">题库没加载出来，刷新一下页面；一直这样就找医生重开一次。</div>';
    return;
  }

  var psych = DATA.psych;
  var rules = DATA.rules;
  var SECTIONS = psych.SECTIONS;

  var SESSION_KEY = 'hexin_patient_session';
  var DRAFT_KEY = 'hexin_patient_draft';

  var session = null;
  var answers = {};
  var submitting = false;

  var $ = function (id) {
    return document.getElementById(id);
  };

  /* ---------------- 登录凭据与草稿 ---------------- */

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.session || !s.visit_no) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    } catch (e) {
      return null;
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch (e) {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }

  /* ---------------- 渲染 ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var TOTAL = SECTIONS.reduce(function (n, s) {
    return n + (s.questions ? s.questions.length : 0);
  }, 0);

  function answeredCount() {
    var n = 0;
    Object.keys(answers).forEach(function (k) {
      if (answers[k] !== null && answers[k] !== undefined && answers[k] !== '') n += 1;
    });
    return n;
  }

  function optHtml(q, sec) {
    var cur = answers[sec.key + '.' + q.key];
    var numeric = q.type === 'opt11';
    return q.options
      .map(function (o) {
        var on = cur === o.value;
        return (
          '<button type="button" class="opt' +
          (on ? ' on' : '') +
          '" data-q="' +
          sec.key +
          '.' +
          q.key +
          '" data-v="' +
          o.value +
          '">' +
          esc(numeric ? o.value : o.label) +
          '</button>'
        );
      })
      .join('');
  }

  function renderForm() {
    var html = SECTIONS.map(function (sec) {
      var body = (sec.questions || [])
        .map(function (q) {
          return (
            '<div class="q-item">' +
            '<div class="q-text"><span class="q-no">' +
            esc(q.no) +
            '</span>' +
            esc(q.text) +
            '</div>' +
            '<div class="q-opts">' +
            optHtml(q, sec) +
            '</div>' +
            '</div>'
          );
        })
        .join('');

      return (
        '<section class="p-sec">' +
        '<div class="p-sec-hd">' +
        '<div class="p-sec-t">' +
        esc(sec.name) +
        '</div>' +
        '<div class="p-sec-n">' +
        esc(sec.sub) +
        '</div>' +
        '</div>' +
        '<p class="p-sec-instruct">' +
        esc(sec.instruct) +
        (sec.legend ? '<br>' + esc(sec.legend) : '') +
        '</p>' +
        body +
        '</section>'
      );
    }).join('');

    html +=
      '<p class="disc">四段答完之后点下面的「提交」。提交后医生在诊室就能看到，你还可以回来改，直到医生签核为止。</p>';

    $('form').innerHTML = html;
  }

  function paintProgress() {
    var n = answeredCount();
    $('progIn').style.width = Math.round((n / TOTAL) * 100) + '%';
    $('progT').textContent = n + ' / ' + TOTAL + ' 题';
    var left = TOTAL - n;
    $('btnSubmit').disabled = left > 0 || submitting;
    $('btnSubmit').textContent = left > 0 ? '还差 ' + left + ' 题' : '提交给医生';
  }

  function showForm() {
    $('intro').classList.add('hidden');
    $('result').classList.add('hidden');
    $('form').classList.remove('hidden');
    $('bar').classList.remove('hidden');
    paintProgress();
    window.scrollTo(0, 0);
  }

  /* ---------------- 提交 ---------------- */

  function buildAxis2(result) {
    var map = {};
    (result.scores || []).forEach(function (s) {
      map[s.key] = s;
    });
    var out = {};
    if (map.obc) {
      out.obc = {
        score: map.obc.value,
        max: map.obc.max,
        band: map.obc.band,
        version: DATA.scales.OBC_FULL
      };
    }
    if (map.gad7) out.gad7 = { score: map.gad7.value, max: 21, band: map.gad7.band };
    if (map.phq4) out.phq4 = { score: map.phq4.value, max: 12, band: map.phq4.band };
    if (map.jfls) {
      out.jfls8 = {
        score: Number((map.jfls.value / 8).toFixed(1)),
        max: 10,
        band: map.jfls.band
      };
    }
    return out;
  }

  /* 网关要求 URL 带 sharecode 才种凭证，每个请求都补上，避免在预览 iframe 里被 403。 */
  function withShare(p) {
    try {
      var u = new URL(p, location.href);
      var m = /[?&]sharecode=([^&]+)/.exec(location.search);
      if (!u.searchParams.has('sharecode')) {
        u.searchParams.set('sharecode', m ? decodeURIComponent(m[1]) : 'UYTBFHUV4H');
      }
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return p;
    }
  }

  function rpc(fn, payload) {
    return fetch(withShare('api/rpc/' + fn), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload || {}),
      credentials: 'same-origin'
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        try {
          data = JSON.parse(text);
        } catch (e) {}
        if (!res.ok) {
          // 网关拦截时返回整页 HTML，不是 JSON；统一翻译成凭证问题，别把 HTML 显示出来
          if ((res.status === 403 || res.status === 404 || res.status === 502) && /<(!doctype|html)/i.test(text)) {
            var ge = new Error('gateway_blocked');
            ge.code = 'gateway_blocked';
            throw ge;
          }
          var msg = String((data && (data.message || data.error)) || '');
          var err = new Error(msg || 'upstream_' + res.status);
          err.code = msg;
          throw err;
        }
        return data;
      });
    });
  }

  function friendlyError(err) {
    var m = String((err && (err.code || err.message)) || '');
    if (/gateway_blocked/.test(m)) {
      return '页面访问凭证掉了。请回到就诊入口重新打开一次完整链接，答案还留在这台手机上。';
    }
    if (/already_signed/.test(m)) {
      return '医生已经签核这份记录了，不能再改。有补充直接当面告诉医生。';
    }
    if (/forbidden|bad_session/.test(m)) {
      return '这次登录已经失效了。回就诊入口重新输一次就诊号 + 姓名，答案还留着。';
    }
    if (/visit_not_found/.test(m)) {
      return '就诊记录已经不存在了，找医生重新发一个号。';
    }
    if (/upstream|fetch|network/i.test(m) || err instanceof TypeError) {
      return '网络没通，答案还留在这台手机上。过一会儿再点一次提交。';
    }
    return '提交没成功：' + (m || '未知原因');
  }

  function submit() {
    if (submitting) return;
    if (!session) {
      location.href = withShare('./');
      return;
    }
    var left = TOTAL - answeredCount();
    if (left > 0) {
      paintProgress();
      return;
    }

    var result = psych.evaluate(answers);
    var axis2 = buildAxis2(result);
    var ev = rules.evaluate({ axis2: axis2, axis1: {} });

    submitting = true;
    $('btnSubmit').disabled = true;
    $('btnSubmit').textContent = '提交中…';

    rpc('tmd_patient_submit', {
      p_session: session.session,
      p_visit_no: session.visit_no,
      p_axis2: axis2,
      p_state: ev.state.key,
      p_hits: ev.hits,
      p_version: ev.ruleVersion
    })
      .then(function (ok) {
        submitting = false;
        clearDraft();
        showResult(result, ok);
      })
      .catch(function (err) {
        submitting = false;
        paintProgress();
        var box = $('submitErr');
        if (!box) {
          box = document.createElement('div');
          box.id = 'submitErr';
          box.className = 'p-submit-err';
          $('form').appendChild(box);
        }
        box.textContent = friendlyError(err);
        box.scrollIntoView({ block: 'center' });
      });
  }

  function showResult(result, ok) {
    var rows = (result.scores || [])
      .map(function (s) {
        return (
          '<div class="score-row">' +
          '<div class="score-name">' +
          esc(s.label) +
          '</div>' +
          '<div class="score-bar"><div class="score-in' +
          (s.percent >= 60 ? ' hi' : '') +
          '" style="width:' +
          Math.max(2, Math.min(100, s.percent)) +
          '%"></div></div>' +
          '<div class="score-val">' +
          esc(s.value + ' / ' + s.max) +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    var notes = (result.notes || [])
      .map(function (t) {
        return '<p class="tip">' + esc(t) + '</p>';
      })
      .join('');

    $('form').classList.add('hidden');
    $('bar').classList.add('hidden');
    $('result').classList.remove('hidden');
    $('result').innerHTML =
      '<div class="card">' +
      '<div class="p-done">' +
      '<div class="p-done-mark">✓</div>' +
      '<div class="p-done-t">已交给医生</div>' +
      '<p class="tip">医生在诊室打开工作台就能看到这份自评，不用再说一遍。' +
      (session && session.name ? '登记称呼：<b>' + esc(session.name) + '</b>' : '') +
      '</p>' +
      '</div>' +
      '<div class="p-kv"><span>就诊号</span><span class="p-kv-v">' +
      esc((ok && ok.visit_no) || (session && session.visit_no) || '') +
      '</span></div>' +
      '<div class="p-kv"><span>本机留档</span><span class="p-kv-v">可以回来改</span></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="p-sec-hd"><div class="p-sec-t">这次的分</div><div class="p-sec-n">自评，不是诊断</div></div>' +
      rows +
      '</div>' +
      (notes ? '<div class="card">' + notes + '</div>' : '') +
      '<button class="btn btn-ghost" id="btnEdit" style="width:100%;height:44px;margin-top:14px">回去改答案</button>' +
      '<p class="disc">分数只代表你最近这段时间的主观感受。是不是关节或肌肉的问题，要医生按一按、量一量才知道。</p>';

    $('btnEdit').addEventListener('click', function () {
      answers = restoreAnswers(result.answers);
      renderForm();
      showForm();
    });

    window.scrollTo(0, 0);
  }

  // 编辑器回来时把上次的作答铺回去，避免全部清空重答
  function restoreAnswers(src) {
    var out = {};
    Object.keys(src || {}).forEach(function (k) {
      if (src[k] !== null && src[k] !== undefined) out[k] = src[k];
    });
    return out;
  }

  /* ---------------- 事件 ---------------- */

  $('form').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.opt') : null;
    if (!btn) return;
    var key = btn.getAttribute('data-q');
    var v = btn.getAttribute('data-v');
    var num = Number(v);
    answers[key] = isNaN(num) ? v : num;

    var group = btn.parentNode;
    Array.prototype.forEach.call(group.querySelectorAll('.opt'), function (el) {
      el.classList.toggle('on', el === btn);
    });

    saveDraft();
    paintProgress();
    var box = $('submitErr');
    if (box) box.textContent = '';
  });

  $('btnBegin').addEventListener('click', function () {
    openForm();
  });

  function openForm() {
    var draft = loadDraft();
    answers = draft && typeof draft === 'object' ? draft : {};
    renderForm();
    showForm();
  }

  $('btnSubmit').addEventListener('click', submit);

  $('btnSwitch').addEventListener('click', function () {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    location.href = withShare('./');
  });

  /* ---------------- 启动 ---------------- */

  (function boot() {
    session = readSession();
    if (!session) {
      // 没在门口输过就诊号 + 姓名，直接退回那道门
      location.replace(withShare('./'));
      return;
    }
    $('pWho').textContent = session.name || '你好';
    $('pNo').textContent = session.visit_no;

    var draft = loadDraft();
    var hasDraft = draft && Object.keys(draft).length > 0;
    if (hasDraft) {
      $('btnBegin').textContent = '接着上次填（已答 ' + Object.keys(draft).length + ' 题）';
    }
  })();
})();
