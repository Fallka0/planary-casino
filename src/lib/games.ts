export type GameId = "blackjack" | "poker" | "baccarat" | "roulette" | "slots" | "grimoire";

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
    name: "Hold'em",
    tagline: "No-limit Texas Hold'em, six seats to a table.",
    blurb:
      "Now open. Six seats, blinds and side pots. Sit at a house table and play straight away, or open your own and send the code to your friends.",
    subdomain: "poker",
    players: "2–6 players",
    tags: ["Cards", "Multiplayer"],
    caption: "All in",
    status: "live",
    rules: ["No-limit betting, min-raise enforced", "Side pots built from each player's own total", "Every deck published when the hand ends"],
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
    id: "grimoire",
    name: "Grimoire",
    tagline: "A poker run in eight chapters.",
    blurb:
      "Now open. Play a hand, score points times mult, break the seal — then spend the ink on sigils and write them into the book. Solo, and nothing is wagered.",
    subdomain: "grimoire",
    players: "1 player",
    tags: ["Solo", "Roguelike", "No wager"],
    caption: "Break the seal",
    status: "live",
    rules: ["Eight chapters, three seals each", "Sigils fire left to right", "No chips in, no chips out"],
  },
  {
    id: "slots",
    name: "Slots",
    tagline: "Three machines with their reel strips published.",
    blurb:
      "Now open. A classic three-reeler, a nine-window grid and a five-reel night machine — each with its reel strips in the open and its return printed on the cabinet.",
    subdomain: "slots",
    players: "1 player",
    tags: ["Solo", "Quick"],
    caption: "Pull the lever",
    status: "live",
    rules: ["Every strip is published", "96% back, checked against every window", "Each spin committed before the lever moves"],
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
