"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ChipIcon } from "@/components/ChipIcon";
import { TitlePill, TitleText } from "@/components/TitlePill";
import type { Me } from "@/lib/api";
import { type Equipped, type ItemInfo, KIND_LABEL, TIER_LABEL } from "./cosmetics";

/** Where each kind shows up, said plainly under the mock-up. */
const WHERE: Record<ItemInfo["kind"], string> = {
  banner: "Behind your name on your profile.",
  border: "Round your picture everywhere: your profile, the friends list, messages and the tables.",
  title: "Under your name on your profile, in the friends list and on the leaderboard.",
  cardback: "On the dealer's face-down card and the shuffle at the blackjack table.",
  chipset: "On your bets, as everyone at the table sees them.",
};

/**
 * An item tried on: a mock-up of your profile with it swapped in, and the
 * friends list and a table seat beside it. Everything else is what you wear now.
 */
export function ProfilePreview({
  item,
  me,
  equipped,
  from,
  onClose,
}: {
  item: Pick<ItemInfo, "id" | "kind" | "name" | "tier" | "blurb">;
  me: Me;
  equipped: Equipped | null;
  from: string | null;
  onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  // What you have on now; without the inventory loaded, what your profile says you wear.
  const now: Equipped = equipped ?? { border: me.border, banner: me.banner, title: null, cardback: me.cardback, chipset: me.chipset };
  const wearing = (kind: ItemInfo["kind"]) => (item.kind === kind ? item.id : now[kind]);
  const border = wearing("border");
  const banner = wearing("banner");
  const cardback = wearing("cardback");
  const chipset = wearing("chipset");
  const titleId = item.kind === "title" ? item.id : (equipped?.title ?? null);
  const titleName = item.kind === "title" ? item.name : me.title;
  const player = { ...me, border };
  const on = (kind: ItemInfo["kind"]) => (item.kind === kind ? " is-on" : "");
  // A soft light that pulses round whatever this item changes, so the eye goes there first.
  const glow = (...kinds: ItemInfo["kind"][]) => (kinds.includes(item.kind) ? <span className="mk-try-glow" aria-hidden="true" /> : null);

  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      html.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="mk-try" role="dialog" aria-modal="true" aria-labelledby="mk-try-name" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mk-try-card">
        <header className="mk-try-head">
          <div>
            <div className="mk-meta">
              <span className={`mk-tier tier-${item.tier}`}>{TIER_LABEL[item.tier]}</span>
              <span>
                {KIND_LABEL[item.kind]}
                {from ? ` · ${from}` : ""}
              </span>
            </div>
            <h2 id="mk-try-name" className="mk-try-name">
              {item.name}
            </h2>
            <p className="mk-dim">{item.blurb}</p>
          </div>
          <button ref={close} className="icon-btn" onClick={onClose} aria-label="Close preview">
            <X size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </header>

        <div className="mk-try-stage">
          {/* Your profile */}
          <div className="mk-try-page" aria-label="Your profile, with this item">
            <div className={`mk-try-banner banner ${banner ?? "banner-default"}${on("banner")}`}>
              {glow("banner")}
              <div className={`mk-try-who${on("border")}`}>
                <Avatar player={player} size={72} />
                <div className="mk-try-id">
                  {titleName ? <TitlePill id={titleId} name={titleName} className={`profile-title${on("title")}`} /> : null}
                  <strong>{me.name}</strong>
                  <span>In the lobby</span>
                </div>
              </div>
            </div>
            <div className="mk-try-body" aria-hidden="true">
              <div className="mk-try-block">
                <i style={{ width: "34%" }} />
                <i style={{ width: "82%" }} />
                <div className="mk-try-stats">
                  <b />
                  <b />
                  <b />
                </div>
              </div>
              <div className="mk-try-block">
                <i style={{ width: "48%" }} />
                <div className="mk-try-badges">
                  <b />
                  <b />
                  <b />
                </div>
              </div>
            </div>
          </div>

          {/* The friends list and a seat at the table */}
          <div className="mk-try-side">
            <div className="mk-try-mini">
              <span className="mk-try-label">Friends list</span>
              <div className={`mk-try-friend${on("border")}${on("title")}`}>
                {glow("border", "title")}
                <Avatar player={player} size={40} status="online" />
                <div className="mk-try-id is-small">
                  <strong>{me.name}</strong>
                  <span>{titleName ? <TitleText id={titleId} name={titleName} /> : "In the lobby"}</span>
                </div>
              </div>
              <div className="mk-try-friend is-ghost" aria-hidden="true">
                <span />
                <div>
                  <i style={{ width: 70 }} />
                  <i style={{ width: 44 }} />
                </div>
              </div>
            </div>
            <div className="mk-try-mini">
              <span className="mk-try-label">At the table</span>
              <div className="mk-try-felt">
                <span className={`mk-art mk-cards mk-try-cards${on("cardback")}`}>
                  {glow("cardback")}
                  <span className={`print-back ${cardback ?? "cardback-classic"}`} />
                  <span className={`print-back ${cardback ?? "cardback-classic"}`} />
                </span>
                <span className={`mk-chips mk-try-chips${on("chipset")}`}>
                  {glow("chipset")}
                  {[10, 50, 100, 500].map((v) => (
                    <ChipIcon key={v} size={30} value={v} set={chipset} />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>

        <footer className="mk-try-foot">
          <p className="mk-quiet mk-small">{WHERE[item.kind]} Everything else is what you&apos;re wearing now.</p>
          <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
