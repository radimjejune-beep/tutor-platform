-- Разделы обучения, грамматический справочник и персональные диагностики.
ALTER TABLE progress_topics ADD COLUMN IF NOT EXISTS grammar_key VARCHAR(60);
CREATE TABLE IF NOT EXISTS study_sections (
  id SERIAL PRIMARY KEY,
  tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  grammar_key VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS study_sections_title_key ON study_sections(tutor_id, lower(title));
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES study_sections(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS assignments_section_idx ON assignments(section_id);
CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id SERIAL PRIMARY KEY,
  tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  due_on DATE,
  section_id INTEGER REFERENCES study_sections(id) ON DELETE SET NULL,
  mode VARCHAR(10) NOT NULL CHECK(mode IN ('manual','topics','covered')),
  request_key UUID NOT NULL,
  request_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tutor_id, request_key)
);
CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES diagnostic_tests(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  questions JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  submitted_at TIMESTAMPTZ,
  draft_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(test_id,student_id)
);
CREATE INDEX IF NOT EXISTS diagnostic_runs_student_idx ON diagnostic_runs(student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS diagnostic_tests_tutor_idx ON diagnostic_tests(tutor_id,created_at DESC);
