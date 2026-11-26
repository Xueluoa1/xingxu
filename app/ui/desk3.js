/* =================== 桌面插件：交互 =================== */
const findW=id=>S.widgets.find(x=>x.id===id);
function selectW(id){selW=id;qa('.wg').forEach(e=>e.classList.toggle('sel',e.dataset.id===id))}
// 拖动 / 缩放（吸附规则见下方 snapAxis；Alt 不吸附，Shift 锁定方向）
L.addEventListener('pointerdown',ev=>{
  if(DBG)console.log('pd',ev.button,ev.clientX,ev.clientY,ev.target.className);
  const e=ev.target.closest('.wg');if(!e||ev.button!==0)return;
  hideCtx();const w=findW(e.dataset.id);selectW(w.id);
  if(w.lock||S.settings.lockAll||ev.target.closest('input,[data-a]'))return;
  const pos=visiblePosition(w);
  drag={w:{...w,...pos},e,rs:ev.target.classList.contains('rs'),sx:ev.clientX,sy:ev.clientY,ox:pos.x,oy:pos.y,ow:w.w,oh:w.h,moved:false};
  e.classList.add('drag');try{e.setPointerCapture(ev.pointerId)}catch(_){}reportHit();
});
// 吸附规则：屏幕四边与中线；附近插件的同侧边缘 / 中线（对齐）与 12px 间距（并排）。
// 多个候选时取最近的一个；只和横向或纵向上挨着的插件吸附。按住 Alt 不吸附；按住 Shift 只沿横向或纵向移动
const SN=8,GAP=12,NEAR=160;
let guideEl=null;
function showGuides(gs){
  if(!guideEl){guideEl=document.createElement('div');guideEl.className='guides';L.appendChild(guideEl)}
  guideEl.innerHTML=gs.map(g=>g.v?`<i class="gv${g.lk?' lk':''}" style="left:${g.p}px;top:${g.a}px;height:${Math.max(0,g.b-g.a)}px"></i>`:`<i class="gh${g.lk?' lk':''}" style="top:${g.p}px;left:${g.a}px;width:${Math.max(0,g.b-g.a)}px"></i>`).join('')}
