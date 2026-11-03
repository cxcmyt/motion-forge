// KIRO Motion Studio — 本机移植版示例：卡点动态字片头
// 遵循 SKILL.md 的硬约束：每镜头 ≥4 层、时间轴用 B(n)=B0+n·BP、先定 BPM 再排镜头、只让高光发光。
// 合成顺序：背景 → 装饰 → 文字层（带变换）→ 后期（辉光/色差/切片/颗粒/暗角）
// 用法：node opener.js still 3.2 out.jpg | sheet 1,4,7.5 out.jpg | video 60 out.mp4
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ---------------- 可改区（换字、换色、换节奏只动这里） ----------------
const CFG = {
  main: 'MOTION',            // 主标题（拉丁大写效果最好）
  sub: 'BY CODE',            // 副标题
  cn: '用代码渲染每一帧',      // 中文补充行
  hud: 'LOCAL PORT // WIN32', // 角落 HUD 标识
  bpm: 120,
  dur: 12,
  bg: '#05060a',
  accent: '#c6ff00',
  ink: '#f2f4f8',
};
// ---------------------------------------------------------------------

const W = 1920, H = 1080, FPS = 60;
const BP = 60 / CFG.bpm, B0 = 0, B = n => B0 + n * BP;
const DUR = CFG.dur;

// ---------- 字体：西文走 @fontsource，中文把系统字体注册成 Noto Sans SC 别名 ----------
const FD = path.join(__dirname, '..', 'assets', 'fonts');
if (fs.existsSync(FD)) for (const f of fs.readdirSync(FD)) GlobalFonts.registerFromPath(path.join(FD, f));
for (const cjk of ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/msyhbd.ttc', '/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']) {
  if (fs.existsSync(cjk)) { GlobalFonts.registerFromPath(cjk, 'Noto Sans SC'); break; }
}
const BIG = 'Unbounded', MONO = 'Space Mono', CN = 'Noto Sans SC';

// ---------- 缓动与噪声 ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const pr = (t, a, b) => clamp((t - a) / (b - a));
const oC = u => 1 - Math.pow(1 - u, 3);
const oE = u => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
const ioC = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const dec = (t, a, k = 8) => (t < a ? 0 : Math.exp(-(t - a) * k));
const pulse = (t, k = 7) => { const i = Math.floor((t - B0) / BP); return i < 0 ? 0 : dec(t, B(i), k); };

