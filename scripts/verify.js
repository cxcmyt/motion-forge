#!/usr/bin/env node
// 环境自检：node / ffmpeg / 浏览器 / 字体 / 依赖 / 中文字形
// 用法：node scripts/verify.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ok = (m) => console.log('  [ok]   ' + m);
const bad = (m) => {
  console.log('  [fail] ' + m);
  fails++;
};
const warn = (m) => console.log('  [warn] ' + m);
let fails = 0;

console.log('KIRO Motion Studio 环境自检');
console.log('root: ' + ROOT + '\n');

// 1. node
const major = Number(process.versions.node.split('.')[0]);
major >= 20 ? ok(`node ${process.versions.node}`) : bad(`node ${process.versions.node}（需 >= 20）`);

// 2. ffmpeg
try {
  const v = execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0];
  ok(v.trim().slice(0, 60));
} catch {
  bad('未找到 ffmpeg，2D/3D 出片都会失败');
}

// 3. 浏览器
try {
  const chrome = require(path.join(ROOT, 'tools', 'chrome.js'));
  const p = chrome.resolveChrome();
  ok('浏览器: ' + p);
  console.log('         GL 参数: ' + chrome.glArgs().join(' '));
} catch (e) {
  bad('浏览器定位失败: ' + e.message);
}

// 4. 依赖
const deps = ['@napi-rs/canvas', 'three', 'playwright-core', 'esbuild'];
const missing = [];
for (const d of deps) {
  try {
    require.resolve(d, { paths: [ROOT] });
  } catch {
    missing.push(d);
  }
}
missing.length === 0 ? ok('依赖齐全（' + deps.join(', ') + '）') : bad('缺少依赖: ' + missing.join(', ') + ' → 在技能目录执行 npm install --omit=dev');

// 5. 字体
const FD = path.join(ROOT, 'assets', 'fonts');
let fonts = [];
try {
  fonts = fs.readdirSync(FD).filter((f) => /\.woff2?$/.test(f));
  fonts.length >= 6 ? ok(`内置字体 ${fonts.length} 个: ` + fonts.join(', ')) : warn(`内置字体仅 ${fonts.length} 个: ` + fonts.join(', '));
} catch {
  bad('assets/fonts 缺失，所有 2D 脚本会在启动时 ENOENT');
}

// 6. 字体注册 + 中文字形
try {
  const { createCanvas, GlobalFonts } = require(require.resolve('@napi-rs/canvas', { paths: [ROOT] }));
  for (const f of fonts) GlobalFonts.registerFromPath(path.join(FD, f));
  const cjkCandidates = [
    'C:/Windows/Fonts/msyh.ttc',
    'C:/Windows/Fonts/msyhbd.ttc',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ];
  const cjk = cjkCandidates.find((p) => fs.existsSync(p));
  const ctx = createCanvas(200, 60).getContext('2d');
  ctx.font = '32px "Unbounded"';
  const wEn = ctx.measureText('KIRO').width;
  if (cjk) {
    GlobalFonts.registerFromPath(cjk, 'Noto Sans SC');
    ctx.font = '32px "Noto Sans SC"';
    const wCn = ctx.measureText('中文测试').width;
    wCn > 30 ? ok(`中文字形可用（别名 Noto Sans SC ← ${path.basename(cjk)}）`) : bad('中文字形宽度异常，可能渲染为方框');
  } else {
    bad('未找到系统中文字体，请手动在脚本顶部补充路径');
  }
  wEn > 40 ? ok(`西文字体注册成功（Unbounded "KIRO" 宽 ${Math.round(wEn)}px）`) : bad('西文字体注册失败，字形会回退成系统默认');
} catch (e) {
  warn('字体检测跳过（依赖未装）: ' + String(e.message).split('\n')[0]);
}

// 7. 上游参考实现（可选，仅 3D 管线需要）
const upDir = path.join(ROOT, 'upstream');
if (fs.existsSync(upDir) && fs.readdirSync(upDir).length > 0) {
  ok('上游参考实现已就位（3D 管线可用）');
} else {
  warn('未拉取上游参考实现（3D 管线与 5 个上游脚本不可用）→ node scripts/fetch-upstream.js');
}

console.log('');
if (fails === 0) {
  console.log('结论：环境就绪，可执行 node examples/opener.js still 9.6 out/a.jpg 验证出帧。');
} else {
  console.log(`结论：${fails} 项未通过，请先修复再渲染。`);
  process.exitCode = 1;
}
