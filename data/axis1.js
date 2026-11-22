// DC/TMD Axis I 结构化记录（医师面诊录入）
//
// 设计原则（改之前先读）：
// 1) 这里只记录「查到了什么」——部位、毫米数、有无杂音，不写诊断结论。
//    诊断是医师的事，系统只负责把随诊信息整理成可复核的结构。
// 2) 每个字段都有稳定的 key。报告上每条提示都要能指回它的 fieldKey，
//    这样医师点开提示能看到「是哪一项、什么数值触发的」。这是可溯源的基础。
// 3) 新增字段只往后加，不要改已有 key —— 旧记录里存的是 key，改名会读不出来。

const AXIS1_VERSION = 'AxisI-1.0';

// 触诊部位。左右分开记，因为单侧与双侧的处理路径不同。
const SITES = [
  { key: 'temple_r', label: '右侧颞部' },
  { key: 'temple_l', label: '左侧颞部' },
  { key: 'masseter_r', label: '右侧咬肌' },
  { key: 'masseter_l', label: '左侧咬肌' },
  { key: 'pretragus_r', label: '右耳前' },
  { key: 'pretragus_l', label: '左耳前' },
  { key: 'joint_r', label: '右关节区' },
  { key: 'joint_l', label: '左关节区' },
];

// 关节区部位（用于判定「关节源性」倾向）
const JOINT_KEYS = ['pretragus_r', 'pretragus_l', 'joint_r', 'joint_l'];
// 肌肉部位（用于判定「肌源性」倾向）
const MUSCLE_KEYS = ['temple_r', 'temple_l', 'masseter_r', 'masseter_l'];

const SECTIONS = [
  {
    key: 'palpation',
    title: '触诊',
    hint: '按到的疼，是不是患者平时说的那处疼',
    items: [
      {
        key: 'palpation_sites',
        type: 'sites',
        label: '熟悉性疼痛部位',
        options: SITES,
        hint: '可多选。只勾患者认作「就是这里」的部位，单纯压痛不算',
      },
      {
        key: 'familiar_reproduce',
        type: 'single',
        label: '检查是否再现主诉疼痛',
        options: [
          { v: 'yes', l: '再现' },
          { v: 'partial', l: '部分再现' },
          { v: 'no', l: '未再现' },
        ],
      },
    ],
  },
  {
    key: 'rom',
    title: '下颌运动',
    hint: '单位毫米，量上下切缘间距',
    items: [
      { key: 'mio', type: 'number', label: '最大主动张口', unit: 'mm', min: 0, max: 80 },
      { key: 'pio', type: 'number', label: '最大被动张口', unit: 'mm', min: 0, max: 80 },
      {
        key: 'open_pain',
        type: 'single',
        label: '张口时再现熟悉疼痛',
        options: [
          { v: 'yes', l: '是' },
          { v: 'no', l: '否' },
        ],
      },
      { key: 'lateral_r', type: 'number', label: '右侧方运动', unit: 'mm', min: 0, max: 20 },
      { key: 'lateral_l', type: 'number', label: '左侧方运动', unit: 'mm', min: 0, max: 20 },
      { key: 'protrusion', type: 'number', label: '前伸运动', unit: 'mm', min: 0, max: 20 },
    ],
  },
  {
    key: 'noise',
    title: '关节杂音',
    hint: '开闭口时触诊加听诊',
    items: [
      {
        key: 'noise_r',
        type: 'single',
        label: '右侧',
        options: [
          { v: 'none', l: '无' },
          { v: 'click', l: '弹响' },
          { v: 'crepitus', l: '摩擦音' },
        ],
      },
      {
        key: 'noise_l',
        type: 'single',
        label: '左侧',
        options: [
          { v: 'none', l: '无' },
          { v: 'click', l: '弹响' },
          { v: 'crepitus', l: '摩擦音' },
        ],
      },
    ],
  },
  {
    key: 'locking',
    title: '锁结',
    items: [
      {
        key: 'locking',
        type: 'single',
        label: '本次检查',
        options: [
          { v: 'none', l: '无' },
          { v: 'closed', l: '闭锁（张不开）' },
          { v: 'open', l: '开锁（闭不上）' },
        ],
      },
      {
        key: 'locking_freq',
        type: 'single',
        label: '近一个月发生次数',
        options: [
          { v: '0', l: '没有' },
          { v: '1', l: '1–2 次' },
          { v: '3', l: '3 次以上' },
        ],
      },
    ],
  },
  {
    key: 'imaging',
    title: '影像与补充',
    items: [
      {
        key: 'imaging',
        type: 'single',
        label: '影像',
        options: [
          { v: 'none', l: '未做' },
          { v: 'cbct', l: 'CBCT' },
          { v: 'mri', l: 'MRI' },
        ],
      },
      {
        key: 'imaging_note',
        type: 'text',
        label: '影像结论',
        placeholder: '如：双侧关节盘前移位，右侧不可复',
      },
      {
        key: 'axis1_note',
        type: 'text',
        label: '医师补充',
        placeholder: '选填',
      },
    ],
  },
];

