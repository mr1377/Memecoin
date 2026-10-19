# Nerdy Town

> Where nerds are always winners — whether they get rejected by pretty girls or simply get their number.

Utility platform for the **$NERDY** meme coin. Send a partner request to anyone:

- **Accepted** → you instantly get their socials (Instagram, X, Telegram, Snapchat, Discord, TikTok, WhatsApp or email).
- **Rejected** → it's logged on your dashboard as public popularity. Phase 2 starts by itself at 1000 verified residents.

**Right now it's points season:** $NERDY isn't launched, so every token feature is hidden and residents earn points (+10 when rejected, +50 per invited friend; being accepted earns no points) that convert to $NERDY after launch. There are weekly leaderboards, invite links and a shareable weekly card. Setting the token mint in the Admin panel switches the token features on.

Anyone can send, accept and reject requests. Only **verified** residents earn: lock 2000 $NERDY with the platform (unlock any time), then every rejection pays 20 $NERDY in Phase 1 (a share of the monthly pool in Phase 2). Withdrawals open 14 days after verifying. Everyone signs in with a Solana wallet, or with Google / X / email through Reown, which creates a wallet for them.

## Stack

- **Frontend:** Vite · React 18 · TypeScript · Tailwind CSS · Framer Motion, hosted on Vercel
- **Backend:** [Supabase](https://supabase.com), which provides:
  - Postgres with row-level security,
  - Sign in with Solana (wallet apps, or Reown's Google / X / Discord / Apple / email login, which gives each user a Solana wallet),
  - photo storage,
  - realtime updates for requests.
- **Serverless functions (Vercel):**
  - `api/lock.ts`: verification. Builds the lock transfer (2000 $NERDY by default) (platform pays the fee), broadcasts the wallet-signed transaction and checks it on-chain before marking the user verified.
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
| `/leaderboard` | Most rejected and top points (last 7 days), all-time points |
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
- **Verification & earning:** anyone with a profile can send / answer. A rejection earns only if the sender was verified at that moment (`requests.earns`): Phase 1 pays `reject_reward` (20) instantly, Phase 2 counts it for the revenue share. Only the server can call `record_lock()` (after checking the transfer on-chain); `unlock_verification()` removes the badge and queues the return payout.
- **Points:** written only by the database (`points` table, one row per request / invitee, so nothing counts twice). `_resolve()` awards rejection points (accepted requests earn none), `_invite_reward()` the invite points once the invitee sends or answers a request. `leaderboard()` and `my_points()` read them.
- **Withdrawals:** only verified residents, `withdraw_wait_days` (14) after `verified_at`.
- **Phase 2 trigger:** switches itself when `real_user_goal` (1000) verified residents exist. Nobody can set it by hand and it never goes back.
- **Revenue share:** $NERDY spent on extra requests (10 each, plus admin-added revenue) is pooled per UTC month in `revenue`. `settle_revenue()` splits each finished month's pool among verified residents rejected that month, in proportion to their rejections. Dust rolls over and each month is paid once (`distributions`).
- **Withdrawals** reserve the balance immediately and wait for admin approval, which prevents double-spending.
- **Blocking** hides both people from each other and prevents requests between them.

Avatars are procedurally generated SVG caricatures (`NerdAvatar.tsx`); users can also upload up to 4 photos.
