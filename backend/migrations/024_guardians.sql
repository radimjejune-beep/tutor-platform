-- Подтверждение конкретным представителем конкретного ребёнка и версии документа.
CREATE TABLE IF NOT EXISTS guardian_acceptances (
 id BIGSERIAL PRIMARY KEY,
 parent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 document_id INTEGER NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
 relationship VARCHAR(20) NOT NULL CHECK(relationship IN ('parent','guardian')),
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revoked_at TIMESTAMPTZ,
 ip VARCHAR(64), user_agent VARCHAR(300)
);
CREATE UNIQUE INDEX IF NOT EXISTS guardian_acceptances_active ON guardian_acceptances(parent_user_id,student_id,document_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS guardian_acceptances_student ON guardian_acceptances(student_id);
