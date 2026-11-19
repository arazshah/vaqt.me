'use client';

import { useEffect, useRef } from 'react';
import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  /** Module colour; the quiet zone is always white so scanners work. */
  ink?: string;
  label: string;
}

const MODULE_PX = 6;

export function QrCode({ value, ink = '#111111', label }: QrCodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    canvas.width = canvas.height = n * MODULE_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ink;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(c * MODULE_PX, r * MODULE_PX, MODULE_PX, MODULE_PX);
        }
      }
    }
  }, [value, ink]);

  return <canvas ref={ref} role="img" aria-label={label} />;
}
