import { useId } from "react"

/** Logo mellow: huruf "m" yang mengalir + titik emas (target/tabungan). Sama dengan public/icon.svg. */
export function BrandMark({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "")
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a2140" />
            <stop offset=".6" stopColor="#21152a" />
            <stop offset="1" stopColor="#140d18" />
          </linearGradient>
          <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffe1ec" />
            <stop offset=".5" stopColor="#f2a3c4" />
            <stop offset="1" stopColor="#b48ce2" />
          </linearGradient>
          <linearGradient id={`${id}d`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff0c4" />
            <stop offset="1" stopColor="#f1c46e" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="128" fill={`url(#${id}bg)`} />
        <path d="M150 346 V232 a53 53 0 0 1 106 0 V346 M256 232 a53 53 0 0 1 106 0 V300" fill="none" stroke={`url(#${id}m)`} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="396" cy="158" r="25" fill={`url(#${id}d)`} />
      </svg>
    </span>
  )
}
