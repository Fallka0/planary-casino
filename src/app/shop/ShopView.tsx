"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ApiError, type Me, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";

type Kind = "border" | "banner" | "title" | "cardback" | "chipset";
type Tier = "common" | "rare" | "epic" | "legendary";

interface ShopItem {
  id: string;
  kind: Kind;
  name: string;
  tier: Tier;
  price: number | null;
  blurb: string;
  reward?: string;
  rewardName: string | null;
  owned: boolean;
}
interface ShopData {
  balance: number;
  equipped: Record<Kind, string | null>;
  items: ShopItem[];
}

const TABS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "border", label: "Borders", hint: "Round your picture everywhere: the sidebar, tables, the leaderboard." },
  { kind: "banner", label: "Banners", hint: "The backdrop at the top of your profile." },
  { kind: "title", label: "Titles", hint: "Shown under your name." },
  { kind: "cardback", label: "Card backs", hint: "The dealer's face-down card and the shuffle at Blackjack, on your screen." },
  { kind: "chipset", label: "Chips", hint: "Your bets at the tables, as everyone sees them." },
];

function Swatch({ item, me }: { item: Pick<ShopItem, "id" | "kind" | "name">; me: Me }) {
  switch (item.kind) {
    case "border":
      return <Avatar player={{ ...me, border: item.id }} size={72} />;
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
            <ChipIcon key={v} size={40} value={v} set={item.id} />
          ))}
        </span>
      );
  }
}

/** You, wearing what's equipped, with the item you're looking at swapped in. */
function FittingRoom({ me, equipped, trying }: { me: Me; equipped: ShopData["equipped"]; trying: ShopItem | null }) {
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

function ItemCard({ item, me, equipped, balance, onTry }: { item: ShopItem; me: Me; equipped: boolean; balance: number; onTry: () => void }) {
  const act = useCasinoAction();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await act(path, body);
      setConfirm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const affordable = item.price !== null && balance >= item.price;
  return (
    <li className={`item item-${item.tier}${equipped ? " is-equipped" : ""}`} onMouseEnter={onTry} onFocus={onTry}>
      <div className="item-swatch">
        <Swatch item={item} me={me} />
      </div>
      <div className="item-copy">
        <span className={`item-tier tier-${item.tier}`}>{item.tier}</span>
        <strong>{item.name}</strong>
        <p>{item.blurb}</p>
      </div>
      <div className="item-buy">
        {item.owned ? (
          equipped ? (
            <button className="btn btn-sm btn-quiet" onClick={() => void run("/v1/shop/equip", { kind: item.kind, itemId: null })} disabled={busy}>
              <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Equipped
            </button>
          ) : (
            <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/shop/equip", { kind: item.kind, itemId: item.id })} disabled={busy}>
              Equip
            </button>
          )
        ) : item.price === null ? (
          <span className="item-locked">
            <Lock size={13} strokeWidth={2.4} aria-hidden="true" /> Earn with {item.rewardName}
          </span>
        ) : confirm ? (
          <>
            <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/shop/buy", { itemId: item.id })} disabled={busy}>
              {busy ? "Buying…" : `Buy for ${formatChips(item.price)}`}
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-price" onClick={() => setConfirm(true)} disabled={!affordable} title={affordable ? undefined : "Not enough chips"}>
            <ChipIcon size={16} />
            {formatChips(item.price)}
          </button>
        )}
      </div>
      {error ? <p className="form-error item-error">{error}</p> : null}
    </li>
  );
}

export function ShopView() {
  const { user, loading } = useAuth();
  const { data } = useCasino<ShopData>(user ? "/v1/shop" : null);
  const { data: me } = useCasino<Me>(user ? "/v1/me" : null);
  const [kind, setKind] = useState<Kind>("border");
  const [owned, setOwned] = useState(false);
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const tab = TABS.find((t) => t.kind === kind)!;
  const items = (data?.items ?? []).filter((i) => i.kind === kind && (!owned || i.owned));

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Shop</h1>
        <p className="page-sub">Borders, banners, titles and table cosmetics, paid in chips. Some can only be earned through achievements.</p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to spend your chips in the shop." />
      ) : !data || !me ? (
        <div className="panel-skeleton tall" aria-hidden="true" />
      ) : (
        <div className="shop">
          <div className="shop-main">
            <div className="shop-bar">
              <div className="filters" role="tablist" aria-label="Item type">
                {TABS.map((t) => (
                  <button
                    key={t.kind}
                    role="tab"
                    aria-selected={t.kind === kind}
                    className="filter"
                    aria-pressed={t.kind === kind}
                    onClick={() => {
                      setKind(t.kind);
                      setTrying(null);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="owned-toggle">
                <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} /> Owned only
              </label>
            </div>
            <p className="shop-hint">{tab.hint}</p>
            {items.length === 0 ? (
              <p className="card-text">Nothing here yet. Untick “Owned only” to browse.</p>
            ) : (
              <ul className="items" role="tabpanel" aria-label={tab.label}>
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    me={me}
                    balance={data.balance}
                    equipped={data.equipped[item.kind] === item.id}
                    onTry={() => setTrying(item)}
                  />
                ))}
              </ul>
            )}
          </div>
          <FittingRoom me={me} equipped={data.equipped} trying={trying} />
        </div>
      )}
    </section>
  );
}
