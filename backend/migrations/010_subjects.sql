-- 010_subjects.sql — платформа для любых предметов: предмет репетитора и предмет ученика
-- Применять один раз, после 009_growth.sql

BEGIN;

-- Основной предмет репетитора: от него зависят словарь или термины, тест уровня, подсказки
ALTER TABLE users ADD COLUMN subject VARCHAR(100);
UPDATE users SET subject = 'Английский язык' WHERE role = 'tutor' AND subject IS NULL;

-- Предмет ученика, если репетитор ведёт несколько (пусто: основной предмет репетитора)
ALTER TABLE students ADD COLUMN subject VARCHAR(100);

COMMIT;
