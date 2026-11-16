CREATE TABLE IF NOT EXISTS plan_requests (
 id SERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 requested_plan VARCHAR(20) NOT NULL CHECK(requested_plan='tutor'),
 period VARCHAR(10) NOT NULL CHECK(period IN ('month','year')),
 requested_amount INTEGER NOT NULL CHECK(requested_amount>=0),
 status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','closed')),
 handled_by TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_requests_pending ON plan_requests(tutor_id) WHERE status='pending';
