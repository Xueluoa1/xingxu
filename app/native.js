// Win32 接口（koffi FFI）
const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const dwm = koffi.load('dwmapi.dll');

const HWND = koffi.pointer('HWND', koffi.opaque());
const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
const ACCENT = koffi.struct('ACCENT_POLICY', { AccentState: 'int', AccentFlags: 'int', GradientColor: 'uint32', AnimationId: 'int' });
const WCAD = koffi.struct('WINDOWCOMPOSITIONATTRIBDATA', { Attrib: 'int', pvData: koffi.pointer(ACCENT), cbData: 'size_t' });

const FindWindowW = user32.func('HWND __stdcall FindWindowW(str16 cls, str16 name)');
const FindWindowExW = user32.func('HWND __stdcall FindWindowExW(HWND parent, HWND after, str16 cls, str16 name)');
const SetWindowLongPtrW = user32.func('intptr __stdcall SetWindowLongPtrW(HWND h, int idx, intptr v)');
const GetWindowLongPtrW = user32.func('intptr __stdcall GetWindowLongPtrW(HWND h, int idx)');
const SetWindowPos = user32.func('bool __stdcall SetWindowPos(HWND h, intptr after, int x, int y, int cx, int cy, uint flags)');
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(HWND h, _Out_ RECT *r)');
const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()');
const GetClassNameW = user32.func('int __stdcall GetClassNameW(HWND h, _Out_ uint16_t *buf, int n)');
const GetShellWindow = user32.func('HWND __stdcall GetShellWindow()');
const SetWindowCompositionAttribute = user32.func('bool __stdcall SetWindowCompositionAttribute(HWND h, WINDOWCOMPOSITIONATTRIBDATA *d)');
const SendMessageTimeoutW = user32.func('intptr __stdcall SendMessageTimeoutW(intptr h, uint msg, uintptr w, str16 l, uint flags, uint timeout, _Out_ uintptr *res)');
const MonitorFromWindow = user32.func('intptr __stdcall MonitorFromWindow(HWND h, uint flags)');
const DwmGetWindowAttribute = dwm.func('long __stdcall DwmGetWindowAttribute(HWND h, uint attr, _Out_ RECT *r, uint cb)');

const GWLP_HWNDPARENT = -8, GWL_EXSTYLE = -20;
const SWP_NOSIZE = 1, SWP_NOMOVE = 2, SWP_NOACTIVATE = 0x10;
const HWND_BOTTOM = 1, HWND_TOPMOST = -1;

function hwndOf(win) {
  const b = win.getNativeWindowHandle();
  return koffi.decode(b, HWND);
}
function addr(h) { return h ? Number(koffi.address(h)) : 0; }

