import { chipInks } from "@/lib/chipsets";

/**
 * A Planary Chip, drawn flat in two inks. Used for balances and as the brand mark;
 * with a `value` it's a table chip in that denomination's colours (and the player's chip set).
 */
export function ChipIcon({ size = 18, letter, value, set }: { size?: number; letter?: string; value?: number; set?: string | null }) {
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
