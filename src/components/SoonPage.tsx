/** Shared frame for sections whose backend doesn't exist yet: honest about it, with a sample preview. */
export function SoonPage({
  title,
  sub,
  what,
  children,
}: {
  title: string;
  sub: string;
  what: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">{title}</h1>
        <p className="page-sub">{sub}</p>
      </div>
      <div className="soon-note">
        <strong>Not live yet.</strong> {what}
      </div>
      {children ? (
        <div className="panel panel-wide">
          <div className="panel-head">
            <h2>Preview</h2>
            <span className="sample-tag">Sample</span>
          </div>
          {children}
        </div>
      ) : null}
    </section>
  );
}