function clearGuides(){if(guideEl)guideEl.innerHTML=''}
// 两段区间 [a1,a2] 与 [b1,b2] 的距离，重叠为 0
const gapOf=(a1,a2,b1,b2)=>Math.max(0,b1-a2,a1-b2);
// 一个轴上的候选线：k 为本插件要对上的边（s 起始边 / e 结束边 / c 中线），p 为位置，g 为辅助线位置
function snapLines(w,x,y,horiz){
  const VW=innerWidth,VH=innerHeight,out=[];
  const pos=horiz?x:y,len=horiz?w.w:w.h,o1=horiz?y:x,o2=o1+(horiz?w.h:w.w),full=horiz?VH:VW;
  out.push({k:'s',p:0,a:0,b:full},{k:'e',p:horiz?VW:VH,a:0,b:full},{k:'c',p:(horiz?VW:VH)/2,a:0,b:full});
  S.widgets.forEach(o=>{if(o.id===w.id||!o.vis||mine(o)!==mine(w))return;
    const pos=visiblePosition(o);
    const op=horiz?pos.x:pos.y,ol=horiz?o.w:o.h,q1=horiz?pos.y:pos.x,q2=q1+(horiz?o.h:o.w);
    if(gapOf(o1,o2,q1,q2)>NEAR)return; // 另一方向离得太远，不参与
    const a=Math.min(o1,q1),b=Math.max(o2,q2);
    out.push({k:'s',p:op,a,b},{k:'e',p:op+ol,a,b},{k:'c',p:op+ol/2,a,b});
    // 并排：只在另一方向上有重叠时才算
    if(gapOf(o1,o2,q1,q2)===0){const ga=Math.max(o1,q1),gb=Math.min(o2,q2);
      out.push({k:'s',p:op+ol+GAP,g:op+ol+GAP/2,a:ga,b:gb},{k:'e',p:op-GAP,g:op-GAP/2,a:ga,b:gb})}
  });
  return out;
}
// 在一个轴上求最近的吸附；edges 为参与吸附的边。返回修正量与辅助线
function snapAxis(w,x,y,horiz,edges){
  const pos=horiz?x:y,len=horiz?w.w:w.h,at={s:pos,e:pos+len,c:pos+len/2};
  let best=null;
  for(const t of snapLines(w,x,y,horiz)){if(!edges.includes(t.k))continue;
    const d=t.p-at[t.k];if(Math.abs(d)<SN&&(!best||Math.abs(d)<Math.abs(best.d)))best={d,t}}
  if(!best)return{d:0,g:null};
  const t=best.t;return{d:best.d,g:{v:horiz,p:t.g!=null?t.g:t.p,a:t.a,b:t.b}};
}
addEventListener('pointermove',ev=>{
  if(!drag)return;const{w,e}=drag;let dx=ev.clientX-drag.sx,dy=ev.clientY-drag.sy;
  if(!drag.moved&&Math.abs(dx)+Math.abs(dy)<3)return;drag.moved=true;
  const VW=innerWidth,VH=innerHeight,snap=!ev.altKey,gs=[];
  if(drag.rs){
    w.w=clamp(drag.ow+dx,80,VW);w.h=clamp(drag.oh+dy,70,VH);
    if(snap){ // 缩放：右边、下边吸附
      const sx=snapAxis(w,w.x,w.y,true,['e']);if(sx.g&&w.w+sx.d>=80){w.w+=sx.d;gs.push(sx.g)}
      const sy=snapAxis(w,w.x,w.y,false,['e']);if(sy.g&&w.h+sy.d>=70){w.h+=sy.d;gs.push(sy.g)}}
  }else{
    // Shift：锁定到移动较多的方向
    let lock='';if(ev.shiftKey){if(Math.abs(dx)>=Math.abs(dy)){dy=0;lock='x'}else{dx=0;lock='y'}}
    let x=drag.ox+dx,y=drag.oy+dy;
    if(snap){
      if(lock!=='y'){const s=snapAxis(w,x,y,true,['s','e','c']);x+=s.d;if(s.g)gs.push(s.g)}
      if(lock!=='x'){const s=snapAxis(w,x,y,false,['s','e','c']);y+=s.d;if(s.g)gs.push(s.g)}
    }
    w.x=clamp(x,-w.w+40,VW-40);w.y=clamp(y,0,VH-30);
    if(lock)gs.push(lock==='x'?{v:false,p:drag.oy+w.h/2,a:0,b:VW,lk:1}:{v:true,p:drag.ox+w.w/2,a:0,b:VH,lk:1});
  }
  showGuides(gs);
  Object.assign(e.style,{left:w.x+'px',top:w.y+'px',width:w.w+'px',height:w.h+'px'});
  const im=e.querySelector(':scope>.wimg');if(drag.rs&&im)placeImg(w,im);
  placeFrost(w,e,w);if(w.type==='lyrics')onLine(true);
});
addEventListener('pointerup',()=>{
  if(!drag)return;
  const {w,e,rs,moved}=drag;
  drag=null;
  clearGuides();e.classList.remove('drag');
  const current=findW(w.id);
  if(moved && current && !current.lock && !S.settings.lockAll){
    const geometry=rs?{w:w.w,h:w.h}:{x:w.x,y:w.y};
    Object.assign(current,geometry);
    X.setWidgetGeometry({id:w.id,...geometry});
  }
  if(moved)renderWidgets();else reportHit();
});
addEventListener('pointercancel',()=>{
  if(!drag)return;
  drag=null;clearGuides();renderWidgets();
});

