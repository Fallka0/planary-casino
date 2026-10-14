"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ChipIcon } from "@/components/ChipIcon";
import { SignInPrompt } from "@/components/SignInPrompt";
import { type Me, useCasino } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { CasesPanel } from "./CasesPanel";
import type { Kind } from "./cosmetics";
import { InventoryPanel } from "./InventoryPanel";
import { MarketPanel } from "./MarketPanel";

export type Tab = "cases" | "market" | "inventory";

const TABS: { tab: Tab; label: string }[] = [
  { tab: "cases", label: "Cases" },
  { tab: "market", label: "Market" },
  { tab: "inventory", label: "Inventory" },
];

export function MarketView({ initialTab }: { initialTab: Tab }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: me } = useCasino<Me>(user ? "/v1/me" : null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [kind, setKind] = useState<Kind | undefined>(undefined);

  function go(next: Tab) {
    setTab(next);
    router.replace(next === "cases" ? "/market" : `/market?tab=${next}`, { scroll: false });
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Market</h1>
        <p className="page-sub">Open cases for borders, banners, titles and table cosmetics, then trade them with other players for chips.</p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to open cases and trade on the market." />
      ) : !me ? (
        <div className="panel-skeleton tall" aria-hidden="true" />
      ) : (
        <>
          <div className="market-bar">
            <div className="market-tabs" role="tablist" aria-label="Market">
              {TABS.map((t) => (
                <button key={t.tab} role="tab" className="market-tab" aria-selected={t.tab === tab} onClick={() => go(t.tab)}>
                  {t.label}
                </button>
              ))}
            </div>
            <span className="market-balance">
              <ChipIcon size={17} /> {formatChips(me.balance)}
            </span>
          </div>
          {tab === "cases" ? (
            <CasesPanel
              me={me}
              onSell={(k) => {
                setKind(k);
                go("inventory");
              }}
            />
          ) : tab === "market" ? (
            <MarketPanel me={me} />
          ) : (
            <InventoryPanel me={me} onCases={() => go("cases")} initialKind={kind} />
          )}
        </>
      )}
    </section>
  );
}