// ---------- 画布 ----------
const C = createCanvas(W, H), cx = C.getContext('2d');
const L = createCanvas(W, H), lx = L.getContext('2d');   // 文字层，单独做变换与色差
const G = createCanvas(W / 2, H / 2), gx = G.getContext('2d');
const SNAP = createCanvas(W, H), snp = SNAP.getContext('2d');
const grains = [];
for (let i = 0; i < 4; i++) {
  const c = createCanvas(480, 270), x = c.getContext('2d'), d = x.createImageData(480, 270);
  for (let k = 0; k < d.data.length; k += 4) { const v = 128 + (Math.random() - 0.5) * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
  x.putImageData(d, 0, 0); grains.push(c);
}

function measure(x, str, font, track) {
  x.font = font;
  const ws = [...str].map(ch => x.measureText(ch).width);
  return { ws, total: ws.reduce((a, b) => a + b, 0) + track * (str.length - 1) };
}

// 第 1 层：背景（径向渐变 + 缓慢漂移的噪声团 + 网格）
function layerBg(t, tint = 1) {
  const x = cx;
  x.fillStyle = CFG.bg; x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W * 0.5 + Math.sin(t * 0.5) * 120, H * 0.52, 0, W * 0.5, H * 0.52, W * 0.62);
  g.addColorStop(0, `rgba(26,32,20,${0.85 * tint})`);
  g.addColorStop(0.4, 'rgba(13,16,20,0.9)');
  g.addColorStop(1, 'rgba(5,6,10,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  gx.clearRect(0, 0, W / 2, H / 2);
  for (let i = 0; i < 26; i++) {
    const s = hash(i * 3.1);
    const px = (hash(i * 7.7) * W / 2 + t * (12 + s * 30)) % (W / 2);
    const py = hash(i * 11.3) * H / 2 + Math.sin(t * 0.4 + i) * 26;
    const r = 60 + s * 130;
    const rg = gx.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, `rgba(150,190,40,${0.022 + 0.022 * s})`); rg.addColorStop(1, 'rgba(150,190,40,0)');
    gx.fillStyle = rg; gx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.8; x.drawImage(G, 0, 0, W, H); x.restore();
  x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1;
  const off = (t * 24) % 80;
  for (let i = -1; i < W / 80 + 2; i++) { x.beginPath(); x.moveTo(i * 80 + off, 0); x.lineTo(i * 80 + off, H); x.stroke(); }
  for (let j = 0; j < H / 80 + 1; j++) { x.beginPath(); x.moveTo(0, j * 80); x.lineTo(W, j * 80); x.stroke(); }
}

// 第 3 层：装饰动态层（HUD 弧线、刻度、十字星、小节计数）
function layerDeco(t, k = 1) {
  const x = cx, cxm = W / 2, cym = H / 2;
  x.save();
  for (let i = 0; i < 3; i++) {
    const a0 = t * (0.6 + i * 0.35) + i * 1.7;
    x.strokeStyle = `rgba(198,255,0,${(0.34 - i * 0.07) * k})`; x.lineWidth = 1.6;
    x.beginPath(); x.arc(cxm, cym, 330 + i * 78, a0, a0 + 0.9 + 0.3 * i); x.stroke();
  }
  x.strokeStyle = `rgba(242,244,248,${0.34 * k})`;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + t * 0.15;
    const on = i % 8 === 0, r1 = 470, r2 = r1 + (on ? 26 : 11);
    x.lineWidth = on ? 2 : 1;
    x.beginPath(); x.moveTo(cxm + Math.cos(a) * r1, cym + Math.sin(a) * r1); x.lineTo(cxm + Math.cos(a) * r2, cym + Math.sin(a) * r2); x.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const px = 180 + hash(i * 5.5) * (W - 360), py = 130 + hash(i * 9.1) * (H - 260);
    const s = (6 + 10 * Math.pow(Math.sin(Math.PI * ((t * 0.7 + hash(i)) % 1)), 3)) * (1 + pulse(t, 5) * 1.4);
    x.strokeStyle = `rgba(242,244,248,${0.35 * k})`; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(px - s, py); x.lineTo(px + s, py); x.moveTo(px, py - s); x.lineTo(px, py + s); x.stroke();
  }
  x.font = `18px "${MONO}"`; x.fillStyle = `rgba(242,244,248,${0.55 * k})`; x.textBaseline = 'top'; x.textAlign = 'left';
  x.fillText(CFG.hud, 64, 52);
  x.fillText(`BPM // ${CFG.bpm}`, 64, 78);
  const bar = Math.floor(t / (BP * 4)) + 1, beat = Math.floor(t / BP) % 4 + 1;
  x.fillText(`BAR ${String(bar).padStart(2, '0')}.${beat}`, 64, 104);
  x.textAlign = 'right';
  x.fillText(`${W}x${H} / ${FPS}FPS`, W - 64, 52);
  x.fillText(`T+${t.toFixed(2)}s`, W - 64, 78);
  x.restore();
}

