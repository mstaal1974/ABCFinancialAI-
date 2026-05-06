import type { Fragrance } from "../lib/types";

type Props = {
  fragrance: Fragrance;
  customLabel?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * 2D apothecary bottle mockup. Pure SVG so the engraved label updates in
 * real time as the user types. The `accent` and `liquidColor` props vary
 * per fragrance to give the grid visual rhythm.
 */
export default function Bottle({ fragrance, customLabel, size = "md", className = "" }: Props) {
  const dims = size === "lg" ? { w: 320, h: 480 } : size === "sm" ? { w: 120, h: 180 } : { w: 220, h: 340 };
  const { accent, liquidColor, glassTint, name } = fragrance;
  const trimmedLabel = (customLabel ?? "").trim();
  const showLabel = trimmedLabel.length > 0;

  return (
    <svg
      viewBox="0 0 220 340"
      width={dims.w}
      height={dims.h}
      className={className}
      role="img"
      aria-label={`${name} bottle preview${showLabel ? ` — engraved with ${trimmedLabel}` : ""}`}
    >
      <defs>
        <linearGradient id={`glass-${fragrance.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1a22" stopOpacity="1" />
          <stop offset="50%" stopColor={glassTint} stopOpacity="1" />
          <stop offset="100%" stopColor="#070709" stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`liquid-${fragrance.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`gold-${fragrance.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="50%" stopColor="#f3d98a" />
          <stop offset="100%" stopColor={accent} />
        </linearGradient>
        <radialGradient id={`shine-${fragrance.id}`} cx="0.3" cy="0.2" r="0.6">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cap */}
      <rect x="86" y="10" width="48" height="46" rx="2" fill={`url(#gold-${fragrance.id})`} />
      <rect x="86" y="10" width="48" height="6" rx="1" fill="#000" opacity="0.25" />
      <rect x="86" y="50" width="48" height="6" rx="1" fill="#000" opacity="0.35" />

      {/* Collar */}
      <rect x="92" y="56" width="36" height="14" fill="#1a1a22" />
      <rect x="92" y="56" width="36" height="3" fill={accent} opacity="0.6" />

      {/* Bottle body */}
      <path
        d="M70 70 L150 70 L160 90 L160 300 Q160 320 140 320 L80 320 Q60 320 60 300 L60 90 Z"
        fill={`url(#glass-${fragrance.id})`}
        stroke={accent}
        strokeOpacity="0.35"
        strokeWidth="0.6"
      />

      {/* Liquid */}
      <clipPath id={`bodyclip-${fragrance.id}`}>
        <path d="M70 70 L150 70 L160 90 L160 300 Q160 320 140 320 L80 320 Q60 320 60 300 L60 90 Z" />
      </clipPath>
      <g clipPath={`url(#bodyclip-${fragrance.id})`}>
        <rect x="60" y="170" width="100" height="160" fill={`url(#liquid-${fragrance.id})`} />
        <rect x="60" y="70" width="100" height="260" fill={`url(#shine-${fragrance.id})`} />
      </g>

      {/* Label panel */}
      <rect
        x="76"
        y="180"
        width="68"
        height="100"
        rx="1"
        fill="#f3ecdc"
        opacity="0.92"
        stroke={accent}
        strokeOpacity="0.6"
        strokeWidth="0.5"
      />
      <line x1="82" y1="194" x2="138" y2="194" stroke={accent} strokeWidth="0.4" />
      <line x1="82" y1="266" x2="138" y2="266" stroke={accent} strokeWidth="0.4" />

      <text
        x="110"
        y="206"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        fontSize="6.5"
        fontWeight="600"
        letterSpacing="2"
        fill="#0b0b0d"
      >
        MAISON OBSIDIAN
      </text>
      <text
        x="110"
        y="222"
        textAnchor="middle"
        fontFamily="Cormorant Garamond, serif"
        fontSize="11"
        fontWeight="500"
        fill="#0b0b0d"
      >
        {name}
      </text>
      <text
        x="110"
        y="234"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="4.2"
        letterSpacing="1.4"
        fill="#0b0b0d"
        opacity="0.7"
      >
        {fragrance.oilPercent}% EXTRAIT · {fragrance.volumeMl}ML
      </text>

      {/* Engraved customer label */}
      <foreignObject x="80" y="240" width="60" height="22">
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Cormorant Garamond, serif",
            fontStyle: "italic",
            fontSize: 7,
            color: showLabel ? "#7a3e2a" : "#0b0b0d33",
            textAlign: "center",
            lineHeight: 1.05,
            wordBreak: "break-word",
            padding: "0 2px",
          }}
        >
          {showLabel ? trimmedLabel : "— your engraving —"}
        </div>
      </foreignObject>

      <text
        x="110"
        y="276"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontSize="3.6"
        letterSpacing="1.5"
        fill="#0b0b0d"
        opacity="0.6"
      >
        BATCH N° {fragrance.id.slice(-3).toUpperCase()}
      </text>

      {/* Bottle base reflections */}
      <ellipse cx="110" cy="320" rx="50" ry="3" fill="#000" opacity="0.5" />
    </svg>
  );
}
