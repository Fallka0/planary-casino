# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Planary account holders who want quick card and table games with play money. Both solo players (against the house, comparing on leaderboards) and small groups of friends who play together at private tables.

## Product Purpose
Planary Casino (casino.planary.ch) is the lobby for a set of play-money games. Each game lives on its own subdomain: Blackjack (21.planary.ch), Poker (poker.planary.ch), Baccarat (baccarat.planary.ch), Roulette (roulette.planary.ch), Slots (slots.planary.ch). The lobby is where players see their chips, find a game, see which friends are online and where they rank.

## Positioning
One Planary account (the same one used for Planary Wishlist and other Planary apps) and one chip balance across every table. It is a game launcher for Planary, explicitly not a gambling site.

## Operating Context
- Auth is central: redirect to auth.planary.ch with `returnTo`; the access token comes back in the URL hash, is kept in the browser and verified server-side via auth.planary.ch/api/auth/me (the apps hold no Supabase keys). Tokens last about an hour; there is no silent refresh yet.
- Stack: Next.js (App Router) + TypeScript; later Postgres for wallet/social data; hosting Vercel (+ Firebase per the concept note).

## Capabilities and Constraints
- Blackjack is live at 21.planary.ch (separate app: planary-blackjack, multiplayer on PartyKit); the other four games are "coming soon". The lobby lives at casino.planary.ch.
- Planary Chips are play money: no cash value, cannot be bought, sold or exchanged.
- Starter balance of 5'000 chips; kept in the browser until the wallet exists (wallet logic comes later).
- Friends, online status, leaderboard and chip history have no backend yet; any data shown there is sample data and must be labeled as such.
- Swiss formatting for numbers (1'000).

## Brand Commitments
- Name: Planary Casino. Parent brand Planary (violet #8b5cf6 in other apps).
- User-pinned visual reference: a game-launcher dashboard (sidebar nav, search, hero carousel, side list, art cards), in a burgundy finish like the iPhone Pro colorway. The user explicitly rejected a classic casino look (felt, gold, serif luxury).
- Must not look AI-generated.

## Evidence on Hand
No game artwork, player counts, testimonials or real social data exist. Artwork is authored in code (SVG posters). Never invent player counts or winnings.

## Product Principles
1. Games first: the lobby exists to get a player to a table quickly.
2. Honest state: unopened games, sample data and placeholder balances are always labeled.
3. One account, one balance, across every Planary table.
4. Play money, never gambling language around real money.
