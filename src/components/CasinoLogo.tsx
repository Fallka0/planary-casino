import { useId } from "react";

// The eight cream edge notches, as ring segments between r 33.4 and 44.5 (17.8° each).
const NOTCHES = "M43.12 6.04A44.5 44.5 0 0 1 56.88 6.04L55.17 17.00A33.4 33.4 0 0 0 44.83 17.00ZM76.22 14.04A44.5 44.5 0 0 1 85.96 23.78L76.99 30.32A33.4 33.4 0 0 0 69.68 23.01ZM93.96 43.12A44.5 44.5 0 0 1 93.96 56.88L83.00 55.17A33.4 33.4 0 0 0 83.00 44.83ZM85.96 76.22A44.5 44.5 0 0 1 76.22 85.96L69.68 76.99A33.4 33.4 0 0 0 76.99 69.68ZM56.88 93.96A44.5 44.5 0 0 1 43.12 93.96L44.83 83.00A33.4 33.4 0 0 0 55.17 83.00ZM23.78 85.96A44.5 44.5 0 0 1 14.04 76.22L23.01 69.68A33.4 33.4 0 0 0 30.32 76.99ZM6.04 56.88A44.5 44.5 0 0 1 6.04 43.12L17.00 44.83A33.4 33.4 0 0 0 17.00 55.17ZM14.04 23.78A44.5 44.5 0 0 1 23.78 14.04L30.32 23.01A33.4 33.4 0 0 0 23.01 30.32Z";

/**
 * Planary Casino's logo: a cherry chip with cream edge notches and a cream centre
 * holding the Planary mark (planet with its ring at −28°) in cherry. Below about
 * 43px the mark inside is under 24px, so it switches to the mark's heavier small cut.
 */
export function CasinoLogo({ size = 38, title }: { size?: number; title?: string }) {
  const base = "cl" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const small = size < 43;
  const m = small
    ? { ring: "M5 50A45 14 0 0 0 95 50", back: "M95 50A45 14 0 0 0 5 50", cut: 16, hole: 31, planet: 27, stroke: 8 }
    : { ring: "M6 50A44 12.5 0 0 0 94 50", back: "M94 50A44 12.5 0 0 0 6 50", cut: 11, hole: 28, planet: 25, stroke: 6.2 };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="casino-logo"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <mask id={`${base}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <path d={m.ring} transform="rotate(-28 50 50)" fill="none" stroke="#000" strokeWidth={m.cut} />
        </mask>
        <mask id={`${base}-back`} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect width="100" height="100" fill="#fff" />
          <circle cx="50" cy="50" r={m.hole} fill="#000" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="48" fill="var(--cherry)" />
      <path d={NOTCHES} fill="var(--paper)" />
      <circle cx="50" cy="50" r="29.1" fill="var(--paper)" />
      <g transform="translate(21.875 21.875) scale(.5625)" fill="none" stroke="var(--cherry)" strokeLinecap="round">
        <circle cx="50" cy="50" r={m.planet} fill="var(--cherry)" stroke="none" mask={`url(#${base}-cut)`} />
        <path d={m.back} transform="rotate(-28 50 50)" strokeWidth={m.stroke} mask={`url(#${base}-back)`} />
        <path d={m.ring} transform="rotate(-28 50 50)" strokeWidth={m.stroke} />
      </g>
    </svg>
  );
}
