-- 001_init.sql — начальная схема платформы репетитора
-- Применять один раз (через Adminer или psql). Проверка после применения — в конце файла.

BEGIN;

-- ============================================================
-- Пользователи: репетитор, ученики, родители
-- Вход по логину (латиница, генерируется из имени) и паролю. Email и телефон не собираем.
-- ============================================================
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  role                  VARCHAR(20)  NOT NULL CHECK (role IN ('tutor', 'student', 'parent')),
  login                 VARCHAR(64)  NOT NULL UNIQUE CHECK (login ~ '^[a-z0-9._-]{3,64}$'),
  password_hash         VARCHAR(255) NOT NULL,
  full_name             VARCHAR(255) NOT NULL,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  must_change_password  BOOLEAN      NOT NULL DEFAULT FALSE, -- TRUE — попросить сменить пароль при входе
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at         TIMESTAMPTZ
);

-- ============================================================
-- Ученики (карточка). У ребёнка может не быть своего входа — тогда user_id пустой
-- ============================================================
CREATE TABLE students (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  full_name         VARCHAR(255) NOT NULL,
  category          VARCHAR(20)  NOT NULL DEFAULT 'adult' CHECK (category IN ('adult', 'teen', 'child')),
  level             VARCHAR(50),                 -- A1, A2, B1...
  goal              TEXT,                        -- «экзамен по юр. английскому», «разговорный» и т.п.
  textbook          VARCHAR(255),                -- основной учебник
  default_price     INTEGER      NOT NULL DEFAULT 0,  -- цена разового занятия, ₽
  default_duration  INTEGER      NOT NULL DEFAULT 60, -- минут
  board_link        TEXT,                        -- ссылка на доску в Холсте
  notes             TEXT,                        -- заметки репетитора (ученик и родитель НЕ видят)
  status            VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  pd_consent_at     TIMESTAMPTZ,                 -- когда получено согласие на обработку ПДн
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Связь родитель ↔ ученик (у родителя может быть несколько детей)
CREATE TABLE parent_students (
  parent_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_user_id, student_id)
);

-- ============================================================
-- Абонементы: пакет из N занятий за фиксированную сумму
-- ============================================================
CREATE TABLE subscriptions (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title          VARCHAR(255) NOT NULL DEFAULT 'Абонемент',
  lessons_total  INTEGER      NOT NULL CHECK (lessons_total > 0),
  price_total    INTEGER      NOT NULL CHECK (price_total >= 0),  -- ₽
  starts_on      DATE         NOT NULL DEFAULT CURRENT_DATE,
  expires_on     DATE,                                            -- срок действия (необязательно)
  status         VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished', 'cancelled')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Оплаты (с полем для чека из «Мой налог»)
-- ============================================================
CREATE TABLE payments (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subscription_id  INTEGER     REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount           INTEGER     NOT NULL CHECK (amount > 0),  -- ₽
  paid_on          DATE        NOT NULL DEFAULT CURRENT_DATE,
  method           VARCHAR(30) NOT NULL DEFAULT 'transfer' CHECK (method IN ('transfer', 'cash', 'card', 'other')),
  receipt_url      TEXT,       -- ссылка на чек самозанятого
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Занятия
-- scheduled         — запланировано
-- done              — проведено (списывается)
-- cancelled         — отменено вовремя (не списывается)
-- cancelled_late    — поздняя отмена (списывается по правилам)
-- missed            — неявка (списывается)
-- ============================================================
CREATE TABLE lessons (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  starts_at         TIMESTAMPTZ NOT NULL,
  duration_min      INTEGER     NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  status            VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'done', 'cancelled', 'cancelled_late', 'missed')),
  price             INTEGER     NOT NULL DEFAULT 0,      -- цена разового занятия, если нет абонемента
  subscription_id   INTEGER     REFERENCES subscriptions(id) ON DELETE SET NULL, -- из какого абонемента списано
  charged           BOOLEAN     NOT NULL DEFAULT FALSE,  -- списано ли занятие
  topic             VARCHAR(255),                         -- тема (видят ученик и родитель)
  summary           TEXT,                                 -- что сделали на уроке (видят ученик и родитель)
  private_notes     TEXT,                                 -- заметки только для репетитора
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lessons_student_time ON lessons(student_id, starts_at);
CREATE INDEX idx_lessons_time ON lessons(starts_at);

-- ============================================================
-- Домашние задания
-- ============================================================
CREATE TABLE homework (
  id               SERIAL PRIMARY KEY,
  student_id       INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id        INTEGER      REFERENCES lessons(id) ON DELETE SET NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  links            TEXT[]       NOT NULL DEFAULT '{}',   -- Холст, Wordwall, страницы учебника
  due_on           DATE,
  status           VARCHAR(20)  NOT NULL DEFAULT 'assigned'
                   CHECK (status IN ('assigned', 'submitted', 'checked')),
  student_answer   TEXT,         -- ответ / комментарий ученика
  submitted_at     TIMESTAMPTZ,
  tutor_feedback   TEXT,
  score            INTEGER CHECK (score BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_homework_student ON homework(student_id, status);

-- ============================================================
-- Прогресс: темы по учебнику / программе
-- ============================================================
CREATE TABLE progress_topics (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section       VARCHAR(255),                 -- например «Speakout A1 — Unit 3»
  title         VARCHAR(255) NOT NULL,        -- например «Present Simple: questions»
  skill         VARCHAR(20)  NOT NULL DEFAULT 'grammar'
                CHECK (skill IN ('grammar', 'vocabulary', 'speaking', 'listening', 'reading', 'writing')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'in_progress', 'done')),
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  completed_on  DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_progress_student ON progress_topics(student_id, sort_order);

-- ============================================================
-- Ежемесячные отчёты (черновик видит только репетитор)
-- ============================================================
CREATE TABLE monthly_reports (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month         DATE        NOT NULL,             -- первое число месяца
  summary       TEXT,                             -- общий итог
  strengths     TEXT,                             -- что получается
  to_improve    TEXT,                             -- над чем работаем
  plan_next     TEXT,                             -- план на следующий месяц
  published     BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month)
);

COMMIT;

-- Проверка (должно вернуть 9 таблиц):
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
