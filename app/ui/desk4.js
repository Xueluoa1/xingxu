/* =================== 桌面插件：右键菜单、图片填充、裁剪 =================== */
const CTX=$('#ctx');
L.addEventListener('contextmenu',ev=>{
  ev.preventDefault();const e=ev.target.closest('.wg');if(!e)return;
  const w=findW(e.dataset.id);selectW(w.id);const p=effPreset(w);
  const tl=ev.target.closest('.tile[draggable]');CTX.dataset.ti=tl?tl.dataset.i:'';
  const boxItem=ev.target.closest('[data-a=boxItem]');
  const entry=boxItem?w.items[Number(boxItem.dataset.i)]:null;
  CTX.dataset.boxPath=entry?.p||'';
  const dock=w.type==='launch'||w.type==='sysentry',lab=t=>`<div class="lab">${t}</div>`;
  CTX.innerHTML=`${entry?`<div data-c="boxRemove"><i class="i">${IC.del}</i>从收纳盒移除「${esc(entry.n)}」</div><hr>`:''}${tl?`<div data-c="tdel"><i class="i">${IC.del}</i>从快捷启动移除「${esc(w.items[+tl.dataset.i].n)}」</div><hr>`:''}${lab(WTYPES[w.type].n+' · 预设样式')}
    <div class="pre">${Object.entries(PRESETS).map(([k,n])=>`<span data-c="pre" data-v="${k}" class="${p===k?'on':''}">${n}</span>`).join('')}</div><hr>
    ${lab('图片填充'+(w.s.img?'':' · 选择方式后上传图片'))}
    <div class="pre"><span data-c="fit" data-v="stretch" class="${w.s.img&&w.s.fit==='stretch'?'on':''}">拉伸填充</span><span data-c="fit" data-v="cover" class="${w.s.img&&w.s.fit!=='stretch'?'on':''}">裁切填充</span></div>
    ${w.s.img&&w.s.fit!=='stretch'&&w.s.iw?`<div data-c="crop"><i class="i">${IC.crop}</i>调整裁剪区域…</div>`:''}${w.s.img?`<div data-c="imgUp"><i class="i">${IC.img}</i>更换图片…</div><div data-c="imgDel"><i class="i">${IC.del}</i>移除图片</div>`:''}<hr>
    ${w.type==='photo'?`${lab('绑定路径'+(w.link?' · '+esc(w.link.n):' · 双击相框打开'))}<div data-c="lnkPick"><i class="i">${IC.file}</i>${w.link?'更换绑定…':'选择程序或文件…'}</div>${w.link?`<div data-c="lnkDel"><i class="i">${IC.del}</i>解除绑定</div>`:''}<hr>`:''}
    ${dock?`${lab('排列方向')}<div class="pre"><span data-c="dir" data-v="h" class="${w.s.dir!=='v'?'on':''}">横向排列</span><span data-c="dir" data-v="v" class="${w.s.dir==='v'?'on':''}">纵向排列</span></div><hr>`:''}
    ${lab('尺寸与圆角（像素）')}
    <div class="sz">宽<input type="number" data-sz="w" min="80" max="${innerWidth}" step="10" value="${Math.round(w.w)}">高<input type="number" data-sz="h" min="70" max="${innerHeight}" step="10" value="${Math.round(w.h)}"></div>
    <div class="sz">圆角<input type="number" data-sz="r" min="0" max="40" step="1" value="${w.s.r??PRESET_R[p]}"></div><hr>
    <div data-c="edit"><i class="i">${IC.edit}</i>在控制中心编辑样式…</div>
    <div data-c="top"><i class="i">${IC.pin}</i>${w.top?'取消置顶（回到桌面层）':'置顶显示'}</div>
    <div data-c="lock"><i class="i">${IC.lock}</i>${w.lock?'解锁位置':'锁定位置'}</div>
    <div data-c="hide"><i class="i">${IC.eyeOff}</i>隐藏</div>
    <div data-c="del" class="dan"><i class="i">${IC.del}</i>移除插件</div>`;
  CTX.dataset.id=w.id;CTX.style.display='block';menuOpen=true;
  CTX.style.left=Math.max(8,Math.min(ev.clientX,innerWidth-CTX.offsetWidth-8))+'px';CTX.style.top=Math.max(8,Math.min(ev.clientY,innerHeight-CTX.offsetHeight-8))+'px';
  reportHit();
});
function setSize(w,k,v){if(!w||v==null||isNaN(v))return;
  if(k==='r'){w.s.r=clamp(Math.round(v),0,40);styleWidget(w);save();return}
  if(!v)return;w[k]=clamp(Math.round(v),k==='w'?80:70,k==='w'?innerWidth:innerHeight);
  styleWidget(w);if(w.type==='lyrics')onLine(true);save();reportHit()}
