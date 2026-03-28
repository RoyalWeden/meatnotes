'use strict';
const zlib = require('zlib');

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function encodePng(size, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // None filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const off = 1 + x * 4;
      row[off] = r; row[off + 1] = g; row[off + 2] = b; row[off + 3] = a;
    }
    rows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 6 });
  return Buffer.concat([sig, makeChunk('IHDR', ihdrData), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

/**
 * Generate a minimal valid PNG buffer for a colored circle on transparent bg.
 */
function makeCircleIcon(r, g, b, size = 16) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 1.5;
  return encodePng(size, (x, y) => {
    const dist = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
    const alpha = Math.max(0, Math.min(255, Math.round((radius + 1 - dist) * 255)));
    return [r, g, b, alpha];
  });
}

/**
 * Returns true if point (px, py) is inside a rounded rectangle.
 */
function inRoundRect(px, py, x1, y1, x2, y2, cr) {
  if (px < x1 || px > x2 || py < y1 || py > y2) return false;
  const cx = px < x1 + cr ? x1 + cr : px > x2 - cr ? x2 - cr : px;
  const cy = py < y1 + cr ? y1 + cr : py > y2 - cr ? y2 - cr : py;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2) <= cr;
}

/**
 * Generate a PNG of a book icon (closed book, no cross, no symbols).
 * The book is a darker silhouette drawn on a colored circle background.
 * Spine on left, pages edge on right, main cover in center.
 *
 * @param {number} r - Red 0-255 (state color — green/red/orange/grey/yellow)
 * @param {number} g - Green 0-255
 * @param {number} b - Blue 0-255
 * @param {number} size - Image dimensions in pixels (square, default 32)
 * @returns {Buffer} PNG-encoded image buffer
 */
function makeBookIcon(r, g, b, size = 32) {
  const cx = size / 2;
  const cy = size / 2;
  const circleRadius = size / 2 - 1.5;
  const s = size / 32; // scale factor

  // Book bounds (scaled from 32px reference)
  const bx1 = Math.round(7 * s);
  const bx2 = Math.round(25 * s);
  const by1 = Math.round(5 * s);
  const by2 = Math.round(27 * s);
  const spineX = bx1 + Math.round(3 * s);   // right edge of spine
  const pagesX = bx2 - Math.round(2 * s);   // left edge of page strip
  const cr = Math.max(1, Math.round(1.5 * s)); // book corner radius

  // Derived colors
  const coverR = Math.round(r * 0.50);
  const coverG = Math.round(g * 0.50);
  const coverB = Math.round(b * 0.50);
  const spineR = Math.round(r * 0.30);
  const spineG = Math.round(g * 0.30);
  const spineB = Math.round(b * 0.30);

  return encodePng(size, (x, y) => {
    const dist = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
    const circleAlpha = Math.max(0, Math.min(255, Math.round((circleRadius + 1 - dist) * 255)));
    if (circleAlpha === 0) return [0, 0, 0, 0];

    const px = x + 0.5;
    const py = y + 0.5;
    const inBook = inRoundRect(px, py, bx1, by1, bx2, by2, cr);

    if (!inBook) return [r, g, b, circleAlpha];

    if (px >= pagesX) {
      // Page edges — cream/parchment
      return [218, 208, 175, circleAlpha];
    }
    if (px < spineX) {
      // Spine — darkest
      return [spineR, spineG, spineB, circleAlpha];
    }
    // Main cover — dark
    return [coverR, coverG, coverB, circleAlpha];
  });
}

/**
 * Generate a polished macOS-style app icon PNG.
 * Deep green squircle background with a detailed book illustration.
 * @param {number} size - Image size (1024 recommended)
 * @returns {Buffer} PNG buffer
 */
