import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagesView } from "./MessagesView";

export const metadata: Metadata = { title: "Messages · Planary Casino" };

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesView />
    </Suspense>
  );
}
