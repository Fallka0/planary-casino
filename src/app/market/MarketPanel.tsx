"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
import { ApiError, type Me, type PlayerBadge, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { type ItemInfo, type Kind, KINDS, Swatch, TierLabel } from "./cosmetics";

interface MarketItem extends ItemInfo {
  lowest: number | null;
  listings: number;
  lastSale: number | null;
}
interface Listing {
  id: number;
  price: number;
  at: number;
  seller: PlayerBadge;
  mine: boolean;
}
interface ItemMarket {
  item: ItemInfo;
  listings: Listing[];
  sales: { price: number; at: number }[];
}

function day(ms: number) {
  return new Date(ms).toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}

function ListingRow({ listing, balance }: { listing: Listing; balance: number }) {
  const act = useCasinoAction();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      await act("/v1/market/buy", { listingId: listing.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      setBusy(false);
    }
  }

  return (
    <li className="listing">
      <span className="listing-seller">
        <Avatar player={listing.seller} size={28} />
        {listing.mine ? "You" : listing.seller.name}
      </span>
      <span className="listing-price">
        <ChipIcon size={15} /> {formatChips(listing.price)}
      </span>
      <span className="listing-action">
        {listing.mine ? (
          <span className="listing-note">Your listing</span>
        ) : confirm ? (
          <>
            <button className="btn btn-sm btn-cherry" onClick={() => void buy()} disabled={busy}>
              {busy ? "Buying…" : "Confirm"}
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </button>
          </>
        ) : (
          <button className="btn btn-sm btn-price" onClick={() => setConfirm(true)} disabled={balance < listing.price} title={balance < listing.price ? "Not enough chips" : undefined}>
            Buy
          </button>
        )}
      </span>
      {error ? <p className="form-error listing-error">{error}</p> : null}
    </li>
  );
}

function ItemDetail({ itemId, me, balance, onBack }: { itemId: string; me: Me; balance: number; onBack: () => void }) {
  const { data } = useCasino<ItemMarket>(`/v1/market/${itemId}`, 20_000);
  if (!data) return <div className="panel-skeleton tall" aria-hidden="true" />;
  const { item } = data;
  return (
    <div className="market-detail">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={2.2} aria-hidden="true" /> All items
      </button>
      <div className={`market-detail-head item-${item.tier}`}>
        <div className="item-swatch">
          <Swatch item={item} me={me} size={80} />
        </div>
        <div className="item-copy">
          <TierLabel tier={item.tier} />
          <strong>{item.name}</strong>
          <p>{item.blurb}</p>
        </div>
      </div>
      <div className="market-detail-cols">
        <section aria-labelledby="listings-title">
          <h3 id="listings-title">For sale</h3>
          {data.listings.length ? (
            <ul className="listings">
              {data.listings.map((l) => (
                <ListingRow key={l.id} listing={l} balance={balance} />
              ))}
            </ul>
          ) : (
            <p className="panel-empty">Nobody is selling one right now. Cases are the other way to get it.</p>
          )}
        </section>
        <section aria-labelledby="sales-title">
          <h3 id="sales-title">Recent sales</h3>
          {data.sales.length ? (
            <ul className="sales">
              {data.sales.map((s, i) => (
                <li key={i}>
                  <span>{day(s.at)}</span>
                  <span className="listing-price">
                    <ChipIcon size={14} /> {formatChips(s.price)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">No sales yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function MarketPanel({ me }: { me: Me }) {
  const { data } = useCasino<{ balance: number; fee: number; items: MarketItem[] }>("/v1/market", 30_000);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [onOffer, setOnOffer] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  if (!data) return <div className="panel-skeleton tall" aria-hidden="true" />;
  if (open) return <ItemDetail itemId={open} me={me} balance={data.balance} onBack={() => setOpen(null)} />;

  const items = data.items
    .filter((i) => (kind === "all" || i.kind === kind) && (!onOffer || i.listings > 0))
    .sort((a, b) => (a.lowest ?? Infinity) - (b.lowest ?? Infinity));

  return (
    <div className="market">
      <div className="shop-bar">
        <div className="filters" role="tablist" aria-label="Item type">
          {[{ kind: "all" as const, label: "Everything" }, ...KINDS].map((k) => (
            <button key={k.kind} role="tab" className="filter" aria-selected={k.kind === kind} aria-pressed={k.kind === kind} onClick={() => setKind(k.kind)}>
              {k.label}
            </button>
          ))}
        </div>
        <label className="owned-toggle">
          <input type="checkbox" checked={onOffer} onChange={(e) => setOnOffer(e.target.checked)} /> For sale only
        </label>
      </div>
      <p className="shop-hint">
        Bought from other players, for chips. Sellers pay a {Math.round(data.fee * 100)}% fee to the house when something sells.
      </p>
      {items.length === 0 ? (
        <p className="card-text">{onOffer ? "Nothing of this kind is for sale right now. Untick “For sale only” to see everything." : "Nothing here."}</p>
      ) : (
        <ul className="items">
          {items.map((item) => (
            <li key={item.id} className={`item item-${item.tier}`}>
              <button className="item-open" onClick={() => setOpen(item.id)} aria-label={`${item.name}, see listings`} />
              <div className="item-swatch">
                <Swatch item={item} me={me} />
              </div>
              <div className="item-copy">
                <TierLabel tier={item.tier} />
                <strong>{item.name}</strong>
                <p>
                  {item.listings ? `${item.listings} for sale` : "None for sale"}
                  {item.lastSale !== null ? ` · last sold ${formatChips(item.lastSale)}` : ""}
                </p>
              </div>
              <div className="item-buy">
                {item.lowest !== null ? (
                  <span className="market-from">
                    from <ChipIcon size={15} /> {formatChips(item.lowest)}
                  </span>
                ) : (
                  <span className="item-locked">From a case</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
