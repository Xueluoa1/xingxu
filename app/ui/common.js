/* =================== 公共：常量、工具、状态与实时数据 =================== */
const $=s=>document.querySelector(s);
const X=window.xx;
const PRESETS={classic:'经典',neu:'拟态',glass:'玻璃',glass2:'玻璃2',dark:'深色',minimal:'素白',indigo:'靛蓝',mono:'墨白'};
const PRESET_AC={classic:'#6c5ce7',neu:'#7c83db',glass:'#a99bff',glass2:'#3fbf7f',dark:'#8b7bff',minimal:'#22c55e',indigo:'#c7d2fe',mono:'#111111'};
const PRESET_R={classic:14,neu:26,glass:18,glass2:18,dark:14,minimal:22,indigo:16,mono:10};
// 任务栏：系统只支持纯色或系统半透明；浅色会切换为系统浅色任务栏
// 任务栏样式：TranslucentTB 每种状态只能是一种颜色 + 一种效果（纯色 / 亚克力 / 全透明），
// 拟态柔光、渐变无法实现，墨白与深色在任务栏上完全相同，因此只保留下面这些
const TB_PRESET={classic:{fill:'solid',c1:'#e9e9f2'},glass:{fill:'translucent',c1:'#2b2840',op:55},glass2:{fill:'translucent',c1:'#f6f8fa',op:68},dark:{fill:'solid',c1:'#111116'},minimal:{fill:'solid',c1:'#ffffff'},indigo:{fill:'solid',c1:'#3730a3'}};
// 全局样式 → 任务栏样式（任务栏不支持的样式用最接近的代替）
const TB_STYLE=p=>TB_PRESET[p]?p:({neu:'classic',mono:'dark'})[p]||'classic';
const FONTS=['Microsoft YaHei UI','SimSun','KaiTi','FangSong','Segoe UI','Consolas'];
const WTYPES={
  clock:{n:'时间与日期',ic:'',c:'#6c5ce7',d:'当前时间、日期、星期',w:300,h:140},
  weather:{n:'天气',ic:'',c:'#f0a030',d:'当前天气与未来 5 天趋势，城市可在设置中修改',w:300,h:180},
  sys:{n:'系统状态',ic:'',c:'#2fbf8f',d:'CPU、内存、磁盘、网络实时占用',w:300,h:190},
  music:{n:'音乐信息',ic:'',c:'#e6393f',d:'自动识别正在播放的音乐，可切歌、暂停',w:360,h:150},
  lyrics:{n:'歌词显示',ic:'',c:'#ff6b9a',d:'自动匹配歌词，随播放进度滚动',w:360,h:300},
  todo:{n:'待办',ic:'',c:'#3a8ee6',d:'快速记事、勾选完成或删除',w:300,h:250},
  launch:{n:'快捷启动',ic:'',c:'#8a63d2',d:'Dock 栏：把桌面快捷方式或文件拖进来，自动均分间距；可添加多个',w:420,h:96},
  organizer:{n:'收纳盒',ic:'\uE8B7',c:'#347a82',d:'拖入文件、程序或快捷方式，双击图标打开；随盒子尺寸自动排列',w:320,h:320},
  calendar:{n:'日历',ic:'',c:'#e57a3a',d:'月历视图，周末标识',w:300,h:290},
  fps:{n:'FPS 显示',ic:'',c:'#e0457b',d:'桌面插件层的实时帧率与帧耗时',w:250,h:150},
  photo:{n:'相框',ic:'\uE91B',c:'#d9822b',d:'放一张图片铺满插件；可绑定程序 / 文件 / 文件夹，双击打开',w:300,h:220},
  sysentry:{n:'系统功能入口',ic:'',c:'#607080',d:'回收站、此电脑、系统设置、下载、控制面板',w:320,h:96},
};
const TWTYPES={
  time:{n:'时间显示',ic:'',forms:{'icon-text':'图标+文字',text:'纯文字'}},
  date:{n:'日期显示',ic:'',forms:{'icon-text':'图标+文字',text:'纯文字'}},
  weather:{n:'天气信息',ic:'',forms:{'icon-text':'图标+文字',text:'纯文字'}},
  lyric:{n:'歌词短句',ic:'',forms:{lyric:'仅显示歌词','icon-text':'图标+歌词'}},
  sys:{n:'系统资源',ic:'',forms:{'icon-text':'图标+数字',text:'纯文字'}},
  notify:{n:'待办提醒',ic:'',forms:{'icon-text':'图标+文字',text:'纯文字'}},
};
const SC={
  pc:{n:'此电脑',ic:'',bg:'#3a6ea5',p:'shell:MyComputerFolder'},bin:{n:'回收站',ic:'',bg:'#607080',p:'shell:RecycleBinFolder'},
  settings:{n:'设置',ic:'',bg:'#555a70',p:'ms-settings:'},dl:{n:'下载',ic:'',bg:'#c98a1a',p:'shell:Downloads'},
  cpanel:{n:'控制面板',ic:'',bg:'#4a6a5a',p:'control'},
};
const SYS_ITEMS=['bin','pc','settings','dl','cpanel'];
const IC={play:'',pause:'',prev:'',next:'',check:'',x:'',add:'',del:'',eye:'',eyeOff:'',pin:'',lock:'',img:'',crop:'',warn:'',style:'',edit:'',file:'',cc:''};

