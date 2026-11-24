-- Immutable writing revisions, personal workouts and an evidence-backed trail.
CREATE TABLE writing_threads (
 id SERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 homework_id INTEGER REFERENCES homework(id) ON DELETE SET NULL,
 source_kind VARCHAR(10) NOT NULL CHECK(source_kind IN ('homework','game')),
 source_id INTEGER NOT NULL,
 source_block INTEGER NOT NULL DEFAULT -1,
 title VARCHAR(255) NOT NULL,
 state VARCHAR(24) NOT NULL DEFAULT 'awaiting_feedback' CHECK(state IN ('awaiting_feedback','revision_requested','submitted','accepted')),
 current_revision INTEGER NOT NULL DEFAULT 1,
 version INTEGER NOT NULL DEFAULT 1,
 accepted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(source_kind,source_id,source_block)
);
CREATE INDEX writing_threads_student ON writing_threads(student_id,updated_at DESC);
CREATE INDEX writing_threads_homework ON writing_threads(homework_id);
CREATE TABLE writing_versions (
 thread_id INTEGER NOT NULL REFERENCES writing_threads(id) ON DELETE CASCADE,
 number INTEGER NOT NULL,
 text TEXT NOT NULL CHECK(length(text)<=12000),
 author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(thread_id,number)
);
CREATE TABLE writing_annotations (
 id SERIAL PRIMARY KEY,
 thread_id INTEGER NOT NULL,
 revision INTEGER NOT NULL,
 start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL,
 quote TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 category VARCHAR(20) NOT NULL CHECK(category IN ('grammar','vocabulary','structure','content','other')),
 author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), published_at TIMESTAMPTZ,
 FOREIGN KEY(thread_id,revision) REFERENCES writing_versions(thread_id,number) ON DELETE CASCADE,
 CHECK(start_offset>=0 AND end_offset>=start_offset)
);
CREATE TABLE personal_workouts (
 id SERIAL PRIMARY KEY,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 day DATE NOT NULL,
 topics JSONB NOT NULL, questions JSONB NOT NULL,
 answers JSONB, result JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), submitted_at TIMESTAMPTZ,
 UNIQUE(student_id,day)
);
CREATE TABLE student_trails (
 student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 paused BOOLEAN NOT NULL DEFAULT FALSE,
 gate_overdue BOOLEAN NOT NULL DEFAULT TRUE,
 version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE trail_events (
 id BIGSERIAL PRIMARY KEY,
 student_id INTEGER NOT NULL REFERENCES student_trails(student_id) ON DELETE CASCADE,
 source_key VARCHAR(150) NOT NULL,
 kind VARCHAR(20) NOT NULL CHECK(kind IN ('homework','writing','workout','skill')),
 title VARCHAR(255) NOT NULL,
 source_id INTEGER NOT NULL,
 earned_at TIMESTAMPTZ NOT NULL,
 credited_at TIMESTAMPTZ,
 UNIQUE(student_id,source_key)
);
CREATE INDEX trail_events_student ON trail_events(student_id,credited_at);
ALTER TABLE homework ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE homework ADD COLUMN trail_exempt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE language_checks ADD COLUMN evidence_kind VARCHAR(20);
ALTER TABLE language_checks ADD COLUMN evidence_id INTEGER;
ALTER TABLE language_checks ADD CONSTRAINT language_evidence_pair CHECK (
 (evidence_kind IS NULL AND evidence_id IS NULL) OR
 (evidence_kind IN ('homework','writing','diagnostic','workout') AND evidence_id>0)
);