// 必填项：缺这些，Axis I 就算「未完成」，报告状态只能是「待补录」
const REQUIRED = ['palpation_sites', 'familiar_reproduce', 'mio', 'pio', 'noise_r', 'noise_l', 'locking'];

function isBlank(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Axis I 是否录完。返回 { complete, missing: [itemKey] }
function completeness(a) {
  const src = a || {};
  const missing = REQUIRED.filter(function (k) {
    return isBlank(src[k]);
  });
  return { complete: missing.length === 0, missing: missing };
}

// 把 Axis I 的原始值整理成「提示」列表。
// 注意：这些是体征层面的观察，不是诊断。报告上必须原样带这句限定。
function derive(a) {
  const src = a || {};
  const out = [];

  function push(key, text, fieldKey, level) {
    out.push({ key: key, text: text, fieldKey: fieldKey, level: level || 'note' });
  }

  // 'none' 是「明确触过、没有熟悉性疼痛部位」的显式标记。
  // 空数组表示「还没查」，两者临床上完全不同，不能混为一谈——
  // 所以 completeness() 把 [] 当作缺项，把 ['none'] 当作已完成。
  const rawSites = Array.isArray(src.palpation_sites) ? src.palpation_sites : [];
  const sites = rawSites.filter(function (k) {
    return k !== 'none';
  });
  const muscleHit = MUSCLE_KEYS.filter(function (k) {
    return sites.indexOf(k) >= 0;
  });
  const jointHit = JOINT_KEYS.filter(function (k) {
    return sites.indexOf(k) >= 0;
  });

  if (muscleHit.length) {
    push('palp_muscle', '触诊在咀嚼肌区再现熟悉疼痛（' + muscleHit.length + ' 处）', 'palpation_sites', 'caution');
  }
  if (jointHit.length) {
    push('palp_joint', '触诊在关节区再现熟悉疼痛（' + jointHit.length + ' 处）', 'palpation_sites', 'caution');
  }
  if (rawSites.length && sites.length === 0) {
    push('palp_none', '未触到熟悉性疼痛部位', 'palpation_sites', 'note');
  }

  if (typeof src.mio === 'number' && src.mio < 40) {
    push('mio_low', '最大主动张口 ' + src.mio + ' mm，低于 40 mm', 'mio', 'alert');
  }
  if (typeof src.mio === 'number' && typeof src.pio === 'number' && src.pio - src.mio >= 5) {
    push(
      'passive_gap',
      '被动张口比主动多 ' + (src.pio - src.mio) + ' mm，提示限制可能来自肌肉而非关节',
      'pio',
      'caution'
    );
  }

  const noiseR = src.noise_r;
  const noiseL = src.noise_l;
  if (noiseR === 'crepitus' || noiseL === 'crepitus') {
    push('crepitus', '关节区闻及摩擦音，提示关节面退行性改变可能', 'noise_r', 'caution');
  }
  if (noiseR === 'click' || noiseL === 'click') {
    push('click', '开闭口可闻及弹响', 'noise_r', 'note');
  }

  if (src.locking === 'closed') {
    push('locked_closed', '检查时呈闭锁（张不开）', 'locking', 'alert');
  }
  if (src.locking === 'open') {
    push('locked_open', '检查时呈开锁（闭不上），需当次处理', 'locking', 'alert');
  }
  if (src.locking === 'none' && src.locking_freq && src.locking_freq !== '0') {
    push('locking_history', '本次未锁结，但近一个月有发生（' + (src.locking_freq === '1' ? '1–2 次' : '3 次以上') + '）', 'locking_freq', 'caution');
  }

  return out;
}

// 给报告用的一行摘要：优先说最要紧的一条，没有就说「未见明显体征记录」
function headline(a) {
  const list = derive(a);
  const rank = { alert: 3, caution: 2, note: 1 };
  let best = null;
  list.forEach(function (h) {
    if (!best || (rank[h.level] || 0) > (rank[best.level] || 0)) best = h;
  });
  return best ? best.text : '未见明显阳性体征记录';
}

module.exports = {
  AXIS1_VERSION,
  SITES,
  SECTIONS,
  REQUIRED,
  JOINT_KEYS,
  MUSCLE_KEYS,
  completeness,
  derive,
  headline,
  isBlank,
};
