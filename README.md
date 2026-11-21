# 颌·心

面向口腔修复、正畸及颞下颌关节相关门诊**初诊患者**的 DC/TMD 双轴智能分诊与随访系统。

候诊阶段采集 Axis II 自评（OBC-21 / GAD-7 / PHQ-4 / JFLS-8 / NRS / DC/TMD SQ），医师面诊时结构化录入 Axis I 体征并签核，自动生成一页式双轴报告。

> **风险分层只代表病例复核优先级，不等同于患病概率。** 本系统不替代医师诊断。
> 患者端只展示医师签核定稿版本。

---

## 本地跑起来

1. 装「微信开发者工具」（稳定版即可）。
2. 「导入项目」→ 选本目录 → **AppID 填真实的小程序 AppID**。
3. 编译。

> 仓库里 `project.config.json` 的 `appid` 现在是 `touristappid`（游客模式）。这个值只能跑模拟器，**真机预览和上传都不可用**。拿到真实 AppID 后由管理员统一改这一行并提交——**AppID 不是密钥，公开无妨**，整个团队用同一个才不会互相冲突。真正不能进仓库的是 AppSecret（本项目用不到，也不要加）。

依赖：

```bash
npm install        # 目前只有开发期用到的工具依赖，小程序本身不依赖 node_modules
```

---

## 把别人拉进来（管理员照做）

改代码这件事只需要打通两条线：**代码谁能拿到、小程序谁能上传**。前者在 GitHub，后者在微信公众平台。两条线互不影响，可以分开做。

### 第一步：GitHub 加协作者（必须做，2 分钟）

1. 打开 `https://github.com/Hanbaooooo/tmd-care/settings/access`
2. 点 **Add people** → 输入对方的 **GitHub 用户名**（不是昵称，是 `@` 后面那串）→ 权限选 **Write** → 发送邀请
3. 对方登录 GitHub，在邮箱里点接受；或直接打开仓库页面顶部那条黄色横幅接受

仓库目前是 **public**，不加人也能 clone（只能看、不能推）。加了 Write 才能 `git push`。

### 第二步：对方把代码拉下来

```bash
git clone https://github.com/Hanbaooooo/tmd-care.git
```

会得到一个 `tmd-care/` 目录，进去就是完整项目。

### 第三步：在开发者工具里打开

「导入项目」→ 选刚 clone 的目录 → AppID 那栏**暂时可以留空或填 `touristappid`**。

游客模式下能编译、能在模拟器里改样式看效果，**够改代码用了**。真机预览和上传才需要真实 AppID。

### 第四步：只有要真机预览/上传时，才需要微信这侧

