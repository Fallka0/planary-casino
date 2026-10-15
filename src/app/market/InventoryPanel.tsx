"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
import { ApiError, type Me, useCasino, useCasinoAction } from "@/lib/api";
import {
  type Copy,
  type Equipped,
  fmt,
  type Inventory,
  type ItemInfo,
  ItemArt,
  type Kind,
  KIND_FILTERS,
  KIND_LABEL,
  TIER_LABEL,
  TIER_ORDER,
} from "./cosmetics";

/** Mirrors the worker: the house keeps 5%, rounded up, from the seller's side. */
const feeOn = (price: number) => Math.ceil(price * 0.05);
const MIN = 20;
const MAX = 10_000_000;

interface Group {
  item: ItemInfo;
  copies: Copy[];
  listed: Copy[];
  equipped: boolean;
  /** Copies that could go on sale: not listed, and not the one being worn. */
  free: number;
}

function groupsOf(inventory: Inventory): Group[] {
  const by = new Map<string, Copy[]>();
  for (const copy of inventory.copies) by.set(copy.item.id, [...(by.get(copy.item.id) ?? []), copy]);
  return [...by.values()]
    .map((copies) => {
      const item = copies[0].item;
      const listed = copies.filter((c) => c.listing);
      const equipped = inventory.equipped[item.kind] === item.id;
      return { item, copies, listed, equipped, free: copies.length - listed.length - (equipped ? 1 : 0) };
    })
    .sort((a, b) => TIER_ORDER[a.item.tier] - TIER_ORDER[b.item.tier] || a.item.name.localeCompare(b.item.name));
}

