import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
        fontSize: 96,
        fontWeight: 700,
      }}
    >
      V
    </div>,
    { ...size },
  );
}
