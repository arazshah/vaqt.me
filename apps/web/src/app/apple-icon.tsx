import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  // iOS rounds the corners itself, so the tile is full-bleed.
  return new ImageResponse(<BrandIcon size={180} rounded={false} />, {
    ...size,
  });
}