const GetWindow = user32.func('HWND __stdcall GetWindow(HWND h, uint cmd)');
// 承载桌面图标的窗口：Progman，或开启壁纸动画 / 第三方壁纸时的某个 WorkerW
function iconsHost() {
  const pm = FindWindowW('Progman', null);
  if (pm && FindWindowExW(pm, null, 'SHELLDLL_DefView', null)) return pm;
  let w = null;
  while ((w = FindWindowExW(null, w, 'WorkerW', null))) if (FindWindowExW(w, null, 'SHELLDLL_DefView', null)) return w;
  return pm;
}
// 桌面层目标位置：紧贴在桌面图标窗口之上、所有普通窗口之下。
// 图标窗口上方若是管理员权限程序的窗口，SetWindowPos 会被拒绝（错误 5），需继续向上找一个可用的锚点
function pinToDesktop(win) {
  const h = hwndOf(win), self = addr(h);
  const host = iconsHost(); if (!host) return;
  let p = GetWindow(host, 3);
  for (let n = 0; p && n < 40; n++, p = GetWindow(p, 3)) {
    if (addr(p) === self) return;
    if (SetWindowPos(h, addr(p), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)) return;
  }
}
function unpinFromDesktop(win) { SetWindowLongPtrW(hwndOf(win), GWLP_HWNDPARENT, 0); }
function sendToBottom(win) {
  SetWindowPos(hwndOf(win), HWND_BOTTOM, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
}
function bringTopmost(win) {
  SetWindowPos(hwndOf(win), HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
}

function rectOf(h) { const r = {}; if (!h || !GetWindowRect(h, r)) return null; return r; }
function className(h) { const b = new Uint16Array(256); const n = GetClassNameW(h, b, 256); return String.fromCharCode(...b.slice(0, n)); }

// 任务栏与托盘区域（物理像素）
function taskbarInfo() {
  const tb = FindWindowW('Shell_TrayWnd', null);
  if (!tb) return null;
  const tray = FindWindowExW(tb, null, 'TrayNotifyWnd', null);
  return { bar: rectOf(tb), tray: rectOf(tray) };
}

// 全部任务栏：主屏 Shell_TrayWnd（带托盘区），扩展屏 Shell_SecondaryTrayWnd（无托盘，右侧为时钟）
function taskbars() {
  const out = [];
  const tb = FindWindowW('Shell_TrayWnd', null);
  if (tb) out.push({ primary: true, bar: rectOf(tb), tray: rectOf(FindWindowExW(tb, null, 'TrayNotifyWnd', null)) });
  let h = null;
  while ((h = FindWindowExW(null, h, 'Shell_SecondaryTrayWnd', null))) out.push({ primary: false, bar: rectOf(h), tray: null });
  return out;
}

// 前台窗口是否全屏（游戏 / 视频）
function foregroundFullscreen(screenRect) {
  const h = GetForegroundWindow();
  if (!h) return false;
  if (addr(h) === addr(GetShellWindow())) return false;
  const c = className(h);
  if (c === 'WorkerW' || c === 'Progman' || c === 'Shell_TrayWnd') return false;
  const r = rectOf(h);
  if (!r) return false;
  return r.left <= screenRect.left && r.top <= screenRect.top && r.right >= screenRect.right && r.bottom >= screenRect.bottom;
}

// SetWindowCompositionAttribute 任务栏着色（ACCENT 2 透明渐变 / 3 模糊 / 4 亚克力 / 0 关闭）
function setTaskbarAccent(state, abgr) {
  const list = [];
  const main = FindWindowW('Shell_TrayWnd', null);
  if (main) list.push(main);
  let s = null;
  while ((s = FindWindowExW(null, s, 'Shell_SecondaryTrayWnd', null))) list.push(s);
  const acc = { AccentState: state, AccentFlags: 2, GradientColor: abgr >>> 0, AnimationId: 0 };
  list.forEach(h => SetWindowCompositionAttribute(h, { Attrib: 19, pvData: acc, cbData: koffi.sizeof(ACCENT) }));
  return list.length;
}

// 广播系统颜色变更，让任务栏重新读取强调色设置
function broadcastColorChange() {
  const out = [0];
  SendMessageTimeoutW(0xffff, 0x001A, 0, 'ImmersiveColorSet', 2, 3000, out);
}
// 异步版本：交给独立进程广播（见 broadcast.js），主进程照常响应
function broadcastColorChangeAsync() {
  return new Promise(ok => {
    const { spawn } = require('child_process');
    const done = () => { clearTimeout(t); ok(); };
    let p;
    try { p = spawn(process.execPath, [require('path').join(__dirname, 'broadcast.js')], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: 'ignore', windowsHide: true }); }
    catch (_) { return ok(); }
    // 广播进程最多等 60 秒
    const t = setTimeout(() => { try { p.kill(); } catch (_) {} ok(); }, 60000);
    p.on('exit', done); p.on('error', done);
  });
}

// 当前系统壁纸路径
const SystemParametersInfoW = user32.func('bool __stdcall SystemParametersInfoW(uint act, uint p, _Out_ uint16_t *buf, uint ini)');
function wallpaperPath() {
  const b = new Uint16Array(520);
  if (!SystemParametersInfoW(0x73, 520, b, 0)) return '';
  let n = b.indexOf(0); if (n < 0) n = b.length;
  return String.fromCharCode(...b.slice(0, n));
}

// 某个屏幕点所在显示器的设备名（\\.\DISPLAY1）与接口名（\\?\DISPLAY#...），用于匹配动态壁纸软件的配置
const POINT = koffi.struct('POINT', { x: 'long', y: 'long' });
const MONITORINFOEXW = koffi.struct('MONITORINFOEXW', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32', szDevice: koffi.array('uint16', 32) });
const DISPLAY_DEVICEW = koffi.struct('DISPLAY_DEVICEW', { cb: 'uint32', DeviceName: koffi.array('uint16', 32), DeviceString: koffi.array('uint16', 128), StateFlags: 'uint32', DeviceID: koffi.array('uint16', 128), DeviceKey: koffi.array('uint16', 128) });
const MonitorFromPoint = user32.func('intptr __stdcall MonitorFromPoint(POINT pt, uint32 flags)');
const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(intptr hMon, _Inout_ MONITORINFOEXW *mi)');
const EnumDisplayDevicesW = user32.func('bool __stdcall EnumDisplayDevicesW(str16 dev, uint32 i, _Inout_ DISPLAY_DEVICEW *dd, uint32 flags)');
const u16 = a => { const n = a.indexOf(0); return String.fromCharCode(...(n < 0 ? a : a.slice(0, n))); };
function monitorIds(x, y) {
  const h = MonitorFromPoint({ x: Math.round(x), y: Math.round(y) }, 2); // MONITOR_DEFAULTTONEAREST
  const mi = { cbSize: koffi.sizeof(MONITORINFOEXW) };
  if (!h || !GetMonitorInfoW(h, mi)) return null;
  const dev = u16(mi.szDevice), ids = [];
  for (let i = 0; i < 8; i++) {
    const dd = { cb: koffi.sizeof(DISPLAY_DEVICEW) };
    if (!EnumDisplayDevicesW(dev, i, dd, 1)) break; // EDD_GET_DEVICE_INTERFACE_NAME
    ids.push(u16(dd.DeviceID));
  }
  return { dev, ids };
}

// 查找正在运行的进程的完整路径（按文件名匹配，不区分大小写）
const psapi = koffi.load('psapi.dll');
const EnumProcesses = psapi.func('bool __stdcall EnumProcesses(_Out_ uint32_t *ids, uint32 cb, _Out_ uint32_t *needed)');
const OpenProcess = koffi.load('kernel32.dll').func('intptr __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)');
const CloseHandle = koffi.load('kernel32.dll').func('bool __stdcall CloseHandle(intptr h)');
const QueryFullProcessImageNameW = koffi.load('kernel32.dll').func('bool __stdcall QueryFullProcessImageNameW(intptr h, uint32 flags, _Out_ uint16_t *buf, _Inout_ uint32_t *size)');
function processPath(names) {
  const want = names.map(n => n.toLowerCase());
  const ids = new Uint32Array(4096), need = [0];
  if (!EnumProcesses(ids, ids.byteLength, need)) return '';
  for (let i = 0; i < need[0] / 4; i++) {
    const h = OpenProcess(0x1000, false, ids[i]); // PROCESS_QUERY_LIMITED_INFORMATION
    if (!h) continue;
    const buf = new Uint16Array(1024), size = [1024];
    let p = '';
    if (QueryFullProcessImageNameW(h, 0, buf, size)) p = String.fromCharCode(...buf.slice(0, size[0]));
    CloseHandle(h);
    if (p && want.includes(p.split('\\').pop().toLowerCase())) return p;
  }
  return '';
}

module.exports = { wallpaperPath, monitorIds, processPath, pinToDesktop, unpinFromDesktop, sendToBottom, bringTopmost, taskbarInfo, taskbars, foregroundFullscreen, setTaskbarAccent, broadcastColorChange, broadcastColorChangeAsync, hwndOf };
