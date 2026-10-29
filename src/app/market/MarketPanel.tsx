"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ApiError, type Me, type PlayerBadge, useCasino, useCasinoAction } from "@/lib/api";
import { ProfilePreview } from "./ProfilePreview";
import { ago, type CaseInfo, caseLabel, fmt, type ItemInfo, ItemArt, type Kind, KIND_FILTERS, KIND_LABEL, KIND_PLURAL, TIER_LABEL } from "./cosmetics";

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
  sales: { price: number; at: number; buyer: string | null; mine: boolean }[];
}
type Notice = { kind: "gone" } | { kind: "ok"; text: string } | { kind: "error"; text: string } | null;

function Detail({
  itemId,
  summary,
  me,
  balance,
  cases,
  onClose,
}: {
  itemId: string;
  summary: MarketItem | undefined;
  me: Me;
  balance: number;
  cases: CaseInfo[] | undefined;
  onClose: () => void;
}) {
  const act = useCasinoAction();
  const { data, reload } = useCasino<ItemMarket>(`/v1/market/${itemId}`, 20_000);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [trying, setTrying] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function buy(listing: Listing) {
    setBusy(true);
    setNotice(null);
    try {
      await act("/v1/market/buy", { listingId: listing.id });
      setNotice({ kind: "ok", text: `Bought for ${fmt(listing.price)}. It's in your inventory.` });
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      const message = e instanceof ApiError ? e.message : "That didn't work.";
      setNotice(status === 404 || message.startsWith("That listing is gone") ? { kind: "gone" } : { kind: "error", text: message });
      reload();
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  }

  async function takeDown(listing: Listing) {
    setBusy(true);
    setNotice(null);
    try {
      await act("/v1/market/cancel", { listingId: listing.id });
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof ApiError ? e.message : "That didn't work." });
    } finally {
      setBusy(false);
    }
  }

  const item = data?.item ?? summary;
  if (!item) return <aside className="mk-detail mk-skeleton" aria-hidden="true" />;
  const listings = data?.listings ?? [];
  const lowest = listings[0]?.price ?? summary?.lowest ?? null;
  const last = data?.sales[0]?.price ?? summary?.lastSale ?? null;
  const from = caseLabel(item, cases);

  return (
    <aside className="mk-detail" aria-label={item.name}>
      <div>
        <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={onClose}>
          <span className="mk-phone-only">‹ Market</span>
          <span className="mk-desk-only">Close</span>
        </button>
      </div>
      <div className="mk-well is-big">
        <div className="mk-well-art">
          <ItemArt item={item} me={me} size={138} />
        </div>
        <div className={`mk-edge is-thick edge-${item.tier}`} />
      </div>
      <button className="mk-btn mk-btn-quiet mk-btn-sm mk-try-open" onClick={() => setTrying(true)}>
        Try it on your profile
      </button>
      {trying ? (
        <ProfilePreview
          item={item}
          me={me}
          equipped={{
            border: me.border,
            banner: me.banner,
            cardback: me.cardback,
            chipset: me.chipset,
            // The profile only names your title; the cases say which item that is.
            title: cases?.flatMap((c) => c.items).find((i) => i.kind === "title" && i.name === me.title)?.id ?? null,
          }}
          from={from}
          onClose={() => setTrying(false)}
        />
      ) : null}
      <div>
        <div className="mk-meta">
          <span className={`mk-tier tier-${item.tier}`}>{TIER_LABEL[item.tier]}</span>
          <span>
            {KIND_LABEL[item.kind]}
            {from ? ` · ${from}` : ""}
          </span>
        </div>
        <div className="mk-detail-name">{item.name}</div>
      </div>
      <div className="mk-stats">
        <div>
          <span>Lowest</span>
          <strong>{lowest !== null ? fmt(lowest) : "—"}</strong>
        </div>
        <div>
          <span>For sale</span>
          <strong>{data ? listings.length : (summary?.listings ?? 0)}</strong>
        </div>
        <div>
          <span>Last sale</span>
          <strong>{last !== null ? fmt(last) : "—"}</strong>
        </div>
      </div>

      {notice?.kind === "gone" ? (
        <div className="mk-notice is-alert">
          <span className="mk-bang is-small">!</span>
          <div>
            <div className="mk-strong">That listing is gone. Someone may have bought it first.</div>
            <div className="mk-dim">No chips were taken.</div>
          </div>
        </div>
      ) : notice?.kind === "ok" ? (
        <div className="mk-notice">
          <span className="mk-check">✓</span>
          <div className="mk-strong">{notice.text}</div>
        </div>
      ) : notice?.kind === "error" ? (
        <div className="mk-notice is-alert">
          <span className="mk-bang is-small">!</span>
          <div className="mk-strong">{notice.text}</div>
        </div>
      ) : null}

      <div className="mk-list">
        <div className="mk-list-head">
          <span className="mk-h4">Listings</span>
          <span className="mk-quiet mk-small">Cheapest first</span>
        </div>
        {!data ? (
          <div className="mk-row mk-skeleton" />
        ) : listings.length === 0 ? (
          <div className="mk-row is-empty">No one is selling this right now.</div>
        ) : (
          listings.map((l, i) => {
            const short = !l.mine && l.price > balance;
            return (
              <div key={l.id} className={`mk-row${l.mine ? " is-mine" : ""}`}>
                <Avatar player={l.seller} size={36} />
                <div className="mk-row-who">
                  <div className="mk-strong">{l.mine ? "You" : l.seller.name}</div>
                  {l.mine ? <div className="mk-dim mk-small">Your listing</div> : i === 0 ? <div className="mk-lowest">Lowest</div> : null}
                </div>
                <div className="mk-price">
                  <strong>{fmt(l.price)}</strong>
                  <span>chips</span>
                </div>
                {l.mine ? (
                  <button className="mk-btn mk-btn-quiet mk-btn-sm is-deep" onClick={() => void takeDown(l)} disabled={busy}>
                    Take down
                  </button>
                ) : short ? (
                  <span className="mk-btn mk-btn-off mk-btn-sm">Need {fmt(l.price - balance)} more</span>
                ) : confirm === l.id ? (
                  <div className="mk-confirm">
                    <button className="mk-btn mk-btn-quiet mk-btn-sm is-muted" onClick={() => setConfirm(null)} disabled={busy}>
                      Cancel
                    </button>
                    <button className="mk-btn mk-btn-primary mk-btn-sm" onClick={() => void buy(l)} disabled={busy}>
                      {busy ? "Buying…" : `Confirm ${fmt(l.price)}`}
                    </button>
                  </div>
                ) : (
                  <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={() => setConfirm(l.id)}>
                    Buy
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="mk-sales">
        <div className="mk-h4">Recent sales</div>
        {data && data.sales.length === 0 ? <p className="mk-dim mk-small">No sales yet.</p> : null}
        {data?.sales.map((s, i) => (
          <div key={i} className="mk-sale">
            <span className="mk-dim">{s.mine ? "You" : s.buyer}</span>
            <span className="mk-grow" />
            <span className="mk-num">{fmt(s.price)}</span>
            <span className="mk-quiet mk-sale-when">{ago(s.at)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function MarketPanel({ me, balance, cases }: { me: Me; balance: number; cases: CaseInfo[] | undefined }) {
  const { data } = useCasino<{ balance: number; fee: number; items: MarketItem[] }>("/v1/market", 30_000);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [forSale, setForSale] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  if (!data) return <MarketSkeleton />;

  const items = data.items
    .filter((i) => (kind === "all" || i.kind === kind) && (!forSale || i.listings > 0))
    .sort((a, b) => (a.lowest ?? Infinity) - (b.lowest ?? Infinity) || a.name.localeCompare(b.name));

  return (
    <div className={`mk-market${open ? " has-detail" : ""}`}>
      <div className="mk-market-main">
        <div className="mk-filters">
          {KIND_FILTERS.map((k) => (
            <button key={k.kind} className={`mk-chip${k.kind === kind ? " is-on" : ""}`} aria-pressed={k.kind === kind} onClick={() => setKind(k.kind)}>
              {k.label}
            </button>
          ))}
          <span className="mk-grow" />
          <button className="mk-switch" role="switch" aria-checked={forSale} onClick={() => setForSale((v) => !v)}>
            <span className={`mk-switch-track${forSale ? " is-on" : ""}`}>
              <span />
            </span>
            For sale only
          </button>
        </div>
        <p className="mk-dim mk-small">Bought from other players, for chips. Sellers pay a {Math.round(data.fee * 100)}% fee to the house when something sells.</p>
        {items.length === 0 ? (
          <div className="mk-empty mk-panel">
            <div className="mk-h3">No {KIND_PLURAL[kind]} for sale right now</div>
            <p className="mk-sub">Check back later.</p>
            <button className="mk-btn mk-btn-quiet" onClick={() => setForSale(false)}>
              Show all {KIND_PLURAL[kind]}
            </button>
          </div>
        ) : (
          <div className="mk-grid is-market">
            {items.map((item) => (
              <button key={item.id} className={`mk-card${open === item.id ? " is-on" : ""}`} onClick={() => setOpen(item.id)} aria-label={`${item.name}, see listings`}>
                <span className="mk-card-in">
                  <span className="mk-card-art">
                    <ItemArt item={item} me={me} size={96} />
                  </span>
                  <span className={`mk-edge edge-${item.tier}`} />
                  <span className="mk-card-copy">
                    <span className="mk-card-title">
                      <span className="mk-strong">{item.name}</span>
                      <span className={`mk-tier is-tiny tier-${item.tier}`}>{TIER_LABEL[item.tier]}</span>
                    </span>
                    <span className="mk-card-price">
                      <strong>{item.lowest !== null ? fmt(item.lowest) : "—"}</strong>
                      {item.lowest !== null ? <span>lowest</span> : null}
                    </span>
                    <span className="mk-card-foot">
                      <span>{item.listings ? `${item.listings} for sale` : "Not listed"}</span>
                      <span>{item.lastSale !== null ? `Last ${fmt(item.lastSale)}` : ""}</span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {open ? (
        <Detail key={open} itemId={open} summary={data.items.find((i) => i.id === open)} me={me} balance={balance} cases={cases} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="mk-stack mk-skeleton" aria-hidden="true">
      <div className="mk-skel-row">
        {[96, 96, 96, 96, 96].map((w, i) => (
          <span key={i} style={{ width: w, borderRadius: 999, height: 36 }} />
        ))}
      </div>
      <div className="mk-grid is-market">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="mk-skel-card" />
        ))}
      </div>
    </div>
  );
}
