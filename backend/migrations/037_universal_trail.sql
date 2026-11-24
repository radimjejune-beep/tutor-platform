-- Teacher-controlled climbing for every subject; previous heights are preserved.
ALTER TABLE student_trails ADD COLUMN mode VARCHAR(12) NOT NULL DEFAULT 'mixed' CHECK(mode IN ('auto','manual','mixed'));
ALTER TABLE student_trails ADD COLUMN obstacle VARCHAR(12) NOT NULL DEFAULT 'camp' CHECK(obstacle IN ('camp','dragon'));
ALTER TABLE student_trails ADD COLUMN auto_from TIMESTAMPTZ;
UPDATE student_trails SET auto_from=started_at;
ALTER TABLE trail_events ADD COLUMN steps INTEGER NOT NULL DEFAULT 1 CHECK(steps BETWEEN 1 AND 20);
ALTER TABLE trail_events ADD COLUMN actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trail_events DROP CONSTRAINT trail_events_kind_check;
ALTER TABLE trail_events ADD CONSTRAINT trail_events_kind_check CHECK(kind IN ('homework','writing','workout','skill','manual','topic'));
ALTER TABLE progress_topics ADD COLUMN evidence_kind VARCHAR(20);
ALTER TABLE progress_topics ADD COLUMN evidence_id INTEGER;
ALTER TABLE progress_topics ADD COLUMN evidence_note TEXT;
ALTER TABLE progress_topics ADD COLUMN evidence_at TIMESTAMPTZ;
ALTER TABLE progress_topics ADD CONSTRAINT topic_evidence_pair CHECK((evidence_kind IS NULL AND evidence_id IS NULL) OR (evidence_kind IN ('homework','writing','diagnostic','workout') AND evidence_id>0));

ALTER TABLE progress_topics DROP CONSTRAINT progress_topics_skill_check;
ALTER TABLE progress_topics ADD CONSTRAINT progress_topics_skill_check CHECK(skill IN ('grammar','vocabulary','speaking','listening','reading','writing','concepts','problem_solving','practical','other'));
