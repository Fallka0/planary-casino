import type { Metadata } from "next";
import { Big_Shoulders, Onest } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";
import "./social.css";

const ui = Onest({ variable: "--font-ui", subsets: ["latin"] });
const poster = Big_Shoulders({ variable: "--font-poster", weight: ["700", "800", "900"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Planary Casino",
  description: "Blackjack, Poker, Baccarat, Roulette and Slots with one Planary account. Play money only.",
  icons: { icon: "/favicon.svg" },
};

const CONTRACT = `<!--
THESIS: A game launcher, not a casino: the lobby is a dashboard you return to, with each table sold by its own printed cover. Refuses felt, gold, serif luxury and neon-on-black.
OWN-WORLD: Anodized burgundy shell (iPhone Pro finish) in three tonal layers, cream type, one hot cherry for actions and state. Key art is screen-printed posters: flat field, 2-3 inks, halftone, grain, one mis-registered plate, condensed poster lettering.
STORY: Player sees the next table to open, their chips and friends; picks a game or joins to claim chips.
FIRST VIEWPORT: Sidebar left (nav, online friends). Top: search, balance, account. Spotlight carousel ~2/3 width with poster art bleeding right and title/actions left; weekly leaderboard panel right. Poster row begins below the fold line.
FORM: user-pinned reference (game-launcher dashboard), code-led, no seed roll (pinned beats roll).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${ui.variable} ${poster.variable}`}>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
