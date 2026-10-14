-- 011_comments.sql — личные комментарии к работе ученика (как в Google Classroom)
-- Применять один раз, после 010_subjects.sql

BEGIN;

CREATE TABLE homework_comments (
  id           SERIAL PRIMARY KEY,
  homework_id  INTEGER      NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  user_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_homework_comments ON homework_comments(homework_id, created_at);

COMMIT;
