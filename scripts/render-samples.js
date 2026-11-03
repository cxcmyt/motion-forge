#!/usr/bin/env node
// 一键批量渲染全部示例产物，用于发版前核对或快速预览。
//   node scripts/render-samples.js            # 只出静帧与分镜（约 40 秒）
//   node scripts/render-samples.js --video    # 额外渲染 2D 成片与 3D 短片（约 4 分钟）
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'out', 'samples');
const WITH_VIDEO = process.argv.includes('--video');

fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
const t0 = Date.now();

function step(label, fn) {
  const t = Date.now();
  process.stdout.write(`\n▶ ${label}\n`);
  try {
    const r = fn();
    if (r === false) throw new Error('子进程返回非零');
    console.log(`  ✓ ${((Date.now() - t) / 1000).toFixed(1)}s`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${e.message}`);
  }
}

function node(args, label) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${label} 退出码 ${r.status}`);
}

// 3D 步骤依赖上游参考实现，未拉取时静默跳过而不是报失败
const HAS_UPSTREAM = fs.existsSync(path.join(ROOT, 'upstream', 'examples', 'kiro-3d-logo', 'scene.js'));

function upstreamStep(label, fn) {
  if (HAS_UPSTREAM) return step(label, fn);
  console.log(`\n▶ ${label}`);
  console.log('  – 跳过：未拉取上游参考实现 → node scripts/fetch-upstream.js');
}

function rel(p) {
  return path.join(OUT, p);
}

// ---------- 2D 静帧 ----------
step('2D · opener 静帧（1.4 / 6.4 / 9.6 s）', () => {
  for (const t of ['1.4', '6.4', '9.6']) {
    node(['examples/opener.js', 'still', t, rel(`opener-${t}.jpg`)], 'opener');
  }
});

step('2D · signal20 静帧（6.4 / 10.6 / 15.0 s）', () => {
  for (const t of ['6.4', '10.6', '15.0']) {
    node(['examples/signal20.js', 'still', t, rel(`signal-${t}.jpg`)], 'signal20');
  }
});

// ---------- 分镜 ----------
step('2D · 分镜缩略图', () => {
  node(['examples/opener.js', 'sheet', '0.8,2.4,4.8,6.4,7.6,9.6,11.2,11.9', rel('sheet-opener.jpg')], 'sheet opener');
  node(['examples/signal20.js', 'sheet', '1.0,4.0,6.4,9.0,12.0,15.0,17.0,19.5', rel('sheet-signal.jpg')], 'sheet signal');
});

// ---------- 3D（可选，需上游参考实现） ----------
upstreamStep('3D · 打包 + 静帧', () => {
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'upstream', 'examples', 'kiro-3d-logo', 'scene.js')],
    bundle: true,
    format: 'iife',
    loader: { '.woff': 'binary' },
    outfile: path.join(ROOT, 'upstream', 'examples', 'kiro-3d-logo', 'bundle.js'),
    logLevel: 'error',
  });
  node(['upstream/examples/kiro-3d-logo/drive.js', 'stills', '1.0,9.0', rel('3d')], '3D stills');
});

// ---------- 成片（可选） ----------
if (WITH_VIDEO) {
  step('成片 · opener 12s @60fps', () => node(['examples/opener.js', 'video', '60', rel('opener-1080p60.mp4')], 'opener video'));
  step('成片 · signal20 20s @60fps', () => node(['examples/signal20.js', 'video', '60', rel('signal-1080p60.mp4')], 'signal video'));
  upstreamStep('成片 · 3D logo 5s @60fps', () => node(['upstream/examples/kiro-3d-logo/drive.js', 'video', rel('3d-logo.mp4'), '0', '300'], '3D video'));
} else {
  console.log('\n（跳过成片渲染，加 --video 可一并输出）');
}

// ---------- 汇总 ----------
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(OUT);

console.log(`\n${'─'.repeat(52)}`);
console.log(`产物目录：${OUT}`);
for (const f of files) {
  const kb = (fs.statSync(f).size / 1024).toFixed(0);
  console.log(`  ${path.relative(OUT, f).padEnd(28)} ${kb.padStart(6)} KB`);
}
console.log(`总计 ${files.length} 个文件，用时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (failed) {
  console.log(`\n${failed} 个步骤失败，请检查上方日志。`);
  process.exitCode = 1;
}
