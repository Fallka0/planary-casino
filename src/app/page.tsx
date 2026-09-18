import Link from "next/link";
import { GameTile } from "@/components/GameTile";
import { Spotlight } from "@/components/Spotlight";
import { WeekBoard } from "@/components/WeekBoard";
import { GAMES } from "@/lib/games";

export default function Lobby() {
  return (
    <>
      <div className="lobby-top">
        <Spotlight games={GAMES} />

        <WeekBoard />
      </div>

      <section className="row" aria-labelledby="games-title">
        <div className="row-head">
          <h2 id="games-title">All tables</h2>
          <Link href="/games" className="row-link">
            Browse games
          </Link>
        </div>
        <div className="tiles">
          {GAMES.map((game, i) => (
            <GameTile key={game.id} game={game} first={i === 0} />
          ))}
        </div>
      </section>
    </>
  );
}
