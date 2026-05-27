-- 013_dodo_core_pro_power_compat.sql
-- Accept the renamed public plan names (CORE / PRO / POWER) while preserving
-- the existing database entitlement values used by live profile constraints.

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
  v_raw_tier text := upper(nullif(trim(coalesce(
    v_data -> 'metadata' ->> 'entitlement_tier',
    v_data -> 'metadata' ->> 'plan'
  )), ''));
  v_tier text := case v_raw_tier
    when 'CORE' then 'CREATOR'
    when 'PRO' then 'STUDIO'
    when 'POWER' then 'EMPIRE'
    when 'CREATOR' then 'CREATOR'
    when 'STUDIO' then 'STUDIO'
    when 'EMPIRE' then 'EMPIRE'
    else null
  end;
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
