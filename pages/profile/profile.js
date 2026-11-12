const screen = require('../../data/screen');
const store = require('../../utils/store');
const local = require('../../utils/local');
const session = require('../../utils/session');

const CARE_TONE = {
  urgent: 'danger',
  clinic: 'caution',
  self: 'info',
};

function normalize(row) {
  if (!row) return null;
  // 云端行：字段是拆开存的
  if (row.axis1 && row.axis2 && !row.care) {
    const careLevel = row.care_level || 'self';
    return {
      version: row.form_version || '',
      answers: row.answers || {},
      redFlags: (row.answers && row.answers.redFlags) || [],
      axis1: typeof row.axis1 === 'string' ? JSON.parse(row.axis1) : row.axis1,
      axis2: typeof row.axis2 === 'string' ? JSON.parse(row.axis2) : row.axis2,
      care: {
        level: careLevel,
        headline:
          careLevel === 'urgent'
            ? '建议尽快就医'
            : careLevel === 'clinic'
            ? '建议安排一次专科评估'
            : '可以先从自我管理开始',
        text: '',
      },
      plan: null,
      certainty: null,
      impression: row.impression || '',
    };
  }
  return row;
}

Page({
  data: {
    ready: false,
    syncText: '',
    impression: '',
    care: { level: 'self', headline: '', text: '', tone: 'info' },
    groups: [],
    dims: [],
    summary: '',
    notes: [],
    basis: [],
    missing: [],
    findings: [],
    plan: null,
    boundaries: [],
    savedAt: '',
    localOnly: false,
  },

  onLoad(query) {
    this.query = query || {};
    this.load();
  },

  load() {
    const cached = getApp().globalData.screenResult;
    if (cached) {
      this.render(normalize(cached));
      return;
    }
    const stored = local.getScreen();
    if (stored && stored.result) {
      this.render(normalize(stored.result));
      return;
    }
    store.latestScreening().then((row) => {
      const result = normalize(row);
      if (result) this.render(result);
      else this.setData({ ready: false });
    });
  },

  render(result) {
    if (!result) return;
    this.result = result;
    const axis1 = result.axis1 || { groups: [], primary: null, findings: [] };
    const axis2 = result.axis2 || { dims: [], notes: [] };
    const care = result.care || { level: 'self', headline: '', text: '' };

    const groups = (axis1.groups || []).map(function (g) {
      return {
        key: g.id,
        label: g.label,
        plain: g.plain,
        basis: g.basis || [],
        needs: g.needs || [],
        isPrimary: !!(axis1.primary && axis1.primary.id === g.id),
      };
    });

    const dims = (axis2.dims || []).map(function (d) {
      return {
        key: d.key,
        label: d.label,
        construct: d.construct,
        value: d.value,
        width: Math.max(4, d.value),
        detail: d.detail,
        band: d.band,
        tone: d.tone === 'attention' ? 'high' : d.tone === 'caution' ? 'mid' : 'low',
        text: d.text,
        action: d.action,
      };
    });

    let syncText = '';
    if (this.query.synced) syncText = '结果已经存到你的账号里了。';
    else if (this.query.pending) syncText = '结果存在手机上了，联网会自动传；不登录也不会丢。';
    else if (this.query.local) syncText = '现在只存在这台手机上。登录后会同步，换手机也能留住。';
    else if (!session.peek()) syncText = '现在只存在这台手机上。登录后能同步。';

    this.setData({
      ready: true,
      syncText: syncText,
      impression: result.impression || '',
      care: {
        level: care.level,
        headline: care.headline,
        text: care.text || '',
        tone: CARE_TONE[care.level] || 'info',
      },
      groups: groups,
      dims: dims,
      summary: axis2.summary || '',
      notes: axis2.notes || [],
      basis: result.certainty ? result.certainty.basis : [],
      missing: result.certainty ? result.certainty.missing : [],
      plan: result.plan || null,
      boundaries: screen.BOUNDARY,
      findings: axis1.findings || [],
      localOnly: !session.peek(),
    });
  },

  goPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record-edit/record-edit' });
  },

  goCare() {
    wx.switchTab({ url: '/pages/care/care' });
  },

  goSummary() {
    // 直接用这次筛查的作答拼摘要，接到空页上等于白点一下
    if (this.result) {
      getApp().globalData.summaryDraft = screen.toSummary(this.result);
      wx.navigateTo({ url: '/pages/summary/summary?synced=' + (session.peek() ? '1' : '0') });
      return;
    }
    wx.navigateTo({ url: '/pages/summary/summary' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=profile' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  redo() {
    // 结果页已经在栈里，用 navigateTo 会越堆越深，改成替换
    wx.redirectTo({ url: '/pages/screen/screen' });
  },
});
