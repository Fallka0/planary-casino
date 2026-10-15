"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInPrompt } from "@/components/SignInPrompt";
import { type Me, useCasino } from "@/lib/api";
import { CasesPanel } from "./CasesPanel";
import type { CaseInfo, Inventory } from "./cosmetics";
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
  const { data: inventory } = useCasino<Inventory>(user ? "/v1/inventory" : null);
  const { data: cases } = useCasino<{ cases: CaseInfo[] }>(user ? "/v1/cases" : null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [pick, setPick] = useState<string | null>(null);

  function go(next: Tab) {
    setTab(next);
    router.replace(next === "cases" ? "/market" : `/market?tab=${next}`, { scroll: false });
  }

  const owned = inventory ? new Set(inventory.copies.map((c) => c.item.id)).size : 0;
  const balance = inventory?.balance ?? me?.balance ?? 0;

  return (
    <section className="page mk-page" aria-labelledby="page-title">
      <h1 id="page-title" className="mk-h1">
        Market
      </h1>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to open cases and trade on the market." />
      ) : (
        <>
          <div className="mk-tabs" role="tablist" aria-label="Market">
            {TABS.map((t) => (
              <button key={t.tab} role="tab" className="mk-tab" aria-selected={t.tab === tab} onClick={() => go(t.tab)}>
                {t.label}
                {t.tab === "inventory" && owned ? <span className="mk-tab-count">{owned}</span> : null}
              </button>
            ))}
          </div>
          {!me ? (
            <div className="mk-skeleton mk-skel-stage" aria-hidden="true" />
          ) : tab === "cases" ? (
            <CasesPanel
              me={me}
              balance={balance}
              equipped={inventory?.equipped ?? null}
              onSell={(itemId) => {
                setPick(itemId);
                go("inventory");
              }}
            />
          ) : tab === "market" ? (
            <MarketPanel me={me} balance={balance} cases={cases?.cases} />
          ) : (
            <InventoryPanel me={me} inventory={inventory} initialItem={pick} onCases={() => go("cases")} />
          )}
        </>
      )}
    </section>
  );
}
