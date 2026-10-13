-- 007_html_notifications.sql — HTML-уроки, уведомления, группы, отработка слов в ДЗ
-- Применять один раз, после 006_courses_vocab.sql

BEGIN;

-- Четвёртый вид материала: готовый интерактивный HTML-урок (файл целиком хранится в базе)
ALTER TABLE library_items DROP CONSTRAINT library_items_kind_check;
ALTER TABLE library_items ADD CONSTRAINT library_items_kind_check CHECK (kind IN ('theory', 'task', 'game', 'html'));
ALTER TABLE library_items ADD COLUMN html TEXT;

-- Уведомления в кабинете: всем пользователям (преподавателю, ученикам, родителям)
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        VARCHAR(30)  NOT NULL,          -- homework_new, homework_checked, lesson_moved...
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  link        VARCHAR(255),                   -- куда вести в кабинете: /homework/5
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================================
-- Группы: несколько учеников занимаются вместе
-- Групповое занятие = по одной строке lessons на каждого ученика с общим group_id и временем,
-- поэтому посещаемость и списание у каждого свои
-- ============================================================
CREATE TABLE groups (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  level             VARCHAR(50),
  default_price     INTEGER      NOT NULL DEFAULT 0,   -- с одного ученика за занятие, ₽
  default_duration  INTEGER      NOT NULL DEFAULT 60,
  call_link         TEXT,
  board_link        TEXT,
  notes             TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id    INTEGER     NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id  INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);

ALTER TABLE lessons ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX idx_lessons_group ON lessons(group_id, starts_at);

-- ============================================================
-- Отработка слов в домашнем задании
-- ============================================================
ALTER TABLE assignments ADD COLUMN vocab_practice JSONB;   -- {"count": 12}
ALTER TABLE homework ADD COLUMN vocab_result JSONB;        -- {"correct": 10, "total": 12, "at": "..."}

COMMIT;
