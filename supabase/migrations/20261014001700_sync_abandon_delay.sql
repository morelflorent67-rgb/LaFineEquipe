-- =============================================================================
-- 1700 · Passage de synchro abandonné libéré après 2 minutes (au lieu de 15)
-- En ligne, Netlify coupe une requête après ~30 s : un passage encore « running » au bout de
-- 2 minutes a forcément été interrompu. Sans cela, il bloquait les 3 passages suivants.
-- =============================================================================
create or replace function public.sync_begin(p_job text, p_trigger text) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_last timestamptz;
begin
  update public.sync_runs
     set status = 'error', finished_at = now(), error_code = 'abandoned'
   where job = p_job and status = 'running' and started_at < now() - interval '2 minutes';
  if exists (select 1 from public.sync_runs where job = p_job and status = 'running') then
    perform public._raise('LFE_BUSY');
  end if;
  if p_trigger = 'public' then
    select max(started_at) into v_last from public.sync_runs where job = p_job;
    if v_last is not null and v_last > now() - public._public_refresh_interval() then
      perform public._raise('LFE_TOO_SOON', jsonb_build_object('retryAt', v_last + public._public_refresh_interval()));
    end if;
  end if;
  insert into public.sync_runs (job, trigger) values (p_job, p_trigger) returning id into v_id;
  return v_id;
end
$$;
