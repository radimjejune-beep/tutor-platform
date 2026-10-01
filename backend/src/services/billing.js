// services/billing.js — списание занятий, остаток абонемента, баланс ученика
//
// Правила:
// • Списываются статусы done, cancelled_late, missed.
// • Сначала занятие списывается с самого старого активного абонемента, где остались занятия.
// • Если абонемента нет — занятие списывается как разовое по его цене (уходит в баланс ₽).
// • Если статус вернули на «запланировано» или «отменено вовремя» — списание отменяется.

const CHARGEABLE = ['done', 'cancelled_late', 'missed'];

// Остаток занятий по абонементу
async function subscriptionRemaining(client, subscriptionId) {
  const { rows } = await client.query(
    `SELECT s.lessons_total - COUNT(l.id)::int AS remaining
       FROM subscriptions s
       LEFT JOIN lessons l ON l.subscription_id = s.id AND l.charged
      WHERE s.id = $1
      GROUP BY s.id`,
    [subscriptionId]
  );
  return rows[0] ? rows[0].remaining : 0;
}

// Обновить статус абонемента по остатку (active ↔ finished)
async function refreshSubscriptionStatus(client, subscriptionId) {
  const remaining = await subscriptionRemaining(client, subscriptionId);
  await client.query(
    `UPDATE subscriptions
        SET status = CASE WHEN $2 <= 0 THEN 'finished' ELSE 'active' END
      WHERE id = $1 AND status <> 'cancelled'`,
    [subscriptionId, remaining]
  );
}

// Списать занятие (вызывать внутри транзакции)
async function chargeLesson(client, lesson) {
  if (lesson.charged) return lesson;

  // Блокируем абонементы ученика, чтобы два одновременных списания не ушли в один «последний» урок
  await client.query('SELECT id FROM subscriptions WHERE student_id = $1 FOR UPDATE', [lesson.student_id]);

  // Подходящий абонемент: активный, есть остаток, не истёк на дату занятия
  const { rows: subs } = await client.query(
    `SELECT s.id
       FROM subscriptions s
       LEFT JOIN lessons l ON l.subscription_id = s.id AND l.charged
      WHERE s.student_id = $1
        AND s.status = 'active'
        AND s.starts_on <= $2::date
        AND (s.expires_on IS NULL OR s.expires_on >= $2::date)
      GROUP BY s.id
     HAVING s.lessons_total - COUNT(l.id) > 0
      ORDER BY s.starts_on, s.id
      LIMIT 1`,
    [lesson.student_id, lesson.starts_at]
  );

  const subscriptionId = subs[0] ? subs[0].id : null;
  const { rows } = await client.query(
    `UPDATE lessons SET charged = TRUE, subscription_id = $2 WHERE id = $1 RETURNING *`,
    [lesson.id, subscriptionId]
  );
  if (subscriptionId) await refreshSubscriptionStatus(client, subscriptionId);
  return rows[0];
}

// Отменить списание
async function unchargeLesson(client, lesson) {
  if (!lesson.charged) return lesson;
  const { rows } = await client.query(
    `UPDATE lessons SET charged = FALSE, subscription_id = NULL WHERE id = $1 RETURNING *`,
    [lesson.id]
  );
  if (lesson.subscription_id) await refreshSubscriptionStatus(client, lesson.subscription_id);
  return rows[0];
}

// Привести списание в соответствие со статусом занятия
async function syncLessonCharge(client, lesson) {
  const shouldCharge = CHARGEABLE.includes(lesson.status);
  if (shouldCharge && !lesson.charged) return chargeLesson(client, lesson);
  if (!shouldCharge && lesson.charged) return unchargeLesson(client, lesson);
  return lesson;
}

// Финансовая сводка по ученику
// balance > 0 — предоплата, balance < 0 — долг
async function studentFinance(db, studentId) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0)::int FROM payments WHERE student_id = $1) AS paid,
       (SELECT COALESCE(SUM(price_total), 0)::int FROM subscriptions
         WHERE student_id = $1 AND status <> 'cancelled') AS subscriptions_cost,
       (SELECT COALESCE(SUM(price), 0)::int FROM lessons
         WHERE student_id = $1 AND charged AND subscription_id IS NULL) AS single_lessons_cost`,
    [studentId]
  );
  const f = rows[0];
  const balance = f.paid - f.subscriptions_cost - f.single_lessons_cost;

  const { rows: subs } = await db.query(
    `SELECT s.*, (s.lessons_total - COUNT(l.id))::int AS lessons_remaining
       FROM subscriptions s
       LEFT JOIN lessons l ON l.subscription_id = s.id AND l.charged
      WHERE s.student_id = $1
      GROUP BY s.id
      ORDER BY s.starts_on DESC, s.id DESC`,
    [studentId]
  );

  const active = subs.filter((s) => s.status === 'active');
  return {
    paid: f.paid,
    charged: f.subscriptions_cost + f.single_lessons_cost,
    balance,
    lessons_remaining: active.reduce((sum, s) => sum + s.lessons_remaining, 0),
    subscriptions: subs,
  };
}

module.exports = { CHARGEABLE, syncLessonCharge, studentFinance, refreshSubscriptionStatus };
