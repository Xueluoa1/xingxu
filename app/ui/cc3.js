/* ---- 控制中心事件 ---- */
function getP(path){return path.split('.').reduce((o,k)=>o[k],S)}
function setP(path,v){const ks=path.split('.'),l=ks.pop();ks.reduce((o,k)=>o[k]??(o[k]={}),S)[l]=v}
const curW=()=>S.widgets.find(x=>x.id===selW),curT=()=>S.tbw.find(x=>x.id===selT);
function setDir(w,v){w.s.dir=v;if((v==='v'&&w.w>w.h)||(v==='h'&&w.h>w.w)){const t=w.w;w.w=Math.max(80,w.h);w.h=Math.max(70,t)}}
function applyKey(k,v){
  if(k.startsWith('w.')){const w=curW(),f=k.slice(2);if(f==='dir')setDir(w,v);else if(f==='top')w.top=v==='true';else if(f==='city')w.city=v;else w.s[f]=v}
  else if(k.startsWith('t.'))curT()[k.slice(2)]=v;
  else setP(k,v);
  save();
}
const P=$('#page');
P.addEventListener('input',ev=>{const t=ev.target;
  if(t.dataset.rg){const v=+t.value;P.querySelector(`[data-rv="${t.dataset.rg}"]`).textContent=v+(t.nextElementSibling.textContent.replace(/[-\d.]/g,''));applyKey(t.dataset.rg,v)}
  if(t.dataset.col)applyKey(t.dataset.col,t.value);
  if(t.dataset.city&&!ev.isComposing)citySug(t);
});
P.addEventListener('change',ev=>{const t=ev.target;
  if(t.dataset.wh){const w=curW(),v=+t.value;if(v){w[t.dataset.wh]=clamp(Math.round(v),t.dataset.wh==='w'?80:70,t.dataset.wh==='w'?ENV.wa.width:ENV.wa.height);save()}t.value=Math.round(w[t.dataset.wh]);return}
  if(t.dataset.sel)applyKey(t.dataset.sel,t.value);
  if(t.dataset.lnk){setLink(curW(),t.value);return}
  if(t.dataset.txt){if(t._picked&&t._picked===t.value){t._picked=null;return}applyKey(t.dataset.txt,t.value.trim());toast(IC.check,'已保存')}
  if(['w.bg','w.ac','t.tc','t.icc','t.nc','ly.c','ly.hc','tb.c1'].includes(t.dataset.col))renderPage()});
P.addEventListener('keydown',ev=>{const t=ev.target;
  if(t.dataset.city&&!ev.isComposing){const l=t.nextElementSibling,its=[...l.children],i=its.findIndex(x=>x.classList.contains('on'));
    if((ev.key==='ArrowDown'||ev.key==='ArrowUp')&&its.length){ev.preventDefault();const n=ev.key==='ArrowDown'?(i+1)%its.length:(i<=0?its.length-1:i-1);its.forEach((x,k)=>x.classList.toggle('on',k===n));return}
    if(ev.key==='Enter'&&i>=0){ev.preventDefault();cityPick(t,its[i].textContent);return}
    if(ev.key==='Escape'){l.innerHTML='';return}}
  if(ev.key==='Enter'&&t.dataset.txt)t.blur()});
// 城市候选：页面内渲染，避免原生下拉弹层
function citySug(t){const v=t.value.trim(),l=t.nextElementSibling;
  const hit=v?CITIES.filter(c=>c.includes(v)).sort((a,b)=>b.startsWith(v)-a.startsWith(v)).slice(0,8):CITIES.slice(0,8);
  l.innerHTML=hit.length&&!(hit.length===1&&hit[0]===v)?hit.map(c=>`<b>${c}</b>`).join(''):''}
