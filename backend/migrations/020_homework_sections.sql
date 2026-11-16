-- Личный раздел работы ученика. Старые работы продолжают наследовать раздел задания.
-- Явный перенос в «Без раздела» должен отличаться от наследования.
ALTER TABLE homework ADD COLUMN IF NOT EXISTS section_id INTEGER REFERENCES study_sections(id) ON DELETE SET NULL;
ALTER TABLE homework ADD COLUMN IF NOT EXISTS section_overridden BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS homework_personal_section_idx ON homework(section_id,student_id) WHERE section_overridden;
