import type { Metadata } from "next";
import { SoonPage } from "@/components/SoonPage";
import { GAMES } from "@/lib/games";
import { initials, SAMPLE_FRIENDS } from "@/lib/sample";

export const metadata: Metadata = { title: "Friends · Planary Casino" };

export default function FriendsPage() {
  return (
    <SoonPage
      title="Friends"
      sub="See who's online and pull them into a private table."
      what="Friend lists and online status arrive together with the first multiplayer table. The people below are sample data."
    >
      <ul className="people">
        {SAMPLE_FRIENDS.map((friend) => (
          <li key={friend.name} className="friend">
            <span className={`avatar is-${friend.status}`} aria-hidden="true">
              {initials(friend.name)}
            </span>
            <span className="friend-copy">
              <span className="friend-name">{friend.name}</span>
              <span className="friend-status">
                {friend.status === "away"
                  ? "Away"
                  : friend.game
                    ? `Waiting for ${GAMES.find((g) => g.id === friend.game)?.name}`
                    : "In the lobby"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </SoonPage>
  );
}
