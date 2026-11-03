# 移植记录：从上游仓库到本机可用

上游：`https://github.com/KRYPT-123/kiro-motion-studio`（2026-10-30 单次提交，35 star，179 KB，无 LICENSE）

本目录是它的**可运行移植版**。上游代码不能直接跑——不是配置问题，是四处硬编码与一处文件缺失。改造原则是"不改作者创作思路，只修让它无法启动的地方"。

> **v1.1.0 起**：上游代码不再打包进仓库，改由 `scripts/fetch-upstream.js` 在各人本机拉取。
> 下表「移植改法」中的浏览器路径与字体补齐，现在发生在**拉取时**，代码在 `fetch-upstream.js` 里。

---

## 一、上游开箱即崩的四处

| # | 问题 | 证据 | 移植改法 | 涉及文件 |
|---|---|---|---|---|
| 1 | 浏览器路径写死 Linux 沙箱 | **4 个**脚本（3 个 `drive.js` + `kiro-3d-logo/cover.js`）均为 `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` | 新增 `tools/chrome.js`：`KIRO_CHROME` 环境变量 → `%LOCALAPPDATA%\ms-playwright\chromium-*`（按版本号倒序）→ 系统 Edge / Chrome → Linux/macOS 常见路径；拉取时把 4 处硬编码替换为 `require(...tools/chrome.js).path` | `tools/chrome.js`、`scripts/fetch-upstream.js` |
| 2 | 字体目录缺失 | 每个 2D 脚本首行 `fs.readdirSync(__dirname + '/../fonts/')`，但仓库无 fonts 目录 | 从 `@fontsource/*` 取 6 个 woff 存于 `assets/fonts/`，拉取时复制到 `upstream/fonts/` 与 `upstream/examples/fonts/`（覆盖两种目录布局），原脚本一行未改即可运行 | `assets/fonts/` |
| 3 | 中文字形缺失 | 上游 SKILL.md 自称"常见坑"，但未给解法 | 运行时把系统字体（Windows `msyh.ttc` / macOS `PingFang.ttc` / Linux Noto CJK）以**别名**注册为 `Noto Sans SC`，业务代码字体名不变 | `examples/*.js` |
| 4 | 依赖散落在各子目录 | 每个 example 各自 `package.json` | 顶层单一 `package.json` 统一管理，`npm install --omit=dev` 一次装完（98 MB） | `package.json` |

额外增加 `KIRO_GL` 开关：默认 swiftshader 软渲染（无显卡 / 远程桌面可用），`KIRO_GL=d3d11`（Windows 独显）或 `metal`（macOS）走硬件加速。

新增内容（非上游）：

- `examples/opener.js` — 12 s 卡点片头模板，改 4 个常量即换字换色
- `examples/signal20.js` — 20 s 程序化科技片（数据雨 / 三层波形 / 点云 / 透视地网 / 快门收尾）
- `scripts/verify.js` — 环境自检（node / ffmpeg / 浏览器 / 字体 / 中文字形 / 依赖 / 上游是否就位）
- `scripts/fetch-upstream.js` — 按需拉取上游并按需打补丁，避免第三方代码进入仓库
- `manifest.json` — 技能元数据

---

## 二、目录结构

```
motion-forge/
├── SKILL.md                      技能入口（方法论速查 + 命令）
├── README.md / README.en.md      项目说明（中 / 英）
├── LICENSE / NOTICE              MIT · OFL-1.1 · 上游关系声明
├── CHANGELOG.md / CONTRIBUTING.md
├── manifest.json                 元数据
├── package.json                  统一依赖（npm install --omit=dev）
├── scripts/
│   ├── verify.js                 环境自检（八项，末项仅告警）
│   ├── render-samples.js         批量出样片（3D 缺失自动跳过）
│   └── fetch-upstream.js         按需拉取上游（可选）
├── tools/chrome.js               跨平台浏览器定位器
├── assets/fonts/                 6 个 woff（OFL-1.1）
├── references/
│   ├── methodology.md            方法论详表（参数 / 转场 / 质检 / 坑）
│   └── local-port.md             本文件
├── docs/preview/                 README 预览图
├── examples/                     ★ 原创层（MIT）
│   ├── opener.js                 12 s 卡点片头模板
│   └── signal20.js               20 s 程序化科技片
└── upstream/                     ⚠ 运行时生成，不入库（fetch-upstream.js 的产品）
    ├── examples/                 上游真实布局：examples/<项目>/
    │   ├── 2d-canvas/            上游 5 个原始脚本 + 开发期片段
    │   ├── kiro-3d-logo/         three.js 铬金属 Logo（scene.js → drive.js）
    │   ├── kjstar-cosmic-vj/     宇宙 VJ 循环
    │   ├── baifu-collage-vj/     拼贴 VJ
    │   └── mv-lyrics/            歌词 MV（ASR 脚本需自备 whisper 模型）
    └── fonts/                    拉取时从 assets/fonts 复制
```

