/**
 * Most titles are a plain pill. A few carry a look of their own (an icon, their own inks)
 * keyed on the title's id, and one shows a label that isn't its name.
 */
const LABELS: Record<string, string> = { "title-risk-for-riches": "险中求" };

export function titleLabel(id: string | null | undefined, name: string) {
  return (id && LABELS[id]) || name;
}

/** A title as plain text in a line (friends list, leaderboard, account menu), in its own look where it has one. */
export function TitleText({ id, name }: { id?: string | null; name: string }) {
  const label = titleLabel(id, name);
  return (
    <span className={`title-text${id ? ` ${id}` : ""}`} title={label !== name ? name : undefined}>
      {label}
    </span>
  );
}

export function TitlePill({ id, name, className, style }: { id?: string | null; name: string; className: string; style?: React.CSSProperties }) {
  const label = titleLabel(id, name);
  return (
    <span className={`${className} title-pill${id ? ` ${id}` : ""}`} style={style} title={label !== name ? name : undefined}>
      {label}
    </span>
  );
}
