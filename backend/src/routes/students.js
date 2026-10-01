// routes/students.js — карточки учеников, доступы ученика и родителей
const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { requireRole, requireStudentAccess } = require('../middleware/auth');
const { validateBody, asyncHandler } = require('../middleware/validate');
const { studentFinance } = require('../services/billing');
const { generateTempPassword, stripPrivate, buildUpdate, uniqueLogin } = require('../utils');

const router = express.Router();
const tutorOnly = requireRole('tutor');

const studentFields = {
  full_name: z.string().trim().min(2).max(255),
  category: z.enum(['adult', 'teen', 'child']),
  level: z.string().trim().max(50).nullable(),
  goal: z.string().trim().max(2000).nullable(),
  textbook: z.string().trim().max(255).nullable(),
  default_price: z.number().int().min(0).max(100000),
  default_duration: z.number().int().min(15).max(240),
  board_link: z.string().trim().url().max(1000).nullable(),
  call_link: z.string().trim().url().max(1000).nullable(),
  notes: z.string().max(5000).nullable(),
  status: z.enum(['active', 'paused', 'archived']),
  pd_consent_at: z.string().datetime({ offset: true }).nullable(),
};

const createSchema = z
  .object(studentFields)
  .partial()
  .required({ full_name: true })
  .strict();
const updateSchema = z.object(studentFields).partial().strict();

// ------------------------------------------------------------
// Список учеников с баланом, остатком абонемента и ближайшим занятием (репетитор)
// ------------------------------------------------------------
router.get(
  '/',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const status = req.query.status || 'active';
    const { rows } = await query(
      `SELECT s.*,
              u.login AS login,
              (SELECT MIN(starts_at) FROM lessons l
                WHERE l.student_id = s.id AND l.status = 'scheduled' AND l.starts_at >= NOW()) AS next_lesson_at,
              (SELECT COUNT(*)::int FROM homework h
                WHERE h.student_id = s.id AND h.status = 'submitted') AS homework_to_check
         FROM students s
         LEFT JOIN users u ON u.id = s.user_id
        WHERE ($1 = 'all' OR s.status = $1)
        ORDER BY s.full_name`,
      [status]
    );
    // Финансы считаем по каждому ученику (учеников у репетитора немного — это быстро)
    const result = [];
    for (const s of rows) {
      const f = await studentFinance({ query }, s.id);
      result.push({ ...s, balance: f.balance, lessons_remaining: f.lessons_remaining });
    }
    res.json(result);
  })
);

