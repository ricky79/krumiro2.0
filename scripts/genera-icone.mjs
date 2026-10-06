// Genera le icone PNG della PWA e dell'app Android (orologio bianco su sfondo verde petrolio)
// senza dipendenze: rasterizzazione con supersampling + encoder PNG minimale.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SFONDO = [15, 118, 110];
const PRIMO_PIANO = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, dati) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dati.length);
  const td = Buffer.concat([Buffer.from(tipo), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG `w`×`h`; `pixel` restituisce [r, g, b] oppure, con `alfa`, [r, g, b, a]. */
function png(w, h, pixel, alfa = false) {
  const canali = alfa ? 4 : 3;
  const riga = w * canali + 1;
  const raw = Buffer.alloc(riga * h);
  for (let y = 0; y < h; y++) {
    raw[y * riga] = 0;
    for (let x = 0; x < w; x++) {
      const px = pixel(x, y);
      const o = y * riga + 1 + x * canali;
      for (let c = 0; c < canali; c++) raw[o + c] = px[c];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = alfa ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Distanza dal segmento AB. */
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** true se il punto (coordinate normalizzate 0..1) è nel disegno. `scala` < 1 lascia margine (maskable). */
function dentro(u, v, scala) {
  const x = (u - 0.5) / scala, y = (v - 0.5) / scala;
  const r = Math.hypot(x, y);
  if (r > 0.30 && r < 0.36) return true; // quadrante
  if (distSeg(x, y, 0, 0, 0, -0.21) < 0.032) return true; // lancetta minuti (12)
  if (distSeg(x, y, 0, 0, 0.14, 0.06) < 0.032) return true; // lancetta ore (~4)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (i % 3 === 0 && distSeg(x, y, Math.sin(a) * 0.255, -Math.cos(a) * 0.255, Math.sin(a) * 0.28, -Math.cos(a) * 0.28) < 0.018) return true;
  }
  return false;
}

const SS = 4;
const mescola = (a) => SFONDO.map((c, i) => Math.round(c + (PRIMO_PIANO[i] - c) * a));

/** Frazione di un pixel coperta da `test(u, v)`, con u e v normalizzati nel quadrato di lato `dim` in (ox, oy). */
function copertura(x, y, ox, oy, dim, test) {
  let n = 0;
  for (let sy = 0; sy < SS; sy++)
    for (let sx = 0; sx < SS; sx++)
      if (test((x + (sx + 0.5) / SS - ox) / dim, (y + (sy + 0.5) / SS - oy) / dim)) n++;
  return n / (SS * SS);
}

/** Icona quadrata piena: orologio bianco su verde petrolio. */
function icona(size, scala) {
  return png(size, size, (x, y) => mescola(copertura(x, y, 0, 0, size, (u, v) => dentro(u, v, scala))));
}

/** Icona rotonda (Android legacy): fuori dal cerchio è trasparente. */
function iconaRotonda(size) {
  return png(size, size, (x, y) => {
    const cerchio = copertura(x, y, 0, 0, size, (u, v) => Math.hypot(u - 0.5, v - 0.5) <= 0.5);
    return [...mescola(copertura(x, y, 0, 0, size, (u, v) => dentro(u, v, 1))), Math.round(cerchio * 255)];
  }, true);
}

/** Primo piano dell'icona adattiva (Android 8+): solo l'orologio, su fondo trasparente. */
function primoPiano(size, scala) {
  return png(size, size, (x, y) => [...PRIMO_PIANO, Math.round(copertura(x, y, 0, 0, size, (u, v) => dentro(u, v, scala)) * 255)], true);
}

/** Schermata di avvio (Android < 12): fondo verde petrolio, orologio al centro. */
function splash(w, h) {
  const dim = Math.round(Math.min(w, h) * 0.45);
  const ox = (w - dim) / 2, oy = (h - dim) / 2;
  return png(w, h, (x, y) => {
    if (x < ox - 1 || x > ox + dim + 1 || y < oy - 1 || y > oy + dim + 1) return SFONDO;
    return mescola(copertura(x, y, ox, oy, dim, (u, v) => dentro(u, v, 1)));
  });
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/apple-touch-icon.png', icona(180, 1));
writeFileSync('public/icons/icon-192.png', icona(192, 1));
writeFileSync('public/icons/icon-512.png', icona(512, 1));
writeFileSync('public/icons/icon-maskable-512.png', icona(512, 0.78));
// Badge delle notifiche (Android): conta solo la forma, Chrome usa il canale alfa. 96×96 come consiglia Chrome.
writeFileSync('public/icons/badge-96.png', primoPiano(96, 1.3));
console.log('Icone generate in public/icons/');

// App Android: stesse icone della PWA in tutte le densità.
const RES = 'android/app/src/main/res';
const DENSITA = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [nome, k] of Object.entries(DENSITA)) {
  const dir = `${RES}/mipmap-${nome}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/ic_launcher.png`, icona(48 * k, 1));
  writeFileSync(`${dir}/ic_launcher_round.png`, iconaRotonda(48 * k));
  // Tela adattiva di 108dp: come l'icona maskable della PWA, l'orologio resta nella zona sicura.
  writeFileSync(`${dir}/ic_launcher_foreground.png`, primoPiano(108 * k, 0.78));
}
const SPLASH = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
for (const [nome, [w, h]] of Object.entries(SPLASH)) {
  writeFileSync(`${RES}/drawable-port-${nome}/splash.png`, splash(w, h));
  writeFileSync(`${RES}/drawable-land-${nome}/splash.png`, splash(h, w));
}
writeFileSync(`${RES}/drawable/splash.png`, splash(480, 320));
console.log(`Icone e schermate di avvio generate in ${RES}/`);
