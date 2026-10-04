# Nerdy Town

> Where nerds are always winners — whether they get rejected by pretty girls or simply get their number.

Utility platform for the **$NERDY** meme coin. Send a partner request to anyone:

- **Accepted** → you instantly get their socials (Instagram, X, Telegram, Snapchat, Discord, TikTok, WhatsApp or email).
- **Rejected** → it's logged on your dashboard as public popularity (Phase 1), and in Phase 2 earns a share of the platform's monthly revenue. Phase 2 starts when the token graduates on Jupiter (jup.ag) or when 100 real residents join, whichever comes first.

## Stack

- **Frontend:** Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion, hosted on Vercel
- **Backend:** [Supabase](https://supabase.com), which provides:
  - Postgres with row-level security,
  - email/password auth with confirmation and password reset,
  - photo storage,
  - realtime updates for requests.
- **Payouts (Phase 2):** a Vercel serverless function (`api/approve-withdrawal.ts`) sends SPL / Token-2022 transfers from a treasury wallet.

**First-time setup: follow [SETUP.md](SETUP.md).**

```bash
npm install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
npm run build                # typecheck (app + api) + production build
```

## Pages

| Route | Page |
| --- | --- |
| `/` | Landing: interactive mascot, win-win simulator, roadmap, live stats, Hall of Fame, FAQ |
| `/explore` | Search, filter chips (All / Nearby = your city/region / New / Popular), gender filter |
| `/u/:id` | Profile: photos, city, stats, About, interests, locked/revealed socials, Send Request, Report / Block |
| `/signup`, `/login` | Email + password (confirmation email, "forgot password") or Sign in with Solana (any Wallet Standard wallet: Phantom, Solflare, Backpack, Trust, Coinbase, OKX, …) |
| `/reset-password` | Choose a new password from the reset email |
| `/onboarding` | 4-step profile wizard (basics, photos / avatar builder, vibe, private socials) — also used to edit |
| `/dashboard` | Counters, incoming / sent / matches / L-log, daily requests, $NERDY balance, wallet, withdraw, delete account |
| `/admin` | Admins only: phase & token settings, withdrawal approvals, reports, verification |

## Where the rules live

Everything that matters is enforced in the database (`supabase/schema.sql`), not in the browser:

- **Daily limit:** `free_daily_requests` per UTC day, plus requests bought in Phase 2.
- **One request per pair of people, ever.**
- **Socials** (`contacts` table) are readable only by their owner and by people whose request that owner accepted.
- **Counters** (popularity, matches, hearts broken), **balances** and **verified badges** can't be written by users.
- **Phase 2 trigger:** the admin switches it at graduation, or it switches itself when `real_user_goal` real residents exist (trigger on `settings` / `profiles`).
- **Revenue share:** $NERDY spent on extra requests (plus admin-added revenue) is pooled per UTC month in `revenue`. `settle_revenue()` splits each finished month's pool among residents rejected by real residents that month, in proportion to their rejections. Dust rolls over and each month is paid once (`distributions`). NPC rejections never count.
- **Withdrawals** reserve the balance immediately and wait for admin approval, which prevents double-spending.
- **Blocking** hides both people from each other and prevents requests between them.

NPCs (`supabase/bots.sql`, `is_bot = true`) are built-in residents that answer requests after a few seconds. They look like normal profiles in Explore; an "NPC" tag appears on their profile page, in the accept popup and on the Hall of Fame. They have no socials, their rejections never earn revenue shares, and they are excluded from homepage stats.

Avatars are procedurally generated SVG caricatures (`NerdAvatar.tsx`); users can also upload up to 4 photos.
