-- Rich-List Database Initialization Script
-- PostgreSQL 15 Schema for XRPL Rich List Application

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) UNIQUE NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    sequence INTEGER NOT NULL DEFAULT 0,
    flags INTEGER NOT NULL DEFAULT 0,
    owner_count INTEGER NOT NULL DEFAULT 0,
    previous_txn_id VARCHAR(255),
    previous_txn_lgr_seq INTEGER,
    account_txn_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_account_id ON accounts(account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_balance ON accounts(balance);
CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updated_at);
CREATE INDEX IF NOT EXISTS idx_accounts_balance_desc ON accounts(balance DESC);

-- Create escrows table
CREATE TABLE IF NOT EXISTS escrows (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    destination_tag INTEGER,
    amount BIGINT NOT NULL,
    finish_after BIGINT,
    finish_fulfillment VARCHAR(255),
    previous_txn_id VARCHAR(255),
    previous_txn_lgr_seq INTEGER,
    ledger_entry_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Create indexes on escrows table
CREATE INDEX IF NOT EXISTS idx_escrows_account_id ON escrows(account_id);
CREATE INDEX IF NOT EXISTS idx_escrows_destination ON escrows(destination);
CREATE INDEX IF NOT EXISTS idx_escrows_finish_after ON escrows(finish_after);
CREATE INDEX IF NOT EXISTS idx_escrows_updated_at ON escrows(updated_at);
CREATE INDEX IF NOT EXISTS idx_escrows_finish_after_future ON escrows(finish_after) WHERE finish_after > 0;

-- Create price history table
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    open NUMERIC(20, 8) NOT NULL,
    high NUMERIC(20, 8) NOT NULL,
    low NUMERIC(20, 8) NOT NULL,
    close NUMERIC(20, 8) NOT NULL,
    volume NUMERIC(20, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(timestamp, currency)
);

-- Create indexes on price_history table
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_price_history_currency ON price_history(currency);
CREATE INDEX IF NOT EXISTS idx_price_history_recent ON price_history(timestamp DESC, currency);

-- Create xrp_price table
CREATE TABLE IF NOT EXISTS xrp_price (
    id SERIAL PRIMARY KEY,
    price NUMERIC(20, 8) NOT NULL,
    time TIMESTAMP NOT NULL,
    ledger BIGINT,
    sequence BIGINT,
    UNIQUE(time)
);

-- Create indexes on xrp_price table
CREATE INDEX IF NOT EXISTS idx_xrp_price_time ON xrp_price(time);
CREATE INDEX IF NOT EXISTS idx_xrp_price_ledger ON xrp_price(ledger);

-- Create ledger stats table
CREATE TABLE IF NOT EXISTS ledger_stats (
    id SERIAL PRIMARY KEY,
    ledger_index INTEGER UNIQUE NOT NULL,
    ledger_hash VARCHAR(255),
    parent_hash VARCHAR(255),
    transaction_count INTEGER NOT NULL DEFAULT 0,
    reserve_base BIGINT NOT NULL DEFAULT 0,
    reserve_inc BIGINT NOT NULL DEFAULT 0,
    closed_at BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on ledger_stats table
CREATE INDEX IF NOT EXISTS idx_ledger_stats_ledger_index ON ledger_stats(ledger_index);
CREATE INDEX IF NOT EXISTS idx_ledger_stats_closed_at ON ledger_stats(closed_at);
CREATE INDEX IF NOT EXISTS idx_ledger_stats_updated_at ON ledger_stats(updated_at);
CREATE INDEX IF NOT EXISTS idx_ledger_stats_recent ON ledger_stats(ledger_index DESC);

-- Create stats table
CREATE TABLE IF NOT EXISTS stats (
    ind INTEGER PRIMARY KEY,
    ledgerindex INTEGER,
    ledgerdate VARCHAR(30),
    totalxrp NUMERIC(20, 8),
    walletxrp NUMERIC(20, 8),
    escrowxrp NUMERIC(20, 8),
    numaccounts INTEGER,
    latest INTEGER
);

-- Create indexes on stats table
CREATE INDEX IF NOT EXISTS idx_stats_ind ON stats(ind);
CREATE INDEX IF NOT EXISTS idx_stats_ledgerindex ON stats(ledgerindex);
CREATE INDEX IF NOT EXISTS idx_stats_latest ON stats(latest);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    txn_id VARCHAR(255) UNIQUE NOT NULL,
    account VARCHAR(255) NOT NULL,
    destination VARCHAR(255),
    amount BIGINT,
    fee BIGINT NOT NULL,
    sequence INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ledger_index INTEGER NOT NULL,
    closed_at BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_txn_id ON transactions(txn_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account);
CREATE INDEX IF NOT EXISTS idx_transactions_destination ON transactions(destination);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_index ON transactions(ledger_index);
CREATE INDEX IF NOT EXISTS idx_transactions_closed_at ON transactions(closed_at);

-- Create currency lines table
CREATE TABLE IF NOT EXISTS currency_lines (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    currency VARCHAR(20) NOT NULL,
    issuer VARCHAR(255),
    balance NUMERIC(30, 8),
    "limit" NUMERIC(30, 8),
    quality_in INTEGER,
    quality_out INTEGER,
    no_ripple BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    UNIQUE(account_id, currency, issuer)
);

-- Create indexes on currency_lines table
CREATE INDEX IF NOT EXISTS idx_currency_lines_account_id ON currency_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_currency_lines_currency ON currency_lines(currency);

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    sequence INTEGER NOT NULL,
    gets_currency VARCHAR(20),
    gets_issuer VARCHAR(255),
    gets_value NUMERIC(30, 8),
    pays_currency VARCHAR(20),
    pays_issuer VARCHAR(255),
    pays_value NUMERIC(30, 8),
    expiration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Create indexes on offers table
CREATE INDEX IF NOT EXISTS idx_offers_account_id ON offers(account_id);
CREATE INDEX IF NOT EXISTS idx_offers_gets_currency ON offers(gets_currency);
CREATE INDEX IF NOT EXISTS idx_offers_pays_currency ON offers(pays_currency);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Table comments
COMMENT ON TABLE accounts IS 'XRPL account information and balances';
COMMENT ON TABLE escrows IS 'XRPL escrow entries';
COMMENT ON TABLE price_history IS 'Historical XRP price data (OHLCV)';
COMMENT ON TABLE ledger_stats IS 'Ledger statistics and metadata';
COMMENT ON TABLE transactions IS 'Transaction records and history';
COMMENT ON TABLE currency_lines IS 'Trust lines and currency balances';
COMMENT ON TABLE offers IS 'Order book entries and offers';
