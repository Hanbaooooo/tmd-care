const kb = require('../../data/kb');

const SUGGESTIONS = [
  '关节响要紧吗',
  '总是紧咬牙怎么办',
  'CBT 有用吗',
  '什么时候要去看医生',
  '会不会越来越严重',
  '吃什么比较好',
];

const ACTIONS = {
  qa01: [{ label: '整理我的症状', url: '/pages/triage/triage?mode=symptom' }],
  qa02: [{ label: '整理我的症状', url: '/pages/triage/triage?mode=symptom' }],
  qa03: [{ label: '准备就诊', url: '/pages/triage/triage?mode=visit' }],
  qa04: [{ label: '从第 1 周开始', url: '/pages/plan/plan' }],
  qa05: [{ label: '看六周计划', url: '/pages/plan/plan' }],
  qa06: [{ label: '看六周计划', url: '/pages/plan/plan' }],
  qa07: [{ label: '整理我的症状', url: '/pages/triage/triage?mode=symptom' }],
  qa08: [{ label: '从第 1 周开始', url: '/pages/plan/plan' }],
  qa09: [{ label: '从第 3 周开始', url: '/pages/week/week?week=3' }],
  qa10: [{ label: '看六周计划', url: '/pages/plan/plan' }],
  qa11: [{ label: '准备就诊', url: '/pages/triage/triage?mode=visit' }],
  qa12: [{ label: '从第 4 周开始', url: '/pages/week/week?week=4' }],
  qa13: [{ label: '整理我的症状', url: '/pages/triage/triage?mode=symptom' }],
  qa14: [{ label: '记一次现在的感受', url: '/pages/record-edit/record-edit' }],
  qa15: [{ label: '看六周计划', url: '/pages/plan/plan' }],
};

function sourceTextOf(ids) {
  const parts = [];
  (ids || []).forEach((id) => {
    const s = kb.sourceById(id);
    if (!s) return;
    parts.push(s.journal + ' ' + s.year);
  });
  return parts.join('；');
}

Page({
  data: {
    messages: [],
    draft: '',
    suggestions: SUGGESTIONS,
    scrollTo: '',
  },

  onLoad() {
    this.seq = 0;
  },

  onInput(e) {
    this.setData({ draft: e.detail.value });
  },

  askSuggestion(e) {
    this.ask(e.currentTarget.dataset.q);
  },

  send() {
    const text = (this.data.draft || '').trim();
    if (!text) return;
    this.setData({ draft: '' });
    this.ask(text);
  },

  ask(text) {
    const messages = this.data.messages.slice();
    this.seq += 1;
    messages.push({ key: 'u' + this.seq, role: 'user', text: text });

    const hit = kb.findAnswer(text);
    let reply;
    if (hit && hit.reviewStatus === 'approved') {
      reply = {
        key: 'a' + this.seq,
        role: 'anxin',
        paras: hit.answer,
        sourceText: sourceTextOf(hit.sources),
        boundary: hit.boundary || '',
        actions: ACTIONS[hit.id] || [{ label: '看六周计划', url: '/pages/plan/plan' }],
      };
    } else {
      reply = {
        key: 'a' + this.seq,
        role: 'anxin',
        paras: [
          '这个我还真没有审过的答案，就不瞎猜了。',
          '换个问法试试，或者直接看六周计划。要是想处理具体症状，整理一次症状，或者去挂个号。',
        ],
        sourceText: '',
        boundary: '没经过专业审核的内容，不会出现在这儿的回答里。',
        actions: [
          { label: '看六周计划', url: '/pages/plan/plan' },
          { label: '整理我的症状', url: '/pages/triage/triage?mode=symptom' },
        ],
      };
    }
    messages.push(reply);

    this.setData({ messages: messages, scrollTo: 'm' + (messages.length - 1) });
  },

  goAction(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (url.indexOf('/pages/plan') === 0 || url.indexOf('/pages/home') === 0) {
      wx.switchTab({ url: url });
      return;
    }
    wx.navigateTo({ url: url });
  },
});
