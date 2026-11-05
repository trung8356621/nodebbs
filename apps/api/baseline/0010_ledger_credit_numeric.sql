-- Credit ledger: bigint → numeric for exact fractional Credits (e.g. 5000 VND / 10000 = 0.5).
-- Non-destructive: USING cast keeps existing integer values unchanged (no × / ÷ of balances).
-- OPS forum-credit/1 integer grant payloads remain valid (integers ⊂ numeric).

ALTER TABLE sys_accounts
  ALTER COLUMN balance TYPE numeric(30, 10) USING balance::numeric,
  ALTER COLUMN total_earned TYPE numeric(30, 10) USING total_earned::numeric,
  ALTER COLUMN total_spent TYPE numeric(30, 10) USING total_spent::numeric;

ALTER TABLE sys_accounts DROP CONSTRAINT IF EXISTS sys_accounts_balance_safe;
ALTER TABLE sys_accounts
  ADD CONSTRAINT sys_accounts_balance_safe CHECK (balance >= 0);

ALTER TABLE sys_transactions
  ALTER COLUMN amount TYPE numeric(30, 10) USING amount::numeric,
  ALTER COLUMN balance_after TYPE numeric(30, 10) USING balance_after::numeric;

UPDATE sys_currencies
SET precision = 10
WHERE code = 'credits' AND (precision IS NULL OR precision < 10);

-- Rate-change audit (Forum-local display/conversion ratio).
CREATE TABLE IF NOT EXISTS forum_credit_vnd_rate_history (
  id uuid PRIMARY KEY,
  old_value integer,
  new_value integer NOT NULL CHECK (new_value >= 1),
  actor_id integer REFERENCES users(id),
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  note text
);

CREATE INDEX IF NOT EXISTS forum_credit_vnd_rate_history_effective_idx
  ON forum_credit_vnd_rate_history (effective_at DESC);