`bundle.js`（esbuild 产物，约 1 MB）不入包，用 `npm run bundle:3d` 现生成。

---

## 三、实测数据（Windows / Node 22 / 32 核 / ffmpeg 6.0）

| 项目 | 结果 |
|---|---|
| 3D 静帧 | 0.33 – 0.53 s/帧（单帧，不带运动模糊） |
| 3D 成片 | 约 0.83 s/帧（4 子帧运动模糊）；300 帧用 4 分 8 秒 |
| 2D 成片（12 s） | 720 帧，120 秒出片，14 MB |
| 2D 成片（20 s） | 1200 帧，约 71 秒，18.1 MB |

结论：软渲染**可用但不适合长片**。30 s@60fps 单进程需 20 分钟以上，必须按核数分段并行再拼。

---

## 四、踩过的坑（按发现顺序，全部实测）

### 1. 文字画在独立图层时，主画布的变换无效

最初把推进镜头的 `scale/rotate` 加在主 canvas 上，结果**文字纹丝不动、只有背景在缩放**，五个镜头看起来几乎一样。

原因：文字绘制在离屏图层上，主画布的变换不作用于离屏合成。
正确做法：把变换挪到后期合成阶段，在 `drawImage(文字层, ...)` 时施加。

### 2. alpha 双重相乘导致元素近乎不可见

透视地网明明画了却完全看不见：

```js
cx.strokeStyle = `rgba(95,227,255,${alpha})`;   // 0.16
cx.globalAlpha = alpha;                          // × 0.16
```

实际不透明度 0.16 × 0.16 ≈ 0.026。改为**只由 `globalAlpha` 控制**，`strokeStyle` 用实色。

### 3. 要遮住文字的元素必须放 post 阶段

收尾"快门黑条"画在文字层合成**之前**，被文字整个盖掉；闪白同理。
规则：任何叠加在文字之上的元素（黑条、闪白、扫描线、暗角）一律进 post 函数。

### 4. 时间区间右端点写成 99 导致收尾动画永不触发

`SHOTS` 末段写成 `[B(21), 99, 'out']`，于是 `u = (t - t0) / (99 - t0) ≈ 0.01` 恒定，
"压成细线淡出"永远停在第一帧。右端点必须是真实 `DUR`。

### 5. 五个镜头看起来雷同

不是动画没生效，而是**主标在每个镜头都居中同尺寸**。修正：第 2 镜缩到 56 px、第 3 镜换成巨型"03"数字水印、第 4 镜换构图。镜头差异必须落在**主体形态**上，不能只换背景。

### 6. 字体不会自动等待加载（浏览器侧同理）

无头浏览器里 `@font-face` 在首帧可能尚未就绪，静默回退系统字体。
必须 `GlobalFonts.registerFromPath`（canvas）或 `document.fonts.load` + `delayRender`（浏览器）。

### 7. esbuild 是原生二进制，不能 `node esbuild`

要 `npx esbuild` 或 `node_modules/.bin/esbuild`。上游 SKILL.md 也提到这条。

### 8. `pkill -f node` 会杀掉自己

并行渲染脚本里用 `pkill -f` 清理残留，会把当前 shell 的 node 一并杀掉。用 PID 文件精确 kill。

---

## 五、代码质量评估（如实标注）

- 无模块化、无测试、无类型、无 CI；本移植版补了 `package-lock.json`
- 变量名是 `BP / B0 / oC / oE / glintsOn` 这类靠上下文才能读懂
- `render3.js` 与 `render4.js` 去空白后仅 514 行差异，主体大量重复，不知道该以哪个为准
- `*_body.js` 结尾是悬空的 `}`，属开发残留，**不可独立运行**

判断：**能读，不能改**。当作作品源码存档看，不要当作可维护的库依赖。

---

## 六、三条技术路线的定位

| 需求 | 推荐 |
|---|---|
| 一次性、画面要极精确卡点 | 本技能（手写 canvas 逐帧，自由度最高，零工程护栏） |
| 要交给团队、要参数化批量 | Remotion（React 组件 + 官方渲染器，工程化最完整） |
| 要最快出第一版、希望被 lint 拦住低级错误 | HyperFrames（单 HTML + GSAP 时间线，30 秒渲完 720 帧） |

---

## 七、许可

上游无 LICENSE，默认"保留所有权利"。本目录仅可用于学习与本地实验；**商用或二次分发前须联系原作者**。
