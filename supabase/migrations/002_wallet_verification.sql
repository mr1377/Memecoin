-- =====================================================================
-- Nerdy Town — migration 002: wallet/social login only, verification by
-- locking $NERDY, Phase 2 = 1000 verified residents, no NPCs, 1-token extra
-- requests. Run ONCE in Supabase → SQL Editor (after 001_revenue_share.sql).
-- Fresh installs don't need it: schema.sql already includes all of this.
-- =====================================================================

-- 1. Phase back to 1 under the new rule (Phase 2 = 1000 verified residents).
--    Done first, while the old phase trigger still allows it.
update public.settings set real_user_goal = 1000, extra_request_cost = 1, phase = 1;

-- 2. NPCs out. Their requests, answers and queue entries go with them.
drop trigger if exists profiles_welcome on public.profiles;
drop function if exists public._welcome_requests();
drop function if exists public.tick_bots();
drop table if exists public.bot_queue;
delete from public.profiles where is_bot;
drop trigger if exists profiles_phase on public.profiles;
drop function if exists public._phase_on_signup();
alter table public.profiles drop column is_bot;

-- Every profile now belongs to a real login.
delete from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id);
alter table public.profiles alter column id drop default;
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users (id) on delete cascade;

-- 3. Settings.
alter table public.settings drop column if exists bonding_progress;
alter table public.settings drop column if exists phase2_reason;
alter table public.settings alter column extra_request_cost set default 1;
alter table public.settings alter column real_user_goal set default 1000;
alter table public.settings add column if not exists verify_lock_amount int not null default 100 check (verify_lock_amount > 0);

-- 4. Wallet = the one you signed in with (no separately linked wallet).
drop function if exists public.link_wallet(text, text);
drop function if exists public.unlink_wallet();
drop table if exists public.wallets;

-- 5. Ledger kinds + verification locks.
alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in ('revenue-share', 'reject-reward', 'buy-requests', 'withdraw', 'adjustment', 'lock-return', 'unlock'));

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

alter table public.locks enable row level security;
create policy locks_read on public.locks for select using (user_id = auth.uid() or public.is_admin());

-- 6. Functions (all recreated from schema.sql).
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

create or replace function public.protect_profile() returns trigger
language plpgsql as $$
declare p text;
begin
  if coalesce(current_setting('nerdy.internal', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.rejections_given := 0;
      new.rejections_received := 0;
      new.accepts := 0;
      new.created_at := now();
    else
      new.id := old.id;
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
begin
  perform public._internal();
  update public.requests set status = p_status, resolved_at = now(), seen = false
  where id = p_request and status = 'pending'
  returning * into r;
  if r.id is null then
    raise exception 'This request was already answered.';
  end if;

  if p_status = 'accepted' then
    update public.profiles set accepts = accepts + 1 where id in (r.from_id, r.to_id);
  else
    update public.profiles set rejections_received = rejections_received + 1 where id = r.from_id;
    update public.profiles set rejections_given = rejections_given + 1 where id = r.to_id;
  end if;
  return r;
end $$;

create or replace function public._require_verified(me uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into p from public.profiles where id = me;
  if p.id is null then raise exception 'Create your profile first.'; end if;
  if not p.verified then
    raise exception 'Get verified first: lock % $NERDY on your dashboard.', (select verify_lock_amount from public.settings where id = 1);
  end if;
end $$;

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

create or replace function public._phase_on_verify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verified and not old.verified then
    update public.settings set updated_at = now() where id = 1 and phase = 1;
  end if;
  return new;
end $$;

create or replace function public._month(t timestamptz) returns date
language sql immutable as $$ select date_trunc('month', t at time zone 'utc')::date $$;

create or replace function public._month_rejections(m date)
returns table (user_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select r.from_id, count(*)::int
  from public.requests r
  cross join public.settings s
  where r.status = 'rejected'
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
  update public.profiles set verified = true where id = p_user;
end $$;

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
  update public.profiles set verified = false where id = me;
  insert into public.ledger (user_id, kind, amount, note)
  values (me, 'lock-return', total, 'Unlocked ' || total || ' $NERDY');
  insert into public.ledger (user_id, kind, amount, note, status, wallet)
  values (me, 'unlock', -total, 'Unlock → ' || left(w, 4) || '…' || right(w, 4), 'requested', w);
  return total;
end $$;

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
  perform public._require_verified(me);
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
  return r;
end $$;

create or replace function public.respond_request(p_request uuid, p_accept boolean) returns public.requests
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  perform public._require_verified(auth.uid());
  select * into r from public.requests where id = p_request for update;
  if r.id is null or r.to_id <> auth.uid() then raise exception 'Request not found.'; end if;
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
declare me uuid := auth.uid(); s public.settings; w text; l public.ledger;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into s from public.settings where id = 1;
  if s.phase <> 2 then raise exception 'Withdrawals open in Phase 2.'; end if;
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

create or replace function public.public_stats() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'residents', count(*),
    'verified', count(*) filter (where verified),
    'rejections', coalesce(sum(rejections_received), 0)
  ) from public.profiles
$$;

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

create or replace function public.admin_add_revenue(p_amount bigint, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if (select phase from public.settings where id = 1) <> 2 then raise exception 'Revenue sharing starts in Phase 2.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a positive amount.'; end if;
  insert into public.revenue (month, source, amount, note)
  values (public._month(now()), 'admin', p_amount, left(coalesce(nullif(btrim(p_note), ''), 'Added by admin'), 120));
end $$;

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

-- 7. Triggers.
drop trigger if exists settings_phase on public.settings;
create trigger settings_phase before insert or update on public.settings
for each row execute function public._settings_phase();
create trigger profiles_phase after update of verified on public.profiles
for each row execute function public._phase_on_verify();

-- 8. Permissions.
revoke execute on function public._internal() from public, anon, authenticated;
revoke execute on function public._resolve(uuid, text) from public, anon, authenticated;
revoke execute on function public._balance(uuid) from public, anon, authenticated;
revoke execute on function public._wallet(uuid) from public, anon, authenticated;
revoke execute on function public._require_verified(uuid) from public, anon, authenticated;
revoke execute on function public._settings_phase() from public, anon, authenticated;
revoke execute on function public._phase_on_verify() from public, anon, authenticated;
revoke execute on function public._month_rejections(date) from public, anon, authenticated;
revoke execute on function public._settle_month(date) from public, anon, authenticated;
revoke execute on function public.record_lock(uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_lock(uuid, text, bigint, text) to service_role;
revoke execute on function public.delete_my_account() from anon;

-- Clients can read only what RLS allows and never write counters directly.
revoke insert, update, delete on public.requests, public.ledger, public.daily_usage, public.locks, public.revenue, public.distributions from anon, authenticated;

-- 9. Counters recomputed from real interactions only; old manual badges cleared
-- (verified now means "has $NERDY locked").
select set_config('nerdy.internal', 'on', false);
update public.profiles p set
  verified = false,
  rejections_received = (select count(*) from public.requests r where r.from_id = p.id and r.status = 'rejected'),
  rejections_given = (select count(*) from public.requests r where r.to_id = p.id and r.status = 'rejected'),
  accepts = (select count(*) from public.requests r where (r.from_id = p.id or r.to_id = p.id) and r.status = 'accepted');
select set_config('nerdy.internal', '', false);

