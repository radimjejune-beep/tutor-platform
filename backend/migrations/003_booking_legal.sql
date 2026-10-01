-- 003_booking_legal.sql — самостоятельная запись/перенос и юридические документы
-- Применять один раз, после 002_assignments.sql

BEGIN;

-- ============================================================
-- Настройки платформы (ключ → JSON)
-- ============================================================
CREATE TABLE settings (
  key         VARCHAR(50) PRIMARY KEY,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('booking', '{"enabled": false, "notice_hours": 24, "horizon_days": 21, "step_min": 30, "closed_dates": []}');

-- ============================================================
-- Окна, когда можно записаться (повторяются каждую неделю)
-- weekday: 1 — понедельник … 7 — воскресенье
-- ============================================================
CREATE TABLE availability (
  id       SERIAL PRIMARY KEY,
  weekday  SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts   TIME     NOT NULL,
  ends     TIME     NOT NULL,
  CHECK (ends > starts)
);

-- ============================================================
-- Запросы учеников: записаться на новое время или перенести занятие
-- Преподаватель подтверждает или отклоняет
-- ============================================================
CREATE TABLE booking_requests (
  id             SERIAL PRIMARY KEY,
  student_id     INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind           VARCHAR(20) NOT NULL CHECK (kind IN ('book', 'reschedule')),
  lesson_id      INTEGER     REFERENCES lessons(id) ON DELETE CASCADE,   -- для переноса
  starts_at      TIMESTAMPTZ NOT NULL,                                   -- желаемое время
  duration_min   INTEGER     NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  comment        TEXT,           -- комментарий ученика
  tutor_comment  TEXT,           -- ответ преподавателя при отказе
  requested_by   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at     TIMESTAMPTZ,
  CHECK (kind = 'book' OR lesson_id IS NOT NULL)
);
CREATE INDEX idx_booking_status ON booking_requests(status, starts_at);

-- Отмена учеником (без списания, если заранее)
ALTER TABLE lessons ADD COLUMN cancelled_by_client_at TIMESTAMPTZ;

-- ============================================================
-- Юридические документы с версиями и их принятие
-- ============================================================
CREATE TABLE legal_documents (
  id            SERIAL PRIMARY KEY,
  kind          VARCHAR(30)  NOT NULL CHECK (kind IN ('offer', 'privacy', 'consent_adult', 'consent_parent')),
  version       INTEGER      NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT         NOT NULL,
  published_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (kind, version)
);

CREATE TABLE document_acceptances (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id  INTEGER      NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  accepted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ip           VARCHAR(64),
  user_agent   VARCHAR(300),
  UNIQUE (user_id, document_id)
);

COMMIT;
