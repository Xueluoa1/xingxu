// 星叙主进程：桌面插件层、任务栏挂件、控制中心、托盘与系统数据
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell, globalShortcut, dialog, net, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const VERSION = require('./package.json').version;
app.setName('星叙');
app.setAppUserModelId('online.xueluo.xingxu');
// 调试时可用 XX_UD 指定独立的数据目录，与正在运行的正式版互不影响
app.setPath('userData', process.env.XX_DEBUG && process.env.XX_UD ? process.env.XX_UD : path.join(app.getPath('appData'), 'XingXu'));
const UD = app.getPath('userData');
const CFG = path.join(UD, 'config.json');
const IMG = path.join(UD, 'img');
const LRC = path.join(UD, 'lyrics');
const TMP = path.join(UD, 'tmp');
[UD, IMG, LRC, TMP].forEach(d => fs.mkdirSync(d, { recursive: true }));

const TaskbarColor = require('./tbcolor');
const tbc = new TaskbarColor(path.join(UD, 'taskbar-backup.txt'));
const TTB = require('./ttb');
const ttb = new TTB(path.join(__dirname, 'ttb'), path.join(UD, 'ttb-backup.json'), names => (N ? N.processPath(names) : ''));

// 卸载程序调用：还原任务栏后退出
if (process.argv.includes('--restore-taskbar')) {
  try { tbc.restoreSync(); } catch (_) {}
  try { ttb.restore(true); } catch (_) {}
  app.exit(0);
}
if (!app.requestSingleInstanceLock()) app.exit(0);

let N = null; // native，在 ready 后加载
const W = {}; // desk / deskTop / bar / cc
let S = null, tray = null;
const HIDDEN = process.argv.includes('--hidden');

/* ---------------- 状态 ---------------- */
function defState() {
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const R = Math.max(wa.width - 340, 700);
  const w = (type, x, y, ww, hh) => ({ id: uid(), type, x, y, w: ww, h: hh, vis: true, top: false, lock: false, s: { preset: null, op: 80, ac: null, bg: null, font: 'Microsoft YaHei UI', fs: 100, r: null } });
  const t = (type, zone, width) => ({ id: uid(), type, zone, width: width || 0, form: type === 'lyric' ? 'lyric' : 'icon-text', tc: '', bo: 0, font: 'Microsoft YaHei UI' });
  return {
    v: 1,
    on: { widgets: true, tb: false, tbw: true, dlyric: true, tlyric: true },
    preset: 'classic',
    widgets: [
      w('clock', R, 24, 310, 140),
      w('weather', R, 180, 310, 180),
      w('calendar', R, 376, 310, 290),
      w('music', R - 380, 24, 360, 150),
      w('sys', R - 380, 190, 360, 190),
      w('todo', R - 380, 396, 360, 250),
      Object.assign(w('launch', R, 682, 310, 96), { items: [] }),
      Object.assign(w('lyrics', R - 760, 24, 360, 300), { vis: false }),
      Object.assign(w('fps', R - 760, 340, 250, 150), { vis: false }),
      Object.assign(w('sysentry', R - 760, 506, 320, 96), { vis: false }),
    ],
    tb: { fill: 'solid', c1: '#2a1f6e', c2: '#7a3e8e', angle: 90, op: 60, style: 'classic', ac: '#6c5ce7' },
    tbOff: { l: 0, r: 0 },
    tbw: [t('weather', 'right'), t('lyric', 'right', 240), t('sys', 'right')],
    ly: { mode: 'full', fs: 15, c: null, hc: null, op: 100, top: false, align: 'left', effects: { scroll: true, fade: true, hl: true }, offset: 0 },
    clock: { h24: true, sec: true },
    sysItems: { cpu: true, mem: true, disk: true, net: true },
    todos: [{ t: '右键桌面插件，切换样式或调整大小', d: false }, { t: '把桌面快捷方式拖进快捷启动 Dock', d: false }],
    settings: { auto: true, fullpause: true, city: '深圳' },
  };
}
let _u = Date.now(); function uid() { return 'k' + (_u++).toString(36); }
// 已删除的任务栏挂件类型（音乐状态、快捷按钮）从旧配置中移除
const TBW_REMOVED = ['music', 'quick'];
// 任务栏已不支持的样式 / 填充方式，换成最接近的（TranslucentTB 在 Win11 上"模糊"与亚克力效果相同）
const TB_STYLE_MAP = { neu: 'classic', mono: 'dark' };
function migrate(o) {
  if (Array.isArray(o.tbw)) o.tbw = o.tbw.filter(w => w && !TBW_REMOVED.includes(w.type));
  if (o.tb) {
    if (o.tb.fill === 'blur') o.tb.fill = 'translucent';
    if (TB_STYLE_MAP[o.tb.style]) o.tb.style = TB_STYLE_MAP[o.tb.style];
  }
  return o;
}
function loadState() {
  try { const o = JSON.parse(fs.readFileSync(CFG, 'utf8')); if (o && o.v === 1) return migrate(o); } catch (_) {}
  return defState();
}
let saveTimer = null;
function flushState() {
  clearTimeout(saveTimer);
  if (!S) return;
  try {
    fs.writeFileSync(CFG + '.tmp', JSON.stringify(S));
    fs.renameSync(CFG + '.tmp', CFG);
  } catch (e) { console.error(e); }
}
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushState, 400);
}

