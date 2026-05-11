import { useState } from "react";
import type { Fragrance } from "../lib/types";
import Bottle from "./Bottle";

type Crop = "bottle" | "full";

type Props = {
  fragrance: Fragrance;
  /** "bottle" → single bottle shot. "full" → bottle + packaging tube pair. */
  crop?: Crop;
  customLabel?: string | null;
  className?: string;
};

// URL-encoded paths because the source assets contain spaces.
const SRC_BOTTLE = "/Fragrance%20Bottle%203.png"; // amber bottle on black stand, gold MAISON OBSIDIAN label
const SRC_FULL   = "/perfume%20bottle%202.png";   // wide pair shot (bottle + tube)

/**
 * Real-product photograph used as the bottle visual. The fragrance name is
 * overlaid in gold onto the blank space under the "MAISON OBSIDIAN" brand
 * mark on the bottle; on the PDP an optional engraving appears underneath
 * in cursive italic.
 *
 * Two crops:
 *  - "bottle" → /public/Fragrance Bottle 3.png (single, ~7:8 portrait)
 *  - "full"   → /public/perfume bottle 2.png (pair, ~16:9)
 *
 * If the photos move or are re-shot, only the SRC_* constants and the
 * `pos` table inside <LabelOverlay /> need to change.
 */
export default function BottlePhoto({
  fragrance,
  crop = "bottle",
  customLabel,
  className = "",
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmedLabel = (customLabel ?? "").trim();
  // Match the source aspect ratios so nothing letterboxes.
  const aspect = crop === "bottle" ? "7/8" : "16/9";
  const src = crop === "bottle" ? SRC_BOTTLE : SRC_FULL;

  // Until/unless the photos load, fall back to the SVG bottle.
  if (imgFailed) {
    return (
      <figure
        className={`relative overflow-hidden bg-obsidian flex items-end justify-center ${className}`}
        style={{ aspectRatio: aspect }}
      >
        <Bottle
          fragrance={fragrance}
          customLabel={customLabel}
          className="h-full w-auto"
        />
      </figure>
    );
  }

  return (
    <figure
      className={`relative overflow-hidden bg-obsidian ${className}`}
      style={{ aspectRatio: aspect, containerType: "inline-size" }}
    >
      <img
        src={src}
        alt={`${fragrance.name} — ${fragrance.inspiration}`}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <LabelOverlay crop={crop} fragrance={fragrance} engraved={trimmedLabel} />
    </figure>
  );
}

function LabelOverlay({
  crop,
  fragrance,
  engraved,
}: {
  crop: Crop;
  fragrance: Fragrance;
  engraved: string;
}) {
  // Position of the gold name slot, expressed as a percentage of the
  // figure's box. Calibrated against the two source photos — adjust if
  // you swap them for a re-shoot.
  const pos =
    crop === "bottle"
      ? // Single-bottle shot (Fragrance Bottle 3.png): the bottle's
        // brand mark "MAISON / OBSIDIAN" sits centered at ~56% from
        // left, ~54% from top. The fragrance name aligns to that same
        // vertical axis, just under the brand, in the amber band.
        { left: "50%", top: "60%", width: "26%" }
      : // Wide pair shot: bottle is on the left half. Brand mark is
        // around 21% from left, 50% from top.
        { left: "21%", top: "45%", width: "10%" };

  return (
    <div
      className="absolute pointer-events-none flex flex-col items-center justify-center text-center"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.width,
        transform: "translate(-50%, -50%)",
      }}
      aria-hidden
    >
      <NameLockup name={fragrance.name} />

      {/* engraved follows */}
      {engraved ? (
        <div
          className="serif italic mt-[0.4em] leading-none truncate w-full"
          style={{
            color: "#e9d9a8",
            fontSize: "clamp(5px, 1.7cqw, 12px)",
            textShadow: "0 1px 1px rgba(0,0,0,0.45)",
          }}
        >
          {engraved}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Renders the fragrance name as a centered gold lockup. Exactly two-word
 * names are stacked one word per line (matching the "MAISON / OBSIDIAN"
 * treatment on the bottle); single-word or 3+ word names stay on one
 * line with natural wrapping.
 */
function NameLockup({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const stack = words.length === 2;
  const sharedStyle: React.CSSProperties = {
    color: "#c9a961",
    fontSize: "clamp(10px, 3.4cqw, 26px)",
    textShadow: "0 1px 1px rgba(0,0,0,0.45)",
  };
  const className =
    "serif font-medium leading-tight tracking-[0.08em] uppercase text-center w-full";

  if (stack) {
    return (
      <div className="flex flex-col items-center w-full">
        <div className={className} style={sharedStyle}>{words[0]}</div>
        <div className={className} style={sharedStyle}>{words[1]}</div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ ...sharedStyle, wordBreak: "break-word" }}
    >
      {name}
    </div>
  );
}
