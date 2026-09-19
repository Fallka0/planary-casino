export type GameId = "blackjack" | "poker" | "baccarat" | "roulette" | "slots";

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
