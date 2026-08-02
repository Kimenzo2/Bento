-- ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

-- Currency-aware Paystack checkout support.
-- Adds expected currency and amount columns to the checkout intents table
-- so the webhook can verify payments match the intended local-currency amount.

alter table if exists public.paystack_checkout_intents
  add column if not exists expected_currency text not null default 'USD',
  add column if not exists expected_amount_smallest_unit bigint not null default 0;
