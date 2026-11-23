// 任务栏真透明 / 亚克力：调用 TranslucentTB（第三方 GPL-3.0，见 ttb/LICENSE.md）
// 优先复用用户已安装的 TranslucentTB（复用前备份其配置），未安装时用内置便携版
const fs = require('fs');
const path = require('path');
const { spawn, execFile, execFileSync } = require('child_process');

const PKG_FAMILY = '28017CharlesMilette.TranslucentTB_v826wp6bftszj';
const AUMID = PKG_FAMILY + '!TranslucentTB';
const SCHEMA = 'https://TranslucentTB.github.io/settings.schema.json';

const hx2 = n => ('0' + (n & 255).toString(16)).slice(-2).toUpperCase();
function norm6(c) { const s = String(c || '').replace('#', ''); return /^[0-9a-fA-F]{6}/.test(s) ? s.slice(0, 6).toUpperCase() : '2B2840'; }
function bright(rgb) { const r = parseInt(rgb.slice(0, 2), 16), g = parseInt(rgb.slice(2, 4), 16), b = parseInt(rgb.slice(4, 6), 16); return 0.299 * r + 0.587 * g + 0.114 * b; }

// 星叙任务栏设置 → TranslucentTB 外观
function mapAppearance(tb) {
  const rgb = norm6(tb && tb.c1);
  const light = bright(rgb) > 150;
  const fill = tb && tb.fill === 'blur' ? 'translucent' : tb && tb.fill; // 旧配置的"模糊"在 Win11 上与亚克力相同
  if (fill === 'translucent' || fill === 'clear') {
    const def = fill === 'clear' ? 0 : 60;
    const op = tb.op == null ? def : Math.max(0, Math.min(100, tb.op));
    const a = Math.round(op / 100 * 255);
    const accent = fill === 'translucent' ? 'acrylic' : 'clear';
    // 几乎全透明时任务栏深浅取决于壁纸，交给系统深浅色判断挂件文字颜色
    return { accent, color: '#' + rgb + hx2(a), light: op < 35 ? null : light, translucent: true, fill };
  }
  return { accent: 'opaque', color: '#' + rgb + 'FF', light, translucent: false, fill: 'solid' };
}

class TTB {
  // bundledDir: 内置 ttb 目录；backupFile: 复用外部配置时的备份；getProcPath: native.processPath
  constructor(bundledDir, backupFile, getProcPath) {
    this.bundledExe = path.join(bundledDir, 'TranslucentTB.exe');
    // 复用外部实例时的备份用两个纯文本文件，卸载程序（C#）也能直接读
    this.cfgRef = backupFile.replace(/\.json$/i, '-cfg.txt');
    this.origRef = backupFile.replace(/\.json$/i, '-orig.json');
    this.launchedRef = backupFile.replace(/\.json$/i, '-launched.txt'); // 已安装版原本没运行、由星叙启动
    this.getProcPath = getProcPath;
    this.startedBundled = false;
    this.applied = fs.existsSync(this.cfgRef);
  }
  available() { return fs.existsSync(this.bundledExe) || !!this.runningExe() || fs.existsSync(this.packagedDir()); }
  runningExe() { try { return this.getProcPath(['TranslucentTB.exe']) || ''; } catch (_) { return ''; } }
  isBundled(p) { return !!p && path.resolve(path.dirname(p)).toLowerCase() === path.resolve(path.dirname(this.bundledExe)).toLowerCase(); }
  packagedDir() { return path.join(process.env.LOCALAPPDATA || '', 'Packages', PKG_FAMILY); }
  roamingCfg() { return path.join(this.packagedDir(), 'RoamingState', 'settings.json'); }

  // 决定写哪个配置文件、用谁、是否外部实例
  resolve() {
    const run = this.runningExe();
    if (run && this.isBundled(run)) return { cfg: path.join(path.dirname(this.bundledExe), 'settings.json'), external: false, exe: this.bundledExe };
    if (run) {
      // 商店版：从 WindowsApps\<名称>_<版本>_<架构>__<发布者ID>\ 推出包家族名，配置在 Packages\<家族名>\RoamingState
      const m = run.match(/\\WindowsApps\\([^\\_]+)_[^\\]*__([^\\]+)\\/i);
      if (m) return { cfg: path.join(process.env.LOCALAPPDATA || '', 'Packages', m[1] + '_' + m[2], 'RoamingState', 'settings.json'), external: true, exe: null };
      return { cfg: path.join(path.dirname(run), 'settings.json'), external: true, exe: run };
    }
    if (fs.existsSync(this.packagedDir())) return { cfg: this.roamingCfg(), external: true, exe: null, aumid: true };
    return { cfg: path.join(path.dirname(this.bundledExe), 'settings.json'), external: false, exe: this.bundledExe };
  }
  backupExternal(r) {
    if (!r.external || fs.existsSync(this.cfgRef)) return;
    let orig = ''; try { orig = fs.readFileSync(r.cfg, 'utf8'); } catch (_) {}
    try { fs.writeFileSync(this.origRef, orig, 'utf8'); fs.writeFileSync(this.cfgRef, r.cfg, 'utf8'); } catch (_) {}
  }
  writeCfg(r, ap) {
    const off = { enabled: false };
    // 某块屏幕上有最大化 / 全屏窗口时，只把那块屏幕的任务栏恢复为 Windows 默认（TranslucentTB 按显示器分别判断）
    // 不用 accent 'normal'（恢复默认）：Windows 11 副屏任务栏去掉效果后不会重绘，会一直保持透明。
    // 改为明确写入接近 Windows 默认的颜色（浅色 #F3F3F3 / 深色 #1C1C1C），主副屏都能生效
    const maxi = this.maxNormal
      ? { enabled: true, accent: 'opaque', color: this.sysLight === false ? '#1C1C1CFF' : '#F3F3F3FF', show_peek: true, show_line: true, rules: { window_class: {}, window_title: {}, process_name: {} } }
      : off;
    const cfg = {
      $schema: SCHEMA,
      desktop_appearance: { accent: ap.accent, color: ap.color, show_peek: true, show_line: false },
      visible_window_appearance: off, maximized_window_appearance: maxi,
      start_opened_appearance: off, search_opened_appearance: off,
      task_view_opened_appearance: off, battery_saver_appearance: off,
      hide_tray: true, disable_saving: true, verbosity: 'warn',
    };
    fs.mkdirSync(path.dirname(r.cfg), { recursive: true });
    fs.writeFileSync(r.cfg, JSON.stringify(cfg, null, 2), 'utf8'); // TTB 监视此文件并自动热重载
  }
  ensureRunning(r) {
    if (r.external) {
      if (r.aumid) {
        try { fs.writeFileSync(this.launchedRef, '1', 'utf8'); } catch (_) {}
        try { execFile('explorer.exe', ['shell:AppsFolder\\' + AUMID], { windowsHide: true }); } catch (_) {}
      }
      return;
    }
    if (this.runningBundled()) return;
    try { spawn(r.exe, [], { detached: true, stdio: 'ignore', windowsHide: true, cwd: path.dirname(r.exe) }).unref(); this.startedBundled = true; } catch (_) {}
  }

