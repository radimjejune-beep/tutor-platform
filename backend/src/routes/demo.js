// routes/demo.js — пример для нового преподавателя: два ученика с занятиями, домашкой и оплатами.
// Помогает за минуту увидеть, как платформа выглядит в работе. Удаляется одной кнопкой целиком.
//   GET    /api/demo   есть ли пример у преподавателя
//   POST   /api/demo   создать пример
//   DELETE /api/demo   удалить пример
// Ученики и задания примера помечены is_demo и не считаются в лимите тарифа, первых шагах и метриках.
const express = require('express');
const { query, transaction } = require('../db');
const { asyncHandler } = require('../middleware/validate');
const { syncLessonCharge } = require('../services/billing');

const router = express.Router();

let ready = null;
function ensure() {
  if (!ready) {
    ready = query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

const tutorOnly = (req, res, next) => (req.user.role === 'tutor' ? next() : res.status(403).json({ error: 'Только для преподавателя' }));
router.use(tutorOnly, asyncHandler(async (req, res, next) => { await ensure(); next(); }));

async function hasDemo(tid) {
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM students WHERE tutor_id = $1 AND is_demo', [tid]);
  return rows[0].n > 0;
}

router.get('/', asyncHandler(async (req, res) => res.json({ active: await hasDemo(req.user.id) })));

// Время в часовом поясе сессии базы (Москва по умолчанию): день от сегодняшнего и час
const at = (days, hour) => `date_trunc('day', NOW()) + make_interval(days => ${Number(days)}, hours => ${Number(hour)})`;

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const tid = req.user.id;
    if (await hasDemo(tid)) return res.status(409).json({ error: 'Пример уже добавлен' });
    await transaction((c) => createDemo(c, tid));
    console.log(`🧪 Пример добавлен: ${req.user.login}`);
    res.status(201).json({ ok: true });
  })
);

// Создать пример в транзакции c. Возвращает учеников { anna, misha }
async function createDemo(c, tid) {
  {
    {
      const student = async (s) => (await c.query(
        `INSERT INTO students (tutor_id, full_name, category, level, goal, textbook, default_price, default_duration, status, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 60, 'active', TRUE) RETURNING *`,
        [tid, s.name, s.category, s.level, s.goal, s.textbook, s.price]
      )).rows[0];
      const anna = await student({ name: 'Анна (пример)', category: 'adult', level: 'A2', goal: 'Разговорный английский для путешествий', textbook: 'Учебник A2', price: 1500 });
      const misha = await student({ name: 'Миша (пример)', category: 'teen', level: 'A1', goal: 'Подтянуть школьную программу', textbook: 'Школьный учебник', price: 1200 });

      // Мише абонемент на 8 занятий, оплачен целиком; Анне разовые занятия, одно оплачено
      const { rows: sub } = await c.query(
        `INSERT INTO subscriptions (student_id, title, lessons_total, price_total, starts_on) VALUES ($1, 'Абонемент на 8 занятий', 8, 8800, CURRENT_DATE - 7) RETURNING id`,
        [misha.id]
      );
      await c.query(`INSERT INTO payments (student_id, subscription_id, amount, paid_on, method, comment) VALUES ($1, $2, 8800, CURRENT_DATE - 7, 'transfer', 'Пример оплаты')`, [misha.id, sub[0].id]);
      await c.query(`INSERT INTO payments (student_id, amount, paid_on, method, comment) VALUES ($1, 1500, CURRENT_DATE - 6, 'transfer', 'Пример оплаты')`, [anna.id]);

      const lesson = async (s, when, status, topic, summary) => {
        const { rows } = await c.query(
          `INSERT INTO lessons (student_id, starts_at, duration_min, status, price, topic, summary) VALUES ($1, ${when}, 60, $2, $3, $4, $5) RETURNING *`,
          [s.id, status, s.default_price, topic, summary]
        );
        if (status !== 'scheduled') await syncLessonCharge(c, rows[0]);
      };
      // Прошлые занятия проведены (и списаны), впереди занятия на эту и следующую неделю
      await lesson(anna, at(-6, 18), 'done', 'Present Simple: распорядок дня', 'Разобрали Present Simple, составили рассказ о своём дне. Домашка: 10 предложений.');
      await lesson(anna, at(-2, 18), 'done', 'Еда и напитки', 'Новые слова по теме еды, диалог в кафе. Хорошо получается говорить без подсказок.');
      await lesson(anna, at(1, 18), 'scheduled', 'Путешествия: аэропорт', null);
      await lesson(anna, at(5, 18), 'scheduled', null, null);
      await lesson(misha, at(-5, 16), 'done', 'to be, личные местоимения', 'Повторили to be, сделали упражнения 1–4. Нужно выучить слова юнита.');
      await lesson(misha, at(-1, 16), 'missed', null, null);
      await lesson(misha, at(2, 16), 'scheduled', 'Have got', null);
      await lesson(misha, at(6, 16), 'scheduled', null, null);

      // Одно задание на двоих: Анна сдала тест, Миша ещё нет
      const questions = [
        { id: 'q1', type: 'choice', prompt: 'She ___ to work by bus.', options: ['go', 'goes', 'going'], correct: ['goes'], points: 1 },
        { id: 'q2', type: 'choice', prompt: '___ you like coffee?', options: ['Do', 'Does', 'Are'], correct: ['Do'], points: 1 },
        { id: 'q3', type: 'choice', prompt: 'He ___ play tennis on Mondays.', options: ["don't", "doesn't", "isn't"], correct: ["doesn't"], points: 1 },
      ];
      const { rows: a } = await c.query(
        `INSERT INTO assignments (title, description, due_on, questions, tutor_id, is_demo) VALUES ($1, $2, CURRENT_DATE + 2, $3, $4, TRUE) RETURNING id`,
        ['Present Simple (пример)', 'Пройдите тест и напишите 5 предложений о своём дне.', JSON.stringify(questions), tid]
      );
      await c.query(
        `INSERT INTO homework (assignment_id, student_id, status, student_answer, submitted_at, quiz_answers, quiz_score)
         VALUES ($1, $2, 'submitted', $3, NOW() - INTERVAL '3 hours', $4, 67)`,
        [a[0].id, anna.id, 'I get up at 7. I have breakfast at 8. I goes to work by metro. I finish work at 6. In the evening I read books.', JSON.stringify({ q1: ['goes'], q2: ['Do'], q3: ["don't"] })]
      );
      await c.query(`INSERT INTO homework (assignment_id, student_id, status) VALUES ($1, $2, 'assigned')`, [a[0].id, misha.id]);
      return { anna, misha };
    }
  }
}

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const tid = req.user.id;
    await transaction(async (c) => {
      await c.query('DELETE FROM assignments WHERE tutor_id = $1 AND is_demo', [tid]);
      await c.query('DELETE FROM students WHERE tutor_id = $1 AND is_demo', [tid]);
    });
    console.log(`🧪 Пример удалён: ${req.user.login}`);
    res.json({ ok: true });
  })
);

module.exports = router;
module.exports.ensure = ensure;
module.exports.createDemo = createDemo;