router.post(
  '/',
  tutorOnly,
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;
    const keys = Object.keys(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await query(
      `INSERT INTO students (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      keys.map((k) => data[k])
    );
    console.log(`✅ Новый ученик: ${rows[0].full_name}`);
    res.status(201).json(rows[0]);
  })
);

// ------------------------------------------------------------
// Карточка ученика (репетитор — полностью, ученик/родитель — без заметок)
// ------------------------------------------------------------
router.get(
  '/:studentId',
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM students WHERE id = $1', [req.studentId]);
    if (!rows[0]) return res.status(404).json({ error: 'Ученик не найден' });

    const finance = await studentFinance({ query }, req.studentId);
    const isTutor = req.user.role === 'tutor';
    const student = isTutor ? rows[0] : stripPrivate(rows[0], ['notes', 'pd_consent_at']);

    let accounts = undefined;
    if (isTutor) {
      const { rows: acc } = await query(
        `SELECT u.id, u.role, u.login, u.full_name, u.is_active, u.last_login_at,
                EXISTS (SELECT 1 FROM telegram_links tl WHERE tl.user_id = u.id) AS telegram_linked,
                (SELECT json_agg(json_build_object('kind', d.kind, 'version', d.version, 'accepted_at', a.accepted_at)
                                 ORDER BY a.accepted_at)
                   FROM document_acceptances a JOIN legal_documents d ON d.id = a.document_id
                  WHERE a.user_id = u.id) AS accepted_docs
           FROM users u
          WHERE u.id = $1
             OR u.id IN (SELECT parent_user_id FROM parent_students WHERE student_id = $2)
          ORDER BY u.role DESC, u.full_name`,
        [rows[0].user_id, req.studentId]
      );
      accounts = acc;
    }

    res.json({ ...student, finance, accounts });
  })
);

router.patch(
  '/:studentId',
  tutorOnly,
  requireStudentAccess(),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const upd = buildUpdate('students', req.studentId, req.body);
    if (!upd) return res.status(400).json({ error: 'Нет изменений' });
    const { rows } = await query(upd.text, upd.values);
    console.log(`📝 Обновлена карточка ученика: ${rows[0].full_name}`);
    res.json(rows[0]);
  })
);

// ------------------------------------------------------------
// Создать вход для ученика. Нужны только имя (уже есть в карточке) и пароль.
// Логин генерируется из имени (ivan.petrov), можно задать свой.
// Пароль можно задать самому, иначе сгенерируется. Показывается один раз.
// ------------------------------------------------------------
const loginField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,64}$/, 'Логин: латиница, цифры, точка, от 3 символов');
const passwordField = z.string().min(6, 'Пароль — минимум 6 символов').max(100);

const studentLoginSchema = z.object({ login: loginField.optional(), password: passwordField.optional() }).strict();

// Создать учётку (внутри транзакции). Возвращает { user, password } или { error }
async function createAccount(client, { role, fullName, login, password }) {
  const finalLogin = login || (await uniqueLogin(client, fullName));
  const { rows: exists } = await client.query('SELECT id FROM users WHERE login = $1', [finalLogin]);
  if (exists[0]) return { error: `Логин «${finalLogin}» уже занят` };

  const finalPassword = password || generateTempPassword(8);
  const hash = await bcrypt.hash(finalPassword, 12);
  const { rows } = await client.query(
    `INSERT INTO users (role, login, password_hash, full_name) VALUES ($1, $2, $3, $4)
     RETURNING id, role, login, full_name`,
    [role, finalLogin, hash, fullName]
  );
  return { user: rows[0], password: finalPassword };
}

router.post(
  '/:studentId/login',
  tutorOnly,
  requireStudentAccess(),
  validateBody(studentLoginSchema),
  asyncHandler(async (req, res) => {
    const result = await transaction(async (client) => {
      const { rows: st } = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [req.studentId]);
      if (st[0].user_id) return { error: 'У ученика уже есть вход' };

      const acc = await createAccount(client, {
        role: 'student',
        fullName: st[0].full_name,
        login: req.body.login,
        password: req.body.password,
      });
      if (acc.error) return acc;
      await client.query('UPDATE students SET user_id = $1 WHERE id = $2', [acc.user.id, req.studentId]);
      return acc;
    });

    if (result.error) return res.status(409).json({ error: result.error });
    console.log(`👑 Создан вход ученика: ${result.user.login}`);
    res.status(201).json({ ...result.user, password: result.password });
  })
);

// ------------------------------------------------------------
// Добавить родителя: имя (+ свой логин/пароль по желанию).
// Если у родителя уже есть вход (второй ребёнок) — передать parent_user_id, он просто привяжется.
// ------------------------------------------------------------
const parentSchema = z.union([
  z.object({ parent_user_id: z.number().int().positive() }).strict(),
  z
    .object({
      full_name: z.string().trim().min(2).max(255),
      login: loginField.optional(),
      password: passwordField.optional(),
    })
    .strict(),
]);

router.post(
  '/:studentId/parents',
  tutorOnly,
  requireStudentAccess(),
  validateBody(parentSchema),
  asyncHandler(async (req, res) => {
    const result = await transaction(async (client) => {
      let parent;
      let password = null;

      if (req.body.parent_user_id) {
        const { rows } = await client.query(
          "SELECT id, role, login, full_name FROM users WHERE id = $1 AND role = 'parent'",
          [req.body.parent_user_id]
        );
        if (!rows[0]) return { error: 'Родитель не найден' };
        parent = rows[0];
      } else {
        const acc = await createAccount(client, {
          role: 'parent',
          fullName: req.body.full_name,
          login: req.body.login,
          password: req.body.password,
        });
        if (acc.error) return acc;
        ({ user: parent, password } = acc);
      }

      await client.query(
        'INSERT INTO parent_students (parent_user_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [parent.id, req.studentId]
      );
      return { parent, password };
    });

    if (result.error) return res.status(409).json({ error: result.error });
    console.log(`👑 Родитель привязан: ${result.parent.login} → ученик #${req.studentId}`);
    res.status(201).json({ ...result.parent, password: result.password });
  })
);

// Все родители (чтобы привязать второго ребёнка к уже существующему родителю)
router.get(
  '/accounts/parents',
  tutorOnly,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.login, u.full_name,
              COALESCE(json_agg(json_build_object('id', s.id, 'full_name', s.full_name))
                FILTER (WHERE s.id IS NOT NULL), '[]') AS children
         FROM users u
         LEFT JOIN parent_students ps ON ps.parent_user_id = u.id
         LEFT JOIN students s ON s.id = ps.student_id
        WHERE u.role = 'parent'
        GROUP BY u.id ORDER BY u.full_name`
    );
    res.json(rows);
  })
);

router.delete(
  '/:studentId/parents/:userId',
  tutorOnly,
  requireStudentAccess(),
  asyncHandler(async (req, res) => {
    await query('DELETE FROM parent_students WHERE parent_user_id = $1 AND student_id = $2', [
      Number(req.params.userId),
      req.studentId,
    ]);
    console.log(`🗑️ Родитель #${req.params.userId} отвязан от ученика #${req.studentId}`);
    res.json({ ok: true });
  })
);

module.exports = router;
