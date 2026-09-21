export type GameId = "blackjack" | "poker" | "baccarat" | "roulette" | "slots" | "devil" | "nerve";

export type GameStatus = "live" | "soon";

export interface Game {
  id: GameId;
  name: string;
  tagline: string;
  /** Longer copy for the lobby spotlight. */
  blurb: string;
  subdomain: string;
  players: string;
  tags: string[];
  /** Short line printed on the cover. */
  caption: string;
  status: GameStatus;
  /** House rules, shown where there is room. */
  rules?: string[];
}

export const GAMES: Game[] = [
  {
    id: "blackjack",
    name: "Blackjack",
    tagline: "Beat the dealer to 21 without going bust.",
    blurb:
      "Now open. Hit, stand, double or split against the dealer, alone or with up to four friends at the same table.",
    subdomain: "21",
    players: "1–5 players",
    tags: ["Cards", "Vs. dealer"],
    caption: "Hit · Stand · Double",
    status: "live",
    rules: ["Dealer stands on soft 17", "Blackjack pays 3:2", "Insurance pays 2:1"],
  },
  {
    id: "poker",
    name: "Poker",
    tagline: "Texas Hold'em against friends at the table.",
    blurb: "No-limit Texas Hold'em with play chips. Open a private table and send the link to your friends.",
    subdomain: "poker",
    players: "2–8 players",
    tags: ["Cards", "Multiplayer"],
    caption: "All in",
    status: "soon",
  },
  {
    id: "baccarat",
    name: "Baccarat",
    tagline: "Player, banker or tie. Closest to nine wins.",
    blurb: "Three bets, one question: whose hand lands closer to nine? The quickest card game in the house.",
    subdomain: "baccarat",
    players: "1–7 players",
    tags: ["Cards", "Quick"],
    caption: "Player · Banker · Tie",
    status: "soon",
  },
  {
    id: "roulette",
    name: "Roulette",
    tagline: "Place your chips and watch the wheel decide.",
    blurb: "Now open. One European wheel for the whole table: bet during the countdown, then watch where the ball drops.",
    subdomain: "roulette",
    players: "Any number",
    tags: ["Table", "Multiplayer"],
    caption: "Rien ne va plus",
    status: "live",
  },
  {
    id: "nerve",
    name: "Nerve",
    tagline: "A number climbs. Get out before it stops.",
    blurb:
      "Now open. One climb for the whole table: the number rises, you decide when to take it, and everyone watches everyone else lose their nerve.",
    subdomain: "nerve",
    players: "Any number",
    tags: ["Table", "Multiplayer", "Quick"],
    caption: "Don't be greedy",
    status: "live",
    rules: ["1% house edge, the same at every target", "Committed before you bet", "Standing orders settle exactly"],
  },
  {
    id: "devil",
    name: "Devil's Wheel",
    tagline: "A roguelike on an honest wheel — and eight antes to ruin it.",
    blurb:
      "Now open. Place your chips, send the ball, then start cutting pockets out of the rim. Solo, and nothing is wagered.",
    subdomain: "devil",
    players: "1 player",
    tags: ["Solo", "Roguelike", "No wager"],
    caption: "Break the wheel",
    status: "live",
    rules: ["Real European payouts", "The wheel is yours to bend", "No chips in, no chips out"],
  },
  {
    id: "slots",
    name: "Slots",
    tagline: "Three reels, one lever, endless spins.",
    blurb: "Classic three-reel slots. Pull the lever, line up the sevens and keep your streak alive.",
    subdomain: "slots",
    players: "1 player",
    tags: ["Solo", "Quick"],
    caption: "Pull the lever",
    status: "soon",
  },
];

export function gameUrl(game: Game) {
  return `https://${game.subdomain}.planary.ch`;
}

export function gameHost(game: Game) {
  return `${game.subdomain}.planary.ch`;
}

// Swiss thousands separator, formatted by hand so server and browser render identical text.
export function formatChips(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

/** Every new Planary account starts with this many chips (the wallet lives in planary-casino-api). */
export const STARTER_CHIPS = 5000;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
