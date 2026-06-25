-- Keep only the existing profile email index.
-- 0003 introduced a duplicate index name on the same column.

drop index if exists public.profiles_email_idx;
