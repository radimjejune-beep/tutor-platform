-- Marketplace для продажи курсов

-- Курсы в маркетплейсе (могут быть созданы любым репетитором)
CREATE TABLE marketplace_courses (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  category VARCHAR(50), -- 'english', 'math', 'programming', etc.
  level VARCHAR(30), -- 'beginner', 'intermediate', 'advanced'
  language VARCHAR(10) DEFAULT 'ru', -- язык курса

  -- Структура курса
  modules JSONB NOT NULL DEFAULT '[]', -- [{ title, description, units: [] }]
  total_lessons INTEGER DEFAULT 0,
  estimated_hours INTEGER,

  -- Цены и доступ
  price_type VARCHAR(20) NOT NULL DEFAULT 'free' CHECK(price_type IN ('free','paid','subscription')),
  price_amount INTEGER, -- в копейках/центах
  currency VARCHAR(3) DEFAULT 'USD',
  subscription_period VARCHAR(20), -- 'monthly', 'yearly'

  -- Для репетиторов
  tutor_price INTEGER, -- цена для репетитора при назначении ученику
  commission_rate INTEGER DEFAULT 30, -- процент комиссии платформы

  -- Статус и модерация
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','published','archived')),
  published_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,

  -- Статистика
  total_sales INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0, -- в копейках
  rating DECIMAL(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketplace_courses_author ON marketplace_courses(author_id);
CREATE INDEX idx_marketplace_courses_status ON marketplace_courses(status);
CREATE INDEX idx_marketplace_courses_category ON marketplace_courses(category);
CREATE INDEX idx_marketplace_courses_slug ON marketplace_courses(slug);

-- Покупки курсов
CREATE TABLE course_purchases (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_type VARCHAR(20) NOT NULL CHECK(buyer_type IN ('student','tutor')), -- кто купил

  -- Платёж
  payment_method VARCHAR(30) NOT NULL, -- 'stripe', 'paypal', 'manual'
  payment_id VARCHAR(200), -- ID транзакции в платёжной системе
  amount_paid INTEGER NOT NULL, -- сумма в копейках
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Комиссия
  platform_fee INTEGER, -- комиссия платформы
  author_earnings INTEGER, -- заработок автора

  -- Доступ
  access_type VARCHAR(20) NOT NULL DEFAULT 'lifetime' CHECK(access_type IN ('lifetime','subscription','rental')),
  expires_at TIMESTAMPTZ, -- для подписок и аренды
  is_active BOOLEAN DEFAULT TRUE,

  -- Дополнительно
  assigned_to_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL, -- если репетитор купил для ученика
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_purchases_course ON course_purchases(course_id);
CREATE INDEX idx_course_purchases_buyer ON course_purchases(buyer_id);
CREATE INDEX idx_course_purchases_student ON course_purchases(assigned_to_student_id);
CREATE UNIQUE INDEX idx_course_purchases_active ON course_purchases(course_id, buyer_id, buyer_type) WHERE is_active = TRUE;

-- Прогресс прохождения курса
CREATE TABLE course_progress (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES course_purchases(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,

  -- Прогресс
  modules_completed JSONB DEFAULT '[]', -- [module_index, ...]
  units_completed JSONB DEFAULT '{}', -- { "module_index": [unit_index, ...] }
  progress_percent INTEGER DEFAULT 0 CHECK(progress_percent >= 0 AND progress_percent <= 100),

  -- Время
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE(purchase_id, student_id)
);

CREATE INDEX idx_course_progress_purchase ON course_progress(purchase_id);
CREATE INDEX idx_course_progress_student ON course_progress(student_id);

-- Отзывы на курсы
CREATE TABLE course_reviews (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id INTEGER REFERENCES course_purchases(id) ON DELETE SET NULL,

  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  content TEXT,

  -- Модерация
  is_verified BOOLEAN DEFAULT FALSE, -- подтвержденная покупка
  is_visible BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(course_id, user_id)
);

CREATE INDEX idx_course_reviews_course ON course_reviews(course_id);
CREATE INDEX idx_course_reviews_user ON course_reviews(user_id);

-- Лайки/избранное
CREATE TABLE course_favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, course_id)
);

-- Промокоды и скидки
CREATE TABLE course_coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  course_id INTEGER REFERENCES marketplace_courses(id) ON DELETE CASCADE, -- NULL = на все курсы
  author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  discount_type VARCHAR(20) NOT NULL CHECK(discount_type IN ('percent','fixed')),
  discount_value INTEGER NOT NULL, -- процент или сумма в копейках

  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,

  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_course_coupons_code ON course_coupons(code);
CREATE INDEX idx_course_coupons_course ON course_coupons(course_id);

-- Выплаты авторам
CREATE TABLE author_payouts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Период
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Суммы
  total_sales INTEGER NOT NULL, -- количество продаж
  gross_revenue INTEGER NOT NULL, -- общий доход
  platform_fee INTEGER NOT NULL, -- комиссия платформы
  net_amount INTEGER NOT NULL, -- сумма к выплате
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Статус выплаты
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','failed')),
  payment_method VARCHAR(30), -- 'stripe', 'paypal', 'bank_transfer'
  payment_details JSONB, -- реквизиты
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_author_payouts_author ON author_payouts(author_id);
CREATE INDEX idx_author_payouts_period ON author_payouts(period_end);

-- Функция обновления рейтинга курса
CREATE OR REPLACE FUNCTION update_course_rating() RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_courses
  SET
    rating = (SELECT AVG(rating)::DECIMAL(3,2) FROM course_reviews WHERE course_id = NEW.course_id AND is_visible = TRUE),
    reviews_count = (SELECT COUNT(*) FROM course_reviews WHERE course_id = NEW.course_id AND is_visible = TRUE),
    updated_at = NOW()
  WHERE id = NEW.course_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_course_rating
AFTER INSERT OR UPDATE OR DELETE ON course_reviews
FOR EACH ROW EXECUTE FUNCTION update_course_rating();

-- Функция обновления статистики продаж
CREATE OR REPLACE FUNCTION update_course_sales() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = TRUE THEN
    UPDATE marketplace_courses
    SET
      total_sales = total_sales + 1,
      total_revenue = total_revenue + NEW.amount_paid,
      updated_at = NOW()
    WHERE id = NEW.course_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_course_sales
AFTER INSERT ON course_purchases
FOR EACH ROW EXECUTE FUNCTION update_course_sales();
