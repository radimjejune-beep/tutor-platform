-- Новые функции не удаляют курсы/покупки из 027 и не конвертируют старые цены.
ALTER TABLE marketplace_courses ALTER COLUMN currency SET DEFAULT 'RUB';
ALTER TABLE marketplace_courses ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE course_purchases ADD COLUMN IF NOT EXISTS content_snapshot JSONB;
CREATE TABLE billing_profiles(
 tutor_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
 period VARCHAR(10) CHECK(period IN ('month','year')),
 payment_method_cipher TEXT,
 payment_method_label TEXT,
 next_charge_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 latest_intent_order_id TEXT,
 consent_order_id TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE billing_grants(
 id SERIAL PRIMARY KEY,
 tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 order_id TEXT NOT NULL UNIQUE,
 period VARCHAR(10) NOT NULL CHECK(period IN ('month','year')),
 starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at>starts_at),
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX billing_grants_tutor ON billing_grants(tutor_id,starts_at);
CREATE TABLE billing_audit(
 id SERIAL PRIMARY KEY,tutor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 event VARCHAR(40) NOT NULL,order_id TEXT,details JSONB NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE marketplace_enrollments(
 id SERIAL PRIMARY KEY,purchase_id INTEGER NOT NULL REFERENCES course_purchases(id) ON DELETE CASCADE,
 student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
 user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK((student_id IS NULL)<>(user_id IS NULL)),
 UNIQUE(purchase_id,student_id),UNIQUE(purchase_id,user_id)
);
CREATE TABLE marketplace_attempts(
 id SERIAL PRIMARY KEY,enrollment_id INTEGER NOT NULL REFERENCES marketplace_enrollments(id) ON DELETE CASCADE,
 module_index INTEGER NOT NULL CHECK(module_index>=0),unit_index INTEGER NOT NULL CHECK(unit_index>=0),
 answers JSONB NOT NULL DEFAULT '{}',result JSONB,response TEXT,
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ,comment TEXT,
 UNIQUE(enrollment_id,module_index,unit_index)
);
-- Для DELETE используется OLD; пустой рейтинг возвращается к нулю.
CREATE OR REPLACE FUNCTION update_course_rating() RETURNS TRIGGER AS $$
DECLARE target INTEGER;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.course_id ELSE NEW.course_id END;
 UPDATE marketplace_courses SET rating=COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM course_reviews WHERE course_id=target AND is_visible),0),
 reviews_count=(SELECT COUNT(*) FROM course_reviews WHERE course_id=target AND is_visible),updated_at=NOW() WHERE id=target;
 IF TG_OP='UPDATE' AND OLD.course_id<>NEW.course_id THEN
  UPDATE marketplace_courses SET rating=COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM course_reviews WHERE course_id=OLD.course_id AND is_visible),0),
  reviews_count=(SELECT COUNT(*) FROM course_reviews WHERE course_id=OLD.course_id AND is_visible) WHERE id=OLD.course_id;
 END IF;
 RETURN NULL;
END;$$ LANGUAGE plpgsql;
-- Магазин работает в своей схеме. Триггеры 027 должны обращаться к таблицам платформы.
ALTER FUNCTION public.update_course_rating() SET search_path=public,pg_catalog;
ALTER FUNCTION public.update_course_sales() SET search_path=public,pg_catalog;
ALTER TABLE marketplace_courses ADD COLUMN IF NOT EXISTS rights_confirmed_at TIMESTAMPTZ;
ALTER TABLE marketplace_courses ADD COLUMN IF NOT EXISTS rights_confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