let _u=Date.now();function uid(){return 'k'+(_u++).toString(36)}
const pad=n=>String(n).padStart(2,'0');
const WK='日一二三四五六';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=s=>`${Math.floor(s/60)}:${pad(Math.floor(s%60))}`;
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`}
const lum=h=>{const v=parseInt(h.slice(1),16);return((v>>16)*.299+(v>>8&255)*.587+(v&255)*.114)};
// 解析 LRC；去掉开头的作词、作曲、编曲等制作信息行
const CREDIT=/^(作词|作曲|编曲|词|曲|制作人?|监制|混音|母带|和声|录音|吉他|贝斯|鼓|键盘|弦乐|出品|发行|OP|SP|Lyrics?|Composer|Arranger|Producer)\s*[:：]/i;
function parseLrc(t){const out=[];String(t||'').split(/\r?\n/).forEach(l=>{const m=[...l.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];const tx=l.replace(/\[[^\]]*\]/g,'').trim();m.forEach(x=>out.push({t:+x[1]*60+ +x[2],x:tx}))});return out.filter(o=>o.x&&!CREDIT.test(o.x)).sort((a,b)=>a.t-b.t)}
function effPreset(w){return w.s.preset||S.preset}
const LIGHT_PRESETS=['classic','glass2','minimal','mono','neu'];
const LY_HI={neu:'#5d64c9',minimal:'#111111',indigo:'#fde68a',mono:'#000000'};
function lyC(light){return S.ly.c||(light?'#2e3238':'#ffffff')}
function lyH(light){return S.ly.hc||(light?'#0f8a4c':'#f5c26b')}
const newStyle=()=>({preset:null,op:80,ac:null,bg:null,font:'Microsoft YaHei UI',fs:100,r:null});
function fmtRate(b){if(b<1024)return Math.round(b)+'B';if(b<1048576)return (b/1024).toFixed(b<10240?1:0)+'K';return (b/1048576).toFixed(1)+'M'}

/* ---- 状态：主进程持有，各窗口修改后提交，再由主进程广播给其他窗口 ---- */
let S=X.getState(),ENV=X.env();
const save=()=>X.setState(S);
function toast(ic,msg){const t=$('#toast');if(!t)return;const d=document.createElement('div');d.innerHTML=`<i class="i" style="color:#b9b2ff;font-size:15px">${ic}</i><span>${msg}</span>`;t.appendChild(d);setTimeout(()=>{d.style.transition='opacity .3s';d.style.opacity=0;setTimeout(()=>d.remove(),300)},2600)}

/* ---- 实时数据：媒体、歌词、系统、天气 ---- */
const LIVE={media:ENV.media||null,lyr:{lrc:'',src:'',total:0,searching:false},lines:[],sys:{cpu:0,mem:0,disk:0,down:0,up:0},wx:ENV.weathers||{},paused:false};
// 天气按城市分开：插件可单独指定城市，留空则跟随设置里的默认城市
const cityOf=w=>((w&&w.city)||S.settings.city||'').trim();
const wxFor=w=>LIVE.wx[cityOf(w)]||null;
const CITIES=['北京','上海','广州','深圳','杭州','南京','苏州','成都','重庆','武汉','西安','长沙','天津','郑州','青岛','厦门','福州','合肥','济南','沈阳','大连','哈尔滨','长春','石家庄','太原','南昌','昆明','贵阳','南宁','海口','三亚','兰州','西宁','银川','呼和浩特','乌鲁木齐','拉萨','宁波','无锡','佛山','东莞','珠海','香港','澳门','台北','东京','首尔','新加坡','伦敦','纽约'];
function mediaPos(){const m=LIVE.media;if(!m)return 0;let p=m.pos||0;if(m.playing)p+=(Date.now()-m.at)/1000;return m.dur>0?Math.min(p,m.dur):p}
function curLyricIndex(){const t=mediaPos()+(S.ly.offset||0);let i=-1;for(let k=0;k<LIVE.lines.length;k++)if(LIVE.lines[k].t<=t)i=k;return i}
X.onMedia(m=>{LIVE.media=m;window.onLive&&onLive('media')});
X.onLyrics(l=>{LIVE.lyr=l;LIVE.lines=parseLrc(l.lrc);window.onLive&&onLive('lyrics')});
X.onSys(s=>{LIVE.sys=s;window.onLive&&onLive('sys')});
X.onWeather(w=>{LIVE.wx[w.q]=w;window.onLive&&onLive('weather')});
X.onPause(p=>{LIVE.paused=p;window.onLive&&onLive('pause')});
X.onEnv(e=>{ENV=e;window.onLive&&onLive('env')});

// WMO 天气代码 → 图标与文字
function wx(code){
  const T=[[0,'☀','晴'],[1,'🌤','晴间多云'],[2,'⛅','多云'],[3,'☁','阴'],[45,'🌫','雾'],[48,'🌫','雾凇'],[51,'🌦','小毛毛雨'],[53,'🌦','毛毛雨'],[55,'🌧','大毛毛雨'],
    [61,'🌧','小雨'],[63,'🌧','中雨'],[65,'🌧','大雨'],[66,'🌧','冻雨'],[67,'🌧','冻雨'],[71,'🌨','小雪'],[73,'🌨','中雪'],[75,'❄','大雪'],[77,'🌨','雪粒'],
    [80,'🌦','阵雨'],[81,'🌧','强阵雨'],[82,'⛈','暴雨'],[85,'🌨','阵雪'],[86,'❄','强阵雪'],[95,'⛈','雷阵雨'],[96,'⛈','雷阵雨伴冰雹'],[99,'⛈','强雷阵雨']];
  let r=T[0];for(const x of T)if(x[0]<=code)r=x;return{e:r[1],t:r[2]}}
const WEEK=d=>'周'+WK[new Date(d+'T00:00').getDay()];

/* 相框绑定路径：{p 路径, n 名称, icon 图标}；未绑定为 null */
async function linkOf(p){p=String(p||'').trim().replace(/^"(.*)"$/,'$1');if(!p)return null;
  const n=p.replace(/[\\/]+$/,'').split(/[\\/]/).pop().replace(/\.(lnk|url|exe)$/i,'')||p;
  let icon='';try{icon=await X.iconFor(p)}catch(_){}return{p,n,icon}}

/* 任务栏「待办提醒」可选图标（Segoe Fluent Icons） */
const NOTIFY_ICONS=[['\uEA8F','铃铛'],['\uE73A','勾选框'],['\uE9D5','清单'],['\uE787','日历'],['\uE734','星标'],['\uE7C1','旗帜'],['\uE823','时钟'],['\uE8BD','消息']];
const NOTIFY_IC=w=>w.ic||NOTIFY_ICONS[0][0];
