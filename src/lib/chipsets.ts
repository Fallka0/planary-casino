// Chip designs from the shop: print colours per denomination. Mirrored in the game tables (same ids).

export type ChipInks = { fill: string; ink: string };

const CLASSIC: Record<number, ChipInks> = {
  10: { fill: "#f6eee4", ink: "#2a0710" },
  50: { fill: "#ff2e55", ink: "#f6eee4" },
  100: { fill: "#1d1846", ink: "#f6eee4" },
  500: { fill: "#e8c7a2", ink: "#5a0f22" },
};

export const CHIPSETS: Record<string, Record<number, ChipInks>> = {
  classic: CLASSIC,
  "chips-mono": {
    10: { fill: "#f6eee4", ink: "#22060e" },
    50: { fill: "#22060e", ink: "#f6eee4" },
    100: { fill: "#8a7f78", ink: "#f6eee4" },
    500: { fill: "#3d3533", ink: "#e8dccf" },
  },
  "chips-midnight": {
    10: { fill: "#c9d6ff", ink: "#0f1b3d" },
    50: { fill: "#3b5bdb", ink: "#e7ecff" },
    100: { fill: "#0f1b3d", ink: "#9fb4ff" },
    500: { fill: "#6d28d9", ink: "#ede9fe" },
  },
  "chips-sunset": {
    10: { fill: "#ffe3d3", ink: "#8a1c0a" },
    50: { fill: "#ff5b2e", ink: "#fff1e6" },
    100: { fill: "#ff2e8a", ink: "#fff0f6" },
    500: { fill: "#ffb199", ink: "#5a0f22" },
  },
  "chips-gold": {
    10: { fill: "#fbe7a6", ink: "#5a3a06" },
    50: { fill: "#e2a93b", ink: "#2a1a02" },
    100: { fill: "#b8761c", ink: "#fff3c4" },
    500: { fill: "#2a1a02", ink: "#f7d77e" },
  },
  "chips-taffy": {
    10: { fill: "#f6eee4", ink: "#d94f7a" },
    50: { fill: "#ff9ec0", ink: "#5a0f22" },
    100: { fill: "#ff7a3d", ink: "#fff1e6" },
    500: { fill: "#136f6f", ink: "#ffd9c4" },
  },
  // Midnight Macau. The casino draws these from their own art (src/lib/chipArt.ts);
  // these two-ink versions are what the game tables mirror.
  "chips-mochi": {
    10: { fill: "#f2a7b8", ink: "#8e2c48" },
    50: { fill: "#f6efe6", ink: "#6b5a48" },
    100: { fill: "#9cc48a", ink: "#2f4a22" },
    500: { fill: "#ecc77a", ink: "#6b4a12" },
  },
  "chips-tea": {
    10: { fill: "#efe6d2", ink: "#6b5a3e" },
    50: { fill: "#5f8f3a", ink: "#eef4df" },
    100: { fill: "#a8642a", ink: "#fbeedb" },
    500: { fill: "#17100f", ink: "#f3e6cf" },
  },
  "chips-jade": {
    10: { fill: "#b8c9ad", ink: "#3f5a35" },
    50: { fill: "#7d68b6", ink: "#f6f0ff" },
    100: { fill: "#1f5e4b", ink: "#effbe8" },
    500: { fill: "#0c3a2d", ink: "#e9c46a" },
  },
  "chips-lucky-cat": {
    10: { fill: "#efe5cf", ink: "#8e1420" },
    50: { fill: "#8e1420", ink: "#efe5cf" },
    100: { fill: "#141014", ink: "#e8b84a" },
    500: { fill: "#e8b84a", ink: "#141014" },
  },
};

export function chipInks(set: string | null | undefined, value: number): ChipInks {
  return (CHIPSETS[set ?? "classic"] ?? CLASSIC)[value] ?? CLASSIC[value] ?? { fill: "var(--cherry)", ink: "var(--paper)" };
}
