// SIGNAL — 20 秒全程序化生成片（Canvas 2D 逐帧全重绘，零素材、零 DOM）
// 五个镜头：数据流锁定 → 三层波形解析 → 1100 点云旋转 → 透视地网 + 线框立方 → 快门收尾
// 用法：node signal20.js still 6.2 out.jpg
//       node signal20.js sheet 1,4,7,10,13,16,18.5 out.jpg
//       node signal20.js video 60 out.mp4
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ---------------- 可改区 ----------------
const CFG = {
  title: 'SIGNAL',
  sub: 'A GENERATIVE STUDY',
  cn: '全程由数学生成 · 无任何素材',
  hud: 'CANVAS 2D // PROCEDURAL',
  bpm: 120,
  dur: 20,
  bg: '#04070c',
  ink: '#eaf6ff',
  accent: '#5fe3ff',
  warm: '#ff8a4c',
};
// ----------------------------------------

const W = 1920, H = 1080, FPS = 60;
const BP = 60 / CFG.bpm, DUR = CFG.dur;
const B = n => n * BP;

// ---------- 字体 ----------
const FD = path.join(__dirname, '..', 'assets', 'fonts');
if (fs.existsSync(FD)) for (const f of fs.readdirSync(FD)) GlobalFonts.registerFromPath(path.join(FD, f));
for (const cjk of ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/msyhbd.ttc',
  '/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']) {
  if (fs.existsSync(cjk)) { GlobalFonts.registerFromPath(cjk, 'Noto Sans SC'); break; }
}
const BIG = 'Unbounded', MONO = 'Space Mono', CN = 'Noto Sans SC';

// ---------- 数学 ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const pr = (t, a, b) => clamp((t - a) / (b - a));
const oC = u => 1 - Math.pow(1 - u, 3);
const ioC = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const dec = (t, a, k = 7) => (t < a ? 0 : Math.exp(-(t - a) * k));
const pulse = (t, k = 7) => { const i = Math.floor(t / BP); return i < 0 ? 0 : dec(t, B(i), k); };
const frac = v => v - Math.floor(v);

