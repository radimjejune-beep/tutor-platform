-- Совместные упражнения, повторение по результатам и черновики занятий.
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS grammar_key VARCHAR(60);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS grammar_key VARCHAR(60);
CREATE TABLE IF NOT EXISTS live_sessions (
 id SERIAL PRIMARY KEY,
 lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 item_id INTEGER REFERENCES library_items(id) ON DELETE SET NULL,
 request_key UUID NOT NULL,
 title VARCHAR(255) NOT NULL,
 body TEXT,
 game JSONB NOT NULL,
 grammar_key VARCHAR(60),
 status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK(status IN ('active','ended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ended_at TIMESTAMPTZ,
 UNIQUE(lesson_id,request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_active ON live_sessions(lesson_id) WHERE status='active';
CREATE TABLE IF NOT EXISTS live_answers (
 session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 answers JSONB NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,
 client_id UUID,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 submitted_at TIMESTAMPTZ,result JSONB,result_id INTEGER REFERENCES game_results(id) ON DELETE SET NULL,
 PRIMARY KEY(session_id,student_id)
);
CREATE OR REPLACE FUNCTION lessonfold_live_notify() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE lid INTEGER;
BEGIN
 IF TG_TABLE_NAME='live_sessions' THEN lid:=COALESCE(NEW.lesson_id,OLD.lesson_id);
 ELSE SELECT lesson_id INTO lid FROM live_sessions WHERE id=COALESCE(NEW.session_id,OLD.session_id); END IF;
 IF lid IS NOT NULL THEN PERFORM pg_notify('lessonfold_live',lid::text); END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS live_session_notify ON live_sessions;
CREATE TRIGGER live_session_notify AFTER INSERT OR UPDATE OR DELETE ON live_sessions FOR EACH ROW EXECUTE FUNCTION lessonfold_live_notify();
DROP TRIGGER IF EXISTS live_answer_notify ON live_answers;
CREATE TRIGGER live_answer_notify AFTER INSERT OR UPDATE OR DELETE ON live_answers FOR EACH ROW EXECUTE FUNCTION lessonfold_live_notify();
CREATE TABLE IF NOT EXISTS coaching_reviews (
 id SERIAL PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 topic_key VARCHAR(60) NOT NULL,baseline_key VARCHAR(100) NOT NULL,
 mode VARCHAR(10) NOT NULL CHECK(mode IN ('practice','recheck')),
 questions JSONB NOT NULL,answers JSONB NOT NULL DEFAULT '{}',result JSONB,
 available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),submitted_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(student_id,topic_key,baseline_key,mode)
);
CREATE INDEX IF NOT EXISTS coaching_reviews_student ON coaching_reviews(student_id,created_at DESC);
CREATE TABLE IF NOT EXISTS lesson_preparations (
 id UUID PRIMARY KEY,tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 title VARCHAR(255) NOT NULL,duration INTEGER NOT NULL CHECK(duration BETWEEN 20 AND 120),
 stages JSONB NOT NULL,reasons JSONB NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 applied_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
 applied_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lesson_preparations_student ON lesson_preparations(student_id,created_at DESC);
