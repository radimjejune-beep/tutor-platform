-- 004_room_library_telegram.sql — комната урока, библиотека, итоги урока в Telegram
-- Применять один раз, после 003_booking_legal.sql

BEGIN;

-- ============================================================
-- Ссылки на видеозвонок (Телемост / Zoom / Meet)
-- Постоянная — в карточке ученика; у конкретного урока можно задать свою
-- ============================================================
ALTER TABLE students ADD COLUMN call_link TEXT;
ALTER TABLE lessons  ADD COLUMN call_link TEXT;

-- ============================================================
-- Библиотека: теория (видят ученики) и задачник (только преподаватель)
-- ============================================================
CREATE TABLE library_items (
  id           SERIAL PRIMARY KEY,
  kind         VARCHAR(10)  NOT NULL CHECK (kind IN ('theory', 'task')),
  subject      VARCHAR(100) NOT NULL DEFAULT 'Английский язык',
  title        VARCHAR(255) NOT NULL,
  body         TEXT,                       -- текст теории / условие задачи
  answer       TEXT,                       -- ответ или решение (видит только преподаватель)
  exam         VARCHAR(10)  CHECK (exam IN ('ОГЭ', 'ЕГЭ', 'ВПР')),
  exam_task    SMALLINT     CHECK (exam_task BETWEEN 1 AND 50),
  tags         TEXT[]       NOT NULL DEFAULT '{}',
  tutor_note   TEXT,                       -- заметка для себя: «нужна для 13 задания ОГЭ»
  links        TEXT[]       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_library_kind ON library_items(kind, subject);
CREATE INDEX idx_library_tags ON library_items USING GIN (tags);

-- Задачи, выбранные для урока (показываются ученику в комнате урока)
CREATE TABLE lesson_items (
  lesson_id  INTEGER  NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  item_id    INTEGER  NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  position   INTEGER  NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, item_id)
);

-- Задачи из задачника внутри домашнего задания
ALTER TABLE assignments ADD COLUMN library_item_ids INTEGER[] NOT NULL DEFAULT '{}';

-- Файлы к материалам библиотеки
ALTER TABLE files ADD COLUMN library_item_id INTEGER REFERENCES library_items(id) ON DELETE CASCADE;
ALTER TABLE files DROP CONSTRAINT files_check;
ALTER TABLE files ADD CONSTRAINT files_one_owner CHECK (num_nonnulls(assignment_id, homework_id, library_item_id) = 1);
CREATE INDEX idx_files_library ON files(library_item_id);

-- ============================================================
-- Telegram: привязка аккаунтов и отправка итогов урока
-- ============================================================
CREATE TABLE telegram_links (
  user_id    INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id    BIGINT      NOT NULL,
  username   VARCHAR(100),
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE telegram_link_codes (
  code        VARCHAR(40) PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

ALTER TABLE lessons ADD COLUMN summary_sent_at TIMESTAMPTZ;

COMMIT;