// ---------- 画布 ----------
const C = createCanvas(W, H), cx = C.getContext('2d');
const TXT = createCanvas(W, H), tx = TXT.getContext('2d');   // 文字层，单独做变换与色差
const SHOT = createCanvas(W, H), sx2 = SHOT.getContext('2d');  // 故障快照
const grains = [];
for (let i = 0; i < 4; i++) {
  const c = createCanvas(480, 270), x = c.getContext('2d'), d = x.createImageData(480, 270);
  for (let k = 0; k < d.data.length; k += 4) { const v = 128 + (Math.random() - 0.5) * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
  x.putImageData(d, 0, 0); grains.push(c);
}

const POST = { sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, chroma: 0, alpha: 1, shutter: 0, fade: 0 };

// ============ 基础层 ============
function bgBase(t, dim = 1) {
  cx.fillStyle = CFG.bg; cx.fillRect(0, 0, W, H);
  const g = cx.createRadialGradient(W * 0.5 + Math.sin(t * 0.35) * 90, H * 0.55, 0, W * 0.5, H * 0.55, W * 0.62);
  g.addColorStop(0, `rgba(13,44,58,${0.9 * dim})`);
  g.addColorStop(0.45, `rgba(7,17,27,${0.82 * dim})`);
  g.addColorStop(1, 'rgba(4,7,12,0)');
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
}

function dotGrid(t, alpha = 0.15) {
  cx.save();
  const gap = 64, off = (t * 7) % gap;
  for (let y = -gap; y < H + gap; y += gap) {
    for (let x = -gap; x < W + gap; x += gap) {
      const d = Math.hypot(x - W / 2, y - H / 2);
      const a = alpha * clamp(1 - d / (W * 0.66)) ** 1.4;
      if (a < 0.004) continue;
      cx.fillStyle = `rgba(120,200,230,${a})`;
      cx.fillRect(x + off, y, 2, 2);
    }
  }
  cx.restore();
}

const HEX = '0123456789ABCDEF';
function dataRain(t, density = 1) {
  if (density <= 0.02) return;
  cx.save(); cx.font = `15px "${MONO}"`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const cols = 40, gap = W / cols;
  for (let i = 0; i < cols; i++) {
    const x = i * gap + gap / 2;
    const speed = 40 + hash(i * 7.7) * 95;
    const head = ((t * speed + hash(i * 3.1) * H * 1.6) % (H + 420)) - 210;
    for (let k = 0; k < 10; k++) {
      const y = head - k * 22;
      if (y < -20 || y > H + 20) continue;
      const a = (1 - k / 10) ** 2 * 0.42 * density;
      cx.fillStyle = k === 0 ? `rgba(190,245,255,${a * 1.6})` : `rgba(95,227,255,${a})`;
      const ch = HEX[Math.floor(hash(i * 13.3 + k * 2.7 + Math.floor(t * 8)) * 16)];
      cx.fillText(ch, x, y);
    }
  }
  cx.restore();
}

// ============ 波形 ============
function waveShape(t, y0, amp, mul, alpha, color, lw, x0 = 0, x1 = W) {
  cx.save();
  cx.strokeStyle = color; cx.lineWidth = lw; cx.globalAlpha = alpha; cx.lineJoin = 'round';
  cx.beginPath();
  for (let i = 0; i <= 520; i++) {
    const p = i / 520, x = x0 + p * (x1 - x0);
    const env = Math.pow(Math.sin(Math.PI * p), 1.05);
    const v = Math.sin(p * Math.PI * 2.2 * mul + t * 5.4) * 0.55
      + Math.sin(p * Math.PI * 6.1 * mul - t * 8.7) * 0.28
      + Math.sin(p * Math.PI * 17.3 * mul + t * 12.6) * 0.16;
    const y = y0 + v * amp * env;
    i ? cx.lineTo(x, y) : cx.moveTo(x, y);
  }
  cx.stroke();
  cx.restore();
}

function spectrum(t, yBase, beat, alpha, maxH = 190) {
  const n = 38, w = W / n;
  cx.save();
  for (let i = 0; i < n; i++) {
    const s = Math.abs(Math.sin(i * 0.41 + t * 3.1)) * 0.55 + Math.abs(Math.sin(i * 1.73 - t * 1.29)) * 0.45;
    const h = (14 + s * maxH) * (0.58 + 0.42 * beat);
    const x = i * w + w * 0.26, bw = w * 0.44;
    const g = cx.createLinearGradient(0, yBase - h, 0, yBase);
    g.addColorStop(0, `rgba(190,250,255,${alpha})`);
    g.addColorStop(0.5, `rgba(95,227,255,${alpha * 0.5})`);
    g.addColorStop(1, `rgba(95,227,255,${alpha * 0.62})`);
    cx.fillStyle = g;
    cx.fillRect(x, yBase - h, bw, h);
    cx.fillStyle = `rgba(220,252,255,${Math.min(1, alpha * 1.2)})`;
    cx.fillRect(x, yBase - h - 2, bw, 2);
  }
  cx.strokeStyle = `rgba(150,205,230,${alpha * 0.5})`; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(0, yBase + 0.5); cx.lineTo(W, yBase + 0.5); cx.stroke();
  cx.restore();
}

// ============ 点云 ============
const CLOUD = [];
for (let i = 0; i < 1100; i++) {
  const a = hash(i * 1.73), b = hash(i * 3.31);
  const th = Math.acos(2 * a - 1), ph = b * Math.PI * 2;
  CLOUD.push([Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), hash(i * 5.9)]);
}
function pointCloud(t, cx0, cy0, R, rotY, rotX, alpha) {
  const cy = Math.cos(rotY), sy = Math.sin(rotY), cxx = Math.cos(rotX), sxx = Math.sin(rotX);
  const out = [];
  for (const [x, y, z, r] of CLOUD) {
    let X = x * cy + z * sy, Z = -x * sy + z * cy;
    const Y = y * cxx - Z * sxx;
    Z = y * sxx + Z * cxx;
    const persp = (R * 3.0) / (R * 3.0 + Z * R);
    out.push([cx0 + X * R * persp, cy0 + Y * R * persp, Z, persp, r, Y]);
  }
  out.sort((p, q) => q[2] - p[2]);
  cx.save();
  for (const [px, py, , persp, r, Y] of out) {
    const a = clamp((0.08 + 0.92 * Math.pow(persp, 2.6)) * alpha);
    if (a < 0.01) continue;
    const sz = clamp(0.8 + 3.0 * Math.pow(persp, 1.6), 0.7, 4.2);
    const warm = clamp((Y + 1) / 2);
    const cr = Math.round(lerp(95, 255, warm * 0.85));
    const cg = Math.round(lerp(227, 168, warm * 0.55));
    const cb = Math.round(lerp(255, 120, warm * 0.75));
    cx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
    cx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
    if (persp > 1.25 && r > 0.86) { cx.globalAlpha = a * 0.35; cx.fillRect(px - sz, py - sz, sz * 2, sz * 2); cx.globalAlpha = 1; }
  }
  cx.restore();
}

