---
name: Planary Casino
description: A play-money game launcher in an anodized burgundy shell, each table sold by its own screen-printed cover.
colors:
  ground: "#2a0915"
  shell: "#3b0d1f"
  layer-1: "#4c1329"
  layer-2: "#5e1a34"
  layer-3: "#722440"
  line: "rgba(255, 214, 224, 0.08)"
  line-strong: "rgba(255, 214, 224, 0.15)"
  cream-paper: "#f6eee4"
  text: "#f8ecee"
  text-2: "rgba(248, 236, 238, 0.74)"
  text-3: "rgba(248, 236, 238, 0.6)"
  cherry: "#ff2e55"
  cherry-hover: "#ff4d6d"
  cherry-soft: "rgba(255, 46, 85, 0.14)"
  online: "#5ee39a"
  away: "#f5b94a"
  poster-blackjack: "#b3122e"
  poster-poker: "#1d1846"
  poster-baccarat: "#e8c7a2"
  poster-roulette: "#ff5b2e"
  poster-slots: "#cc1259"
  poster-ink-light: "#fbf1ea"
  poster-ink-dark: "#2a0710"
typography:
  display:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "clamp(3.6rem, 6.4vw, 5.6rem)"
    fontWeight: 900
    lineHeight: 0.86
    letterSpacing: "0"
  headline:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "3.2rem"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline-section:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "2.2rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  title-panel:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "1.7rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
  title-cover:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "2.1rem"
    fontWeight: 900
    lineHeight: 0.9
  caption-cover:
    fontFamily: "Big Shoulders, var(--font-poster), sans-serif"
    fontSize: "0.95rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  body:
    fontFamily: "Onest, var(--font-ui), system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Onest, var(--font-ui), system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
    lineHeight: 1.3
  label-action:
    fontFamily: "Onest, var(--font-ui), system-ui, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
  label-group:
    fontFamily: "Onest, var(--font-ui), system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: "12px"
  control: "14px"
  md: "18px"
  lg: "24px"
  pill: "999px"
  action: "14px 5px 14px 5px"
  action-lg: "16px 6px 16px 6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  section: "28px"
components:
  button-cherry:
    backgroundColor: "{colors.cherry}"
    typography: "{typography.label-action}"
    rounded: "{rounded.action}"
    padding: "0 18px"
    height: "42px"
  button-cherry-hover:
    backgroundColor: "{colors.cherry-hover}"
  button-cherry-lg:
    backgroundColor: "{colors.cherry}"
    rounded: "{rounded.action-lg}"
    padding: "0 26px"
    height: "50px"
  button-quiet:
    backgroundColor: "{colors.layer-2}"
    textColor: "{colors.text}"
    typography: "{typography.label-action}"
    rounded: "{rounded.action}"
    padding: "0 18px"
    height: "42px"
  button-quiet-hover:
    backgroundColor: "{colors.layer-3}"
  search-field:
    backgroundColor: "{colors.layer-1}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "44px"
  side-link:
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "46px"
  side-link-hover:
    backgroundColor: "{colors.layer-1}"
    textColor: "{colors.text}"
  side-link-active:
    backgroundColor: "{colors.layer-2}"
    textColor: "{colors.text}"
  filter-chip:
    backgroundColor: "{colors.layer-1}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  filter-chip-hover:
    backgroundColor: "{colors.layer-2}"
    textColor: "{colors.text}"
  filter-chip-pressed:
    backgroundColor: "{colors.cherry}"
  panel:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "22px"
  cover-tile:
    rounded: "{rounded.md}"
    padding: "18px"
  sample-tag:
    textColor: "{colors.text-3}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
---

# Design System: Planary Casino

## Overview

**Creative North Star: "The Anodized Launcher"**

Planary Casino is a game launcher, not a casino. The interface is a dark, finished object: a burgundy shell stepped in value like anodized aluminium catching light at different angles, carrying cream type and exactly one hot cherry for actions and state. The chrome is quiet and dense, a dashboard you come back to: sidebar, top bar, panels, lists. All colour, texture and noise are handed to the key art.

The key art is a set of screen-printed covers authored in code: one flat field, two or three inks, a halftone dot screen, a grain pass, and one plate printed slightly off register. Each cover owns its field colour and its ink colour, and every container that holds a cover (spotlight, tile, pill, button) inherits that pair rather than imposing the shell's palette on it. Condensed poster lettering (Big Shoulders) carries every title and section heading; a geometric sans (Onest) carries everything you read or operate.

The world explicitly refuses the casino register: no felt green, no gold, no serif luxury, no neon on black. It also never looks rendered: covers are flat and printed, not glossy or 3D.

