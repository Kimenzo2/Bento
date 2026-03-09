-- Reconcile Dodo webhook identity by exact customer email using the existing profiles.email index.
-- This protects against stale checkout metadata attaching subscription state to the wrong user id.

create or replace function public.apply_dodo_webhook_profile_sync(
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_data jsonb := coalesce(p_payload -> 'data', '{}'::jsonb);
  v_customer_email text := nullif(trim(v_data -> 'customer' ->> 'email'), '');
  v_metadata_user_id uuid;
  v_resolved_profile_id uuid;
  v_tier text := upper(nullif(trim(v_data -> 'metadata' ->> 'plan'), ''));
  v_payment_id text := nullif(trim(v_data ->> 'payment_id'), '');
  v_subscription_id text := nullif(trim(v_data ->> 'subscription_id'), '');
  v_customer_id text := nullif(trim(v_data -> 'customer' ->> 'customer_id'), '');
  v_next_billing_date timestamptz;
  v_cancel_at_period_end boolean := coalesce((v_data ->> 'cancel_at_next_billing_date')::boolean, false);
  v_subscription_status text := lower(coalesce(v_data ->> 'status', ''));
begin
  begin
    if nullif(trim(v_data -> 'metadata' ->> 'supabase_user_id'), '') is not null then
      v_metadata_user_id := (v_data -> 'metadata' ->> 'supabase_user_id')::uuid;
    end if;
  exception
    when invalid_text_representation then
      v_metadata_user_id := null;
  end;

  begin
    if nullif(trim(v_data ->> 'next_billing_date'), '') is not null then
      v_next_billing_date := (v_data ->> 'next_billing_date')::timestamptz;
    end if;
  exception
    when others then
      v_next_billing_date := null;
  end;

  if v_customer_email is not null then
    select p.id
      into v_resolved_profile_id
      from public.profiles p
     where p.email = v_customer_email
     limit 1;
  end if;

  if v_resolved_profile_id is null and v_metadata_user_id is not null then
    select p.id
      into v_resolved_profile_id
      from public.profiles p
     where p.id = v_metadata_user_id
     limit 1;
  end if;

  if v_resolved_profile_id is null then
    return;
  end if;

  if v_payment_id is not null then
    update public.payment_history
       set user_id = v_resolved_profile_id
     where payment_id = v_payment_id
       and user_id is distinct from v_resolved_profile_id;
  end if;

  if v_subscription_id is not null then
    update public.payment_history
       set user_id = v_resolved_profile_id
     where subscription_id = v_subscription_id
       and user_id is distinct from v_resolved_profile_id;
  end if;

  case p_event_type
    when 'payment.succeeded' then
      if v_tier is not null then
        update public.profiles
           set user_tier = v_tier,
               dodo_customer_id = coalesce(v_customer_id, dodo_customer_id),
               payment_provider = 'dodo',
               subscription_status = 'active',
               subscription_plan_code = lower(v_tier),
               updated_at = now()
         where id = v_resolved_profile_id;
      end if;

    when 'subscription.active' then
      if v_tier is not null then
        update public.profiles
           set user_tier = v_tier,
               dodo_customer_id = coalesce(v_customer_id, dodo_customer_id),
               dodo_subscription_id = coalesce(v_subscription_id, dodo_subscription_id),
               payment_provider = 'dodo',
               subscription_status = 'active',
               subscription_plan_code = lower(v_tier),
               subscription_end_date = coalesce(v_next_billing_date, subscription_end_date),
               updated_at = now()
         where id = v_resolved_profile_id;
      end if;

    when 'subscription.updated' then
      if v_subscription_status = 'active' and v_tier is not null then
        update public.profiles
           set user_tier = v_tier,
               dodo_customer_id = coalesce(v_customer_id, dodo_customer_id),
               dodo_subscription_id = coalesce(v_subscription_id, dodo_subscription_id),
               payment_provider = 'dodo',
               subscription_status = 'active',
               subscription_plan_code = lower(v_tier),
               subscription_end_date = coalesce(v_next_billing_date, subscription_end_date),
               updated_at = now()
         where id = v_resolved_profile_id;
      elsif v_subscription_status = 'failed' then
        update public.profiles
           set subscription_status = 'payment_failed',
               updated_at = now()
         where id = v_resolved_profile_id;
      elsif v_subscription_status = 'on_hold' then
        update public.profiles
           set subscription_status = 'on_hold',
               updated_at = now()
         where id = v_resolved_profile_id;
      end if;

    when 'subscription.renewed' then
      update public.profiles
         set dodo_subscription_id = coalesce(v_subscription_id, dodo_subscription_id),
             dodo_customer_id = coalesce(v_customer_id, dodo_customer_id),
             payment_provider = 'dodo',
             subscription_status = 'active',
             subscription_end_date = coalesce(v_next_billing_date, subscription_end_date),
             updated_at = now()
       where id = v_resolved_profile_id;

    when 'subscription.failed' then
      update public.profiles
         set subscription_status = 'payment_failed',
             updated_at = now()
       where id = v_resolved_profile_id;

    when 'subscription.on_hold' then
      update public.profiles
         set subscription_status = 'on_hold',
             updated_at = now()
       where id = v_resolved_profile_id;

    when 'subscription.cancelled' then
      if v_cancel_at_period_end and v_next_billing_date is not null then
        update public.profiles
           set subscription_status = 'cancelled',
               subscription_end_date = v_next_billing_date,
               cancel_at_period_end = true,
               updated_at = now()
         where id = v_resolved_profile_id;
      else
        update public.profiles
           set user_tier = 'SPARK',
               subscription_status = 'inactive',
               subscription_plan_code = null,
               subscription_end_date = null,
               cancel_at_period_end = false,
               dodo_subscription_id = null,
               payment_provider = 'none',
               updated_at = now()
         where id = v_resolved_profile_id;
      end if;

    when 'refund.succeeded' then
      update public.profiles
         set user_tier = 'SPARK',
             subscription_status = 'inactive',
             subscription_plan_code = null,
             subscription_end_date = null,
             cancel_at_period_end = false,
             dodo_subscription_id = null,
             payment_provider = 'none',
             updated_at = now()
       where id = v_resolved_profile_id;
  end case;
end;
$$;

create or replace function public.sync_dodo_profile_from_processed_webhook()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform public.apply_dodo_webhook_profile_sync(new.event_type, new.payload);
  return new;
end;
$$;

drop trigger if exists trg_processed_webhooks_dodo_profile_sync on public.processed_webhooks;

create trigger trg_processed_webhooks_dodo_profile_sync
after insert on public.processed_webhooks
for each row
execute function public.sync_dodo_profile_from_processed_webhook();

do $$
declare
  v_webhook record;
begin
  for v_webhook in
    select event_type, payload
      from public.processed_webhooks
     where event_type in (
       'payment.succeeded',
       'subscription.active',
       'subscription.updated',
       'subscription.renewed',
       'subscription.failed',
       'subscription.on_hold',
       'subscription.cancelled',
       'refund.succeeded'
     )
  loop
    perform public.apply_dodo_webhook_profile_sync(v_webhook.event_type, v_webhook.payload);
  end loop;
end;
$$;
