// Draws the app icon procedurally (no dependencies) and writes PNGs: node tools/make-icons.mjs
import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(size, 0); ih.writeUInt32BE(size, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const BG = [14, 13, 11], GOLD = [201, 164, 92], PALE = [230, 207, 150];
// Scene in unit coordinates (-1..1). `scale` shrinks the artwork for the maskable safe zone.
function sample(x, y, scale) {
  x /= scale; y /= scale;
  let col = BG;
  const r = Math.hypot(x, y);
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  if (Math.abs(r - 0.80) < 0.012) col = mix(BG, GOLD, 0.9);
  if (Math.abs(r - 0.865) < 0.004) col = mix(BG, GOLD, 0.45);
  // twelve petals: the twelve swaras
  const a = Math.atan2(y, x), k = Math.round(a / (Math.PI / 6)) * (Math.PI / 6);
  const px = x * Math.cos(-k) - y * Math.sin(-k), py = x * Math.sin(-k) + y * Math.cos(-k);
  const d = Math.hypot((px - 0.665) / 0.075, py / 0.03);
  if (d < 1) col = mix(BG, GOLD, 0.5);
  // bansuri: a diagonal bamboo tube with six holes
  const c = Math.SQRT1_2, u = x * c - y * c, v = x * c + y * c;
  if (Math.abs(u) < 0.6 && Math.abs(v) < 0.066 || Math.hypot(Math.abs(u) - 0.6, v) < 0.066) {
    col = mix(GOLD, PALE, Math.max(0, 0.7 - Math.abs(v + 0.02) / 0.066));
    if (Math.abs(Math.abs(u) - 0.52) < 0.008 || Math.abs(u + 0.24) < 0.006) col = mix(col, BG, 0.45);
    for (const hx of [-0.12, 0.0, 0.12, 0.27, 0.39, 0.51]) if (Math.hypot(u - hx + 0.03, v) < 0.026) col = BG;
    if (Math.hypot(u + 0.40, v) < 0.032) col = BG;
  }
  return col;
}
function render(size, scale = 1) {
  const px = Buffer.alloc(size * size * 4), S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const c = sample((x + (i + .5) / S) / size * 2 - 1, (y + (j + .5) / S) / size * 2 - 1, scale); r += c[0]; g += c[1]; b += c[2]; }
    const o = (y * size + x) * 4; px[o] = r / S / S; px[o + 1] = g / S / S; px[o + 2] = b / S / S; px[o + 3] = 255;
  }
  return png(size, px);
}
const out = new URL('../icons/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), render(192));
writeFileSync(new URL('icon-512.png', out), render(512));
writeFileSync(new URL('icon-maskable-512.png', out), render(512, 0.78));
writeFileSync(new URL('apple-touch-icon.png', out), render(180, 0.9));
console.log('icons written');
