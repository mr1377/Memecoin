-- =====================================================================
-- Nerdy Town — database setup
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Everything security-relevant (limits, privacy, counters, balances,
-- verification) is enforced here, so a tampered client can't cheat.
-- Everyone signs in with a Solana wallet (an app like Phantom, or the wallet
-- Reown creates for Google / X / email logins), so every account has one.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Settings (single row) + admins
-- ---------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  phase int not null default 1 check (phase in (1, 2)),
  free_daily_requests int not null default 3 check (free_daily_requests between 0 and 50),
  extra_request_cost int not null default 10 check (extra_request_cost > 0),
  min_withdraw int not null default 500 check (min_withdraw > 0),
  -- Verification: lock this many $NERDY with the platform. Only verified residents earn $NERDY.
  verify_lock_amount int not null default 2000 check (verify_lock_amount > 0),
  -- Phase 1: $NERDY a verified resident earns per rejection (Phase 2 uses the monthly revenue share).
  reject_reward int not null default 20 check (reject_reward >= 0),
  -- Withdrawals open this many days after getting verified.
  withdraw_wait_days int not null default 14 check (withdraw_wait_days between 0 and 365),
  -- Points (before $NERDY launches; they convert after launch at a rate set then).
  points_reject int not null default 10 check (points_reject between 0 and 10000),
  points_accept int not null default 25 check (points_accept between 0 and 10000),
  points_invite int not null default 50 check (points_invite between 0 and 10000),
  -- Phase 2 starts by itself once this many VERIFIED residents exist. It never goes back.
  real_user_goal int not null default 1000 check (real_user_goal between 1 and 1000000),
  phase2_at timestamptz,
  -- $NERDY mint address. Empty = token not launched: the site runs on points only.
  token_mint text,
  token_decimals int not null default 6 check (token_decimals between 0 and 12),
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1);

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- The Solana address a user signed in with (Sign in with Solana stores it on
-- the auth identity as "web3:solana:<address>"). Never taken from the client.
create or replace function public._wallet(uid uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select a from (
    select coalesce(i.identity_data -> 'custom_claims' ->> 'address', split_part(i.provider_id, ':', 3)) as a, i.created_at
    from auth.identities i
    where i.user_id = uid and lower(i.provider_id) like 'web3:solana:%'
  ) x
  where a ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
  order by created_at
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Profiles (public)
-- ---------------------------------------------------------------------
create or replace function public.valid_tags(tags text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(char_length(btrim(t)) between 1 and 24), true) from unnest(tags) t
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 40),
  age int not null check (age between 18 and 99),
  gender text not null check (gender in ('Man', 'Woman', 'Non-binary', 'Other')),
  looking_for text not null check (looking_for in ('Man', 'Woman', 'Non-binary', 'Everyone')),
  city text not null check (char_length(btrim(city)) between 2 and 40),
  nerd_class text not null check (nerd_class in ('Code Wizard', 'Math Olympian', 'Lore Keeper', 'Speedrunner', 'Lab Rat', 'Chess Goblin', 'Anime Scholar', 'Crypto Degen')),
  tagline text not null check (char_length(btrim(tagline)) between 3 and 60),
  bio text not null check (char_length(btrim(bio)) between 20 and 300),
  interests text[] not null check (cardinality(interests) between 1 and 6 and public.valid_tags(interests)),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  avatar jsonb not null check (jsonb_typeof(avatar) = 'object'),
  verified boolean not null default false,
  verified_at timestamptz,
  rejections_given int not null default 0,
  rejections_received int not null default 0,
  accepts int not null default 0,
  -- Invite link code (nerdytown.space/?ref=<code>) and who invited this resident.
  invite_code text not null unique default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index profiles_rejections_idx on public.profiles (rejections_received desc);
create index profiles_created_idx on public.profiles (created_at desc);

