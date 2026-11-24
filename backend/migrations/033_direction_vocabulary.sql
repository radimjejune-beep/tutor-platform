ALTER TABLE vocab_items ADD COLUMN subject VARCHAR(255);
UPDATE vocab_items v SET subject=COALESCE((SELECT c.subject FROM course_units u JOIN courses c ON c.id=u.course_id WHERE u.id=v.unit_id),(SELECT COALESCE(s.subject,t.subject,'Английский язык') FROM students s JOIN users t ON t.id=s.tutor_id WHERE s.id=v.student_id));
ALTER TABLE vocab_items ALTER COLUMN subject SET NOT NULL;
DROP INDEX idx_vocab_unique;
CREATE UNIQUE INDEX idx_vocab_unique ON vocab_items(student_id,subject,lower(term));
CREATE TRIGGER vocab_study_subject BEFORE INSERT ON vocab_items FOR EACH ROW EXECUTE FUNCTION fill_study_subject();
ALTER TABLE word_sets ADD COLUMN subject VARCHAR(255);
UPDATE word_sets w SET subject=COALESCE((SELECT u.subject FROM users u WHERE u.id=w.tutor_id),'Английский язык');
ALTER TABLE word_sets ALTER COLUMN subject SET NOT NULL;
CREATE FUNCTION fill_wordset_subject() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.subject IS NULL OR trim(NEW.subject)='' THEN SELECT COALESCE(subject,'Английский язык') INTO NEW.subject FROM users WHERE id=NEW.tutor_id; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER wordset_study_subject BEFORE INSERT ON word_sets FOR EACH ROW EXECUTE FUNCTION fill_wordset_subject();
