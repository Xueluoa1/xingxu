// 真实任务栏着色：写入系统「在任务栏上显示强调色」相关设置，开启前备份，关闭 / 退出 / 卸载时还原
// 改主题后的系统广播要等所有窗口处理完，可能耗时数十秒，所以运行时全部异步执行，不阻塞主线程
const fs = require('fs');
const { execFile, execFileSync } = require('child_process');
const N = require('./native');

const P = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';
const A = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent';
const KEYS = [
  [P, 'SystemUsesLightTheme', 'REG_DWORD'],
  [P, 'ColorPrevalence', 'REG_DWORD'],
  [P, 'EnableTransparency', 'REG_DWORD'],
  [A, 'AccentPalette', 'REG_BINARY'],
  [A, 'AccentColorMenu', 'REG_DWORD'],
];
// AccentPalette 共 8 色（RGBA），实测任务栏使用第 6 项（下标 5）
const TASKBAR_IDX = 5;
const DEF_PALETTE = '99EBFF004CC2FF000091F8000078D4000067C000003E9200001A6800F7630C00';

const parse = (out, name) => { const m = out.match(new RegExp(name + '\\s+(REG_\\w+)\\s+(\\S*)')); return m ? { type: m[1], value: m[2] } : null; };
const regArgs = {
  query: (key, name) => ['query', key, '/v', name],
  add: (key, name, type, value) => ['add', key, '/v', name, '/t', type, '/d', String(value), '/f'],
  del: (key, name) => ['delete', key, '/v', name, '/f'],
};
const regSync = a => execFileSync('reg', a, { encoding: 'latin1', windowsHide: true });
const reg = a => new Promise((ok, no) => execFile('reg', a, { encoding: 'latin1', windowsHide: true }, (e, out) => e ? no(e) : ok(out)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dword = v => (typeof v === 'number' ? v : parseInt(v, 16)) >>> 0;

function querySync(key, name) { try { return parse(regSync(regArgs.query(key, name)), name); } catch (_) { return null; } }
async function query(key, name) { try { return parse(await reg(regArgs.query(key, name)), name); } catch (_) { return null; } }

class TaskbarColor {
  constructor(backupFile) {
    this.file = backupFile;
    this.want = undefined; this.busy = false; this.flip = false;
    this.light = false; this.onDone = null; this.applied = this.hasBackup();
    query(P, 'SystemUsesLightTheme').then(q => { this.light = q ? dword(q.value) === 1 : false; });
  }
  hasBackup() { return fs.existsSync(this.file); }
  systemLight() { return this.light; }
  // 仅切换系统深浅色（配合 TranslucentTB 使用，让任务栏图标 / 时钟清晰可见），不着色
  async setThemeOnly(light) {
    await this.backup();
    await reg(regArgs.add(P, 'SystemUsesLightTheme', 'REG_DWORD', light ? 1 : 0));
    await N.broadcastColorChangeAsync();
    this.light = light; this.applied = true;
  }
  // 备份格式：每行 键\t名称\t类型\t值（值为空表示原本不存在），卸载程序也读这个文件
  async backup() {
    if (this.hasBackup()) return;
    const lines = [];
    for (const [k, n, t] of KEYS) { const q = await query(k, n); lines.push([k, n, t, q ? q.value : ''].join('\t')); }
    fs.writeFileSync(this.file, lines.join('\r\n'), 'utf8');
  }
  readBackup() {
    const o = {};
    fs.readFileSync(this.file, 'utf8').split(/\r?\n/).filter(Boolean).forEach(l => { const [k, n, t, v] = l.split('\t'); o[n] = { k, t, v }; });
    return o;
  }

  // 请求目标状态：tb 为任务栏设置，null 为还原。执行中有新请求时只保留最新一个
  set(tb) {
    this.want = tb ? { c1: tb.c1, fill: tb.fill } : null;
    if (!this.busy) this.run();
  }
  async run() {
    this.busy = true;
    while (this.want !== undefined) {
      const t = this.want; this.want = undefined;
      let res = null;
      if (process.env.XX_DEBUG) console.log('[tb] start', t ? JSON.stringify(t) : 'restore', new Date().toISOString().slice(11, 19));
      try { res = t ? await this.apply(t) : (await this.restore(), null); } catch (e) { console.error('taskbar', e); }
      if (process.env.XX_DEBUG) console.log('[tb] end', new Date().toISOString().slice(11, 19));
      if (this.want === undefined && this.onDone) this.onDone(res);
    }
    this.busy = false;
  }

  // AccentColorMenu 每次取不同值，资源管理器才会重读调色板（在原值最低位上翻转，肉眼无差别）
  nextMenu(b) {
    const menu = b.AccentColorMenu && b.AccentColorMenu.v !== '' ? dword(b.AccentColorMenu.v) : 0xffd47800;
    this.flip = !this.flip;
    return (this.flip ? menu ^ 1 : menu) >>> 0;
  }
  // 回到备份里的原始外观（Windows 默认，通常是浅色），用于切换前的过渡与还原
  async writeOriginal(b) {
    const pal = (b.AccentPalette && b.AccentPalette.v) || DEF_PALETTE;
    await reg(regArgs.add(A, 'AccentPalette', 'REG_BINARY', pal));
    await reg(regArgs.add(A, 'AccentColorMenu', 'REG_DWORD', this.nextMenu(b)));
    const slt = b.SystemUsesLightTheme && b.SystemUsesLightTheme.v !== '' ? dword(b.SystemUsesLightTheme.v) : 1;
    const tr = b.EnableTransparency && b.EnableTransparency.v !== '' ? dword(b.EnableTransparency.v) : 1;
    await reg(regArgs.add(P, 'SystemUsesLightTheme', 'REG_DWORD', slt));
    await reg(regArgs.add(P, 'EnableTransparency', 'REG_DWORD', tr));
    await reg(regArgs.add(P, 'ColorPrevalence', 'REG_DWORD', 0));
  }
  // 返回实际效果，供界面提示
  async apply(tb) {
    await this.backup();
    const b = this.readBackup();
    const c1 = /^#[0-9a-f]{6}$/i.test(tb.c1) ? tb.c1.slice(1).toUpperCase() : '202020';
    const v = parseInt(c1, 16), lum = (v >> 16) * .299 + (v >> 8 & 255) * .587 + (v & 255) * .114;
    const light = lum > 150;
    const trans = tb.fill && tb.fill !== 'solid' ? 1 : 0;

    // 若已处于着色状态，先还原成 Windows 原始外观（白）再切换，避免中途闪过系统蓝色
    if (this.applied) {
      await this.writeOriginal(b);
      await N.broadcastColorChangeAsync();
      await sleep(500);
    }

    if (light) {
      // 浅色预设：直接用系统浅色任务栏（不开启强调色），主副屏都变白，不残留深色
      await reg(regArgs.add(A, 'AccentPalette', 'REG_BINARY', (b.AccentPalette && b.AccentPalette.v) || DEF_PALETTE));
      await reg(regArgs.add(A, 'AccentColorMenu', 'REG_DWORD', this.nextMenu(b)));
      await reg(regArgs.add(P, 'SystemUsesLightTheme', 'REG_DWORD', 1));
      await reg(regArgs.add(P, 'EnableTransparency', 'REG_DWORD', trans));
      await reg(regArgs.add(P, 'ColorPrevalence', 'REG_DWORD', 0));
      await N.broadcastColorChangeAsync();
      // 个别系统副屏任务栏不随单次广播变白，隔一会儿再广播一次
      await sleep(350);
      await N.broadcastColorChangeAsync();
    } else {
      let pal = (b.AccentPalette && b.AccentPalette.v) || DEF_PALETTE;
      if (pal.length < 64) pal = pal.padEnd(64, '0');
      pal = pal.slice(0, TASKBAR_IDX * 8) + c1 + '00' + pal.slice(TASKBAR_IDX * 8 + 8);
      await reg(regArgs.add(A, 'AccentPalette', 'REG_BINARY', pal));
      await reg(regArgs.add(A, 'AccentColorMenu', 'REG_DWORD', this.nextMenu(b)));
      await reg(regArgs.add(P, 'SystemUsesLightTheme', 'REG_DWORD', 0));
      await reg(regArgs.add(P, 'EnableTransparency', 'REG_DWORD', trans));
      // 从白过渡过来：直接开启强调色（0→1），不再先关后开，避免二次闪烁
      await reg(regArgs.add(P, 'ColorPrevalence', 'REG_DWORD', 1));
      await N.broadcastColorChangeAsync();
    }
    this.light = light; this.applied = true;
    return { light, color: light ? null : '#' + c1, translucent: !!trans };
  }
  async restore() {
    if (!this.hasBackup()) return false;
    const b = this.readBackup();
    for (const n of Object.keys(b)) {
      const { k, t, v } = b[n];
      if (n === 'ColorPrevalence' || n === 'AccentColorMenu') continue;
      if (v === '') await reg(regArgs.del(k, n)).catch(() => {});
      else await reg(regArgs.add(k, n, t, t === 'REG_DWORD' ? dword(v) : v));
    }
    // AccentColorMenu 翻转一次以强制重读，再写回原值
    if (b.AccentColorMenu && b.AccentColorMenu.v !== '') {
      await reg(regArgs.add(A, 'AccentColorMenu', 'REG_DWORD', (dword(b.AccentColorMenu.v) ^ 1) >>> 0));
    }
    if (b.SystemUsesLightTheme) this.light = b.SystemUsesLightTheme.v !== '' && dword(b.SystemUsesLightTheme.v) === 1;
    const cp = b.ColorPrevalence && b.ColorPrevalence.v !== '' ? dword(b.ColorPrevalence.v) : 0;
    // 先把强调色关掉并广播（白），再写回原始 ColorPrevalence
    await reg(regArgs.add(P, 'ColorPrevalence', 'REG_DWORD', cp ? 0 : 1));
    await N.broadcastColorChangeAsync();
    await sleep(450);
    if (b.AccentColorMenu && b.AccentColorMenu.v !== '') await reg(regArgs.add(A, 'AccentColorMenu', 'REG_DWORD', dword(b.AccentColorMenu.v)));
    await reg(regArgs.add(P, 'ColorPrevalence', 'REG_DWORD', cp));
    await N.broadcastColorChangeAsync();
    this.applied = false;
    try { fs.unlinkSync(this.file); } catch (_) {}
    return true;
  }

  // 同步还原：仅用于独立的还原进程（--restore-taskbar），此时没有界面，阻塞无妨
  restoreSync() {
    if (!this.hasBackup()) return false;
    const b = this.readBackup();
    const add = (k, n, t, v) => regSync(regArgs.add(k, n, t, v));
    if (b.AccentColorMenu && b.AccentColorMenu.v !== '') add(A, 'AccentColorMenu', 'REG_DWORD', (dword(b.AccentColorMenu.v) ^ 1) >>> 0);
    for (const n of Object.keys(b)) {
      const { k, t, v } = b[n];
      if (n === 'ColorPrevalence') continue;
      if (v === '') { try { regSync(regArgs.del(k, n)); } catch (_) {} } else add(k, n, t, t === 'REG_DWORD' ? dword(v) : v);
    }
    const cp = b.ColorPrevalence && b.ColorPrevalence.v !== '' ? dword(b.ColorPrevalence.v) : 0;
    add(P, 'ColorPrevalence', 'REG_DWORD', cp ? 0 : 1);
    N.broadcastColorChange();
    const t0 = Date.now(); while (Date.now() - t0 < 450) {}
    add(P, 'ColorPrevalence', 'REG_DWORD', cp);
    // 先删备份再广播：广播可能很慢，即使中途被结束，设置也已还原
    try { fs.unlinkSync(this.file); } catch (_) {}
    N.broadcastColorChange();
    return true;
  }
}
module.exports = TaskbarColor;
module.exports.querySync = querySync;
