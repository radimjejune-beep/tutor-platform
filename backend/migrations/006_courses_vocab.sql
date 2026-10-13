-- 006_courses_vocab.sql — курсы по учебнику и личный словарь ученика
-- Применять один раз, после 005_games.sql

BEGIN;

-- ============================================================
-- Курс по учебнику: юниты и материалы к каждому юниту
-- ============================================================
CREATE TABLE courses (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,                 -- «Solutions Elementary 3rd ed.»
  subject      VARCHAR(100) NOT NULL DEFAULT 'Английский язык',
  level        VARCHAR(50),
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE course_units (
  id                 SERIAL PRIMARY KEY,
  course_id          INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position           INTEGER      NOT NULL DEFAULT 0,
  code               VARCHAR(20),                     -- «1F»
  title              VARCHAR(255) NOT NULL,           -- «Brotherly love?»
  goals              TEXT,                            -- что ученик должен уметь после юнита
  item_ids           INTEGER[]    NOT NULL DEFAULT '{}', -- материалы для урока
  homework_item_ids  INTEGER[]    NOT NULL DEFAULT '{}', -- что выдаётся на дом одним нажатием
  vocab              JSONB        NOT NULL DEFAULT '[]', -- [{ "term", "translation", "example" }]
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_course_units_course ON course_units(course_id, position);

-- На каком курсе и юните сейчас ученик
ALTER TABLE students ADD COLUMN course_id      INTEGER REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN course_unit_id INTEGER REFERENCES course_units(id) ON DELETE SET NULL;

-- Какой юнит проходили на уроке
ALTER TABLE lessons ADD COLUMN unit_id INTEGER REFERENCES course_units(id) ON DELETE SET NULL;

-- ============================================================
-- Личный словарь: интервальное повторение (коробки 0–5)
-- ============================================================
CREATE TABLE vocab_items (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term              VARCHAR(200) NOT NULL,
  translation       VARCHAR(300),
  example           TEXT,
  source            VARCHAR(20)  NOT NULL DEFAULT 'tutor' CHECK (source IN ('tutor', 'unit', 'mistake')),
  unit_id           INTEGER      REFERENCES course_units(id) ON DELETE SET NULL,
  box               SMALLINT     NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),
  due_on            DATE         NOT NULL DEFAULT CURRENT_DATE,
  reviews           INTEGER      NOT NULL DEFAULT 0,
  lapses            INTEGER      NOT NULL DEFAULT 0,  -- сколько раз забыл
  last_reviewed_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_vocab_unique ON vocab_items(student_id, lower(term));
CREATE INDEX idx_vocab_due ON vocab_items(student_id, due_on);

COMMIT;
