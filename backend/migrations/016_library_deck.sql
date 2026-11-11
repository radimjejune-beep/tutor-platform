-- 016: интерактивные уроки из конструктора (kind = 'deck', слайды в столбце html как JSON)
ALTER TABLE library_items DROP CONSTRAINT IF EXISTS library_items_kind_check;
ALTER TABLE library_items ADD CONSTRAINT library_items_kind_check CHECK (kind IN ('theory', 'task', 'game', 'html', 'deck'));
