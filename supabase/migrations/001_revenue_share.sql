-- =====================================================================
-- Nerdy Town — migration: Phase 2 by residents goal + monthly revenue share
-- Run this ONCE in Supabase → SQL Editor if you set up the database BEFORE
-- this change (fresh installs: schema.sql already includes it).
-- Safe to run again if you're unsure whether it ran.
-- =====================================================================

-- Settings: resident goal + when/why Phase 2 started; per-rejection reward is gone.
alter table public.settings add column if not exists real_user_goal int not null default 100 check (real_user_goal between 1 and 1000000);
alter table public.settings add column if not exists phase2_at timestamptz;
alter table public.settings add column if not exists phase2_reason text check (phase2_reason in ('graduation', 'residents'));
update public.settings set phase2_at = coalesce(phase2_at, now()), phase2_reason = coalesce(phase2_reason, 'graduation') where phase = 2;
alter table public.settings drop column if exists reject_reward;

alter table public.ledger drop constraint if exists ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check (kind in ('revenue-share', 'reject-reward', 'buy-requests', 'withdraw', 'adjustment'));

-- Platform revenue, pooled per calendar month (UTC) and shared among rejected residents.
create table if not exists public.revenue (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  source text not null check (source in ('requests', 'admin', 'carry-over')),
  amount bigint not null check (amount > 0),
  user_id uuid references public.profiles (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists revenue_month_idx on public.revenue (month);

-- One row per month that has been paid out.
create table if not exists public.distributions (
  month date primary key,
  pool bigint not null,
  rejections int not null,
  recipients int not null,
  paid bigint not null,
  carried bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists requests_rejected_idx on public.requests (resolved_at) where status = 'rejected';

alter table public.revenue enable row level security;
alter table public.distributions enable row level security;
drop policy if exists revenue_read on public.revenue;
drop policy if exists distributions_read on public.distributions;
create policy revenue_read on public.revenue for select using (public.is_admin());
create policy distributions_read on public.distributions for select using (true);

-- Rejections no longer pay a fixed amount; buying requests feeds the pool.
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
  delete from public.bot_queue where request_id = r.id;

  if p_status = 'accepted' then
    update public.profiles set accepts = accepts + 1 where id in (r.from_id, r.to_id);
  else
    update public.profiles set rejections_received = rejections_received + 1 where id = r.from_id;
    update public.profiles set rejections_given = rejections_given + 1 where id = r.to_id;
  end if;
  return r;
end $$;

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
declare me uuid := auth.uid(); s public.settings; w public.wallets; l public.ledger;
begin
  if me is null then raise exception 'Log in first.'; end if;
  select * into s from public.settings where id = 1;
  if s.phase <> 2 then raise exception 'Withdrawals open in Phase 2.'; end if;
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

-- ---------------------------------------------------------------------
-- Phase 2: graduation (admin sets phase = 2) or the real-resident goal,
-- whichever comes first. Enforced on every settings change.
-- ---------------------------------------------------------------------
create or replace function public._settings_phase() returns trigger
language plpgsql security definer set search_path = public as $$
declare reason text;
begin
  if new.phase = 1 and (select count(*) from public.profiles where not is_bot) >= new.real_user_goal then
    new.phase := 2;
    reason := 'residents';
  end if;
  if new.phase = 2 and (tg_op = 'INSERT' or old.phase = 1) then
    new.phase2_at := now();
    new.phase2_reason := coalesce(reason, 'graduation');
  elsif new.phase = 1 then
    new.phase2_at := null;
    new.phase2_reason := null;
  else
    new.phase2_at := old.phase2_at;
    new.phase2_reason := old.phase2_reason;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists settings_phase on public.settings;
create trigger settings_phase before insert or update on public.settings
for each row execute function public._settings_phase();

-- Each new real resident re-checks the goal.
create or replace function public._phase_on_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not new.is_bot then
    update public.settings set updated_at = now() where id = 1 and phase = 1;
  end if;
  return new;
end $$;
drop trigger if exists profiles_phase on public.profiles;
create trigger profiles_phase after insert on public.profiles
for each row execute function public._phase_on_signup();

-- ---------------------------------------------------------------------
-- Monthly revenue share. Every $NERDY spent in town (plus anything the
-- admin adds, e.g. creator trading fees) goes into the month's pool. After
-- the month ends, the pool is split among everyone who got rejected that
-- month, in proportion to their rejections. Rounding dust rolls over.
-- ---------------------------------------------------------------------
create or replace function public._month(t timestamptz) returns date
language sql immutable as $$ select date_trunc('month', t at time zone 'utc')::date $$;

-- Rejections each resident received from real residents in a month (Phase 2
-- only). NPC answers are automatic, so they never earn a share.
create or replace function public._month_rejections(m date)
returns table (user_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select r.from_id, count(*)::int
  from public.requests r
  join public.profiles p on p.id = r.from_id and not p.is_bot
  join public.profiles t on t.id = r.to_id and not t.is_bot
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

create or replace function public.admin_add_revenue(p_amount bigint, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if (select phase from public.settings where id = 1) <> 2 then raise exception 'Revenue sharing starts in Phase 2.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a positive amount.'; end if;
  insert into public.revenue (month, source, amount, note)
  values (public._month(now()), 'admin', p_amount, left(coalesce(nullif(btrim(p_note), ''), 'Added by admin'), 120));
end $$;

revoke execute on function public._settings_phase() from public, anon, authenticated;
revoke execute on function public._phase_on_signup() from public, anon, authenticated;
revoke execute on function public._month_rejections(date) from public, anon, authenticated;
revoke execute on function public._settle_month(date) from public, anon, authenticated;
revoke execute on function public.delete_my_account() from anon;

revoke insert, update, delete on public.revenue, public.distributions from anon, authenticated;

-- Apply the residents goal right away (moves to Phase 2 if you already have enough real residents).
update public.settings set updated_at = now() where id = 1;
