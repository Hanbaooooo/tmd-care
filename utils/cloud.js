const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics');

// publicConfig 来自云服务开通结果，只包含可公开的前端配置
const publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_zvQKo2tqFcVjHyRU3wojbq_Ys476JsYUzSoP8Pkxzst2iBgBelX6u64',
  workBuddyOAuthClientId: 'cb_jq6QyEPkOkJXPcpz0JxS_wbapp_zvQKo2tqFcVjHyRU3wojbq',
};

let cloud = null;

try {
  cloud = createMiniProgramWorkBuddyCloud({
    endpoint: publicConfig.endpoint,
    publishableKey: publicConfig.publishableKey,
    workBuddyOAuthClientId: publicConfig.workBuddyOAuthClientId,
    wx: createDiagnosticWx(wx),
  });
} catch (err) {
  console.error('[颞安智护] createMiniProgramWorkBuddyCloud failed', err);
}

module.exports = { cloud, publicConfig };