function broadcast(ch, data, exceptWc) {
  for (const k in W) { const b = W[k]; if (b && !b.isDestroyed() && b.webContents !== exceptWc) b.webContents.send(ch, data); }
}
// 壁纸副本：玻璃风格插件用它绘制磨砂背景（透明窗口无法直接模糊真实桌面）
// 来源优先级：Wallpaper Engine 当前壁纸（按插件所在显示器）> 系统壁纸
let wall = { key: '', url: '' }, wallBusy = false;
const IMG_EXT = /\.(jpe?g|png|bmp|webp)$/i, VID_EXT = /\.(mp4|webm|mkv|avi|mov|wmv|gif)$/i;
// 读取 Wallpaper Engine 配置，返回插件所在显示器正在使用的壁纸文件
let weExe = '', weAt = 0;
function wallpaperEngineFile() {
  if (Date.now() - weAt > 30e3) { weAt = Date.now(); try { weExe = N.processPath(['wallpaper32.exe', 'wallpaper64.exe']); } catch (_) { weExe = ''; } }
  if (!weExe) return '';
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(path.join(path.dirname(weExe), 'config.json'), 'utf8')); } catch (_) { return ''; }
  const users = Object.keys(cfg).filter(k => cfg[k] && cfg[k].general && cfg[k].general.wallpaperconfig);
  const u = users.includes(os.userInfo().username) ? os.userInfo().username : users[0];
  const sel = u && cfg[u].general.wallpaperconfig.selectedwallpapers;
  if (!sel) return '';
  const d = deskDisplay(), c = screen.dipToScreenPoint({ x: d.bounds.x + d.bounds.width / 2, y: d.bounds.y + d.bounds.height / 2 });
  const m = N.monitorIds(c.x, c.y);
  if (!m) return '';
  const keys = [...m.ids, m.dev].map(k => k.replace(/\\/g, '/'));
  for (const k of keys) if (sel[k] && sel[k].file) return sel[k].file;
  return '';
}
// 场景 / 网页壁纸取工程里的预览图；视频与动图交给系统缩略图取一帧
function stillOf(file) {
  if (/\.(pkg|json|html?)$/i.test(file)) {
    const dir = path.dirname(file);
    let prev = '';
    try { prev = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')).preview || ''; } catch (_) {}
    for (const f of [prev, 'preview.jpg', 'preview.png', 'preview.gif']) if (f && fs.existsSync(path.join(dir, f))) return path.join(dir, f);
    return '';
  }
  return file;
}
let wallN = 0;
async function makeWallImage(src) {
  const dst = path.join(TMP, 'wall' + (++wallN % 2) + '.img');
  if (IMG_EXT.test(src)) { fs.copyFileSync(src, dst); return dst; }
  const img = await nativeImage.createThumbnailFromPath(path.normalize(src), { width: 1920, height: 1080 });
  if (img.isEmpty()) return '';
  fs.writeFileSync(dst, img.toJPEG(90));
  return dst;
}
function syncWallpaper() {
  if (wallBusy) return;
  let src = '';
  try { const we = wallpaperEngineFile(); if (we) src = stillOf(we); } catch (_) {}
  if (!src || !fs.existsSync(src)) { try { src = N.wallpaperPath(); } catch (_) {} }
  if (!src || !fs.existsSync(src)) src = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
  if (!fs.existsSync(src)) { if (wall.url) { wall = { key: '', url: '' }; broadcast('env', env()); } return; }
  const key = src + '|' + fs.statSync(src).mtimeMs;
  if (key === wall.key) return;
  if (DEBUG) console.log('[wall]', src);
  wallBusy = true;
  makeWallImage(src).then(dst => {
    if (dst) { wall = { key, url: pathToFileURL(dst).href + '?v=' + Date.now() }; broadcast('env', env()); }
    else wall.key = key; // 取不到图就不再反复尝试
  }).catch(() => { wall.key = key; }).finally(() => { wallBusy = false; });
}
/* ---------------- 显示器：桌面插件与任务栏挂件可分别放在主屏或扩展屏 ---------------- */
// 设置值为 'primary' 或显示器 id；所选显示器断开时回到主屏
function displayFor(key) {
  if (key && key !== 'primary') { const d = screen.getAllDisplays().find(x => String(x.id) === String(key)); if (d) return d; }
  return screen.getPrimaryDisplay();
}
const deskDisplay = () => displayFor(S && S.settings.deskDisp);
const barDisplay = () => displayFor(S && S.settings.tbwDisp);
function displayList() {
  const p = screen.getPrimaryDisplay().id;
  let n = 0;
  return screen.getAllDisplays().sort((a, b) => (b.id === p) - (a.id === p) || a.bounds.x - b.bounds.x)
    .map(d => ({ id: d.id === p ? 'primary' : String(d.id), primary: d.id === p, no: d.id === p ? 0 : ++n, label: d.label || '', w: Math.round(d.bounds.width * d.scaleFactor), h: Math.round(d.bounds.height * d.scaleFactor) }));
}
function env() {
  const d = deskDisplay();
  return { version: VERSION, wa: d.workArea, bounds: d.bounds, sysLight: tbc.systemLight(), wall: wall.url, tb: tbResult, displays: displayList(), deskDisp: d.id === screen.getPrimaryDisplay().id ? 'primary' : String(d.id) };
}
// 工作区变化只更新窗口，桌面层按当前可用空间显示已保存的布局。
let deskKey = '';
function placeDesk() {
  const d = deskDisplay(), wa = d.workArea, key = d.id + JSON.stringify(wa);
  if (key === deskKey) return;
  const changed = deskKey !== '';
  deskKey = key;
  for (const k of ['desk', 'deskTop']) { const b = W[k]; if (b && !b.isDestroyed()) { b.setBounds(wa); b.setBounds(wa); } }
  broadcast('env', env());
  if (W.desk && !W.desk.isDestroyed()) N.pinToDesktop(W.desk);
  if (changed) { wall.key = ''; syncWallpaper(); }
}

/* ---------------- 窗口 ---------------- */
const DEBUG = !!process.env.XX_DEBUG;
function debugLog(b, tag) {
  if (!DEBUG) return;
  b.webContents.on('console-message', e => console.log(`[${tag}] ${e.level} ${e.message} (${e.lineNumber})`));
  b.webContents.on('render-process-gone', (_e, d) => console.log(`[${tag}] gone`, d));
}
const UI = f => path.join(__dirname, 'ui', f);
function overlay(role) {
  const wa = deskDisplay().workArea;
  const b = new BrowserWindow({
    x: wa.x, y: wa.y, width: wa.width, height: wa.height, show: false, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, type: 'toolbar', alwaysOnTop: role === 'deskTop',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  b.loadFile(UI('desk.html'), { query: { role } });
  debugLog(b, role);
  b.setIgnoreMouseEvents(true, { forward: true });
  b._ignore = true; b._hit = { rects: [], capture: false };
  b.once('ready-to-show', () => {
    if (role === 'desk') { N.pinToDesktop(b); hookBottom(b); }
    else b.setAlwaysOnTop(true, 'pop-up-menu');
    b.showInactive();
  });
  if (role === 'desk') b.on('focus', () => N.pinToDesktop(b));
  return b;
}
// 桌面层窗口始终压在普通窗口之下：层级变化后（WM_WINDOWPOSCHANGED）在下一轮事件循环里放回桌面层。
// 不直接改写 WINDOWPOS 内存：主题切换时系统会大量重排窗口，在钩子里读写原生指针会导致进程崩溃
function hookBottom(b) {
  let pending = false;
  try {
    b.hookWindowMessage(0x0047, () => {
      if (pending) return;
      pending = true;
      setImmediate(() => { pending = false; if (!b.isDestroyed()) N.pinToDesktop(b); });
    });
  } catch (e) { console.error('hook', e); }
}
function makeBar() {
  const b = new BrowserWindow({
    x: 0, y: 0, width: 400, height: 48, show: false, frame: false, transparent: true, resizable: false, movable: false, minimizable: false,
    maximizable: false, fullscreenable: false, skipTaskbar: true, hasShadow: false, focusable: false, type: 'toolbar', alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  });
  b.loadFile(UI('bar.html'), { query: { role: 'bar' } });
  debugLog(b, 'bar');
  b.setIgnoreMouseEvents(true, { forward: true });
  b._ignore = true; b._hit = { rects: [], capture: false };
  b.once('ready-to-show', () => { placeBar(); b.setAlwaysOnTop(true, 'screen-saver'); b.showInactive(); });
  return b;
}
function openCC(page) {
  if (W.cc && !W.cc.isDestroyed()) {
    if (W.cc.isMinimized()) W.cc.restore();
    W.cc.show(); W.cc.focus();
    if (page) W.cc.webContents.send('relay:go', page);
    return;
  }
  const b = new BrowserWindow({
    width: 1000, height: 660, show: false, frame: false, backgroundColor: '#eceef1', resizable: false, maximizable: false, fullscreenable: false,
    title: '星叙 · 控制中心', icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  b.loadFile(UI('cc.html'), { query: { role: 'cc', page: page || '' } });
  debugLog(b, 'cc');
  b.once('ready-to-show', () => b.show());
  b.on('closed', () => { W.cc = null; });
  W.cc = b;
}

/* ---------------- 鼠标穿透：光标在插件上时接收鼠标，其余区域穿透到桌面 ---------------- */
function hitLoop() {
  const pt = screen.getCursorScreenPoint();
  for (const k of ['desk', 'deskTop', 'bar']) {
    const b = W[k]; if (!b || b.isDestroyed() || !b.isVisible()) continue;
    const bb = b.getBounds(), x = pt.x - bb.x, y = pt.y - bb.y, h = b._hit;
    const inside = x >= 0 && y >= 0 && x < bb.width && y < bb.height;
    const want = h.capture || (inside && h.rects.some(r => x >= r[0] && y >= r[1] && x < r[0] + r[2] && y < r[1] + r[3]));
    if (want === !b._ignore) continue;
    b._ignore = !want;
    if (want) b.setIgnoreMouseEvents(false); else b.setIgnoreMouseEvents(true, { forward: true });
  }
}

/* ---------------- 任务栏挂件位置 ---------------- */
let barShown = true;
// 扩展屏任务栏没有托盘区，右侧是时钟，为它留出空间（DIP）
const SECONDARY_CLOCK = 150;
const dipRect = r => screen.screenToDipRect(null, { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top });
function placeBar() {
  const b = W.bar; if (!b || b.isDestroyed()) return;
  const d = barDisplay(), db = d.bounds;
  const hide = () => { if (barShown) { b.hide(); barShown = false; } };
  if (!S.on.tbw || fullscreen.bar) return hide();
  let ti = null, bar = null;
  for (const t of N.taskbars()) {
    if (!t.bar) continue;
    const r = dipRect(t.bar), cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    if (cx >= db.x && cx < db.x + db.width && cy >= db.y && cy < db.y + db.height) { ti = t; bar = r; break; }
  }
  // 仅支持水平任务栏（底部 / 顶部）
  if (!ti || bar.width < bar.height || bar.height > 120) return hide();
  const right = ti.tray ? dipRect(ti.tray).x : bar.x + bar.width - SECONDARY_CLOCK;
  const r = { x: Math.round(bar.x), y: Math.round(bar.y), width: Math.max(100, Math.round(right - bar.x)), height: Math.round(bar.height) };
  const cur = b.getBounds();
  if (cur.x !== r.x || cur.y !== r.y || cur.width !== r.width || cur.height !== r.height) { b.setBounds(r); b.setBounds(r); }
  if (!barShown) { b.showInactive(); barShown = true; }
  N.bringTopmost(b);
}

/* ---------------- 全屏检测 ---------------- */
// 分别检测插件所在屏与挂件所在屏是否有全屏应用
const fullscreen = { desk: false, bar: false };
function isFull(d) { const sb = screen.dipToScreenRect(null, d.bounds); return !!(S.settings.fullpause && N.foregroundFullscreen({ left: sb.x, top: sb.y, right: sb.x + sb.width, bottom: sb.y + sb.height })); }
function fullLoop() {
  const fd = isFull(deskDisplay()), fb = isFull(barDisplay());
  if (fb !== fullscreen.bar) { fullscreen.bar = fb; placeBar(); }
  if (fd === fullscreen.desk) return;
  fullscreen.desk = fd;
  if (W.deskTop) fd ? W.deskTop.hide() : W.deskTop.showInactive();
  broadcast('pause', fd);
}

/* ---------------- 系统资源 ---------------- */
let lastCpu = os.cpus(), netPrev = null, netRate = { down: 0, up: 0 };
function sysLoop() {
  const c = os.cpus();
  let idle = 0, total = 0;
  c.forEach((x, i) => { const p = lastCpu[i] || x; for (const k in x.times) total += x.times[k] - p.times[k]; idle += x.times.idle - p.times.idle; });
  lastCpu = c;
  const cpu = total ? (1 - idle / total) * 100 : 0;
  const mem = (1 - os.freemem() / os.totalmem()) * 100;
  let disk = 0;
  try { const st = fs.statfsSync(process.env.SystemDrive + '\\'); disk = (1 - st.bavail / st.blocks) * 100; } catch (_) {}
  broadcast('sys', { cpu, mem, disk, down: netRate.down, up: netRate.up });
}

/* ---------------- 媒体（SMTC 助手） ---------------- */
let media = null, mediaProc = null, mediaKey = '';
function startMedia() {
  const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  mediaProc = spawn(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'media.ps1'), '-thumbDir', TMP], { windowsHide: true });
  let buf = '';
  mediaProc.stdout.setEncoding('utf8');
  mediaProc.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (l) onMediaLine(l); }
  });
  mediaProc.on('exit', () => { mediaProc = null; if (!quitting) setTimeout(startMedia, 3000); });
}
function onMediaLine(l) {
  let o; try { o = JSON.parse(l); } catch (_) { return; }
  if (o.net) {
    const now = { rx: o.net.rx, tx: o.net.tx, t: Date.now() };
    if (netPrev && now.t > netPrev.t) { const dt = (now.t - netPrev.t) / 1000; netRate = { down: Math.max(0, now.rx - netPrev.rx) / dt, up: Math.max(0, now.tx - netPrev.tx) / dt }; }
    netPrev = now;
  }
  const m = o.media;
  if (!m) { if (media) { media = null; mediaKey = ''; broadcast('media', null); } return; }
  m.thumbUrl = m.thumb ? pathToFileURL(m.thumb).href + '?t=' + encodeURIComponent(m.title + m.artist) : '';
  smoothMedia(m);
  media = m;
  broadcast('media', m);
  const key = m.title + '|' + m.artist;
  if (key !== mediaKey) { mediaKey = key; findLyrics(m); }
}

