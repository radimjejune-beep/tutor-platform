// routes/finance.js — абонементы, оплаты, сводка дохода
const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, requireStudentAccess } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { studentFinance, refreshSubscriptionStatus } = require('../services/billing');
const { buildUpdate } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД');

const paymentFields = {
  amount: z.number().int().positive().max(1000000),
  paid_on: isoDate.optional(),
  method: z.enum(['transfer', 'cash', 'card', 'other']).optional(),
  receipt_url: z.string().trim().url().max(1000).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
};

// ------------------------------------------------------------
// Финансы ученика: баланс, абонементы, история оплат (видят ученик и родитель)
// ------------------------------------------------------------
router.get(
  '/students/:studentId',
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    const finance = await studentFinance({ query }, req.studentId);
    const { rows: payments } = await query(
      'SELECT * FROM payments WHERE student_id = $1 ORDER BY paid_on DESC, id DESC',
      [req.studentId]
    );
    res.json({ ...finance, payments });
  })
);

// ------------------------------------------------------------
// Новый абонемент (можно сразу с оплатой)
// ------------------------------------------------------------
const subscriptionSchema = z
  .object({
    student_id: z.number().int().positive(),
    title: z.string().trim().min(1).max(255).optional(),
    lessons_total: z.number().int().min(1).max(200),
    price_total: z.number().int().min(0).max(1000000),
    starts_on: isoDate.optional(),
    expires_on: isoDate.nullable().optional(),
    payment: z.object(paymentFields).strict().optional(),
  })
  .strict();

router.post(
  '/subscriptions',
  tutorOnly,
  validateBody(subscriptionSchema),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows: st } = await query('SELECT id, full_name FROM students WHERE id = $1', [b.student_id]);
    if (!st[0]) return res.status(404).json({ error: 'Ученик не найден' });

    const result = await transaction(async (client) => {
      const { rows: sub } = await client.query(
        `INSERT INTO subscriptions (student_id, title, lessons_total, price_total, starts_on, expires_on)
         VALUES ($1, COALESCE($2, 'Абонемент'), $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
         RETURNING *`,
        [b.student_id, b.title || null, b.lessons_total, b.price_total, b.starts_on || null, b.expires_on || null]
      );

      let payment = null;
      if (b.payment) {
        const p = b.payment;
        ({ rows: [payment] } = await client.query(
          `INSERT INTO payments (student_id, subscription_id, amount, paid_on, method, receipt_url, comment)
           VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), COALESCE($5, 'transfer'), $6, $7)
           RETURNING *`,
          [b.student_id, sub[0].id, p.amount, p.paid_on || null, p.method || null, p.receipt_url || null, p.comment || null]
        ));
      }
      return { subscription: sub[0], payment };
    });

    console.log(`✅ Абонемент: ${st[0].full_name}, ${b.lessons_total} занятий за ${b.price_total} ₽`);
    res.status(201).json(result);
  })
);

const subscriptionUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    expires_on: isoDate.nullable(),
    status: z.enum(['active', 'cancelled']), // finished выставляется автоматически
  })
  .partial()
  .strict();

router.patch(
  '/subscriptions/:id',
  tutorOnly,
  validateBody(subscriptionUpdateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const sub = await transaction(async (client) => {
      const upd = buildUpdate('subscriptions', id, req.body);
      if (!upd) return null;
      const { rows } = await client.query(upd.text, upd.values);
      if (!rows[0]) return null;
      // Вернули в работу → пересчитать active/finished по остатку
      if (req.body.status === 'active') await refreshSubscriptionStatus(client, id);
      const { rows: fresh } = await client.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
      return fresh[0];
    });
    if (!sub) return res.status(404).json({ error: 'Абонемент не найден' });
    console.log(`📝 Абонемент #${id} обновлён (${sub.status})`);
    res.json(sub);
  })
);

// ------------------------------------------------------------
// Оплаты
// ------------------------------------------------------------
const paymentSchema = z
  .object({
    student_id: z.number().int().positive(),
    subscription_id: z.number().int().positive().nullable().optional(),
    ...paymentFields,
  })
  .strict();

router.post(
  '/payments',
  tutorOnly,
  validateBody(paymentSchema),
  asyncHandler(async (req, res) => {
    const p = req.body;
    // Абонемент (если указан) должен принадлежать этому ученику
    if (p.subscription_id) {
      const { rows } = await query('SELECT id FROM subscriptions WHERE id = $1 AND student_id = $2', [
        p.subscription_id,
        p.student_id,
      ]);
      if (!rows[0]) return res.status(400).json({ error: 'Абонемент не относится к этому ученику' });
    }
    const { rows } = await query(
      `INSERT INTO payments (student_id, subscription_id, amount, paid_on, method, receipt_url, comment)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), COALESCE($5, 'transfer'), $6, $7)
       RETURNING *`,
      [p.student_id, p.subscription_id || null, p.amount, p.paid_on || null, p.method || null, p.receipt_url || null, p.comment || null]
    );
    console.log(`✅ Оплата ${p.amount} ₽ (ученик #${p.student_id})`);
    res.status(201).json(rows[0]);
  })
);

router.patch(
  '/payments/:id',
  tutorOnly,
  validateBody(z.object({ receipt_url: paymentFields.receipt_url, comment: paymentFields.comment }).strict()),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('payments', Number(req.params.id), req.body);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    if (!rows[0]) return res.status(404).json({ error: 'Оплата не найдена' });
    res.json(rows[0]);
  })
);

router.delete(
  '/payments/:id',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query('DELETE FROM payments WHERE id = $1 RETURNING id, amount', [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Оплата не найдена' });
    console.log(`🗑️ Оплата #${rows[0].id} (${rows[0].amount} ₽) удалена`);
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// Сводка за месяц (репетитор): поступления, проведённые часы, средняя ставка
// ?month=2026-10
// ------------------------------------------------------------
router.get(
  '/summary',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
    const start = month ? `${month}-01` : null;

    const { rows } = await query(
      `WITH bounds AS (
         SELECT COALESCE($1::date, date_trunc('month', CURRENT_DATE)::date) AS m_start
       )
       SELECT
         to_char(b.m_start, 'YYYY-MM') AS month,
         (SELECT COALESCE(SUM(amount), 0)::int FROM payments
           WHERE paid_on >= b.m_start AND paid_on < b.m_start + INTERVAL '1 month') AS income,
         (SELECT COUNT(*)::int FROM payments
           WHERE paid_on >= b.m_start AND paid_on < b.m_start + INTERVAL '1 month' AND receipt_url IS NULL) AS payments_without_receipt,
         (SELECT COUNT(*)::int FROM lessons
           WHERE status = 'done' AND starts_at >= b.m_start AND starts_at < b.m_start + INTERVAL '1 month') AS lessons_done,
         (SELECT COALESCE(SUM(duration_min), 0)::int FROM lessons
           WHERE status = 'done' AND starts_at >= b.m_start AND starts_at < b.m_start + INTERVAL '1 month') AS minutes_taught,
         (SELECT COUNT(*)::int FROM lessons
           WHERE status IN ('cancelled', 'cancelled_late', 'missed')
             AND starts_at >= b.m_start AND starts_at < b.m_start + INTERVAL '1 month') AS lessons_cancelled
       FROM bounds b`,
      [start]
    );
    const s = rows[0];
    // Средняя выручка за час: поступления / проведённые часы (ориентир для повышения цены)
    s.income_per_hour = s.minutes_taught ? Math.round(s.income / (s.minutes_taught / 60)) : null;
    res.json(s);
  })
);

module.exports = router;
