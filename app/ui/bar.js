/* =================== 任务栏挂件（贴在真实任务栏上，位于开始按钮与托盘之间） =================== */
const ZL=$('#zl'),ZR=$('#zr');
let curLine=-2;
function tbLight(){return S.on.tb&&ENV.tb&&ENV.tb.light!=null?ENV.tb.light:!!ENV.sysLight}
function twColor(w){return w.tc||(tbLight()?'#16181b':'#ffffff')}
function reportHit(){requestAnimationFrame(()=>{X.hit({rects:[...document.querySelectorAll('.tw')].map(e=>{const b=e.getBoundingClientRect();return[b.left,b.top,b.width,b.height]}),capture:false})})}
function render(){
  ZL.innerHTML='';ZR.innerHTML='';
  ZL.style.left=(S.tbOff?.l||0)+8+'px';ZR.style.right=(S.tbOff?.r||0)+6+'px';
  document.body.classList.toggle('light',tbLight());
  if(S.on.tbw)S.tbw.forEach(w=>{
    if(w.type==='lyric'&&!S.on.tlyric)return;
    const e=document.createElement('div');e.className='tw';e.dataset.id=w.id;e.dataset.t=w.type;
    e.style.setProperty('--tc',twColor(w));e.style.setProperty('--bo',w.bo/100);e.style.setProperty('--tf',`"${w.font}"`);e.style.setProperty('--hc',lyH(tbLight()));
    if(w.width)e.style.width=w.width+'px';
    const ic=`<i class="i">${TWTYPES[w.type].ic}</i>`,f=w.form;let h='';
    switch(w.type){
      case 'time':h=(f==='icon-text'?ic:'')+`<b data-k="twtime" style="font-weight:600"></b>`;e.title='时间';break;
      case 'date':h=(f==='icon-text'?ic:'')+`<span data-k="twdate"></span>`;e.title='日期';break;
      case 'weather':h=(f==='icon-text'?'<span style="font-size:18px" data-k="twwxe">⛅</span>':'')+`<div class="two"><span data-k="twwx">--°</span><small data-k="twcity">${esc(cityOf(w))}</small></div>`;break;
      case 'lyric':{const ef=S.ly.effects;h=(f==='icon-text'?ic:'')+`<div class="tlyr ${ef.scroll?'scroll':''} ${ef.fade?'fade':''} ${ef.hl?'hl':''}"></div><div class="bars" style="height:16px;flex:none">${'<i></i>'.repeat(5)}</div>`;if(!w.width)e.style.width='240px';e.title='单击：显示 / 隐藏桌面歌词';break;}
      case 'sys':h=(f==='icon-text'?ic:'')+`<div class="two" style="font-variant-numeric:tabular-nums"><span>CPU <b data-k="cpu"></b></span><small>内存 <span data-k="mem"></span></small></div>`;break;
      case 'notify':h=(f==='icon-text'?`<i class="i" style="color:${w.icc||'var(--gold)'}">${NOTIFY_IC(w)}</i>`:'')+`<span>待办 <b style="color:${w.nc||'var(--gold)'}" data-k="tdn"></b></span>`;break;
    }
    e.innerHTML=h;
    (w.zone==='left'?ZL:ZR).appendChild(e);
  });
  curLine=-2;update();reportHit();
}
// 只在内容变化时写 DOM，避免任务栏挂件每秒重绘闪烁
const setT=(e,v)=>{if(e&&e.textContent!==v)e.textContent=v};
function update(){
  const now=new Date(),q=s=>document.querySelectorAll(s);
  q('[data-k=twtime]').forEach(e=>setT(e,`${pad(now.getHours())}:${pad(now.getMinutes())}`));
  q('[data-k=twdate]').forEach(e=>setT(e,`${now.getMonth()+1}月${now.getDate()}日 星期${WK[now.getDay()]}`));
  q('[data-k=tdn]').forEach(e=>setT(e,S.todos.filter(x=>!x.d).length+' 项'));
  q('[data-k=cpu]').forEach(e=>setT(e,Math.round(LIVE.sys.cpu)+'%'));
  q('[data-k=mem]').forEach(e=>setT(e,Math.round(LIVE.sys.mem)+'%'));
  q('.tw[data-t=weather]').forEach(el=>{const w=wxFor(S.tbw.find(o=>o.id===el.dataset.id));
    if(!w||w.temp==null)return;const c=wx(w.code),s=k=>el.querySelector(`[data-k=${k}]`);
    setT(s('twwxe'),c.e);setT(s('twwx'),`${Math.round(w.temp)}° ${c.t}`);setT(s('twcity'),w.city)});
  const m=LIVE.media;
  q('[data-k=title]').forEach(e=>setT(e,m?m.title:'未在播放'));
  q('[data-k=artist]').forEach(e=>setT(e,m?(m.artist||''):''));
}
function onLine(){
  const i=LIVE.lines.length?curLyricIndex():-1;
  const m=LIVE.media;
  if(i>=0){const st=LIVE.lines[i].t,en=(LIVE.lines[i+1]||{t:m&&m.dur>0?m.dur:st+5}).t,t=mediaPos()+(S.ly.offset||0);
    const p=Math.min(100,Math.max(0,(t-st)/Math.max(.5,en-st)*115));document.querySelectorAll('.tlyr.hl span').forEach(e=>e.style.setProperty('--p',p+'%'))}
  if(i===curLine)return;curLine=i;
  const txt=i>=0?LIVE.lines[i].x:m?`${m.title}${m.artist?' - '+m.artist:''}`:'星叙 · 让旋律被看见';
  document.querySelectorAll('.tlyr').forEach(b=>{
    const sp=document.createElement('span');sp.textContent=txt;b.innerHTML='';b.appendChild(sp);
    requestAnimationFrame(()=>{const over=sp.scrollWidth-b.clientWidth;if(over>4){sp.classList.add('long');sp.style.setProperty('--mx',-over-6+'px');sp.style.setProperty('--md',Math.max(4,over/22+3)+'s')}});
  });
}
const barH=new Array(16).fill(.2);
function tickBars(){const pl=!!(LIVE.media&&LIVE.media.playing);
  for(let i=0;i<16;i++){const tgt=pl?(.25+Math.random()*.75)*(1-Math.abs(i-6)/16):.12;barH[i]+=(tgt-barH[i])*.5}
  document.querySelectorAll('.bars').forEach(b=>[...b.children].forEach((x,i)=>x.style.height=Math.round(barH[i%16]*100)+'%'))}
setInterval(()=>{if(LIVE.paused)return;onLine();if(document.querySelector('.bars')&&LIVE.media)tickBars()},100);
setInterval(update,1000);
document.addEventListener('click',ev=>{
  const e=ev.target.closest('.tw');if(!e)return;const w=S.tbw.find(x=>x.id===e.dataset.id);
  if(w.type==='lyric'){S.on.dlyric=true;const l=S.widgets.find(x=>x.type==='lyrics');if(l){l.vis=!l.vis;save()}return}
  X.send('main','cc',w.type==='notify'?'home':'tbw:'+w.id);
});
document.addEventListener('contextmenu',ev=>{ev.preventDefault();const e=ev.target.closest('.tw');X.send('main','cc',e?'tbw:'+e.dataset.id:'tbw')});
window.onLive=k=>{if(k==='env'){render();return}if(k==='lyrics')curLine=-2;update()};
X.onState(s=>{S=s;render()});
render();