-- Users may edit their own profile, but never counters / verification,
-- and photos must live in their own storage folder.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
declare p text;
begin
  if coalesce(current_setting('nerdy.internal', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.verified_at := null;
      new.rejections_given := 0;
      new.rejections_received := 0;
      new.accepts := 0;
      new.created_at := now();
      new.invite_code := lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      if new.invited_by = new.id then new.invited_by := null; end if;
    else
      new.id := old.id;
      new.verified := old.verified;
      new.verified_at := old.verified_at;
      new.rejections_given := old.rejections_given;
      new.rejections_received := old.rejections_received;
      new.accepts := old.accepts;
      new.created_at := old.created_at;
      new.invite_code := old.invite_code;
      new.invited_by := old.invited_by;
    end if;
    foreach p in array new.photos loop
      if p not like new.id::text || '/%' or p like '%..%' then
        raise exception 'Invalid photo path.';
      end if;
    end loop;
  end if;
  new.name := btrim(new.name);
  new.city := btrim(new.city);
  new.tagline := btrim(new.tagline);
  new.bio := btrim(new.bio);
  return new;
end $$;
create trigger profiles_protect before insert or update on public.profiles
for each row execute function public.protect_profile();

-- ---------------------------------------------------------------------
-- Blocks & reports
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

-- True when you and `other` have blocked each other in either direction.
create or replace function public.is_blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = auth.uid() and blocked = other) or (blocker = other and blocked = auth.uid())
  )
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles (id) on delete cascade,
  reported uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('Fake profile', 'Harassment', 'Inappropriate photos', 'Underage', 'Spam or scam', 'Other')),
  details text not null default '' check (char_length(details) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Private contacts (socials). Readable only by the owner and by people
-- whose request the owner ACCEPTED.
-- ---------------------------------------------------------------------
create or replace function public.valid_socials(s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'array'
     and jsonb_array_length(s) between 1 and 5
     and coalesce((
       select bool_and(
         jsonb_typeof(e) = 'object'
         and e ->> 'platform' in ('Instagram', 'X', 'Telegram', 'Snapchat', 'Discord', 'TikTok', 'WhatsApp', 'Email')
         and char_length(btrim(coalesce(e ->> 'handle', ''))) between 2 and 60
       ) from jsonb_array_elements(s) e), false)
$$;

create table public.contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  socials jsonb not null check (public.valid_socials(socials)),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Partner requests
-- ---------------------------------------------------------------------
create table public.requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Rejected while the sender was verified: earns $NERDY (Phase 1 reward / Phase 2 revenue share).
  earns boolean not null default false,
  check (from_id <> to_id)
);
-- One request per pair of people, in either direction, ever.
create unique index requests_pair_idx on public.requests (least(from_id, to_id), greatest(from_id, to_id));
create index requests_from_idx on public.requests (from_id);
create index requests_to_idx on public.requests (to_id);
create index requests_rejected_idx on public.requests (resolved_at) where status = 'rejected';

create table public.daily_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  used int not null default 0,
  bonus int not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------
-- $NERDY ledger, verification locks, revenue
-- ---------------------------------------------------------------------
create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('revenue-share', 'reject-reward', 'buy-requests', 'withdraw', 'adjustment', 'lock-return', 'unlock')),
  amount bigint not null,
  note text not null default '',
  status text not null default 'done' check (status in ('done', 'requested', 'processing', 'sent', 'failed', 'rejected')),
  wallet text,
  tx_sig text,
  created_at timestamptz not null default now()
);
create index ledger_user_idx on public.ledger (user_id, created_at desc);

-- $NERDY a resident sent to the platform wallet to get verified. Recorded only
-- by the server (/api/lock) after it checked the transfer on-chain.
create table public.locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount bigint not null check (amount > 0),
  wallet text not null,
  tx_sig text not null unique,
  status text not null default 'locked' check (status in ('locked', 'unlocked')),
  created_at timestamptz not null default now(),
  unlocked_at timestamptz
);
create index locks_user_idx on public.locks (user_id);

-- Points: earned by being rejected, being accepted and inviting friends. Written only
-- by the database (one row per request / invitee, so nothing can be counted twice).
create table public.points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('rejected', 'accepted', 'invite', 'adjustment')),
  amount int not null,
  ref uuid,
  created_at timestamptz not null default now()
);
create unique index points_once_idx on public.points (user_id, kind, ref) where ref is not null;
create index points_recent_idx on public.points (created_at desc);
create index points_user_idx on public.points (user_id);

