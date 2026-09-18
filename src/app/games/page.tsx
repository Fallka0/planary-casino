import type { Metadata } from "next";
import { Suspense } from "react";
import { GameBrowser } from "./GameBrowser";

export const metadata: Metadata = { title: "Games · Planary Casino" };

export default function GamesPage() {
  return (
    <Suspense>
      <GameBrowser />
    </Suspense>
  );
}