function ring(x, y, r, alpha, color, lw = 1.2, dash = null) {
  cx.save();
  cx.strokeStyle = color; cx.globalAlpha = alpha; cx.lineWidth = lw;
  if (dash) cx.setLineDash(dash);
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.stroke();
  cx.restore();
}

// ============ 透视地网 ============
function groundGrid(t, horizonY, vpx, alpha, drift) {
  cx.save();
  cx.strokeStyle = 'rgb(95,227,255)';
  cx.lineWidth = 1.1;
  const N = 20;
  for (let i = 0; i < N; i++) {
    const z = frac(i / N + drift);
    if (z < 0.02) continue;
    const y = horizonY + (H + 120 - horizonY) * Math.pow(z, 2.3);
    if (y > H + 130) continue;
    cx.globalAlpha = alpha * clamp(z * 2.4) * 0.9;
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke();
  }
  cx.globalAlpha = alpha * 1.7;
  for (let i = -9; i <= 9; i++) {
    const xb = vpx + i * 210;
    cx.beginPath(); cx.moveTo(vpx, horizonY); cx.lineTo(xb, H + 140); cx.stroke();
  }
  cx.restore();
}

function cube(px, py, size, rotY, rotX, alpha, color) {
  const V = [];
  for (let i = 0; i < 8; i++) {
    const x = (i & 1 ? 1 : -1) * size, y = (i & 2 ? 1 : -1) * size, z = (i & 4 ? 1 : -1) * size;
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cxx = Math.cos(rotX), sxx = Math.sin(rotX);
    let X = x * cy + z * sy, Z = -x * sy + z * cy;
    const Y = y * cxx - Z * sxx;
    Z = y * sxx + Z * cxx;
    const persp = (size * 6) / (size * 6 + Z);
    V.push([px + X * persp, py + Y * persp, Z]);
  }
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  cx.save(); cx.strokeStyle = color; cx.lineWidth = 1.6;
  for (const [a, b] of E) {
    const d = ((V[a][2] + V[b][2]) / 2 + size) / (size * 2);
    cx.globalAlpha = alpha * clamp(0.2 + (1 - d) * 1.1);
    cx.beginPath(); cx.moveTo(V[a][0], V[a][1]); cx.lineTo(V[b][0], V[b][1]); cx.stroke();
  }
  for (const [x, y] of V) {
    cx.globalAlpha = alpha * 0.9; cx.fillStyle = '#cfeeff';
    cx.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
  }
  cx.restore();
}

