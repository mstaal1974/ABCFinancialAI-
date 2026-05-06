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
const SRC_BOTTLE = "/perfume%20bottle.jpg";    // ~511 × 561 single-bottle shot
const SRC_FULL   = "/perfume%20bottle%202.png"; // wide pair shot (bottle + tube)

/**
 * Real-product photograph used as the bottle visual. The fragrance name is
 * overlaid onto the bottle's blank white label panel; on the PDP the
 * customer's optional engraving appears underneath in cursive italic.
 *
 * Two crops:
 *  - "bottle" → /public/perfume bottle.jpg (single, ~1:1.1 portrait)
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
  const aspect = crop === "bottle" ? "511/561" : "16/9";
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
  // Position of the bottle's blank white label panel, expressed as a
  // percentage of the figure's box. Calibrated against the two source
  // photos — adjust if you swap them for a re-shoot.
  const pos =
    crop === "bottle"
      ? // Single-bottle shot: panel sits dead-center horizontally,
        // about 62% from the top of the frame, occupies ~33% width.
        { left: "50%", top: "62%", width: "32%" }
      : // Wide pair shot: bottle is on the left half. Panel center is
        // around 21% from left and 50% from top, ~12% wide.
        { left: "21%", top: "50%", width: "13%" };

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
      <div
        className="serif font-medium text-obsidian leading-[1.05] tracking-tight whitespace-nowrap"
        style={{
          // Container-query unit so the same component works tiny on a
          // card (min ~5 px) and large on the PDP (~24 px).
          fontSize: "clamp(7px, 4cqw, 26px)",
        }}
      >
        {fragrance.name}
      </div>

      {engraved ? (
        <div
          className="serif italic text-rust mt-[0.3em] leading-[1] truncate w-full"
          style={{
            fontSize: "clamp(6px, 2.6cqw, 16px)",
          }}
        >
          {engraved}
        </div>
      ) : null}
    </div>
  );
}
