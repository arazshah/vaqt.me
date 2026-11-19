import qrcode from 'qrcode-generator';

/**
 * Draws a QR code on a canvas: dark modules on a white quiet zone. `ink` must
 * stay dark enough for scanners; the zone is always white on purpose.
 */
export function drawQr(
  canvas: HTMLCanvasElement,
  value: string,
  ink = '#111111',
  modulePx = 6,
  quietModules = 0,
): void {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + quietModules * 2) * modulePx;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(
          (c + quietModules) * modulePx,
          (r + quietModules) * modulePx,
          modulePx,
          modulePx,
        );
      }
    }
  }
}

/** A PNG of the QR with a proper quiet zone, ready to download or print. */
export function qrPngDataUrl(value: string, ink = '#111111'): string {
  const canvas = document.createElement('canvas');
  drawQr(canvas, value, ink, 12, 4);
  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
