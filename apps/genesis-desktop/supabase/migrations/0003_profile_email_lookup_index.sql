-- Speed up Paystack checkout binding by email when the desktop app hands off
-- a known account email to the web pricing page.

create index if not exists profiles_email_idx
  on public.profiles (email);
