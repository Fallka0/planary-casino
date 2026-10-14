import type { Metadata } from "next";
import { MarketView, type Tab } from "./MarketView";

export const metadata: Metadata = { title: "Market · Planary Casino" };

export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const { tab } = await searchParams;
  const initial: Tab = tab === "market" || tab === "inventory" ? tab : "cases";
  return <MarketView initialTab={initial} />;
}
