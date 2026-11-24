ALTER TABLE lesson_preparations ADD COLUMN subject VARCHAR(255);
UPDATE lesson_preparations p SET subject=COALESCE(NULLIF(s.subject,''),NULLIF(u.subject,''),'Английский язык') FROM students s JOIN users u ON u.id=s.tutor_id WHERE s.id=p.student_id;
ALTER TABLE lesson_preparations ALTER COLUMN subject SET NOT NULL;
ALTER TABLE lesson_preparations ALTER COLUMN subject SET DEFAULT 'Английский язык';