  // 应用任务栏外观，返回供界面使用的结果
  // opt.maxNormal：有最大化 / 全屏窗口的屏幕恢复 Windows 默认外观（默认开启）
  apply(tb, opt) {
    this.maxNormal = !opt || opt.maxNormal !== false;
    this.sysLight = opt && opt.sysLight; // 系统是否为浅色模式，决定"Windows 默认"用白色还是深灰
    const ap = mapAppearance(tb);
    const r = this.resolve();
    this.backupExternal(r);
    this.writeCfg(r, ap);
    this.ensureRunning(r);
    this.applied = true;
    return { light: ap.light, color: ap.color.slice(0, 7), translucent: ap.translucent, fill: ap.fill };
  }
  // 显示器变化（热插拔、唤醒、Win+P、改分辨率）后 TranslucentTB 常会丢掉副屏任务栏，
  // 只有主屏继续生效。重写配置后重启 TTB 进程，让它重新接管所有任务栏
  async reapply(tb, opt) {
    const run = this.runningExe();
    const res = this.apply(tb, opt);
    if (!run) return res;
    const store = /\\WindowsApps\\/i.test(run);
    const quiet = { windowsHide: true };
    const sleep = ms => new Promise(ok => setTimeout(ok, ms));
    try { execFile('taskkill', ['/IM', 'TranslucentTB.exe'], quiet); } catch (_) {} // 先正常关闭，让它自己还原任务栏
    for (let i = 0; i < 15 && this.runningExe(); i++) await sleep(300);
    if (this.runningExe()) { try { execFileSync('taskkill', ['/F', '/IM', 'TranslucentTB.exe'], quiet); } catch (_) {} await sleep(500); }
    await sleep(800);
    if (this.runningExe()) return res;
    try {
      if (store) execFile('explorer.exe', ['shell:AppsFolder\\' + AUMID], quiet);
      else spawn(run, [], { detached: true, stdio: 'ignore', windowsHide: true, cwd: path.dirname(run) }).unref();
      if (this.isBundled(run)) this.startedBundled = true;
    } catch (_) {}
    return res;
  }
  hasBackup() { return fs.existsSync(this.cfgRef); }
  // 还原：复用的外部实例恢复其原配置；内置实例直接结束
  restore(sync) {
    if (fs.existsSync(this.cfgRef)) {
      try {
        const cfg = fs.readFileSync(this.cfgRef, 'utf8').trim();
        let orig = ''; try { orig = fs.readFileSync(this.origRef, 'utf8'); } catch (_) {}
        if (orig) fs.writeFileSync(cfg, orig, 'utf8');
        else if (fs.existsSync(cfg)) fs.unlinkSync(cfg);
      } catch (_) {}
      try { fs.unlinkSync(this.cfgRef); } catch (_) {}
      try { fs.unlinkSync(this.origRef); } catch (_) {}
      // 已安装版是星叙启动的：还原配置后关掉，回到用户原来的状态
      if (fs.existsSync(this.launchedRef)) {
        try { (sync ? execFileSync : execFile)('taskkill', ['/F', '/IM', 'TranslucentTB.exe'], { windowsHide: true }); } catch (_) {}
        try { fs.unlinkSync(this.launchedRef); } catch (_) {}
      }
    } else if (this.startedBundled || this.runningBundled()) {
      // 只结束内置便携版，不碰用户自己的实例
      try { (sync ? execFileSync : execFile)('taskkill', ['/F', '/IM', 'TranslucentTB.exe'], { windowsHide: true }); } catch (_) {}
    }
    this.startedBundled = false;
    this.applied = false;
  }
  runningBundled() { return this.isBundled(this.runningExe()); }
}

module.exports = TTB;
