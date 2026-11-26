/* =================== 桌面插件：实时数据 =================== */
const qa=s=>L.querySelectorAll(s);
let curLine=-2;
function updateDynamic(){
  const now=new Date();
  const hh=S.clock.h24?pad(now.getHours()):pad((now.getHours()%12)||12);
  const tstr=`${hh}:${pad(now.getMinutes())}${S.clock.sec?':'+pad(now.getSeconds()):''}${S.clock.h24?'':(now.getHours()<12?' AM':' PM')}`;
  qa('[data-k=time]').forEach(e=>e.textContent=tstr);
  qa('[data-k=date]').forEach(e=>e.textContent=`${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 星期${WK[now.getDay()]}`);
  const y=LIVE.sys;
  const sv={cpu:[y.cpu,Math.round(y.cpu)+'%'],mem:[y.mem,Math.round(y.mem)+'%'],disk:[y.disk,Math.round(y.disk)+'%'],net:[Math.min(100,y.down/1048576*10),'↓'+fmtRate(y.down)]};
  for(const k in sv){qa(`[data-k=${k}]`).forEach(e=>e.textContent=sv[k][1]);qa(`[data-k=${k}b]`).forEach(e=>e.style.width=sv[k][0]+'%')}
  updateMedia();updateWeather();
}
function updateMedia(){
  const m=LIVE.media;
  qa('[data-k=title]').forEach(e=>e.textContent=m?m.title:'未在播放');
  qa('[data-k=artist]').forEach(e=>e.textContent=m?(m.artist||'未知歌手'):'打开任意音乐软件开始播放');
  qa('[data-k=vlbl]').forEach(e=>{e.style.background=m&&m.thumbUrl?`center/cover url("${m.thumbUrl}")`:'linear-gradient(135deg,#ff6b9a,#6c5ce7 60%,#2ec5ff)'});
  qa('[data-k=vinyl]').forEach(e=>e.classList.toggle('play',!!(m&&m.playing)));
  qa('[data-a=play]').forEach(e=>e.textContent=m&&m.playing?IC.pause:IC.play);
  tickProgress();
}
function tickProgress(){
  const m=LIVE.media,p=mediaPos(),pct=m&&m.dur>0?p/m.dur*100:0;
  qa('[data-k=prog]').forEach(e=>e.style.width=pct+'%');
  qa('[data-k=ptime]').forEach(e=>e.textContent=m&&m.dur>0?fmt(p)+' / '+fmt(m.dur):'');
}
function updateWeather(){
  L.querySelectorAll('.wg[data-t=weather]').forEach(el=>{
    const g=S.widgets.find(o=>o.id===el.dataset.id),w=wxFor(g),q=s=>el.querySelector(s);
    if(!w){q('[data-k=wxd]').textContent=cityOf(g)?'正在获取天气…':'请在设置中选择城市';return}
    if(w.err){q('[data-k=wxd]').textContent=w.err;return}
    if(w.temp==null)return;
    const c=wx(w.code);
    q('[data-k=wxe]').textContent=c.e;
    q('[data-k=wxt]').textContent=Math.round(w.temp)+'°';
    q('[data-k=wxd]').innerHTML=`${esc(w.city)} · ${c.t}<br>湿度 ${w.hum}% · 风速 ${Math.round(w.wind)}km/h`;
    q('[data-k=wxdays]').innerHTML=w.days.slice(1,6).map(d=>`<div>${WEEK(d.d)}<b>${wx(d.code).e}</b>${Math.round(d.min)}~${Math.round(d.max)}°</div>`).join('');
  });
}
function onLine(force){
  const i=LIVE.lines.length?curLyricIndex():-1;
  if(i===curLine&&!force)return;curLine=i;
  qa('[data-k=lyl]').forEach(l=>{
    const ps=l.children,box=l.parentElement;if(!LIVE.lines.length){l.style.transform=`translateY(${(box.clientHeight-(ps[0]?.offsetHeight||0))/2}px)`;return}
    [...ps].forEach((p,k)=>p.classList.toggle('cur',k===i));
    const md=S.ly.mode;
    [...ps].forEach((p,k)=>p.style.display=(md==='full'||(md==='single'&&k===Math.max(i,0))||(md==='double'&&(k===Math.max(i,0)||k===Math.max(i,0)+1)))?'':'none');
    if(md==='full'){const cur=ps[Math.max(i,0)];if(cur)l.style.transform=`translateY(${box.clientHeight/2-cur.offsetTop-cur.offsetHeight/2}px)`}
    else l.style.transform=`translateY(${(box.clientHeight-(md==='double'?2:1)*(ps[0]?.offsetHeight||0))/2}px)`;
  });
}
const barH=new Array(16).fill(.2);
function tickBars(){const pl=!!(LIVE.media&&LIVE.media.playing);
  for(let i=0;i<16;i++){const tgt=pl?(.25+Math.random()*.75)*(1-Math.abs(i-6)/16):.12;barH[i]+=(tgt-barH[i])*.5}
  qa('.bars').forEach(b=>[...b.children].forEach((x,i)=>x.style.height=Math.round(barH[i%16]*100)+'%'))}
