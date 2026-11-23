// 独立进程：广播系统颜色变更（ImmersiveColorSet），让任务栏重新读取设置。
// 由主进程以 ELECTRON_RUN_AS_NODE 方式启动；广播要等所有窗口处理完，可能很慢，放在这里不影响星叙本身
const koffi = require('koffi');
const user32 = koffi.load('user32.dll');
const SendMessageTimeoutW = user32.func('intptr __stdcall SendMessageTimeoutW(intptr h, uint msg, uintptr w, str16 l, uint flags, uint timeout, _Out_ uintptr *res)');
SendMessageTimeoutW(0xffff, 0x001A, 0, 'ImmersiveColorSet', 2, 3000, [0]); // HWND_BROADCAST, WM_SETTINGCHANGE, SMTO_ABORTIFHUNG
process.exit(0);
