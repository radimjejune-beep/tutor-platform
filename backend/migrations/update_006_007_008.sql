-- Обновление до v7: миграции 006, 007 и 008 подряд. Выполнить один раз целиком в Adminer → «SQL-запрос»

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

-- 008_tutors.sql — несколько репетиторов на одной платформе и роль сисадмина
-- У каждого репетитора свои ученики, группы, библиотека, курсы, задания, настройки записи и документы.
-- Всё, что уже есть в базе, закрепляется за первым репетитором (вами). Он же становится сисадмином.
-- Применять один раз, после 007_html_notifications.sql

BEGIN;

-- Сисадмин: создаёт учётки репетиторов, может их отключить. Чужие данные не видит
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
-- Ученик и родитель принадлежат своему репетитору
ALTER TABLE users ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE users SET is_admin = TRUE WHERE id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE users SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE role IN ('student', 'parent');

-- Владелец данных
ALTER TABLE students        ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE groups          ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE library_items   ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courses         ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assignments     ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE availability    ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE legal_documents ADD COLUMN tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE students        SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE groups          SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE library_items   SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE courses         SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE assignments     SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE availability    SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');
UPDATE legal_documents SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor');

ALTER TABLE students        ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE groups          ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE library_items   ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE courses         ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE assignments     ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE availability    ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE legal_documents ALTER COLUMN tutor_id SET NOT NULL;

CREATE INDEX idx_students_tutor    ON students(tutor_id, status);
CREATE INDEX idx_groups_tutor      ON groups(tutor_id);
CREATE INDEX idx_library_tutor     ON library_items(tutor_id, kind);
CREATE INDEX idx_courses_tutor     ON courses(tutor_id);
CREATE INDEX idx_assignments_tutor ON assignments(tutor_id);
CREATE INDEX idx_users_tutor       ON users(tutor_id);

-- Версии документов теперь свои у каждого репетитора
ALTER TABLE legal_documents DROP CONSTRAINT legal_documents_kind_version_key;
ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_tutor_kind_version_key UNIQUE (tutor_id, kind, version);

-- Настройки записи: ключ «booking:<id репетитора>»
UPDATE settings SET key = 'booking:' || (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE key = 'booking'
  AND EXISTS (SELECT 1 FROM users WHERE role = 'tutor');
-- В пустой базе репетиторов ещё нет: общие настройки просто убираем, у каждого будут свои
DELETE FROM settings WHERE key = 'booking';

-- Регистрация новых репетиторов: включается и выключается сисадмином
INSERT INTO settings (key, value) VALUES ('registration', '{"open": true}') ON CONFLICT (key) DO NOTHING;

COMMIT;