// ============ 文字 ============
function bigTitle(str, size, y, track, each) {
  tx.save(); tx.font = `${size}px "${BIG}"`; tx.textBaseline = 'alphabetic';
  const ws = [...str].map(c => tx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + track * (str.length - 1);
  let x = W / 2 - total / 2;
  for (let i = 0; i < str.length; i++) {
    const e = each ? each(i, str.length) : { a: 1, dy: 0 };
    const a = e.a ?? 1;
    if (a > 0.005) {
      tx.save();
      tx.translate(x + ws[i] / 2, y); tx.scale(e.sx ?? 1, 1); tx.translate(-(x + ws[i] / 2), -y);
      tx.globalAlpha = a;
      tx.fillStyle = e.color || CFG.ink;
      tx.fillText(str[i], x, y + (e.dy || 0));
      tx.restore();
    }
    x += ws[i] + track;
  }
  tx.restore();
}

function trackText(str, size, y, gap, alpha, font = CN, color = CFG.ink) {
  tx.save(); tx.font = `${size}px "${font}"`; tx.textBaseline = 'alphabetic';
  const ws = [...str].map(c => tx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1);
  let x = W / 2 - total / 2;
  tx.globalAlpha = alpha; tx.fillStyle = color;
  for (let i = 0; i < ws.length; i++) { tx.fillText(str[i], x, y); x += ws[i] + gap; }
  tx.restore();
}

function composite() {
  const { sx, sy, rot, dx, dy, chroma, alpha } = POST;
  cx.save();
  cx.translate(W / 2 + dx, H / 2 + dy); cx.rotate(rot); cx.scale(sx, sy); cx.translate(-W / 2, -H / 2);
  if (chroma > 0.6) {
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = alpha * 0.32;
    cx.drawImage(TXT, -chroma, 0); cx.drawImage(TXT, chroma, 0);
    cx.restore();
  }
  cx.globalAlpha = alpha; cx.drawImage(TXT, 0, 0);
  cx.restore();
}

// ============ HUD ============
function hud(x, y, str, o = {}) {
  const { size = 20, color = 'rgba(150,205,230,0.72)', align = 'left', font = MONO, base = 'middle' } = o;
  cx.save(); cx.font = `${size}px "${font}"`; cx.fillStyle = color;
  cx.textAlign = align; cx.textBaseline = base;
  cx.fillText(str, x, y); cx.restore();
}

function corners(a) {
  cx.save(); cx.strokeStyle = `rgba(95,227,255,${a})`; cx.lineWidth = 1.6;
  const m = 56, L = 44;
  const P = [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]];
  for (const [x, y, dx, dy] of P) {
    cx.beginPath(); cx.moveTo(x + dx * L, y); cx.lineTo(x, y); cx.lineTo(x, y + dy * L); cx.stroke();
  }
  cx.restore();
}

function chapter(no, total, label, a) {
  hud(72, 118, `${no} / ${total}`, { size: 19, color: `rgba(190,245,255,${0.9 * a})` });
  hud(72, 148, label, { size: 15, color: `rgba(150,205,230,${0.6 * a})` });
}

function timecode(t, a) {
  const s = Math.floor(t), f = Math.floor((t - s) * FPS);
  hud(W - 72, 118, `T+${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`, { size: 19, color: `rgba(190,245,255,${0.85 * a})`, align: 'right' });
  hud(W - 72, 148, CFG.hud, { size: 14, color: `rgba(150,205,230,${0.5 * a})`, align: 'right' });
}

// ============ 后期 ============
function post(t, flash) {
  cx.save(); cx.globalCompositeOperation = 'overlay'; cx.globalAlpha = 0.075;
  cx.drawImage(grains[Math.floor(t * FPS) % 4], 0, 0, W, H); cx.restore();

  cx.save(); cx.globalAlpha = 0.10; cx.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) cx.fillRect(0, y, W, 1.4);
  cx.restore();

  const vg = cx.createRadialGradient(W / 2, H / 2, H * 0.38, W / 2, H / 2, H * 1.06);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.46)');
  cx.fillStyle = vg; cx.fillRect(0, 0, W, H);

  if (flash > 0.01) {
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = flash;
    cx.fillStyle = '#bfefff'; cx.fillRect(0, 0, W, H); cx.restore();
  }

  // 快门：上下黑条合拢
  if (POST.shutter > 0.001) {
    const barH = Math.min(H, POST.shutter * (H / 2 + 2));
    cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, Math.round(barH));
    cx.fillRect(0, H - Math.round(barH), W, Math.round(barH));
  }
  if (POST.fade > 0.001) {
    cx.save(); cx.globalAlpha = POST.fade; cx.fillStyle = '#000';
    cx.fillRect(0, 0, W, H); cx.restore();
  }
}

// ============ 镜头表 ============
const SHOTS = [
  [0, 4, 'boot'],
  [4, 8.5, 'wave'],
  [8.5, 13, 'cloud'],
  [13, 17, 'grid'],
  [17, DUR, 'lock'],
];

