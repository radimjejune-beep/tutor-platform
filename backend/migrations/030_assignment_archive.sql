-- Teacher workspace archive: does not remove assignments, student work or access.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS assignments_workspace_archive ON assignments(tutor_id,archived_at,created_at DESC);