function Lock() {
  return (
    <span className="mk-lock" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

/** You, wearing what's equipped, with whatever you're pointing at swapped into its slot. */
function FittingRoom({ me, equipped, preview }: { me: Me; equipped: Equipped; preview: ItemInfo | null }) {
  const slot = (kind: Kind) => (preview?.kind === kind ? preview.id : equipped[kind]);
  const previewing = preview && equipped[preview.kind] !== preview.id;
  const title = preview?.kind === "title" ? preview.name : me.title;
  return (
    <section className="mk-panel is-tight" aria-label="Fitting room">
      <div className="mk-panel-head">
        <span className="mk-h4">Fitting room</span>
        <span className={`mk-small${previewing ? "" : " mk-quiet"}`}>{previewing ? `Previewing ${preview.name}` : "What you're wearing"}</span>
      </div>
      <div className="mk-fit">
        <div className={`mk-fit-banner banner ${slot("banner") ?? "banner-default"}`} />
        <div className="mk-fit-who">
          <Avatar player={{ ...me, border: slot("border") }} size={88} />
          <div className="mk-fit-name">
            <span>{me.name}</span>
            {title ? <span className="mk-title-pill">{title}</span> : null}
          </div>
        </div>
        <div className="mk-fit-table">
          <div className="mk-fit-well">
            <span className="mk-art mk-cards">
              <span className={`print-back ${slot("cardback") ?? "cardback-classic"}`} />
              <span className={`print-back ${slot("cardback") ?? "cardback-classic"}`} />
            </span>
          </div>
          <div className="mk-fit-well">
            <span className="mk-art mk-chips">
              {[10, 50, 100, 500].map((v) => (
                <ChipIcon key={v} size={32} value={v} set={slot("chipset")} />
              ))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Selected({ group, me, note, onClose }: { group: Group; me: Me; note: string; onClose: () => void }) {
  const act = useCasinoAction();
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { item } = group;
  const raw = Number(price.replace(/\D/g, "")) || 0;
  const invalid = !price ? null : raw < MIN ? "Minimum price is 20 chips." : raw > MAX ? "Maximum price is 10'000'000 chips." : null;
  const ready = raw > 0 && !invalid;
  const summary = [`×${group.copies.length}`, group.equipped ? "1 equipped" : null, group.listed.length ? `${group.listed.length} listed` : null].filter(Boolean).join(" · ");

  async function run(path: string, body: unknown, then?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await act(path, body);
      then?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  function list() {
    const copy = group.copies.find((c) => !c.listing);
    if (!ready || !copy) return;
    void run("/v1/market/list", { copyId: copy.copyId, price: raw }, () => setPrice(""));
  }

  return (
    <section className="mk-panel is-tight mk-selected" aria-label={item.name}>
      <button className="mk-btn mk-btn-quiet mk-btn-sm mk-phone-only mk-self-start" onClick={onClose}>
        ‹ Inventory
      </button>
      <div className="mk-sel-head">
        <div className="mk-sel-art">
          <ItemArt item={item} me={me} size={52} />
        </div>
        <div className="mk-min">
          <div className="mk-meta">
            <span className={`mk-tier tier-${item.tier}`}>{TIER_LABEL[item.tier]}</span>
            <span>{KIND_LABEL[item.kind]}</span>
          </div>
          <div className="mk-sel-name">{item.name}</div>
          <div className="mk-dim mk-small">{summary}</div>
        </div>
      </div>

      <div className="mk-actions">
        {group.equipped ? (
          <span className="mk-btn mk-btn-off">
            <span className="mk-dot" />
            Equipped
          </span>
        ) : (
          <button className="mk-btn mk-btn-primary" onClick={() => void run("/v1/inventory/equip", { kind: item.kind, itemId: item.id })} disabled={busy || group.free <= 0}>
            Equip
          </button>
        )}
      </div>

      {!item.tradeable ? (
        <div className="mk-notice">
          <Lock />
          <div className="mk-dim">
            Earned with {item.rewardName ?? "an achievement"}. <span className="mk-strong">Not tradeable.</span>
          </div>
        </div>
      ) : (
        <div className="mk-sell">
          <div className="mk-sell-head">
            <span className="mk-h4">Sell on the market</span>
            <span className="mk-quiet mk-small">{note}</span>
          </div>
          {group.free <= 0 && group.equipped ? (
            <div className="mk-notice">
              <div className="mk-dim">
                <span className="mk-strong">You&apos;re wearing your only free copy.</span> Equip a different {KIND_LABEL[item.kind].toLowerCase()} to sell this one.
              </div>
            </div>
          ) : group.free > 0 ? (
            <>
              <div className="mk-sell-row">
                <label className={`mk-price-field${invalid ? " is-bad" : ""}`}>
                  <input
                    inputMode="numeric"
                    placeholder="Price"
                    aria-label="Price in chips"
                    value={price}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      setPrice(digits ? fmt(Number(digits)) : "");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && list()}
                  />
                  <span>chips</span>
                </label>
                <button className={`mk-btn mk-btn-lg ${ready ? "mk-btn-primary" : "mk-btn-off"}`} onClick={list} disabled={!ready || busy}>
                  {busy ? "Listing…" : ready ? `List for ${fmt(raw)}` : "List it"}
                </button>
              </div>
              <p className={`mk-small${invalid ? " mk-error" : " mk-dim"}`}>
                {invalid ?? (raw ? `You get ${fmt(raw - feeOn(raw))} after the ${fmt(feeOn(raw))} fee.` : "5% house fee on sale.")}
              </p>
            </>
          ) : null}
          {group.listed.map((c) => (
            <div key={c.copyId} className="mk-listed">
              <span className="mk-dim">Listed for</span>
              <strong>{fmt(c.listing!.price)}</strong>
              <span className="mk-grow" />
              <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={() => void run("/v1/market/cancel", { listingId: c.listing!.id })} disabled={busy}>
                Take down
              </button>
            </div>
          ))}
        </div>
      )}
      {error ? <p className="mk-error mk-small">{error}</p> : null}
    </section>
  );
}

export function InventoryPanel({
  me,
  inventory,
  initialItem,
  onCases,
}: {
  me: Me;
  inventory: Inventory | null;
  initialItem?: string | null;
  onCases: () => void;
}) {
  const { data: market } = useCasino<{ items: { id: string; lowest: number | null; lastSale: number | null }[] }>("/v1/market", 60_000);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [selected, setSelected] = useState<string | null>(initialItem ?? null);
  const [hover, setHover] = useState<string | null>(null);

  if (!inventory) return <InventorySkeleton />;
  const groups = groupsOf(inventory);

  if (groups.length === 0) {
    return (
      <div className="mk-empty mk-panel">
        <div className="mk-ghosts" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="mk-h3">Nothing here yet</div>
        <p className="mk-sub">Cosmetics come from cases.</p>
        <button className="mk-btn mk-btn-primary" onClick={onCases}>
          See the cases
        </button>
      </div>
    );
  }

  const shown = groups.filter((g) => kind === "all" || g.item.kind === kind);
  const sel = groups.find((g) => g.item.id === selected) ?? null;
  const preview = groups.find((g) => g.item.id === (hover ?? selected))?.item ?? null;
  const stats = sel ? market?.items.find((i) => i.id === sel.item.id) : null;
  const note = stats
    ? stats.lowest !== null
      ? `Lowest now ${fmt(stats.lowest)}${stats.lastSale !== null ? ` · last ${fmt(stats.lastSale)}` : ""}`
      : stats.lastSale !== null
        ? `Last sale ${fmt(stats.lastSale)}`
        : ""
    : "";

  return (
    <div className={`mk-inv${sel ? " has-sel" : ""}`}>
      <div className="mk-inv-side">
        <FittingRoom me={me} equipped={inventory.equipped} preview={preview} />
        {sel ? <Selected key={sel.item.id} group={sel} me={me} note={note} onClose={() => setSelected(null)} /> : null}
      </div>
      <div className="mk-inv-main">
        <div className="mk-filters">
          {KIND_FILTERS.map((k) => (
            <button key={k.kind} className={`mk-chip${k.kind === kind ? " is-on" : ""}`} aria-pressed={k.kind === kind} onClick={() => setKind(k.kind)}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="mk-grid is-inv">
          {shown.map((g) => (
            <button
              key={g.item.id}
              className={`mk-card${selected === g.item.id ? " is-on" : ""}`}
              onClick={() => setSelected(g.item.id)}
              onMouseEnter={() => setHover(g.item.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g.item.id)}
              onBlur={() => setHover(null)}
            >
              <span className="mk-card-in">
                <span className="mk-card-art is-inv">
                  <ItemArt item={g.item} me={me} size={84} />
                  {g.copies.length > 1 ? <span className="mk-count">×{g.copies.length}</span> : null}
                  {!g.item.tradeable ? (
                    <span className="mk-lock-badge">
                      <Lock />
                    </span>
                  ) : null}
                </span>
                <span className={`mk-edge edge-${g.item.tier}`} />
                <span className="mk-card-copy">
                  <span className="mk-strong">{g.item.name}</span>
                  {g.equipped ? (
                    <span className="mk-small mk-cherry">Equipped</span>
                  ) : g.listed.length ? (
                    <span className="mk-small mk-dim">{g.listed.length} listed</span>
                  ) : (
                    <span className={`mk-small tier-${g.item.tier}`}>{TIER_LABEL[g.item.tier]}</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div className="mk-inv mk-skeleton" aria-hidden="true">
      <span className="mk-skel-fit" />
      <div className="mk-grid is-inv">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="mk-skel-card is-inv" />
        ))}
      </div>
    </div>
  );
}
