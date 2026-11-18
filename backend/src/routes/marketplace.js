// routes/marketplace.js — API для маркетплейса курсов
const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const db = require('../db');
const z = require('zod');

const router = express.Router();

// ============================================================
// Валидация
// ============================================================

const courseSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  category: z.enum(['english', 'math', 'programming', 'business', 'languages', 'other']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  language: z.string().length(2).default('ru'),
  modules: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    units: z.array(z.object({
      title: z.string(),
      type: z.enum(['video', 'text', 'quiz', 'assignment', 'interactive']),
      content: z.any(),
      duration: z.number().optional()
    }))
  })),
  price_type: z.enum(['free', 'paid', 'subscription']),
  price_amount: z.number().int().min(0).optional(),
  currency: z.string().length(3).default('USD'),
  tutor_price: z.number().int().min(0).optional(),
  estimated_hours: z.number().int().optional()
});

// ============================================================
// Получить список курсов в маркетплейсе
// ============================================================
router.get('/courses', async (req, res) => {
  try {
    const {
      category,
      level,
      price_type,
      search,
      sort = 'popular',
      page = 1,
      limit = 20
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ['status = $1'];
    const params = ['published'];
    let paramIndex = 2;

    if (category) {
      where.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (level) {
      where.push(`level = $${paramIndex}`);
      params.push(level);
      paramIndex++;
    }

    if (price_type) {
      where.push(`price_type = $${paramIndex}`);
      params.push(price_type);
      paramIndex++;
    }

    if (search) {
      where.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = where.join(' AND ');

    let orderBy = 'created_at DESC';
    if (sort === 'popular') orderBy = 'total_sales DESC, rating DESC';
    else if (sort === 'rating') orderBy = 'rating DESC, reviews_count DESC';
    else if (sort === 'price_low') orderBy = 'price_amount ASC NULLS FIRST';
    else if (sort === 'price_high') orderBy = 'price_amount DESC NULLS LAST';
    else if (sort === 'newest') orderBy = 'published_at DESC';

    const query = `
      SELECT
        c.*,
        u.full_name as author_name,
        u.login as author_login,
        (SELECT COUNT(*) FROM course_favorites WHERE course_id = c.id) as favorites_count,
        EXISTS(
          SELECT 1 FROM course_purchases
          WHERE course_id = c.id
            AND buyer_id = $${paramIndex}
            AND is_active = TRUE
        ) as is_purchased
      FROM marketplace_courses c
      JOIN users u ON c.author_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(req.user?.id || 0, parseInt(limit), offset);

    const result = await db.query(query, params);

    // Получаем общее количество
    const countQuery = `SELECT COUNT(*) FROM marketplace_courses WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, params.slice(0, paramIndex - 1));
    const total = parseInt(countResult.rows[0].count);

    res.json({
      courses: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching marketplace courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ============================================================
// Получить один курс
// ============================================================
router.get('/courses/:slug', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        u.full_name as author_name,
        u.login as author_login,
        u.id as author_id,
        (SELECT COUNT(*) FROM course_favorites WHERE course_id = c.id) as favorites_count,
        EXISTS(
          SELECT 1 FROM course_favorites
          WHERE course_id = c.id AND user_id = $2
        ) as is_favorited,
        EXISTS(
          SELECT 1 FROM course_purchases
          WHERE course_id = c.id
            AND buyer_id = $2
            AND is_active = TRUE
        ) as is_purchased
      FROM marketplace_courses c
      JOIN users u ON c.author_id = u.id
      WHERE c.slug = $1 AND c.status = 'published'
    `, [req.params.slug, req.user?.id || 0]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Получаем отзывы
    const reviews = await db.query(`
      SELECT r.*, u.full_name as user_name
      FROM course_reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.course_id = $1 AND r.is_visible = TRUE
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [result.rows[0].id]);

    res.json({
      course: result.rows[0],
      reviews: reviews.rows
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// ============================================================
// Создать курс (только для репетиторов)
// ============================================================
router.post('/courses', authMiddleware, requireRole('tutor'), async (req, res) => {
  try {
    const data = courseSchema.parse(req.body);

    // Проверяем уникальность slug
    const existing = await db.query(
      'SELECT id FROM marketplace_courses WHERE slug = $1',
      [data.slug]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const total_lessons = data.modules.reduce(
      (sum, module) => sum + module.units.length,
      0
    );

    const result = await db.query(`
      INSERT INTO marketplace_courses (
        author_id, title, slug, description, thumbnail_url,
        category, level, language, modules, total_lessons,
        estimated_hours, price_type, price_amount, currency,
        tutor_price, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft')
      RETURNING *
    `, [
      req.user.id,
      data.title,
      data.slug,
      data.description,
      data.thumbnail_url,
      data.category,
      data.level,
      data.language,
      JSON.stringify(data.modules),
      total_lessons,
      data.estimated_hours,
      data.price_type,
      data.price_amount,
      data.currency,
      data.tutor_price
    ]);

    res.status(201).json({ course: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// ============================================================
// Обновить курс
// ============================================================
router.put('/courses/:id', authMiddleware, requireRole('tutor'), async (req, res) => {
  try {
    // Проверяем, что курс принадлежит пользователю
    const check = await db.query(
      'SELECT id FROM marketplace_courses WHERE id = $1 AND author_id = $2',
      [req.params.id, req.user.id]
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const data = courseSchema.partial().parse(req.body);

    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'modules') {
        fields.push(`${key} = $${index}`);
        values.push(JSON.stringify(value));

        // Пересчитываем количество уроков
        const total = value.reduce((sum, m) => sum + m.units.length, 0);
        fields.push(`total_lessons = $${index + 1}`);
        values.push(total);
        index += 2;
      } else {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    });

    fields.push('updated_at = NOW()');
    values.push(req.params.id);

    const result = await db.query(`
      UPDATE marketplace_courses
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `, values);

    res.json({ course: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// ============================================================
// Опубликовать курс
// ============================================================
router.post('/courses/:id/publish', authMiddleware, requireRole('tutor'), async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE marketplace_courses
      SET status = 'published', published_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND author_id = $2 AND status = 'draft'
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found or already published' });
    }

    res.json({ course: result.rows[0] });
  } catch (error) {
    console.error('Error publishing course:', error);
    res.status(500).json({ error: 'Failed to publish course' });
  }
});

// ============================================================
// Купить курс
// ============================================================
router.post('/courses/:id/purchase', authMiddleware, async (req, res) => {
  try {
    const { payment_method, payment_id, assigned_to_student_id } = req.body;

    // Получаем курс
    const course = await db.query(
      'SELECT * FROM marketplace_courses WHERE id = $1 AND status = $\'published\'',
      [req.params.id]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = course.rows[0];

    // Проверяем, не куплен ли уже
    const existing = await db.query(`
      SELECT id FROM course_purchases
      WHERE course_id = $1 AND buyer_id = $2 AND is_active = TRUE
    `, [req.params.id, req.user.id]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Course already purchased' });
    }

    const amount_paid = courseData.price_amount || 0;
    const platform_fee = Math.floor(amount_paid * (courseData.commission_rate / 100));
    const author_earnings = amount_paid - platform_fee;

    // Создаем покупку
    const result = await db.query(`
      INSERT INTO course_purchases (
        course_id, buyer_id, buyer_type, payment_method, payment_id,
        amount_paid, currency, platform_fee, author_earnings,
        assigned_to_student_id, access_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'lifetime')
      RETURNING *
    `, [
      req.params.id,
      req.user.id,
      req.user.role,
      payment_method,
      payment_id,
      amount_paid,
      courseData.currency,
      platform_fee,
      author_earnings,
      assigned_to_student_id
    ]);

    res.status(201).json({ purchase: result.rows[0] });
  } catch (error) {
    console.error('Error purchasing course:', error);
    res.status(500).json({ error: 'Failed to purchase course' });
  }
});

// ============================================================
// Мои курсы (купленные)
// ============================================================
router.get('/my-courses', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        p.id as purchase_id,
        p.created_at as purchased_at,
        p.assigned_to_student_id,
        prog.progress_percent,
        prog.completed_at
      FROM course_purchases p
      JOIN marketplace_courses c ON p.course_id = c.id
      LEFT JOIN course_progress prog ON prog.purchase_id = p.id
      WHERE p.buyer_id = $1 AND p.is_active = TRUE
      ORDER BY p.created_at DESC
    `, [req.user.id]);

    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Error fetching my courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ============================================================
// Мои курсы (созданные)
// ============================================================
router.get('/author/courses', authMiddleware, requireRole('tutor'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        c.*,
        (SELECT COUNT(*) FROM course_purchases WHERE course_id = c.id) as total_purchases
      FROM marketplace_courses c
      WHERE c.author_id = $1
      ORDER BY c.created_at DESC
    `, [req.user.id]);

    res.json({ courses: result.rows });
  } catch (error) {
    console.error('Error fetching author courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// ============================================================
// Добавить в избранное
// ============================================================
router.post('/courses/:id/favorite', authMiddleware, async (req, res) => {
  try {
    await db.query(`
      INSERT INTO course_favorites (user_id, course_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [req.user.id, req.params.id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding to favorites:', error);
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

// ============================================================
// Убрать из избранного
// ============================================================
router.delete('/courses/:id/favorite', authMiddleware, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM course_favorites WHERE user_id = $1 AND course_id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from favorites:', error);
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

// ============================================================
// Оставить отзыв
// ============================================================
router.post('/courses/:id/review', authMiddleware, async (req, res) => {
  try {
    const { rating, title, content } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid rating' });
    }

    // Проверяем, что пользователь купил курс
    const purchase = await db.query(`
      SELECT id FROM course_purchases
      WHERE course_id = $1 AND buyer_id = $2 AND is_active = TRUE
    `, [req.params.id, req.user.id]);

    const result = await db.query(`
      INSERT INTO course_reviews (course_id, user_id, purchase_id, rating, title, content, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (course_id, user_id) DO UPDATE
      SET rating = $4, title = $5, content = $6, updated_at = NOW()
      RETURNING *
    `, [req.params.id, req.user.id, purchase.rows[0]?.id, rating, title, content, purchase.rows.length > 0]);

    res.status(201).json({ review: result.rows[0] });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ============================================================
// Статистика для автора
// ============================================================
router.get('/author/stats', authMiddleware, requireRole('tutor'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_courses,
        SUM(c.total_sales) as total_sales,
        SUM(c.total_revenue) as total_revenue,
        AVG(c.rating) as avg_rating,
        (
          SELECT SUM(net_amount)
          FROM author_payouts
          WHERE author_id = $1 AND status = 'completed'
        ) as total_payouts
      FROM marketplace_courses c
      WHERE c.author_id = $1
    `, [req.user.id]);

    res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error('Error fetching author stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
