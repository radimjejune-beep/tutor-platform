-- Share sections between pupils of the same teacher and subject, without
-- carrying an English grammar explanation into another direction.
ALTER TABLE study_sections ADD COLUMN subject VARCHAR(255);
UPDATE study_sections ss SET subject=CASE WHEN ss.grammar_key LIKE 'fr-%' THEN 'Французский язык' ELSE COALESCE(NULLIF(u.subject,''),'Английский язык') END FROM users u WHERE u.id=ss.tutor_id;
ALTER TABLE study_sections ALTER COLUMN subject SET NOT NULL;
ALTER TABLE study_sections ALTER COLUMN subject SET DEFAULT 'Английский язык';
DROP INDEX study_sections_title_key;
CREATE UNIQUE INDEX study_sections_title_key ON study_sections(tutor_id,subject,lower(title));
