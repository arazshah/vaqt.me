// The app icon (indigo tile, ring + dot) drawn with plain shapes so the
// og/image renderer can use it for the favicon, Apple icon and PWA icons.
// Same geometry as apps/web/public/brand/logo-mark.svg.
export function BrandIcon({
  size,
  rounded = true,
}: {
  size: number;
  /** false = full-bleed square, for maskable icons the OS crops itself. */
  rounded?: boolean;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#4338ca',
        borderRadius: rounded ? Math.round(size * 0.22) : 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 1024 1024">
        <circle
          cx="512"
          cy="512"
          r="300"
          fill="none"
          stroke="#ffffff"
          strokeWidth="56"
          opacity="0.45"
        />
        <circle cx="512" cy="512" r="150" fill="#ffffff" />
      </svg>
    </div>
  );
}
