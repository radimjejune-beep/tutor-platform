-- 017: вход по почте. Почта необязательна (ученикам логин выдаёт преподаватель), но если указана, то одна на человека
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (LOWER(email)) WHERE email IS NOT NULL;