function cityPick(t,c){t.value=c;t.nextElementSibling.innerHTML='';t._picked=c;applyKey(t.dataset.txt,c);toast(IC.check,'已保存');t.blur()}
P.addEventListener('compositionend',ev=>{if(ev.target.dataset.city)citySug(ev.target)});
P.addEventListener('focusin',ev=>{if(ev.target.dataset.city)citySug(ev.target)});
P.addEventListener('focusout',ev=>{if(ev.target.dataset.city)ev.target.nextElementSibling.innerHTML=''});
P.addEventListener('mousedown',ev=>{const b=ev.target.closest('.csug b');if(!b)return;ev.preventDefault();cityPick(b.parentElement.previousElementSibling,b.textContent)});
P.addEventListener('click',async ev=>{
  const q=s=>ev.target.closest(s);let x;
  if(x=q('[data-sw]')){const k=x.dataset.sw;applyKey(k,!(getP(k)??(k==='settings.frost'||k==='settings.tbFullNormal')));x.classList.toggle('on');if(k==='on.tb')setTimeout(renderPage,600);return}
  if(x=q('.seg b')){const k=x.parentElement.dataset.seg;let v=x.dataset.v;if(k==='clock.h24')v=v==='true';if(k==='tb.fill'&&v!==S.tb.fill)S.tb.op=v==='clear'?0:60;applyKey(k,v);renderPage();if(k==='w.fit'&&v==='cover'&&curW().s.img)openCrop(curW());return}
  if(x=q('[data-ck]')){const k=x.dataset.ck;applyKey(k,!getP(k));renderPage();return}
  if(x=q('[data-pre]')){const v=x.dataset.v;if(x.dataset.pre==='global'){S.preset=v;applyTheme()}else curW().s.preset=v;save();renderPage();return}
  if(x=q('[data-tbs]')){const st=x.dataset.tbs;S.tb.style=st;Object.assign(S.tb,TB_PRESET[st]);S.on.tb=true;save();renderPage();setTimeout(renderPage,700);return}
  if(x=q('[data-pal]')){S.tb.c1=x.dataset.pal;S.on.tb=true;save();renderPage();setTimeout(renderPage,700);return}
  if(x=q('[data-add]')){const t=x.dataset.add,d=WTYPES[t];
    const w={id:uid(),type:t,x:Math.round(ENV.wa.width/2-d.w/2+Math.random()*80),y:Math.round(ENV.wa.height/2-d.h/2+Math.random()*60),w:d.w,h:d.h,vis:true,top:false,lock:false,s:newStyle()};
    if(t==='launch'||t==='organizer')w.items=[];S.widgets.push(w);selW=w.id;S.on.widgets=true;if(t==='lyrics')S.on.dlyric=true;if(t==='photo')w.s.fit='cover';save();renderPage();toast(d.ic,`已添加「${d.n}」到桌面（Win + D 查看），可直接拖动摆放`);return}
  if(x=q('[data-wt]')){const w=S.widgets.find(o=>o.id===x.closest('[data-pick]').dataset.pick),a=x.dataset.wt;
    if(a==='vis')w.vis=!w.vis;if(a==='top')w.top=!w.top;if(a==='lock')w.lock=!w.lock;if(a==='del'){S.widgets=S.widgets.filter(o=>o!==w);if(selW===w.id)selW=null}
    save();renderPage();return}
  if(x=q('[data-pick]')){selW=x.dataset.pick;renderPage();return}
  if(x=q('[data-nic]')){curT().ic=x.dataset.nic;save();renderPage();return}
  if(x=q('[data-tadd]')){const t=x.dataset.tadd;const w={id:uid(),type:t,zone:'right',width:t==='lyric'?240:0,form:t==='lyric'?'lyric':'icon-text',tc:'',bo:0,font:'Microsoft YaHei UI'};S.tbw.push(w);selT=w.id;S.on.tbw=true;save();renderPage();return}
  if(x=q('[data-tdel]')){ev.stopPropagation();S.tbw=S.tbw.filter(o=>o.id!==x.dataset.tdel);if(selT===x.dataset.tdel)selT=null;save();renderPage();return}
  if(x=q('[data-tid]')){selT=x.dataset.tid;renderPage();return}
  if(x=q('[data-goto]')){go(x.dataset.goto);return}
  if(x=q('[data-url]')){X.openUrl(x.dataset.url);return}
  if(x=q('[data-m]')){if(!LIVE.media){toast(IC.warn,'没有正在播放的音乐');return}X.media(x.dataset.m);return}
  if(x=q('[data-b]')){const b=x.dataset.b,w=curW();
    if(b==='applyAll'){S.widgets.forEach(o=>o.s.preset=null);S.tb.style=TB_STYLE(S.preset);Object.assign(S.tb,TB_PRESET[S.tb.style]);S.on.tb=true;applyTheme();toast(IC.style,`已将「${PRESETS[S.preset]}」应用到全部插件、任务栏与控制中心`)}
    if(b==='syncAll'){const s=w.s;S.widgets.forEach(o=>o.s={...s,img:o.s.img,iw:o.s.iw,ih:o.s.ih,crop:o.s.crop,fit:o.s.fit,imgDim:o.s.imgDim,dir:o.s.dir});toast(IC.check,'样式已同步到全部插件')}
    if(b==='lockAll'){S.settings.lockAll=!S.settings.lockAll;toast(IC.check,S.settings.lockAll?'已锁定全部插件':'已解除全部锁定')}
    if(b==='wReset')Object.assign(w.s,newStyle());
    if(b==='bgReset')w.s.bg=null;
    if(b==='acReset')w.s.ac=null;
    if(b==='imgUp'){$('#imgFile').click();return}
    if(b==='lnkPick'){$('#linkFile').click();return}
    if(b==='lnkDel'){w.link=null;toast(IC.check,'已解除绑定，相框只展示图片')}
    if(b==='frostUp'){$('#frostFile').click();return}
    if(b==='frostReset'){S.settings.frostImg='';save();renderPage();toast(IC.check,'磨砂背景已改回系统壁纸');return}
    if(b==='crop'){openCrop(w);return}
    if(b==='imgDel')w.s.img=null;
    if(b==='lyAuto')S.ly.c=S.ly.hc=null;
    if(b==='tcAuto')curT().tc='';
    if(b==='iccAuto')curT().icc='';
    if(b==='ncAuto')curT().nc='';
    if(b==='tbHeal'){X.tbHeal();toast(IC.check,'正在重新应用任务栏样式，几秒后主副屏同时生效');return}
    if(b==='tbDefault'){S.on.tb=false;toast(IC.check,'任务栏已恢复 Windows 原来的外观')}
    if(b==='off-'||b==='off+')S.ly.offset=Math.round((S.ly.offset+(b==='off+'?.5:-.5))*10)/10;
    if(b==='search'){await X.lyricNext();return}
    if(b==='bindLrc'){if(!LIVE.media){toast(IC.warn,'请先播放歌曲，再为它绑定歌词');return}$('#lrcFile').click();return}
    if(b==='export'){if(await X.exportCfg())toast(IC.check,'配置已导出');return}
    if(b==='import'){const r=await X.importCfg();if(r){S=X.getState();applyTheme();renderPage();toast(IC.check,'配置已导入')}else if(r===false)toast(IC.warn,'配置文件无效');return}
    if(b==='reset'){if(confirm('恢复全部默认设置？桌面插件、任务栏挂件与待办都会重置。')){await X.resetCfg();S=X.getState();selW=selT=null;applyTheme();renderPage();toast(IC.check,'已恢复默认')}return}
    if(b==='quit'){X.quit();return}
    save();renderPage();return}
});
function openCrop(w){if(!w||!w.s.img)return;X.send('deskTop','crop',w.id)}
// 位置与顺序：拖放
let dragT=null;
P.addEventListener('dragstart',ev=>{const z=ev.target.closest('[data-tid]');if(z){dragT=z.dataset.tid;ev.dataTransfer.effectAllowed='move'}});
P.addEventListener('dragover',ev=>{const z=ev.target.closest('.zone');if(!z||!dragT)return;ev.preventDefault();P.querySelectorAll('.zone').forEach(o=>o.classList.toggle('over',o===z))});
P.addEventListener('drop',ev=>{const z=ev.target.closest('.zone');if(!z||!dragT)return;ev.preventDefault();
  const w=S.tbw.find(o=>o.id===dragT);S.tbw=S.tbw.filter(o=>o!==w);w.zone=z.dataset.zone;
  const before=ev.target.closest('[data-tid]');if(before&&before.dataset.tid!==w.id)S.tbw.splice(S.tbw.findIndex(o=>o.id===before.dataset.tid),0,w);
  else{const idx=S.tbw.map(o=>o.zone).lastIndexOf(w.zone);S.tbw.splice(idx+1,0,w)}
  dragT=null;save();renderPage()});