// 收纳盒只保存文件路径。图标读取期间窗口可能收到新的插件状态。
async function addBoxFiles(id,files){
  const paths=[...new Set(files.map(file=>X.pathOf(file)).filter(Boolean))];
  const links=[];
  for(const path of paths)links.push(await linkOf(path));
  const box=findW(id);
  if(!box||box.type!=='organizer')return;
  box.items??=[];
  const seen=new Set(box.items.map(item=>item.p.toLowerCase()));
  let added=0;
  for(const link of links){
    if(!link||seen.has(link.p.toLowerCase()))continue;
    seen.add(link.p.toLowerCase());
    box.items.push(link);added++;
  }
  if(added){remount(box);save()}
  toast(added?IC.add:IC.warn,added?`已添加 ${added} 项到收纳盒`:paths.length?'这些项目已在收纳盒中':'无法读取拖入项目的本地路径');
}
function openBoxItem(button){
  const box=findW(button.closest('.wg').dataset.id);
  const item=box?.items?.[Number(button.dataset.i)];
  if(item)X.open(item.p);
}
L.addEventListener('dblclick',ev=>{
  const item=ev.target.closest('[data-a=boxItem]');
  if(item)openBoxItem(item);
});
L.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'&&!ev.repeat&&ev.target.matches('[data-a=boxItem]')){
    ev.preventDefault();openBoxItem(ev.target);
  }
});

// 插件内操作
L.addEventListener('click',ev=>{
  const a=ev.target.closest('[data-a]');if(!a)return;const act=a.dataset.a;
  if(act==='photoUp'){pickImage(findW(a.closest('.wg').dataset.id),'cover');return}
  if(act==='tile'){const w=findW(a.closest('.wg').dataset.id),it=dockItems(w)[+a.dataset.i],d=it.k?SC[it.k]:it;X.open(d.p);return}
  if(act==='play'||act==='next'||act==='prev'){if(!LIVE.media){toast(IC.warn,'没有正在播放的音乐');return}X.media(act);return}
  if(act==='ck'||act==='del'){const i=+a.closest('li').dataset.i;if(act==='ck')S.todos[i].d=!S.todos[i].d;else S.todos.splice(i,1);save();qa('.wg').forEach(e=>e.querySelector('[data-k=tl]')&&renderTodos(e))}
});
L.addEventListener('dblclick',ev=>{const e=ev.target.closest('.wg[data-t=photo]');if(!e||ev.target.closest('[data-a]'))return;const w=findW(e.dataset.id);if(w&&w.link){X.open(w.link.p);toast(IC.file,`正在打开「${esc(w.link.n)}」`)}});
L.addEventListener('keydown',ev=>{
  if(ev.target.dataset.k==='tin'&&ev.key==='Enter'&&ev.target.value.trim()){S.todos.unshift({t:ev.target.value.trim(),d:false});ev.target.value='';save();qa('.wg').forEach(e=>e.querySelector('[data-k=tl]')&&renderTodos(e))}
});

/* Dock 拖放：从桌面 / 资源管理器拖入文件或快捷方式；Dock 内排序；跨 Dock 移动；拖出移除 */
let dndT=null;
L.addEventListener('dragstart',ev=>{
  const t=ev.target.closest('.tile[draggable]');if(!t)return;
  dndT={wid:t.closest('.wg').dataset.id,i:+t.dataset.i};t.classList.add('dragging');dndInside=true;reportHit();
  ev.dataTransfer.setData('text/plain','tile');ev.dataTransfer.effectAllowed='move'});
