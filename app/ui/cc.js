/* =================== 控制中心 =================== */
const NAV=[['home','','概览'],['widgets','','桌面插件'],['taskbar','','任务栏美化'],['tbw','','任务栏挂件'],['music','','音乐歌词'],['settings','','设置']];
let page='home',selW=null,selT=null;
function renderNav(){$('#nav').innerHTML=NAV.map(([k,ic,n])=>`<a data-go="${k}" class="${page===k?'on':''}"><i class="i">${ic}</i>${n}</a>`).join('')+`<div class="slogan">让桌面有光，<br>让旋律被看见。</div>`}
function go(p){p=p||'home';const [pg,id]=p.split(':');page=NAV.some(n=>n[0]===pg)?pg:'home';
  if(id&&page==='widgets')selW=id;if(id&&page==='tbw')selT=id;renderNav();renderPage();$('#page').scrollTop=0}
$('#nav').addEventListener('click',ev=>{const a=ev.target.closest('[data-go]');if(a)go(a.dataset.go)});
document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>X.win(b.dataset.act));
// 控制中心外观始终跟随全局样式预设
const CC_CLASS={classic:'th-light',neu:'th-light th-neu',dark:'',glass:'th-glassy th-g1',glass2:'th-light th-glassy th-g2',minimal:'th-light th-minimal',indigo:'th-light th-indigo',mono:'th-light th-mono'};
const CC_ALL=[...new Set(Object.values(CC_CLASS).join(' ').split(' ').filter(Boolean))];
function applyTheme(){const cc=$('#cc');cc.classList.remove(...CC_ALL);(CC_CLASS[S.preset]||'').split(' ').filter(Boolean).forEach(c=>cc.classList.add(c))}

const sw=(k,on)=>`<div class="sw ${on?'on':''}" data-sw="${k}"></div>`;
const seg=(k,opts,v)=>`<div class="seg" data-seg="${k}">${Object.entries(opts).map(([a,b])=>`<b data-v="${a}" class="${a===v?'on':''}">${b}</b>`).join('')}</div>`;
const rng=(k,v,min,max,unit='')=>`<input type="range" data-rg="${k}" min="${min}" max="${max}" value="${v}"><span class="val" data-rv="${k}">${v}${unit}</span>`;
const col=(k,v)=>`<input type="color" data-col="${k}" value="${v}">`;
// 城市：可从常用城市列表选择，也可直接输入；ph 为留空时的提示
const city=(k,v,ph)=>`<span class="cbox"><input class="tin city" data-city="1" data-txt="${k}" value="${esc(v||'')}" placeholder="${esc(ph)}" spellcheck="false" autocomplete="off"><span class="csug"></span></span>`;
const dispName=d=>d.primary?`主屏（${d.w}×${d.h}）`:`扩展屏 ${d.no}${d.label?' · '+d.label:''}（${d.w}×${d.h}）`;
function dispPick(k,v){const L=ENV.displays||[];if(!L.find(d=>d.id===v))v='primary';
  return L.length>1?sel(k,L.map(d=>[d.id,dispName(d)]),v):'<span class="muted">未检测到扩展屏</span>'}
const sel=(k,opts,v)=>`<select data-sel="${k}">${opts.map(o=>Array.isArray(o)?o:[o,o]).map(([a,b])=>`<option value="${a}" ${a==v?'selected':''}>${b}</option>`).join('')}</select>`;
const set=(ic,lab,sub,ctl)=>`<div class="set">${ic?`<i class="i ii">${ic}</i>`:''}<div class="lab">${lab}${sub?`<small>${sub}</small>`:''}</div>${ctl}</div>`;
const presetCards=(k,v)=>`<div class="grid g4">${Object.entries(PRESETS).map(([p,n])=>`<div class="pcard ${p===v?'on':''}" data-pre="${k}" data-v="${p}"><div class="pv"><div class="p-${p}"><i class="i">&#xE823;</i>&nbsp;12:30</div></div>${n}</div>`).join('')}</div>`;
const cover=(m,cls='')=>`<div class="cover ${cls}" style="background:${m&&m.thumbUrl?`center/cover url(&quot;${m.thumbUrl}&quot;)`:'linear-gradient(135deg,#ff6b9a,#6c5ce7 60%,#2ec5ff)'}">${m&&m.thumbUrl?'':'<i class="i">&#xEC4F;</i>'}</div>`;
const TB_NAMES={classic:['经典','浅灰实底，接近系统风格'],glass:['玻璃','深色亚克力半透明'],glass2:['玻璃2','浅色亚克力半透明'],dark:['深色','深色纯色，适配深色壁纸'],minimal:['素白','纯白实底'],indigo:['靛蓝','靛蓝纯色']};

