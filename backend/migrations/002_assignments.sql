-- 002_assignments.sql — задания как в Google Classroom
-- • одно задание (assignments) выдаётся нескольким ученикам; работа каждого — строка в homework
-- • файлы: материалы к заданию и вложения ученика к работе
-- • тест с автопроверкой: вопросы в assignments.questions, ответы в homework.quiz_answers
-- Применять один раз, после 001_init.sql. Уже выданные ДЗ переносятся автоматически.

BEGIN;

-- ============================================================
-- Задания
-- ============================================================
CREATE TABLE assignments (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  links        TEXT[]       NOT NULL DEFAULT '{}',
  due_on       DATE,
  -- Вопросы теста: [{id, type: 'choice'|'text', prompt, options: [...], correct: [...], points}]
  questions    JSONB        NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Работа ученика по заданию
ALTER TABLE homework ADD COLUMN assignment_id INTEGER REFERENCES assignments(id) ON DELETE CASCADE;
ALTER TABLE homework ADD COLUMN quiz_answers  JSONB;    -- {id_вопроса: ответ}
ALTER TABLE homework ADD COLUMN quiz_score    INTEGER;  -- автооценка теста, %

-- Переносим уже выданные ДЗ: каждое старое ДЗ становится отдельным заданием
ALTER TABLE assignments ADD COLUMN legacy_homework_id INTEGER;
INSERT INTO assignments (title, description, links, due_on, created_at, legacy_homework_id)
SELECT title, description, links, due_on, created_at, id FROM homework;
UPDATE homework h SET assignment_id = a.id FROM assignments a WHERE a.legacy_homework_id = h.id;
ALTER TABLE assignments DROP COLUMN legacy_homework_id;

-- Теперь текст задания живёт в assignments
ALTER TABLE homework ALTER COLUMN assignment_id SET NOT NULL;
ALTER TABLE homework DROP COLUMN title;
ALTER TABLE homework DROP COLUMN description;
ALTER TABLE homework DROP COLUMN links;
ALTER TABLE homework DROP COLUMN due_on;
ALTER TABLE homework ADD CONSTRAINT homework_one_per_student UNIQUE (assignment_id, student_id);
CREATE INDEX idx_homework_assignment ON homework(assignment_id);

-- ============================================================
-- Файлы (хранятся в базе; до 10 МБ на файл)
-- ============================================================
CREATE TABLE files (
  id             SERIAL PRIMARY KEY,
  assignment_id  INTEGER REFERENCES assignments(id) ON DELETE CASCADE,  -- материал к заданию
  homework_id    INTEGER REFERENCES homework(id) ON DELETE CASCADE,     -- вложение ученика
  filename       VARCHAR(255) NOT NULL,
  mime           VARCHAR(100) NOT NULL,
  size_bytes     INTEGER      NOT NULL,
  data           BYTEA        NOT NULL,
  uploaded_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK ((assignment_id IS NULL) <> (homework_id IS NULL))  -- ровно одно из двух
);
CREATE INDEX idx_files_assignment ON files(assignment_id);
CREATE INDEX idx_files_homework ON files(homework_id);

COMMIT;
