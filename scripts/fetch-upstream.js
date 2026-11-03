#!/usr/bin/env node
// 按需拉取上游参考实现到 upstream/ —— 该目录默认不入库（见 .gitignore）。
//
// 本仓库不复制、不再分发上游代码。3D 管线与上游那几个作品脚本需要时，由你自己
// 从原作者仓库拉一份到你本地，许可关系因此保持清晰：你拿到的仍是原作者的代码，
// 适用原作者的条件，与本仓库的 MIT 无关。
//
// 用法：
//   node scripts/fetch-upstream.js              # 拉默认分支到 upstream/
//   node scripts/fetch-upstream.js --force      # 覆盖重拉
//   node scripts/fetch-upstream.js --ref <sha>  # 指定分支 / 标签 / commit
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'upstream');
const FONTS = path.join(ROOT, 'assets', 'fonts');

const UPSTREAM_URL = 'https://github.com/KRYPT-123/kiro-motion-studio.git';

const argv = process.argv.slice(2);
const force = argv.includes('--force') || argv.includes('-f');
const refIdx = argv.indexOf('--ref');
const ref = refIdx >= 0 ? argv[refIdx + 1] : null;

const say = (m) => console.log(m);
const die = (m, hint) => {
  console.error('\n[失败] ' + m);
  if (hint) console.error('       ' + hint);
  process.exit(1);
};

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
}

/** 递归找出上游里所有写死浏览器路径的脚本（上游有 4 个，比文档里写的 3 个多一个） */
function findHardcoded(dir, depth = 0, out = []) {
  if (depth > 3) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) findHardcoded(p, depth + 1, out);
    else if (e.name.endsWith('.js') && /\/opt\/pw-browsers/.test(fs.readFileSync(p, 'utf8'))) out.push(p);
  }
  return out;
}

// ---------- 1. 前置检查 ----------
try {
  git(['--version']);
} catch {
  die('未找到 git', 'Windows 装 Git for Windows；macOS 执行 xcode-select --install');
}

const exists = fs.existsSync(DEST) && fs.readdirSync(DEST).length > 0;
if (exists && !force) {
  say('upstream/ 已存在，跳过。要重新拉取请加 --force。');
  say('目录：' + DEST);
  process.exit(0);
}
if (exists) {
  say('--force：清空旧的 upstream/');
  fs.rmSync(DEST, { recursive: true, force: true });
}

// ---------- 2. 拉取 ----------
say('正在从上游拉取…');
say('  仓库：' + UPSTREAM_URL);
say('  版本：' + (ref || '默认分支'));

try {
  const args = ['clone', '--depth', '1', '--quiet'];
  if (ref) args.push('--branch', ref);
  git([...args, UPSTREAM_URL, DEST]);
} catch (e) {
  const msg = String(e.stderr || e.message || '').trim().split('\n').slice(-3).join('\n       ');
  die('克隆失败', msg || '检查网络或代理；仓库若已删除或改名，请到 GitHub 搜索作者 KRYPT-123');
}

if (ref) {
  try {
    git(['-C', DEST, 'fetch', '--depth', '1', 'origin', ref]);
    git(['-C', DEST, 'checkout', '--quiet', ref]);
  } catch {
    say('  [warn] 未能切到 ' + ref + '，保留默认分支');
  }
}

let sha = 'unknown';
try {
  sha = git(['-C', DEST, 'rev-parse', 'HEAD']).slice(0, 7);
} catch {}
say('  已获取 commit ' + sha);

// ---------- 3. 就地打补丁：让上游脚本定位本机浏览器 ----------
// 上游把 executablePath 写死成作者的 Linux 沙箱路径，不改必然崩。
// 补丁在你的机器上现场应用，仓库里不含任何上游代码，只含这段替换逻辑。
const targets = findHardcoded(DEST);
let patched = 0;
for (const f of targets) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(DEST, f).replace(/\\/g, '/');
  // upstream/<proj>/x.js → ../../tools/chrome.js；upstream/examples/<proj>/x.js → ../../../tools/chrome.js
  const up = rel.split('/').length - 1;
  const chrome = "'" + '../'.repeat(up) + '../tools/chrome.js' + "'";
  const out = src.replace(/executablePath:\s*'[^']*'/g, 'executablePath: require(' + chrome + ').path');
  if (out !== src) {
    fs.writeFileSync(f, out);
    patched++;
  }
}
say(
  patched
    ? '  已就地修复 ' + patched + ' 个脚本的浏览器路径'
    : '  [warn] 未发现写死浏览器路径的脚本（上游可能已自行修好）'
);

// ---------- 4. 补齐字体 ----------
// 上游 2D 脚本读 __dirname + '/../fonts/'，两种目录布局都补上，约 600 KB
const woffs = fs.readdirSync(FONTS).filter((f) => /\.woff2?$/.test(f));
for (const sub of ['fonts', path.join('examples', 'fonts')]) {
  const target = path.join(DEST, sub);
  fs.mkdirSync(target, { recursive: true });
  for (const f of woffs) fs.copyFileSync(path.join(FONTS, f), path.join(target, f));
}
say('  已补齐 fonts/ 与 examples/fonts/：' + woffs.length + ' 个字体');

// ---------- 5. 收尾 ----------
const dirs = fs
  .readdirSync(DEST, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
  .map((d) => d.name);
// 去掉 clone 自带的 .git，避免变成嵌套仓库（也省一半体积）
fs.rmSync(path.join(DEST, '.git'), { recursive: true, force: true });

say('\n完成。upstream/ 已就绪：' + dirs.join(', '));
say('');
say('3D 管线走这三步：');
say('  npm run bundle:3d');
say('  node upstream/examples/kiro-3d-logo/drive.js stills 1.0,5.0 out/3d');
say('  node upstream/examples/kiro-3d-logo/drive.js video out/3d/logo.mp4 0 300');
say('');
say('提醒：upstream/ 是原作者代码，版权归 KRYPT-123，无 LICENSE → 保留所有权利。');
say('      仅供你本地学习研究，不要提交回本仓库，也不要再分发。详见 NOTICE。');
