-- =====================================================================
-- Nerdy Town — migration 004: the $NERDY token address + extra requests
-- cost 10 $NERDY. Run ONCE in Supabase → SQL Editor (after 003). Safe to
-- run twice. Fresh installs don't need it: schema.sql already includes it.
-- =====================================================================

alter table public.settings alter column extra_request_cost set default 10;
update public.settings set
  extra_request_cost = 10,
  token_mint = '8EE1qVncPvZcFReW9S3U1nuyGmJfoDXpSbAqon77jupx'
where id = 1;
