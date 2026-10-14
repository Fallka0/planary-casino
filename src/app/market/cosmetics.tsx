"use client";

import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
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

export const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "border", label: "Borders", hint: "Round your picture everywhere: the sidebar, tables, the leaderboard." },
  { kind: "banner", label: "Banners", hint: "The backdrop at the top of your profile." },
  { kind: "title", label: "Titles", hint: "Shown under your name." },
  { kind: "cardback", label: "Card backs", hint: "The dealer's face-down card and the shuffle at Blackjack, on your screen." },
  { kind: "chipset", label: "Chips", hint: "Your bets at the tables, as everyone sees them." },
];

export function Swatch({ item, me, size = 72 }: { item: Pick<ItemInfo, "id" | "kind" | "name">; me: Me; size?: number }) {
  switch (item.kind) {
    case "border":
      return <Avatar player={{ ...me, border: item.id }} size={size} />;
    case "banner":
      return <span className={`banner-swatch banner ${item.id}`} />;
    case "title":
      return <span className="title-swatch">{item.name}</span>;
    case "cardback":
      return (
        <span className="cardback-swatch">
          <span className={`print-back ${item.id}`} />
          <span className={`print-back ${item.id}`} />
        </span>
      );
    case "chipset":
      return (
        <span className="chipset-swatch">
          {[10, 50, 100, 500].map((v) => (
            <ChipIcon key={v} size={Math.round(size * 0.55)} value={v} set={item.id} />
          ))}
        </span>
      );
  }
}

export function TierLabel({ tier }: { tier: Tier }) {
  return <span className={`item-tier tier-${tier}`}>{tier}</span>;
}

/** You, wearing what's equipped, with the item you're looking at swapped in. */
export function FittingRoom({ me, equipped, trying }: { me: Me; equipped: Equipped; trying: ItemInfo | null }) {
  const look = { ...equipped, ...(trying ? { [trying.kind]: trying.id } : {}) };
  const title = trying?.kind === "title" ? trying.name : me.title;
  return (
    <aside className="fitting" aria-label="Preview">
      <div className={`fitting-banner banner ${look.banner ?? "banner-default"}`}>
        <Avatar player={{ ...me, border: look.border }} size={96} />
      </div>
      <div className="fitting-copy">
        {title ? <span className="profile-title">{title}</span> : null}
        <strong>{me.name}</strong>
      </div>
      <div className="fitting-table">
        <span className="cardback-swatch">
          <span className={`print-back ${look.cardback ?? "cardback-classic"}`} />
          <span className={`print-back ${look.cardback ?? "cardback-classic"}`} />
        </span>
        <span className="chipset-swatch">
          {[10, 50, 100, 500].map((v) => (
            <ChipIcon key={v} size={34} value={v} set={look.chipset} />
          ))}
        </span>
      </div>
      <p className="fitting-note">{trying ? `Trying on ${trying.name}` : "Pick an item to try it on."}</p>
    </aside>
  );
}
