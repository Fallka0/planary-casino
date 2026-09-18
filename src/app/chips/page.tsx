import type { Metadata } from "next";
import { Suspense } from "react";
import { ChipsView } from "./ChipsView";

export const metadata: Metadata = { title: "Chips · Planary Casino" };

export default function ChipsPage() {
  return (
    <Suspense>
      <ChipsView />
    </Suspense>
  );
}
