// Everything a player can own, and the cases it comes out of. Items with `reward`
// come from an achievement and stay with the player who earned it; everything else
// drops from a case and can be sold on to other players.
// Ids double as CSS class names in the casino and the game tables, so keep them stable.

export type ItemKind = "border" | "banner" | "title" | "cardback" | "chipset";
export type Tier = "common" | "rare" | "epic" | "legendary";

export interface Item {
  id: string;
  kind: ItemKind;
  name: string;
  tier: Tier;
  /**
   * What the item used to cost in the shop, kept as a guide to its worth. null
   * when it's only an achievement reward. Nothing is sold at this price any more.
   */
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
  { id: "title-goat", kind: "title", name: "GOAT", tier: "legendary", price: null, blurb: "For every blackjack badge.", reward: "bj_goat" },

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

  // Afterhours: case-only. Banners and titles, because those render in the
  // casino alone; a new border or chip set would also need every game table.
  { id: "banner-ticker", kind: "banner", name: "Ticker tape", tier: "common", price: 700, blurb: "Results scrolling past all night." },
  { id: "banner-velvet", kind: "banner", name: "Velvet rope", tier: "rare", price: 2000, blurb: "Behind it is where you want to be." },
  { id: "banner-marquee", kind: "banner", name: "Marquee", tier: "epic", price: 6000, blurb: "Bulbs round the sign, every one lit." },
  { id: "banner-afterglow", kind: "banner", name: "Afterglow", tier: "epic", price: 7000, blurb: "The street outside at four in the morning." },
  { id: "banner-aurora", kind: "banner", name: "Aurora", tier: "legendary", price: 22000, blurb: "Light that never quite settles." },
  { id: "title-night-shift", kind: "title", name: "Night Shift", tier: "common", price: 500, blurb: "Clocks in when the lights go down." },
  { id: "title-high-card", kind: "title", name: "High Card", tier: "common", price: 500, blurb: "Not much, but it's something." },
  { id: "title-the-closer", kind: "title", name: "The Closer", tier: "rare", price: 2500, blurb: "Turns the last hand round." },
  { id: "title-smooth-operator", kind: "title", name: "Smooth Operator", tier: "epic", price: 6000, blurb: "Never seen sweating." },
  { id: "title-last-call", kind: "title", name: "Last Call", tier: "legendary", price: 18000, blurb: "Leaves when the house does." },

  // Boardwalk: case-only, and the first case with rings, card backs and chips of
  // its own, so every table that draws those knows these ids too.
  { id: "border-sand", kind: "border", name: "Sand ring", tier: "common", price: 600, blurb: "Warm, plain, a little gritty." },
  { id: "banner-pier", kind: "banner", name: "Pier planks", tier: "common", price: 700, blurb: "Boards bleached by a long summer." },
  { id: "title-day-tripper", kind: "title", name: "Day Tripper", tier: "common", price: 500, blurb: "Home before the lights come on." },
  { id: "title-low-tide", kind: "title", name: "Low Tide", tier: "common", price: 500, blurb: "Waiting for things to come back in." },
  { id: "cardback-postcard", kind: "cardback", name: "Postcard", tier: "common", price: 1000, blurb: "Wish you were here." },
  { id: "chips-taffy", kind: "chipset", name: "Taffy", tier: "common", price: 800, blurb: "Pink, cream and orange, pulled by hand." },
  { id: "border-lifering", kind: "border", name: "Life ring", tier: "rare", price: 2000, blurb: "Red and white, thrown in when it counts." },
  { id: "banner-awning", kind: "banner", name: "Awning", tier: "rare", price: 2000, blurb: "The stripes over the ice-cream stand." },
  { id: "title-high-tide", kind: "title", name: "High Tide", tier: "rare", price: 2500, blurb: "Everything's coming in." },
  { id: "cardback-seaglass", kind: "cardback", name: "Sea glass", tier: "rare", price: 2000, blurb: "Worn smooth by the waves." },
  { id: "banner-sunset-strip", kind: "banner", name: "Sunset strip", tier: "epic", price: 6500, blurb: "The sun going down over the water." },
  { id: "border-ferris", kind: "border", name: "Ferris wheel", tier: "epic", price: 6000, blurb: "Spokes all the way round." },
  { id: "title-pier-king", kind: "title", name: "Pier King", tier: "epic", price: 6000, blurb: "Runs the boardwalk." },
  { id: "banner-fireworks", kind: "banner", name: "Fireworks", tier: "legendary", price: 24000, blurb: "The last night of summer." },
];

