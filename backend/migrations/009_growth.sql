-- 009_growth.sql — мотивация учеников (очки, серии, лига, разминка), заявки с тестом уровня, каталог уроков
-- Применять один раз, после 008_tutors.sql

BEGIN;

-- Очки ученика по дням: из них считаются серия дней подряд и лига недели
CREATE TABLE student_activity (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day         DATE    NOT NULL DEFAULT CURRENT_DATE,
  points      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, day)
);

-- Избранные задачи: быстро найти на уроке и выдать в ДЗ
ALTER TABLE library_items ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT false;

-- Разминка перед уроком: { "correct": 6, "total": 8, "missed": ["keen on"], "at": "..." }
ALTER TABLE lessons ADD COLUMN warmup_result JSONB;

-- Заявки со страницы записи
CREATE TABLE leads (
  id              SERIAL PRIMARY KEY,
  tutor_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  contact         VARCHAR(255) NOT NULL,           -- телефон или Telegram
  age_group       VARCHAR(10)  NOT NULL DEFAULT 'adult' CHECK (age_group IN ('adult', 'teen', 'child')),
  goal            TEXT,
  preferred_time  TEXT,
  level           VARCHAR(10),                     -- A1 … B2 по тесту
  test_score      INTEGER,
  test_total      INTEGER,
  status          VARCHAR(20)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'student', 'rejected')),
  student_id      INTEGER      REFERENCES students(id) ON DELETE SET NULL,
  consent_at      TIMESTAMPTZ  NOT NULL,           -- согласие на обработку персональных данных
  ip              VARCHAR(64),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_leads_tutor ON leads(tutor_id, status, created_at DESC);

-- Каталог уроков между репетиторами
CREATE TABLE market_items (
  id           SERIAL PRIMARY KEY,
  author_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      INTEGER      NOT NULL UNIQUE REFERENCES library_items(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  level        VARCHAR(50),
  price        INTEGER      NOT NULL DEFAULT 0 CHECK (price >= 0),   -- ₽, 0 — бесплатно
  published    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE market_orders (
  id              SERIAL PRIMARY KEY,
  market_item_id  INTEGER     NOT NULL REFERENCES market_items(id) ON DELETE CASCADE,
  buyer_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'granted', 'declined')),
  copied_item_id  INTEGER     REFERENCES library_items(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at      TIMESTAMPTZ,
  UNIQUE (market_item_id, buyer_id)
);

COMMIT;
