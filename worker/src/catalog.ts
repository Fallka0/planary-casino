// Everything a player can own. Items with `reward` come from an achievement and can't be bought.
// Ids double as CSS class names in the casino and the game tables, so keep them stable.

export type ItemKind = "border" | "banner" | "title" | "cardback" | "chipset";
export type Tier = "common" | "rare" | "epic" | "legendary";

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  tier: Tier;
  /** Price in chips; null when it's only an achievement reward. */
  price: number | null;
  blurb: string;
  /** Achievement id that grants it. */
  reward?: string;
}

export const KIND_COLUMN: Record<ItemKind, "border" | "banner" | "title" | "cardback" | "chipset"> = {
  border: "border",
  banner: "banner",
  title: "title",
  cardback: "cardback",
  chipset: "chipset",
};

export const CATALOG: Item[] = [
  // Avatar borders
  { id: "border-paper", kind: "border", name: "Cream", tier: "common", price: 500, blurb: "A clean cream ring." },
  { id: "border-cherry", kind: "border", name: "Cherry", tier: "common", price: 500, blurb: "The house red." },
  { id: "border-halftone", kind: "border", name: "Halftone", tier: "rare", price: 1500, blurb: "Printed dots, like the posters." },
  { id: "border-register", kind: "border", name: "Off-register", tier: "rare", price: 2500, blurb: "Two plates, slightly out of line." },
  { id: "border-chip", kind: "border", name: "Chip edge", tier: "epic", price: 4000, blurb: "The striped edge of a casino chip." },
  { id: "border-gold", kind: "border", name: "Gold leaf", tier: "epic", price: 7500, blurb: "Hand-laid gold, catches the light." },
  { id: "border-holo", kind: "border", name: "Holo foil", tier: "legendary", price: 20000, blurb: "Shifts colour as it turns." },
  { id: "border-crown", kind: "border", name: "Champion", tier: "legendary", price: null, blurb: "For a week at number one.", reward: "weekly_top" },

  // Profile banners
  { id: "banner-oxblood", kind: "banner", name: "Oxblood print", tier: "common", price: 800, blurb: "The Blackjack poster's field." },
  { id: "banner-felt", kind: "banner", name: "Green baize", tier: "rare", price: 1500, blurb: "Old-school table felt." },
  { id: "banner-sunset", kind: "banner", name: "Wheel at dusk", tier: "rare", price: 2500, blurb: "The Roulette poster in evening light." },
  { id: "banner-night", kind: "banner", name: "Neon night", tier: "epic", price: 5000, blurb: "Signs humming after midnight." },
  { id: "banner-deco", kind: "banner", name: "Gold deco", tier: "epic", price: 9000, blurb: "Fans and rays from a grand hall." },
  { id: "banner-holo", kind: "banner", name: "Holo foil", tier: "legendary", price: 25000, blurb: "A banner that won't sit still." },
  { id: "banner-21", kind: "banner", name: "Twenty-one", tier: "epic", price: null, blurb: "For ten naturals.", reward: "natural_10" },
  { id: "banner-grimoire", kind: "banner", name: "Grimoire", tier: "legendary", price: null, blurb: "For all six bindings.", reward: "grim_every" },

  // Titles, shown under your name
  { id: "title-regular", kind: "title", name: "Regular", tier: "common", price: 300, blurb: "They know your usual." },
  { id: "title-night-owl", kind: "title", name: "Night Owl", tier: "common", price: 800, blurb: "Last one at the table." },
  { id: "title-lucky", kind: "title", name: "Lucky", tier: "rare", price: 1500, blurb: "Says it on the label." },
  { id: "title-risk-taker", kind: "title", name: "Risk Taker", tier: "rare", price: 3000, blurb: "Doubles on 12." },
  { id: "title-card-counter", kind: "title", name: "Card Counter", tier: "rare", price: 3000, blurb: "Allegedly." },
  { id: "title-house-favourite", kind: "title", name: "House Favourite", tier: "epic", price: 6000, blurb: "Always gets the good seat." },
  { id: "title-card-shark", kind: "title", name: "Card Shark", tier: "epic", price: null, blurb: "For 1'000 hands of blackjack.", reward: "bj_hands_1000" },
  { id: "title-zero-hero", kind: "title", name: "Zero Hero", tier: "epic", price: null, blurb: "For hitting zero straight up.", reward: "zero_hero" },
  { id: "title-high-roller", kind: "title", name: "High Roller", tier: "legendary", price: null, blurb: "For a 10'000-chip round.", reward: "big_win_10k" },
  { id: "title-whale", kind: "title", name: "Whale", tier: "legendary", price: null, blurb: "For holding 100'000 chips.", reward: "balance_100k" },
  { id: "title-champion", kind: "title", name: "Champion", tier: "legendary", price: null, blurb: "For a week at number one.", reward: "weekly_top" },
  { id: "title-bookbinder", kind: "title", name: "Bookbinder", tier: "rare", price: null, blurb: "For finishing the book.", reward: "grim_plain" },

  // Blackjack card backs (the dealer's face-down card and the shuffle, on your screen)
  { id: "cardback-navy", kind: "cardback", name: "Navy lattice", tier: "common", price: 1000, blurb: "A classic club deck." },
  { id: "cardback-felt", kind: "cardback", name: "Baize", tier: "rare", price: 1500, blurb: "Green like the old tables." },
  { id: "cardback-deco", kind: "cardback", name: "Deco gold", tier: "epic", price: 4000, blurb: "Black and gold, very grand." },
  { id: "cardback-holo", kind: "cardback", name: "Holo", tier: "legendary", price: 15000, blurb: "Foil that follows your eye." },
  { id: "cardback-sigil", kind: "cardback", name: "Sigil", tier: "legendary", price: null, blurb: "For the leaden book, closed.", reward: "grim_leaden" },

  // Chip sets (your bets, as everyone at the table sees them)
  { id: "chips-mono", kind: "chipset", name: "Monochrome", tier: "common", price: 800, blurb: "Cream and ink, nothing else." },
  { id: "chips-midnight", kind: "chipset", name: "Midnight", tier: "rare", price: 1500, blurb: "Deep blues for late tables." },
  { id: "chips-sunset", kind: "chipset", name: "Sunset", tier: "rare", price: 1500, blurb: "Orange and pink, from the wheel poster." },
  { id: "chips-gold", kind: "chipset", name: "Gold rush", tier: "epic", price: 6000, blurb: "Every chip looks like the big one." },
];

export const ITEMS = new Map(CATALOG.map((item) => [item.id, item]));
