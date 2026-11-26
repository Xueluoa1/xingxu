/* =================== 桌面插件层（desk：贴桌面；deskTop：置顶） =================== */
const ROLE=X.role,DBG=X.debug;
const L=$('#layer');
let selW=null,drag=null,menuOpen=false,cropOpen=false,dndInside=false;
const mine=w=>(w.top||(w.type==='lyrics'&&S.ly.top))?ROLE==='deskTop':ROLE==='desk';
const ox=()=>ENV.wa.x-ENV.bounds.x,oy=()=>ENV.wa.y-ENV.bounds.y;

/* ---- 点击区域上报：光标在插件、菜单上时窗口接收鼠标，其他位置穿透到桌面 ---- */
let hitRaf=0;
function reportHit(){cancelAnimationFrame(hitRaf);hitRaf=requestAnimationFrame(()=>{
  const r=[...L.querySelectorAll('.wg')].map(e=>{const b=e.getBoundingClientRect();return[b.left-4,b.top-4,b.width+8,b.height+8]});
  const c=$('#ctx');if(c.style.display==='block'){const b=c.getBoundingClientRect();r.push([b.left,b.top,b.width,b.height])}
  X.hit({rects:r,capture:!!(drag||cropOpen||menuOpen||dndInside)})})}

// 保留拖动时允许的部分越界。当前屏幕太小时，仅临时把插件移到可见范围内。
function visiblePosition(w) {
  const { width, height } = ENV.wa;
  const x = w.x < 40 - w.w || w.x > width - 40 ? clamp(w.x, 0, Math.max(0, width - w.w)) : w.x;
  const y = w.y < 0 || w.y > height - 30 ? clamp(w.y, 0, Math.max(0, height - w.h)) : w.y;
  return { x, y };
}
function renderWidgets(){
  L.querySelectorAll('.wg').forEach(e=>e.remove());
  if(S.on.widgets)S.widgets.forEach(w=>{
    if(!w.vis||!mine(w))return;
    if(w.type==='lyrics'&&!S.on.dlyric)return;
    const e=document.createElement('div');e.className='wg';e.dataset.id=w.id;
    L.appendChild(e);mountWidget(w,e);styleWidget(w,e);
  });
  updateDynamic();onLine(true);reportHit();
}
function cropBox(w,W,H){const s=w.s,iw=s.iw,ih=s.ih,c=s.crop||{cx:.5,cy:.5,z:1};const sc=Math.max(W/iw,H/ih)*c.z,bw=iw*sc,bh=ih*sc;
  return{bw,bh,x:clamp(W/2-c.cx*bw,W-bw,0),y:clamp(H/2-c.cy*bh,H-bh,0)}}
function placeImg(w,im){
  if(w.s.fit==='stretch'){im.style.backgroundSize='100% 100%';im.style.backgroundPosition='center';return}
  if(!w.s.iw){im.style.backgroundSize='cover';im.style.backgroundPosition='center';return}
  const b=cropBox(w,w.w,w.h);im.style.backgroundSize=`${b.bw}px ${b.bh}px`;im.style.backgroundPosition=`${b.x}px ${b.y}px`}
// 玻璃风格：用壁纸副本模拟磨砂（按插件在屏幕上的位置对齐）
function placeFrost(w,e,{x,y}=visiblePosition(w)){
  // 动态壁纸软件无法被读取：用户指定了磨砂背景图片时优先使用它
  const src=S.settings.frostImg||ENV.wall;
  const p=effPreset(w),on=(p==='glass'||p==='glass2')&&src&&S.settings.frost!==false&&!w.s.img&&w.type!=='photo';
  let f=e.querySelector(':scope>.frost');
  if(!on){if(f)f.remove();return}
  if(!f){f=document.createElement('div');f.className='frost';f.innerHTML='<i></i>';e.prepend(f)}
  const i=f.firstChild;i.style.backgroundImage=`url("${src}")`;i.style.backgroundSize='cover';i.style.backgroundPosition='center';
  Object.assign(i.style,{left:-(x+ox())+'px',top:-(y+oy())+'px',width:ENV.bounds.width+'px',height:ENV.bounds.height+'px'});
  f.classList.toggle('g2',p==='glass2')}
