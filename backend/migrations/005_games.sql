-- 005_games.sql — интерактивные упражнения (как в Wordwall) и их результаты
-- Применять один раз, после 004_room_library_telegram.sql

BEGIN;

-- Упражнение — третий вид материала в библиотеке
ALTER TABLE library_items DROP CONSTRAINT library_items_kind_check;
ALTER TABLE library_items ADD CONSTRAINT library_items_kind_check CHECK (kind IN ('theory', 'task', 'game'));
-- Содержимое упражнения: {"type": "match" | "order" | "gaps" | "groups", ...}
ALTER TABLE library_items ADD COLUMN game JSONB;

-- Результаты прохождения
CREATE TABLE game_results (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER     NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  student_id    INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id       INTEGER     REFERENCES users(id) ON DELETE SET NULL,      -- кто проходил (ученик или родитель)
  homework_id   INTEGER     REFERENCES homework(id) ON DELETE SET NULL,   -- в рамках ДЗ
  lesson_id     INTEGER     REFERENCES lessons(id) ON DELETE SET NULL,    -- или на уроке
  correct       INTEGER     NOT NULL,
  total         INTEGER     NOT NULL,
  score         INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
  details       JSONB       NOT NULL DEFAULT '[]',                         -- что где ошибся
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_game_results_student ON game_results(student_id, item_id, created_at DESC);
CREATE INDEX idx_game_results_homework ON game_results(homework_id);
CREATE INDEX idx_game_results_lesson ON game_results(lesson_id);

COMMIT;