P.addEventListener('dragend',()=>{dragT=null;P.querySelectorAll('.zone').forEach(o=>o.classList.remove('over'))});
// 文件：歌词与图片
$('#lrcFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const t=await f.text();
  if(!parseLrc(t).length){toast(IC.warn,'未识别到有效的 LRC 时间轴');return}
  if(await X.lyricBind(t))toast(IC.check,`已为「${esc(LIVE.media?.title||'')}」绑定歌词：${esc(f.name)}`)};
$('#imgFile').onchange=e=>{const f=e.target.files[0];e.target.value='';const w=curW();if(!f||!w)return;
  const ph=w.type==='photo',png=ph&&/png|gif|webp/i.test(f.type);
  const img=new Image();img.onload=async()=>{
    const k=Math.min(1,(ph?2560:1600)/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);
    const url=await X.saveImage(png?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.92));if(!url){toast(IC.warn,'图片保存失败');return}
    const fit=w.s.fit||'cover';Object.assign(w.s,{img:url,iw:c.width,ih:c.height,crop:{cx:.5,cy:.5,z:1},fit});if(ph)w.s.imgDim=0;else if(w.s.imgDim==null)w.s.imgDim=25;
    save();renderPage();toast(IC.img,`已为「${WTYPES[w.type].n}」填充图片`);if(fit==='cover')openCrop(w)};
  img.onerror=()=>toast(IC.warn,'无法读取该图片');img.src=URL.createObjectURL(f)};

