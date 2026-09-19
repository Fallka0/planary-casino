import { useId } from "react";
import { Camera, Crown, Disc3, DoorOpen, Gift, MessageCircle, ShoppingBag, Spade, TrendingDown, Users, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  spade: Spade,
  wheel: Disc3,
  down: TrendingDown,
  chat: MessageCircle,
  gift: Gift,
  door: DoorOpen,
  users: Users,
  crown: Crown,
  camera: Camera,
  bag: ShoppingBag,
};

/** Grade inks: [face, glyph, off-register plate, rim]. */
const INKS = {
  1: { face: "#f6eee4", glyph: "#22060e", plate: "#ff5a78", rim: "#6d0a1d" },
  2: { face: "#d9173c", glyph: "#f6eee4", plate: "#6d0a1d", rim: "#f6eee4" },
  3: { face: "url(#g)", glyph: "#2a0915", plate: "#b45309", rim: "#fff3c4" },
  4: { face: "#22060e", glyph: "#fff3c4", plate: "#ff2e55", rim: "url(#h)" },
} as const;

function glyphSize(glyph: string) {
  const n = [...glyph].length;
  return n <= 2 ? 46 : n === 3 ? 38 : n === 4 ? 31 : 25;
}

/** A 16-point star for the rarest badges. */
function burst(cx: number, cy: number, outer: number, inner: number, points = 16) {
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(" ");
}

function octagon(cx: number, cy: number, r: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

/**
 * A screen-printed medal. Grade sets the shape and inks: paper disc, cherry chip, gold octagon, holo star.
 * The glyph is printed twice, a hair out of register, like the posters.
 */
export function AchievementBadge({
  grade,
  glyph,
  size = 96,
  locked = false,
  label,
}: {
  grade: 1 | 2 | 3 | 4;
  glyph: string;
  size?: number;
  locked?: boolean;
  label?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const ink = INKS[grade];
  const icon = glyph.startsWith("@") ? ICONS[glyph.slice(1)] : null;
  const fs = glyphSize(glyph);
  const ref = (name: string) => `url(#${name}${uid})`;
  const face = typeof ink.face === "string" && ink.face.startsWith("url") ? ref(ink.face.slice(5, -1)) : ink.face;
  const rim = typeof ink.rim === "string" && ink.rim.startsWith("url") ? ref(ink.rim.slice(5, -1)) : ink.rim;

  const printGlyph = (fill: string, dx: number, dy: number, opacity = 1) =>
    icon ? (
      (() => {
        const Icon = icon;
        return <Icon x={60 - 19 + dx} y={60 - 19 + dy} size={38} strokeWidth={2.6} color={fill} opacity={opacity} />;
      })()
    ) : (
      <text
        x={60 + dx}
        y={61 + dy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-poster), sans-serif"
        fontWeight={900}
        fontSize={fs}
        letterSpacing={fs > 40 ? -1 : 0}
        fill={fill}
        opacity={opacity}
      >
        {glyph}
      </text>
    );

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`medal medal-g${grade}${locked ? " is-locked" : ""}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7a6" />
          <stop offset="0.45" stopColor="#e2a93b" />
          <stop offset="0.7" stopColor="#f7d77e" />
          <stop offset="1" stopColor="#b8761c" />
        </linearGradient>
        <linearGradient id={`h${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5a78" />
          <stop offset="0.3" stopColor="#fff3c4" />
          <stop offset="0.55" stopColor="#8ee6ff" />
          <stop offset="0.8" stopColor="#c58bff" />
          <stop offset="1" stopColor="#ff5a78" />
        </linearGradient>
        <pattern id={`d${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2.5" cy="2.5" r="1" fill={grade === 2 || grade === 4 ? "#000" : "#6d0a1d"} />
        </pattern>
        <clipPath id={`c${uid}`}>
          {grade === 3 ? <polygon points={octagon(60, 60, 50)} /> : <circle cx="60" cy="60" r={grade === 4 ? 40 : 50} />}
        </clipPath>
      </defs>

      {grade === 4 ? (
        <g className="medal-burst">
          <polygon points={burst(60, 60, 58, 46)} fill={ref("h")} />
          <polygon points={burst(60, 60, 58, 46)} fill={ref("d")} opacity="0.25" />
        </g>
      ) : null}

      {/* Face */}
      {grade === 3 ? (
        <polygon points={octagon(60, 60, 50)} fill={face} stroke={rim} strokeWidth="3" />
      ) : (
        <circle cx="60" cy="60" r={grade === 4 ? 40 : 50} fill={face} stroke={rim} strokeWidth={grade === 4 ? 3.5 : 3} />
      )}

      {/* Chip edge on the cherry grade: eight paper inserts round the rim. */}
      {grade === 2 ? <circle cx="60" cy="60" r="45" fill="none" stroke="#f6eee4" strokeWidth="7" strokeDasharray="14.3 21" transform="rotate(-8 60 60)" /> : null}
      {grade !== 4 ? <circle cx="60" cy="60" r={grade === 2 ? 36 : 40} fill="none" stroke={ink.rim} strokeWidth="1.5" strokeDasharray={grade === 1 ? "2 3" : undefined} opacity="0.8" /> : null}

      {/* Print texture and the holo sheen, kept inside the face. */}
      <g clipPath={ref("c")}>
        <rect width="120" height="120" fill={ref("d")} opacity={grade === 1 ? 0.12 : 0.16} />
        {grade >= 3 ? <rect className="medal-sheen" x="-60" y="-10" width="40" height="140" fill="#fff" opacity="0.28" transform="rotate(24 60 60)" /> : null}
      </g>

      {printGlyph(ink.plate, 2.2, 2, 0.85)}
      {printGlyph(ink.glyph, 0, 0)}
    </svg>
  );
}
