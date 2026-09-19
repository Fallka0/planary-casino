import type { Metadata } from "next";
import { ProfileView } from "./ProfileView";

export const metadata: Metadata = { title: "Profile · Planary Casino" };

export default async function ProfilePage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  return <ProfileView id={id} />;
}