$('#frostFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  const img=new Image();img.onload=async()=>{
    const k=Math.min(1,2560/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);
    const url=await X.saveImage(c.toDataURL('image/jpeg',.9));if(!url){toast(IC.warn,'图片保存失败');return}
    S.settings.frostImg=url;save();renderPage();toast(IC.img,'已设置磨砂背景图片')};
  img.onerror=()=>toast(IC.warn,'无法读取该图片');img.src=URL.createObjectURL(f)};

/* ---- 实时刷新 ---- */
function liveTick(){
  const m=LIVE.media,p=mediaPos();
  const pp=$('#ccProg');if(pp)pp.style.width=(m&&m.dur>0?p/m.dur*100:0)+'%';
  const pt=$('#ccPt');if(pt)pt.textContent=m&&m.dur>0?fmt(p)+' / '+fmt(m.dur):'';
  const cl=$('#ccLine');if(cl){const i=LIVE.lines.length?curLyricIndex():-1;cl.textContent=i>=0?LIVE.lines[i].x:(m?(LIVE.lyr.searching?'正在匹配歌词…':''):'')}
}
setInterval(liveTick,250);
function rerender(){const st=P.scrollTop;const a=document.activeElement;if(a&&P.contains(a)&&a.matches('input,select'))return;renderPage();P.scrollTop=st}
let mKey='';
window.onLive=k=>{
  if(k==='media'){const m=LIVE.media,nk=m?m.title+'|'+m.artist+'|'+m.playing+'|'+m.thumbUrl:'';if(nk!==mKey){mKey=nk;if(page==='home'||page==='music')rerender()}}
  if(k==='lyrics'&&page==='music')rerender();
  if(k==='env'&&(page==='taskbar'||page==='tbw'||page==='home'||page==='widgets'))rerender();
};
X.onState(s=>{S=s;applyTheme();rerender()});
X.on('go',p=>go(p));
applyTheme();go(new URLSearchParams(location.search).get('page')||'home');
$('#ver').textContent='v'+ENV.version;


/* 相框绑定路径 */
async function setLink(w,p){if(!w)return;const l=await linkOf(p);w.link=l;save();renderPage();toast(IC.check,l?`已绑定「${esc(l.n)}」，双击相框即可打开`:'已解除绑定，相框只展示图片')}
$('#linkFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const p=X.pathOf(f);if(!p){toast(IC.warn,'无法读取该文件的路径');return}setLink(curW(),p)};