1. 你登录 [mp.weixin.qq.com](https://mp.weixin.qq.com) → **设置 → 基本设置** 复制 `AppID`（`wx` + 16 位十六进制）。没有就先注册一个小程序，个人主体即可，不需要 300 元认证
2. **管理 → 成员管理 → 开发者** → 添加对方微信号
3. 对方在开发者工具里把 AppID 改成这个，用**自己的微信**扫码登录工具，就能预览和上传了

一句话记住：**一个 AppID 对应一个小程序，只有被加进成员管理的微信号才能上传它。**

### 日常怎么用，别用命令行也行

开发者工具左侧有个 **「版本管理」** 面板，填仓库地址和 GitHub 账号后，可以图形化地「拉取 / 提交 / 推送」，不用记命令。给不熟 git 的同事用这个最省事。

提交前唯一要养成的习惯：**先拉取、再改、改完立刻推**。两个人同时改同一个文件就会冲突。

### 对方完全不懂 git 怎么办

把整个文件夹打包（排除 `node_modules/`、`.workbuddy/`）发过去，改完再发回来，由你用 `git diff` 对比合并。**能用，但只能串行**：不能两人同时改，否则后发回来的会把先前的覆盖掉。

---

## 目录结构

```
app.js / app.json / app.wxss   入口、路由与 tabBar、全局设计令牌
components/nav-bar/            自定义导航条（custom 导航 + backdrop-filter 磨砂）
components/bg-layer/           固定视口底纹（单色 + 96rpx 平铺颗粒）
data/                          纯数据与算法：Axis I 定义、判定规则、量表、筛查、知识库
pages/                         14 个页面
styles/                        报告页与医师工作台共用版式
utils/                         云服务封装、本地存储、报告展示逻辑
_offline/                      已下线页面（不注册、不打包；代码保留，可随时回滚）
images/                        静态图
```

几个必须知道的约定：

| 位置 | 说明 |
|---|---|
| `app.wxss` | 全局设计令牌（颜色、线条、圆角）都在这里。**改颜色只改这里**，不要在页面里写死色值 |
| `components/bg-layer` | 背景是 `position: fixed` 铺满视口的独立层，**只放 96rpx 平铺颗粒，不放任何随高度变化的渐变**。全站底色只有 `#F6FBF9` 一个值，必须与 `app.json` 的 `window.backgroundColor`、`tabBar.backgroundColor` 完全一致。任何一处不一致，页面盒子边缘就会露出一条色带（真机上的"分层"） |
| `data/axis1.js` | DC/TMD **Axis I** 结构化体征定义（医师面诊录入）。字段 key 一旦上线不要改名，旧记录存的就是 key |
| `data/rules.js` | **四类复核状态只在这里判**。阈值集中在 `THRESHOLDS`，报告上的说明文字会跟着变。改判定先改这里，不要在页面里写 if |
| `data/scales.js` | 量表题库与版本档案（OBC 12 项 / 21 项） |
| `data/psych.js` | **Axis II** 患者自评（GAD-7 / PHQ-4 / OBC-21 / JFLS-8） |
| `utils/report-view.js` | 报告页与工作台共用的展示逻辑（分数行、色调、时间格式）。两处渲染同一份数据，规则只写一遍 |
| `utils/store.js` | 云端读写（Supabase 风格的托管库）。**所有数据访问都从这里走**，页面里不要直接调 |

---

## 双轴报告与签核

### 一次就诊的生命周期

```
候诊绑定就诊（tmd_visits，status=waiting_self_report）
   → 患者填 Axis II（psych 页）→ 落一份报告，status=submitted
   → 医师在工作台录 Axis I → 报告状态实时重算
   → 签核（status=signed）→ 患者端可见
   → 撤回（status=withdrawn）→ 患者端立刻不可见
```

### 四类状态的含义

状态说的是**医师下一步该做什么**，不是病情轻重：

| 状态 | key | 含义 |
|---|---|---|
| 优先人工复核 | `priority` | 命中风险信号，这个病例先看 |
| 需补充评估 | `need_more` | 有缺项或前后不一致，先补再判 |
| 待补录 | `pending_input` | Axis I 还没录，报告不成立 |
| 常规记录 | `routine` | 没命中任何信号 |

**「优先人工复核」只表示复核先后，不代表患病概率。** 这句话在 welcome、报告页、本文件三处都出现，改文案时不要删。

### 可溯源怎么保证

每条命中都带 `ruleId / ruleVersion / threshold / sourceItems`，报告上点开一条就能看到「哪张量表、哪个字段、卡在什么阈值」。要加规则就在 `data/rules.js` 里 `push` 一条，别在页面里拼字符串。

### 患者端为什么不会看到医师的草稿

签核时把当下这一版整体冻结进 `tmd_reports.patient_snapshot`。患者端读的是快照，不是正文。之后医师再改正文，患者端不变；撤回时快照清空，患者端立刻看不到。

### 一个必须说清的边界

数据库 RLS 是 `owner_id = auth.uid()`，也就是**只能读写自己的行**。所以医师工作台目前是**本机账号演示模式**：只列出用当前账号提交的评估，界面上也如实标注了这句。要变成真正的「全科室队列」，需要：

1. 新增 `tmd_staff`（科室成员表）与 `tmd_visits.clinic_id`
2. RLS 改成 `owner_id = auth.uid() OR clinic_id IN (SELECT clinic_id FROM tmd_staff WHERE user_id = auth.uid())`
3. 报告页同步加同样的读权限

在没有这三步之前，不要在对外材料里说「已支持多医师协作」。

---

## 分工建议

三个人以内，按这三块切最省事，因为它们的改动几乎不重叠：

| 角色 | 负责 | 主要文件 |
|---|---|---|
| 数据与量表 | 题库、计分、分级、筛查逻辑 | `data/`、`utils/adherence.js` |
| 页面与视觉 | 版式、动线、文案 | `pages/`、`components/`、`app.wxss` |
| 云服务与存储 | 登录、同步、数据表 | `utils/store.js`、`utils/session.js`、`utils/cloud.js` |

**三个冲突热点**，改之前先 `git pull`，改完立刻提交，别攒着：

1. `app.json` —— 页面/组件注册、tabBar
2. `app.wxss` —— 全局样式
3. `data/scales.js`、`data/psych.js` —— 量表题面与阈值

---

## 分支与提交

```
main            可编译、可上传体验版的稳定线
feat/xxx        新功能
fix/xxx         修 bug
```

- 提交信息写清楚改了什么页面/什么模块，例如 `fix(plan): 修长页面背景分层`。
- 合并前必须本地编译跑一遍，至少走一遍自己改的那条动线。
- 不要提交 `project.private.config.json`（本机私有设置）、`node_modules/`、`.workbuddy/`，这些已在 `.gitignore` 里。

---

## 量表版本的硬约束

OBC（口腔行为清单）从 12 项简版换成了 21 项完整版，**两套分数不能混算**：

- 12 项：0–48 分，未定阈值
- 21 项：0–84 分，阈值 16 / 24

所以 `tmd_scale_results` 表里每条结果都带 `version`、`item_count`、`score_max` 三列。写入时三件套一起写（`pages/scale/scale.js` 已实现），分析时**按 `version` 分组**。`data/scales.js` 的 `profileOf()` / `bandOf()` 遇到未登记的旧版本会返回空分级，不会用新阈值反推旧分数——这是故意的，别改。

---

## 发版

1. 任一开发者用开发者工具「上传」。
2. 微信公众平台 → 管理 → **版本管理** → 把该版本设为**体验版** → 体验者扫码。
3. 提审、发布需要管理员或有权限的运营者操作。

---

## 数据与隐私

- 患者记录按登录身份隔离（库侧 RLS）。**多人同时调试会往同一个库里写数据**，测试用各自的微信账号，别共用一个号来回点。
- 云端连接的 applicationId 在 `utils/cloud.js`，客户端没有服务端密钥，但仍不要把它贴到公开渠道或截图里。
- 涉及真实患者数据时，导出与分析都在库侧做完再带走脱敏结果，不要把原始数据落到本地仓库。

---

## 已知待办

- [x] 换真实 AppID（当前 `wx16d875b790f73435`，只存在于本机 `project.config.json`，靠 `skip-worktree` 挡在 git 之外）
- [ ] 医师工作台接入科室账号（见上文「一个必须说清的边界」三步）
- [ ] 诊所二维码带参建就诊：现在是首页手动生成 `V20261121-0001` 形式的就诊号，真实场景应由诊所码带 `clinic` 与 `visit_no`
- [ ] 心理评估结果目前只存本地，未做跨设备同步
- [ ] `_offline/` 里的六周课程、A 线研究、安心问答已从界面移除；若要恢复，把目录移回 `pages/` 并在 `app.json` 重新注册即可
