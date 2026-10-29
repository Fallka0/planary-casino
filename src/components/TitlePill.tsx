/**
 * Most titles are a plain pill. A few carry a look of their own (an icon, their own inks)
 * keyed on the title's id, and one shows a label that isn't its name.
 */
const LABELS: Record<string, string> = { "title-risk-for-riches": "险中求" };

export function titleLabel(id: string | null | undefined, name: string) {
  return (id && LABELS[id]) || name;
}

export function TitlePill({ id, name, className, style }: { id?: string | null; name: string; className: string; style?: React.CSSProperties }) {
  const label = titleLabel(id, name);
  return (
    <span className={`${className} title-pill${id ? ` ${id}` : ""}`} style={style} title={label !== name ? name : undefined}>
      {label}
    </span>
  );
}
