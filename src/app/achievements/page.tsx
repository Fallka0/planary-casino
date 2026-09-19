import type { Metadata } from "next";
import { Suspense } from "react";
import { AchievementsView } from "./AchievementsView";

export const metadata: Metadata = { title: "Achievements · Planary Casino" };

export default function AchievementsPage() {
  return (
    <Suspense fallback={null}>
      <AchievementsView />
    </Suspense>
  );
}
