CREATE TABLE grammar_notebook_pages (
 id SERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
 subject VARCHAR(255) NOT NULL,
 title VARCHAR(200) NOT NULL,
 content JSONB NOT NULL DEFAULT '[]',
 source_topic_id VARCHAR(80),
 published BOOLEAN NOT NULL DEFAULT false,
 version INTEGER NOT NULL DEFAULT 1,
 request_key UUID,
 request_hash TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (jsonb_typeof(content)='array'),
 CHECK (student_id IS NOT NULL OR NOT published)
);
CREATE UNIQUE INDEX grammar_notebook_request ON grammar_notebook_pages(tutor_id,request_key) WHERE request_key IS NOT NULL;
CREATE INDEX grammar_notebook_student ON grammar_notebook_pages(student_id,subject,updated_at DESC);
ALTER TABLE files ADD COLUMN grammar_page_id INTEGER REFERENCES grammar_notebook_pages(id) ON DELETE CASCADE;
ALTER TABLE files DROP CONSTRAINT files_one_owner;
ALTER TABLE files ADD CONSTRAINT files_one_owner CHECK (num_nonnulls(assignment_id,homework_id,library_item_id,grammar_page_id)=1);
CREATE INDEX files_grammar_page ON files(grammar_page_id);
