-- =====================================================================
-- Nerdy Town — migration 007: an accepted request earns NO points.
-- Only being rejected (+10) and inviting friends (+50) earn points.
-- Removes match points already given. Run ONCE in Supabase → SQL Editor
-- (after 006). Safe to run twice. Fresh installs don't need it.
-- =====================================================================

delete from public.points where kind = 'accepted';
alter table public.points drop constraint if exists points_kind_check;
alter table public.points add constraint points_kind_check check (kind in ('rejected', 'invite', 'adjustment'));

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
  -- Points for the person who got rejected (an accepted request earns no points).
  if p_status = 'rejected' and s.points_reject > 0 then
    insert into public.points (user_id, kind, amount, ref) values (r.from_id, 'rejected', s.points_reject, r.id)
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

alter table public.settings drop column if exists points_accept;
