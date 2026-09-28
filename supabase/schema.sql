-- =====================================================================
-- Nerdy Town — database setup
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Everything security-relevant (limits, privacy, counters, balances) is
-- enforced here, so a tampered client can't cheat.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Settings (single row) + admins
-- ---------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  phase int not null default 1 check (phase in (1, 2)),
  bonding_progress numeric(5, 2) not null default 0 check (bonding_progress between 0 and 100),
  free_daily_requests int not null default 3 check (free_daily_requests between 0 and 50),
  reject_reward int not null default 100 check (reject_reward >= 0),
  extra_request_cost int not null default 250 check (extra_request_cost > 0),
  min_withdraw int not null default 500 check (min_withdraw > 0),
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

-- ---------------------------------------------------------------------
-- Profiles (public). Bots have is_bot = true and no auth user.
-- ---------------------------------------------------------------------
create or replace function public.valid_tags(tags text[]) returns boolean
language sql immutable as $$
  select coalesce(bool_and(char_length(btrim(t)) between 1 and 24), true) from unnest(tags) t
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  is_bot boolean not null default false,
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
  rejections_given int not null default 0,
  rejections_received int not null default 0,
  accepts int not null default 0,
  created_at timestamptz not null default now()
);
create index profiles_rejections_idx on public.profiles (rejections_received desc);
create index profiles_created_idx on public.profiles (created_at desc);

