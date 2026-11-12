// 知识库：文献来源 + 受控问答。
//
// 治理规则（与产品方案第六、七节一致）：
// 1. 文献条目（SOURCES）全部 reviewStatus = 'pending'，是证据池，不直接面向患者作答。
// 2. 只有 QA 中 reviewStatus = 'approved' 的条目允许出现在「安心」的正式回答里。
// 3. 每条回答都必须带 sources 与边界说明；没有已审核条目时明确说不知道，不即兴发挥。

const SOURCES = [
  { id: 'k01', year: 2026, journal: 'J Oral Rehabil', type: 'RCT', title: '颈深屈肌训练与 Rocabado 方案对肌源性 TMD 的疗效', topic: ['运动', '颈肩'], findings: ['59 例女性肌源性 TMD，三种运动方案 8 周后疼痛与活动度均改善。', '组间差异有限，提示结构化运动本身的价值大于某一种方案。'] },
  { id: 'k02', year: 2026, journal: 'J Dent', type: '范围综述', title: '全球 TMD 纵向队列研究版图', topic: ['流行病学', '风险因素'], findings: ['110 篇报告、21 个队列：心理困扰、睡眠障碍、副功能行为与共病疼痛与 TMD 发生或持续相关。', '咬合形态差异的关联普遍较弱。'] },
  { id: 'k03', year: 2006, journal: 'Arch Intern Med', type: '量表验证', title: 'GAD-7 广泛性焦虑量表的编制与验证', topic: ['量表', '焦虑'], findings: ['7 条目、0–3 计分，总分 0–21，信度与效度良好。', '常用于筛查与随访比较，不单独作为诊断依据。'] },
  { id: 'k05', year: 2021, journal: 'J Oral Rehabil', type: '横断面', title: '口腔过度使用行为与疼痛性 TMD 的关联', topic: ['口腔行为'], findings: ['1381 名大学生：OBC 高分与疼痛性 TMD 亚型相关。', 'OBC 总分常用分级：0–16 正常、17–24 低度过度使用、≥25 高度。'] },
  { id: 'k06', year: 2023, journal: 'Acta Odontol Scand', type: '横断面', title: '口腔行为频率与心理特征、躯体放大的关联', topic: ['口腔行为', '心理'], findings: ['54 例 TMD 疼痛患者与 46 名对照，OBC 总分与焦虑、抑郁、躯体放大相关。', '组间部分变量差异不显著，提示行为频率需结合个体情境解读。'] },
  { id: 'k07', year: 2026, journal: 'Odontology', type: '横断面 + EMA', title: '清醒磨牙与倾向性正念', topic: ['正念', '清醒磨牙'], findings: ['76 名牙科学生，正念总分越高，生态瞬时评估得到的清醒磨牙频率越低。', '校正焦虑抑郁后关联减弱至临界，提示多为间接关系。'] },
  { id: 'k08', year: 2023, journal: 'J Oral Rehabil', type: '横断面', title: '不同 DC/TMD 亚型中下颌功能受限与心理困扰的相关因素', topic: ['功能受限', '心理'], findings: ['772 例 TMD 患者：JFLS-20、PHQ-15、PHQ-9、GAD-7 显示功能受限与躯体化、抑郁、焦虑相关。', '疼痛相关亚型的功能受限更明显。'] },
  { id: 'k09', year: 2008, journal: 'J Oral Rehabil', type: '前瞻队列', title: '大学生 TMD 症状的 3 年发展', topic: ['流行病学'], findings: ['2374 名日本大学生基线、492 名 3 年后复测。', '压力、副功能习惯与颞下颌关节损伤史与症状出现相关。'] },
  { id: 'k10', year: 1993, journal: 'J Prosthet Dent', type: '综述', title: 'TMD 诊断与治疗设备（第一部分）：科学证据与下颌运动轨迹', topic: ['设备', '下颌运动'], findings: ['提出评估诊断设备可靠性、效度、敏感度与特异度的标准。', '当时证据不足以支持下颌轨迹描记作为 TMD 诊断依据。'] },
  { id: 'k11', year: 2023, journal: 'J Endod', type: '诊断准确性', title: 'TMD 疼痛筛查表在牙髓就诊人群中的诊断准确性', topic: ['筛查'], findings: ['100 例以牙痛就诊者，6 问版 TMD 疼痛筛查表阈值 3 时敏感度 0.85、特异度 0.52。', '筛查阳性提示需要进一步检查，不等于诊断。'] },
  { id: 'k12', year: 2014, journal: 'J Oral Facial Pain Headache', type: '共识', title: 'DC/TMD Axis I 诊断算法的修订', topic: ['诊断标准'], findings: ['RDC/TMD 原 Axis I 效度未达目标，据此修订为 DC/TMD。', '修订后的算法对最常见的疼痛相关 TMD 与一类关节内紊乱有效。'] },
  { id: 'k13', year: 2014, journal: 'J Oral Facial Pain Headache', type: '共识', title: 'DC/TMD 临床与研究应用推荐', topic: ['诊断标准'], findings: ['给出 Axis I 诊断算法与 Axis II 工具的最终推荐。', 'Axis II 覆盖疼痛强度、功能受限与心理困扰。'] },
  { id: 'k14', year: 2017, journal: 'J Oral Rehabil', type: '实验研究', title: '实验性颞肌疼痛对下颌运动的影响', topic: ['下颌运动'], findings: ['实验性颞肌疼痛使张口与咀嚼的幅度、速度下降。', '运动改变与负性情绪、疼痛灾难化相关。'] },
  { id: 'k16', year: 2024, journal: 'J Med Internet Res', type: '多中心 RCT', title: 'TMD 数字治疗的多中心随机假对照试验', topic: ['数字治疗'], findings: ['韩国两家大学医院，按 DC/TMD 诊断的成人随机分入数字治疗或假应用组。', '干预包含疾病教育、引导式下颌运动、行为习惯追踪与心理教育。'] },
  { id: 'k17', year: 2026, journal: 'J Oral Rehabil', type: '横断面', title: '口腔行为对 TMD 各亚型口腔健康相关生活质量的四维影响', topic: ['口腔行为', '生活质量'], findings: ['989 例初诊患者：合并型与疼痛相关型清醒期非进食口腔行为更频繁。', '下颌过度使用行为分级与心理困扰、生活质量受损相关。'] },
  { id: 'k18', year: 2015, journal: 'J Dent Res', type: '前瞻队列', title: '一般健康状况与首发 TMD：OPPERA 前瞻队列', topic: ['风险因素'], findings: ['2722 名无 TMD 史的成人随访中位 2.8 年，260 人出现首发 TMD。', '下背痛者首发风险高约 50%，生殖区疼痛症状者高约 75%。'] },
  { id: 'k19', year: 2025, journal: 'J Oral Rehabil', type: 'RCT', title: '多模式行为治疗整合进 TMD 管理（DC/TMD Axis II 结局）', topic: ['CBT', '行为治疗'], findings: ['120 例 TMD 患者，8 周行为治疗（疼痛神经科学教育 + CBT + 放松 + 肌电反馈）对比常规治疗。', '结局含 VAS、最大张口度、JFLS-20、GCPS 与心理困扰。'] },
  { id: 'k21', year: 2023, journal: 'CRANIO', type: '信度研究', title: '中文版 DC/TMD Axis I 诊断的检查者间信度', topic: ['诊断标准', '中文版'], findings: ['67 人由 3 位专科医师评估，疼痛与关节盘移位诊断一致性良好至优秀（κ 0.659–1.000）。', '临床诊断与 MRI 的一致性为中等至良好（κ 0.400）。'] },
  { id: 'k22', year: 2025, journal: 'J Oral Rehabil', type: '可行性 RCT', title: '青少年 TMD 疼痛的网络行为治疗', topic: ['CBT', '青少年'], findings: ['13–19 岁按 DC/TMD 诊断后随机分入 7 周网络行为治疗或咬合板治疗。', '评估依从性与疼痛强度、疼痛相关失能、心理社会结局。'] },
  { id: 'k23', year: 2023, journal: 'Sci Rep', type: '系统综述与 meta', title: '网络与移动端 CBT 用于慢性疾病', topic: ['CBT', '数字治疗'], findings: ['纳入慢性病 RCT，评价 IM-CBT 对心理与躯体结局的作用及调节因素。', '为线上 CBT 的可推广性提供跨疾病证据。'] },
  { id: 'k24', year: 2024, journal: 'J Oral Rehabil', type: 'RCT', title: '数字与模拟工具联合管理清醒磨牙', topic: ['清醒磨牙', '提醒'], findings: ['72 名可能清醒磨牙者分三组，使用手机应用与/或黏贴式提醒 30 天。', '实时评估显示提醒类工具可降低清醒磨牙行为频率。'] },
  { id: 'k26', year: 2026, journal: 'J Oral Rehabil', type: '伞状综述', title: 'TMD 自我管理治疗的证据（系统综述综述）', topic: ['自我管理', '证据总览'], findings: ['11 篇系统综述、49 项原始研究：6 篇支持自我管理有效，5 篇认为证据不足。', '证据缺口集中在生活质量与不良事件；方法学质量整体偏低。'] },
  { id: 'k27', year: 2026, journal: 'J Oral Rehabil', type: '潜在类别分析', title: '心理社会—行为表型与 TMD 风险', topic: ['表型', '心理'], findings: ['东南亚年轻成人分为稳健型（56.1%）、中度易感型（30.4%）、高风险型（13.5%）。', '用 PHQ-4、PHQ-15、OBC 刻画表型，与 TMD 严重度相关。'] },
  { id: 'k28', year: 2008, journal: 'J Oral Rehabil', type: '探索性研究', title: '有疼痛史者的下颌运动', topic: ['下颌运动'], findings: ['有三叉神经病理性疼痛史者张口幅度降低、运动变异性增加。', '运动学指标与疼痛灾难化等心理测量相关。'] },
  { id: 'k31', year: 2023, journal: 'BMJ', type: '临床实践指南', title: 'TMD 相关慢性疼痛的管理：快速推荐', topic: ['治疗', '指南'], findings: ['对病程 ≥3 个月的 TMD 相关慢性疼痛，强推荐 CBT（可联合生物反馈或放松）、治疗师辅助关节松动、手法触发点治疗、监督下姿势与下颌运动训练。', '推荐强度基于证据确定性分级，不推荐常规使用不可逆咬合治疗。'] },
  { id: 'k33', year: 2023, journal: 'Front Neurol', type: '因子分析', title: '中国 TMD 患者口腔行为的探索性与验证性因子分析', topic: ['口腔行为', '中文版'], findings: ['在中国 TMD 人群中检验 OBC 的因子结构，支持其多维结构。', '为中文人群使用 OBC 提供结构效度依据。'] },
  { id: 'k34', year: 2022, journal: 'Cochrane Database Syst Rev', type: 'Cochrane 综述', title: 'TMD 的心理治疗', topic: ['心理治疗', '证据总览'], findings: ['系统评价心理治疗（以 CBT 为主）对 TMD 疼痛与心理结局的作用。', '证据确定性多为低至中等，需结合个体情况使用。'] },
  { id: 'k35', year: 2024, journal: 'J Oral Rehabil', type: '系统综述', title: 'TMD 疼痛的心理治疗：短期与长期效果', topic: ['心理治疗'], findings: ['18 项 RCT：心理治疗与常规治疗在疼痛性 TMD 上效果大致相当。', '部分结局（疼痛相关失能、 catastrophizing）可能更优。'] },
  { id: 'k36', year: 2024, journal: 'J Dent', type: 'RCT 试点', title: 'TMD 数字治疗的随机对照试点', topic: ['数字治疗'], findings: ['40 例 TMD 患者，数字治疗组在 NRS 疼痛评分上显著下降（p = 0.016）。', '样本小、随访短，属试点性质。'] },
  { id: 'k37', year: 2010, journal: 'Acta Odontol Scand', type: '前瞻队列', title: 'TMD 体征与症状发生及持续的风险因素', topic: ['风险因素'], findings: ['280 名瑞典牙科学生随访 2 年，自我报告的磨牙与错颌与 TMD 发生相关。', '不同结局指标的风险因素不完全一致。'] },
  { id: 'k38', year: 2013, journal: 'J Oral Facial Pain Headache', type: '实验研究', title: '颞肌与咬肌同时伤害性刺激对下颌运动的影响（第一部分）', topic: ['下颌运动', '实验痛'], findings: ['15 名无症状者在高渗盐水注射后张口与咀嚼幅度、速度下降。', '运动改变与负性情绪、疼痛灾难化相关。'] },
  { id: 'k39', year: 2026, journal: 'CRANIO', type: '横断面', title: '牙科学生的睡眠质量、日间嗜睡、心理困扰与 TMD 症状', topic: ['睡眠', '心理'], findings: ['睡眠质量差、日间嗜睡与心理困扰和 TMD 症状同时出现。', '横断面设计不能确定因果方向。'] },
  { id: 'k40', year: 2024, journal: 'Clin Oral Investig', type: '横断面', title: 'TMD 患者睡眠期与清醒期口腔行为', topic: ['口腔行为', '睡眠'], findings: ['700 例初诊患者：口腔行为频率与下颌功能受限、心理困扰相关。', '睡眠期与清醒期行为需分开评估。'] },
  { id: 'k41', year: 2023, journal: 'CRANIO', type: '横断面', title: '中美大学生 TMD 症状、口腔行为与焦虑抑郁比较', topic: ['流行病学', '跨文化'], findings: ['435 名学生：中国学生 TMD 筛查阳性率显著更高（OR 3.21）。', 'PHQ-9 与 OBC-21 得分与筛查阳性相关。'] },
  { id: 'k42', year: 2003, journal: 'Med Care', type: '量表验证', title: 'PHQ-2 两条目抑郁筛查的效度', topic: ['量表', '抑郁'], findings: ['两个条目、0–3 计分，用于快速筛查抑郁。', '适合作为初筛，阳性需进一步评估。'] },
  { id: 'k43', year: 2021, journal: 'J Oral Rehabil', type: 'RCT', title: '慢性 TMD 患者的治疗反应与副功能频率', topic: ['治疗', '口腔行为'], findings: ['45 人随机分入物理治疗、稳定咬合板或对照治疗，按 OBC 分高/低副功能组。', '物理治疗组在特征性疼痛强度上改善更明显。'] },
  { id: 'k44', year: 2022, journal: 'Clin Oral Investig', type: '系统综述', title: '数字化下颌运动分析的设备相关变量', topic: ['下颌运动', '设备'], findings: ['30 项研究：设备类型（电磁、光电、超声等）与生理变量共同影响测量结果。', '53.5% 研究证据确定性低于中等，跨设备比较需谨慎。'] },
  { id: 'k45', year: 2022, journal: 'Oral Surg Oral Med Oral Pathol Oral Radiol', type: '诊断准确性', title: 'DC/TMD 五个典型症状作为 TMD 筛查工具', topic: ['筛查'], findings: ['1039 名成人：5Ts（面痛、头痛、关节音、闭口锁、开口锁）作为筛查工具评估。', '适合初筛，阳性者仍需临床检查确认。'] },
];

