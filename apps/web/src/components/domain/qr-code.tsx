'use client';

import { useEffect, useRef } from 'react';

import { drawQr } from '@/lib/qr';

interface QrCodeProps {
  value: string;
  /** Module colour; the quiet zone is always white so scanners work. */
  ink?: string;
  label: string;
}

export function QrCode({ value, ink = '#111111', label }: QrCodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) drawQr(ref.current, value, ink);
  }, [value, ink]);

  return <canvas ref={ref} role="img" aria-label={label} />;
}
