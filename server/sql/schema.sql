CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(30) NOT NULL,
    initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT accounts_type_check
        CHECK (
            account_type IN (
                'CHECKING',
                'SAVINGS',
                'CREDIT',
                'CASH',
                'INVESTMENT',
                'OTHER'
            )
        )
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category_type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT categories_type_check
        CHECK (
            category_type IN (
                'INCOME',
                'EXPENSE'
            )
        ),

    CONSTRAINT categories_unique_per_user
        UNIQUE (
            user_id,
            name,
            category_type
        )
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,

    transaction_type VARCHAR(20) NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,

    description VARCHAR(200) NOT NULL,

    transaction_date DATE NOT NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT transactions_type_check
        CHECK (
            transaction_type IN (
                'INCOME',
                'EXPENSE'
            )
        ),

    CONSTRAINT transactions_amount_check
        CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

    month_start DATE NOT NULL,

    amount NUMERIC(12, 2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT budgets_amount_check
        CHECK (amount > 0),

    CONSTRAINT budgets_unique_category_month
        UNIQUE (
            user_id,
            category_id,
            month_start
        )
);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id
ON accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id
ON categories(user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_account_id
ON transactions(account_id);

CREATE INDEX IF NOT EXISTS idx_transactions_category_id
ON transactions(category_id);

CREATE INDEX IF NOT EXISTS idx_transactions_date
ON transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_budgets_user_id
ON budgets(user_id);

CREATE INDEX IF NOT EXISTS idx_budgets_month
ON budgets(month_start);
-- Transactional cache invalidation, including direct SQL writes and cascades.
ALTER TABLE users ADD COLUMN IF NOT EXISTS dashboard_version BIGINT NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION bump_dashboard_version() RETURNS trigger AS $$
DECLARE old_user integer; new_user integer;
BEGIN
  IF TG_TABLE_NAME = 'transactions' THEN
    IF TG_OP <> 'INSERT' THEN SELECT user_id INTO old_user FROM accounts WHERE id=OLD.account_id; END IF;
    IF TG_OP <> 'DELETE' THEN SELECT user_id INTO new_user FROM accounts WHERE id=NEW.account_id; END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN old_user := OLD.user_id; END IF;
    IF TG_OP <> 'DELETE' THEN new_user := NEW.user_id; END IF;
  END IF;
  UPDATE users SET dashboard_version=dashboard_version+1 WHERE id=old_user OR id=new_user;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','categories','budgets','transactions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS dashboard_changed ON %I', t);
    EXECUTE format('CREATE TRIGGER dashboard_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION bump_dashboard_version()', t);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS transaction_imports (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) NOT NULL,
  content_hash TEXT NOT NULL,
  csv TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  row_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_import_pending ON transaction_imports(created_at) WHERE status='pending';
