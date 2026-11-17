CREATE TABLE language_profiles (
 id SERIAL PRIMARY KEY,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 subject VARCHAR(255) NOT NULL,
 current_level VARCHAR(10),
 target_level VARCHAR(10) NOT NULL,
 basis TEXT NOT NULL,
 level_confirmed_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(student_id, subject),
 CHECK(current_level IS NULL OR current_level IN ('Pre-A1','A1','A2','B1','B2','C1','C2')),
 CHECK(target_level IN ('A1','A2','B1','B2','C1','C2'))
);
CREATE TABLE language_checks (
 profile_id INTEGER NOT NULL REFERENCES language_profiles(id) ON DELETE CASCADE,
 goal_key VARCHAR(80) NOT NULL,
 state VARCHAR(20) NOT NULL CHECK(state IN ('unassessed','working','confirmed')),
 evidence TEXT NOT NULL DEFAULT '',
 assessed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
 assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(profile_id,goal_key)
);
CREATE TABLE language_history (
 id SERIAL PRIMARY KEY,
 profile_id INTEGER NOT NULL REFERENCES language_profiles(id) ON DELETE CASCADE,
 actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 event VARCHAR(30) NOT NULL,
 details JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX language_history_profile ON language_history(profile_id,id DESC);
