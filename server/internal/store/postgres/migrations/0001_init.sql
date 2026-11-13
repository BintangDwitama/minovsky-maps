-- Published scenarios and their immutable versions.
CREATE TABLE scenarios (
    id              text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{8}$'),
    edit_token_hash bytea NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    taken_down_at   timestamptz
);

CREATE TABLE scenario_versions (
    id             bigserial PRIMARY KEY,
    scenario_id    text NOT NULL REFERENCES scenarios (id),
    doc            jsonb NOT NULL,
    schema_version integer NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scenario_versions_latest ON scenario_versions (scenario_id, id DESC);
