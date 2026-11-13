-- Google accounts, sessions and scenario ownership.
CREATE TABLE accounts (
    id           bigserial PRIMARY KEY,
    google_sub   text NOT NULL UNIQUE,
    email        text NOT NULL,
    display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Only a SHA-256 hash of each session token is stored.
CREATE TABLE sessions (
    token_hash bytea PRIMARY KEY,
    account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_account ON sessions (account_id);

-- Pending Google sign-ins: single use, short-lived.
CREATE TABLE login_states (
    state_hash bytea PRIMARY KEY,
    nonce      text NOT NULL,
    verifier   text NOT NULL,
    return_to  text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);

-- New scenarios are owned and have no edit token; legacy ones keep their token until claimed.
ALTER TABLE scenarios
    ADD COLUMN owner_id bigint REFERENCES accounts (id) ON DELETE SET NULL,
    ALTER COLUMN edit_token_hash DROP NOT NULL,
    ADD COLUMN removed_reason text CHECK (removed_reason IN ('moderation', 'owner', 'account-deleted'));

CREATE INDEX scenarios_owner ON scenarios (owner_id) WHERE taken_down_at IS NULL;
