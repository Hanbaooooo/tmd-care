const { cloud } = require('./cloud');
const session = require('./session');
const local = require('./local');

function db() {
  if (!cloud || !cloud.database) {
    throw new Error('云服务未初始化');
  }
  return cloud.database;
}

function check(res) {
  if (res && res.error) {
    const err = new Error(res.error.message || '请求失败');
    err.code = res.error.code;
    throw err;
  }
  return res ? res.data : null;
}

function today() {
  return local.today();
}

function signedIn() {
  return session.getSession().then(function (s) {
    return !!s;
  });
}

/* ---------------- 症状记录 ---------------- */

function recordRow(payload) {
  return {
    record_date: payload.record_date || today(),
    pain_nrs: typeof payload.pain_nrs === 'number' ? payload.pain_nrs : null,
    sleep_quality: typeof payload.sleep_quality === 'number' ? payload.sleep_quality : null,
    stress: typeof payload.stress === 'number' ? payload.stress : null,
    trigger: payload.trigger || null,
    function_limit: typeof payload.function_limit === 'number' ? payload.function_limit : null,
    oral_habits: payload.oral_habits || [],
    note: payload.note || null,
    anchor_done: !!payload.anchor_done,
    clench_noticed: typeof payload.clench_noticed === 'boolean' ? payload.clench_noticed : null,
  };
}

// 本机先写，再尝试云端；任一端成功都不丢数据
// 与当天已有记录合并，避免只填一个数字时把其它字段清空
function saveRecord(payload) {
  const date = payload.record_date || today();
  const existing = local.getRecord(date) || {};
  const row = recordRow(Object.assign({}, existing, payload, { record_date: date }));
  local.upsertRecord(row);

  return signedIn().then(function (ok) {
    if (!ok) return { synced: false, row: row };
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_symptom_records')
          .upsert(row, { onConflict: 'owner_id,record_date' })
          .select();
      })
      .then(check)
      .then(function (data) {
        local.upsertRecord(Object.assign({}, row, { pending: false }));
        return { synced: true, row: data && data[0] ? data[0] : row };
      })
      .catch(function (err) {
        console.warn('[颞安智护] record cloud save failed', err && err.message);
        return { synced: false, row: row };
      });
  });
}

// 首页日锚点：只补写 nrs / clench，不清掉当天已有的其它字段
function saveAnchor(payload) {
  const date = payload.record_date || today();
  const existing = local.getRecord(date) || {};
  return saveRecord(
    Object.assign({}, existing, {
      record_date: date,
      pain_nrs: typeof payload.pain_nrs === 'number' ? payload.pain_nrs : existing.pain_nrs,
      clench_noticed:
        typeof payload.clench_noticed === 'boolean' ? payload.clench_noticed : existing.clench_noticed,
      anchor_done: true,
    })
  );
}

function listRecords(limit) {
  return signedIn().then(function (ok) {
    if (!ok) return local.listRecords(limit || 30);

    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_symptom_records')
          .select(
            'id, record_date, pain_nrs, sleep_quality, stress, trigger, function_limit, oral_habits, note, anchor_done, clench_noticed, created_at'
          )
          .order('record_date', { ascending: false })
          .limit(limit || 30);
      })
      .then(check)
      .then(function (rows) {
        if (rows && rows.length) return rows;
        return local.listRecords(limit || 30);
      })
      .catch(function (err) {
        console.warn('[颞安智护] listRecords failed', err && err.message);
        return local.listRecords(limit || 30);
      });
  });
}

function todayRecord() {
  return signedIn().then(function (ok) {
    if (!ok) return local.getRecord(today());
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_symptom_records')
          .select('*')
          .eq('record_date', today())
          .maybeSingle();
      })
      .then(check)
      .then(function (row) {
        return row || local.getRecord(today());
      })
      .catch(function () {
        return local.getRecord(today());
      });
  });
}

/* ---------------- 筛查结果 ---------------- */

