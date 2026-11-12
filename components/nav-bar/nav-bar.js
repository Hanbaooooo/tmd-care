Component({
  properties: {
    // 是否显示返回；tab 页不显示
    back: {
      type: Boolean,
      value: false,
    },
    // 可选的小标题，默认不显示（页面自己已有大标题）
    title: {
      type: String,
      value: '',
    },
  },

  data: {
    statusH: 20,
    holder: 64,
    showBack: false,
  },

  lifetimes: {
    attached() {
      let statusH = 20;
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        statusH = info.statusBarHeight || 20;
      } catch (e) {
        statusH = 20;
      }
      // back 显式传入为 true 时显示；页面栈里还有上一页也补一个，
      // 免得某个页面忘了写 back 就退不出去
      let stack = 0;
      try {
        stack = getCurrentPages().length;
      } catch (e) {
        stack = 0;
      }
      this.setData({
        statusH,
        holder: statusH + 44,
        showBack: !!this.data.back || stack > 1,
      });
    },
  },

  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }
      wx.switchTab({
        url: '/pages/home/home',
        fail: () => wx.reLaunch({ url: '/pages/home/home' }),
      });
    },
  },
});
