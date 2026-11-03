# 贡献指南

感谢你愿意改进这个项目。以下规则不长，但有几条是硬性的。

---

## 最重要的一条

**不要提交 `upstream/`。**

那个目录由 `scripts/fetch-upstream.js` 在**每个人自己的机器上**生成（上游 commit `4f9ec42` 的快照），已在 `.gitignore` 中。它是第三方代码，版权归原作者且无 LICENSE（默认保留所有权利）—— 本仓库不分发它，这是整个许可安排的前提。一旦 `git add -f` 强行提交，这个前提就没了。

需要修改上游行为时，正确做法是：

1. 在原创层（`examples/`、`tools/`、`scripts/`）写包装或替代实现；
2. 或者往 `fetch-upstream.js` 的补丁步骤里加一条**最小字符串替换**，并在 PR 里说明「上游第 N 行的行为有问题，因为……」。

目前对上游的唯一改动是 4 个脚本各一行的浏览器路径，且只在你本机拉取时应用，已完整披露在 `NOTICE` 与 `references/local-port.md`。

---

## 提交前自查

```bash
node scripts/verify.js          # 七项全绿
node examples/opener.js sheet 1.2,4.4,6.4,9.6 out/sheet.jpg   # 能出图
```

改了渲染逻辑的，还要跑一遍 `still` 对比改动前后同一时间点，确认不是「看起来差不多」而是「确实没坏」。

---

## 代码风格

- **CommonJS**，不加 `"type": "module"`（驱动脚本依赖 `require` 与相对路径解析）。
- **不引入构建步骤**。克隆下来就能跑是核心卖点，不要为了一点点语法糖引入 Babel/TS 编译。
- **确定性**：任何随机必须来自固定的 hash 函数，同 `t` 必须同画面。禁止 `Math.random()`。
- **时间一律走 `B(n)`**：不要写 `t > 3.2` 这种绝对秒数，镜头会跟着 BPM 漂移。
- **注释写「为什么」**，不写「做什么」。参数用中文说明取值范围与观感后果。
- 文件名小写加连字符；变量名允许 `B/BP/oC/oE` 这类领域缩写，但首次出现要在注释里给出全称。

---

## 提交信息

遵循约定式提交（Conventional Commits）的中文变体：

```
feat(opener): 增加竖屏 9:16 构图
fix(signal20): 修正点云深度排序导致的闪烁
docs(readme): 补充 Windows 下 ffmpeg 安装说明
refactor(tools): chrome.js 支持 KIRO_CHROME 相对路径
```

类型限定：`feat` / `fix` / `docs` / `refactor` / `perf` / `chore`。
一个提交只做一件事，不要混入无关的格式化改动。

---

## PR 要包含什么

1. **动机**：解决了什么问题，谁会遇到。
2. **验证**：贴 `verify.js` 输出，以及改动前后的 `sheet` 对比图。
3. **影响面**：是否把 `upstream/` 加进了提交（应当为否）、是否改变已发布模板的默认输出。
4. **许可**：确认你的贡献按 MIT 授权（原创层部分）。

---

## 不接受的改动

- 把 `upstream/` 目录提交进仓库
- 引入 TypeScript / 打包器 / 框架依赖
- 把 `Math.random()` 放进渲染路径
- 仅调整排版偏好的大规模重排（会让 diff 无法 review）
- 声称「大幅提速」但没有基准数据的改动 —— 请附 `time` 输出

---

## 报告问题

请附上：

- `node scripts/verify.js` 的完整输出
- 操作系统、Node 版本、ffmpeg 版本
- 复现命令与期望结果
- 3D 相关问题额外附 Chromium 路径（`verify.js` 会打印）
