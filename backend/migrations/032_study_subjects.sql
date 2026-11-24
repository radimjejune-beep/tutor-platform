-- One person, several study directions. Existing data keeps its primary subject.
CREATE TABLE student_subjects (
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 subject VARCHAR(255) NOT NULL CHECK(length(trim(subject))>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(student_id,subject)
);
CREATE UNIQUE INDEX student_subjects_normalized ON student_subjects(student_id,lower(subject));
INSERT INTO student_subjects(student_id,subject) SELECT s.id,COALESCE(NULLIF(s.subject,''),NULLIF(u.subject,''),'Английский язык') FROM students s JOIN users u ON u.id=s.tutor_id;
ALTER TABLE lessons ADD COLUMN subject VARCHAR(255);
UPDATE lessons l SET subject=ss.subject FROM student_subjects ss WHERE ss.student_id=l.student_id;
ALTER TABLE assignments ADD COLUMN subject VARCHAR(255);
ALTER TABLE homework ADD COLUMN subject VARCHAR(255);
UPDATE homework h SET subject=ss.subject FROM student_subjects ss WHERE ss.student_id=h.student_id;
UPDATE assignments a SET subject=x.subject FROM (SELECT assignment_id,min(subject) AS subject FROM homework GROUP BY assignment_id HAVING count(DISTINCT subject)=1) x WHERE x.assignment_id=a.id;
ALTER TABLE game_results ADD COLUMN subject VARCHAR(255);
UPDATE game_results r SET subject=COALESCE((SELECT h.subject FROM homework h WHERE h.id=r.homework_id),(SELECT l.subject FROM lessons l WHERE l.id=r.lesson_id),(SELECT i.subject FROM library_items i WHERE i.id=r.item_id),(SELECT ss.subject FROM student_subjects ss WHERE ss.student_id=r.student_id LIMIT 1));
ALTER TABLE progress_topics ADD COLUMN subject VARCHAR(255);
UPDATE progress_topics p SET subject=ss.subject FROM student_subjects ss WHERE ss.student_id=p.student_id;
ALTER TABLE writing_threads ADD COLUMN subject VARCHAR(255);
ALTER TABLE personal_workouts ADD COLUMN subject VARCHAR(255) NOT NULL DEFAULT 'Английский язык';
ALTER TABLE personal_workouts DROP CONSTRAINT personal_workouts_student_id_day_key;
ALTER TABLE personal_workouts ADD UNIQUE(student_id,subject,day);
ALTER TABLE student_trails ADD COLUMN subject VARCHAR(255);
UPDATE student_trails p SET subject=ss.subject FROM student_subjects ss WHERE ss.student_id=p.student_id;
ALTER TABLE trail_events DROP CONSTRAINT trail_events_student_id_fkey;
ALTER TABLE student_trails DROP CONSTRAINT student_trails_pkey;
ALTER TABLE student_trails ALTER COLUMN subject SET NOT NULL;
ALTER TABLE student_trails ADD PRIMARY KEY(student_id,subject);
ALTER TABLE trail_events ADD COLUMN subject VARCHAR(255);
UPDATE trail_events e SET subject=p.subject FROM student_trails p WHERE p.student_id=e.student_id;
ALTER TABLE trail_events ALTER COLUMN subject SET NOT NULL;
ALTER TABLE trail_events DROP CONSTRAINT trail_events_student_id_source_key_key;
ALTER TABLE trail_events ADD UNIQUE(student_id,subject,source_key);
ALTER TABLE trail_events ADD FOREIGN KEY(student_id,subject) REFERENCES student_trails(student_id,subject) ON DELETE CASCADE;
CREATE INDEX lessons_subject_time ON lessons(subject,starts_at);
CREATE INDEX homework_student_subject ON homework(student_id,subject);
CREATE INDEX game_results_subject ON game_results(student_id,subject,created_at DESC);

ALTER TABLE diagnostic_runs ADD COLUMN subject VARCHAR(255);
UPDATE diagnostic_runs r SET subject=ss.subject FROM student_subjects ss WHERE ss.student_id=r.student_id;
-- Legacy creation paths (group lessons, course homework) receive a safe subject
-- too. Explicit choices are validated by the application before insertion.
CREATE FUNCTION fill_study_subject() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.subject IS NULL OR trim(NEW.subject)='' THEN
  NEW.subject:=NULL;
  IF TG_TABLE_NAME='homework' THEN
   IF NEW.lesson_id IS NOT NULL THEN SELECT subject INTO NEW.subject FROM lessons WHERE id=NEW.lesson_id AND student_id=NEW.student_id; END IF;
  ELSIF TG_TABLE_NAME='game_results' THEN
   IF NEW.homework_id IS NOT NULL THEN SELECT subject INTO NEW.subject FROM homework WHERE id=NEW.homework_id AND student_id=NEW.student_id; END IF;
   IF NEW.subject IS NULL AND NEW.lesson_id IS NOT NULL THEN SELECT subject INTO NEW.subject FROM lessons WHERE id=NEW.lesson_id AND student_id=NEW.student_id; END IF;
  END IF;
  IF NEW.subject IS NULL THEN SELECT COALESCE(NULLIF(s.subject,''),NULLIF(u.subject,''),'Английский язык') INTO NEW.subject FROM students s JOIN users u ON u.id=s.tutor_id WHERE s.id=NEW.student_id; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER lessons_study_subject BEFORE INSERT ON lessons FOR EACH ROW EXECUTE FUNCTION fill_study_subject();
CREATE TRIGGER homework_study_subject BEFORE INSERT ON homework FOR EACH ROW EXECUTE FUNCTION fill_study_subject();
CREATE TRIGGER game_results_study_subject BEFORE INSERT ON game_results FOR EACH ROW EXECUTE FUNCTION fill_study_subject();
CREATE TRIGGER progress_topics_study_subject BEFORE INSERT ON progress_topics FOR EACH ROW EXECUTE FUNCTION fill_study_subject();
