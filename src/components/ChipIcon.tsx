/** A Planary Chip, drawn flat in the lobby's two inks. Used for balances and as the brand mark. */
export function ChipIcon({ size = 18, letter }: { size?: number; letter?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="chip-icon">
      <circle cx="20" cy="20" r="19" fill="var(--cherry)" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="var(--paper)" strokeWidth="4" strokeDasharray="6.1 6.1" />
      <circle cx="20" cy="20" r="10.5" fill="var(--paper)" />
      {letter ? (
        <text x="20" y="26.2" textAnchor="middle" fontSize="17" fontWeight="900" fontFamily="var(--font-poster)" fill="var(--cherry)">
          {letter}
        </text>
      ) : (
        <circle cx="20" cy="20" r="6.5" fill="var(--cherry)" />
      )}
    </svg>
  );
}
