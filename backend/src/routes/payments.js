// routes/payments.js — интеграция с платежными системами (Stripe)
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// В production используйте настоящие ключи Stripe
const STRIPE_ENABLED = process.env.STRIPE_SECRET_KEY ? true : false;
let stripe;

if (STRIPE_ENABLED) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// ============================================================
// Создать платежную сессию Stripe для покупки курса
// ============================================================
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { course_id, success_url, cancel_url } = req.body;

    if (!STRIPE_ENABLED) {
      return res.status(501).json({
        error: 'Payments not configured',
        message: 'Please set STRIPE_SECRET_KEY in environment variables'
      });
    }

    // Получаем курс
    const courseResult = await db.query(
      'SELECT * FROM marketplace_courses WHERE id = $1 AND status = $\'published\'',
      [course_id]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courseResult.rows[0];

    if (course.price_type === 'free') {
      return res.status(400).json({ error: 'Course is free' });
    }

    // Проверяем, не куплен ли уже
    const existingPurchase = await db.query(`
      SELECT id FROM course_purchases
      WHERE course_id = $1 AND buyer_id = $2 AND is_active = TRUE
    `, [course_id, req.user.id]);

    if (existingPurchase.rows.length > 0) {
      return res.status(400).json({ error: 'Course already purchased' });
    }

    // Создаем Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: course.currency.toLowerCase(),
            product_data: {
              name: course.title,
              description: course.description?.substring(0, 500),
              images: course.thumbnail_url ? [course.thumbnail_url] : [],
            },
            unit_amount: course.price_amount, // в копейках
          },
          quantity: 1,
        },
      ],
      mode: course.price_type === 'subscription' ? 'subscription' : 'payment',
      success_url: success_url || `${process.env.FRONTEND_URL}/courses/${course.slug}?purchase=success`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/courses/${course.slug}`,
      metadata: {
        course_id: course.id,
        buyer_id: req.user.id,
        buyer_type: req.user.role,
      },
      customer_email: req.user.email,
    });

    res.json({
      session_id: session.id,
      checkout_url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// ============================================================
// Webhook для обработки событий Stripe
// ============================================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!STRIPE_ENABLED) {
    return res.status(501).send('Payments not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Обрабатываем события
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleSuccessfulPayment(session);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Для подписок
        const invoice = event.data.object;
        await handleSubscriptionPayment(invoice);
        break;
      }

      case 'customer.subscription.deleted': {
        // Отмена подписки
        const subscription = event.data.object;
        await handleSubscriptionCancellation(subscription);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================
// Обработчики событий
// ============================================================

async function handleSuccessfulPayment(session) {
  const { course_id, buyer_id, buyer_type } = session.metadata;

  if (!course_id || !buyer_id) {
    console.error('Missing metadata in session:', session.id);
    return;
  }

  // Получаем курс
  const courseResult = await db.query(
    'SELECT * FROM marketplace_courses WHERE id = $1',
    [course_id]
  );

  if (courseResult.rows.length === 0) {
    console.error('Course not found:', course_id);
    return;
  }

  const course = courseResult.rows[0];
  const amount_paid = session.amount_total;
  const platform_fee = Math.floor(amount_paid * (course.commission_rate / 100));
  const author_earnings = amount_paid - platform_fee;

  // Создаем покупку
  await db.query(`
    INSERT INTO course_purchases (
      course_id, buyer_id, buyer_type, payment_method, payment_id,
      amount_paid, currency, platform_fee, author_earnings,
      access_type
    ) VALUES ($1, $2, $3, 'stripe', $4, $5, $6, $7, $8, 'lifetime')
    ON CONFLICT (course_id, buyer_id, buyer_type) WHERE is_active = TRUE
    DO NOTHING
  `, [
    course_id,
    buyer_id,
    buyer_type || 'student',
    session.id,
    amount_paid,
    session.currency.toUpperCase(),
    platform_fee,
    author_earnings
  ]);

  console.log(`Payment successful for course ${course_id} by user ${buyer_id}`);
}

async function handleSubscriptionPayment(invoice) {
  // Логика для регулярных платежей подписок
  console.log('Subscription payment:', invoice.id);
}

async function handleSubscriptionCancellation(subscription) {
  // Логика отмены подписки
  const customer = subscription.customer;

  await db.query(`
    UPDATE course_purchases
    SET is_active = FALSE, updated_at = NOW()
    WHERE payment_id = $1
  `, [subscription.id]);

  console.log('Subscription cancelled:', subscription.id);
}

// ============================================================
// Получить информацию о платеже
// ============================================================
router.get('/purchase/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.*,
        c.title as course_title,
        c.slug as course_slug,
        c.thumbnail_url
      FROM course_purchases p
      JOIN marketplace_courses c ON p.course_id = c.id
      WHERE p.id = $1 AND p.buyer_id = $2
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json({ purchase: result.rows[0] });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

// ============================================================
// История покупок
// ============================================================
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.*,
        c.title as course_title,
        c.slug as course_slug,
        c.thumbnail_url,
        u.full_name as author_name
      FROM course_purchases p
      JOIN marketplace_courses c ON p.course_id = c.id
      JOIN users u ON c.author_id = u.id
      WHERE p.buyer_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.id]);

    res.json({ purchases: result.rows });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// ============================================================
// Запросить возврат средств
// ============================================================
router.post('/purchase/:id/refund', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;

    const purchase = await db.query(
      'SELECT * FROM course_purchases WHERE id = $1 AND buyer_id = $2',
      [req.params.id, req.user.id]
    );

    if (purchase.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const p = purchase.rows[0];

    // Проверяем, что прошло менее 14 дней
    const daysSincePurchase = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSincePurchase > 14) {
      return res.status(400).json({ error: 'Refund period expired (14 days)' });
    }

    if (p.refunded_at) {
      return res.status(400).json({ error: 'Already refunded' });
    }

    // В реальной системе здесь будет обращение к Stripe API
    if (STRIPE_ENABLED && p.payment_method === 'stripe') {
      // await stripe.refunds.create({ payment_intent: p.payment_id });
    }

    await db.query(`
      UPDATE course_purchases
      SET
        refunded_at = NOW(),
        refund_reason = $1,
        is_active = FALSE,
        updated_at = NOW()
      WHERE id = $2
    `, [reason, req.params.id]);

    res.json({ success: true, message: 'Refund processed' });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// ============================================================
// Создать бесплатный доступ (для админов или промо)
// ============================================================
router.post('/grant-access', authMiddleware, async (req, res) => {
  try {
    const { course_id, user_id } = req.body;

    // Только админы или авторы курса могут выдавать бесплатный доступ
    const course = await db.query(
      'SELECT * FROM marketplace_courses WHERE id = $1 AND (author_id = $2 OR $3 = TRUE)',
      [course_id, req.user.id, req.user.role === 'admin']
    );

    if (course.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await db.query(`
      INSERT INTO course_purchases (
        course_id, buyer_id, buyer_type, payment_method,
        amount_paid, currency, platform_fee, author_earnings,
        access_type
      ) VALUES ($1, $2, 'student', 'manual', 0, 'USD', 0, 0, 'lifetime')
      ON CONFLICT (course_id, buyer_id, buyer_type) WHERE is_active = TRUE
      DO NOTHING
      RETURNING *
    `, [course_id, user_id]);

    res.json({ success: true, purchase: result.rows[0] });
  } catch (error) {
    console.error('Error granting access:', error);
    res.status(500).json({ error: 'Failed to grant access' });
  }
});

module.exports = router;