function makeAppIcon(size = 1024) {
  const cx = size / 2;
  const cy = size / 2;
  const s = size / 1024; // scale from 1024 reference

  // Squircle (superellipse, n=4.5) — macOS icon shape
  function inSquircle(px, py) {
    const rx = (px - cx) / (cx * 0.9);
    const ry = (py - cy) / (cy * 0.9);
    return Math.pow(Math.abs(rx), 4.5) + Math.pow(Math.abs(ry), 4.5) <= 1;
  }

  // Squircle anti-aliased alpha (sample 4 subpixels)
  function squircleAlpha(x, y) {
    let count = 0;
    const offsets = [0.25, 0.75];
    for (const dx of offsets) for (const dy of offsets) {
      if (inSquircle(x + dx, y + dy)) count++;
    }
    return Math.round((count / 4) * 255);
  }

  // Book bounds (scaled from 1024 reference)
  const bx1 = Math.round(220 * s);
  const bx2 = Math.round(800 * s);
  const by1 = Math.round(160 * s);
  const by2 = Math.round(860 * s);
  const spineW = Math.round(90 * s);
  const pagesW = Math.round(60 * s);
  const spineX2 = bx1 + spineW;
  const pagesX1 = bx2 - pagesW;
  const bookCr = Math.round(28 * s);

  function inRoundRectB(px, py) {
    if (px < bx1 || px > bx2 || py < by1 || py > by2) return false;
    const cx2 = px < bx1 + bookCr ? bx1 + bookCr : px > bx2 - bookCr ? bx2 - bookCr : px;
    const cy2 = py < by1 + bookCr ? by1 + bookCr : py > by2 - bookCr ? by2 - bookCr : py;
    return Math.sqrt((px - cx2) ** 2 + (py - cy2) ** 2) <= bookCr;
  }

  // Page line texture (horizontal lines every ~16px in the pages strip)
  const pageLineSpacing = Math.round(22 * s);

  return encodePng(size, (x, y) => {
    const alpha = squircleAlpha(x, y);
    if (alpha === 0) return [0, 0, 0, 0];

    // Background gradient: dark forest green, lighter at top
    const gradT = y / size; // 0=top, 1=bottom
    const bgR = Math.round((26 + gradT * 4));  // ~26-30
    const bgG = Math.round((74 - gradT * 20)); // ~74-54
    const bgB = Math.round((26 + gradT * 4));  // ~26-30

    const px = x + 0.5;
    const py = y + 0.5;
    const inBook = inRoundRectB(px, py);

    if (!inBook) {
      // Small inner-shadow at top of squircle
      const fromTop = py / size;
      const shadowAdd = fromTop < 0.1 ? Math.round((0.1 - fromTop) * 60) : 0;
      return [Math.min(255, bgR + shadowAdd), Math.min(255, bgG + shadowAdd), Math.min(255, bgB + shadowAdd), alpha];
    }

    const bookGradT = (py - by1) / (by2 - by1); // 0=top, 1=bottom

    if (px >= pagesX1) {
      // Page edges — cream/parchment with subtle horizontal line texture
      const linePos = (py - by1) % pageLineSpacing;
      const isLine = linePos < Math.max(1, Math.round(1.5 * s));
      const cream = isLine ? 185 : 218;
      const creamG = isLine ? 178 : 208;
      const creamB = isLine ? 148 : 175;
      return [cream, creamG, creamB, alpha];
    }

    if (px < spineX2) {
      // Spine — dark brown-green
      const spineBase = [28, 48, 28];
      // Left-edge highlight (thin strip)
      const fromSpineLeft = px - bx1;
      if (fromSpineLeft < Math.max(2, Math.round(4 * s))) {
        // Highlight strip: slightly lighter
        return [Math.round(spineBase[0] * 1.6), Math.round(spineBase[1] * 1.5), Math.round(spineBase[2] * 1.6), alpha];
      }
      return [spineBase[0], spineBase[1], spineBase[2], alpha];
    }

    // Main cover — gradient: lighter at top-left, darker at bottom-right
    const coverLight = 0.38 + (1 - bookGradT) * 0.14; // 0.52 at top, 0.38 at bottom
    const coverR = Math.round(10 * coverLight);
    const coverG = Math.round(120 * coverLight);
    const coverB = Math.round(10 * coverLight);

    // Subtle horizontal rule lines on cover (faint)
    const ruleSpacing = Math.round(48 * s);
    const rulePos = Math.round((py - by1 - Math.round(40*s)) % ruleSpacing);
    const isRule = rulePos >= 0 && rulePos < Math.max(1, Math.round(1.5 * s)) && py > by1 + Math.round(80*s) && py < by2 - Math.round(80*s);
    if (isRule) {
      return [Math.round(coverR * 0.7), Math.round(coverG * 0.7), Math.round(coverB * 0.7), alpha];
    }

    return [coverR, coverG, coverB, alpha];
  });
}

module.exports = { makeCircleIcon, makeBookIcon, makeAppIcon };
