-- Independent adult learners; existing tutor/student/parent records are retained.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK(role IN ('tutor','student','parent','learner'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_terms_version integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_terms_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS learning_terms_ip varchar(64);
ALTER TABLE marketplace_courses ADD COLUMN IF NOT EXISTS audience varchar(16) NOT NULL DEFAULT 'both' CHECK(audience IN ('both','self','tutor'));
ALTER TABLE marketplace_courses ADD COLUMN IF NOT EXISTS outcomes jsonb NOT NULL DEFAULT '[]';
ALTER TABLE marketplace_enrollments ADD COLUMN IF NOT EXISTS last_module integer NOT NULL DEFAULT 0;
ALTER TABLE marketplace_enrollments ADD COLUMN IF NOT EXISTS last_unit integer NOT NULL DEFAULT 0;
ALTER TABLE marketplace_enrollments ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
CREATE TABLE IF NOT EXISTS marketplace_drafts (
 enrollment_id integer NOT NULL REFERENCES marketplace_enrollments(id) ON DELETE CASCADE,
 module_index integer NOT NULL, unit_index integer NOT NULL,
 answers jsonb NOT NULL DEFAULT '{}',response text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT NOW(),
 PRIMARY KEY(enrollment_id,module_index,unit_index)
);