// 本地进度时钟：QQ 音乐等播放器的状态和时间轴更新滞后、有抖动，用自己的时钟平滑，只在明显跳变（拖动进度）时采用上报值
let clock = null, hint = null, tl = null;
function smoothMedia(m) {
  const now = Date.now(), key = m.title + '|' + m.artist;
  // 播放状态以时间轴为准：QQ 音乐的播放 / 暂停状态要晚约 10 秒才更新，但时间轴每秒都在走
  if (m.upd > 0) {
    if (!tl || tl.key !== key) tl = { key, pos: m.pos, upd: m.upd, adv: 0, live: false };
    else if (m.upd !== tl.upd) {
      const d = m.pos - tl.pos, dt = (m.upd - tl.upd) / 1000;
      if (d > 0.2 && d < dt + 3) { tl.adv = now; tl.live = true; }
      tl.pos = m.pos; tl.upd = m.upd;
    }
    if (tl.live) m.playing = now - tl.adv < 3000;
  }
  if (hint && (now > hint.until || hint.key !== key || m.playing === hint.playing)) hint = null;
  if (hint) m.playing = hint.playing; // 刚点了播放 / 暂停，播放器还没报上来
  const pred = clock && clock.key === key ? clock.pos + (clock.playing ? (now - clock.t) / 1000 : 0) : null;
  const fresh = m.upd > 0 && now - m.upd < 3000;
  let pos = m.pos;
  if (hint && pred != null) pos = pred;
  else if (m.playing) {
    if (pred != null && (!fresh || Math.abs(pos - pred) < 1.5)) pos = pred;
    else if (pred == null && !fresh && m.upd > 0) pos += Math.max(0, (now - m.upd) / 1000); // 不更新时间轴的播放器
  }
  if (m.dur > 0) pos = Math.min(m.dur, Math.max(0, pos));
  clock = { key, pos, playing: m.playing, t: now };
  m.pos = pos; m.at = now;
}
/* ---------------- 歌词：本地绑定 → 网易云 → LRCLIB ---------------- */
let lyr = { key: '', list: [], idx: 0 };
const lrcFile = key => path.join(LRC, Buffer.from(key).toString('base64url').slice(0, 120) + '.lrc');
// 先走 Electron 网络栈（跟随系统代理），失败再用 Node 直连
async function getJSON(url) {
  const opt = () => ({ headers: { 'User-Agent': 'Mozilla/5.0 XingXu/' + VERSION }, signal: AbortSignal.timeout(8000) });
  let r;
  try { r = await net.fetch(url, opt()); } catch (e) { if (DEBUG) console.log('net.fetch', url, e.message); r = await fetch(url, opt()); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function findLyrics(m) {
  const key = m.title + '|' + m.artist;
  lyr = { key, list: [], idx: 0 };
  sendLyrics();
  try { const t = fs.readFileSync(lrcFile(key), 'utf8'); lyr.list.push({ src: '本地绑定', lrc: t }); sendLyrics(); return; } catch (_) {}
  // 只采用歌名相近的结果，避免匹配到无关歌曲
  const norm = s => String(s || '').toLowerCase().replace(/\.(mp3|flac|wav|m4a|ogg|ape|aac|wma)$/i, '').replace(/[（(【\[].*?[)）】\]]/g, '').replace(/[\s\-_·.,，。!！?？'"]/g, '');
  const title = norm(m.title), artist = norm(m.artist);
  if (!title) { sendLyrics(); return; }
  const q = (m.title.replace(/\.(mp3|flac|wav|m4a|ogg|ape|aac|wma)$/i, '') + ' ' + (m.artist || '')).trim();
  const near = (a, b) => a && b && (a === b || (Math.min(a.length, b.length) >= 2 && (a.includes(b) || b.includes(a))));
  try {
    const r = await getJSON('https://music.163.com/api/search/get/web?type=1&limit=10&s=' + encodeURIComponent(q));
    const songs = ((r.result && r.result.songs) || [])
      .filter(s => near(norm(s.name), title))
      .map(s => ({ s, sc: artist && (s.artists || []).some(a => near(norm(a.name), artist)) ? 2 : 1 }))
      .sort((a, b) => b.sc - a.sc).map(x => x.s);
    for (const s of songs) {
      if (lyr.key !== key) return;
      try {
        const l = await getJSON('https://music.163.com/api/song/lyric?lv=1&kv=1&tv=-1&id=' + s.id);
        const t = l.lrc && l.lrc.lyric;
        if (t && /\[\d+:\d+/.test(t)) { lyr.list.push({ src: '网易云音乐 · ' + s.name + ' - ' + (s.artists || []).map(a => a.name).join('/'), lrc: t }); if (lyr.list.length === 1) sendLyrics(); }
      } catch (_) {}
      if (lyr.list.length >= 3) break;
    }
  } catch (_) {}
  if (lyr.key !== key) return;
  if (!lyr.list.length) {
    try {
      const r = await getJSON('https://lrclib.net/api/search?track_name=' + encodeURIComponent(m.title) + '&artist_name=' + encodeURIComponent(m.artist || ''));
      (r || []).filter(x => x.syncedLyrics && near(norm(x.trackName), title)).slice(0, 3).forEach(x => lyr.list.push({ src: 'LRCLIB · ' + x.trackName + ' - ' + x.artistName, lrc: x.syncedLyrics }));
    } catch (_) {}
  }
  sendLyrics();
}
function sendLyrics() {
  const c = lyr.list[lyr.idx];
  broadcast('lyrics', { key: lyr.key, lrc: c ? c.lrc : '', src: c ? c.src : '', idx: lyr.idx, total: lyr.list.length, searching: !c });
}

/* ---------------- 天气：Open-Meteo，连不上时改用 wttr.in ---------------- */
const weathers = {}; // 城市 → 天气数据
// wttr.in 天气代码 → WMO 代码（界面统一按 WMO 显示）
const WWO = { 113: 0, 116: 2, 119: 3, 122: 3, 143: 45, 248: 45, 260: 48, 176: 80, 263: 51, 266: 53, 281: 56, 284: 57, 293: 61, 296: 61, 299: 63, 302: 63, 305: 65, 308: 65,
  311: 66, 314: 67, 353: 80, 356: 81, 359: 82, 179: 71, 182: 66, 185: 66, 227: 73, 230: 75, 317: 66, 320: 71, 323: 71, 326: 71, 329: 73, 332: 73, 335: 75, 338: 75,
  350: 77, 362: 85, 365: 85, 368: 85, 371: 86, 374: 77, 377: 77, 200: 95, 386: 95, 389: 95, 392: 96, 395: 96 };
async function weatherOpenMeteo(city) {
  const g = await getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=' + encodeURIComponent(city));
  const p = g.results && g.results[0];
  if (!p) return { notFound: true };
  const f = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&timezone=auto&forecast_days=6` +
    '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min');
  return {
    city: p.name, temp: f.current.temperature_2m, code: f.current.weather_code, hum: f.current.relative_humidity_2m, wind: f.current.wind_speed_10m,
    days: f.daily.time.map((d, i) => ({ d, code: f.daily.weather_code[i], max: f.daily.temperature_2m_max[i], min: f.daily.temperature_2m_min[i] })),
  };
}
async function weatherWttr(city) {
  const f = await getJSON('https://wttr.in/' + encodeURIComponent(city) + '?format=j1&lang=zh');
  const c = f.current_condition && f.current_condition[0];
  if (!c) return { notFound: true };
  const code = n => WWO[+n] ?? 3;
  return {
    city, temp: +c.temp_C, code: code(c.weatherCode), hum: +c.humidity, wind: +c.windspeedKmph,
    days: (f.weather || []).map(d => ({ d: d.date, code: code((d.hourly && d.hourly[4] || d.hourly[0] || {}).weatherCode), max: +d.maxtempC, min: +d.mintempC })),
  };
}
// 用到的城市：默认城市 + 插件 / 挂件单独指定的城市
function weatherCities() {
  const set = new Set();
  const add = c => { c = String(c || '').trim(); if (c) set.add(c); };
  add(S.settings.city);
  S.widgets.forEach(w => { if (w.type === 'weather') add(w.city); });
  S.tbw.forEach(w => { if (w.type === 'weather') add(w.city); });
  return [...set];
}
const wxBusy = new Set();
async function fetchWeather(city, force) {
  const old = weathers[city];
  if (wxBusy.has(city) || (!force && old && old.at && Date.now() - old.at < (old.err ? 5 : 30) * 60e3)) return;
  wxBusy.add(city);
  let r = null;
  for (const src of [weatherOpenMeteo, weatherWttr]) {
    try { r = await src(city); if (r && !r.notFound) break; } catch (e) { if (DEBUG) console.log('weather', src.name, e.message); r = null; }
  }
  wxBusy.delete(city);
  if (r && !r.notFound) weathers[city] = { q: city, at: Date.now(), ...r };
  else if (r && r.notFound) weathers[city] = { q: city, at: Date.now(), city, err: '未找到城市「' + city + '」' };
  else if (!old || old.err) weathers[city] = { q: city, at: Date.now(), city, err: '天气获取失败，稍后重试' };
  else return;
  broadcast('weather', weathers[city]);
}
function weatherLoop(force) { weatherCities().forEach(c => fetchWeather(c, force)); }

/* ---------------- 任务栏着色 ---------------- */
let tbKey = '', tbTimer = null, tbResult = null;
tbc.onDone = r => { tbResult = r; broadcast('env', env()); };
const useTTB = () => ttb.available();
function syncTaskbar() {
  const k = S.on.tb ? JSON.stringify([S.tb.c1, S.tb.fill, S.tb.op, !!S.settings.tbSysTheme, S.settings.tbFullNormal !== false]) : 'off';
  if (k === tbKey) return;
  clearTimeout(tbTimer);
  tbTimer = setTimeout(() => { tbKey = k; applyTaskbar(); }, 300);
}
async function applyTaskbar() {
  if (!useTTB()) { tbc.set(S.on.tb ? S.tb : null); return; } // 无 TranslucentTB 时退回注册表方式
  try {
    if (S.on.tb) {
      tbResult = ttb.apply(S.tb, { maxNormal: S.settings.tbFullNormal !== false, sysLight: tbc.systemLight() });
      if (S.settings.tbSysTheme && tbResult.light != null) tbc.setThemeOnly(tbResult.light).catch(() => {}); // 可选：同时切系统深浅色
      else if (tbc.hasBackup()) await tbc.restore();
    } else {
      ttb.restore();
      if (tbc.hasBackup()) await tbc.restore();
      tbResult = null;
    }
    broadcast('env', env());
  } catch (e) { if (DEBUG) console.log('[ttb]', e && e.message); }
}
// 显示器变化或唤醒后，TranslucentTB 常常只剩主屏生效：等新的任务栏布局稳定后重启 TTB 重新接管全部屏幕
let healTimer = null, healing = false;
function healTaskbar() {
  if (!S.on.tb || !useTTB()) return;
  clearTimeout(healTimer);
  healTimer = setTimeout(async () => {
    if (healing || !S.on.tb) return;
    healing = true;
    try { tbResult = await ttb.reapply(S.tb, { maxNormal: S.settings.tbFullNormal !== false, sysLight: tbc.systemLight() }); broadcast('env', env()); }
    catch (e) { if (DEBUG) console.log('[ttb] heal', e && e.message); }
    healing = false;
  }, 5000);
}
// 退出时交给独立进程还原任务栏，不拖慢退出
function restoreTaskbarDetached() {
  try { ttb.restore(true); } catch (_) {} // TTB 还原很快，直接内联
  if (!tbc.hasBackup()) return;
  const args = app.isPackaged ? ['--restore-taskbar'] : [app.getAppPath(), '--restore-taskbar'];
  try { spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref(); } catch (_) {}
}

/* ---------------- 托盘与快捷键 ---------------- */
function buildTray() {
  if (!tray) {
    tray = new Tray(path.join(__dirname, 'icon.ico'));
    tray.setToolTip('星叙');
    tray.on('click', () => openCC());
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开控制中心', click: () => openCC() },
    { type: 'separator' },
    { label: '显示桌面插件', type: 'checkbox', checked: S.on.widgets, click: () => toggle('widgets') },
    { label: '任务栏美化', type: 'checkbox', checked: S.on.tb, click: () => toggle('tb') },
    { label: '任务栏挂件', type: 'checkbox', checked: S.on.tbw, click: () => toggle('tbw') },
    { type: 'separator' },
    { label: '开机自启动', type: 'checkbox', checked: S.settings.auto, click: () => { S.settings.auto = !S.settings.auto; applyState(null); } },
    { label: '退出星叙', click: () => app.quit() },
  ]));
}
function toggle(k) { S.on[k] = !S.on[k]; applyState(null); }
function applyState(fromWc) {
  saveState();
  broadcast('state', S, fromWc);
  syncTaskbar();
  placeDesk();
  placeBar();
  buildTray();
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!S.settings.auto, path: process.execPath, args: ['--hidden'], name: 'XingXu' });
  weatherLoop(false); // 只获取新出现的城市
}
function shortcuts() {
  const reg = (acc, fn) => { try { globalShortcut.register(acc, fn); } catch (_) {} };
  reg('Alt+Shift+D', () => toggle('widgets'));
  reg('Alt+Shift+T', () => toggle('tb'));
  reg('Alt+Shift+L', () => { const w = S.widgets.find(x => x.type === 'lyrics'); if (w) { w.lock = !w.lock; applyState(null); } });
}

/* ---------------- IPC ---------------- */
ipcMain.on('state:get', e => { e.returnValue = S; });
ipcMain.on('state:set', (e, s) => {
  if (!s || s.v !== 1) return;
  // 其他窗口可能仍持有拖动前的快照。已有插件的位置只由桌面拖动更新。
  const positions = new Map(S.widgets.map(w => [w.id, w]));
  for (const w of s.widgets) {
    const saved = positions.get(w.id);
    if (saved) { w.x = saved.x; w.y = saved.y; }
  }
  S = migrate(s);
  applyState(e.sender);
});
ipcMain.on('widget:geometry', (e, { id, x, y, w, h }) => {
  if (![W.desk, W.deskTop].some(b => b && !b.isDestroyed() && b.webContents === e.sender)) return;
  const widget = S.widgets.find(item => item.id === id);
  if (!widget || widget.lock || S.settings.lockAll) return;
  if (Number.isFinite(x) && Number.isFinite(y)) Object.assign(widget, { x, y });
  else if (Number.isFinite(w) && Number.isFinite(h) && w >= 80 && h >= 70) Object.assign(widget, { w, h });
  else return;
  flushState();
  broadcast('state', S);
});
ipcMain.on('env:get', e => { e.returnValue = { ...env(), media, weathers }; });
ipcMain.on('relay', (e, { to, ch, data }) => {
  if (to === 'main') { if (ch === 'cc') openCC(data); return; }
  for (const k in W) { const b = W[k]; if (b && !b.isDestroyed() && b.webContents !== e.sender && (to === 'all' || to === k || (to === 'desks' && k.startsWith('desk')))) b.webContents.send('relay:' + ch, data); }
});
ipcMain.on('hit', (e, h) => { const b = BrowserWindow.fromWebContents(e.sender); if (b) { b._hit = h; hitLoop(); } });
ipcMain.on('media:cmd', (_e, c) => {
  if (!mediaProc || !['play', 'next', 'prev'].includes(c)) return;
  mediaProc.stdin.write(c + '\n');
  // 先按预期状态显示，播放器的状态上报可能晚十秒左右
  if (c === 'play' && media) { hint = { key: media.title + '|' + media.artist, playing: !media.playing, until: Date.now() + 15000 }; const m = { ...media, upd: 0 }; smoothMedia(m); media = m; broadcast('media', m); }
});
ipcMain.handle('lyric:bind', (_e, text) => {
  if (!lyr.key) return false;
  fs.writeFileSync(lrcFile(lyr.key), text, 'utf8');
  lyr.list.unshift({ src: '本地绑定', lrc: text }); lyr.idx = 0; sendLyrics(); return true;
});
ipcMain.handle('lyric:next', () => { if (lyr.list.length > 1) { lyr.idx = (lyr.idx + 1) % lyr.list.length; sendLyrics(); } return lyr.list.length; });
ipcMain.on('open', (_e, p) => {
  if (typeof p !== 'string' || !p) return;
  if (p.startsWith('shell:')) spawn('explorer.exe', [p], { detached: true, windowsHide: false }).unref();
  else if (p === 'ms-settings:' || p === 'ms-screenclip:') shell.openExternal(p);
  else if (p === 'control' || p === 'calc') spawn(p + '.exe', [], { detached: true }).unref();
  else shell.openPath(p);
});
ipcMain.on('url', (_e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });
const { fileIcon, refreshOrganizerIcons } = require('./file-icons');
ipcMain.handle('icon', (_e, p) => fileIcon(p));
ipcMain.handle('img:save', (_e, d) => {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(d || ''); if (!m) return '';
  const f = path.join(IMG, uid() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]));
  fs.writeFileSync(f, Buffer.from(m[2], 'base64'));
  return pathToFileURL(f).href;
});
ipcMain.on('win', (e, c) => {
  const b = BrowserWindow.fromWebContents(e.sender);
  if (c === 'min' && b) b.minimize();
  if (c === 'close' && b) b.close();
});
ipcMain.handle('cfg:export', async e => {
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: '星叙配置.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (r.canceled) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(S, null, 2)); return true;
});
ipcMain.handle('cfg:import', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled) return null;
  try { const o = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); if (o.v !== 1) return false; S = migrate(o); refreshOrganizerIcons(S); applyState(null); return true; } catch (_) { return false; }
});
ipcMain.handle('cfg:reset', () => { S = defState(); applyState(null); return true; });
ipcMain.on('quit', () => app.quit());
ipcMain.on('tb:heal', () => { clearTimeout(healTimer); healTimer = null; if (S.on.tb && useTTB() && !healing) { healing = true; ttb.reapply(S.tb, { maxNormal: S.settings.tbFullNormal !== false, sysLight: tbc.systemLight() }).then(r => { tbResult = r; broadcast('env', env()); }).catch(() => {}).finally(() => { healing = false; }); } });

/* ---------------- 生命周期 ---------------- */
let quitting = false;
app.on('second-instance', () => openCC());
app.whenReady().then(() => {
  N = require('./native');
  S = loadState();
  if (refreshOrganizerIcons(S)) flushState();
  syncWallpaper();
  setInterval(syncWallpaper, 10000);
  W.desk = overlay('desk');
  W.deskTop = overlay('deskTop');
  W.bar = makeBar();
  buildTray();
  shortcuts();
  startMedia();
  syncTaskbar();
  applyState(null);
  if (!HIDDEN) openCC();
  setInterval(hitLoop, 33);
  setInterval(placeBar, 1000);
  setInterval(fullLoop, 1500);
  setInterval(sysLoop, 1000);
  setInterval(() => weatherLoop(false), 5 * 60e3);
  setInterval(() => { if (W.desk && !W.desk.isDestroyed()) N.pinToDesktop(W.desk); }, 2000);
  weatherLoop(true);
  // 调试：按脚本改状态（仅 XX_DEBUG 且指定 XX_DRIVE 时）
  if (DEBUG && process.env.XX_DRIVE) require(process.env.XX_DRIVE)({ get S() { return S; }, applyState, tbc });
  const onDisplays = () => { deskKey = deskKey && 'x'; placeDesk(); placeBar(); healTaskbar(); };
  screen.on('display-metrics-changed', (_e, _d, m) => { if (m.some(x => x === 'bounds' || x === 'scaleFactor' || x === 'rotation')) onDisplays(); else { placeDesk(); placeBar(); } });
  screen.on('display-added', onDisplays);
  screen.on('display-removed', onDisplays);
  powerMonitor.on('resume', healTaskbar);
  powerMonitor.on('unlock-screen', healTaskbar);
});
if (DEBUG) {
  app.on('child-process-gone', (_e, d) => console.log('[child] gone', JSON.stringify(d)));
  process.on('uncaughtException', e => console.log('[main] uncaught', e && e.stack));
  process.on('exit', c => console.log('[main] exit', c));
}
app.on('window-all-closed', () => {}); // 常驻托盘
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  flushState();
  try { if (mediaProc) mediaProc.kill(); } catch (_) {}
  restoreTaskbarDetached();
});