function pageHome(){
  const vis=S.widgets.filter(w=>w.vis).length,m=LIVE.media;
  return `<h2>概览<span class="pill">● 运行中</span></h2>
  <div class="grid g4" style="margin-bottom:14px">
    <div class="stat"><i class="i si">&#xE80A;</i><span class="muted">桌面插件</span><b class="num">${vis} / ${S.widgets.length}</b><span class="muted">已显示</span></div>
    <div class="stat"><i class="i si">&#xE790;</i><span class="muted">任务栏美化</span><b>${S.on.tb?(TB_NAMES[S.tb.style]||[])[0]||'自定义':'系统默认'}</b><span class="muted">${S.on.tb?({translucent:'亚克力',clear:'全透明'}[S.tb.fill]||'纯色'):'已关闭'}</span></div>
    <div class="stat"><i class="i si">&#xE7C4;</i><span class="muted">任务栏挂件</span><b class="num">${S.tbw.length}</b><span class="muted">个挂件</span></div>
    <div class="stat"><i class="i si">&#xE771;</i><span class="muted">全局样式</span><b>${PRESETS[S.preset]}</b><span class="muted">预设</span></div>
  </div>
  <h3>功能开关</h3>
  <div class="card">${set('','桌面插件','在桌面显示所有插件（Alt+Shift+D）',sw('on.widgets',S.on.widgets))}</div>
  <div class="card">${set('','任务栏美化','透明 / 亚克力 / 纯色任务栏，主副屏同时生效；关闭或退出星叙时自动还原（Alt+Shift+T）',sw('on.tb',S.on.tb))}</div>
  <div class="card">${set('','任务栏挂件','在任务栏空白区显示挂件，不影响原有操作',sw('on.tbw',S.on.tbw))}</div>
  <div class="grid g2"><div class="card">${set('','桌面歌词','完整歌词插件',sw('on.dlyric',S.on.dlyric))}</div><div class="card">${set('','任务栏歌词','单行歌词挂件',sw('on.tlyric',S.on.tlyric))}</div></div>
  <h3>全局样式预设 <span class="muted" style="font-weight:400">— 插件与控制中心跟随此预设；「应用到全部」同时设置任务栏</span></h3>
  ${presetCards('global',S.preset)}
  <div style="margin-top:10px;display:flex;gap:8px"><button class="btn pri" data-b="applyAll"><i class="i">&#xE771;</i>应用到全部插件、任务栏与控制中心</button></div>
  <h3>正在播放</h3>
  <div class="card np">${cover(m)}<div style="flex:1;min-width:0"><b style="font-size:15px">${m?esc(m.title):'未在播放'}</b> <span class="muted">${m?esc(m.artist||''):'打开任意支持系统媒体控制的音乐软件即可识别'}</span><div id="ccLine" style="color:var(--gold);margin:6px 0;min-height:18px"></div><div class="prog"><i id="ccProg"></i></div></div></div>`;
}
function pageWidgets(){
  const w=S.widgets.find(x=>x.id===selW);
  let h=`<h2>桌面插件</h2>
  <div class="card">${set('&#xE7F4;','显示在','桌面插件整体显示在哪块屏幕上；扩展屏断开时自动回到主屏',dispPick('settings.deskDisp',S.settings.deskDisp))}</div>
  <div class="card">${set('&#xE72E;','锁定全部插件','开启后所有插件都不能拖动或缩放，防止误碰；关闭后恢复为各自的锁定状态',`<div class="sw ${S.settings.lockAll?'on':''}" data-b="lockAll"></div>`)}</div>
  <p class="muted" style="margin:8px 2px 0;font-size:12px">拖动插件时会自动吸附屏幕边缘、中线和附近插件（出现粉色虚线）；按住 Shift 只横向或纵向移动，按住 Alt 不吸附。</p>
  <h3>插件库</h3><div class="lib">${Object.entries(WTYPES).map(([k,t])=>`<div class="it"><div class="g" style="background:${t.c}"><i class="i">${t.ic}</i></div><div><b>${t.n}</b><small>${t.d}</small></div><button class="btn sm add" data-add="${k}"><i class="i">&#xE710;</i></button></div>`).join('')}</div>
  <h3>已添加（${S.widgets.length}）<span class="muted" style="font-weight:400">— 点击选择后在下方编辑样式；也可以直接在桌面上右键插件</span></h3>
  <div class="card wlist" style="padding:6px">${S.widgets.map(x=>`<div class="r ${x.id===selW?'on':''}" data-pick="${x.id}"><i class="i" style="color:${WTYPES[x.type].c}">${WTYPES[x.type].ic}</i><span class="nm">${WTYPES[x.type].n} <span class="muted">· ${PRESETS[effPreset(x)]}${x.s.preset?'':'（跟随全局）'}</span></span>
    <span class="ibtn ${x.vis?'':'off'}" data-wt="vis" title="显示/隐藏"><i class="i">${x.vis?IC.eye:IC.eyeOff}</i></span>
    <span class="ibtn ${x.top?'on':''}" data-wt="top" title="置顶 / 桌面层"><i class="i">&#xE718;</i></span>
    <span class="ibtn ${x.lock?'on':''}" data-wt="lock" title="锁定位置"><i class="i">&#xE72E;</i></span>
    <span class="ibtn" data-wt="del" title="移除"><i class="i">&#xE74D;</i></span></div>`).join('')||'<div class="muted" style="padding:10px">还没有插件，从上方插件库添加一个吧</div>'}</div>`;
  if(!w)return h;
  const s=w.s;
  return h+`<h3>样式编辑 · ${WTYPES[w.type].n}</h3>
    ${w.type==='photo'?'':presetCards('w',effPreset(w))}
    <div class="card" style="margin-top:8px">
    ${w.type==='photo'?'':set('','透明度','背景不透明度',rng('w.op',s.op,0,100,'%'))}
    ${w.type==='clock'||w.type==='weather'||w.type==='photo'?'':set('','强调色','进度条、高亮、勾选框颜色；默认跟随预设',col('w.ac',s.ac||PRESET_AC[effPreset(w)])+(s.ac?`<button class="btn sm" data-b="acReset">跟随预设</button>`:''))}
    ${w.type==='photo'?'':set('','背景色','留空则使用预设背景',col('w.bg',s.bg||'#1e1b3a')+(s.bg?`<button class="btn sm" data-b="bgReset">使用预设</button>`:''))}
    ${w.type==='photo'?'':set('','字体','',sel('w.font',FONTS,s.font))}
    ${w.type==='photo'?'':set('','字号','',rng('w.fs',s.fs,70,160,'%'))}
    ${set('','圆角','',rng('w.r',s.r??PRESET_R[effPreset(w)],0,40,'px'))}
    ${set('','层级','置顶显示在所有窗口之上，或贴在桌面层',seg('w.top',{false:'桌面层',true:'置顶显示'},String(w.top)))}
    ${set('','尺寸','宽 × 高（像素），也可拖动插件右下角调整',`<input class="whin" type="number" data-wh="w" min="80" step="10" value="${Math.round(w.w)}"> × <input class="whin" type="number" data-wh="h" min="70" step="10" value="${Math.round(w.h)}">`)}
    ${set('',w.type==='photo'?'图片':'图片填充',w.type==='photo'?'图片铺满整个相框，不叠加文字或遮罩':s.img?'上传的图片铺满插件背景':'上传本地图片作为插件背景',s.img?seg('w.fit',{stretch:'拉伸填充',cover:'裁切填充'},s.fit==='stretch'?'stretch':'cover')+(s.fit!=='stretch'&&s.iw?` <button class="btn sm" data-b="crop">调整裁剪</button>`:'')+` <button class="btn sm" data-b="imgUp">更换</button><button class="btn sm" data-b="imgDel">移除</button>`:`<button class="btn sm" data-b="imgUp"><i class="i">&#xE898;</i>上传图片</button>`)}
    ${w.type==='photo'?set('','绑定路径',w.link?'双击相框打开：'+esc(w.link.p):'可选：绑定后双击相框打开程序、文件或文件夹；不绑定则只展示图片',`<input class="tin" data-lnk="1" value="${esc(w.link?w.link.p:'')}" placeholder="粘贴路径，或点右侧选择" spellcheck="false" style="width:200px"> <button class="btn sm" data-b="lnkPick">选择…</button>${w.link?'<button class="btn sm" data-b="lnkDel">解除</button>':''}`):''}
    ${s.img&&!(w.type==='photo')?set('','图片遮罩','加深/提亮图片，保证文字清晰',rng('w.imgDim',s.imgDim??25,0,80,'%')):''}
    ${w.type==='clock'?set('','时间格式','',seg('clock.h24',{true:'24 小时',false:'12 小时'},String(S.clock.h24))+'&nbsp;'+`<span class="chk ${S.clock.sec?'on':''}" data-ck="clock.sec"><i class="i">${S.clock.sec?IC.check:''}</i>显示秒</span>`):''}
    ${w.type==='launch'||w.type==='sysentry'?set('','排列方向',w.type==='launch'?'把桌面快捷方式或文件拖进 Dock 即可添加，自动均分间距':'',seg('w.dir',{h:'横向排列',v:'纵向排列'},w.s.dir==='v'?'v':'h')):''}
    ${w.type==='sys'?set('','显示项','',Object.entries({cpu:'CPU',mem:'内存',disk:'磁盘',net:'网络'}).map(([k,n])=>`<span class="chk ${S.sysItems[k]?'on':''}" data-ck="sysItems.${k}"><i class="i">${S.sysItems[k]?IC.check:''}</i>${n}</span>`).join('')):''}
    ${w.type==='lyrics'?set('','歌词样式','字号、颜色、模式等请在「音乐歌词」页调整',`<button class="btn sm" data-goto="music">前往</button>`):''}
    ${w.type==='weather'?set('','城市','从列表选择或直接输入；留空则使用「设置」中的默认城市',city('w.city',w.city,'默认：'+(S.settings.city||'未设置'))):''}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn pri" data-b="syncAll"><i class="i">&#xE8C8;</i>样式应用到全部插件</button><button class="btn" data-b="wReset">恢复默认</button></div>`;
}
