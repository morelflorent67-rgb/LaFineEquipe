-- =============================================================================
-- 1000 · Une map masquée cache aussi ses fiches détaillées (même règle que list_utilities)
-- =============================================================================
create or replace function public.get_utility(p_map_slug text, p_slug text) returns jsonb
language plpgsql stable
as $$
declare
  m public.maps;
  u public.utilities;
  v_order jsonb;
begin
  select * into m from public.maps where slug = p_map_slug and (active or public.is_admin());
  if m.id is null then return null; end if;
  select * into u from public.utilities where map_id = m.id and slug = p_slug;
  if u.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'title', x.title) order by coalesce(x.zone, ''), x.title), '[]'::jsonb)
    into v_order
    from public.utilities x where x.map_id = m.id and x.status = 'published';
  return jsonb_build_object(
    'utility', public._utility_json(u, m),
    'siblings', v_order,
    'related', coalesce((
      select jsonb_agg(public._utility_json(r, m) order by r.title)
      from (
        select * from public.utilities r
        where r.map_id = m.id and r.id <> u.id and r.status = 'published'
          and (r.target_name = u.target_name or r.zone is not distinct from u.zone
               or (u.throw_position_id is not null and r.throw_position_id = u.throw_position_id))
        order by r.title limit 4
      ) r
    ), '[]'::jsonb),
    'myOpenReport', public._my_open_report(u.id),
    'aerialPath', m.aerial_path,
    'position', (select public._position_json(p) from public.map_positions p where p.id = u.throw_position_id)
  );
end
$$;