export const ITEMS = new Map(CATALOG.map((item) => [item.id, item]));

/** Achievement rewards are earned, not traded. */
export const tradeable = (item: Item) => !item.reward;

// ── Cases ────────────────────────────────────────────

/**
 * How likely each tier is, out of 10'000. A case without a tier hands its share
 * to the others in proportion; within a tier every item is equally likely.
 */
export const TIER_ODDS: Record<Tier, number> = { common: 6000, rare: 2800, epic: 1000, legendary: 200 };

export interface Case {
  id: string;
  name: string;
  price: number;
  blurb: string;
  items: string[];
}

/** The items that first appeared in the Afterhours case, and only come out of it. */
const AFTERHOURS_NEW = [
  "banner-ticker",
  "banner-velvet",
  "banner-marquee",
  "banner-afterglow",
  "banner-aurora",
  "title-night-shift",
  "title-high-card",
  "title-the-closer",
  "title-smooth-operator",
  "title-last-call",
];

/** The items that first appeared in the Boardwalk case, and only come out of it. */
const BOARDWALK = [
  "border-sand",
  "banner-pier",
  "title-day-tripper",
  "title-low-tide",
  "cardback-postcard",
  "chips-taffy",
  "border-lifering",
  "banner-awning",
  "title-high-tide",
  "cardback-seaglass",
  "banner-sunset-strip",
  "border-ferris",
  "title-pier-king",
  "banner-fireworks",
];

/** Items a newer case introduced; the Classic case keeps to what the shop used to sell. */
const CASE_ONLY = new Set([...AFTERHOURS_NEW, ...BOARDWALK]);

export const CASES: Case[] = [
  {
    id: "classic",
    name: "Classic Case",
    price: 2000,
    blurb: "Everything the shop used to sell: borders, banners, titles, card backs and chips.",
    items: CATALOG.filter((item) => item.price !== null && !CASE_ONLY.has(item.id)).map((item) => item.id),
  },
  {
    id: "afterhours",
    name: "Afterhours Case",
    price: 2000,
    blurb: "New banners and titles for the late tables, and a few old favourites from after dark.",
    items: [
      ...AFTERHOURS_NEW,
      "title-night-owl",
      "chips-midnight",
      "banner-night",
      "cardback-deco",
    ],
  },
  {
    id: "boardwalk",
    name: "Boardwalk Case",
    price: 2000,
    blurb: "Seaside banners, rings, card backs and chips.",
    items: BOARDWALK,
  },
];

export const CASE_MAP = new Map(CASES.map((c) => [c.id, c]));

/**
 * The draw table for a case: each item with an integer weight, in a fixed order,
 * and the total. A roll in [0, total) lands on exactly one item. The order and
 * the weights are part of what a player checks, so they never depend on anything
 * but the case itself.
 */
export function drawTable(box: Case) {
  const items = box.items.map((id) => ITEMS.get(id)!).filter(Boolean);
  const perTier = new Map<Tier, number>();
  for (const item of items) perTier.set(item.tier, (perTier.get(item.tier) ?? 0) + 1);
  // Scaled so every weight is a whole number however many items share a tier.
  const entries = items.map((item) => ({ item, weight: Math.round((TIER_ODDS[item.tier] * 1000) / perTier.get(item.tier)!) }));
  return { entries, total: entries.reduce((sum, e) => sum + e.weight, 0) };
}

/** The item a roll lands on. */
export function itemAt(box: Case, roll: number) {
  let at = roll;
  for (const { item, weight } of drawTable(box).entries) {
    if (at < weight) return item;
    at -= weight;
  }
  throw new Error("roll outside the table");
}
