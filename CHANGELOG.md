# Changelog

本项目的所有重要变更记录于此。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.1.0] — 2026-11-03

改名与公开发布版。**不兼容变更**：项目更名，`upstream/` 退出仓库。

### 变更

- 项目更名为 **Motion Forge（动效工坊）**，仓库迁至 `cxcmyt/motion-forge`，技能名 `kiro-motion-studio` → `motion-forge`。
- **`upstream/` 不再入库**：新增 `scripts/fetch-upstream.js`，由使用者在自己机器上按需克隆（含浏览器路径补丁与字体补齐）。许可边界从「分层声明」变为「物理隔离」——仓库里不再有任何第三方代码。
- 字体迁至 `assets/fonts/`；`examples/opener.js`、`examples/signal20.js`、`scripts/verify.js` 的字体路径同步更新。
- `verify.js` 增加第 8 项：上游是否就位（仅 `[warn]`，不计入失败）。
- `render-samples.js` 在未拉取上游时**跳过** 3D 步骤并给出提示，而非报错退出。

### 修复

- 上游实际目录结构是 `examples/<项目>/`，文档中 `upstream/kiro-3d-logo/...` 一律改为 `upstream/examples/kiro-3d-logo/...`；`package.json` 的 `stills` / `bundle:*` 同步。
- 上游写死浏览器路径的脚本实为 **4 个**（原文档记为 3 个，漏了 `kiro-3d-logo/cover.js`），拉取脚本按内容匹配全部修掉。
- 新克隆首跑 `npm run verify` 时，缺依赖会打印完整 require 堆栈，已改为单行提示。

### 移除

- `references/original-SKILL.md`、`references/upstream-README.md` —— 上游文本副本，随 `upstream/` 一起退出仓库。

---

## [1.0.0] — 2026-11-03

首个公开发布版本。基线为上游 commit `4f9ec42`（2026-10-30）。

### 新增

- **`examples/opener.js`** — 12 秒卡点片头模板。120 BPM 网格，五个镜头（逐字上翻 → 曲速推进 → 故障段 → 方块拼贴 → 压线收尾），改 `CFG` 四个常量即换片。
- **`examples/signal20.js`** — 20 秒程序化科技片。数据雨 / 三层波形 + 38 段频谱 / 1100 顶点点云 / 透视地网 / 快门收尾。
- **`tools/chrome.js`** — 跨平台 Chromium 定位器。解析顺序：`KIRO_CHROME` 环境变量 → `ms-playwright` 缓存（版本倒序）→ 系统 Edge / Chrome / Chromium。附 `KIRO_GL` 硬件加速开关。
- **`scripts/verify.js`** — 环境自检七项：Node 版本、ffmpeg、浏览器、依赖、内置字体、中文字形、西文注册。
- **`scripts/render-samples.js`** — 一键批量渲染全部示例产物。
- **`references/methodology.md`** — 方法论整理：时间轴公式、四层结构、后期参数表、帧率分层、质检清单。
- **`manifest.json`** — 技能元数据，含中英双语描述与依赖声明。
- **`docs/preview/`** — 8 张预览图，README 引用。
- **中英双 README** — `README.md` / `README.en.md`。

### 修复（使上游代码可在本机运行）

- **浏览器路径**：三个 `drive.js` 的 `executablePath` 由硬编码 `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` 改为 `CHROME.path`，`args` 改为 `CHROME.glArgs()`。
- **字体目录**：补建 `upstream/fonts/`，放入 6 个 WOFF（Unbounded / Space Mono / Space Grotesk / Major Mono Display / Rock Salt / Shrikhand）。上游 2D 脚本一行未改即可运行。
- **中文字形**：运行时将系统字体（Windows `msyh.ttc`、macOS `PingFang.ttc`、Linux Noto CJK）注册为别名 `Noto Sans SC`，业务代码字体名不变。
- **依赖收敛**：各 example 的分散 `package.json` 合并至顶层，补 `package-lock.json`。

### 修复（原创层）

- **输出目录自动创建**：`examples/*` 的 `still` / `sheet` / `video` 三个出口在写盘前统一 `mkdir -p`，支持任意多级路径。此前新克隆的仓库不含 `out/`，README 首条命令会直接 `ENOENT` 崩溃 —— 该缺陷被 `render-samples.js` 会自行创建目录的行为掩盖，直到在干净检出副本上端到端验证才暴露。

### 变更

- **目录重构**：上游代码统一迁入 `upstream/`，原创层留在 `examples/` 与 `tools/`，使许可边界在文件系统层面可见。
- **许可分层**：新增 `LICENSE`（MIT，仅覆盖原创层）与 `NOTICE`（上游声明、字体许可、逐项改动披露）。

### 已知问题

- 3D 管线中间帧为 JPEG q96，非无损。
- `upstream/mv-lyrics/asr.py` 需自备 whisper 模型，未打通。
- `upstream/2d-canvas/*_body.js` 为开发期片段，结尾悬空 `}`，不可独立运行。

---

## 与上游的关系

上游 [KRYPT-123/kiro-motion-studio](https://github.com/KRYPT-123/kiro-motion-studio) 是**单次提交**的仓库（无历史可追溯），因此本项目的版本号与之无对应关系，仅以 commit 哈希标注基线。
