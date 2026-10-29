"use client";

import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
import { TitlePill } from "@/components/TitlePill";
import type { Me } from "@/lib/api";

export type Kind = "border" | "banner" | "title" | "cardback" | "chipset";
export type Tier = "common" | "rare" | "epic" | "legendary";
export type Equipped = Record<Kind, string | null>;

/** An item as the API describes it, wherever it shows up: a case, a listing, a copy you own. */
export interface ItemInfo {
  id: string;
  kind: Kind;
  name: string;
  tier: Tier;
  blurb: string;
  tradeable: boolean;
  rewardName: string | null;
}

/** A copy in your inventory, and the listing it's under if it's for sale. */
export interface Copy {
  copyId: number;
  item: ItemInfo;
  source: string;
  at: number;
  listing: { id: number; price: number } | null;
}
export interface Inventory {
  balance: number;
  equipped: Equipped;
  copies: Copy[];
}

export interface CaseItem extends ItemInfo {
  weight: number;
}
export interface CaseInfo {
  id: string;
  name: string;
  price: number;
  blurb: string;
  total: number;
  items: CaseItem[];
}

export const TIERS: Tier[] = ["common", "rare", "epic", "legendary"];
export const TIER_LABEL: Record<Tier, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
export const TIER_ORDER: Record<Tier, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

export const KIND_LABEL: Record<Kind, string> = { border: "Border", banner: "Banner", title: "Title", cardback: "Card back", chipset: "Chip set" };
export const KIND_PLURAL: Record<Kind | "all", string> = { all: "items", border: "borders", banner: "banners", title: "titles", cardback: "card backs", chipset: "chip sets" };
export const KIND_FILTERS: { kind: Kind | "all"; label: string }[] = [
  { kind: "all", label: "All" },
  { kind: "border", label: "Borders" },
  { kind: "banner", label: "Banners" },
  { kind: "title", label: "Titles" },
  { kind: "cardback", label: "Card backs" },
  { kind: "chipset", label: "Chip sets" },
];

/** Which case an item comes out of, for the "Kind · Case" line. Rewards come from achievements. */
export function caseLabel(item: Pick<ItemInfo, "id" | "rewardName">, cases: CaseInfo[] | undefined) {
  if (item.rewardName) return "Achievement reward";
  return cases?.find((c) => c.items.some((i) => i.id === item.id))?.name ?? null;
}

/** A title pill's type size for a well of this height: the handoff's 18 / 16 / 11, and smaller for the thumbnail wells. */
const titleSize = (size: number) => (size >= 150 ? 18 : size >= 120 ? 16 : size >= 56 ? 11 : size >= 40 ? 8 : 6);

/**
 * The item itself, drawn to fill whatever well it sits in. `size` is the
 * height of that well in pixels, which rings and chips scale to; banners and
 * titles take the space they're given.
 */
export function ItemArt({ item, me, size, fill = false }: { item: Pick<ItemInfo, "id" | "kind" | "name">; me: Me; size: number; fill?: boolean }) {
  switch (item.kind) {
    case "border":
      return (
        <span className="mk-art">
          <Avatar player={{ ...me, border: item.id }} size={Math.round(size * 0.72)} />
        </span>
      );
    case "banner":
      return <span className={`banner ${item.id} ${fill ? "mk-banner-fill" : "mk-banner"}`} />;
    case "title":
      return (
        <span className="mk-art">
          <TitlePill id={item.id} name={item.name} className="mk-title-pill" style={{ fontSize: titleSize(size) }} />
        </span>
      );
    case "cardback": {
      const h = Math.round(size * 0.68);
      return (
        <span className="mk-art mk-cards">
          <span className={`print-back ${item.id}`} style={{ height: h, width: Math.round(h * 0.68) }} />
          <span className={`print-back ${item.id}`} style={{ height: h, width: Math.round(h * 0.68) }} />
        </span>
      );
    }
    case "chipset":
      return (
        <span className="mk-art mk-chips">
          {[10, 50, 100, 500].map((v) => (
            <ChipIcon key={v} size={Math.round(size * 0.42)} value={v} set={item.id} />
          ))}
        </span>
      );
  }
}

export function TierLabel({ tier }: { tier: Tier }) {
  return <span className={`mk-tier tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

/** Swiss grouping, the way the casino writes chips: 25'000. */
export const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

export function ago(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return h < 48 ? "Yesterday" : new Date(ms).toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}
