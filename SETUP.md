# Nerdy Town — go-live checklist

About 20 minutes. You need a free [Supabase](https://supabase.com) account, a free [Reown](https://dashboard.reown.com) account and your existing Vercel project.

**How login works:** everyone signs in with a Solana wallet. People without one tap **Continue with Google, X or email**, and Reown creates a Solana wallet for them on the spot. There are no passwords and no Supabase emails.

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it `nerdy-town`, choose a strong database password (save it in a password manager), and pick the region closest to your users.
3. Wait ~2 minutes for it to finish setting up.

## 2. Create the database

1. In the project, open **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **all** of it, paste, and click **Run**. You should see "Success. No rows returned".

> **Already have a database from an earlier version?** Run the files in [`supabase/migrations/`](supabase/migrations/) that you haven't run yet, in order, the same way (SQL Editor → paste → Run):
> - `001_revenue_share.sql`: monthly revenue share (skip if you already ran it).
> - `002_wallet_verification.sql`: wallet/social login only, verification by locking $NERDY, Phase 2 at 1000 verified residents, NPCs deleted, extra requests cost 1.
>
> 002 deletes all NPCs and their requests, recomputes everyone's counters from real interactions, clears old verified badges and puts the site back in Phase 1. Accounts made with email + password can't log in anymore (see step 5 to become admin again).

## 3. Login settings

### 3a. Supabase

1. **Authentication → Sign In / Providers → Web3 Wallet**: enable it, switch on **Solana**, **Save**.
2. **Authentication → Sign In / Providers → Email**: turn it **off**. (Nobody signs in with email + password anymore, and it stops anyone creating accounts that way.)
3. **Authentication → URL Configuration**
   - **Site URL**: `https://nerdytown.space`
   - **Redirect URLs** → add `https://nerdytown.space/**` and `https://www.nerdytown.space/**`
   - Wallet login only works on addresses listed here.

### 3b. Reown (Google / X / email login + WalletConnect)

1. Log in at <https://dashboard.reown.com>. Your project ID `3b4b16cb9e1bab502b99c6a93df9f7c5` is already built into the site (`vite.config.ts`). To switch projects later, set `VITE_WALLETCONNECT_PROJECT_ID` in Vercel and redeploy.
2. Project settings → **Domain** / allowlist: add `https://nerdytown.space` and `https://www.nerdytown.space`.
3. Project → **Email & Social login** (sometimes under **Features** or **Authentication**): turn it **on**, and enable **Email, Google, X, Discord, Apple, GitHub**. Reown's dashboard settings override the site's, so if a provider is off there, its button won't show.

What users see on the login page:
- **Continue with Google, X or email**: opens Reown's window with email, Google, X, Discord, Apple and GitHub. They get a free Solana wallet that only they control. It signs inside the page, so no app switching.
- **Wallets**: every installed Solana wallet (Phantom, Solflare, Backpack, Trust, Coinbase, OKX, …), **WalletConnect** for 300+ phone wallets (QR code on computers), and on Android a **Wallet app** button.
- Logging in signs a short message. It never sends a transaction and costs nothing. The first time, the account is created and they fill in their profile.
- The wallet they sign in with is their account's wallet: it's what they lock $NERDY from and where payouts go.

## 4. Connect Vercel to Supabase

**Easiest: the Vercel ⇄ Supabase integration.** In Vercel → your project → **Storage** (or **Integrations**), connect your Supabase project. Vercel then adds the keys automatically (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, …) and the site picks them up.

**Manual alternative:** add these yourself (Settings → Environment Variables):

| Name | Where to find the value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → **Project Settings → Data API** → Project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API Keys** → Publishable key (`sb_publishable_…`) or legacy `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **API Keys** → **secret key** (`sb_secret_…`) or legacy service_role key. Server only, never prefix it with `VITE_`. |

**After adding or changing variables, redeploy:** Vercel → **Deployments** → the top one → **⋯** → **Redeploy**.

## 5. Make yourself admin

1. Log in on the live site (with your wallet, or Google/X/email) and create your profile.
2. Copy your wallet address: tap it on your dashboard under **Your sign-in wallet** and it's copied in full. (Or copy it from your wallet app.)
3. Supabase → SQL Editor → run, with your address:

   ```sql
   insert into public.admins (user_id)
   select user_id from auth.identities
   where provider_id = 'web3:solana:' || 'YOUR_WALLET_ADDRESS';
   ```

4. Reload the site. An **Admin panel** link appears on your dashboard.

## 6. Payout wallet (needed before launch)

Verification and payouts both go through one platform wallet.

1. Create a **brand-new** Solana wallet used only for Nerdy Town. Never use your main or dev wallet.
2. Put ~0.2 SOL in it. It pays the network fee when people lock $NERDY (so users need no SOL) and the fees for payouts.
3. Vercel environment variables (server only, never prefixed with `VITE_`), then redeploy:

   | Name | Value |
   | --- | --- |
   | `TREASURY_SECRET_KEY` | the platform wallet's private key (base58 string or the `[12,34,…]` array) |
   | `SOLANA_RPC_URL` | a reliable RPC, e.g. a free [Helius](https://helius.dev) mainnet URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | if the integration didn't add it (step 4) |

## 7. Launching $NERDY on Jupiter

1. Go to **[jup.ag/studio](https://jup.ag/studio)**, connect your dev wallet and create the token (name *nerdy*, ticker *NERDY*, logo, and `https://nerdytown.space` as the website).
2. Copy the **mint address (CA)** from the token page and paste it into **Admin panel → $NERDY token mint address** → **Save**. This:
   - turns on verification (the **Verify · lock 100 $NERDY** button),
   - shows “Live on Jupiter · Buy now” and **Buy $NERDY on Jupiter** on the homepage.

## 8. Verification (locking $NERDY)

- Sending, accepting and rejecting requests needs the verified badge. Browsing and creating a profile don't.
- **Verify · lock 100 $NERDY** on the dashboard: the user picks the login they signed in with and approves sending 100 $NERDY to the platform wallet. The platform pays the network fee. The server checks the transfer on the blockchain before giving the badge, so it can't be faked.
- **Unlock** any time: the badge goes away immediately and a 100 $NERDY payout back to their wallet appears in **Admin → Withdrawals** (tagged *Unlock*). **Approve & send** sends it. This works in Phase 1 too.
- Keep the locked tokens in the platform wallet so unlocks can always be paid.
- The amount is a setting: **Admin → Verification lock**.
- If you remove a user, tokens they have locked stay in the platform wallet. People can't delete their own account while tokens are locked.

## 9. Phase 2 and the monthly revenue share

**When Phase 2 starts:** automatically, the moment **1000 verified residents** exist. Nobody can switch it by hand, and it never goes back. The number is under **Admin → Verified residents for Phase 2**.

**In Phase 2:**
- Users can buy extra requests for **1 $NERDY** each (from their in-app balance).
- Every $NERDY spent in the app goes into the **current month's pool**. You can add outside income too, like Jupiter creator trading fees: **Admin → Revenue share → Add to pool**. If you do, move those tokens into the platform wallet too.
- On the 1st of each month (UTC), last month's pool is split among everyone who got rejected that month, in proportion to their rejections (3 of 100 rejections = 3% of the pool). Leftovers roll into the next month.
- The payout runs by itself the first time anyone opens the site in the new month. To make it exact on a quiet day, schedule it: Supabase → **Integrations → Cron** → new job, schedule `5 0 1 * *`, SQL `select public.settle_revenue();`.
- Withdrawals: users request them; you approve each one in **Admin → Withdrawals**. Check an account's age and activity first, since people can make extra accounts to reject each other.

## Useful SQL

```sql
-- Latest residents and whether they're verified
select name, city, verified, created_at from public.profiles order by created_at desc limit 50;

-- Who has $NERDY locked right now
select p.name, l.amount, l.wallet, l.created_at
from public.locks l join public.profiles p on p.id = l.user_id
where l.status = 'locked' order by l.created_at desc;

-- Old email + password accounts (can't log in anymore). Delete their profiles if you like:
-- delete from public.profiles where id in (select id from auth.users u where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider_id like 'web3:solana:%'));
```
