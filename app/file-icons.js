const fs = require('fs');
const { app, nativeImage, shell } = require('electron');
const koffi = require('koffi');
const user = koffi.load('user32.dll'), gdi = koffi.load('gdi32.dll');
const extract = koffi.load('shell32.dll').func('uint32 __stdcall ExtractIconExW(str16, int, _Out_ void **, void *, uint32)');
const destroyIcon = user.func('int __stdcall DestroyIcon(void *)');
const draw = user.func('int __stdcall DrawIconEx(void *, int, int, void *, int, int, uint32, void *, uint32)');
const createDC = gdi.func('void * __stdcall CreateCompatibleDC(void *)');
const deleteDC = gdi.func('int __stdcall DeleteDC(void *)');
const createBitmap = gdi.func('void * __stdcall CreateDIBSection(void *, void *, uint32, _Out_ void **, void *, uint32)');
const select = gdi.func('void * __stdcall SelectObject(void *, void *)');
const deleteObject = gdi.func('int __stdcall DeleteObject(void *)');
const fill = gdi.func('int __stdcall PatBlt(void *, int, int, int, int, uint32)');
const flush = gdi.func('int __stdcall GdiFlush()');
const size = 32;
const pixels = koffi.array('uint8_t', size * size * 4);
const header = Buffer.alloc(40);
header.writeUInt32LE(40);
header.writeInt32LE(size, 4);
header.writeInt32LE(-size, 8); // top-down BGRA
header.writeUInt16LE(1, 12);
header.writeUInt16LE(32, 14);

function resourceIcon(file, index) {
  const handle = [null], bits = [null];
  if (extract(file, index, handle, null, 1) !== 1 || !handle[0]) return '';
  let dc, bitmap, previous;
  try {
    dc = createDC(null);
    if (!dc) return '';
    bitmap = createBitmap(dc, header, 0, bits, null, 0);
    if (!bitmap || !bits[0]) return '';
    previous = select(dc, bitmap);
    if (!previous) return '';
    // 从黑白两张底图恢复透明度，兼容带 alpha 的图标和旧的单色遮罩。
    function render(background) {
      if (!fill(dc, 0, 0, size, size, background) ||
          !draw(dc, 0, 0, handle[0], size, size, 0, null, 3)) throw Error('Icon drawing failed');
      flush();
      return Buffer.from(koffi.decode(bits[0], pixels));
    }
    const dark = render(0x00000042), light = render(0x00ff0062);
    for (let i = 0; i < dark.length; i += 4) {
      dark[i + 3] = 255 - Math.max(0, light[i] - dark[i]);
    }
    return nativeImage.createFromBitmap(dark, {width:size, height:size}).toDataURL();
  } finally {
    if (previous) select(dc, previous);
    if (bitmap) deleteObject(bitmap);
    if (dc) deleteDC(dc);
    destroyIcon(handle[0]);
  }
}

function programIcon(file) {
  if (!/\.(lnk|exe|dll|ico)$/i.test(file) || !fs.existsSync(file)) return '';
  let target = file;
  if (/\.lnk$/i.test(file)) {
    const link = shell.readShortcutLink(file);
    target = link.target;
    if (link.icon) {
      const src = link.icon.replace(/%([^%]+)%/g, (part, key) => process.env[key] || part);
      if (fs.existsSync(src)) {
        const icon = resourceIcon(src, link.iconIndex || 0);
        if (icon) return icon;
      }
    }
  }
  if (target && /\.(exe|dll|ico)$/i.test(target) && fs.existsSync(target)) return resourceIcon(target, 0);
  return '';
}

async function fileIcon(file) {
  try {
    const icon = programIcon(file);
    if (icon) return icon;
  } catch (_) {}
  try {
    let target = file;
    if (/\.lnk$/i.test(file)) {
      const link = shell.readShortcutLink(file);
      if (link.target && fs.existsSync(link.target)) target = link.target;
    }
    const image = await app.getFileIcon(target, { size: 'large' });
    return image.isEmpty() ? '' : image.toDataURL();
  } catch (_) { return ''; }
}

// 已有项目只在能读到图标资源时替换缓存，保留离线文件的原图。
function refreshOrganizerIcons(state) {
  let changed = false;
  const byPath = new Map();
  for (const box of state.widgets) {
    if (box.type !== 'organizer') continue;
    for (const item of box.items || []) {
      if (typeof item.p !== 'string' || item.iconVersion === 2) continue;
      try {
        if (!byPath.has(item.p)) byPath.set(item.p, programIcon(item.p));
        const icon = byPath.get(item.p);
        if (icon) { item.icon = icon; item.iconVersion = 2; changed = true; }
      } catch (_) {}
    }
  }
  return changed;
}

module.exports = { fileIcon, refreshOrganizerIcons };

