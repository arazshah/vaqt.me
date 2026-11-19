import { LOGO } from './logo-paths';

/**
 * The وقت · من wordmark as inline vector paths (no font needed). Text follows
 * the surrounding text colour; the dot and ring use the theme's primary
 * colour, so it works in light and dark without separate files.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={LOGO.viewBox}
      role="img"
      aria-label={'وقت من'}
      className={className}
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={LOGO.embolden}
        strokeLinejoin="round"
      >
        <path d={LOGO.mine} />
        <path d={LOGO.waqt} />
      </g>
      <g className="text-primary">
        <circle
          cx={LOGO.dot.cx}
          cy={LOGO.dot.cy}
          r={LOGO.dot.ringR}
          fill="none"
          stroke="currentColor"
          strokeWidth={58}
          opacity={0.4}
        />
        <circle
          cx={LOGO.dot.cx}
          cy={LOGO.dot.cy}
          r={LOGO.dot.r}
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
