-- 015: черновик ответа ученика (текст и ответы теста), чтобы не терять работу при уходе со страницы и на другом устройстве
ALTER TABLE homework ADD COLUMN IF NOT EXISTS draft JSONB;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS draft_at TIMESTAMPTZ;
