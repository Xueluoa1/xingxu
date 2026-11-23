// 用 Electron 离屏渲染生成星叙图标：icon.ico（多尺寸）、logo.png（安装界面用）
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[process.argv.length - 1];
const html = `<html><body style="margin:0;background:transparent">
<canvas id="c" width="512" height="512"></canvas>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
function rr(x0,y0,w,h,r){x.beginPath();x.moveTo(x0+r,y0);x.arcTo(x0+w,y0,x0+w,y0+h,r);x.arcTo(x0+w,y0+h,x0,y0+h,r);x.arcTo(x0,y0+h,x0,y0,r);x.arcTo(x0,y0,x0+w,y0,r);x.closePath()}
const g=x.createLinearGradient(40,40,472,472);g.addColorStop(0,'#8b7bff');g.addColorStop(.6,'#5b4bdb');g.addColorStop(1,'#f5c26b');
rr(24,24,464,464,112);x.fillStyle=g;x.fill();
const hl=x.createLinearGradient(0,24,0,300);hl.addColorStop(0,'rgba(255,255,255,.28)');hl.addColorStop(1,'rgba(255,255,255,0)');
rr(24,24,464,464,112);x.fillStyle=hl;x.fill();
// 四角星
function star(cx,cy,R,r,col){x.beginPath();for(let i=0;i<8;i++){const a=Math.PI/4*i-Math.PI/2,rad=i%2?r:R;x.lineTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad)}x.closePath();x.fillStyle=col;x.fill()}
x.shadowColor='rgba(30,20,90,.35)';x.shadowBlur=24;x.shadowOffsetY=8;
star(256,256,176,46,'#ffffff');
x.shadowColor='transparent';
star(372,132,44,12,'rgba(255,255,255,.9)');
</script></body></html>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise(r => setTimeout(r, 400));
  const url = await w.webContents.executeJavaScript("document.getElementById('c').toDataURL('image/png')");
  const { nativeImage } = require('electron');
  const big = nativeImage.createFromDataURL(url);
  fs.writeFileSync(path.join(OUT, 'logo.png'), big.resize({ width: 128, height: 128, quality: 'best' }).toPNG());
  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const pngs = sizes.map(s => big.resize({ width: s, height: s, quality: 'best' }).toPNG());
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(s >= 256 ? 0 : s, e); head.writeUInt8(s >= 256 ? 0 : s, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8); head.writeUInt32LE(off, e + 12);
    off += pngs[i].length;
  });
  fs.writeFileSync(path.join(OUT, 'icon.ico'), Buffer.concat([head, ...pngs]));
  console.log('icon ok', off);
  app.quit();
});
