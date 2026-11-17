ALTER TABLE course_units ADD COLUMN practice_packs JSONB;
CREATE TABLE course_template_installs (
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 template_key VARCHAR(80) NOT NULL,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 PRIMARY KEY(tutor_id,template_key)
);
CREATE TABLE supplementary_enrollments (
 id SERIAL PRIMARY KEY,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(student_id,course_id)
);
CREATE TABLE supplementary_assignments (
 id SERIAL PRIMARY KEY,
 enrollment_id INTEGER NOT NULL REFERENCES supplementary_enrollments(id) ON DELETE CASCADE,
 unit_id INTEGER REFERENCES course_units(id) ON DELETE SET NULL,
 stage VARCHAR(20) NOT NULL CHECK(stage IN ('learn','practice','check','all')),
 assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
 request_key UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(enrollment_id,request_key)
);
