import { type Game, gameUrl } from "@/lib/games";
import { Poster, posterField, posterInk } from "./Poster";

export function GameTile({ game, first = false }: { game: Game; first?: boolean }) {
  const isLive = game.status === "live";
  const style = { "--field": posterField(game.id), "--ink": posterInk(game.id) } as React.CSSProperties;
  const body = (
    <>
      <Poster game={game.id} className="tile-art" />
      <span className="pill tile-pill">{isLive ? "Open now" : first ? "Opens first" : "Coming soon"}</span>
      <div className="tile-copy">
        <h3>{game.name}</h3>
        <p className="tile-caption">{game.caption}</p>
        <ul className="tags" aria-label="Tags">
          {game.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      </div>
    </>
  );

  // Only open tables are links; closed ones stay still so they don't promise a click.
  return isLive ? (
    <a className="tile is-live" style={style} href={gameUrl(game)} aria-label={`Play ${game.name}`}>
      {body}
    </a>
  ) : (
    <article className="tile" style={style}>
      {body}
    </article>
  );
}