function styleWidget(w,e){
  e=e||L.querySelector(`.wg[data-id="${w.id}"]`);if(!e)return;
  const p=effPreset(w);
  e.className=`wg p-${p}${w.lock||S.settings.lockAll?' locked':''}${selW===w.id?' sel':''}`;
  const pos=visiblePosition(w);
  Object.assign(e.style,{left:pos.x+'px',top:pos.y+'px',width:w.w+'px',height:w.h+'px',zIndex:5});
  e.style.setProperty('--op',w.s.op/100);e.style.setProperty('--ac',w.s.ac||PRESET_AC[p]);
  e.style.setProperty('--r',(w.s.r??PRESET_R[p])+'px');e.style.setProperty('--fs',(14*w.s.fs/100)+'px');e.style.setProperty('--wf',`"${w.s.font}"`);
  e.style.background=w.s.bg?hexA(w.s.bg,w.s.op/100):'';e.dataset.t=w.type;
  let im=e.querySelector(':scope>.wimg');
  if(w.type==='photo'){const pk=(w.s.img?'i':'')+(w.link?'l:'+w.link.p:'');if(e.dataset.pk!==pk){e.dataset.pk=pk;mountWidget(w,e)}e.title=w.link?'双击打开：'+w.link.n:'';e.classList.toggle('linked',!!w.link)}
  if(w.s.img){if(!im){im=document.createElement('div');im.className='wimg';e.prepend(im)}
    im.style.backgroundImage=`url("${w.s.img}")`;im.style.setProperty('--dim',(w.s.imgDim??25)/100);placeImg(w,im)}
  else if(im)im.remove();
  placeFrost(w,e,pos);
  if(w.type==='lyrics'){const lt=LIGHT_PRESETS.includes(p);e.style.setProperty('--lc',lyC(lt));e.style.setProperty('--lh',S.ly.hc||LY_HI[p]||lyH(lt));e.style.opacity=S.ly.op/100}
}
const dockItems=w=>w.type==='sysentry'?SYS_ITEMS.map(k=>({k})):(w.items||[]);
function dockHTML(w){
  const sys=w.type==='sysentry',items=dockItems(w);
  const t=items.map((it,i)=>{const d=it.k?SC[it.k]:it;const g=d.icon?`<div class="g img"><img src="${d.icon}" alt=""></div>`:`<div class="g" style="background:${d.bg||'#5b6474'}"><i class="i">${d.ic||IC.file}</i></div>`;
    return `<div class="tile" data-a="tile" data-i="${i}" ${sys?'':'draggable="true"'} title="${esc(d.n)}">${g}<span>${esc(d.n)}</span></div>`}).join('');
  return `<div class="in" style="padding:8px 10px"><div class="dock ${w.s.dir==='v'?'v':''}" ${sys?'':'data-dock="1"'}>${t||'<div class="dock-empty">把桌面快捷方式或文件拖到这里</div>'}</div></div>`}
function organizerHTML(w,head){
  const tiles=(w.items||[]).map((item,index)=>{
    const icon=item.icon?`<img src="${esc(item.icon)}" draggable="false" alt="">`:`<i class="i">${IC.file}</i>`;
    return `<button type="button" class="box-item" data-a="boxItem" data-i="${index}" title="${esc(item.p)}">${icon}<span>${esc(item.n)}</span></button>`;
  });
  const content=tiles.length?tiles.join(''):'<div class="box-empty">拖入文件、程序或快捷方式</div>';
  return `<div class="in box-inner">${head}<div class="box-grid" data-a="boxGrid" style="--box-count:${Math.max(1,tiles.length)}">${content}</div></div>`;
}
function remount(w){const e=L.querySelector(`.wg[data-id="${w.id}"]`);if(e){mountWidget(w,e);styleWidget(w,e);updateDynamic();reportHit()}}
function setDir(w,v){w.s.dir=v;if((v==='v'&&w.w>w.h)||(v==='h'&&w.h>w.w)){const t=w.w;w.w=Math.max(80,w.h);w.h=Math.max(70,t)}remount(w);save()}
function calHTML(){const now=new Date(),y=now.getFullYear(),m=now.getMonth(),f=new Date(y,m,1).getDay(),dn=new Date(y,m+1,0).getDate(),pd=new Date(y,m,0).getDate();
  let c=[...WK].map(x=>`<span class="h">${x}</span>`).join('');
  for(let i=f-1;i>=0;i--)c+=`<span class="o">${pd-i}</span>`;
  for(let i=1;i<=dn;i++){const wd=(f+i-1)%7;c+=`<span class="${i===now.getDate()?'t':(wd===0||wd===6)?'hol':''}">${i}</span>`}
  return `<div class="in"><div class="ttl"><i class="i">${WTYPES.calendar.ic}</i>${y}年${m+1}月</div><div class="cal">${c}</div></div>`}
