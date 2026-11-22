// 可配置项：留空的项会自动降级，不阻塞流程
module.exports = {
  // 微信订阅消息模板 ID。填了才走微信服务端推送；
  // 留空时只做「打开小程序时的应用内提醒」。
  weeklyTemplateId: '',

  // 扫码建档时写进 tmd_visits.clinic 的科室名，医师端队列显示的就是这个。
  clinicName: '口腔颌面疼痛专科',
};
