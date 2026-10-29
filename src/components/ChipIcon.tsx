"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { CHIP_ART } from "@/lib/chipArt";
import { chipInks } from "@/lib/chipsets";

/**
 * A Planary Chip, drawn flat in two inks. Used for balances (the brand mark is CasinoLogo);
 * with a `value` it's a table chip in that denomination's colours (and the player's chip set).
 * A set with art of its own (the Midnight Macau sets) is drawn from that art instead.
 */
export function ChipIcon({ size = 18, letter, value, set }: { size?: number; letter?: string; value?: number; set?: string | null }) {
  const art = value && set ? CHIP_ART[set]?.[value] : undefined;
  if (art) return <ArtChip size={size} viewBox={art.viewBox} body={art.body} />;

  const colors = value ? chipInks(set, value) : { fill: "var(--cherry)", ink: "var(--paper)" };
  const label = letter ?? (value ? String(value) : null);
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="chip-icon">
      <circle cx="20" cy="20" r="19" fill={colors.fill} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={colors.ink} strokeWidth="4" strokeDasharray="6.1 6.1" />
      <circle cx="20" cy="20" r="10.5" fill={colors.ink} />
      {label ? (
        <text
          x="20"
          y={label.length >= 3 ? "24.6" : "26.2"}
          textAnchor="middle"
          fontSize={label.length >= 3 ? 11.5 : 17}
          fontWeight="900"
          fontFamily="var(--font-poster)"
          fill={value ? colors.fill : "var(--cherry)"}
        >
          {label}
        </text>
      ) : (
        <circle cx="20" cy="20" r="6.5" fill={colors.fill} />
      )}
    </svg>
  );
}

/**
 * Chip art from the design, inline so the numbers take the site's poster face. Ids are made
 * unique per chip, so a gradient never points at a copy in another (perhaps hidden) chip.
 * Anything above the chip, like the lucky cat on the 500, is allowed to overflow.
 */
function ArtChip({ size, viewBox, body }: { size: number; viewBox: string; body: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const html = useMemo(() => body.replace(/id="([^"]+)"/g, `id="${uid}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${uid}-$1)`), [body, uid]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pauseAnimations();
  }, [html]);
  return (
    <svg
      ref={ref}
      viewBox={viewBox}
      width={size}
      height={size}
      overflow="visible"
      aria-hidden="true"
      className="chip-icon chip-art"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