**Key Characteristics:**
- Burgundy tonal layering instead of shadows: ground, shell, three layers.
- One accent: cherry marks the primary action, the current place and the top rank.
- Screen-printed covers as the only illustration, each with its own field/ink pair.
- Condensed uppercase poster lettering for titles; calm sans for UI.
- Asymmetric-corner action shape shared by every button.
- Honest-state furniture: "Sample" tags, "Opens first" / "Coming soon" pills.

## Colors

A monochrome burgundy shell with cream type and one hot cherry; saturated colour lives only inside the printed covers.

### Primary
- **Hot Cherry** (`cherry`): the one action and state colour. Primary buttons, the pressed filter chip, the icon of the current nav item, the active nav border (at 45% alpha), the rank-one numeral, focus outlines, caret and selection, and the fill of the Chip mark. Hover lightens to **Cherry Bloom** (`cherry-hover`). **Cherry Wash** (`cherry-soft`) is the active tab ground on mobile; the notice banner uses the same cherry at 12% fill with a 40% border.

### Tertiary
Poster fields and inks.
- **Oxblood Print** (`poster-blackjack`), **Midnight Indigo Print** (`poster-poker`), **Sand Card Print** (`poster-baccarat`), **Safety Orange Print** (`poster-roulette`), **Hot Magenta Print** (`poster-slots`): each cover's flat field. They appear only as a cover and in the surfaces that extend a cover (spotlight ground, tile feather, pill text), never as UI chrome.
- **Print Cream** (`poster-ink-light`) and **Print Oxblood** (`poster-ink-dark`): the ink a cover's text is set in. Light ink on the deep fields (blackjack, poker, slots), dark ink on the pale and orange fields (baccarat, roulette).

### Neutral
- **Anodized Ground** (`ground`): page background, under a 160deg sweep from #561430 to #1f0710 with a fine brushed grain at 5% opacity. It is the only full-bleed gradient.
- **Shell** (`shell`): sidebar, top bar, panels, empty states. The first layer above ground.
- **Layer 1 / Layer 2 / Layer 3** (`layer-1`, `layer-2`, `layer-3`): controls on a shell (search, balance, account, filters), then hover and active, then the next hover or the avatar disc. Each interaction steps one layer up.
- **Hairline** (`line`) and **Hairline Strong** (`line-strong`): 1px borders on shell containers and list dividers; strong on controls, menus and dashed empty states.
- **Cream Paper** (`cream-paper`): the paper of printed cards and the Chip mark's cream ink; avatar initials.
- **Cream Text** (`text`), **Text 2** (`text-2`), **Text 3** (`text-3`): primary copy, secondary copy and links, metadata and placeholders.
- **Online Green** (`online`) and **Away Amber** (`away`): presence dots on avatars only; green also marks positive ledger amounts, cherry-hover marks negative ones.

### Named Rules
**The One Cherry Rule.** Cherry is the only accent in the shell. It marks the thing to press, where you are, and who is first. If a second element on a screen wants cherry for decoration, it does not get it.

**The Field Belongs to the Cover Rule.** Poster fields and inks are never used as chrome colours. A container shows a field colour only because it is holding that cover.

**The Step-Up Rule.** Depth and interaction are expressed by stepping one burgundy value up (ground, shell, layer 1, 2, 3), never by adding a shadow or a new hue.

## Typography

**Display Font:** Big Shoulders (weights 700, 800, 900 loaded; `--font-poster`)
**Body Font:** Onest (`--font-ui`, with system-ui, sans-serif)

**Character:** Condensed, uppercase poster lettering does the selling, the same face the covers are printed in; Onest does the operating, round and plain enough to vanish.

### Hierarchy
- **Display** (Big Shoulders 900, clamp(3.6rem, 6.4vw, 5.6rem), line-height 0.86, uppercase): the spotlight game title only. Rises in with a 0.6s fade and slight blur on change.
- **Headline** (Big Shoulders 800, 3.2rem / 2.6rem under 900px, line-height 0.95, 0.01em, uppercase): inner page titles.
- **Headline Section** (Big Shoulders 800, 2.2rem / 1.8rem mobile, line-height 1, uppercase): lobby row headings ("All tables").
- **Title Panel** (Big Shoulders 800, 1.7rem, uppercase): panel headings ("This week", "Preview").
- **Title Cover** (Big Shoulders 900, 2.1rem / 1.7rem under 420px, line-height 0.9, uppercase): game name on a tile, in the cover's ink.
- **Caption Cover** (Big Shoulders 700, 0.95rem, 0.14em tracking, uppercase, 85% opacity): the game's rules line under the cover title ("Hit · Stand · Double"). It sits below its title, never above it.
- **Body** (Onest 400, 15px, line-height 1.5): all running copy. Blurbs cap at 38ch, page subtitles at 60ch, notes at 70ch.
- **Label** (Onest 500, 0.8 to 0.9rem): nav items, names, tags, metadata, links.
- **Label Action** (Onest 600, 0.92rem; 0.98rem large, 0.84rem small): button text.
- **Label Group** (Onest 600, 0.78rem, 0.06em, uppercase, text-3): list group headings in the sidebar ("Online now") only.

