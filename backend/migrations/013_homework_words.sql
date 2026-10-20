-- 013_homework_words.sql: слова к уроку прямо в домашнем задании (набор карточек внутри задания)
-- Можно запускать повторно.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS word_set_id INTEGER REFERENCES word_sets(id) ON DELETE SET NULL;

-- Проверка: должна быть одна строка «да»
SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'assignments' AND column_name = 'word_set_id') THEN 'да' ELSE 'нет' END AS "слова в заданиях";