let last=performance.now(),acc=0,bacc=0,pacc=0,fFrames=0,fAcc=0;const fHist=[];
function tickFps(raw){fFrames++;fAcc+=raw;if(fAcc<.5)return;const fps=fFrames/fAcc;fFrames=0;fAcc=0;fHist.push(fps);if(fHist.length>40)fHist.shift();
  if(!L.querySelector('[data-k=fps]'))return;
  const mx=Math.max(70,...fHist),pts=fHist.map((v,i)=>`${(i/39*100).toFixed(1)},${(30-v/mx*28).toFixed(1)}`).join(' ');
  const avg=fHist.reduce((a,b)=>a+b,0)/fHist.length,mn=Math.min(...fHist);
  qa('[data-k=fps]').forEach(e=>e.textContent=Math.round(fps));
  qa('[data-k=fpsms]').forEach(e=>e.textContent=(1000/fps).toFixed(1)+' ms');
  qa('[data-k=fpsmin]').forEach(e=>e.textContent=Math.round(mn));
  qa('[data-k=fpsavg]').forEach(e=>e.textContent=Math.round(avg));
  qa('[data-k=fpsl]').forEach(e=>e.setAttribute('points',pts));
  qa('[data-k=fpsa]').forEach(e=>e.setAttribute('points',pts?`0,30 ${pts} ${((fHist.length-1)/39*100).toFixed(1)},30`:''))}
// 全屏时暂停刷新；有 FPS / 律动条插件时按帧刷新，否则每 250ms 刷新一次以省电
function loop(n){const raw=(n-last)/1000,dt=Math.min(.2,raw);last=n;
  if(!LIVE.paused){tickFps(raw);bacc+=dt;pacc+=dt;acc+=dt;
    if(bacc>.09){bacc=0;if(LIVE.media&&L.querySelector('.bars'))tickBars()}
    if(pacc>.25){pacc=0;tickProgress();onLine()}
    if(acc>1){acc=0;updateDynamic()}}
  const busy=L.querySelector('[data-k=fps]')||(LIVE.media&&LIVE.media.playing&&L.querySelector('.bars'));
  if(busy)requestAnimationFrame(loop);else setTimeout(()=>requestAnimationFrame(loop),240)}
window.onLive=k=>{
  if(k==='lyrics'){qa('.wg').forEach(fillLyrics);onLine(true)}
  if(k==='media'){updateMedia();if(!LIVE.lines.length){qa('.wg').forEach(fillLyrics);onLine(true)}else onLine()}
  if(k==='sys')updateDynamic();
  if(k==='weather')updateWeather();
  if(k==='env'){S.widgets.forEach(w=>{if(!drag||drag.w.id!==w.id)styleWidget(w)});reportHit()}
};