CTX.addEventListener('change',ev=>{const k=ev.target.dataset.sz;if(!k)return;const w=findW(CTX.dataset.id);setSize(w,k,+ev.target.value);ev.target.value=k==='r'?w.s.r:Math.round(w[k])});
CTX.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.dataset.sz){ev.target.dispatchEvent(new Event('change',{bubbles:true}));hideCtx()}});
function hideCtx(){if(CTX.style.display!=='block')return;CTX.style.display='none';menuOpen=false;reportHit()}
addEventListener('pointerdown',ev=>{if(!ev.target.closest('#ctx'))hideCtx()});
addEventListener('blur',()=>hideCtx());
addEventListener('keydown',ev=>{if(ev.key==='Escape')hideCtx()});
CTX.addEventListener('click',ev=>{
  const a=ev.target.closest('[data-c]');if(!a)return;const c=a.dataset.c,w=findW(CTX.dataset.id);
  hideCtx();if(!w)return;
  if(c==='pre'){w.s.preset=a.dataset.v;styleWidget(w);toast(IC.style,`已将「${WTYPES[w.type].n}」切换为「${PRESETS[a.dataset.v]}」样式`)}
  if(c==='edit'){X.send('main','cc','widgets:'+w.id);return}
  if(c==='dir'){setDir(w,a.dataset.v);return}
  if(c==='boxRemove'){
    w.items=w.items.filter(item=>item.p!==CTX.dataset.boxPath);remount(w);save();return;
  }
  if(c==='tdel'){const ti=+CTX.dataset.ti,[it]=w.items.splice(ti,1);remount(w);toast(IC.del,`已从快捷启动移除「${esc(it.n)}」`)}
  if(c==='fit'){if(w.s.img){w.s.fit=a.dataset.v;styleWidget(w);if(a.dataset.v==='cover'&&w.s.iw)cropFor(w)}else{pickImage(w,a.dataset.v);return}}
  if(c==='crop'){cropFor(w);return}
  if(c==='lnkPick'){linkTarget=w.id;$('#linkFile').click();return}
  if(c==='lnkDel'){w.link=null;remount(w);toast(IC.del,'已解除绑定，相框只展示图片')}
  if(c==='imgUp'){pickImage(w,w.s.fit||'cover');return}
  if(c==='imgDel'){w.s.img=null;styleWidget(w);toast(IC.img,'已移除图片')}
  if(c==='top'){w.top=!w.top;save();renderWidgets();toast(IC.pin,w.top?'已置顶显示':'已回到桌面层');return}
  if(c==='lock'){w.lock=!w.lock;styleWidget(w)}
  if(c==='hide'){w.vis=false;renderWidgets();toast(IC.eyeOff,`已隐藏「${WTYPES[w.type].n}」，可在控制中心重新显示`)}
  if(c==='del'){S.widgets=S.widgets.filter(x=>x!==w);renderWidgets();toast(IC.del,`已移除「${WTYPES[w.type].n}」`)}
  save();
});

/* 图片填充：缩放到 1600px 内保存到用户目录 */
let imgTarget=null,imgFit='cover';
function pickImage(w,fit){imgTarget=w.id;imgFit=fit;$('#imgFile').click()}
$('#imgFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  const w=findW(imgTarget);if(!w)return;
  const ph=w.type==='photo',png=ph&&/png|gif|webp/i.test(f.type);
  const img=new Image();img.onload=async()=>{
    const k=Math.min(1,(ph?2560:1600)/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);
    const url=await X.saveImage(png?c.toDataURL('image/png'):c.toDataURL('image/jpeg',.92));if(!url){toast(IC.warn,'图片保存失败');return}
    Object.assign(w.s,{img:url,iw:c.width,ih:c.height,crop:{cx:.5,cy:.5,z:1},fit:imgFit});if(ph)w.s.imgDim=0;else if(w.s.imgDim==null)w.s.imgDim=25;
    if(ph)mountWidget(w,L.querySelector(`.wg[data-id="${w.id}"]`));
    styleWidget(w);save();if(imgFit==='cover')setTimeout(()=>cropFor(w),300);
    toast(IC.img,`已为「${WTYPES[w.type].n}」填充图片（${imgFit==='stretch'?'拉伸填充':'裁切填充'}）`)};
  img.onerror=()=>toast(IC.warn,'无法读取该图片');img.src=URL.createObjectURL(f)};

