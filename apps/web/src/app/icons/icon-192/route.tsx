import { ImageResponse } from 'next/og';

// Referenced explicitly from manifest.ts — not one of Next's special icon
// files (icon.tsx/apple-icon.tsx), which only produce a single favicon-sized
// image. PWA install prompts (Android/Chrome) expect at least a 192 and a
// 512 entry in the manifest's icons array.
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
        fontSize: 104,
        fontWeight: 700,
      }}
    >
      V
    </div>,
    { width: 192, height: 192 },
  );
}