-- Platform revenue, pooled per calendar month (UTC) and shared among rejected residents.
create table public.revenue (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  source text not null check (source in ('requests', 'admin', 'carry-over')),
  amount bigint not null check (amount > 0),
  user_id uuid references public.profiles (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index revenue_month_idx on public.revenue (month);

-- One row per month that has been paid out.
create table public.distributions (
  month date primary key,
  pool bigint not null,
  rejections int not null,
  recipients int not null,
  paid bigint not null,
  carried bigint not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.contacts enable row level security;
alter table public.requests enable row level security;
alter table public.daily_usage enable row level security;
alter table public.ledger enable row level security;
alter table public.locks enable row level security;
alter table public.points enable row level security;
alter table public.revenue enable row level security;
alter table public.distributions enable row level security;

create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for update using (public.is_admin()) with check (public.is_admin());

create policy admins_self on public.admins for select using (user_id = auth.uid());

create policy profiles_read on public.profiles for select
  using (auth.uid() is null or not public.is_blocked_with(id));
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy blocks_read on public.blocks for select using (blocker = auth.uid());
create policy blocks_insert on public.blocks for insert with check (blocker = auth.uid());
create policy blocks_delete on public.blocks for delete using (blocker = auth.uid());

create policy reports_insert on public.reports for insert with check (reporter = auth.uid());
create policy reports_read on public.reports for select using (reporter = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin());

create policy contacts_read on public.contacts for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.requests r
    where r.from_id = auth.uid() and r.to_id = contacts.user_id and r.status = 'accepted'
  )
);
create policy contacts_insert on public.contacts for insert with check (user_id = auth.uid());
create policy contacts_update on public.contacts for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy requests_read on public.requests for select using (from_id = auth.uid() or to_id = auth.uid());
-- No insert/update policies: requests change only through the functions below.

create policy usage_read on public.daily_usage for select using (user_id = auth.uid());

create policy ledger_read on public.ledger for select using (user_id = auth.uid() or public.is_admin());

create policy locks_read on public.locks for select using (user_id = auth.uid() or public.is_admin());

create policy points_read on public.points for select using (user_id = auth.uid() or public.is_admin());

create policy revenue_read on public.revenue for select using (public.is_admin());
create policy distributions_read on public.distributions for select using (true);

-- ---------------------------------------------------------------------
-- Internal helpers (NOT callable by clients)
-- ---------------------------------------------------------------------
create or replace function public._internal() returns void
language sql as $$ select set_config('nerdy.internal', 'on', true) $$;

create or replace function public._today() returns date
language sql stable as $$ select (now() at time zone 'utc')::date $$;

create or replace function public._balance(uid uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::bigint from public.ledger
  where user_id = uid and status not in ('failed', 'rejected')
$$;

create or replace function public._resolve(p_request uuid, p_status text) returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  r public.requests;
  s public.settings;
  responder text;
begin
  perform public._internal();
  update public.requests set status = p_status, resolved_at = now(), seen = false
  where id = p_request and status = 'pending'
  returning * into r;
  if r.id is null then
    raise exception 'This request was already answered.';
  end if;

  select * into s from public.settings where id = 1;
  -- Points for the person who shot their shot: more for a match, some for an L.
  if (case when p_status = 'accepted' then s.points_accept else s.points_reject end) > 0 then
    insert into public.points (user_id, kind, amount, ref)
    values (r.from_id, p_status, case when p_status = 'accepted' then s.points_accept else s.points_reject end, r.id)
    on conflict do nothing;
  end if;

  if p_status = 'accepted' then
    update public.profiles set accepts = accepts + 1 where id in (r.from_id, r.to_id);
  else
    update public.profiles set rejections_received = rejections_received + 1 where id = r.from_id;
    update public.profiles set rejections_given = rejections_given + 1 where id = r.to_id;
    -- Only verified residents earn from rejections.
    if exists (select 1 from public.profiles where id = r.from_id and verified) then
      update public.requests set earns = true where id = r.id returning * into r;
      if s.phase = 1 and s.reject_reward > 0 then
        select name into responder from public.profiles where id = r.to_id;
        insert into public.ledger (user_id, kind, amount, note)
        values (r.from_id, 'reject-reward', s.reject_reward, 'Rejected by ' || coalesce(responder, 'someone') || '. Still a W.');
      end if;
    end if;
  end if;
  return r;
end $$;

-- A friend's invite counts once the invited resident actually takes part
-- (sends or answers a request): the inviter gets points_invite, once.
create or replace function public._invite_reward(me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inviter uuid; amount int;
begin
  select invited_by into inviter from public.profiles where id = me;
  select points_invite into amount from public.settings where id = 1;
  if inviter is not null and amount > 0 then
    insert into public.points (user_id, kind, amount, ref) values (inviter, 'invite', amount, me)
    on conflict do nothing;
  end if;
end $$;

-- Anyone with a profile can send and answer requests.
create or replace function public._require_profile(me uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if me is null then raise exception 'Log in first.'; end if;
  if not exists (select 1 from public.profiles where id = me) then raise exception 'Create your profile first.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Phase 2 starts once real_user_goal verified residents exist. Clients
-- (admins included) can't set the phase; it only ever moves 1 → 2.
-- ---------------------------------------------------------------------
create or replace function public._settings_phase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.phase := old.phase;
    new.phase2_at := old.phase2_at;
  end if;
  if new.phase = 1 and (select count(*) from public.profiles where verified) >= new.real_user_goal then
    new.phase := 2;
    new.phase2_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger settings_phase before insert or update on public.settings
for each row execute function public._settings_phase();

-- Each newly verified resident re-checks the goal.
create or replace function public._phase_on_verify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verified and not old.verified then
    update public.settings set updated_at = now() where id = 1 and phase = 1;
  end if;
  return new;
end $$;
create trigger profiles_phase after update of verified on public.profiles
for each row execute function public._phase_on_verify();

-- ---------------------------------------------------------------------
-- Monthly revenue share. Every $NERDY spent in town (plus anything the
-- admin adds, e.g. creator trading fees) goes into the month's pool. After
-- the month ends, the pool is split among everyone who got rejected that
-- month, in proportion to their rejections. Rounding dust rolls over.
-- ---------------------------------------------------------------------
create or replace function public._month(t timestamptz) returns date
language sql immutable as $$ select date_trunc('month', t at time zone 'utc')::date $$;

-- Rejections each resident received while verified in a month (Phase 2 only).
create or replace function public._month_rejections(m date)
returns table (user_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select r.from_id, count(*)::int
  from public.requests r
  cross join public.settings s
  where r.status = 'rejected'
    and r.earns
    and s.phase = 2
    and r.resolved_at >= greatest((m::timestamp at time zone 'utc'), s.phase2_at)
    and r.resolved_at < ((m + interval '1 month')::timestamp at time zone 'utc')
  group by r.from_id
$$;

create or replace function public._settle_month(m date) returns void
language plpgsql security definer set search_path = public as $$
declare
  pool bigint;
  total int;
  people int;
  paid bigint := 0;
  label text := to_char(m, 'FMMonth YYYY');
begin
  select coalesce(sum(amount), 0) into pool from public.revenue where month = m;
  select coalesce(sum(n), 0), count(*) into total, people from public._month_rejections(m);
  if total > 0 and pool > 0 then
    with shares as (
      select x.user_id, x.n, floor(pool::numeric * x.n / total)::bigint as share from public._month_rejections(m) x
    ), paid_out as (
      insert into public.ledger (user_id, kind, amount, note)
      select user_id, 'revenue-share', share,
             'Revenue share · ' || label || ' · ' || n || ' rejection' || case when n = 1 then '' else 's' end
      from shares where share > 0
      returning amount
    )
    select coalesce(sum(amount), 0) into paid from paid_out;
  end if;
  if pool - paid > 0 then
    insert into public.revenue (month, source, amount, note)
    values ((m + interval '1 month')::date, 'carry-over', pool - paid, 'Left over from ' || label);
  end if;
  insert into public.distributions (month, pool, rejections, recipients, paid, carried)
  values (m, pool, total, people, paid, pool - paid);
end $$;

-- Pays out every finished month that hasn't been paid yet. Safe to call any
-- time, by anyone: the site calls it on load, and pg_cron can too.
create or replace function public.settle_revenue() returns int
language plpgsql security definer set search_path = public as $$
declare m date; n int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('nerdy:settle'));
  loop
    select min(r.month) into m from public.revenue r
    where r.month < public._month(now())
      and not exists (select 1 from public.distributions d where d.month = r.month);
    exit when m is null;
    perform public._settle_month(m);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Verification by locking $NERDY
-- ---------------------------------------------------------------------
-- Called only by the server (service role) after it confirmed the on-chain
-- transfer from the user's wallet to the platform wallet.
create or replace function public.record_lock(p_user uuid, p_tx_sig text, p_amount bigint, p_wallet text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'Create your profile first.'; end if;
  if p_amount < (select verify_lock_amount from public.settings where id = 1) then
    raise exception 'Lock at least % $NERDY.', (select verify_lock_amount from public.settings where id = 1);
  end if;
  insert into public.locks (user_id, amount, wallet, tx_sig) values (p_user, p_amount, p_wallet, p_tx_sig)
  on conflict (tx_sig) do nothing;
  if not found then
    if exists (select 1 from public.locks where tx_sig = p_tx_sig and user_id = p_user) then return; end if;
    raise exception 'This transaction was already used.';
  end if;
  perform public._internal();
  update public.profiles set verified = true, verified_at = case when verified then coalesce(verified_at, now()) else now() end
  where id = p_user;
end $$;

-- Gives the locked $NERDY back (sent to the wallet once an admin approves) and
-- removes the verified badge. Earned $NERDY stays in the app balance; it can be
-- withdrawn again once re-verified for withdraw_wait_days.
create or replace function public.unlock_verification() returns bigint
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); total bigint; w text;
begin
  if me is null then raise exception 'Log in first.'; end if;
  perform pg_advisory_xact_lock(hashtext('balance:' || me::text));
  select coalesce(sum(amount), 0), max(wallet) into total, w from public.locks where user_id = me and status = 'locked';
  if total = 0 then raise exception 'You have nothing locked.'; end if;
  update public.locks set status = 'unlocked', unlocked_at = now() where user_id = me and status = 'locked';
  perform public._internal();
  update public.profiles set verified = false, verified_at = null where id = me;
  insert into public.ledger (user_id, kind, amount, note)
  values (me, 'lock-return', total, 'Unlocked ' || total || ' $NERDY');
  insert into public.ledger (user_id, kind, amount, note, status, wallet)
  values (me, 'unlock', -total, 'Unlock → ' || left(w, 4) || '…' || right(w, 4), 'requested', w);
  return total;
end $$;

-- ---------------------------------------------------------------------
-- Client API (called with supabase.rpc)
-- ---------------------------------------------------------------------
create or replace function public.my_wallet() returns text
language sql stable security definer set search_path = public as $$
  select public._wallet(auth.uid())
$$;

create or replace function public.send_request(p_to uuid) returns public.requests
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  s public.settings;
  u public.daily_usage;
  target public.profiles;
  existing public.requests;
  r public.requests;
begin
  perform public._require_profile(me);
  if p_to = me then raise exception 'Self-love is valid, but not like this.'; end if;
  select * into target from public.profiles where id = p_to;
  if target.id is null or public.is_blocked_with(p_to) then
    raise exception 'That nerd moved out.';
  end if;

  select * into existing from public.requests
  where least(from_id, to_id) = least(me, p_to) and greatest(from_id, to_id) = greatest(me, p_to);
  if existing.id is not null then
    if existing.from_id <> me then raise exception 'They already requested you — check your dashboard!'; end if;
    if existing.status = 'rejected' then raise exception 'They already said no. Respect the L — it’s on your board.'; end if;
    raise exception 'You already sent a request here.';
  end if;

  select * into s from public.settings where id = 1;
  insert into public.daily_usage (user_id, day) values (me, public._today()) on conflict do nothing;
  select * into u from public.daily_usage where user_id = me and day = public._today() for update;
  if u.used >= s.free_daily_requests + u.bonus then
    if s.phase = 1 then raise exception 'Out of requests for today. Come back tomorrow, legend.'; end if;
    raise exception 'Out of requests — buy more with $NERDY.';
  end if;

  insert into public.requests (from_id, to_id) values (me, p_to) returning * into r;
  update public.daily_usage set used = used + 1 where user_id = me and day = u.day;
  perform public._invite_reward(me);
  return r;
end $$;

create or replace function public.respond_request(p_request uuid, p_accept boolean) returns public.requests
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  perform public._require_profile(auth.uid());
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.to_id <> auth.uid() then raise exception 'Request not found.'; end if;
  perform public._invite_reward(auth.uid());
  return public._resolve(p_request, case when p_accept then 'accepted' else 'rejected' end);
end $$;

create or replace function public.mark_seen(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.requests set seen = true where id = any (p_ids) and from_id = auth.uid()
$$;

create or replace function public.my_balance() returns bigint
language sql stable security definer set search_path = public as $$
  select public._balance(auth.uid())
$$;

create or replace function public.buy_requests(p_count int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.settings; cost bigint;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into s from public.settings where id = 1;
  if s.phase <> 2 then raise exception 'Extra requests unlock in Phase 2.'; end if;
  if p_count < 1 or p_count > 10 then raise exception 'Pick between 1 and 10.'; end if;
  perform pg_advisory_xact_lock(hashtext('balance:' || me::text));
  cost := p_count::bigint * s.extra_request_cost;
  if public._balance(me) < cost then raise exception 'Not enough $NERDY. You need %.', cost; end if;
  insert into public.ledger (user_id, kind, amount, note)
  values (me, 'buy-requests', -cost, '+' || p_count || ' extra request' || case when p_count > 1 then 's' else '' end || ' today');
  -- What you spend goes into this month's pool for rejected residents.
  insert into public.revenue (month, source, amount, user_id, note)
  values (public._month(now()), 'requests', cost, me, 'Extra requests');
  insert into public.daily_usage (user_id, day, bonus) values (me, public._today(), p_count)
  on conflict (user_id, day) do update set bonus = public.daily_usage.bonus + p_count;
end $$;

create or replace function public.request_withdrawal(p_amount bigint) returns public.ledger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.settings; p public.profiles; w text; l public.ledger;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into s from public.settings where id = 1;
  select * into p from public.profiles where id = me;
  if p.id is null or not p.verified then raise exception 'Get verified to withdraw.'; end if;
  if p.verified_at > now() - make_interval(days => s.withdraw_wait_days) then
    raise exception 'Withdrawals open % days after you get verified (%).', s.withdraw_wait_days,
      to_char((p.verified_at + make_interval(days => s.withdraw_wait_days)) at time zone 'utc', 'FMMonth FMDD, YYYY');
  end if;
  w := public._wallet(me);
  if w is null then raise exception 'This account has no Solana wallet.'; end if;
  if p_amount is null or p_amount < s.min_withdraw then raise exception 'Minimum withdrawal is % $NERDY.', s.min_withdraw; end if;
  perform pg_advisory_xact_lock(hashtext('balance:' || me::text));
  if public._balance(me) < p_amount then raise exception 'Balance too low.'; end if;
  insert into public.ledger (user_id, kind, amount, note, status, wallet)
  values (me, 'withdraw', -p_amount, 'Withdrawal to ' || left(w, 4) || '…' || right(w, 4), 'requested', w)
  returning * into l;
  return l;
end $$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  insert into public.blocks (blocker, blocked) values (auth.uid(), p_user) on conflict do nothing;
  -- Pending requests between you two disappear.
  delete from public.requests
  where status = 'pending' and ((from_id = auth.uid() and to_id = p_user) or (from_id = p_user and to_id = auth.uid()));
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Log in first.'; end if;
  if exists (select 1 from public.locks where user_id = me and status = 'locked') then
    raise exception 'Unlock your $NERDY first so it can be sent back to you.';
  end if;
  if exists (select 1 from public.ledger where user_id = me and status in ('requested', 'processing')) then
    raise exception 'Wait until your pending payout is sent.';
  end if;
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end $$;

-- My points: total, this week (last 7 days), and how many invites counted.
create or replace function public.my_points() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'total', coalesce(sum(amount), 0),
    'week', coalesce(sum(amount) filter (where created_at > now() - interval '7 days'), 0),
    'invites', count(*) filter (where kind = 'invite'),
    'rejections_week', (select count(*) from public.requests r where r.from_id = auth.uid() and r.status = 'rejected' and r.resolved_at > now() - interval '7 days'),
    'accepts_week', (select count(*) from public.requests r where r.from_id = auth.uid() and r.status = 'accepted' and r.resolved_at > now() - interval '7 days')
  ) from public.points where user_id = auth.uid()
$$;

-- Public leaderboards: most rejected and most points in the last 7 days, and all-time points.
create or replace function public.leaderboard(p_limit int default 25) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'rejected_week', (select coalesce(json_agg(x), '[]') from (
      select r.from_id as id, count(*)::int as n from public.requests r
      where r.status = 'rejected' and r.resolved_at > now() - interval '7 days'
      group by r.from_id order by n desc, max(r.resolved_at) asc limit least(p_limit, 100)) x),
    'points_week', (select coalesce(json_agg(x), '[]') from (
      select p.user_id as id, sum(p.amount)::int as n from public.points p
      where p.created_at > now() - interval '7 days'
      group by p.user_id having sum(p.amount) > 0 order by n desc, min(p.created_at) asc limit least(p_limit, 100)) x),
    'points_all', (select coalesce(json_agg(x), '[]') from (
      select p.user_id as id, sum(p.amount)::int as n from public.points p
      group by p.user_id having sum(p.amount) > 0 order by n desc, min(p.created_at) asc limit least(p_limit, 100)) x)
  )
$$;

-- Real numbers for the homepage.
create or replace function public.public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'residents', count(*),
    'verified', count(*) filter (where verified),
    'rejections', coalesce(sum(rejections_received), 0)
  ) from public.profiles
$$;

-- This month's pool, your share so far, and the last payout.
create or replace function public.revenue_status() returns json
language sql stable security definer set search_path = public as $$
  with m as (select public._month(now()) as month),
  rej as (select * from public._month_rejections((select month from m)))
  select json_build_object(
    'month', (select month from m),
    'pool', (select coalesce(sum(amount), 0) from public.revenue where month = (select month from m)),
    'rejections', (select coalesce(sum(n), 0) from rej),
    'recipients', (select count(*) from rej),
    'mine', (select coalesce(sum(n), 0) from rej where user_id = auth.uid()),
    'last', (select row_to_json(d) from (select * from public.distributions order by month desc limit 1) d)
  )
$$;

-- Admin tools ---------------------------------------------------------
create or replace function public.admin_add_revenue(p_amount bigint, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if (select phase from public.settings where id = 1) <> 2 then raise exception 'Revenue sharing starts in Phase 2.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a positive amount.'; end if;
  insert into public.revenue (month, source, amount, note)
  values (public._month(now()), 'admin', p_amount, left(coalesce(nullif(btrim(p_note), ''), 'Added by admin'), 120));
end $$;

-- Add or take away points (e.g. reset someone caught farming). Negative = take away.
create or replace function public.admin_adjust_points(p_user uuid, p_amount int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Enter a non-zero amount.'; end if;
  insert into public.points (user_id, kind, amount) values (p_user, 'adjustment', p_amount);
end $$;

create or replace function public.admin_set_verified(p_user uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public._internal();
  update public.profiles set verified = p_verified, verified_at = case when p_verified then coalesce(verified_at, now()) end where id = p_user;
end $$;

create or replace function public.admin_reject_withdrawal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.ledger set status = 'rejected', note = note || ' (rejected — kept in app balance)'
  where id = p_id and kind in ('withdraw', 'unlock') and status = 'requested';
end $$;

create or replace function public.admin_remove_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'Cannot remove an admin.'; end if;
  delete from public.profiles where id = p_user;
  delete from auth.users where id = p_user;
end $$;

-- Lock down: internal helpers are not part of the public API.
revoke execute on function public._internal() from public, anon, authenticated;
revoke execute on function public._resolve(uuid, text) from public, anon, authenticated;
revoke execute on function public._balance(uuid) from public, anon, authenticated;
revoke execute on function public._wallet(uuid) from public, anon, authenticated;
revoke execute on function public._require_profile(uuid) from public, anon, authenticated;
revoke execute on function public._invite_reward(uuid) from public, anon, authenticated;
revoke execute on function public._settings_phase() from public, anon, authenticated;
revoke execute on function public._phase_on_verify() from public, anon, authenticated;
revoke execute on function public._month_rejections(date) from public, anon, authenticated;
revoke execute on function public._settle_month(date) from public, anon, authenticated;
revoke execute on function public.record_lock(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_lock(uuid, text, bigint, text) to service_role;
revoke execute on function public.delete_my_account() from anon;

-- Clients can read only what RLS allows and never write counters directly.
revoke insert, update, delete on public.requests, public.ledger, public.daily_usage, public.locks, public.points, public.revenue, public.distributions from anon, authenticated;

-- ---------------------------------------------------------------------
-- Photo storage: public bucket, users write only to their own folder.
-- The site shrinks photos before upload (~200 KB full + ~30 KB thumbnail),
-- and the 400 KB limit stops anyone uploading bigger files around it.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 409600, array['image/jpeg', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Admins can delete the photos of residents they remove.
create policy photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- ---------------------------------------------------------------------
-- Realtime: live updates for requests (RLS still applies).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