/* 裁剪区域编辑器 */
let cropW=null,cropOld=null,cropK=1;
function openCrop(w){
  if(!w.s.img||!w.s.iw)return;cropW=w;cropOld={...(w.s.crop||{cx:.5,cy:.5,z:1})};w.s.crop={...cropOld};
  const st=$('#cstage'),img=$('#cimg');cropK=Math.min(660/w.s.iw,420/w.s.ih);
  st.style.width=w.s.iw*cropK+'px';st.style.height=w.s.ih*cropK+'px';img.src=w.s.img;
  $('#crop').classList.remove('hide');cropOpen=true;reportHit();drawCrop()}
function closeCrop(){$('#crop').classList.add('hide');cropOpen=false;reportHit()}
function cropRegion(){const w=cropW,s=w.s,sc=Math.max(w.w/s.iw,w.h/s.ih)*s.crop.z;
  const rw=Math.min(s.iw,w.w/sc),rh=Math.min(s.ih,w.h/sc);
  s.crop.cx=clamp(s.crop.cx,rw/2/s.iw,1-rw/2/s.iw);s.crop.cy=clamp(s.crop.cy,rh/2/s.ih,1-rh/2/s.ih);
  return{rw,rh}}
function drawCrop(){const s=cropW.s,{rw,rh}=cropRegion(),r=$('#crect');
  Object.assign(r.style,{left:(s.crop.cx*s.iw-rw/2)*cropK+'px',top:(s.crop.cy*s.ih-rh/2)*cropK+'px',width:rw*cropK+'px',height:rh*cropK+'px'});
  $('#cz').value=Math.round(s.crop.z*100);$('#czv').textContent=Math.round(s.crop.z*100)+'%';
  const im=L.querySelector(`.wg[data-id="${cropW.id}"]>.wimg`);if(im)placeImg(cropW,im)}
(function(){let d=null;
  $('#crect').addEventListener('pointerdown',e=>{d={x:e.clientX,y:e.clientY,cx:cropW.s.crop.cx,cy:cropW.s.crop.cy};try{e.target.setPointerCapture(e.pointerId)}catch(_){}});
  $('#crect').addEventListener('pointermove',e=>{if(!d)return;const s=cropW.s;s.crop.cx=d.cx+(e.clientX-d.x)/cropK/s.iw;s.crop.cy=d.cy+(e.clientY-d.y)/cropK/s.ih;drawCrop()});
  $('#crect').addEventListener('pointerup',()=>d=null);
  $('#cstage').addEventListener('wheel',e=>{e.preventDefault();const s=cropW.s;s.crop.z=clamp(s.crop.z*(e.deltaY<0?1.08:1/1.08),1,4);drawCrop()},{passive:false});
  $('#cz').addEventListener('input',e=>{cropW.s.crop.z=e.target.value/100;drawCrop()});
  $('#cReset').onclick=()=>{cropW.s.crop={cx:.5,cy:.5,z:1};drawCrop()};
  $('#cCancel').onclick=()=>{cropW.s.crop=cropOld;drawCrop();closeCrop()};
  $('#cOk').onclick=()=>{closeCrop();save();toast(IC.crop,'裁剪区域已更新')};
})();

/* 来自主进程 / 控制中心 */
X.onState(s=>{S=s;if(!drag&&!cropOpen)renderWidgets()});
// 裁剪窗口统一由置顶层显示，避免被其他窗口遮挡
X.on('crop',id=>{const w=findW(id);if(w&&ROLE==='deskTop')openCrop(w)});
function cropFor(w){if(ROLE==='deskTop')openCrop(w);else X.send('deskTop','crop',w.id)}
X.on('pick',({id,fit})=>{const w=findW(id);if(w&&mine(w))pickImage(w,fit)});
// 日期变化时刷新日历
let today=new Date().getDate();setInterval(()=>{const d=new Date().getDate();if(d!==today){today=d;qa('.wg[data-t=calendar]').forEach(e=>{const w=findW(e.dataset.id);mountWidget(w,e)})}},60000);
renderWidgets();requestAnimationFrame(loop);

/* 相框绑定路径：选择程序或文件 */
let linkTarget=null;
$('#linkFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';const w=findW(linkTarget);if(!f||!w)return;
  const p=X.pathOf(f);if(!p){toast(IC.warn,'无法读取该文件的路径');return}
  w.link=await linkOf(p);remount(w);save();toast(IC.add,`已绑定「${esc(w.link.n)}」，双击相框即可打开`)};
