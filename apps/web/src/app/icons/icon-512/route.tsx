import { ImageResponse } from 'next/og';

// See icons/icon-192/route.tsx for why this is a hand-written route rather
// than the icon.tsx/apple-icon.tsx conventions.
export function GET() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#2E2547',
        color: '#EDE9F7',
        fontFamily: 'sans-serif',
        fontSize: 280,
        fontWeight: 700,
      }}
    >
      V
    </div>,
    { width: 512, height: 512 },
  );
}