function saveScreening(result) {
  local.saveScreen(result);
  return signedIn().then(function (ok) {
    if (!ok) return { synced: false };
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_screening')
          .insert({
            form_version: result.version,
            answers: result.answers || {},
            axis1: result.axis1 || {},
            axis2: result.axis2 || {},
            care_level: result.care ? result.care.level : null,
            impression: result.impression || null,
          })
          .select();
      })
      .then(check)
      .then(function () {
        return { synced: true };
      })
      .catch(function (err) {
        console.warn('[颞安智护] screening cloud save failed', err && err.message);
        return { synced: false };
      });
  });
}

function latestScreening() {
  return signedIn().then(function (ok) {
    if (!ok) {
      const s = local.getScreen();
      return s ? s.result : null;
    }
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_screening')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);
      })
      .then(check)
      .then(function (rows) {
        if (rows && rows.length) return rows[0];
        const s = local.getScreen();
        return s ? s.result : null;
      })
      .catch(function () {
        const s = local.getScreen();
        return s ? s.result : null;
      });
  });
}

/* ---------------- 症状梳理 ---------------- */

function saveTriage(payload) {
  return signedIn().then(function (ok) {
    if (!ok) return { synced: false };
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_triage')
          .insert({
            locations: payload.locations || [],
            duration: payload.duration || null,
            triggers: payload.triggers || [],
            red_flags: payload.red_flags || [],
            care_level: payload.care_level || 'self',
            summary: payload.summary || {},
          })
          .select();
      })
      .then(check)
      .then(function () {
        return { synced: true };
      })
      .catch(function () {
        return { synced: false };
      });
  });
}

function latestTriage() {
  return signedIn().then(function (ok) {
    if (!ok) return null;
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_triage').select('*').order('created_at', { ascending: false }).limit(1);
      })
      .then(check)
      .then(function (rows) {
        return rows && rows.length ? rows[0] : null;
      })
      .catch(function () {
        return null;
      });
  });
}

/* ---------------- 课程进度 ---------------- */

function listProgress() {
  return signedIn().then(function (ok) {
    if (!ok) return local.listProgress();
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_course_progress').select('*').order('week', { ascending: true });
      })
      .then(check)
      .then(function (rows) {
        return rows && rows.length ? rows : local.listProgress();
      })
      .catch(function () {
        return local.listProgress();
      });
  });
}

function upsertProgress(week, patch) {
  local.upsertProgress(week, patch);
  const row = {
    week: week,
    learn_done: !!patch.learn_done,
    practice_done: !!patch.practice_done,
    review_done: !!patch.review_done,
    practice_count: patch.practice_count || 0,
    reflection: patch.reflection || null,
    updated_at: new Date().toISOString(),
  };
  return signedIn().then(function (ok) {
    if (!ok) return { synced: false };
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_course_progress').upsert(row, { onConflict: 'owner_id,week' }).select();
      })
      .then(check)
      .then(function () {
        return { synced: true };
      })
      .catch(function () {
        return { synced: false };
      });
  });
}

function bumpPractice(week) {
  const rows = local.listProgress();
  let count = 0;
  rows.forEach(function (r) {
    if (r.week === week) count = r.practice_count || 0;
  });
  return upsertProgress(week, { practice_count: count + 1, practice_done: true });
}

/* ---------------- 就诊摘要 ---------------- */

function saveSummary(content) {
  return signedIn().then(function (ok) {
    if (!ok) {
      local.write('tmd_local_summary', { content: content, at: Date.now() });
      return { synced: false };
    }
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_care_summaries').insert({ content: content }).select();
      })
      .then(check)
      .then(function () {
        return { synced: true };
      })
      .catch(function () {
        local.write('tmd_local_summary', { content: content, at: Date.now() });
        return { synced: false };
      });
  });
}

function latestSummary() {
  return signedIn().then(function (ok) {
    if (!ok) {
      const v = local.read('tmd_local_summary', null);
      return v ? v : null;
    }
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_care_summaries').select('*').order('created_at', { ascending: false }).limit(1);
      })
      .then(check)
      .then(function (rows) {
        return rows && rows.length ? rows[0] : null;
      })
      .catch(function () {
        return null;
      });
  });
}

/* ---------------- 研究同意 ---------------- */

function listConsents() {
  return signedIn().then(function (ok) {
    if (!ok) return [];
    return Promise.resolve()
      .then(function () {
        return db().from('tmd_consents').select('*');
      })
      .then(check)
      .then(function (rows) {
        return rows || [];
      })
      .catch(function () {
        return [];
      });
  });
}

