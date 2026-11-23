<div align="center">

# 星叙 XingXu

**让桌面有光，让旋律被看见。**

一款源码公开的 Windows 桌面美化工具：桌面插件 · 任务栏美化 · 任务栏挂件 · 实时歌词

![Platform](https://img.shields.io/badge/平台-Windows%2010%20%2F%2011-0078D4)
![Electron](https://img.shields.io/badge/Electron-43-47848F)
![License](https://img.shields.io/badge/许可-CC%20BY--NC%204.0-lightgrey)
![TranslucentTB](https://img.shields.io/badge/内置-TranslucentTB%20(GPL--3.0)-5c2d91)

作者：**雪落a** · B站：**雪落a77** · 个人站：[xueluo.online](https://xueluo.online)

</div>

> [!IMPORTANT]
> 星叙源码公开，**仅供个人学习与非商业使用，禁止任何商业用途**（详见 [许可](#-许可)）。
> 任务栏美化内置了第三方开源软件 **TranslucentTB**，它单独遵循 GPL-3.0。

---

## ✨ 功能

### 桌面插件
可自由拖动、缩放、吸附对齐、锁定位置，支持多显示器。

| 插件 | 说明 |
|---|---|
| 时间与日期 | 当前时间、日期、星期 |
| 天气 | 当前天气与未来 5 天趋势，可多城市 |
| 系统状态 | CPU、内存、磁盘、网络实时占用 |
| 音乐信息 | 自动识别正在播放的音乐，可切歌、暂停 |
| 歌词显示 | 自动匹配歌词，随播放进度滚动 |
| 待办 | 快速记事、勾选完成或删除 |
| 快捷启动 | Dock 栏，把快捷方式或文件拖进来即可 |
| 日历 | 月历视图，周末标识 |
| 相框 | 图片铺满插件，可绑定程序 / 文件 / 文件夹，双击打开 |
| 系统功能入口 | 回收站、此电脑、系统设置、下载、控制面板 |
| FPS 显示 | 插件层实时帧率与帧耗时 |

**全局样式**：经典、拟态、玻璃、玻璃2、深色、素白、靛蓝、墨白，一键应用到全部插件、任务栏与控制中心，也可逐个插件单独设置。

### 任务栏美化（基于内置 TranslucentTB）
- **样式**：经典、玻璃、玻璃2、深色、素白、靛蓝
- **填充方式**：纯色 / 亚克力（磨砂玻璃）/ 全透明，颜色和透明度可调
- **主屏和副屏共用外观设置**。显示器插拔、休眠唤醒或改分辨率后，星叙会尝试重新应用，也可手动点「重新应用到全部屏幕」
- 某块屏幕上有全屏或最大化窗口时，只有那块屏幕恢复 Windows 默认外观（可关闭）
- 可选同时切换系统深色模式，让任务栏图标和时钟在深色背景上看得清
- 关闭美化、退出或卸载星叙时自动还原任务栏

### 任务栏挂件
时间、日期、天气、歌词短句、系统资源、待办提醒，显示在任务栏上；可选图标 + 文字或纯文字，待办提醒可自定义图标和颜色。

### 音乐与歌词
- 通过系统媒体接口（SMTC）识别 QQ 音乐、网易云音乐、酷狗、Spotify 等正在播放的歌曲
- 歌词来源：本地绑定的 .lrc → 网易云音乐 → LRCLIB，可手动切换下一个匹配
- 支持歌词偏移微调、播放 / 暂停 / 切歌

### 快捷键
| 快捷键 | 作用 |
|---|---|
| `Alt + Shift + D` | 显示 / 隐藏桌面插件 |
| `Alt + Shift + T` | 开启 / 关闭任务栏美化 |
| `Alt + Shift + L` | 锁定 / 解锁歌词插件 |

---

## 📦 安装

1. 在 [Releases](../../releases) 下载 `星叙-1.0.0-安装程序.exe`
2. 运行安装程序，选择安装位置（可选创建桌面快捷方式；开机自启可在星叙「设置」中开启）
3. 安装后从开始菜单或托盘图标打开「控制中心」进行设置

**系统要求**：Windows 10 / Windows 11，x64。内置 TranslucentTB 便携版要求 Windows 11。安装程序依赖 .NET Framework 4.x。

**卸载**：在「设置 → 应用」或开始菜单中卸载。卸载时会结束内置的 TranslucentTB、还原任务栏外观；如果你自己装了 TranslucentTB，会还原它原来的配置。可选择是否保留用户数据。

用户数据位置：`%APPDATA%\XingXu`（`config.json`、图片、歌词缓存）。

---

## 🪟 关于内置的 TranslucentTB

任务栏的真透明 / 亚克力效果由开源项目 [TranslucentTB](https://github.com/TranslucentTB/TranslucentTB) 实现，星叙在 `app/ttb/` 中附带了它的**未经修改的便携版**（2026.2，提交 d4636e4）。

星叙与它的关系：

- TranslucentTB 作为**独立进程**运行，星叙不注入、不修改它的代码；
- 星叙只负责把你在「任务栏美化」里的选择写成 TranslucentTB 的 `settings.json`，TranslucentTB 会实时读取并生效；
- 如果检测到你已经安装了 TranslucentTB（如微软商店版），星叙会**优先复用它**，并先备份它原来的配置，退出时还原；
- 没有安装时，使用内置便携版，只在「任务栏美化」开启时运行，关闭或退出时结束；
- 显示器变化后 TranslucentTB 有时只接管主屏，星叙会自动重写配置并重启它，尝试恢复副屏效果；
- 找不到任何 TranslucentTB 时，退回到系统强调色方式给任务栏着色（只有纯色效果）。

TranslucentTB 版权归其贡献者所有，遵循 **GPL-3.0**，许可全文见 `app/ttb/LICENSE.md`，对应源代码见 <https://github.com/TranslucentTB/TranslucentTB/tree/d4636e4>。星叙的非商业条款**不适用于** TranslucentTB 本身。

---

## 🛠 从源码运行

```powershell
git clone https://github.com/Xueluoa1/xingxu.git xingxu
cd xingxu
# 1. 下载 Electron 43 x64 运行时，解压到 electron\ 目录
# 2. 安装依赖
cd app; npm install; cd ..
# 3. 启动
.\electron\electron.exe .\app
```

调试：设置环境变量 `XX_DEBUG=1` 会输出日志；`XX_UD=<目录>` 可使用独立的数据目录，不影响正在使用的配置。

### 打包安装程序
```powershell
# 把 app 复制到 dist\XingXu\resources\app，并放入 Electron 运行时（重命名为 XingXu.exe）
powershell -File build\installer\zip.ps1 -src dist\XingXu -dst build\installer\out\payload.zip
bash build/installer/build.sh      # 用系统自带的 csc 编译 C# 安装程序
```

---

## 🗂 目录结构

```
app/
├── main.js        主进程：窗口、状态、天气、歌词、任务栏
├── ttb.js         控制 TranslucentTB（写配置、启动、自愈、还原）
├── tbcolor.js     系统深浅色与强调色（无 TranslucentTB 时的退路）
├── native.js      Win32 调用（koffi）
├── media.ps1      读取系统媒体信息（SMTC）
├── preload.js / broadcast.js
├── ttb/           内置 TranslucentTB 便携版（GPL-3.0）
└── ui/            控制中心 cc*、桌面插件 desk*、任务栏挂件 bar*
build/
├── gen-icon.js
└── installer/     C# 安装 / 卸载程序
```

---

## 📄 许可

- **星叙自身的代码、界面与文档**：[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.zh-hans)（署名-非商业性使用）。
  可以自由使用、修改、转载，但须署名「雪落a」并注明出处，**不得用于商业用途**。需要商业授权请到 [xueluo.online](https://xueluo.online) 联系作者。
- **TranslucentTB**（`app/ttb/`）：GPL-3.0，版权归 TranslucentTB 贡献者。
- **Electron**、**koffi**：MIT。

完整说明见 [LICENSE](LICENSE)。

> 说明：CC BY-NC 不是 OSI 认可的"开源许可证"，这里的"开源"指源代码完全公开、可自由学习和修改。

---

## 🙏 致谢

- [TranslucentTB](https://github.com/TranslucentTB/TranslucentTB) — 任务栏透明 / 亚克力效果
- [Electron](https://www.electronjs.org/) · [koffi](https://koffi.dev/)
- 歌词数据：网易云音乐、[LRCLIB](https://lrclib.net/) · 天气数据：[Open-Meteo](https://open-meteo.com/)

---

<div align="center">

作者 **雪落a** · B站 **雪落a77** · [xueluo.online](https://xueluo.online)

觉得好用的话，点个 ⭐ Star 支持一下～

</div>
