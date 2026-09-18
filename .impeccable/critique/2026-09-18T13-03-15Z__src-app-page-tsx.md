---
target: casino lobby main page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-18T13-03-15Z
slug: src-app-page-tsx
---
Method: dual-agent (A: design review · B: detector + DOM evidence)

## Design Health Score — 24/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | System status | 2 | "0 open" tiny/low-contrast; green "live" dot while nothing is live; balance hardcoded |
| 2 | Real world | 3 | "Unlimited"/"Solo" seats ambiguous; "Take a seat" with no open table |
| 3 | Control & freedom | 2 | every card a dead end, no notify / return path |
| 4 | Consistency | 2 | badge + pseudo-button double "soon"; hover-lift on non-clickable cards; role=menu without keyboard model |
| 5 | Error prevention | 3 | mobile "Join" pushes returning users into signup |
| 6 | Recognition | 3 | clear names, art, taglines |
| 7 | Flexibility | 2 | signed-in users get same marketing hero |
| 8 | Aesthetic | 3 | restrained; featured Blackjack body mostly empty |
| 9 | Error recovery | 1 | auth errors from hash swallowed silently |
| 10 | Help | 3 | How it works + disclaimer; nothing on running out of chips |

## Specificity
Well-crafted but category-interchangeable structure. Planary-specific: gold monospace subdomains, 1'000 formatting, violet felt, play-money reassurance. Hero A♠K♥ duplicates the Blackjack card art. Planary suite nearly invisible.
Detector: static scan clean (0 findings). URL scan unavailable (no puppeteer), overlay injection not performed.

## Priority Issues
- [P1] Lobby promises play, delivers five locked doors (hero copy/CTA + dead "Soon" pseudo-buttons, nothing to do).
- [P1] Mobile hides "Sign in"; only "Join" (signup) remains — returning players blocked. globals.css @640px `.header-actions .btn-ghost`.
- [P1] Global `:focus-visible { border-radius: 8px }` reshapes pill buttons + round avatar on keyboard focus.
- [P2] Non-interactive cards lift/tilt on hover; `span[aria-disabled]` "Soon" styled as a button.
- [P2] Balance + "balance follows you" claims unbacked (STARTER_CHIPS constant); note only in title attr.
- [P2] --text-3 contrast 4.34:1 on bg / 4.32 on cards (fails AA) at 12.8–13.6px.

## Persona Red Flags
Jordan: Browse games → all locked; "Claim your chips" with no payoff. Casey: mobile shows felt first, Sign in hidden, long scroll to learn nothing is open. Sam: text-3 contrast, focus shape change, menu semantics, balance note in title only, silent auth errors.

## Minor
Hero CTA flashes "Claim your chips" for signed-in users while loading; sub-12px text (.brand-sub, .status, .felt-label); felt label 3.1–3.8:1; no footer link back to Planary; brand link should be next/link; signed-in hero still pitches starter chips.

## Questions
Lobby vs "tables opening" page? Planary-suite-as-hero? Chip as the central visual idea?
