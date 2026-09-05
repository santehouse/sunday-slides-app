/**
 * Minimal image dimension sniffers for JPG/PNG/WebP — reads just the header
 * bytes (no `sharp`/native deps, keeping the app on pure-JS dependencies per
 * CLAUDE.md's cost/stack constraints). Used by the asset upload action.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function readPng(bytes: Uint8Array): ImageDimensions | null {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR"(4) width(4) height(4), big-endian.
  if (bytes.length < 24) return null;
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (!isPng) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

function readJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    // SOF0..SOF15 except DHT(C4)/JPG(C8)/DAC(CC) carry width/height.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    const segmentLength = view.getUint16(offset + 2, false);
    if (isSof) {
      const height = view.getUint16(offset + 5, false);
      const width = view.getUint16(offset + 7, false);
      return { width, height };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebp(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;

  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (chunk === "VP8X") {
    // 24-bit little-endian width-1 / height-1 at offsets 24 and 27.
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { width, height };
  }
  if (chunk === "VP8 ") {
    // Lossy: 3-byte frame tag at 20-22, then a 0x9d012a sync code, then width/height (14 bits each, little-endian).
    if (bytes.length < 30) return null;
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return { width, height };
  }
  if (chunk === "VP8L") {
    // Lossless: 1-byte signature (0x2f) then 14+14 bit width-1/height-1 packed little-endian.
    const b0 = bytes[21]!;
    const b1 = bytes[22]!;
    const b2 = bytes[23]!;
    const b3 = bytes[24]!;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | (b1 >> 6));
    return { width, height };
  }
  return null;
}

/** Returns `{ width, height }` for a JPEG, PNG, or WebP buffer, or `null` if the format is unrecognized. */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
}
