/* 医生端：口令进入 → 队列 → 病例抽屉 → 签核 / 患者入口码。
   数据来自小程序那套库（经 server.js 同域代理调 tmd_desk_*），前端不直接查表。 */
(function () {
  var AX2_KEYS = ['obc', 'gad7', 'phq4', 'jfls8'];
  var AX1_KEYS = ['palpation_sites', 'familiar_reproduce', 'mio', 'pio', 'noise_r', 'noise_l', 'locking'];
  var AX1_LABEL = {
    palpation_sites: '触诊部位',
    familiar_reproduce: '触诊再现熟悉疼痛',
    mio: '最大自主开口',
    pio: '被动开口',
    noise_r: '右侧关节音',
    noise_l: '左侧关节音',
    locking: '绞锁'
  };
  // 与 data/rules.js 的 STATES 文案保持一致；网页端只为标签引入这份映射
  var STATE_LABEL = {
    routine: '常规记录',
    need_more: '需补充评估',
    priority: '优先人工复核',
    pending_input: '待补录'
  };
  var TONE = { routine: 'calm', need_more: 'caution', priority: 'alert', pending_input: 'note' };
  var BUCKETS = [
    { key: 'all', label: '全部' },
    { key: 'input', label: '待录入' },
    { key: 'review', label: '待复核' },
    { key: 'sign', label: '待签核' },
    { key: 'done', label: '已完成' }
  ];

  var state = { code: '', doctor: '', clinic: '', rows: [], filter: 'all', q: '', current: null };
  var timer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function sameDay(iso) {
    if (!iso) return false;
    var d = new Date(iso);
    var n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }

  function progressOf(r) {
    var axis2 = r.axis2 || {};
    var axis1 = r.axis1 || {};
    var ax2 = 0;
    AX2_KEYS.forEach(function (k) {
      if (axis2[k] && typeof axis2[k].score === 'number') ax2 += 1;
    });
    var ax1 = 0;
    AX1_KEYS.forEach(function (k) {
      var v = axis1[k];
      if (v === undefined || v === null || v === '') return;
      if (Array.isArray(v) && !v.length) return;
      ax1 += 1;
    });
    return { ax2: ax2, ax1: ax1, percent: Math.round(((ax2 + ax1) / 11) * 100) };
  }

  function decorate(r) {
    var p = progressOf(r);
    var bucket = 'input';
    if (r.signed_at) bucket = 'done';
    else if (!r.report_id) bucket = 'input';
    else if (r.rule_state === 'priority' || r.rule_state === 'need_more') bucket = 'review';
    else if (r.rule_state === 'pending_input') bucket = 'input';
    else if (p.ax1 < AX1_KEYS.length) bucket = 'input';
    else bucket = 'sign';

    var label = '待患者自评';
    var tone = 'note';
    if (r.report_id) {
      if (r.signed_at) {
        label = '已签核';
        tone = 'calm';
      } else {
        label = STATE_LABEL[r.rule_state] || '待判定';
        tone = TONE[r.rule_state] || 'note';
      }
    }

    return Object.assign({}, r, {
      visit_no: r.visit_no || (r.report_id ? '未报到 #' + r.report_id : '—'),
      bucket: bucket,
      percent: p.percent,
      ax2: p.ax2,
      ax1: p.ax1,
      label: label,
      tone: tone,
      hits: Array.isArray(r.rule_hits) ? r.rule_hits : []
    });
  }

  /* ---------------- 登录 ---------------- */

  function enter() {
    $('gate').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('clinicName').textContent = state.clinic || '口腔颌面疼痛专科';
    $('whoName').textContent = state.doctor ? state.doctor + ' · 已登录' : '本机账号';
    loadQueue();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (!document.hidden) loadQueue(true);
    }, 30000);
  }

  function login(code, doctor) {
    return HexinCloud.rpc('tmd_desk_login', { p_code: code }).then(function (res) {
      if (!res || !res.ok) throw new Error('科室口令不正确');
      state.code = code;
      state.clinic = res.clinic || '口腔颌面疼痛专科';
      state.doctor = doctor || res.doctor || '';
      sessionStorage.setItem('hexin_code', code);
      if (state.doctor) sessionStorage.setItem('hexin_doctor', state.doctor);
      enter();
    });
  }

  $('gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var code = $('gateCode').value.trim();
    var doctor = $('gateName').value.trim();
    if (!code) return;
    $('gateBtn').disabled = true;
    $('gateErr').textContent = '';
    login(code, doctor)
      .catch(function (err) {
        $('gateErr').textContent = err.message || '登录失败';
      })
      .then(function () {
        $('gateBtn').disabled = false;
      });
  });

  /* ---------------- 数据 ---------------- */

  function loadQueue(silent) {
    if (!state.code) return Promise.resolve();
    if (!silent) $('btnRefresh').textContent = '读取中…';
    return HexinCloud.rpc('tmd_desk_queue', { p_code: state.code })
      .then(function (rows) {
        state.rows = (rows || []).map(decorate);
        renderAll();
      })
      .catch(function (err) {
        if (/口令/.test(err.message)) {
          sessionStorage.removeItem('hexin_code');
          location.reload();
          return;
        }
        $('queueBody').innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
      })
      .then(function () {
        $('btnRefresh').textContent = '刷新';
      });
  }

  /* ---------------- 渲染 ---------------- */

  function renderAll() {
    var today = state.rows.filter(function (r) {
      return sameDay(r.created_at);
    });
    var review = state.rows.filter(function (r) {
      return r.bucket === 'review';
    }).length;
    var sign = state.rows.filter(function (r) {
      return r.bucket === 'sign';
    }).length;
    var followN = state.rows.filter(function (r) {
      return r.signed_at && r.follow_up;
    }).length;

    $('kpis').innerHTML = [
      { k: '今日初诊', v: today.length },
      { k: '待人工复核', v: review },
      { k: '待签核报告', v: sign },
      { k: '待随访', v: followN }
    ]
      .map(function (x) {
        return '<div class="kpi"><div class="kpi-k">' + x.k + '</div><div class="kpi-v">' + x.v + '<small>例</small></div></div>';
      })
      .join('');

    var arrived = today.length;
    var submitted = today.filter(function (r) {
      return !!r.report_id;
    }).length;
    var evaluated = today.filter(function (r) {
      return !!r.rule_state;
    }).length;
    var signed = today.filter(function (r) {
      return !!r.signed_at;
    }).length;
    var followed = today.filter(function (r) {
      return r.signed_at && r.follow_up;
    }).length;
    var steps = [
      { l: '已报到', v: arrived },
      { l: '评估录入', v: submitted },
      { l: '智能复核', v: evaluated },
      { l: '报告签核', v: signed },
      { l: '进入随访', v: followed }
    ];
    var prevDone = true;
    $('flow').innerHTML = steps
      .map(function (s) {
        var done = s.v > 0;
        var active = !done && prevDone;
        prevDone = prevDone && done;
        return (
          '<div class="flow-i"><div class="flow-l">' + s.l + '</div>' +
          '<div class="flow-dot' + (done ? ' done' : '') + (active ? ' active' : '') + '">' + (done ? '✓' : '') + '</div>' +
          '<div class="flow-n">' + s.v + '<small>例</small></div></div>'
        );
      })
      .join('');
    $('flowTotal').textContent = '共 ' + arrived + ' 例';

    renderChips();
    renderTable();
    renderRail(followN);
  }

  function renderChips() {
    $('chips').innerHTML = BUCKETS.map(function (b) {
      var n = b.key === 'all' ? state.rows.length : state.rows.filter(function (r) {
        return r.bucket === b.key;
      }).length;
      return (
        '<button class="chip' + (state.filter === b.key ? ' on' : '') + '" data-filter="' + b.key + '">' +
        b.label + '<span class="chip-n">' + n + '</span></button>'
      );
    }).join('');
    $('queueTotal').textContent = '共 ' + state.rows.length + ' 例';
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return state.rows.filter(function (r) {
      if (state.filter !== 'all' && r.bucket !== state.filter) return false;
      if (!q) return true;
      return (r.visit_no || '').toLowerCase().indexOf(q) >= 0 || (r.patient_label || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderTable() {
    var rows = visibleRows();
    if (!rows.length) {
      $('queueBody').innerHTML =
        '<div class="empty">' +
        (state.rows.length
          ? '这一栏是空的，换个筛选看看。'
          : '还没有就诊记录。<br>让患者扫右上角「患者入口」里的固定码，在小程序里绑定就诊并提交后，这里刷新就能看到。') +
        '</div>';
      return;
    }

    var html = '<table class="tbl"><thead><tr>' +
      '<th style="width:44px">#</th><th>就诊号 / 患者</th><th style="width:130px">报到时间</th>' +
      '<th style="width:150px">录入进度</th><th style="width:120px">当前状态</th><th style="width:90px">接诊医师</th>' +
      '<th style="width:110px"></th></tr></thead><tbody>';

    rows.forEach(function (r, i) {
      var key = r.visit_id != null ? r.visit_id : 'r' + r.report_id;
      var act;
      if (r.signed_at) act = '<button class="btn btn-ghost btn-sm" data-open="' + key + '">查看</button>';
      else if (!r.report_id) act = '<button class="btn btn-ghost btn-sm" data-open="' + key + '">录体征</button>';
      else if (r.bucket === 'review') act = '<button class="btn btn-primary btn-sm" data-open="' + key + '">复核</button>';
      else if (r.bucket === 'sign') act = '<button class="btn btn-primary btn-sm" data-open="' + key + '">签核</button>';
      else act = '<button class="btn btn-ghost btn-sm" data-open="' + key + '">补录</button>';

      html +=
        '<tr>' +
        '<td class="t-sub">' + (i + 1) + '</td>' +
        '<td><div class="t-no">' + esc(r.visit_no) + '</div>' +
        '<div class="t-sub">' + (r.patient_label ? esc(r.patient_label) : '未署名') + '</div></td>' +
        '<td class="t-sub mono">' + fmtTime(r.created_at) + '</td>' +
        '<td><span class="bar-mini"><i class="' + (r.percent >= 100 ? 'hi' : '') + '" style="width:' + r.percent + '%"></i></span>' +
        ' <span class="t-sub mono">' + r.percent + '%</span></td>' +
        '<td><span class="badge ' + r.tone + '">' + esc(r.label) + '</span>' +
        (r.hits.length ? '<div class="t-sub">命中 ' + r.hits.length + ' 条</div>' : '') + '</td>' +
        '<td class="t-sub">' + (r.doctor_name ? esc(r.doctor_name) : '—') + '</td>' +
        '<td><div class="t-act">' + act + '</div></td>' +
        '</tr>';
    });

    $('queueBody').innerHTML = html + '</tbody></table>';
  }

  function renderRail(followN) {
    var priority = state.rows.filter(function (r) {
      return !r.signed_at && r.rule_state === 'priority';
    }).length;
    var ready = state.rows.filter(function (r) {
      return r.bucket === 'sign';
    }).length;
    var overdue = state.rows.filter(function (r) {
      if (r.report_id || !sameDay(r.created_at)) return false;
      return Date.now() - new Date(r.created_at).getTime() >= 30 * 60000;
    }).length;

    var list = [];
    if (priority) list.push({ t: '高优先级复核', h: '命中风险信号，建议先看', n: priority, tone: 'alert' });
    if (ready) list.push({ t: '可签核报告', h: '体征已录齐，可直接签核', n: ready, tone: 'caution' });
    if (overdue) list.push({ t: '评估超时', h: '报到超 30 分钟仍未提交自评', n: overdue, tone: 'note' });

    $('alerts').innerHTML = list.length
      ? list.map(function (a) {
          return '<div class="alert-row"><div class="alert-main"><div class="alert-t">' + a.t +
            '</div><div class="alert-h">' + a.h + '</div></div><div class="alert-n ' + a.tone + '">' + a.n + '</div></div>';
        }).join('')
      : '<div class="empty" style="padding:16px 0">没有需要提前处理的病例。</div>';

    var fu = state.rows.filter(function (r) {
      return r.signed_at && r.follow_up;
    }).slice(0, 4);

    $('follow').innerHTML = fu.length
      ? fu.map(function (r) {
          return '<div class="fu-row"><span class="fu-no">' + esc(r.visit_no) + '</span><span class="fu-txt">' +
            esc(r.follow_up) + '</span></div>';
        }).join('')
      : '<div class="empty" style="padding:16px 0">还没有排随访的病例。<br>签核时填了随访计划会列在这里。</div>';
  }

  /* ---------------- 抽屉 ---------------- */

  // 已签核后 Axis I 只读：冻结在该次签核的版本上，要看改后效果必须先撤回
  function ax1Readonly(axis1) {
    var d = window.HEXIN_DATA;
    if (!d || !d.axis1) {
      var got = AX1_KEYS.filter(function (k) {
        var v = axis1[k];
        return !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));
      });
      return got.length
        ? '<div class="d-kv">' + got.map(function (k) {
            return '<span class="badge calm">' + AX1_LABEL[k] + '</span>';
          }).join(' ') + '</div>'
        : '<div class="tip">没有录到体征。</div>';
    }

    var blocks = d.axis1.SECTIONS.map(function (sec) {
      var lines = sec.items
        .map(function (item) {
          var v = axis1[item.key];
          var text = '';
          if (item.type === 'sites') {
            if (!Array.isArray(v) || !v.length) return '';
            text = v
              .map(function (k) {
                if (k === 'none') return '无';
                var o = item.options.filter(function (x) {
                  return x.key === k;
                })[0];
                return o ? o.label : k;
              })
              .join('、');
          } else if (item.type === 'single') {
            if (v === undefined || v === null || v === '') return '';
            var o = item.options.filter(function (x) {
              return String(x.v) === String(v);
            })[0];
            text = o ? o.l : String(v);
          } else {
            if (v === undefined || v === null || v === '') return '';
            text = String(v) + (item.unit ? ' ' + item.unit : '');
          }
          return '<div class="kv-line"><span class="kv-k">' + esc(item.label) +
            '</span><span class="kv-v">' + esc(text) + '</span></div>';
        })
        .filter(Boolean)
        .join('');
      if (!lines) return '';
      return '<div class="ax1-ro-sec"><div class="ax1-t">' + esc(sec.title) + '</div>' + lines + '</div>';
    }).join('');

    return blocks || '<div class="tip">没有录到体征。</div>';
  }

  function openDrawer(key) {
    var r = state.rows.filter(function (x) {
      return String(x.visit_id) === String(key);
    })[0];
    if (!r) {
      r = state.rows.filter(function (x) {
        return String('r' + x.report_id) === String(key);
      })[0];
    }
    if (!r) return;
    state.current = r;
    $('drawerNo').textContent = r.visit_no;
    $('drawerBadge').className = 'badge ' + r.tone;
    $('drawerBadge').textContent = r.label;

    var axis2 = r.axis2 || {};
    var rows = ['obc', 'gad7', 'phq4', 'jfls8'].filter(function (k) {
      return axis2[k] && typeof axis2[k].score === 'number';
    });
    var meta = { obc: ['口腔行为 OBC-21', 84], gad7: ['焦虑 GAD-7', 21], phq4: ['情绪 PHQ-4', 12], jfls8: ['功能 JFLS-8', 10] };

    var scoreHtml = rows.length
      ? rows.map(function (k) {
          var it = axis2[k];
          var m = meta[k] || [k, it.max || 10];
          var max = it.max || m[1];
          var pct = Math.max(2, Math.min(100, Math.round((it.score / max) * 100)));
          return '<div class="score-row"><div class="score-name">' + m[0] + '</div>' +
            '<div class="score-bar"><div class="score-in ' + (pct >= 70 ? 'hi' : '') + '" style="width:' + pct + '%"></div></div>' +
            '<div class="score-val mono">' + it.score + ' / ' + max + '</div></div>';
        }).join('')
      : '<div class="empty" style="padding:14px 0">还没有自评数据。</div>';

    var hitsHtml = r.hits.length
      ? r.hits.map(function (h) {
          var tone = h.state === 'priority' ? 'alert' : h.state === 'need_more' ? 'caution' : '';
          return '<div class="hit ' + tone + '"><div class="hit-t">' + esc(h.title) + '</div>' +
            '<div class="hit-d">' + esc(h.detail) + '</div>' +
            '<div class="hit-src">' + esc(h.ruleId || '') + ' · 阈值 ' + esc(h.threshold || '—') +
            (h.sourceItems && h.sourceItems.length ? ' · 依据 ' + esc(h.sourceItems.join('、')) : '') + '</div></div>';
        }).join('')
      : '<div class="empty" style="padding:14px 0">未命中风险信号。</div>';

    var axis1 = r.axis1 || {};
    var ax1Block;
    if (r.signed_at) {
      ax1Block = '<div class="d-sec"><div class="d-sec-t">Axis I 体征</div>' + ax1Readonly(axis1) + '</div>';
    } else {
      ax1Block =
        '<div class="d-sec"><div class="d-sec-t">Axis I 体征 · 面诊录入</div>' +
        (window.HexinAxis1 && HexinAxis1.available()
          ? HexinAxis1.html(axis1)
          : '<div class="empty" style="padding:14px 0">数据模块没加载上，刷新页面再试。</div>') +
        '</div>';
    }

    $('drawerBody').innerHTML =
      '<div class="d-sec"><div class="d-sec-t">就诊信息</div><div class="d-kv">' +
      '<span>报到 ' + fmtTime(r.created_at) + '</span>' +
      '<span>提交 ' + (r.submitted_at ? fmtTime(r.submitted_at) : '—') + '</span>' +
      '<span>接诊 ' + (r.doctor_name ? esc(r.doctor_name) : '—') + '</span>' +
      '<span>录入 ' + r.percent + '%</span></div></div>' +

      '<div class="d-sec"><div class="d-sec-t">Axis II 分项</div>' + scoreHtml + '</div>' +

      '<div class="d-sec"><div class="d-sec-t">复核提示（' + r.hits.length + ' 条）</div>' + hitsHtml + '</div>' +

      ax1Block +

      '<div class="d-sec"><div class="d-sec-t">复核意见</div>' +
      '<textarea class="input" id="noteInput" style="height:88px;padding:10px 12px;line-height:1.65" placeholder="写给患者的结论与建议">' +
      esc(r.signed_at ? r.doctor_note || '' : r.doctor_note || '') + '</textarea></div>' +

      '<div class="d-sec"><div class="d-sec-t">随访计划</div>' +
      '<input class="input" id="fuInput" placeholder="如：2 周后电话随访，复评 NRS 与开口度" value="' +
      esc(r.follow_up || '') + '"></div>' +

      (r.signed_at
        ? '<div class="d-sec"><div class="d-sec-t">签核记录</div><div class="tip">' +
          esc(r.signed_by || '未署名') + ' · ' + fmtTime(r.signed_at) + ' 已签核下发</div></div>'
        : '');

    $('btnSign').textContent = r.signed_at ? '重新签核' : '签核并下发';
    $('btnWithdraw').classList.toggle('hidden', !r.signed_at);
    $('drawer').classList.add('on');
    $('mask').classList.add('on');
    $('drawer').setAttribute('aria-hidden', 'false');
    if (window.HexinAxis1 && !r.signed_at) HexinAxis1.paintProgress();
  }

  function closeDrawer() {
    $('drawer').classList.remove('on');
    $('mask').classList.remove('on');
    $('drawer').setAttribute('aria-hidden', 'true');
    state.current = null;
  }

  /* ---------------- 事件 ---------------- */

  document.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-filter]');
    if (chip) {
      state.filter = chip.dataset.filter;
      renderChips();
      renderTable();
      return;
    }
    var open = e.target.closest('[data-open]');
    if (open) {
      openDrawer(open.dataset.open);
      return;
    }
    var jump = e.target.closest('[data-jump]');
    if (jump) {
      var el = $(jump.dataset.jump);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('mask').addEventListener('click', closeDrawer);
  $('drawerClose').addEventListener('click', closeDrawer);

  $('search').addEventListener('input', function (e) {
    state.q = e.target.value || '';
    renderTable();
  });

  $('btnRefresh').addEventListener('click', function () {
    loadQueue();
  });

  $('btnOut') &&
    $('btnOut').addEventListener('click', function () {
      sessionStorage.removeItem('hexin_code');
      sessionStorage.removeItem('hexin_doctor');
      location.reload();
    });

  $('btnSign').addEventListener('click', function () {
    var r = state.current;
    if (!r || !r.report_id) return;
    var note = ($('noteInput') || {}).value || '';
    var fu = ($('fuInput') || {}).value || '';
    $('btnSign').disabled = true;
    HexinCloud.rpc('tmd_desk_sign', {
      p_code: state.code,
      p_report_id: r.report_id,
      p_action: 'adopt',
      p_note: note,
      p_follow_up: fu,
      p_doctor: state.doctor || ''
    })
      .then(function () {
        closeDrawer();
        return loadQueue();
      })
      .catch(function (err) {
        alert(err.message);
      })
      .then(function () {
        $('btnSign').disabled = false;
      });
  });

  $('btnWithdraw').addEventListener('click', function () {
    var r = state.current;
    if (!r || !r.report_id) return;
    if (!confirm('撤回后患者端立刻看不到已签核内容，确定撤回？')) return;
    HexinCloud.rpc('tmd_desk_withdraw', {
      p_code: state.code,
      p_report_id: r.report_id,
      p_note: ($('noteInput') || {}).value || ''
    })
      .then(function () {
        closeDrawer();
        return loadQueue();
      })
      .catch(function (err) {
        alert(err.message);
      });
  });

  /* ---------------- Axis I 录入 ---------------- */

  function saveAxis1() {
    var r = state.current;
    if (!r) return;
    if (!window.HexinAxis1 || !HexinAxis1.available() || !window.HEXIN_DATA) {
      alert('数据模块没加载上，刷新页面再试');
      return;
    }

    var v = HexinAxis1.read();
    var p = HexinAxis1.progress(v);
    if (!p.complete) {
      var go = confirm(
        '还有 ' + p.missing.length + ' 项必填没录，先存成草稿？\n' +
          '报告状态会停在「待补录」，补齐后才能签核。'
      );
      if (!go) return;
    }

    var ev;
    try {
      // 规则在浏览器本地算，用的是小程序那份 data/rules.js，不是网页自己的一套
      ev = window.HEXIN_DATA.rules.evaluate({ axis2: r.axis2 || {}, axis1: v });
    } catch (err) {
      alert('复核计算失败：' + (err && err.message));
      return;
    }

    var key = r.visit_id;
    var btn = document.getElementById('ax1Save');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '保存中…';
    }

    HexinCloud.rpc('tmd_desk_save_axis1', {
      p_code: state.code,
      p_visit_id: r.visit_id,
      p_axis1: v,
      p_state: ev.state.key,
      p_hits: ev.hits,
      p_version: ev.ruleVersion
    })
      .then(function () {
        return loadQueue().then(function () {
          openDrawer(key);
        });
      })
      .catch(function (err) {
        alert(err.message);
      })
      .then(function () {
        var b = document.getElementById('ax1Save');
        if (b) {
          b.disabled = false;
          b.textContent = '保存体征并重新复核';
        }
      });
  }

  function clearAxis1() {
    if (!confirm('清空这一屏的体征？保存前不影响已存记录。')) return;
    Array.prototype.forEach.call(
      document.querySelectorAll('#ax1Form .ax1-chip.on, #ax1Form .ax1-seg-b.on'),
      function (b) {
        b.classList.remove('on');
      }
    );
    Array.prototype.forEach.call(document.querySelectorAll('#ax1Form input'), function (i) {
      i.value = '';
    });
    if (window.HexinAxis1) HexinAxis1.paintProgress();
  }

  document.addEventListener('click', function (e) {
    if (e.target.id === 'ax1Save') {
      e.preventDefault();
      saveAxis1();
      return;
    }
    if (e.target.id === 'ax1Clear') {
      e.preventDefault();
      clearAxis1();
    }
  });

  /* ---------------- 患者入口（固定小程序码） ---------------- */

  // 这张码不随人变：同一张码，患者扫进来在小程序里绑定本次就诊。
  // 来源两种：项目自带 assets/miniapp-qr.png，或医生上传一次后存在本机 localStorage。
  var QR_KEY = 'hexin_miniapp_qr';
  var QR_DEFAULT = 'assets/miniapp-qr.png';

  function qrSrc() {
    try {
      var saved = localStorage.getItem(QR_KEY);
      if (saved) return saved;
    } catch (e) {}
    return QR_DEFAULT;
  }

  function paintQr() {
    var src = qrSrc();
    var probe = new Image();
    probe.onload = function () {
      $('qrHolder').classList.remove('is-empty');
      $('qrHolder').innerHTML = '<img class="qr-img" src="' + src + '" alt="患者入口小程序码">';
      $('qrUrl').textContent = '固定码 · 患者用微信扫码进入「颌·心」小程序';
      $('qrUrl').classList.remove('warn');
    };
    probe.onerror = function () {
      $('qrHolder').classList.add('is-empty');
      $('qrHolder').innerHTML =
        '<div class="qr-ph">' +
        '<div class="qr-ph-t">还没有小程序码</div>' +
        '<ol class="qr-steps">' +
        '<li>小程序预览面板 → 右上角「分享」→ 找显示「已发布」的那一行</li>' +
        '<li>悬停该行最右侧的二维码图标 → 点「下载」</li>' +
        '<li>回来点「上传小程序码」，或按 Ctrl+V 直接粘贴</li>' +
        '</ol>' +
        '<div class="qr-ph-f">只需要做一次，存在本机浏览器里，之后一直用这张</div>' +
        '</div>';
      $('qrUrl').textContent = '也可以直接把这个图片文件拖到上面这个框里';
      $('qrUrl').classList.add('warn');
    };
    probe.src = src;
  }

  function saveQrFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      alert('请选一张图片文件（png / jpg）');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('图片太大，请用 2MB 以内的小程序码图片');
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        localStorage.setItem(QR_KEY, String(reader.result));
      } catch (err) {
        alert('本机存储写不进去（可能是无痕模式），换一个浏览器再试');
        return;
      }
      paintQr();
    };
    reader.readAsDataURL(file);
  }

  $('btnQr').addEventListener('click', function () {
    paintQr();
    $('qrModal').classList.remove('hidden');
  });

  $('qrFile').addEventListener('change', function (e) {
    saveQrFile(e.target.files && e.target.files[0]);
    e.target.value = '';
  });

  // 粘贴图片：Ctrl+V 是最快的路径，不用先存盘再选文件
  document.addEventListener('paste', function (e) {
    if ($('qrModal').classList.contains('hidden')) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        var f = items[i].getAsFile();
        if (f) {
          e.preventDefault();
          saveQrFile(f);
        }
        return;
      }
    }
  });

  // 拖进来也行
  $('qrHolder').addEventListener('dragover', function (e) {
    e.preventDefault();
    $('qrHolder').classList.add('drop');
  });
  $('qrHolder').addEventListener('dragleave', function () {
    $('qrHolder').classList.remove('drop');
  });
  $('qrHolder').addEventListener('drop', function (e) {
    e.preventDefault();
    $('qrHolder').classList.remove('drop');
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    saveQrFile(f);
  });

  $('qrPrint').addEventListener('click', function () {
    var src = qrSrc();
    var w = window.open('', '_blank');
    if (!w) {
      alert('浏览器拦住了打印窗口，请允许弹窗后重试');
      return;
    }
    w.document.write(
      '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>颌·心 患者入口</title>' +
        '<style>body{font-family:-apple-system,"PingFang SC",sans-serif;text-align:center;padding:48px 24px;color:#1c2b26}' +
        'h1{font-size:22px;font-weight:600;margin:0 0 6px}.sub{color:#5d6f68;font-size:13px;margin-bottom:26px}' +
        'img{width:260px;height:260px;image-rendering:pixelated;border:1px solid #dfe9e5;border-radius:12px;padding:10px}' +
        '.foot{margin-top:24px;font-size:12px;color:#5d6f68;line-height:1.9}</style></head><body>' +
        '<h1>颌·心 · 候诊自评</h1>' +
        '<div class="sub">' +
        esc(state.clinic || '口腔颌面疼痛专科') +
        '</div>' +
        '<img src="' +
        src +
        '">' +
        '<div class="foot">微信扫码 → 进入小程序 → 绑定本次就诊 → 按提示填写<br>填写约需 5 分钟，提交后医师端即可看到</div>' +
        '</body></html>'
    );
    w.document.close();
    setTimeout(function () {
      w.print();
    }, 400);
  });

  $('qrClose').addEventListener('click', function () {
    $('qrModal').classList.add('hidden');
  });

  /* ---------------- 启动 ---------------- */

  if (window.HEXIN_BOOT_ERROR) {
    $('gateErr').textContent = window.HEXIN_BOOT_ERROR;
  }

  var savedCode = sessionStorage.getItem('hexin_code');
  if (savedCode) {
    login(savedCode, sessionStorage.getItem('hexin_doctor') || '').catch(function () {
      sessionStorage.removeItem('hexin_code');
    });
  }
})();