L.addEventListener('dragend',()=>{dndT=null;dndInside=false;reportHit();qa('.dock.over').forEach(d=>d.classList.remove('over'));qa('.tile.dragging').forEach(t=>t.classList.remove('dragging'))});
document.addEventListener('dragover',ev=>{
  const dk=ev.target.closest&&ev.target.closest('[data-dock]'),files=[...ev.dataTransfer.types].includes('Files');
  const box=ev.target.closest?.('.wg[data-t=organizer]');
  if(box&&files&&!dndT){
    qa('.wg.over,.dock.over').forEach(el=>{if(el!==box)el.classList.remove('over')});
    ev.preventDefault();ev.dataTransfer.dropEffect='link';box.classList.add('over');return;
  }
  const pw=!dk&&!dndT&&files&&ev.target.closest&&ev.target.closest('.wg[data-t=photo]');qa('.wg.over').forEach(x=>x!==pw&&x.classList.remove('over'));
  if(pw){ev.preventDefault();pw.classList.add('over');ev.dataTransfer.dropEffect='link';return}
  qa('.dock.over').forEach(d=>d!==dk&&d.classList.remove('over'));
  if(dk&&(dndT||files)){ev.preventDefault();dk.classList.add('over');ev.dataTransfer.dropEffect=dndT?'move':'link'}
  else if(dndT){ev.preventDefault();ev.dataTransfer.dropEffect='move'}});
document.addEventListener('dragleave',ev=>{if(!ev.relatedTarget)qa('.dock.over,.wg.over').forEach(d=>d.classList.remove('over'))});
function dockIndex(dk,ev){const v=dk.classList.contains('v');let i=0;dk.querySelectorAll('.tile').forEach(t=>{const r=t.getBoundingClientRect();if((v?ev.clientY:ev.clientX)>(v?r.top+r.height/2:r.left+r.width/2))i++});return i}
document.addEventListener('drop',async ev=>{
  ev.preventDefault();const dk=ev.target.closest&&ev.target.closest('[data-dock]');
  qa('.dock.over,.wg.over').forEach(d=>d.classList.remove('over'));
  const box=ev.target.closest?.('.wg[data-t=organizer]');
  if(box){
    if(!dndT&&ev.dataTransfer.files.length)await addBoxFiles(box.dataset.id,[...ev.dataTransfer.files]);
    dndT=null;dndInside=false;reportHit();return;
  }
  const pw=!dk&&!dndT&&ev.target.closest&&ev.target.closest('.wg[data-t=photo]');
  if(pw&&ev.dataTransfer.files.length){const w=findW(pw.dataset.id),p=X.pathOf(ev.dataTransfer.files[0]);
    if(p){w.link=await linkOf(p);remount(w);save();toast(IC.add,`已绑定「${esc(w.link.n)}」，双击相框即可打开`)}else toast(IC.warn,'无法绑定该项目（如「此电脑」请用系统功能入口插件）');
    dndInside=false;reportHit();return}
  if(dk){const w=findW(dk.closest('.wg').dataset.id);w.items=w.items||[];let at=dockIndex(dk,ev);
    if(dndT){const src=findW(dndT.wid),[it]=src.items.splice(dndT.i,1);if(src===w&&dndT.i<at)at--;w.items.splice(at,0,it);if(src!==w)remount(src);dndT=null}
    else if(ev.dataTransfer.files.length){
      const fl=[...ev.dataTransfer.files];let n=0,skip=0;
      for(const f of fl){const p=X.pathOf(f);if(!p){skip++;continue}
        if(w.items.some(x=>x.p&&x.p.toLowerCase()===p.toLowerCase())){skip++;continue}
        const name=p.split(/[\\/]/).pop().replace(/\.(lnk|url)$/i,'')||p;
        const icon=await X.iconFor(p);w.items.splice(at++,0,{n:name,p,icon});n++}
      toast(IC.add,n?`已添加 ${n} 个快捷方式${skip?`，${skip} 个已存在或不是文件`:''}`:'这些项目已在 Dock 中，或不是文件（如「此电脑」请用系统功能入口插件）')}
    remount(w);save()}
  else if(dndT){const src=findW(dndT.wid),[it]=src.items.splice(dndT.i,1);remount(src);save();toast(IC.del,`已从快捷启动移除「${esc(it.n)}」`);dndT=null}
  dndInside=false;reportHit()});