function frame(t, fi) {
  POST.sx = 1; POST.sy = 1; POST.rot = 0; POST.dx = 0; POST.dy = 0; POST.chroma = 0; POST.alpha = 1;
  POST.shutter = 0; POST.fade = 0;
  tx.clearRect(0, 0, W, H);
  let flash = 0;

  const shot = SHOTS.find(s => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
  const [s0, s1, id] = shot;
  const lt = t - s0, u = clamp(lt / (s1 - s0));
  const beat = pulse(t, 8);

  if (id === 'boot') {
    // ---- 01 数据流锁定 ----
    bgBase(t); dotGrid(t, 0.13); dataRain(t, 1 - u * 0.55);
    const sy = lerp(-140, H + 140, oC(clamp(u / 0.85)));
    const bg2 = cx.createLinearGradient(0, sy - 150, 0, sy + 30);
    bg2.addColorStop(0, 'rgba(95,227,255,0)');
    bg2.addColorStop(0.75, `rgba(95,227,255,${0.09 * (1 - u * 0.4)})`);
    bg2.addColorStop(1, 'rgba(95,227,255,0)');
    cx.fillStyle = bg2; cx.fillRect(0, sy - 150, W, 190);

    bigTitle(CFG.title, 206, H / 2 + 62, 30, (i) => {
      const st = B(1) + i * 0.062;
      return { a: pr(t, st, st + 0.42), dy: (1 - oC(pr(t, st, st + 0.72))) * 168 };
    });
    trackText(CFG.sub, 26, H / 2 + 128, 12, pr(t, B(4), B(4) + 0.6) * 0.95, MONO);
    trackText(CFG.cn, 30, H / 2 + 196, 9, pr(t, B(5), B(5) + 0.7) * 0.6, CN);

    corners(0.5 * (1 - u * 0.5));
    chapter('01', '05', 'ACQUIRE', 1);
    timecode(t, 1);
    hud(W / 2, 940, `FRAME ${String(fi).padStart(4, '0')} / 1200`, { align: 'center', size: 15, color: 'rgba(150,205,230,0.45)' });
    // 底部刻度
    cx.save(); cx.strokeStyle = 'rgba(95,227,255,0.35)'; cx.lineWidth = 1;
    for (let i = 0; i <= 40; i++) {
      const x = 200 + i * (W - 400) / 40, hh = i % 5 === 0 ? 16 : 7;
      cx.globalAlpha = 0.5; cx.beginPath(); cx.moveTo(x, 800); cx.lineTo(x, 800 - hh); cx.stroke();
    }
    cx.restore();

    POST.chroma = 5 * beat + 0.9;
    flash = dec(t, B(5), 14) * 0.2;

  } else if (id === 'wave') {
    // ---- 02 三层波形解析 ----
    bgBase(t, 0.9); dotGrid(t, 0.08);
    const amp = 196 * (0.72 + 0.45 * beat) * (0.62 + 0.38 * Math.sin(Math.PI * clamp(u * 1.25)));
    const X0 = 306, X1 = 1614, YC = 528;
    cx.save(); cx.globalCompositeOperation = 'lighter';
    waveShape(t, YC, amp, 1, 0.34, 'rgba(95,227,255,1)', 1.5, X0, X1);
    waveShape(t, YC, amp * 0.62, 2.3, 0.62, 'rgba(160,242,255,1)', 2.0, X0, X1);
    waveShape(t, YC, amp * 0.3, 5.1, 0.3, 'rgba(255,138,76,1)', 1.3, X0, X1);
    cx.restore();
    // 中心轴线
    cx.save(); cx.strokeStyle = 'rgba(150,205,230,0.22)'; cx.lineWidth = 1;
    cx.setLineDash([6, 10]); cx.beginPath(); cx.moveTo(X0 - 40, YC); cx.lineTo(X1 + 40, YC); cx.stroke(); cx.restore();
    spectrum(t, 1012, beat, 0.42, 132);
    hud(96, 1042, 'SPECTRUM // 0—24 kHz', { size: 14, color: 'rgba(150,205,230,0.42)' });
    hud(W - 96, 1042, '38 BINS / LOG', { size: 14, color: 'rgba(150,205,230,0.42)', align: 'right' });

    bigTitle(CFG.title, 56, 176, 12, () => ({ a: 0.85 }));
    hud(W / 2, 216, 'WAVE / SPECTRAL ANALYSIS', { align: 'center', size: 15, color: 'rgba(150,205,230,0.5)' });
    trackText('信 号 解 析', 34, 800, 10, 0.6, CN);

    // 左右读数
    const rows = [['FREQ', (18.4 + Math.sin(t) * 0.9).toFixed(2) + ' kHz'], ['AMP', (28 + beat * 9).toFixed(1) + ' dB'], ['PHASE', ((t * 91) % 360).toFixed(1) + '°']];
    rows.forEach((r, i) => {
      hud(96, 358 + i * 96, r[0], { size: 15, color: 'rgba(150,205,230,0.5)' });
      hud(96, 396 + i * 96, r[1], { size: 28, color: 'rgba(220,250,255,0.9)' });
    });
    const rows2 = [['SAMPLE', '48.0 kHz'], ['CH', '02 / STEREO'], ['WINDOW', 'HANN']];
    rows2.forEach((r, i) => {
      hud(W - 96, 358 + i * 96, r[0], { size: 15, color: 'rgba(150,205,230,0.5)', align: 'right' });
      hud(W - 96, 396 + i * 96, r[1], { size: 26, color: 'rgba(220,250,255,0.85)', align: 'right' });
    });
    chapter('02', '05', 'ANALYSE', 1);
    timecode(t, 1);
    POST.chroma = 1.2 + 4.2 * beat;
    flash = dec(t, B(8), 14) * 0.18;

  } else if (id === 'cloud') {
    // ---- 03 点云旋转 ----
    bgBase(t, 1); dotGrid(t, 0.07);
    ring(W / 2, 636, 306 + 34 * beat, 0.13, 'rgba(95,227,255,1)', 1);
    ring(W / 2, 636, 384, 0.08, 'rgba(95,227,255,1)', 1, [4, 12]);
    pointCloud(t, W / 2, 636, 304, lt * 0.52 + 0.6, 0.42 + Math.sin(t * 0.5) * 0.12, 1.45);

    hud(126, 330, '03', { size: 240, color: 'rgba(234,246,255,0.065)', font: BIG, align: 'left' });
    hud(W / 2, 232, 'POINT CLOUD / 1,100 VERTICES', { align: 'center', size: 15, color: 'rgba(150,205,230,0.5)' });
    trackText('三 维 重 构', 34, 1006, 10, 0.62, CN);

    hud(96, 380, 'VERTICES', { size: 16, color: 'rgba(150,205,230,0.5)' });
    hud(96, 412, '1100', { size: 34, color: 'rgba(220,250,255,0.9)' });
    hud(96, 482, 'ROT Y', { size: 16, color: 'rgba(150,205,230,0.5)' });
    hud(96, 514, ((lt * 0.52 * 180 / Math.PI) % 360).toFixed(1) + '°', { size: 30, color: 'rgba(220,250,255,0.9)' });
    hud(W - 96, 380, 'FACES', { size: 16, color: 'rgba(150,205,230,0.5)', align: 'right' });
    hud(W - 96, 412, '—  (POINTS)', { size: 26, color: 'rgba(220,250,255,0.85)', align: 'right' });
    hud(W - 96, 482, 'DEPTH SORT', { size: 16, color: 'rgba(150,205,230,0.5)', align: 'right' });
    hud(W - 96, 514, 'ON / 60FPS', { size: 26, color: 'rgba(220,250,255,0.85)', align: 'right' });
    chapter('03', '05', 'RECONSTRUCT', 1);
    timecode(t, 1);
    POST.chroma = 1.0 + 3.6 * beat;
    flash = dec(t, B(17), 14) * 0.18;

  } else if (id === 'grid') {
    // ---- 04 透视地网 + 线框立方 ----
    bgBase(t, 1);
    groundGrid(t, 556, W / 2, 0.125, frac(t * 0.28));
    cx.save(); cx.globalAlpha = 0.16; cx.strokeStyle = 'rgba(95,227,255,1)';
    cx.beginPath(); cx.moveTo(0, 560); cx.lineTo(W, 560); cx.stroke(); cx.restore();
    cube(1642, 668, 74, t * 0.9, 0.5 + Math.sin(t * 0.7) * 0.2, 0.9, 'rgba(140,240,255,1)');
    cube(268, 806, 50, -t * 0.7, 0.62, 0.5, 'rgba(255,138,76,1)');

    bigTitle(CFG.title, 176, 622, 24, () => ({ a: 1 }));
    trackText('从信号到空间', 32, 708, 9, 0.66, CN);
    hud(W / 2, 406, 'SECTION 04 — SPATIAL MAPPING', { align: 'center', size: 17, color: 'rgba(150,205,230,0.6)' });

    hud(96, 930, `X  ${(Math.sin(t * 0.9) * 12).toFixed(2)}`, { size: 18, color: 'rgba(150,205,230,0.55)' });
    hud(96, 962, `Y  ${(Math.cos(t * 0.7) * 8).toFixed(2)}`, { size: 18, color: 'rgba(150,205,230,0.55)' });
    hud(96, 994, `Z  ${(t * 3.14).toFixed(2)}`, { size: 18, color: 'rgba(150,205,230,0.55)' });
    hud(W - 96, 930, 'PERSPECTIVE  1.6', { size: 16, color: 'rgba(150,205,230,0.5)', align: 'right' });
    hud(W - 96, 962, 'FOCAL  760 mm', { size: 16, color: 'rgba(150,205,230,0.5)', align: 'right' });
    chapter('04', '05', 'MAPPING', 1);
    timecode(t, 1);
    // 入场推近
    const z = lerp(1.16, 1, oC(clamp(u / 0.45)));
    POST.sx = POST.sy = z;
    POST.chroma = 1.6 + 4.6 * beat;
    flash = dec(t, B(26), 13) * 0.3;

  } else {
    // ---- 05 快门收尾 ----
    bgBase(t, 1 - u * 0.3); dotGrid(t, 0.1 * (1 - u));
    for (let i = 0; i < 3; i++) {
      const k = clamp((lt - i * 0.18) / 0.9);
      if (k <= 0 || k >= 1) continue;
      ring(W / 2, 520, 160 + oC(k) * 780, (1 - k) * 0.35, 'rgba(95,227,255,1)', 2 * (1 - k) + 0.5);
    }
    bigTitle(CFG.title, 236, 604, 34, (i) => ({ a: 1 }));
    hud(W / 2, 452, 'TRANSMISSION COMPLETE', { align: 'center', size: 20, color: 'rgba(150,205,230,0.6)' });
    trackText(CFG.cn, 26, 700, 8, 0.45 * (1 - pr(lt, 1.6, 2.4)), CN);
    hud(W / 2, 880, 'SIGNAL — 20.00s — 1200 FRAMES — 60FPS', { align: 'center', size: 16, color: 'rgba(150,205,230,0.45)' });
    chapter('05', '05', 'COMPLETE', 1);
    timecode(t, 1);

    // 快门：上下黑条合拢，最后全黑（在 post 里画，否则会被文字合成盖住）
    POST.shutter = ioC(clamp((lt - 1.62) / 1.06));
    POST.fade = pr(lt, 2.7, 2.96);

    POST.chroma = 2 + 4.2 * beat;
    POST.alpha = 1;
    flash = dec(t, B(34), 13) * 0.3;
  }

  composite();
  post(t, flash);
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
    shx.fillStyle = '#5fe3ff'; shx.font = `14px "${MONO}"`;
    shx.fillText(tt.toFixed(2) + 's', (i % cols) * tw + 8, Math.floor(i / cols) * th + 20);
  });
  ensureOut(process.argv[4]);
  fs.writeFileSync(process.argv[4], sheet.toBuffer('image/jpeg', 90));
  console.log('sheet ->', process.argv[4]);
} else if (mode === 'still') {
  frame(Number(process.argv[3]), Math.round(Number(process.argv[3]) * FPS));
  ensureOut(process.argv[4]);
  fs.writeFileSync(process.argv[4], C.toBuffer('image/jpeg', 94));
  console.log('still ->', process.argv[4]);
} else {
  const fps = Number(process.argv[3] || FPS), out = process.argv[4], N = Math.ceil(DUR * fps);
  ensureOut(process.argv[4]);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  (async () => {
    const t0 = Date.now();
    for (let fi = 0; fi < N; fi++) {
      frame(fi / fps, fi);
      if (!ff.stdin.write(C.data())) await new Promise(r => ff.stdin.once('drain', r));
      if (fi % 200 === 0) console.log(`frame ${fi}/${N}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
    ff.stdin.end();
    ff.on('close', () => console.log('done ->', out, ((Date.now() - t0) / 1000).toFixed(1) + 's'));
  })();
}
