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
   - switch phases and update the bonding-curve %,
   - handle reports and verify or remove users,
   - approve withdrawals.

## 6. Later: turning on Phase 2 (after $NERDY graduates)

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
   - Set **Phase 2** and click **Save**.
   - From then on, every rejection by a real user pays the reward, and users can buy extra requests and request withdrawals.
4. **Withdrawals are approved by you.** Each one appears in **Admin → Withdrawals**; **Approve & send** transfers the tokens on-chain.
   - This review step matters: people can create fake accounts to reject each other and farm rewards.
   - Look at an account's age and activity before approving.

## Useful SQL

```sql
-- Remove all NPCs (their requests disappear too)
delete from public.profiles where is_bot;

-- See today's signups
select name, city, created_at from public.profiles where not is_bot order by created_at desc limit 50;
```