// 第 4 层：前景（飘过的光斑，制造景深）
function layerFg(t) {
  const x = cx;
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const s = hash(i * 2.7);
    const px = ((hash(i * 4.3) * W + t * (140 + s * 260)) % (W + 400)) - 200;
    const py = hash(i * 8.9) * H, r = 26 + s * 90;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(255,255,240,${0.05 + 0.06 * s})`); g.addColorStop(1, 'rgba(255,255,240,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  x.restore();
}

// ---------- 第 2 层：文字（画进独立图层 L，便于整体变换） ----------
function drawMain(t, u, scaleK = 1, yOff = 0) {
  const x = lx, size = 150, font = `${size}px "${BIG}"`;
  const track = lerp(46, 6, oC(u));
  const { ws, total } = measure(x, CFG.main, font, track);
  let px = W / 2 - total / 2;
  x.save(); x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const sc = (1 + 0.045 * pulse(t, 7)) * scaleK;
  x.translate(W / 2, H / 2); x.scale(sc, sc); x.translate(-W / 2, -H / 2 + yOff);
  [...CFG.main].forEach((ch, i) => {
    const ui = clamp((u - i * 0.055) / 0.5), e = oE(ui);
    x.save();
    x.beginPath(); x.rect(px - 30, H / 2 - size * 0.92, ws[i] + 60, size * 1.5); x.clip();
    x.translate(0, (1 - e) * size * 1.15);
    x.globalAlpha = 0.15 + 0.85 * e;
    x.fillStyle = CFG.ink; x.font = font;
    x.fillText(ch, px, H / 2 + size * 0.35);
    x.restore();
    px += ws[i] + track;
  });
  x.restore();
}

function drawSub(t, u) {
  const x = lx;
  const e = oC(clamp((u - 0.35) / 0.5));
  const track = lerp(30, 14, e);
  x.font = `44px "${MONO}"`;
  const { total } = measure(x, CFG.sub, `44px "${MONO}"`, track);
  let px = W / 2 - total / 2;
  x.save(); x.globalAlpha = e; x.textBaseline = 'alphabetic'; x.fillStyle = CFG.accent;
  [...CFG.sub].forEach(ch => { x.fillText(ch, px, H / 2 + 250); px += x.measureText(ch).width + track; });
  x.restore();
  const e2 = oC(clamp((u - 0.55) / 0.45));
  if (e2 > 0.01) {
    x.save(); x.globalAlpha = e2 * 0.92; x.fillStyle = CFG.ink;
    x.font = `34px "${CN}"`; x.textAlign = 'center'; x.textBaseline = 'top';
    x.fillText(CFG.cn, W / 2, H / 2 + 320 + (1 - e2) * 18);
    x.restore();
  }
}

// ---------- 后期：所有"作用于整幅画面"的效果都在这里，保证文字也被打到 ----------
let POST = {};
function resetPost() { POST = { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, duotone: false, strips: null, slices: null, scan: 0 }; }

function post(t, fl = 0, exp = 0) {
  const x = cx;
  const put = (a, ox, oy) => {
    x.save(); x.globalAlpha = a;
    x.translate(W / 2 + POST.dx, H / 2 + POST.dy);
    x.rotate(POST.rot); x.scale(POST.sx, POST.sy);
    x.translate(-W / 2, -H / 2);
    x.drawImage(L, ox, oy); x.restore();
  };
  // 辉光：只让文字发光，不污染字形
  x.save(); x.globalCompositeOperation = 'lighter';
  x.shadowColor = 'rgba(198,255,0,0.85)'; x.shadowBlur = 46;
  put(0.4, 0, 0);
  x.restore();
  // 文字本体，只画一次
  put(1, 0, 0);
  // 色差
  const ca = 1.1 + 5.5 * exp;
  x.save(); x.globalCompositeOperation = 'lighter';
  put(0.16, -ca, 0); put(0.16, ca, 0);
  x.restore();
  // 双色调（冷蓝穿插）
  if (POST.duotone) {
    x.save();
    x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'color'; x.fillStyle = '#1838ff'; x.fillRect(0, 0, W, H);
    x.restore();
  }
  // 切片 / 行带拉伸（此时 C 已含文字，所以文字一起被打碎）
  if (POST.strips || POST.slices) {
    snp.clearRect(0, 0, W, H); snp.drawImage(C, 0, 0);
    if (POST.strips) for (const s of POST.strips) {
      x.fillStyle = CFG.bg; x.fillRect(0, s.y, W, s.h);
      x.drawImage(SNAP, s.x, s.y, 2, s.h, s.x, s.y, s.len, s.h);
      x.strokeStyle = 'rgba(198,255,0,0.18)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, s.y); x.lineTo(W, s.y); x.stroke();
    }
    if (POST.slices) for (const s of POST.slices) {
      x.drawImage(SNAP, 0, s.y, W, s.h, s.dx, s.y, W, s.h);
    }
  }
  // 扫描线
  if (POST.scan > 0) {
    x.save(); x.globalAlpha = POST.scan; x.fillStyle = '#000';
    for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1.6);
    x.restore();
  }
  // 颗粒
  x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.05;
  x.drawImage(grains[Math.floor(t * FPS) % 4], 0, 0, W, H); x.restore();
  // 暗角
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.02);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.46)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // 闪白
  if (fl > 0.01) { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = fl; x.fillStyle = '#eaffb0'; x.fillRect(0, 0, W, H); x.restore(); }
}

// ---------- 分镜 ----------
const SHOTS = [
  [0, B(6), 'in'],
  [B(6), B(11), 'push'],
  [B(11), B(16), 'glitch'],
  [B(16), B(21), 'lock'],
  [B(21), DUR, 'out'],
];

function frame(t, fi) {
  cx.setTransform(1, 0, 0, 1, 0, 0);
  lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, W, H);
  resetPost();
  const sh = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [t0, t1, id] = sh, u = clamp((t - t0) / (t1 - t0)), lt = t - t0;
  let flash = 0;
  const exp = pulse(t, 6);

  layerBg(t, 1);

  if (id === 'in') {
    layerDeco(t, 0.6 + 0.4 * oC(u));
    drawMain(t, clamp(u / 0.75), 1.14 - 0.14 * oC(u));
    drawSub(t, u);
    POST.sx = POST.sy = 1 + 0.05 * (1 - oC(u));
    flash = Math.pow(pr(t, B(5.4), B(6)), 3) * 0.35;
  } else if (id === 'push') {
    // 曲速推进：背景放射线条 + 文字层整体推近 + 轻微旋转
    layerDeco(t, 1);
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = 'rgba(242,244,248,0.6)';
    for (let i = 0; i < 90; i++) {
      const a = hash(i * 3.7) * Math.PI * 2, r0 = 360 + hash(i * 7.3) * 620;
      const len = (160 + hash(i * 9.1) * 700) * (0.35 + 0.65 * Math.sin(Math.PI * u));
      cx.lineWidth = 1 + hash(i * 5.5) * 2; cx.globalAlpha = 0.05 + 0.18 * hash(i * 2.2);
      cx.beginPath(); cx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0);
      cx.lineTo(W / 2 + Math.cos(a) * (r0 + len), H / 2 + Math.sin(a) * (r0 + len)); cx.stroke();
    }
    cx.restore();
    drawMain(t, 1, 1, -26 * ioC(u));
    drawSub(t, 1);
    const z = 1 + 0.34 * ioC(u);
    POST.sx = POST.sy = z; POST.rot = lt * 0.006;
    if (u > 0.18 && u < 0.72) {
      POST.slices = [];
      for (let i = 0; i < 6; i++) {
        const y = i * H / 6, hh = H / 6;
        POST.slices.push({ y, h: hh, dx: Math.sin(i * 1.7 + t * 3) * 30 * Math.sin(Math.PI * u) * (i % 2 ? 1 : -1) });
      }
    }
    flash = dec(t, B(6), 9) * 0.5;
  } else if (id === 'glitch') {
    layerDeco(t, 0.8);
    drawMain(t, 1, 0.86 + 0.14 * oC(u), 0);
    drawSub(t, 1);
    POST.strips = [];
    for (let i = 0; i < 7; i++) {
      if (hash(i * 3.3 + Math.floor(t / BP)) < 0.22) continue;
      POST.strips.push({
        y: Math.floor(hash(i * 7.1 + Math.floor(t / BP)) * H),
        h: 2 + Math.floor(hash(i * 9.7) * 22),
        x: Math.floor(hash(i * 13.3 + Math.floor(t / BP)) * (W - 200)),
        len: 60 + hash(i * 17.9) * 320,
      });
    }
    const sl = Math.floor(hash(Math.floor(t / BP)) * 7);
    POST.slices = [];
    if (sl % 3 === 0) POST.slices.push({ y: 300 + sl * 40, h: 26, dx: 70 - sl * 20 });
    POST.scan = 0.13;
    const cyc = (lt % (BP * 2)) / (BP * 2);
    if (cyc < 0.26) POST.duotone = true;
    flash = dec(t, B(11), 10) * 0.55;
  } else if (id === 'lock') {
    layerDeco(t, 1);
    // 方块拼贴洗牌 → 归位（作用于背景，文字在归位瞬间落下）
    const cell = 96, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    snp.clearRect(0, 0, W, H); snp.drawImage(C, 0, 0);
    cx.save(); cx.fillStyle = CFG.bg; cx.fillRect(0, 0, W, H);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const k = i * rows + j, d = hash(k * 1.37);
      const e = oC(clamp((u - d * 0.15) / 0.34));
      const ox = (1 - e) * (hash(k * 2.1) - 0.5) * 900;
      const oy = (1 - e) * (hash(k * 5.3) - 0.5) * 520;
      cx.drawImage(SNAP, i * cell, j * cell, cell, cell, i * cell + ox, j * cell + oy, cell, cell);
    }
    cx.restore();
    drawMain(t, 1, 1, 0);
    drawSub(t, 1);
    const stamp = lerp(1.14, 1, oC(clamp(u / 0.42)));
    POST.sx = POST.sy = stamp;
    flash = dec(t, B(16), 8) * 0.55;
  } else {
    // 收尾：文字压成细线 → 淡出
    layerDeco(t, 1 - u * 0.7);
    drawMain(t, 1, 1, 0);
    if (u < 0.5) drawSub(t, 1);
    POST.sx = lerp(1, 0.002, oC(clamp((u - 0.45) / 0.4)));
    POST.dy = -u * 40;
    cx.save(); cx.globalAlpha = pr(t, B(23), DUR) * 0.95; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.restore();
  }

  layerFg(t);
  post(t, flash, exp);
}

// ---------- 入口 ----------
const mode = process.argv[2] || 'video';
// 输出目录可能不存在（新克隆的仓库没有 out/），统一兜底创建
const ensureOut = (p) => { if (p) fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true }); };
if (mode === 'sheet') {
  const times = process.argv[3].split(',').map(Number), cols = 4, tw = 480, th = 270;
  const sheet = createCanvas(tw * cols, th * Math.ceil(times.length / cols)), shx = sheet.getContext('2d');
  shx.fillStyle = '#000'; shx.fillRect(0, 0, sheet.width, sheet.height);
  times.forEach((tt, i) => {
    frame(tt, Math.round(tt * FPS));
    shx.drawImage(C, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    shx.fillStyle = '#c6ff00'; shx.font = `14px "${MONO}"`;
    shx.fillText(tt.toFixed(2) + 's', (i % cols) * tw + 8, Math.floor(i / cols) * th + 20);
  });
  ensureOut(process.argv[4]);
  fs.writeFileSync(process.argv[4], sheet.toBuffer('image/jpeg', 90));
  console.log('sheet ->', process.argv[4]);
} else if (mode === 'still') {
  frame(Number(process.argv[3]), 1);
  ensureOut(process.argv[4]);
  fs.writeFileSync(process.argv[4], C.toBuffer('image/jpeg', 94));
  console.log('still ->', process.argv[4]);
} else {
  const fps = Number(process.argv[3] || FPS), out = process.argv[4], N = Math.ceil(DUR * fps);
  ensureOut(process.argv[4]);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => {
    const t0 = Date.now();
    for (let fi = 0; fi < N; fi++) {
      frame(fi / fps, fi);
      if (!ff.stdin.write(C.data())) await new Promise(r => ff.stdin.once('drain', r));
      if (fi % 120 === 0) console.log(`frame ${fi}/${N}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end();
    ff.on('close', () => console.log('done ->', out, ((Date.now() - t0) / 1000).toFixed(1) + 's'));
  })();
}
