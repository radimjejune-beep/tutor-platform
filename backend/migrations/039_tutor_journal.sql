CREATE TABLE tutor_journal_entries (
 id BIGSERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day DATE NOT NULL,
 kind VARCHAR(12) NOT NULL CHECK(kind IN ('task','note')),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
 done BOOLEAN NOT NULL DEFAULT FALSE,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tutor_journal_day ON tutor_journal_entries(tutor_id,day,id);
