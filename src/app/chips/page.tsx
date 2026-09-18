import type { Metadata } from "next";
import { SoonPage } from "@/components/SoonPage";
import { formatChips, STARTER_CHIPS } from "@/lib/games";

export const metadata: Metadata = { title: "Chips · Planary Casino" };

export default function ChipsPage() {
  return (
    <SoonPage
      title="Chips"
      sub="One balance for every table. Play money only, with no cash value."
      what={`Every Planary account starts with ${formatChips(STARTER_CHIPS)} starter chips. Chip history and daily bonuses come with the wallet.`}
    >
      <ul className="ledger">
        <li>
          <span>Starter chips</span>
          <span className="ledger-amount">+{formatChips(STARTER_CHIPS)}</span>
        </li>
        <li>
          <span>Blackjack · won hand</span>
          <span className="ledger-amount">+150</span>
        </li>
        <li>
          <span>Roulette · bet on red</span>
          <span className="ledger-amount is-minus">−200</span>
        </li>
      </ul>
    </SoonPage>
  );
}
