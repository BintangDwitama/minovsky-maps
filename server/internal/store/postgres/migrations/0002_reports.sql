-- Player reports about published scenarios. No IP addresses or personal data are stored.
CREATE TABLE reports (
    id          bigserial PRIMARY KEY,
    scenario_id text NOT NULL REFERENCES scenarios (id),
    reason      text NOT NULL,
    details     text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    emailed_at  timestamptz
);

CREATE INDEX reports_scenario ON reports (scenario_id, created_at DESC);
