import { useState } from "react";
import type { Fragrance } from "../lib/types";
import Bottle from "./Bottle";

type Crop = "bottle" | "full";

type Props = {
  fragrance: Fragrance;
  /** "bottle" shows only the bottle (left half); "full" shows bottle + tube. */
  crop?: Crop;
  customLabel?: string | null;
  className?: string;
};

/**
 * Real-product photograph used as the bottle visual. The fragrance name is
 * overlaid onto the bottle's blank white label panel; on the PDP the
 * customer's optional engraving appears underneath in cursive italic.
 *
 * The image lives at /public/bottle-photo.jpg (drop the source file there).
 * The original is a wide pair shot — bottle on the left, packaging tube on
 * the right. With `crop="bottle"` we shift the visible area to the left
 * half via object-position so only the bottle shows; `crop="full"` shows
 * the full pair.
 *
 * If you re-photograph with a different label position, tweak the
 * percentage values in <LabelOverlay /> below.
 */
export default function BottlePhoto({
  fragrance,
  crop = "bottle",
  customLabel,
  className = "",
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const trimmedLabel = (customLabel ?? "").trim();
  // Aspect ratio of the visible region. The source is ~1024x563 (≈1.82:1).
  // Bottle-only crop is roughly square-leaning portrait; full pair uses
  // the source ratio.
  const aspect = crop === "bottle" ? "5/6" : "16/9";

  // Until the photo is dropped in at /public/bottle-photo.jpg we fall back
  // to the SVG bottle so the demo always renders something.
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
        src="/bottle-photo.jpg"
        alt={`${fragrance.name} — ${fragrance.inspiration}`}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          // For the bottle-only crop we slide the wide source image left so
          // only the bottle half is visible. The full-pair crop centers it.
          objectPosition: crop === "bottle" ? "22% center" : "center",
          // The full source covers a wider area than the bottle-only frame
          // so we scale up to keep the bottle in frame.
          transform: crop === "bottle" ? "scale(1.18)" : "scale(1)",
          transformOrigin: "30% 55%",
        }}
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
  // Position of the bottle's blank white label panel as a percentage of the
  // figure's box. Calibrated for /public/bottle-photo.jpg — adjust if you
  // swap the source photo. The bottle-only crop has the bottle horizontally
  // centered in the frame; the full-pair crop has it on the left.
  const pos =
    crop === "bottle"
      ? { left: "50%", top: "60%", width: "30%" }
      : { left: "23%", top: "60%", width: "11%" };

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
        className="serif font-medium text-obsidian leading-[1.05] tracking-tight"
        style={{
          // Scale with container width so it works in cards and PDP.
          fontSize: "clamp(8px, 1.6cqw + 0.45rem, 22px)",
          textShadow: "0 0 1px rgba(255,255,255,0.4)",
        }}
      >
        {fragrance.name}
      </div>

      {engraved ? (
        <div
          className="serif italic text-rust mt-[0.35em] leading-[1] truncate w-full"
          style={{
            fontSize: "clamp(6px, 1.05cqw + 0.3rem, 13px)",
          }}
        >
          {engraved}
        </div>
      ) : null}
    </div>
  );
}