function setConsent(track, consented) {
  return signedIn().then(function (ok) {
    if (!ok) throw new Error('研究同意需要先登录账户');
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_consents')
          .upsert(
            {
              track: track,
              consented: !!consented,
              consented_at: consented ? new Date().toISOString() : null,
              status: consented ? 'active' : 'declined',
            },
            { onConflict: 'owner_id,track' }
          )
          .select();
      })
      .then(check);
  });
}

/* ---------------- 量表结果 ---------------- */

// version / item_count / score_max 必须一起存：OBC 换过版本（12 项 0–48 → 21 项 0–84），
// 缺这三项，以后就没法判定一条分数该按哪套口径算。
function saveScaleResult(payload) {
  return signedIn().then(function (ok) {
    if (!ok) throw new Error('研究量表结果需要先登录账户');
    return Promise.resolve()
      .then(function () {
        return db()
          .from('tmd_scale_results')
          .insert({
            scale_id: payload.scale_id,
            visit: payload.visit || 'T0',
            score: payload.score,
            answers: payload.answers || {},
            version: payload.version || null,
            item_count: typeof payload.item_count === 'number' ? payload.item_count : null,
            score_max: typeof payload.score_max === 'number' ? payload.score_max : null,
          })
          .select();
      })
      .then(check);
  });
}

function listScaleResults(scaleId) {
  return signedIn().then(function (ok) {
    if (!ok) return [];
    return Promise.resolve()
      .then(function () {
        let q = db().from('tmd_scale_results').select('*').order('taken_at', { ascending: false });
        if (scaleId) q = q.eq('scale_id', scaleId);
        // 六个量表 × 四个访视，20 条会被截断，够不到更早的访视
        return q.limit(60);
      })
      .then(check)
      .then(function (rows) {
        return rows || [];
      })
      .catch(function () {
        return [];
      });
  });
}

/* ---------------- 登录后补同步 ---------------- */

function syncPending() {
  return signedIn().then(function (ok) {
    if (!ok || !local.hasPending()) return { synced: 0 };

    const records = local.listRecords(200).filter(function (r) {
      return r.pending !== false;
    });
    const progress = local.listProgress().filter(function (p) {
      return p.pending !== false;
    });
    const screen = local.getScreen();

    const jobs = [];
    records.forEach(function (r) {
      jobs.push(
        Promise.resolve()
          .then(function () {
            return db()
              .from('tmd_symptom_records')
              .upsert(recordRow(r), { onConflict: 'owner_id,record_date' });
          })
          .catch(function () {})
      );
    });
    progress.forEach(function (p) {
      jobs.push(
        Promise.resolve()
          .then(function () {
            return db()
              .from('tmd_course_progress')
              .upsert(
                {
                  week: p.week,
                  learn_done: !!p.learn_done,
                  practice_done: !!p.practice_done,
                  review_done: !!p.review_done,
                  practice_count: p.practice_count || 0,
                  reflection: p.reflection || null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'owner_id,week' }
              );
          })
          .catch(function () {})
      );
    });
    if (screen && screen.pending) {
      jobs.push(
        Promise.resolve()
          .then(function () {
            return db().from('tmd_screening').insert({
              form_version: screen.result.version,
              answers: screen.result.answers || {},
              axis1: screen.result.axis1 || {},
              axis2: screen.result.axis2 || {},
              care_level: screen.result.care ? screen.result.care.level : null,
              impression: screen.result.impression || null,
            });
          })
          .catch(function () {})
      );
    }

    return Promise.all(jobs).then(function () {
      local.clearPendingFlags();
      return { synced: jobs.length };
    });
  });
}

module.exports = {
  today,
  saveRecord,
  saveAnchor,
  listRecords,
  todayRecord,
  saveScreening,
  latestScreening,
  saveTriage,
  latestTriage,
  listProgress,
  upsertProgress,
  bumpPractice,
  saveSummary,
  latestSummary,
  listConsents,
  setConsent,
  saveScaleResult,
  listScaleResults,
  syncPending,
};
