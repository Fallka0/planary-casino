"use client";

import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { ChipIcon } from "@/components/ChipIcon";
import { ApiError, type Me, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { type Equipped, FittingRoom, type ItemInfo, type Kind, KINDS, Swatch, TierLabel } from "./cosmetics";

interface Copy {
  copyId: number;
  item: ItemInfo;
  source: string;
  at: number;
  listing: { id: number; price: number } | null;
}
interface Inventory {
  balance: number;
  equipped: Equipped;
  copies: Copy[];
}

/** Mirrors the worker: the house keeps 5%, rounded up, from the seller's side. */
const feeOn = (price: number) => Math.ceil(price * 0.05);

function useRun() {
  const act = useCasinoAction();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  return { run, busy, error };
}

function SellForm({ copy, onDone }: { copy: Copy; onDone: () => void }) {
  const [price, setPrice] = useState("");
  const { run, busy, error } = useRun();
  const value = Number(price) || 0;
  const valid = value >= 20 && value <= 10_000_000;
  return (
    <form
      className="sell-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void run("/v1/market/list", { copyId: copy.copyId, price: value }, onDone);
      }}
    >
      <label className="field">
        Price
        <input inputMode="numeric" placeholder="e.g. 1500" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} autoFocus />
      </label>
      <p className="sell-math">
        {valid ? (
          <>
            You get <strong>{formatChips(value - feeOn(value))}</strong> after the {formatChips(feeOn(value))} fee.
          </>
        ) : (
          "Between 20 and 10'000'000 chips."
        )}
      </p>
      <div className="item-buy">
        <button className="btn btn-sm btn-cherry" disabled={!valid || busy}>
          {busy ? "Listing…" : "List it"}
        </button>
        <button type="button" className="btn btn-sm btn-quiet" onClick={onDone} disabled={busy}>
          Cancel
        </button>
      </div>
      {error ? <p className="form-error item-error">{error}</p> : null}
    </form>
  );
}

function ItemGroup({ copies, me, equipped, onTry }: { copies: Copy[]; me: Me; equipped: boolean; onTry: () => void }) {
  const { item } = copies[0];
  const { run, busy, error } = useRun();
  const [selling, setSelling] = useState(false);
  const listed = copies.filter((c) => c.listing);
  const free = copies.filter((c) => !c.listing);
  // The copy you're wearing stays unless there's a spare.
  const sellable = item.tradeable ? free.slice(equipped ? 1 : 0) : [];

  return (
    <li className={`item item-${item.tier}${equipped ? " is-equipped" : ""}`} onMouseEnter={onTry} onFocus={onTry}>
      <div className="item-swatch">
        <Swatch item={item} me={me} />
        {copies.length > 1 ? <span className="item-count">×{copies.length}</span> : null}
      </div>
      <div className="item-copy">
        <TierLabel tier={item.tier} />
        <strong>{item.name}</strong>
        {item.tradeable ? (
          listed.length ? (
            <p>
              {listed.length === copies.length ? "Listed" : `${listed.length} of ${copies.length} listed`} for{" "}
              {listed.map((c) => formatChips(c.listing!.price)).join(", ")}
            </p>
          ) : (
            <p>{item.blurb}</p>
          )
        ) : (
          <p className="item-locked">
            <Lock size={13} strokeWidth={2.4} aria-hidden="true" /> Earned with {item.rewardName ?? "an achievement"}. Not tradeable.
          </p>
        )}
      </div>
      {selling && sellable.length ? (
        <SellForm copy={sellable[0]} onDone={() => setSelling(false)} />
      ) : (
        <div className="item-buy">
          {free.length ? (
            equipped ? (
              <button className="btn btn-sm btn-quiet" onClick={() => void run("/v1/inventory/equip", { kind: item.kind, itemId: null })} disabled={busy}>
                <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Equipped
              </button>
            ) : (
              <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/inventory/equip", { kind: item.kind, itemId: item.id })} disabled={busy}>
                Equip
              </button>
            )
          ) : null}
          {sellable.length ? (
            <button className="btn btn-sm btn-quiet" onClick={() => setSelling(true)}>
              Sell
            </button>
          ) : null}
          {listed.map((c) => (
            <button key={c.copyId} className="btn btn-sm btn-quiet" onClick={() => void run("/v1/market/cancel", { listingId: c.listing!.id })} disabled={busy}>
              Take down <ChipIcon size={13} /> {formatChips(c.listing!.price)}
            </button>
          ))}
        </div>
      )}
      {error ? <p className="form-error item-error">{error}</p> : null}
    </li>
  );
}

export function InventoryPanel({ me, onCases, initialKind = "border" }: { me: Me; onCases: () => void; initialKind?: Kind }) {
  const { data } = useCasino<Inventory>("/v1/inventory");
  const [kind, setKind] = useState<Kind>(initialKind);
  const [trying, setTrying] = useState<ItemInfo | null>(null);

  if (!data) return <div className="panel-skeleton tall" aria-hidden="true" />;

  const groups = new Map<string, Copy[]>();
  for (const copy of data.copies) if (copy.item.kind === kind) groups.set(copy.item.id, [...(groups.get(copy.item.id) ?? []), copy]);
  const tab = KINDS.find((k) => k.kind === kind)!;

  return (
    <div className="shop">
      <div className="shop-main">
        <div className="shop-bar">
          <div className="filters" role="tablist" aria-label="Item type">
            {KINDS.map((k) => (
              <button
                key={k.kind}
                role="tab"
                className="filter"
                aria-selected={k.kind === kind}
                aria-pressed={k.kind === kind}
                onClick={() => {
                  setKind(k.kind);
                  setTrying(null);
                }}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <p className="shop-hint">{tab.hint}</p>
        {groups.size === 0 ? (
          <p className="card-text">
            You don&apos;t own any {tab.label.toLowerCase()} yet.{" "}
            <button className="text-link" onClick={onCases}>
              Open a case
            </button>{" "}
            or buy one on the market.
          </p>
        ) : (
          <ul className="items">
            {[...groups.values()].map((copies) => (
              <ItemGroup
                key={copies[0].item.id}
                copies={copies}
                me={me}
                equipped={data.equipped[kind] === copies[0].item.id}
                onTry={() => setTrying(copies[0].item)}
              />
            ))}
          </ul>
        )}
      </div>
      <FittingRoom me={me} equipped={data.equipped} trying={trying} />
    </div>
  );
}
