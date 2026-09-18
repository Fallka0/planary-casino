import type { Metadata } from "next";
import { FriendsView } from "./FriendsView";

export const metadata: Metadata = { title: "Friends · Planary Casino" };

export default function FriendsPage() {
  return <FriendsView />;
}
