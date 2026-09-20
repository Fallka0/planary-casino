import type { Metadata } from "next";
const BLACKJACK_URL = "https://21.planary.ch";
const ROULETTE_URL = "https://roulette.planary.ch";
const DEVIL_URL = "https://devil.planary.ch";

export const metadata: Metadata = {
  title: "Fair play · Planary Casino",
  description: "The rules, payouts and odds of every Planary Casino game. The same as a real casino.",
};

const UPDATED = "19 September 2026";

const ROULETTE_BETS = [
  { bet: "Straight", covers: "1 number", pays: "35:1", chance: "2.70%" },
  { bet: "Split", covers: "2 numbers", pays: "17:1", chance: "5.41%" },
  { bet: "Street", covers: "3 numbers", pays: "11:1", chance: "8.11%" },
  { bet: "Corner", covers: "4 numbers", pays: "8:1", chance: "10.81%" },
  { bet: "Line", covers: "6 numbers", pays: "5:1", chance: "16.22%" },
  { bet: "Dozen or column", covers: "12 numbers", pays: "2:1", chance: "32.43%" },
  { bet: "Red/black, even/odd, 1–18/19–36", covers: "18 numbers", pays: "1:1", chance: "48.65%" },
];

const BLACKJACK_PAYS = [
  { hand: "Blackjack (ace + ten-value card)", pays: "3:2" },
  { hand: "Beating the dealer", pays: "1:1" },
  { hand: "Tie with the dealer", pays: "Bet returned" },
  { hand: "Insurance, dealer has blackjack", pays: "2:1" },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default function RulesPage() {
  return (
    <section className="page rules" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Fair play</h1>
        <p className="page-sub">
          Every table uses the rules, payouts and odds of a real casino. Nothing is tilted, and nothing changes depending on who you are or how you&apos;ve
          been playing. This page says exactly how each game works.
        </p>
      </div>

      <section className="card" id="dealing" aria-labelledby="dealing-title">
        <h2 id="dealing-title">How outcomes are decided</h2>
        <ul className="rules-list">
          <li>
            <strong>The server decides, never your browser.</strong> Cards and spins are drawn on Planary&apos;s table server. Your browser only shows the
            result, so nobody can change one by editing the page.
          </li>
          <li>
            <strong>Cryptographic randomness.</strong> Every draw uses the operating system&apos;s cryptographic random generator, the kind used for
            encryption keys. We use rejection sampling, so every card and every pocket is exactly as likely as it should be, with no rounding bias.
          </li>
          <li>
            <strong>The same odds for everyone.</strong> Odds never adapt to your balance, your winning streak or anything else. A new player and a regular
            get the same shoe and the same wheel.
          </li>
          <li>
            <strong>Nothing leaks early, and nothing is chosen late.</strong> The dealer&apos;s face-down card never leaves the server until it&apos;s turned
            over. The roulette number follows from a seed the table commits to <em>before</em> betting opens, together with the seeds players add while it is
            open — so it cannot be picked after seeing your bets, and it cannot be known in advance either.
          </li>
          <li>
            <strong>You can check any spin yourself.</strong> The table shows the hash of its seed before you bet and publishes the seed once the ball lands.{" "}
            <a href="/verify">Put the two into the verifier</a> and it works the number out again in your browser, with the same code the table runs. You do not
            have to take our word for it.
          </li>
          <li>
            <strong>Checked by simulation.</strong> Before a game opens, we play millions of rounds against its rules and compare the result with the known
            house edge.
          </li>
        </ul>
      </section>

      <section className="card" id="blackjack" aria-labelledby="blackjack-title">
        <div className="rules-head">
          <h2 id="blackjack-title">Blackjack</h2>
          <div className="stats">
            <Stat value="99.5%" label="Return to player*" />
            <Stat value="0.4–0.5%" label="House edge*" />
          </div>
        </div>
        <div className="rules-cols">
          <div>
            <h3>House rules</h3>
            <ul className="rules-list compact">
              <li>Six decks in a shoe.</li>
              <li>Dealer stands on all 17s, including soft 17.</li>
              <li>Dealer peeks for blackjack when showing an ace or a ten. If the dealer has blackjack, the hand ends at once.</li>
              <li>Insurance is offered when the dealer shows an ace. It costs half your bet. With a blackjack of your own it works as even money.</li>
              <li>Double on any first two cards, also after a split.</li>
              <li>Split pairs into up to four hands. Split aces get one card each and can&apos;t be split again.</li>
              <li>21 made after a split counts as 21, not blackjack.</li>
              <li>No surrender. Bets from 10 to 2&apos;500 chips.</li>
            </ul>
          </div>
          <div>
            <h3>Payouts</h3>
            <table className="rules-table">
              <thead>
                <tr>
                  <th scope="col">Hand</th>
                  <th scope="col">Pays</th>
                </tr>
              </thead>
              <tbody>
                {BLACKJACK_PAYS.map((row) => (
                  <tr key={row.hand}>
                    <td>{row.hand}</td>
                    <td>{row.pays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Shuffling</h3>
            <p className="card-text">
              The dealer shuffles all six decks into a new shoe and places a cut card roughly three quarters of the way in. When the cut card comes out,
              the round is finished and the whole shoe is shuffled again, just like at a live table. You can watch it happen, and the shoe meter shows
              how far along the current shoe is.
            </p>
          </div>
        </div>
        <p className="rules-note">
          * With perfect basic strategy. A simulation of 20 million hands under these rules came out at 0.44%. Playing by feel costs more.
        </p>
        <div className="rules-actions">
          <a className="btn btn-cherry" href={BLACKJACK_URL}>
            Play Blackjack
          </a>
          <a className="btn btn-quiet" href={`${BLACKJACK_URL}/?tutorial=1`}>
            How to play
          </a>
        </div>
      </section>

      <section className="card" id="roulette" aria-labelledby="roulette-title">
        <div className="rules-head">
          <h2 id="roulette-title">Roulette</h2>
          <div className="stats">
            <Stat value="97.3%" label="Return to player" />
            <Stat value="2.70%" label="House edge" />
          </div>
        </div>
        <div className="rules-cols">
          <div>
            <h3>House rules</h3>
            <ul className="rules-list compact">
              <li>European single-zero wheel, as in Swiss casinos: 37 pockets, 0 to 36. 18 are red, 18 are black and zero is green.</li>
              <li>Every pocket has the same 1 in 37 chance on every spin. Past numbers don&apos;t change what comes next.</li>
              <li>When zero lands, all outside bets lose (no La Partage).</li>
              <li>20 seconds to bet each round, up to 5&apos;000 chips in total.</li>
              <li>Every bet has the same house edge of 1/37. It comes from the zero.</li>
            </ul>
          </div>
          <div>
            <h3>Payouts</h3>
            <table className="rules-table">
              <thead>
                <tr>
                  <th scope="col">Bet</th>
                  <th scope="col">Covers</th>
                  <th scope="col">Pays</th>
                  <th scope="col">Chance</th>
                </tr>
              </thead>
              <tbody>
                {ROULETTE_BETS.map((row) => (
                  <tr key={row.bet}>
                    <td>{row.bet}</td>
                    <td>{row.covers}</td>
                    <td>{row.pays}</td>
                    <td>{row.chance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rules-actions">
          <a className="btn btn-cherry" href={ROULETTE_URL}>
            Play Roulette
          </a>
          <a className="btn btn-quiet" href={`${ROULETTE_URL}/?tutorial=1`}>
            How to play
          </a>
          <a className="btn btn-quiet" href="/verify">
            Check a spin
          </a>
        </div>
      </section>

      <section className="card" id="devil" aria-labelledby="devil-title">
        <div className="rules-head">
          <h2 id="devil-title">Devil&apos;s Wheel</h2>
          <div className="stats">
            <Stat value="0" label="Chips wagered" />
            <Stat value="Solo" label="Against nobody" />
          </div>
        </div>
        <p className="rules-lede">
          The one game in the house where the wheel is not honest — and the only one where that is the point. Devil&apos;s
          Wheel is a single-player score game. You may buy your way into a wheel with three zeroes on it, weld the low
          numbers shut, or paint a pocket so it pays triple.
        </p>
        <div className="rules-cols">
          <div>
            <h3>Why it does not break the rest of this page</h3>
            <ul className="rules-list compact">
              <li>
                No Planary Chips go in and none come out. Nothing is wagered, so there is no return-to-player figure to
                state: the game pays points, not chips.
              </li>
              <li>
                You start every run on a true European wheel — 37 pockets, 2.70% house edge — exactly the wheel that runs
                at <a href={ROULETTE_URL}>Roulette</a>. Anything other than that, you paid for and chose.
              </li>
              <li>
                The payout table never changes. A straight-up bet pays 35 to 1 for the whole run, however many pockets
                you have added or taken out from under it.
              </li>
              <li>
                Because of that, the game shows you the real chance of every bet on the wheel as it stands, and what the
                board is worth on an average spin. You are never guessing at odds you built yourself.
              </li>
            </ul>
          </div>
          <div>
            <h3>How a run is decided</h3>
            <ul className="rules-list compact">
              <li>
                Each run has a seed, drawn from the browser&apos;s cryptographic generator. Everything after it — every
                pocket the ball finds, every item the shop stocks — comes out of one deterministic stream.
              </li>
              <li>
                The seed is shown when a run ends, and a run can be replayed on it. Two players on the same seed who play
                the same way see the same night.
              </li>
              <li>
                The ball is committed to its pocket the moment you send it. The wheel animation shows a decision that has
                already been made; it cannot be changed by anything you do while it turns.
              </li>
            </ul>
          </div>
        </div>
        <div className="rules-actions">
          <a className="btn btn-cherry" href={DEVIL_URL}>
            Play Devil&apos;s Wheel
          </a>
        </div>
      </section>

      <section className="card" id="play-money" aria-labelledby="money-title">
        <h2 id="money-title">Play money</h2>
        <ul className="rules-list">
          <li>Planary Chips are play money. They have no cash value and can&apos;t be bought, sold, withdrawn or exchanged for anything.</li>
          <li>Everyone starts with 5&apos;000 chips and can claim a free daily bonus. Chips can be sent to friends.</li>
          <li>
            New games are listed here with their rules and odds before they open, and they follow the same rules as a real casino.
          </li>
          <li>
            Gambling for real money can become a problem. If it has for you or someone close to you, free and confidential help is available at{" "}
            <a href="https://www.sos-spielsucht.ch" rel="noopener">
              SOS Spielsucht
            </a>
            .
          </li>
        </ul>
        <p className="rules-note">Last updated {UPDATED}.</p>
      </section>
    </section>
  );
}
