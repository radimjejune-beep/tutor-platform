-- Ссылки дают доступ только к выбранному материалу. Это не токены входа.
-- Полиморфный источник: bank_items создаётся ensureAll после SQL-миграций.
CREATE TABLE IF NOT EXISTS activity_links (
 id SERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 source_kind VARCHAR(10) NOT NULL CHECK(source_kind IN ('library','bank')),
 source_id INTEGER NOT NULL CHECK(source_id>0),
 token CHAR(64) NOT NULL UNIQUE,
 is_active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(tutor_id,source_kind,source_id)
);