### Named Rules
**The Poster Voice Rule.** Anything that names a place, a game or a section is set in Big Shoulders, uppercase, weight 800 or 900. Anything a person reads as a sentence or presses is Onest, sentence case.

**The Tabular Chips Rule.** Every chip count, rank and counter uses `font-variant-numeric: tabular-nums` and Swiss grouping (18'450).

## Layout

A two-column dashboard: a sticky 248px sidebar (full viewport height minus 32px) and a fluid stage, both inset 16px from the viewport with 16px between them. The stage stacks a 68px top bar and content with 16px gaps; content sections stack at 28px. The lobby top row is the spotlight (fluid, min 460px tall) beside a 340px leaderboard panel; covers follow in a five-column row of 3:4 tiles at 16px gaps. Inner pages are a single column with the page head, a note, then one panel capped at 720px.

The spacing rhythm is 4, 8, 12, 16 with 22px panel padding and 28px between sections and sidebar groups; 16 is the default gap everywhere.

Responsive steps: at 1240px the leaderboard panel drops out and tiles go to three columns. At 900px the sidebar is replaced by a fixed bottom tab bar (five items), the shell insets shrink to 10px, the top bar gains the Chip mark, the spotlight stacks art over copy (min 560px), and the tile row becomes a horizontal scroll-snap strip with each tile at 62% width (74% under 420px). The games grid stays a two-column grid on mobile.

## Elevation & Depth

The system is flat and tonal. Depth comes from the burgundy value steps and 1px hairlines, not from shadows; containers at rest carry no shadow at all. Shadows exist only where something genuinely floats or lifts.

### Shadow Vocabulary
- **Action lift** (`box-shadow: 0 10px 24px -12px rgba(255, 46, 85, 0.8)`): under the cherry button only, a tight tinted underlight that seats it on the shell.
- **Cover action lift** (`box-shadow: 0 12px 28px -14px rgba(0, 0, 0, 0.6)`): the same button when it takes the cover's ink inside the spotlight.
- **Menu float** (`box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.7)`): the account dropdown, the one overlay.

### Named Rules
**The Flat Shell Rule.** Panels, tiles, sidebar and top bar never cast shadows. If a surface needs to read as higher, it moves up one burgundy layer.

**The Functional Blur Rule.** `backdrop-filter` is used once: the fixed mobile tab bar (blur 16px over 94% shell), where content scrolls beneath it. No decorative glass anywhere else.

## Shapes

Softly rounded, nested radii: 24px for outer containers (sidebar, top bar, panels, spotlight, empty states), 18px for covers, notices and menus, 14px for controls (search, balance, nav links, sidebar action, tabs), 12px for small list rows, full pills for tags, filters, status pills and the account button, and circles for avatars and the round carousel controls.

The one distinctive silhouette is the **action shape**: asymmetric corners 14/5/14/5 (16/6/16/6 on the large size), top-left and bottom-right round, the other two nearly square, like a die-cut ticket. Every button and the "Your chips are waiting" confirmation share it; nothing else uses it.

Borders are 1px hairlines; dashed only for empty states.

## Components

### Buttons
Compact, ticket-cut and confident.
- **Shape:** the action shape (14px 5px 14px 5px); large (16px 6px 16px 6px).
- **Cherry (primary):** cherry fill, Onest 600, 42px tall, 18px sides; large 50px / 26px; small 34px / 14px. Carries the action lift. Filled with the deeper `--cherry-fill` (#d9173c, hover #c21334) so the white label reaches about 4.8:1; bright `--cherry` stays for accents, borders and icons, never behind white text.
- **Quiet (secondary):** layer 2 fill with a strong hairline; hover to layer 3.
- **On a cover:** inside the spotlight the cherry button inverts to the cover's pair (ink fill, field-coloured label), hover mixes 12% field into the ink.
- **States:** colour transitions at 0.18s; press scales to 0.97 on the ease-out curve; focus is a 2px cherry outline offset 2px.
- **Round control:** 44px circle in the cover's ink at 10% fill and 40% border, used for carousel previous/next; press scales to 0.92.

### Chips (tags, filters, pills)
- **Tags:** pill, 4px 11px, 0.78rem 500, ink at 14% over the cover, text inherits the ink.
- **Filters:** 36px pill on layer 1 with strong hairline, text 2; hover to layer 2 and full text; pressed takes the cherry fill.
- **Status pills:** 28px pill, 0.8rem 700, set in reverse: the cover's ink as ground, the cover's field as text. Pinned top right of the cover.
- **Sample tag:** 0.75rem pill on 6% white, text 3; required beside any sample data.

### Cards / Containers
- **Panels:** shell fill, 24px radius, 1px hairline, 22px padding; heading row in Title Panel with an optional sample tag at the end; a quiet underlined link pinned to the bottom.
- **Cover tiles:** 3:4, 18px radius, the poster full-bleed, a feather from transparent at 58% into the field colour by 84% so the copy sits on the cover's own paper; copy padded 18px in the cover's ink. Open tables are links and the art scales to 1.05 on hover over 0.6s; closed tables are static articles.
- **Notices:** cherry at 12% with a 40% cherry border, 18px radius.
- **Empty state:** shell fill with a dashed strong hairline, 24px radius, 40px 32px padding, Onest 700 1.25rem heading, one action.

### Inputs / Fields
- **Search:** 44px, layer 1, 14px radius, hairline border, leading icon in text 3, placeholder in text 3.
- **Focus:** the border turns cherry at 50% and a 2px cherry outline appears around the whole field on keyboard focus.

### Navigation
- **Sidebar links:** 46px rows, 14px radius, Onest 500 in text 2 with a 19px line icon (stroke 1.8). Hover steps to layer 1; current page sits on layer 2 with a cherry hairline at 45% and a cherry icon.
- **Sidebar groups:** Label Group heading with a sample tag, then avatar rows (36px disc on layer 3, cream initials, presence dot with a 2px shell ring).
- **Top bar:** shell strip holding search, the chip balance (Chip mark, tabular count), and account (pill with avatar) or sign in / join.
- **Mobile tab bar:** fixed 10px from the edges, 20px radius, five items in 0.75rem labels; current item on cherry wash with a cherry icon.

### Spotlight (signature)
The lobby's carousel is a cover blown up to banner width. The container takes the current cover's field as its ground and its ink as its text; the poster fills the right 64% and feathers leftward into the same field (solid to 30%, gone by 64%), so title, blurb, tags and action sit on the poster's own colour with no dark scrim. Covers crossfade over 0.7s with a slow 1.06 to 1 settle; the ground colour transitions with them. Autoplay is 8s, paused on hover and focus and disabled under reduced motion; a counter pill (field mixed 18% with ink) shows position and a progress ring. On mobile the art takes the top 62% and feathers downward.

### Chip Mark (signature)
An authored flat chip: cherry disc, dashed cream edge ring, cream centre with a cherry dot, or a cherry "P" in Big Shoulders 900 as the brand mark. Two inks, no gradient, no bevel. It is both the logo and the unit glyph beside every chip count.

### Screen-printed Covers (signature)
600 by 800 SVG covers, subject in the right two thirds. Each is one flat field, a halftone dot screen (14px, rotated 22deg, fading in toward the bottom), a multiply grain pass at 35%, two or three inks, and one plate printed about 10 to 12px off register. Playing cards are cream paper with Big Shoulders indices.

## Do's and Don'ts

### Do:
- **Do** step up one burgundy layer (ground, shell, layer 1, 2, 3) for every hover, active or nested surface.
- **Do** give every container that holds a cover the cover's field and ink as `--field` and `--ink`, and derive its pill, tags, controls and button from that pair.
- **Do** feather covers into their own field colour; the copy sits on the poster's paper.
- **Do** use the 14/5/14/5 action shape for every button, and only for buttons.
- **Do** set titles, section and panel headings, and cover names in Big Shoulders uppercase 800 to 900.
- **Do** label sample data with the sample tag and unopened tables with "Opens first" or "Coming soon".
- **Do** use the Chip mark beside every chip amount, with tabular numerals and Swiss grouping.

### Don't:
- **Don't** use felt green, gold, serif display faces or neon on black; the shell is burgundy, the type is cream.
- **Don't** add a second accent to the shell; cherry is the only one.
- **Don't** put a dark scrim or black gradient over a cover.
- **Don't** draw a gradient, glossy or 3D coin; the Chip mark is flat, two inks.
- **Don't** add shadows to panels, tiles, sidebar or top bar.
- **Don't** use `backdrop-filter` except on a fixed bar that content scrolls under.
- **Don't** use poster field colours as UI chrome outside a cover.
