import type { Metadata } from "next";
import { ShopView } from "./ShopView";

export const metadata: Metadata = { title: "Shop · Planary Casino" };

export default function ShopPage() {
  return <ShopView />;
}
