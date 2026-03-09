begin;

drop policy if exists collaboration_sessions_select on public.collaboration_sessions;
create policy collaboration_sessions_select
on public.collaboration_sessions
for select
using (
  ((select auth.uid() as uid) = created_by)
  or exists (
    select 1
    from public.session_participants participant
    where participant.session_id = collaboration_sessions.id
      and participant.user_id = (select auth.uid() as uid)
  )
);

drop policy if exists session_participants_select on public.session_participants;
create policy session_participants_select
on public.session_participants
for select
using (
  ((select auth.uid() as uid) = user_id)
  or exists (
    select 1
    from public.collaboration_sessions session
    where session.id = session_participants.session_id
      and session.created_by = (select auth.uid() as uid)
  )
  or exists (
    select 1
    from public.session_participants participant
    where participant.session_id = session_participants.session_id
      and participant.user_id = (select auth.uid() as uid)
  )
);

drop policy if exists session_participants_insert on public.session_participants;
create policy session_participants_insert
on public.session_participants
for insert
with check (
  ((select auth.uid() as uid) = user_id)
  and exists (
    select 1
    from public.collaboration_sessions session
    where session.id = session_participants.session_id
      and session.is_active = true
  )
);

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert
on public.notifications
for insert
with check (
  ((select auth.role() as role) = 'service_role'::text)
  or ((select auth.uid() as uid) = user_id)
);

create or replace function public.notify_broadcast_followers(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_session public.broadcast_sessions%rowtype;
  v_broadcaster_name text;
  v_inserted integer := 0;
begin
  if v_actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select *
  into v_session
  from public.broadcast_sessions
  where id = p_session_id
    and broadcaster_id = v_actor
    and status = 'live'
  for update;

  if not found then
    raise exception 'Broadcast session not found or access denied' using errcode = '42501';
  end if;

  select full_name
  into v_broadcaster_name
  from public.profiles
  where id = v_actor;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    priority,
    metadata
  )
  select
    follower.follower_id,
    'broadcast_live',
    '🔴 Live Now!',
    concat(coalesce(nullif(v_broadcaster_name, ''), 'Someone you follow'), ' is live: ', v_session.title),
    '/broadcast/' || v_session.id::text,
    'high',
    jsonb_build_object('session_id', v_session.id)
  from public.user_follows follower
  where follower.following_id = v_actor
    and follower.notifications_enabled = true
    and follower.follower_id <> v_actor;

  get diagnostics v_inserted = row_count;

  update public.broadcast_sessions
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('notification_sent', true)
  where id = v_session.id;

  return v_inserted;
end;
$$;

revoke all on function public.notify_broadcast_followers(uuid) from public;
grant execute on function public.notify_broadcast_followers(uuid) to authenticated;
grant execute on function public.notify_broadcast_followers(uuid) to service_role;

commit;
