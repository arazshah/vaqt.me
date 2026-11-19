import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { loadSharp } from './load-sharp';
import type { DetectedImageMime } from './image-magic-bytes';

export const MAIN_SIZE = 400;
export const THUMBNAIL_SIZE = 96;

export interface ProcessedAvatar {
  main: Buffer;
  thumbnail: Buffer;
}

async function withSharp(buffer: Buffer): Promise<ProcessedAvatar> {
  const sharp = await loadSharp();
  // sharp's default output never carries over source EXIF/ICC/GPS metadata
  // unless .withMetadata() is called — re-encoding is what strips it.
  const main = await sharp(buffer)
    .resize(MAIN_SIZE, MAIN_SIZE, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toBuffer();
  const thumbnail = await sharp(buffer)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
  return { main, thumbnail };
}

const MAX_PIXELS = 40_000_000;

interface Raster {
  width: number;
  height: number;
  data: Uint8Array; // RGBA
}

function decodeRaster(buffer: Buffer, mime: DetectedImageMime): Raster {
  if (mime === 'image/png') {
    // Refuse decompression bombs before inflating: IHDR holds the size.
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width * height > MAX_PIXELS) throw new Error('image too large');
    const png = PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  }
  const jpg = jpeg.decode(buffer, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: MAX_PIXELS / 1_000_000,
  });
  return { width: jpg.width, height: jpg.height, data: jpg.data };
}

// Center-crops to a square and area-averages down to `size` px. Alpha is
// flattened onto white because JPEG has none.
function squareCover(src: Raster, size: number): Raster {
  const side = Math.min(src.width, src.height);
  const ox = (src.width - side) / 2;
  const oy = (src.height - side) / 2;
  const scale = side / size;
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const y0 = oy + y * scale;
    const y1 = y0 + scale;
    for (let x = 0; x < size; x++) {
      const x0 = ox + x * scale;
      const x1 = x0 + scale;
      let r = 0;
      let g = 0;
      let b = 0;
      let weight = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++) {
        const wy = Math.min(sy + 1, y1) - Math.max(sy, y0);
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
          const w = wy * (Math.min(sx + 1, x1) - Math.max(sx, x0));
          const i =
            (Math.min(sy, src.height - 1) * src.width +
              Math.min(sx, src.width - 1)) *
            4;
          const a = src.data[i + 3] / 255;
          r += w * (src.data[i] * a + 255 * (1 - a));
          g += w * (src.data[i + 1] * a + 255 * (1 - a));
          b += w * (src.data[i + 2] * a + 255 * (1 - a));
          weight += w;
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / weight);
      out[o + 1] = Math.round(g / weight);
      out[o + 2] = Math.round(b / weight);
      out[o + 3] = 255;
    }
  }
  return { width: size, height: size, data: out };
}

// Pure-JS fallback for machines where sharp's native binary can't load
// (e.g. a VM exposing a baseline CPU). Slower, same output shape: decode →
// square crop → re-encode as JPEG, which also drops all EXIF/GPS metadata.
// JPEG and PNG only; there is no pure-JS WebP decoder here.
function withPureJs(buffer: Buffer, mime: DetectedImageMime): ProcessedAvatar {
  if (mime === 'image/webp') throw new UnsupportedWithoutSharpError();
  const src = decodeRaster(buffer, mime);
  const encode = (size: number, quality: number) =>
    Buffer.from(jpeg.encode(squareCover(src, size), quality).data);
  return { main: encode(MAIN_SIZE, 85), thumbnail: encode(THUMBNAIL_SIZE, 80) };
}

export class UnsupportedWithoutSharpError extends Error {}

export async function processAvatar(
  buffer: Buffer,
  mime: DetectedImageMime,
): Promise<ProcessedAvatar> {
  try {
    await loadSharp();
  } catch {
    return withPureJs(buffer, mime);
  }
  return withSharp(buffer);
}
