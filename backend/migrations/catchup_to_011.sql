-- catchup_to_011.sql — догоняет базу до версии 011 из любого состояния после 004.
-- Можно запускать сколько угодно раз: то, что уже есть, пропускается, данные не трогаются.
-- Заменяет update_006_007_008.sql, 009, 010 и 011: если какие-то из них уже выполнены, ничего страшного.

BEGIN;

-- ============================ 005: упражнения и их результаты ============================
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS game JSONB;
CREATE TABLE IF NOT EXISTS game_results (
  id            SERIAL PRIMARY KEY,
  item_id       INTEGER     NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  student_id    INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  user_id       INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  homework_id   INTEGER     REFERENCES homework(id) ON DELETE SET NULL,
  lesson_id     INTEGER     REFERENCES lessons(id) ON DELETE SET NULL,
  correct       INTEGER     NOT NULL,
  total         INTEGER     NOT NULL,
  score         INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
  details       JSONB       NOT NULL DEFAULT '[]',
  duration_sec  INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_results_student ON game_results(student_id, item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_results_homework ON game_results(homework_id);
CREATE INDEX IF NOT EXISTS idx_game_results_lesson ON game_results(lesson_id);

-- ============================ 006: курсы и словарь ============================
CREATE TABLE IF NOT EXISTS courses (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(255) NOT NULL,
  subject      VARCHAR(100) NOT NULL DEFAULT 'Английский язык',
  level        VARCHAR(50),
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_units (
  id                 SERIAL PRIMARY KEY,
  course_id          INTEGER      NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position           INTEGER      NOT NULL DEFAULT 0,
  code               VARCHAR(20),
  title              VARCHAR(255) NOT NULL,
  goals              TEXT,
  item_ids           INTEGER[]    NOT NULL DEFAULT '{}',
  homework_item_ids  INTEGER[]    NOT NULL DEFAULT '{}',
  vocab              JSONB        NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_units_course ON course_units(course_id, position);

ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id      INTEGER REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_unit_id INTEGER REFERENCES course_units(id) ON DELETE SET NULL;
ALTER TABLE lessons  ADD COLUMN IF NOT EXISTS unit_id        INTEGER REFERENCES course_units(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS vocab_items (
  id                SERIAL PRIMARY KEY,
  student_id        INTEGER      NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  term              VARCHAR(200) NOT NULL,
  translation       VARCHAR(300),
  example           TEXT,
  source            VARCHAR(20)  NOT NULL DEFAULT 'tutor' CHECK (source IN ('tutor', 'unit', 'mistake')),
  unit_id           INTEGER      REFERENCES course_units(id) ON DELETE SET NULL,
  box               SMALLINT     NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),
  due_on            DATE         NOT NULL DEFAULT CURRENT_DATE,
  reviews           INTEGER      NOT NULL DEFAULT 0,
  lapses            INTEGER      NOT NULL DEFAULT 0,
  last_reviewed_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_unique ON vocab_items(student_id, lower(term));
CREATE INDEX IF NOT EXISTS idx_vocab_due ON vocab_items(student_id, due_on);

-- ============================ 007: HTML-уроки, уведомления, группы ============================
ALTER TABLE library_items DROP CONSTRAINT IF EXISTS library_items_kind_check;
ALTER TABLE library_items ADD CONSTRAINT library_items_kind_check CHECK (kind IN ('theory', 'task', 'game', 'html'));
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS html TEXT;

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        VARCHAR(30)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  link        VARCHAR(255),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS groups (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  level             VARCHAR(50),
  default_price     INTEGER      NOT NULL DEFAULT 0,
  default_duration  INTEGER      NOT NULL DEFAULT 60,
  call_link         TEXT,
  board_link        TEXT,
  notes             TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id    INTEGER     NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id  INTEGER     NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_group ON lessons(group_id, starts_at);

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS vocab_practice JSONB;
ALTER TABLE homework    ADD COLUMN IF NOT EXISTS vocab_result JSONB;

-- ============================ 008: несколько репетиторов ============================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Сисадмин: первый репетитор, только если сисадмина ещё нет
UPDATE users SET is_admin = TRUE
 WHERE id = (SELECT MIN(id) FROM users WHERE role = 'tutor')
   AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin);
-- Владелец заполняется только там, где он ещё пустой (уже закреплённые данные не трогаем)
UPDATE users SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE role IN ('student', 'parent') AND tutor_id IS NULL;

ALTER TABLE students        ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE groups          ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE library_items   ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courses         ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE assignments     ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE availability    ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE legal_documents ADD COLUMN IF NOT EXISTS tutor_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

UPDATE students        SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE groups          SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE library_items   SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE courses         SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE assignments     SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE availability    SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;
UPDATE legal_documents SET tutor_id = (SELECT MIN(id) FROM users WHERE role = 'tutor') WHERE tutor_id IS NULL;

ALTER TABLE students        ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE groups          ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE library_items   ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE courses         ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE assignments     ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE availability    ALTER COLUMN tutor_id SET NOT NULL;
ALTER TABLE legal_documents ALTER COLUMN tutor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_tutor    ON students(tutor_id, status);
CREATE INDEX IF NOT EXISTS idx_groups_tutor      ON groups(tutor_id);
CREATE INDEX IF NOT EXISTS idx_library_tutor     ON library_items(tutor_id, kind);
CREATE INDEX IF NOT EXISTS idx_courses_tutor     ON courses(tutor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_tutor ON assignments(tutor_id);
CREATE INDEX IF NOT EXISTS idx_users_tutor       ON users(tutor_id);

ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_kind_version_key;
ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_tutor_kind_version_key;
ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_tutor_kind_version_key UNIQUE (tutor_id, kind, version);

-- Настройки записи: старый общий ключ «booking» становится ключом первого репетитора
UPDATE settings SET key = 'booking:' || (SELECT MIN(id) FROM users WHERE role = 'tutor')
 WHERE key = 'booking'
   AND EXISTS (SELECT 1 FROM users WHERE role = 'tutor')
   AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'booking:' || (SELECT MIN(id) FROM users WHERE role = 'tutor'));
DELETE FROM settings WHERE key = 'booking';
INSERT INTO settings (key, value) VALUES ('registration', '{"open": true}') ON CONFLICT (key) DO NOTHING;

-- ============================ 009: мотивация, заявки, каталог ============================
CREATE TABLE IF NOT EXISTS student_activity (
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day         DATE    NOT NULL DEFAULT CURRENT_DATE,
  points      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, day)
);
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS warmup_result JSONB;

CREATE TABLE IF NOT EXISTS leads (
  id              SERIAL PRIMARY KEY,
  tutor_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  contact         VARCHAR(255) NOT NULL,
  age_group       VARCHAR(10)  NOT NULL DEFAULT 'adult' CHECK (age_group IN ('adult', 'teen', 'child')),
  goal            TEXT,
  preferred_time  TEXT,
  level           VARCHAR(10),
  test_score      INTEGER,
  test_total      INTEGER,
  status          VARCHAR(20)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'student', 'rejected')),
  student_id      INTEGER      REFERENCES students(id) ON DELETE SET NULL,
  consent_at      TIMESTAMPTZ  NOT NULL,
  ip              VARCHAR(64),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_tutor ON leads(tutor_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS market_items (
  id           SERIAL PRIMARY KEY,
  author_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      INTEGER      NOT NULL UNIQUE REFERENCES library_items(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  level        VARCHAR(50),
  price        INTEGER      NOT NULL DEFAULT 0 CHECK (price >= 0),
  published    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS market_orders (
  id              SERIAL PRIMARY KEY,
  market_item_id  INTEGER     NOT NULL REFERENCES market_items(id) ON DELETE CASCADE,
  buyer_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'granted', 'declined')),
  copied_item_id  INTEGER     REFERENCES library_items(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at      TIMESTAMPTZ,
  UNIQUE (market_item_id, buyer_id)
);

-- ============================ 010: любой предмет ============================
ALTER TABLE users    ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
UPDATE users SET subject = 'Английский язык' WHERE role = 'tutor' AND subject IS NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS subject VARCHAR(100);

-- ============================ 011: комментарии к работам ============================
CREATE TABLE IF NOT EXISTS homework_comments (
  id           SERIAL PRIMARY KEY,
  homework_id  INTEGER      NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  user_id      INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT         NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_homework_comments ON homework_comments(homework_id, created_at);

COMMIT;

-- Проверка: сверяет каждую колонку, которая нужна платформе. Должна остаться одна строка «Всё на месте»
WITH expected(t, c) AS (VALUES ('assignments','id'),('assignments','title'),('assignments','description'),('assignments','links'),('assignments','due_on'),('assignments','questions'),('assignments','created_at'),('assignments','library_item_ids'),('assignments','vocab_practice'),('assignments','tutor_id'),('availability','id'),('availability','weekday'),('availability','starts'),('availability','ends'),('availability','tutor_id'),('booking_requests','id'),('booking_requests','student_id'),('booking_requests','kind'),('booking_requests','lesson_id'),('booking_requests','starts_at'),('booking_requests','duration_min'),('booking_requests','status'),('booking_requests','comment'),('booking_requests','tutor_comment'),('booking_requests','requested_by'),('booking_requests','created_at'),('booking_requests','decided_at'),('course_units','id'),('course_units','course_id'),('course_units','position'),('course_units','code'),('course_units','title'),('course_units','goals'),('course_units','item_ids'),('course_units','homework_item_ids'),('course_units','vocab'),('course_units','created_at'),('courses','id'),('courses','title'),('courses','subject'),('courses','level'),('courses','description'),('courses','created_at'),('courses','tutor_id'),('document_acceptances','id'),('document_acceptances','user_id'),('document_acceptances','document_id'),('document_acceptances','accepted_at'),('document_acceptances','ip'),('document_acceptances','user_agent'),('files','id'),('files','assignment_id'),('files','homework_id'),('files','filename'),('files','mime'),('files','size_bytes'),('files','data'),('files','uploaded_by'),('files','created_at'),('files','library_item_id'),('game_results','id'),('game_results','item_id'),('game_results','student_id'),('game_results','user_id'),('game_results','homework_id'),('game_results','lesson_id'),('game_results','correct'),('game_results','total'),('game_results','score'),('game_results','details'),('game_results','duration_sec'),('game_results','created_at'),('group_members','group_id'),('group_members','student_id'),('group_members','joined_at'),('groups','id'),('groups','name'),('groups','level'),('groups','default_price'),('groups','default_duration'),('groups','call_link'),('groups','board_link'),('groups','notes'),('groups','status'),('groups','created_at'),('groups','tutor_id'),('homework','id'),('homework','student_id'),('homework','lesson_id'),('homework','status'),('homework','student_answer'),('homework','submitted_at'),('homework','tutor_feedback'),('homework','score'),('homework','created_at'),('homework','assignment_id'),('homework','quiz_answers'),('homework','quiz_score'),('homework','vocab_result'),('homework_comments','id'),('homework_comments','homework_id'),('homework_comments','user_id'),('homework_comments','body'),('homework_comments','created_at'),('leads','id'),('leads','tutor_id'),('leads','full_name'),('leads','contact'),('leads','age_group'),('leads','goal'),('leads','preferred_time'),('leads','level'),('leads','test_score'),('leads','test_total'),('leads','status'),('leads','student_id'),('leads','consent_at'),('leads','ip'),('leads','created_at'),('legal_documents','id'),('legal_documents','kind'),('legal_documents','version'),('legal_documents','title'),('legal_documents','body'),('legal_documents','published_at'),('legal_documents','tutor_id'),('lesson_items','lesson_id'),('lesson_items','item_id'),('lesson_items','position'),('lessons','id'),('lessons','student_id'),('lessons','starts_at'),('lessons','duration_min'),('lessons','status'),('lessons','price'),('lessons','subscription_id'),('lessons','charged'),('lessons','topic'),('lessons','summary'),('lessons','private_notes'),('lessons','created_at'),('lessons','cancelled_by_client_at'),('lessons','call_link'),('lessons','summary_sent_at'),('lessons','unit_id'),('lessons','group_id'),('lessons','warmup_result'),('library_items','id'),('library_items','kind'),('library_items','subject'),('library_items','title'),('library_items','body'),('library_items','answer'),('library_items','exam'),('library_items','exam_task'),('library_items','tags'),('library_items','tutor_note'),('library_items','links'),('library_items','created_at'),('library_items','updated_at'),('library_items','game'),('library_items','html'),('library_items','tutor_id'),('library_items','favorite'),('market_items','id'),('market_items','author_id'),('market_items','item_id'),('market_items','title'),('market_items','description'),('market_items','level'),('market_items','price'),('market_items','published'),('market_items','created_at'),('market_orders','id'),('market_orders','market_item_id'),('market_orders','buyer_id'),('market_orders','status'),('market_orders','copied_item_id'),('market_orders','created_at'),('market_orders','decided_at'),('monthly_reports','id'),('monthly_reports','student_id'),('monthly_reports','month'),('monthly_reports','summary'),('monthly_reports','strengths'),('monthly_reports','to_improve'),('monthly_reports','plan_next'),('monthly_reports','published'),('monthly_reports','published_at'),('monthly_reports','created_at'),('notifications','id'),('notifications','user_id'),('notifications','kind'),('notifications','title'),('notifications','body'),('notifications','link'),('notifications','read_at'),('notifications','created_at'),('parent_students','parent_user_id'),('parent_students','student_id'),('payments','id'),('payments','student_id'),('payments','subscription_id'),('payments','amount'),('payments','paid_on'),('payments','method'),('payments','receipt_url'),('payments','comment'),('payments','created_at'),('progress_topics','id'),('progress_topics','student_id'),('progress_topics','section'),('progress_topics','title'),('progress_topics','skill'),('progress_topics','status'),('progress_topics','sort_order'),('progress_topics','completed_on'),('progress_topics','created_at'),('settings','key'),('settings','value'),('settings','updated_at'),('student_activity','student_id'),('student_activity','day'),('student_activity','points'),('students','id'),('students','user_id'),('students','full_name'),('students','category'),('students','level'),('students','goal'),('students','textbook'),('students','default_price'),('students','default_duration'),('students','board_link'),('students','notes'),('students','status'),('students','pd_consent_at'),('students','created_at'),('students','call_link'),('students','course_id'),('students','course_unit_id'),('students','tutor_id'),('students','subject'),('subscriptions','id'),('subscriptions','student_id'),('subscriptions','title'),('subscriptions','lessons_total'),('subscriptions','price_total'),('subscriptions','starts_on'),('subscriptions','expires_on'),('subscriptions','status'),('subscriptions','created_at'),('telegram_link_codes','code'),('telegram_link_codes','user_id'),('telegram_link_codes','expires_at'),('telegram_links','user_id'),('telegram_links','chat_id'),('telegram_links','username'),('telegram_links','linked_at'),('users','id'),('users','role'),('users','login'),('users','password_hash'),('users','full_name'),('users','is_active'),('users','must_change_password'),('users','created_at'),('users','last_login_at'),('users','is_admin'),('users','tutor_id'),('users','subject'),('vocab_items','id'),('vocab_items','student_id'),('vocab_items','term'),('vocab_items','translation'),('vocab_items','example'),('vocab_items','source'),('vocab_items','unit_id'),('vocab_items','box'),('vocab_items','due_on'),('vocab_items','reviews'),('vocab_items','lapses'),('vocab_items','last_reviewed_at'),('vocab_items','created_at')),
missing AS (
  SELECT e.t, e.c FROM expected e
  LEFT JOIN information_schema.columns ic ON ic.table_schema = 'public' AND ic.table_name = e.t AND ic.column_name = e.c
  WHERE ic.column_name IS NULL
)
SELECT t AS "таблица", c AS "чего не хватает" FROM missing
UNION ALL
SELECT 'Всё на месте', 'база готова' WHERE NOT EXISTS (SELECT 1 FROM missing);
