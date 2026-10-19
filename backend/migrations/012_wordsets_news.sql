-- 012_wordsets_news.sql: наборы карточек для самостоятельной тренировки и объявления на главной
-- Можно запускать повторно: всё создаётся только если ещё нет.
BEGIN;

-- ============================================================
-- Наборы карточек (как в Quizlet): репетитор собирает список слов,
-- ученики учат их сами в любое время
-- ============================================================
CREATE TABLE IF NOT EXISTS word_sets (
  id           SERIAL PRIMARY KEY,
  tutor_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  words        JSONB        NOT NULL DEFAULT '[]',   -- [{"term": "...", "translation": "...", "example": "..."}]
  for_all      BOOLEAN      NOT NULL DEFAULT TRUE,   -- видят все ученики репетитора или только выбранные
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_word_sets_tutor ON word_sets(tutor_id, updated_at DESC);

-- Кому выдан набор (если for_all = false)
CREATE TABLE IF NOT EXISTS word_set_students (
  set_id      INTEGER NOT NULL REFERENCES word_sets(id) ON DELETE CASCADE,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (set_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_word_set_students_student ON word_set_students(student_id);

-- Как ученик знает каждое слово набора: 0 новое, 1 знакомо, 2 почти выучено, 3 выучено
CREATE TABLE IF NOT EXISTS word_set_progress (
  set_id      INTEGER      NOT NULL REFERENCES word_sets(id) ON DELETE CASCADE,
  student_id  INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term_key    VARCHAR(200) NOT NULL,
  level       SMALLINT     NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 3),
  correct     INTEGER      NOT NULL DEFAULT 0,
  wrong       INTEGER      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (set_id, student_id, term_key)
);

-- Журнал самостоятельных занятий: что ученик тренировал без задания
CREATE TABLE IF NOT EXISTS practice_log (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  set_id        INTEGER      REFERENCES word_sets(id) ON DELETE SET NULL,
  title         VARCHAR(200) NOT NULL,
  mode          VARCHAR(20)  NOT NULL,
  correct       INTEGER      NOT NULL DEFAULT 0,
  total         INTEGER      NOT NULL DEFAULT 0,
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_log_student ON practice_log(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_log_set ON practice_log(set_id);

-- Свои слова ученика и слова из наборов в личном словаре
ALTER TABLE vocab_items DROP CONSTRAINT IF EXISTS vocab_items_source_check;
ALTER TABLE vocab_items ADD CONSTRAINT vocab_items_source_check CHECK (source IN ('tutor', 'unit', 'mistake', 'set', 'self'));

-- ============================================================
-- Объявления на главной: репетитор пишет своим ученикам и родителям,
-- сисадмин может написать всем репетиторам платформы
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  tutor_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience    VARCHAR(10)  NOT NULL DEFAULT 'students' CHECK (audience IN ('students', 'tutors')),
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  link        VARCHAR(500),
  pinned      BOOLEAN      NOT NULL DEFAULT FALSE,
  expires_on  DATE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_tutor ON announcements(tutor_id, created_at DESC);

COMMIT;

-- Проверка: должно быть 5 строк «да»
SELECT t AS "таблица", CASE WHEN to_regclass('public.' || t) IS NOT NULL THEN 'да' ELSE 'нет' END AS "есть"
  FROM (VALUES ('word_sets'), ('word_set_students'), ('word_set_progress'), ('practice_log'), ('announcements')) v(t);