-- Users may edit their own profile, but never counters / bot / verified flags,
-- and photos must live in their own storage folder.
create or replace function public.protect_profile() returns trigger
language plpgsql as $$
declare p text;
begin
  if coalesce(current_setting('nerdy.internal', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.is_bot := false;
      new.verified := false;
      new.rejections_given := 0;
      new.rejections_received := 0;
      new.accepts := 0;
      new.created_at := now();
    else
      new.id := old.id;
      new.is_bot := old.is_bot;
      new.verified := old.verified;
      new.rejections_given := old.rejections_given;
      new.rejections_received := old.rejections_received;
      new.accepts := old.accepts;
      new.created_at := old.created_at;
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
  check (from_id <> to_id)
);
-- One request per pair of people, in either direction, ever.
create unique index requests_pair_idx on public.requests (least(from_id, to_id), greatest(from_id, to_id));
create index requests_from_idx on public.requests (from_id);
create index requests_to_idx on public.requests (to_id);

-- Bot answers are decided at send time and hidden from clients.
create table public.bot_queue (
  request_id uuid primary key references public.requests (id) on delete cascade,
  resolve_at timestamptz not null,
  outcome text not null check (outcome in ('accepted', 'rejected'))
);

create table public.daily_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  used int not null default 0,
  bonus int not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------
-- $NERDY ledger + wallets
-- ---------------------------------------------------------------------
create table public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('reject-reward', 'buy-requests', 'withdraw', 'adjustment')),
  amount bigint not null,
  note text not null default '',
  status text not null default 'done' check (status in ('done', 'requested', 'processing', 'sent', 'failed', 'rejected')),
  wallet text,
  tx_sig text,
  created_at timestamptz not null default now()
);
create index ledger_user_idx on public.ledger (user_id, created_at desc);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  address text not null unique check (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  provider text not null default 'Phantom' check (provider in ('Phantom', 'Solflare', 'Backpack', 'Other')),
  linked_at timestamptz not null default now()
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
alter table public.bot_queue enable row level security;
alter table public.daily_usage enable row level security;
alter table public.ledger enable row level security;
alter table public.wallets enable row level security;

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

create policy wallets_read on public.wallets for select using (user_id = auth.uid() or public.is_admin());

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
  responder public.profiles;
begin
  perform public._internal();
  update public.requests set status = p_status, resolved_at = now(), seen = false
  where id = p_request and status = 'pending'
  returning * into r;
  if r.id is null then
    raise exception 'This request was already answered.';
  end if;
  delete from public.bot_queue where request_id = r.id;

  if p_status = 'accepted' then
    update public.profiles set accepts = accepts + 1 where id in (r.from_id, r.to_id);
  else
    update public.profiles set rejections_received = rejections_received + 1 where id = r.from_id;
    update public.profiles set rejections_given = rejections_given + 1 where id = r.to_id;
    select * into s from public.settings where id = 1;
    select * into responder from public.profiles where id = r.to_id;
    -- Phase 2: real people rejecting you pays $NERDY. Bots never pay out.
    if s.phase = 2 and s.reject_reward > 0 and not responder.is_bot
       and not exists (select 1 from public.profiles where id = r.from_id and is_bot) then
      insert into public.ledger (user_id, kind, amount, note)
      values (r.from_id, 'reject-reward', s.reject_reward, 'Rejected by ' || responder.name || '. Still a W.');
    end if;
  end if;
  return r;
end $$;

-- New residents get a few admirers from the bots so the dashboard isn't empty.
create or replace function public._welcome_requests() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_bot then
    insert into public.requests (from_id, to_id, created_at)
    select b.id, new.id, now() - (row_number() over () * interval '17 minutes')
    from (select id from public.profiles where is_bot order by random() limit 3) b
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger profiles_welcome after insert on public.profiles
for each row execute function public._welcome_requests();

-- ---------------------------------------------------------------------
-- Client API (called with supabase.rpc)
-- ---------------------------------------------------------------------
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
  if me is null then raise exception 'Log in first.'; end if;
  if not exists (select 1 from public.profiles where id = me and not is_bot) then
    raise exception 'Create your profile first.';
  end if;
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

  if target.is_bot then
    insert into public.bot_queue (request_id, resolve_at, outcome)
    values (r.id, now() + make_interval(secs => 4 + random() * 4), case when random() < 0.4 then 'accepted' else 'rejected' end);
  end if;
  return r;
end $$;

create or replace function public.respond_request(p_request uuid, p_accept boolean) returns public.requests
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.to_id <> auth.uid() then raise exception 'Request not found.'; end if;
  return public._resolve(p_request, case when p_accept then 'accepted' else 'rejected' end);
end $$;

-- Lets bots answer the requests you sent them once their "thinking time" is over.
create or replace function public.tick_bots() returns int
language plpgsql security definer set search_path = public as $$
declare q record; n int := 0;
begin
  for q in
    select b.request_id, b.outcome from public.bot_queue b
    join public.requests r on r.id = b.request_id
    where r.from_id = auth.uid() and b.resolve_at <= now() and r.status = 'pending'
    for update of b skip locked
  loop
    perform public._resolve(q.request_id, q.outcome);
    n := n + 1;
  end loop;
  return n;
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
  if s.phase <> 2 then raise exception 'Extra requests unlock after $NERDY graduates.'; end if;
  if p_count < 1 or p_count > 10 then raise exception 'Pick between 1 and 10.'; end if;
  perform pg_advisory_xact_lock(hashtext('balance:' || me::text));
  cost := p_count::bigint * s.extra_request_cost;
  if public._balance(me) < cost then raise exception 'Not enough $NERDY. You need %.', cost; end if;
  insert into public.ledger (user_id, kind, amount, note)
  values (me, 'buy-requests', -cost, '+' || p_count || ' extra request' || case when p_count > 1 then 's' else '' end || ' today');
  insert into public.daily_usage (user_id, day, bonus) values (me, public._today(), p_count)
  on conflict (user_id, day) do update set bonus = public.daily_usage.bonus + p_count;
end $$;

create or replace function public.link_wallet(p_address text, p_provider text default 'Phantom') returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'That is not a Solana address.'; end if;
  if exists (select 1 from public.wallets where address = p_address and user_id <> auth.uid()) then
    raise exception 'This wallet is already linked to another account.';
  end if;
  insert into public.wallets (user_id, address, provider) values (auth.uid(), p_address, coalesce(p_provider, 'Other'))
  on conflict (user_id) do update set address = excluded.address, provider = excluded.provider, linked_at = now();
end $$;

create or replace function public.unlink_wallet() returns void
language sql security definer set search_path = public as $$
  delete from public.wallets where user_id = auth.uid()
$$;

create or replace function public.request_withdrawal(p_amount bigint) returns public.ledger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s public.settings; w public.wallets; l public.ledger;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into s from public.settings where id = 1;
  if s.phase <> 2 then raise exception 'Withdrawals open after graduation.'; end if;
  select * into w from public.wallets where user_id = me;
  if w.user_id is null then raise exception 'Connect a wallet first.'; end if;
  if p_amount is null or p_amount < s.min_withdraw then raise exception 'Minimum withdrawal is % $NERDY.', s.min_withdraw; end if;
  perform pg_advisory_xact_lock(hashtext('balance:' || me::text));
  if public._balance(me) < p_amount then raise exception 'Balance too low.'; end if;
  insert into public.ledger (user_id, kind, amount, note, status, wallet)
  values (me, 'withdraw', -p_amount, 'Withdrawal to ' || left(w.address, 4) || '…' || right(w.address, 4), 'requested', w.address)
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
  delete from public.profiles where id = me;
  delete from auth.users where id = me;
end $$;

-- Real numbers for the homepage (bots excluded).
create or replace function public.public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'residents', count(*) filter (where not is_bot),
    'rejections', coalesce(sum(rejections_received) filter (where not is_bot), 0)
  ) from public.profiles
$$;

-- Admin tools ---------------------------------------------------------
create or replace function public.admin_set_verified(p_user uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  perform public._internal();
  update public.profiles set verified = p_verified where id = p_user;
end $$;

create or replace function public.admin_reject_withdrawal(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.ledger set status = 'rejected', note = note || ' (rejected — refunded)'
  where id = p_id and kind = 'withdraw' and status = 'requested';
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
revoke execute on function public._welcome_requests() from public, anon, authenticated;
revoke execute on function public.delete_my_account() from anon;

-- Clients can read only what RLS allows and never write counters directly.
revoke insert, update, delete on public.requests, public.ledger, public.daily_usage, public.bot_queue, public.wallets from anon, authenticated;
revoke all on public.bot_queue from anon, authenticated;

-- ---------------------------------------------------------------------
-- Photo storage: public bucket, users write only to their own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Realtime: live updates for requests (RLS still applies).
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
