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
UPDATE settings SET key = 'booking:' || (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE key = 'booking';

-- Регистрация новых репетиторов: включается и выключается сисадмином
INSERT INTO settings (key, value) VALUES ('registration', '{"open": true}') ON CONFLICT (key) DO NOTHING;

COMMIT;
