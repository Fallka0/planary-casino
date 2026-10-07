# Planary Casino

The lobby for a set of **play-money** card and table games under the Planary brand. One Planary account and one chip balance across every game. Chips have no cash value and cannot be bought or sold: this is a game launcher, not a gambling site.

**Live:** [planary-casino.vercel.app](https://planary-casino.vercel.app)

![Next.js](https://img.shields.io/badge/Next.js-000?logo=nextdotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white)

## What it does

- Game lobby linking to the individual games, each on its own subdomain ([Blackjack](https://github.com/Fallka0/planary-blackjack), [Slots](https://github.com/Fallka0/planary-slots), more coming)
- Server-side **wallet** per account, so the chip balance is the same in every game
- Social layer: friends, online status, messages, notifications
- Weekly leaderboards and achievements
- Sign-in through the shared Planary auth service, verified server-side

## Fairness

Every game's odds are published and checked. `scripts/rtp.mjs` computes each slot machine's return to player twice, once in closed form and once by brute force over every possible reel combination, and fails if either result disagrees with the figure shown to players.

## Architecture

```
src/       Next.js app: lobby, profiles, friends, leaderboard, rules
worker/    Cloudflare Worker: wallet, social, achievements, admin API
shared/    code shared between app, worker and games
scripts/   fairness and RTP checks
```

## How it was built

Developed with AI coding agents (Claude Code). I write the specs (`PRODUCT.md`, `DESIGN.md`), steer the agents, and review and test what they produce.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Part of [Planary](https://github.com/Fallka0?tab=repositories&q=planary).