const QA = [
  {
    id: 'qa01',
    questions: ['颞下颌关节紊乱是什么', 'TMD 是什么', '我这是不是 TMD'],
    answer: [
      '颞下颌关节紊乱（TMD），说白就是管张嘴的那对关节和周围的咀嚼肌出了状况。常见的是脸或耳朵前面疼、嘴张不大、张嘴有响声或摩擦声。',
      '这毛病很常见。多数人靠自我管理，加上必要的对症处理，就能明显好转。它不是关节「坏掉了」。',
      '到底属于哪一种，得医生当面查，线上看不出来。',
    ],
    sources: ['k12', 'k13', 'k26'],
    boundary: '这里不判断你属于哪一种。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa02',
    questions: ['关节响要紧吗', '张口有响声', '弹响'],
    answer: [
      '张嘴「咔哒」响很常见。光凭响声看不出严不严重，也不一定需要治。',
      '真正要留意的是三件事：响的同时还疼、嘴张不开，或者卡住以后要晃一下才能张开。有这些，去做个检查。',
      '摩擦声、碎渣声跟「咔哒」不是一回事，通常说明关节面有变化，让医生听一次。',
    ],
    sources: ['k12', 'k13', 'k45'],
    boundary: '光看文字，分不出你是哪种响。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa03',
    questions: ['要不要拍片', '需要做核磁吗', '拍片子'],
    answer: [
      '脸疼不是一上来就要拍片。医生一般先问、先查，再决定要不要拍。',
      '怀疑关节盘移位、关节面磨损，或者检查和你的感觉对不上时，可能会让你做核磁。普通 X 光片看不清关节盘这类软组织，帮助有限。',
      '有研究让几位医生分别看同一批人，结论和核磁对得上的比例是中等偏上。所以面诊和拍片是互相补，不是谁替代谁。',
    ],
    sources: ['k21', 'k13'],
    boundary: '拍不拍片，得接诊医生定。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa04',
    questions: ['总是紧咬牙', '牙齿咬得很紧', '白天咬紧牙'],
    answer: [
      '白天牙齿不知不觉碰在一起、还咬得挺紧，这是让下颌不适一直好不了的最常见原因之一。',
      '先做一件事：让牙齿分开。上下牙之间留两三毫米，嘴唇闭上，舌尖轻轻抵在上门牙后面。不用整天坚持，一天想起来几次就管用。',
      '再找出你最容易咬紧的时候：专心干活、通勤、盯屏幕、心里发紧。把提醒绑在这些时刻上，比空喊「放松点」有用。',
      '要是同时睡不好、情绪也绷着，一起处理，效果更稳。',
    ],
    sources: ['k05', 'k17', 'k40', 'k27'],
    boundary: '紧咬还伴随牙齿明显磨平、或者早上起来脸酸，去查一次牙齿。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa05',
    questions: ['热敷还是冷敷', '敷一下'],
    answer: [
      '主要是肌肉酸、发紧，热敷一般更舒服：温毛巾敷脸或太阳穴 10–15 分钟，别烫着。',
      '要是受过外伤，或者明显肿、发烫，先冷敷，尽快去医院，别反复热敷。',
      '敷只是当下舒服一点，替代不了改紧咬、睡眠、压力这些根上的事。',
    ],
    sources: ['k26', 'k31'],
    boundary: '脸上皮肤感觉迟钝的，温度要格外小心。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa06',
    questions: ['吃什么', '要不要吃软食', '饮食注意'],
    answer: [
      '疼得厉害那几天，先别啃特别硬、特别韧、要嚼很久的东西，肌肉能少受点累。',
      '但别长期只吃软的。一直不嚼，下颌功能反而会往下掉。短期少吃硬的，然后慢慢加回来。',
      '吃慢一点、两边轮着嚼，比换食谱更容易坚持。',
    ],
    sources: ['k26', 'k31', 'k02'],
    boundary: '疼到吃不下、体重往下掉，尽快去医院。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa07',
    questions: ['张不开口', '张口受限', '嘴张不大'],
    answer: [
      '嘴张不大分两种。一种是疼着张不开，多半是肌肉太紧；另一种是突然卡住、合不上或张不开，这种要尽快处理。',
      '现在要是合不上、或者明显错位，别自己使劲掰，去口腔急诊。',
      '如果是慢慢越张越小，安排一次颞下颌关节专科评估。这期间可以做点温和的放松，别硬追张开的幅度。',
    ],
    sources: ['k12', 'k13', 'k31'],
    boundary: '这里不判断张不开的原因。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa08',
    questions: ['焦虑会不会加重', '压力大疼得厉害', '情绪和疼痛'],
    answer: [
      '会。情绪、睡眠和疼痛会互相拱火：心里紧，肌肉就更紧；越疼越盯着它看；睡不好，第二天更扛不住。',
      '这不是说你的疼「是想出来的」。多项长期跟踪研究都发现，情绪困扰和 TMD 的出现、拖久有关。但有关联，不等于它是唯一原因。',
      '能动手的地方很具体：先把紧咬和睡眠改一点。这比逼自己「别焦虑」实在得多。',
    ],
    sources: ['k02', 'k27', 'k39', 'k18'],
    boundary: '情绪已经明显影响日常生活，就去找心理或精神科的专业支持。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa09',
    questions: ['CBT 有用吗', '认知行为治疗', '心理治疗有效吗'],
    answer: [
      '疼了三个月以上的 TMD，现行指南对认知行为治疗（CBT）是明确推荐的，可以配合放松训练或生物反馈一起做。',
      '也有综述发现：论疼痛强度，心理治疗和常规治疗差不多；但在「疼起来有多耽误事」「会不会一个劲往坏处想」这些方面，心理治疗可能更好。',
      '准确地说，CBT 不是更强的止痛药。它是把「让疼一直持续」的那些想法和做法拆掉。',
      'Cochrane 综述认为，这块证据的说服力是低到中等，效果因人而异。',
    ],
    sources: ['k31', 'k34', 'k35', 'k19'],
    boundary: 'CBT 代替不了必要的口腔治疗或药物。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa10',
    questions: ['手机上的课程有用吗', '数字治疗', '线上干预有效吗'],
    answer: [
      '有一些早期证据。一项多家医院参与的试验，测试了一款 TMD 手机应用，里面有疾病讲解、带着做的下颌运动、习惯记录和心理教育。',
      '另有一项 40 人的小型试验，用数字治疗的那组在 0–10 的疼痛评分上降得更多。但人少、跟踪时间短，只能算初步结果。',
      '其他慢性病的研究也发现，线上 CBT 对情绪、以及部分身体指标有帮助。',
      '关键通常不在内容多不多，而在你到底用没用。这也是我们盯着完成率的原因。',
    ],
    sources: ['k16', 'k36', 'k23'],
    boundary: '工具是辅助，代替不了诊断和必要的临床处理。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa11',
    questions: ['咬合板有用吗', '牙套', '磨牙垫'],
    answer: [
      '稳定咬合板对一部分人有用，尤其是夜里磨牙、早上起来脸酸的人。',
      '它一般是整套管理里的一环，不是单靠它就能解决。要口腔医生取模做，还要定期复查。',
      '一上来就大量磨牙、或者想靠正畸「治好 TMD」，不该作为常规首选——这些改动不可逆。',
    ],
    sources: ['k31', 'k43', 'k26'],
    boundary: '适不适合戴，要临床评估。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa12',
    questions: ['运动能不能做', '按摩', '手法治疗'],
    answer: [
      '可以，而且有证据。指南推荐在有人指导下做姿势训练、下颌运动和拉伸、按揉激痛点，以及由治疗师做的关节松动。',
      '一项针对肌肉型 TMD 女性的试验里，颈部稳定训练、Rocabado 训练，以及两者合起来，8 周后疼痛和活动度都有改善，几种方案之间差别不大。',
      '自己练记住三点：幅度小、不追着疼练、每天分几次少练一点。',
    ],
    sources: ['k31', 'k01'],
    boundary: '外伤后或正在肿的时候，别自己做大幅度运动。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa13',
    questions: ['什么时候要去看医生', '什么情况要就医'],
    answer: [
      '有下面任何一条，尽快去医院：脸或脖子明显肿起来还发烫、张嘴后合不上、外伤后突然更疼、耳朵流液或一直高烧、脸发麻或看东西变了。',
      '另外这几种，安排一次专科评估：嘴越张越小、有摩擦声或碎渣声、不舒服超过半年、自己调理两周多还没起色。',
      '去医院时把症状梳理和最近的记录带上，医生问起来快很多。',
    ],
    sources: ['k13', 'k31', 'k45'],
    boundary: '紧急情况直接去急诊，别等线上回复。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa14',
    questions: ['会不会越来越严重', '会不会好', '能不能自愈'],
    answer: [
      '多数人的 TMD 会时好时坏，但总体在往好走，尤其是以肌肉紧张为主、关节没有明显结构改变的那种。',
      '有一项把多个综述汇总起来的研究：11 篇综述里，6 篇认为自我管理对 TMD 有帮助，5 篇觉得证据还不够。也就是说，它对一部分人管用，但不是对谁都够。',
      '更实在的做法：认真自我管理 2–4 周，同时记着看变化。没起色就去做评估，别一直等。',
    ],
    sources: ['k26', 'k02', 'k09'],
    boundary: '没法凭文字预测你个人的走向。',
    reviewStatus: 'approved',
  },
  {
    id: 'qa15',
    questions: ['青少年', '孩子也会吗', '十几岁'],
    answer: [
      '会。青少年里 TMD 疼痛不算少见，会影响生活和学习，也是成年早期还疼的一个提示因素。',
      '有一项针对青少年的试验，把 7 周线上行为治疗和咬合板治疗放在一起比，看的是能不能坚持、疼痛和日常受影响的程度。',
      '孩子的自我管理要家长一起参与，但提醒和记录最好让他自己来，别做成被盯着完成的任务。',
    ],
    sources: ['k22', 'k02'],
    boundary: '未成年人看病，需要监护人陪同。',
    reviewStatus: 'approved',
  },
];

function findAnswer(text) {
  const q = String(text || '').trim();
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  QA.forEach((item) => {
    let score = 0;
    item.questions.forEach((kw) => {
      if (q.indexOf(kw) >= 0) score += kw.length;
    });
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  });
  return bestScore > 0 ? best : null;
}

function sourceById(id) {
  return SOURCES.find((s) => s.id === id) || null;
}

module.exports = { SOURCES, QA, findAnswer, sourceById };
