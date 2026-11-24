ALTER TABLE student_subjects ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE student_subjects ADD COLUMN course_unit_id INTEGER REFERENCES course_units(id) ON DELETE SET NULL;
UPDATE student_subjects ss SET course_id=s.course_id,course_unit_id=s.course_unit_id FROM students s JOIN users u ON u.id=s.tutor_id WHERE ss.student_id=s.id AND ss.subject=COALESCE(s.subject,u.subject,'Английский язык');
ALTER TABLE booking_requests ADD COLUMN subject VARCHAR(255);
UPDATE booking_requests b SET subject=COALESCE((SELECT l.subject FROM lessons l WHERE l.id=b.lesson_id),(SELECT COALESCE(s.subject,u.subject,'Английский язык') FROM students s JOIN users u ON u.id=s.tutor_id WHERE s.id=b.student_id));
