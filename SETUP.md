# Nerdy Town — go-live checklist

About 15 minutes. You need a free [Supabase](https://supabase.com) account and your existing Vercel project.

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it `nerdy-town`, choose a strong database password (save it in a password manager), and pick the region closest to your users.
3. Wait ~2 minutes for it to finish setting up.

## 2. Create the database

1. In the project, open **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **all** of it, paste, and click **Run**. You should see "Success. No rows returned".
3. New query again → paste all of [`supabase/bots.sql`](supabase/bots.sql) → **Run**. (This adds the 24 NPC residents. Skip it if you don’t want them.)

> **Already set up the database before October 2026?** Run [`supabase/migrations/001_revenue_share.sql`](supabase/migrations/001_revenue_share.sql) once the same way (SQL Editor → paste → Run). It adds the 100-resident Phase 2 trigger and the monthly revenue share. Running it twice is harmless.

## 3. Configure login emails

1. **Authentication → URL Configuration**
   - **Site URL**: your Vercel address, e.g. `https://nerdy-town.vercel.app`
   - **Redirect URLs** → Add: `https://nerdy-town.vercel.app/**` (and your custom domain later, if you add one)
   - Use your **production** address — the short one under **Domains** on the Vercel project's Overview page. The long per-deployment addresses (with random letters) are private and show Vercel's login page.
   - Email links automatically point to that production address. With a custom domain, add an env var `VITE_SITE_URL=https://yourdomain.com` in Vercel and redeploy.
2. **Authentication → Sign In / Providers → Email**: keep **Confirm email** turned on. Set minimum password length to 8.
3. **Strongly recommended before launch: custom email sender.** Supabase's built-in email is only for testing and sends just a few emails per hour, so real signups will get stuck.
   - Create a free account at <https://resend.com>, add and verify your domain, and create an API key.
   - Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
     host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender e.g. `hello@yourdomain.com`.

### 3b. Turn on wallet login (Sign in with Solana)

1. Supabase → **Authentication → Sign In / Providers**.
2. Find **Web3 Wallet**, enable it, and switch on **Solana**. Click **Save**.
3. Wallet login only works on addresses listed in **URL Configuration** from step 3, so make sure your main site address is there.

The login and sign-up page then shows every Solana wallet the visitor has installed: Phantom, Solflare, Backpack, Trust Wallet, Coinbase Wallet, OKX, Bitget, Exodus, Magic Eden and any other wallet using the Wallet Standard.

- Popular wallets they don't have are offered too. On phones they open your site inside that wallet's app; on computers they open the download page.

- Users sign a short message. It never sends a transaction and costs nothing.
- The first time, a new account is created and the user fills in their profile like everyone else.
- Their wallet is automatically linked for Phase 2 payouts.
- On phones without the wallet's browser extension, the button opens your site inside the wallet app.

### 3c. Turn on WalletConnect (phone wallets without the in-app browser detour)

This lets people stay in their normal phone browser: they tap a wallet, the wallet app opens, they approve, and they come straight back. It covers Trust Wallet, OKX, Bitget, Exodus, Solflare and 300+ others. On computers it shows a QR code to scan with a phone wallet.

1. Create a free account at <https://dashboard.reown.com> (Reown is the company behind WalletConnect).
2. **Create project** → name it `Nerdy Town` → choose **AppKit**.
3. Copy the **Project ID**. It's public, not a secret.
4. In the project settings, under **Domain** / allowlist, add your site address, e.g. `https://your-site.vercel.app`.
5. The project ID `3b4b16cb9e1bab502b99c6a93df9f7c5` is already built into the site (`vite.config.ts`). To switch projects later, set `VITE_WALLETCONNECT_PROJECT_ID` in Vercel and redeploy.

Android phones also get a **Wallet app** button (Solana Mobile Wallet Adapter). It opens Phantom, Solflare or Backpack directly and returns to the browser, with no setup needed.

## 4. Connect Vercel to Supabase

**Easiest: the Vercel ⇄ Supabase integration.** In Vercel → your project → **Storage** (or **Integrations**), connect your Supabase project. Vercel then adds the keys automatically (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, …) and the site picks them up. No copying needed.

Check it worked: Vercel → **Settings → Environment Variables** should list variables whose names start with `SUPABASE_` or `NEXT_PUBLIC_SUPABASE_`.

**Manual alternative:** add these two yourself (Settings → Environment Variables):

| Name | Where to find the value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → **Project Settings → Data API** → Project URL (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API Keys** → Publishable key (`sb_publishable_…`) or legacy `anon` `public` key |

**After adding or changing variables, redeploy:** Vercel → **Deployments** → the top one → **⋯** menu → **Redeploy** → **Redeploy**. Variables only apply to new deployments.

Open the site. You should see the homepage (not "almost ready").

## 5. Make yourself admin

1. Sign up on your live site with your email and confirm it.
2. Supabase → SQL Editor → run (with your email):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com';
   ```

3. Reload the site. An **Admin panel** link appears on your dashboard. From there you can:
   - paste the $NERDY mint address (adds a “Buy on Jupiter” button to the homepage),
   - switch phases, set the resident goal and update the bonding-curve %,
   - see this month’s revenue pool and add outside revenue to it,
   - handle reports and verify or remove users,
   - approve withdrawals.

## 5b. Launching $NERDY on Jupiter

1. Go to **[jup.ag/studio](https://jup.ag/studio)**, connect your dev wallet and create the token (name *nerdy*, ticker *NERDY*, logo, and `https://nerdytown.space` as the website).
2. After launch, copy the **mint address (CA)** from the token page and paste it into **Admin panel → $NERDY token mint address**. The homepage then shows “Live on Jupiter · Buy now” and a **Buy $NERDY on Jupiter** button.
3. While it bonds, update **Bonding curve progress (%)** in the Admin panel from time to time (Jupiter shows it on the token page).
4. When Jupiter shows the token as graduated (moved to its liquidity pool), set **Phase 2** in the Admin panel and follow section 6.

## 6. Phase 2 and the monthly revenue share

**When Phase 2 starts:** when you switch it on at graduation, **or** automatically once **100 real residents** have joined (NPCs don't count), whichever comes first. You can change the number under **Admin → Real residents for Phase 2**.

> ⚠️ Phase 2 can start by itself, so get steps 1–3 below done before you get close to the goal, or raise the goal for now. Withdrawals need the token and the payout wallet.

**How the revenue share works:**
- Every $NERDY spent in the app (extra requests) goes into the **current month's pool**. You can add outside income too, like Jupiter creator trading fees: **Admin → Revenue share → Add to pool**.
- On the 1st of each month (UTC), last month's pool is split among everyone who got **rejected by real residents** that month, in proportion to their rejections (3 of 100 rejections = 3% of the pool). Rejections by NPCs don't count, because NPC answers are automatic and would be free to farm.
- Shares land in each person's in-app balance. Rounding leftovers, or a month with no rejections, roll over into the next month's pool. Nothing is lost.
- The payout runs by itself the first time anyone opens the site in the new month. To make it exact even on a quiet day, you can also schedule it: Supabase → **Integrations → Cron** → enable → new job, schedule `5 0 1 * *`, SQL `select public.settle_revenue();`.

**Getting ready:**

1. **Payout wallet.** Create a *brand-new* Solana wallet used only for payouts. Put in it just the $NERDY you plan to pay out plus ~0.1 SOL for fees. Never use your main or dev wallet.
2. **Vercel environment variables** (server-only, never prefixed with `VITE_`):

   | Name | Value |
   | --- | --- |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → **secret key** (`sb_secret_…`) or legacy service_role key |
   | `TREASURY_SECRET_KEY` | the payout wallet's private key (base58 string or the `[12,34,…]` array) |
   | `SOLANA_RPC_URL` | a reliable RPC, e.g. a free [Helius](https://helius.dev) mainnet URL |

   Redeploy after adding them.
3. **Admin panel.**
   - Paste the $NERDY mint address.
   - At graduation, set **Phase 2** and click **Save** (unless the resident goal already did it).
   - From then on users can buy extra requests, rejections earn monthly shares, and users can request withdrawals.
4. **Fund the payout wallet.** Revenue lives in the app's ledger. The tokens people withdraw come from the payout wallet, so keep it topped up with at least what's been paid out. If you add creator fees to the pool, move those tokens into the payout wallet too.
5. **Withdrawals are approved by you.** Each one appears in **Admin → Withdrawals**; **Approve & send** transfers the tokens on-chain.
   - This review step matters: people can create fake accounts to reject each other and farm shares.
   - Look at an account's age and activity before approving.

## Useful SQL

```sql
-- Remove all NPCs (their requests disappear too)
delete from public.profiles where is_bot;

-- See today's signups
select name, city, created_at from public.profiles where not is_bot order by created_at desc limit 50;
```