function mountWidget(w,e){
  const t=WTYPES[w.type];let h='';
  const head=`<div class="ttl"><i class="i">${t.ic}</i>${t.n}</div>`;
  switch(w.type){
    case 'clock':h=`<div class="in" style="justify-content:center"><div class="big hl" data-k="time"></div><div class="sub" data-k="date" style="margin-top:6px"></div></div>`;break;
    case 'weather':h=`<div class="in">${head}<div class="row"><span style="font-size:2.6em" data-k="wxe">⛅</span><div><div class="big hl" style="font-size:2.4em" data-k="wxt">--°</div></div><div class="sp"></div><div style="text-align:right" class="sub" data-k="wxd">正在获取天气…</div></div>
      <div class="wx-days" data-k="wxdays"></div></div>`;break;
    case 'sys':h=`<div class="in">${head}${[['cpu','CPU'],['mem','内存'],['disk','磁盘'],['net','网络']].filter(([k])=>S.sysItems[k]).map(([k,n])=>`<div class="sysrow"><span>${n}</span><div class="bar"><i data-k="${k}b"></i></div><span data-k="${k}" style="text-align:right"></span></div>`).join('')}</div>`;break;
    case 'music':h=`<div class="in" style="justify-content:center"><div class="row" style="gap:16px"><div class="vinyl" data-k="vinyl"><div class="disc"><div class="lbl" data-k="vlbl"></div></div><div class="arm"></div></div>
      <div style="flex:1;min-width:0"><div data-k="title" class="hl" style="font-weight:600;font-size:1.1em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div><div class="sub" data-k="artist" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
      <div class="row" style="margin:8px 0 6px"><div class="bar" style="flex:1;height:4px"><i data-k="prog"></i></div><span class="sub" data-k="ptime" style="font-size:.75em"></span></div>
      <div class="row"><div class="ctl"><i class="i" data-a="prev">${IC.prev}</i><i class="i" data-a="play"></i><i class="i" data-a="next">${IC.next}</i></div><div class="sp"></div><div class="bars" data-k="bars">${'<i></i>'.repeat(10)}</div></div></div></div></div>`;break;
    case 'fps':h=`<div class="in">${head}<div class="row" style="align-items:flex-end;gap:10px"><div class="fps-n hl" data-k="fps">--</div><div class="sub" style="line-height:1.5">FPS<br><span data-k="fpsms">-- ms</span></div><div class="sp"></div><div class="sub" style="text-align:right;font-size:.78em;line-height:1.5">最低 <b data-k="fpsmin">--</b><br>平均 <b data-k="fpsavg">--</b></div></div>
      <svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polygon data-k="fpsa" points=""/><polyline data-k="fpsl" points=""/></svg></div>`;break;
    case 'lyrics':h=`<div class="in ${S.ly.align==='center'?'ly-center':''}" style="font-size:${S.ly.fs/14}em">${S.ly.mode==='full'?head:''}<div class="lyw"><div class="lyl" data-k="lyl"></div></div></div>`;break;
    case 'todo':h=`<div class="in">${head}<div class="todo-in"><input placeholder="添加待办，回车保存" data-k="tin"></div><ul class="todo-list" data-k="tl"></ul></div>`;break;
    case 'launch':case 'sysentry':h=dockHTML(w);break;
    case 'calendar':h=calHTML();break;
    case 'organizer':h=organizerHTML(w,head);break;
    case 'photo':h=w.s.img?'':w.link?`<div class="ph-link">${w.link.icon?`<img src="${w.link.icon}" alt="">`:`<i class="i">${IC.file}</i>`}<span>${esc(w.link.n)}</span></div>`:`<div class="ph-empty"><span data-a="photoUp"><i class="i">${t.ic}</i>点击上传图片</span><small>也可以把程序或文件拖进来，绑定后双击打开</small></div>`;break;
  }
  e.innerHTML=h+'<div class="rs"></div>';
  if(w.type==='todo')renderTodos(e);
  if(w.type==='lyrics')fillLyrics(e);
}
function renderTodos(e){
  const ul=e.querySelector('[data-k=tl]');
  ul.innerHTML=S.todos.map((t,i)=>`<li class="${t.d?'done':''}" data-i="${i}"><span class="ck" data-a="ck">${t.d?`<i class="i">${IC.check}</i>`:''}</span><span>${esc(t.t)}</span><i class="i x" data-a="del">${IC.x}</i></li>`).join('')||'<li class="empty">暂无待办</li>';
}
function lyricPlaceholder(){if(!LIVE.media)return '未检测到正在播放的音乐';if(LIVE.lyr.searching)return '正在匹配歌词…';return `${LIVE.media.title}${LIVE.media.artist?' - '+LIVE.media.artist:''}（暂无歌词）`}
function fillLyrics(e){const l=e.querySelector('[data-k=lyl]');if(!l)return;
  l.innerHTML=LIVE.lines.length?LIVE.lines.map(o=>`<p>${esc(o.x)}</p>`).join(''):`<p class="cur ph">${esc(lyricPlaceholder())}</p>`;curLine=-2}
