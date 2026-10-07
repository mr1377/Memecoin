# Nerdy Town

> Where nerds are always winners — whether they get rejected by pretty girls or simply get their number.

Utility platform for the **$NERDY** meme coin. Send a partner request to anyone:

- **Accepted** → you instantly get their socials (Instagram, X, Telegram, Snapchat, Discord, TikTok, WhatsApp or email).
- **Rejected** → it's logged on your dashboard as public popularity (Phase 1), and in Phase 2 earns a share of the platform's monthly revenue. Phase 2 starts by itself at 1000 verified residents.

Sending, accepting and rejecting requests needs the **verified** badge: lock 100 $NERDY with the platform (unlock any time). Everyone signs in with a Solana wallet, or with Google / X / email through Reown, which creates a wallet for them.

## Stack

- **Frontend:** Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion, hosted on Vercel
- **Backend:** [Supabase](https://supabase.com), which provides:
  - Postgres with row-level security,
  - Sign in with Solana (wallet apps, or Reown's Google / X / Discord / Apple / email login, which gives each user a Solana wallet),
  - photo storage,
  - realtime updates for requests.
- **Serverless functions (Vercel):**
  - `api/lock.ts`: verification. Builds the 100 $NERDY transfer (platform pays the fee), broadcasts the wallet-signed transaction and checks it on-chain before marking the user verified.
  - `api/approve-withdrawal.ts`: sends withdrawals and unlock returns (SPL / Token-2022) from the platform wallet after admin approval.

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
| `/signup`, `/login` | Continue with Google / X / email (Reown), or any Solana wallet: Phantom, Solflare, Backpack, Trust, Coinbase, OKX, WalletConnect, Android Wallet app |
| `/onboarding` | 4-step profile wizard (basics, photos / avatar builder, vibe, private socials) — also used to edit |
| `/dashboard` | Verify (lock) / unlock, counters, incoming / sent / matches / L-log, daily requests, $NERDY balance, revenue pool, withdraw, delete account |
| `/admin` | Admins only: settings (goal, lock amount, prices, token), revenue pool, payouts (withdrawals + unlocks), reports, residents |

## Where the rules live

Everything that matters is enforced in the database (`supabase/schema.sql`), not in the browser:

- **Daily limit:** `free_daily_requests` per UTC day, plus requests bought in Phase 2.
- **One request per pair of people, ever.**
- **Socials** (`contacts` table) are readable only by their owner and by people whose request that owner accepted.
- **Counters** (popularity, matches, hearts broken), **balances** and **verified badges** can't be written by users.
- **Wallet:** each account's wallet is the address it signed in with, read from the Supabase auth identity (`_wallet()`), never from the browser.
- **Verification:** `send_request` / `respond_request` require `verified`. Only the server can call `record_lock()` (after checking the transfer on-chain); `unlock_verification()` removes the badge and queues the return payout.
- **Phase 2 trigger:** switches itself when `real_user_goal` (1000) verified residents exist. Nobody can set it by hand and it never goes back.
- **Revenue share:** $NERDY spent on extra requests (1 each, plus admin-added revenue) is pooled per UTC month in `revenue`. `settle_revenue()` splits each finished month's pool among residents rejected that month, in proportion to their rejections. Dust rolls over and each month is paid once (`distributions`).
- **Withdrawals** reserve the balance immediately and wait for admin approval, which prevents double-spending.
- **Blocking** hides both people from each other and prevents requests between them.

Avatars are procedurally generated SVG caricatures (`NerdAvatar.tsx`); users can also upload up to 4 photos.
