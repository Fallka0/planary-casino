import Link from "next/link";
import { GameTile } from "@/components/GameTile";
import { RankList } from "@/components/RankList";
import { Spotlight } from "@/components/Spotlight";
import { GAMES } from "@/lib/games";
import { SAMPLE_LEADERBOARD } from "@/lib/sample";

export default function Lobby() {
  return (
    <>
      <div className="lobby-top">
        <Spotlight games={GAMES} />

        <section className="panel" aria-labelledby="board-title">
          <div className="panel-head">
            <h2 id="board-title">This week</h2>
            <span className="sample-tag">Sample</span>
          </div>
          <RankList ranks={SAMPLE_LEADERBOARD} />
          <Link href="/leaderboard" className="panel-link">
            Full leaderboard
          </Link>
        </section>
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
