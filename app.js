App({
  globalData: {
    appName: '颞安智护',
    session: null,
    track: '',
  },

  onLaunch() {
    // 云客户端在 utils/cloud.js 中初始化一次，全局复用
    try {
      require('./utils/cloud');
    } catch (err) {
      console.error('[颞安智护] cloud init failed', err);
    }
  },
});
