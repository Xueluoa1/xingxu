function pageTaskbar(){const t=S.tb,r=ENV.tb;
  return `<h2>任务栏美化</h2>
  <div class="card">${set('','启用任务栏美化','关闭后立即回到 Windows 原来的外观',sw('on.tb',S.on.tb))}</div>
  <div class="card note"><i class="i">&#xE946;</i><div>星叙通过内置的 TranslucentTB 给任务栏做真透明 / 亚克力与着色，切换即时生效，主屏和副屏一起生效；检测到你已安装的 TranslucentTB 会优先复用。
    TranslucentTB 只改任务栏背景，不改上面图标和时钟的颜色；深色背景看不清时可打开下方的开关同时切系统深色。关闭美化、退出或卸载星叙时会自动还原。${S.on.tb&&r?`<br><b>当前效果：</b>${({translucent:'亚克力',clear:'全透明'})[r.fill]||'纯色'}${r.color&&r.fill!=='clear'?' · '+r.color:''}`:''}</div></div>
  <h3>美化样式</h3>
  <div class="grid g4">${Object.entries(TB_NAMES).filter(([k])=>TB_PRESET[k]).map(([k,[n,d]])=>`<div class="pcard ${t.style===k?'on':''}" data-tbs="${k}" style="text-align:left"><div class="sw-c" style="background:${TB_PRESET[k].c1}"></div><b>${n}</b><div class="muted" style="margin-top:4px">${d}</div></div>`).join('')}</div>
  <h3>颜色与透明度</h3>
  <div class="card">
    ${set('','填充方式','全透明可直接看到壁纸；亚克力为磨砂玻璃',seg('tb.fill',{solid:'纯色',translucent:'亚克力',clear:'全透明'},['translucent','clear'].includes(t.fill)?t.fill:'solid'))}
    ${set('','任务栏颜色','',col('tb.c1',t.c1))}
    ${['translucent','clear'].includes(t.fill)?set('',t.fill==='clear'?'颜色浓度':'透明度',t.fill==='clear'?'0 = 完全透明；调高可给任务栏叠一层淡淡的颜色':'数值越小越透',rng('tb.op',t.op==null?(t.fill==='clear'?0:60):t.op,0,100,'%')):''}
    ${set('','同时切换系统深色模式','深色样式下让图标时钟变白；开始菜单等会随之变深，切换会慢几秒',sw('settings.tbSysTheme',!!S.settings.tbSysTheme))}
    ${set('','全屏 / 最大化时恢复 Windows 默认','哪块屏幕上有全屏或最大化的窗口，只有那块屏幕的任务栏恢复为 Windows 原来的外观，其他屏幕保持当前样式',sw('settings.tbFullNormal',S.settings.tbFullNormal!==false))}
  </div>
  <h3>快速配色</h3>
  <div class="chips">${[['星夜紫','#2a1f6e'],['极光','#0f4c5c'],['落日','#b4446c'],['深海','#0b1d3a'],['墨绿','#1f3d2b'],['纯黑','#000000']].map(([n,a])=>`<span class="chip" data-pal="${a}"><i style="width:14px;height:14px;border-radius:50%;background:${a}"></i>${n}</span>`).join('')}</div>
  <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${S.on.tb?`<button class="btn" data-b="tbHeal"><i class="i">&#xE72C;</i>副屏没变？重新应用到全部屏幕</button>`:''}<button class="btn dan" data-b="tbDefault"><i class="i">&#xE777;</i>恢复系统默认外观</button></div>`;
}
function pageTbw(){const w=S.tbw.find(x=>x.id===selT);
  let h=`<h2>任务栏挂件</h2>
  <div class="card">${set('','显示任务栏挂件','挂件显示在任务栏空白处，点击挂件以外的位置不受影响',sw('on.tbw',S.on.tbw))}
    ${set('&#xE7F4;','显示在','选择主屏或扩展屏的任务栏；扩展屏需在 Windows 设置中开启「在所有显示器上显示任务栏」',dispPick('settings.tbwDisp',S.settings.tbwDisp))}</div>
  <h3>挂件库 <span class="muted" style="font-weight:400">— 点击添加到右侧区</span></h3>
  <div class="chips">${Object.entries(TWTYPES).map(([k,t])=>`<span class="chip" data-tadd="${k}"><i class="i">${t.ic}</i>${t.n}<i class="i" style="font-size:10px;opacity:.6">&#xE710;</i></span>`).join('')}</div>
  <h3>位置与顺序 <span class="muted" style="font-weight:400">— 拖动调整顺序或移动到另一侧</span></h3>
  <div class="zones z2">${[['left','左侧区（开始按钮左侧空白）','l'],['right','右侧区（托盘左侧）','r']].map(([z,n,o])=>`<div class="zone" data-zone="${z}"><h4>${n}</h4>${S.tbw.filter(x=>x.zone===z).map(x=>`<div class="zi ${x.id===selT?'on':''}" draggable="true" data-tid="${x.id}"><i class="i">${TWTYPES[x.type].ic}</i>${TWTYPES[x.type].n}<i class="i x" data-tdel="${x.id}">&#xE8BB;</i></div>`).join('')}
    <div class="zoff muted">距边缘 ${rng('tbOff.'+o,S.tbOff[o]||0,0,800,'px')}</div></div>`).join('')}</div>`;
  if(w)h+=`<h3>挂件设置 · ${TWTYPES[w.type].n}</h3><div class="card">
    ${set('','显示形式','',sel('t.form',Object.entries(TWTYPES[w.type].forms),w.form))}
    ${set('','宽度','0 = 自动',rng('t.width',w.width,0,400,'px'))}
    ${set('','文字颜色','默认自动适配任务栏深浅',col('t.tc',w.tc||(ENV.tb&&!ENV.tb.light&&S.on.tb?'#ffffff':ENV.sysLight?'#16181b':'#ffffff'))+(w.tc?`<button class="btn sm" data-b="tcAuto">自动</button>`:''))}
    ${set('','背景透明度','0 = 完全透明，融入任务栏',rng('t.bo',w.bo,0,60,'%'))}
    ${set('','字体','',sel('t.font',FONTS,w.font))}
    ${w.type==='weather'?set('','城市','从列表选择或直接输入；留空则使用「设置」中的默认城市',city('t.city',w.city,'默认：'+(S.settings.city||'未设置'))):''}
    ${w.type==='notify'?set('','图标','',`<div class="icpick">${NOTIFY_ICONS.map(([c,n])=>`<b data-nic="${c}" class="${NOTIFY_IC(w)===c?'on':''}" title="${n}"><i class="i">${c}</i></b>`).join('')}</div>`)+
      set('','图标颜色','',col('t.icc',w.icc||'#f5c26b')+(w.icc?`<button class="btn sm" data-b="iccAuto">默认</button>`:''))+
      set('','数量颜色','「N 项」的颜色',col('t.nc',w.nc||'#f5c26b')+(w.nc?`<button class="btn sm" data-b="ncAuto">默认</button>`:'')):''}
    ${w.type==='lyric'?set('','歌词动效','滚动、渐变、高亮效果在「音乐歌词」页设置',`<button class="btn sm" data-goto="music">前往</button>`):''}
    </div><div style="margin-top:10px"><button class="btn dan" data-tdel="${w.id}"><i class="i">&#xE74D;</i>删除此挂件</button></div>`;
  else h+=`<p class="muted" style="margin-top:12px">提示：点击上方列表中的挂件，或右键任务栏上的挂件进行编辑。Windows 11 的应用图标默认居中，若挂件与图标重叠，可调整「距边缘」或把任务栏对齐方式设为靠左。</p>`;
  return h;
}
function pageMusic(){const L_=S.ly,m=LIVE.media,ly=LIVE.lyr;
  return `<h2>音乐歌词</h2>
  <div class="card np">${cover(m,m&&m.playing?'spin':'')}
    <div style="flex:1;min-width:0"><b style="font-size:15px">${m?esc(m.title):'未在播放'}</b> <span class="muted">${m?esc(m.artist||''):''}</span><div id="ccLine" style="color:var(--gold);margin:6px 0;min-height:18px"></div>
    <div class="row"><div class="prog" style="flex:1"><i id="ccProg"></i></div><span class="muted" id="ccPt" style="font-size:11.5px"></span></div></div>
    <div class="ctl" style="font-size:18px;gap:18px;margin-left:10px"><i class="i" data-m="prev">${IC.prev}</i><i class="i" data-m="play">${m&&m.playing?IC.pause:IC.play}</i><i class="i" data-m="next">${IC.next}</i></div></div>
  <h3>歌词与播放信息来源 <span class="muted" style="font-weight:400">— 按顺序自动降级</span></h3>
  <div class="card"><ul class="src">
    <li><span class="n">1</span>读取系统媒体信息（SMTC）<span class="s ${m?'ok':'wait'}">${m?`<i class="i">${IC.check}</i> 已识别：${esc(appName(m.app))}`:'等待播放'}</span></li>
    <li><span class="n">2</span>本地绑定的歌词文件（.lrc）<span class="s">${ly.src==='本地绑定'?`<span class="ok"><i class="i">${IC.check}</i> 正在使用</span> `:''}<button class="btn sm" data-b="bindLrc"><i class="i">&#xE8E5;</i>为当前歌曲选择文件</button></span></li>
    <li><span class="n">3</span>在线歌词搜索与自动匹配（网易云音乐 / LRCLIB）<span class="s ${ly.total?'ok':'wait'}">${!m?'等待播放':ly.searching?'正在搜索…':ly.total?`<i class="i">${IC.check}</i> ${esc(ly.src)}（${LIVE.lines.length} 行）`:'未找到歌词'}</span></li>
  </ul>
  <div class="row" style="margin-top:10px"><button class="btn sm" data-b="search" ${ly.total>1?'':'disabled'}><i class="i">&#xE721;</i>换一个版本${ly.total>1?`（${ly.idx+1}/${ly.total}）`:''}</button><div class="sp"></div><span class="muted">时间偏移</span><button class="btn sm" data-b="off-">-0.5s</button><span class="val" style="width:52px;text-align:center">${L_.offset>0?'+':''}${L_.offset.toFixed(1)}s</span><button class="btn sm" data-b="off+">+0.5s</button></div></div>
  <h3>桌面歌词插件</h3><div class="card">
    ${set('','启用桌面歌词','',sw('on.dlyric',S.on.dlyric))}
    ${set('','显示模式','',seg('ly.mode',{full:'完整歌词',double:'双行',single:'单行'},L_.mode))}
    ${set('','对齐','',seg('ly.align',{left:'左对齐',center:'居中'},L_.align))}
    ${set('','字号','',rng('ly.fs',L_.fs,11,34,'px'))}
    ${set('','歌词颜色','普通行 / 当前行',col('ly.c',lyC(false))+' '+col('ly.hc',lyH(false))+(L_.c||L_.hc?` <button class="btn sm" data-b="lyAuto">自动</button>`:''))}
    ${set('','透明度','',rng('ly.op',L_.op,20,100,'%'))}
    ${set('','置顶显示','显示在所有窗口之上',sw('ly.top',L_.top))}
  </div>
  <h3>任务栏歌词挂件</h3><div class="card">
    ${set('','启用任务栏歌词','',sw('on.tlyric',S.on.tlyric))}
    ${set('','歌词动效','可多选',[['scroll','滚动'],['fade','渐变'],['hl','高亮']].map(([k,n])=>`<span class="chk ${L_.effects[k]?'on':''}" data-ck="ly.effects.${k}"><i class="i">${L_.effects[k]?IC.check:''}</i>${n}</span>`).join(''))}
    <p class="muted">滚动：歌词过长时跑马灯滚动 · 渐变：换行时淡入 · 高亮：随进度逐字高亮（高亮色 = 当前行颜色）</p>
  </div>`;
}
const APPS={cloudmusic:'网易云音乐',qqmusic:'QQ 音乐',kugou:'酷狗音乐',kwmusic:'酷我音乐',spotify:'Spotify',chrome:'Chrome',msedge:'Edge',firefox:'Firefox',zunemusic:'媒体播放器',foobar2000:'foobar2000',potplayer:'PotPlayer'};
function appName(id){id=String(id||'');const k=Object.keys(APPS).find(k=>id.toLowerCase().includes(k));return k?APPS[k]:(id.split(/[\\!]/).pop().replace(/\.exe$/i,'')||'音乐播放器')}
function pageSettings(){const st=S.settings;
  return `<h2>设置</h2><h3>常规</h3>
  <div class="card">${set('','开机自启动','登录 Windows 后在后台启动',sw('settings.auto',st.auto))}
    ${set('','默认天气城市','未单独指定城市的天气插件与挂件都使用这里；可从列表选择或输入中文 / 拼音',city('settings.city',st.city,'例如：深圳、Beijing'))}</div>
  <h3>性能</h3><div class="card">${set('','全屏应用时暂停','游戏、视频全屏时隐藏置顶插件并停止刷新',sw('settings.fullpause',st.fullpause))}
    ${set('','玻璃磨砂效果','玻璃风格插件按壁纸绘制磨砂背景；关闭后为纯透明',sw('settings.frost',st.frost!==false))}
    ${set('','磨砂背景来源','用动态壁纸（Wallpaper Engine 等）时系统读到的是旧的静态壁纸，可在此指定一张图片作为磨砂背景',(st.frostImg?`<button class="btn sm" data-b="frostUp">更换图片</button><button class="btn sm" data-b="frostReset">改回系统壁纸</button>`:`<button class="btn sm" data-b="frostUp"><i class="i">&#xE898;</i>选择图片</button>`))}</div>
  <h3>快捷键</h3><div class="card">
    ${set('','显示 / 隐藏全部插件','','<span class="kbd">Alt + Shift + D</span>')}
    ${set('','开关任务栏美化','','<span class="kbd">Alt + Shift + T</span>')}
    ${set('','锁定 / 解锁桌面歌词','','<span class="kbd">Alt + Shift + L</span>')}</div>
  <h3>备份</h3><div class="card"><div class="row" style="min-height:44px"><button class="btn" data-b="export"><i class="i">&#xEDE1;</i>导出配置</button><button class="btn" data-b="import"><i class="i">&#xE8B5;</i>导入配置</button><div class="sp"></div><button class="btn dan" data-b="reset"><i class="i">&#xE777;</i>恢复默认</button></div></div>
  <h3>关于</h3><div class="card"><div class="row"><div class="logo" style="width:40px;height:40px;font-size:20px;border-radius:10px">✦</div><div style="flex:1"><b>星叙 XingXu</b> <span class="muted">v${ENV.version}</span><div class="muted">让桌面有光，让旋律被看见。 · 作者 雪落a · <a class="lnk" data-url="https://xueluo.online">xueluo.online ↗</a></div></div>
    <button class="btn" data-b="quit"><i class="i">&#xE7E8;</i>退出星叙</button></div>
    <div class="muted" style="margin-top:10px;font-size:12px">任务栏透明效果由开源项目 <a class="lnk" data-url="https://github.com/TranslucentTB/TranslucentTB">TranslucentTB</a>（GPL-3.0）提供。</div></div>`;
}
function renderPage(){
  const P=$('#page');
  P.innerHTML={home:pageHome,widgets:pageWidgets,taskbar:pageTaskbar,tbw:pageTbw,music:pageMusic,settings:pageSettings}[page]();
  liveTick();
}
