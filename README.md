# Nerdy Town

> Where nerds are always winners — whether they get rejected by pretty girls or simply get their number.

Utility platform for the **$NERDY** meme coin. Send a partner request to anyone:

- **Accepted** → you instantly get their phone number.
- **Rejected** → it's logged on your dashboard as public popularity (Phase 1), and converts into $NERDY after the token graduates on pump.fun (Phase 2).

## Stack

Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion · lucide-react

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build in dist/
```

SPA rewrites are included for Vercel (`vercel.json`) and Netlify (`public/_redirects`).

## Pages

| Route | Page |
| --- | --- |
| `/` | Marketing landing: interactive mascot, win-win simulator, roadmap, hall of fame, FAQ |
| `/explore` | Search, filter chips (All / Nearby / New / Popular), gender filter, 3D-tilt profile grid |
| `/u/:id` | Profile detail: swipeable gallery, stats, About, interests, locked/revealed phone, Send Request |
| `/signup`, `/login` | Auth (required before a profile can be created) + one-click demo account |
| `/onboarding` | 4-step profile wizard (basics, photos / avatar builder, vibe, private phone) — also used to edit |
| `/dashboard` | Popularity/matches counters, incoming/sent/matches/L-log, daily request ring, $NERDY balance, wallet connect & withdraw |

## Phase logic

All rules live in `src/lib/store.ts`:

- `FREE_DAILY_REQUESTS = 3` (reset at midnight UTC), one request per person, ever.
- Phase 1: rejection → `rejectionsReceived + 1` (public popularity).
- Phase 2: rejection also pays `REJECT_REWARD = 100` $NERDY; extra requests cost `EXTRA_REQUEST_COST = 250`; withdraw to a connected Solana wallet (min 500).
- Phone numbers are only returned by `revealedPhone()` when the request between the two users is `accepted`.

## Current backend = local mock

This is a front-end build. Data is stored in `localStorage` via a small mock API (`api.*` in `store.ts`) with 24 seeded residents
that answer your requests after a few seconds so the whole loop is playable. Password hashing, wallet connection (Phantom is used
if installed, others are simulated) and withdrawals are **demo-grade** — before launch, replace `api` with a real backend
(auth, server-side phone privacy, on-chain payouts). The footer and dashboard include demo controls to switch phases and reset data.

Avatars are procedurally generated SVG caricatures (`NerdAvatar.tsx`); users can also upload up to 4 photos.
