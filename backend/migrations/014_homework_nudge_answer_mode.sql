-- 014: напоминание преподавателю выдать ДЗ после урока и способ ответа в задании
-- Сервер применяет этот файл сам при запуске (services/migrate.js)
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS hw_reminded_at TIMESTAMPTZ;
-- Как ученик отвечает: both (текст и файлы), text (только текст), files (только файлы), none (ответ не нужен)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS answer_mode VARCHAR(10) NOT NULL DEFAULT 'both';
