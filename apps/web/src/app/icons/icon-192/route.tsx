import { ImageResponse } from 'next/og';
import { BrandIcon } from '@/lib/brand-icon';

// Referenced explicitly from manifest.ts: PWA install prompts expect at least
// a 192 and a 512 entry, and the special icon.tsx convention only produces
// one favicon-sized image. Full-bleed so it also works as a maskable icon.
export function GET() {
  return new ImageResponse(<BrandIcon size={192} rounded={false} />, {
    width: 192,
    height: 192,
  });
}
