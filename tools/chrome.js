// 跨平台 Chromium 定位器，替代原仓库写死的 /opt/pw-browsers/chromium-1243/chrome-linux64/chrome
// 优先级：环境变量 KIRO_CHROME > ms-playwright 缓存（版本号从高到低）> 系统 Edge / Chrome
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUBPATHS = [
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
];

const SYSTEM_FALLBACKS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function exists(p) {
  try {
    return !!p && fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function roots() {
  const out = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) out.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (process.platform === 'win32') out.push(path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'));
  out.push(path.join(os.homedir(), '.cache', 'ms-playwright'));
  out.push(path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'));
  return out.filter(Boolean);
}

function candidates() {
  const list = [];
  for (const root of roots()) {
    let dirs = [];
    try {
      dirs = fs.readdirSync(root);
    } catch {
      continue;
    }
    const builds = dirs
      .map((d) => /^chromium-(\d+)$/.exec(d))
      .filter(Boolean)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    for (const m of builds) {
      for (const sub of SUBPATHS) list.push(path.join(root, m[0], sub));
    }
  }
  return list.concat(SYSTEM_FALLBACKS);
}

function resolveChrome() {
  if (process.env.KIRO_CHROME && exists(process.env.KIRO_CHROME)) return process.env.KIRO_CHROME;
  const hit = candidates().find(exists);
  if (!hit) {
    console.error('[chrome] 未找到 Chromium / Chrome / Edge。请设置环境变量 KIRO_CHROME 指向浏览器可执行文件。');
    process.exit(1);
  }
  return hit;
}

// 默认软渲染（swiftshader），保证无显卡/远程桌面环境也能出图。
// 有独显时设置 KIRO_GL=d3d11（Windows）或 KIRO_GL=metal（macOS）可提速数倍。
function glArgs() {
  if (process.env.KIRO_GL === 'd3d11') {
    return ['--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy'];
  }
  if (process.env.KIRO_GL === 'metal') {
    return ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'];
  }
  return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
}

module.exports = {
  get path() { return resolveChrome(); },
  resolveChrome,
  candidates,
  glArgs,
};

