// middleware/auth.js — проверка входа, ролей и доступа к ученику
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

// Проверяем токен и каждый раз берём пользователя из базы:
// роль и статус берутся из базы, а не из токена (заблокированный пользователь сразу теряет доступ)
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Требуется вход' });

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
    }

    const { rows } = await query(
      'SELECT id, role, login, full_name, is_active, must_change_password FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Учётная запись недоступна' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Разрешить только указанные роли
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

// Пока не сменён временный пароль — пускаем только к /auth
function requirePasswordChanged(req, res, next) {
  if (req.user.must_change_password) {
    return res.status(403).json({ error: 'Сначала смените временный пароль', code: 'MUST_CHANGE_PASSWORD' });
  }
  next();
}

// Список id учеников, доступных пользователю (для репетитора — null = все)
async function accessibleStudentIds(user) {
  if (user.role === 'tutor') return null;
  if (user.role === 'student') {
    const { rows } = await query('SELECT id FROM students WHERE user_id = $1', [user.id]);
    return rows.map((r) => r.id);
  }
  if (user.role === 'parent') {
    const { rows } = await query('SELECT student_id AS id FROM parent_students WHERE parent_user_id = $1', [user.id]);
    return rows.map((r) => r.id);
  }
  return [];
}

async function canAccessStudent(user, studentId) {
  const ids = await accessibleStudentIds(user);
  return ids === null || ids.includes(Number(studentId));
}

// Middleware: проверка доступа к ученику из параметра :studentId
function requireStudentAccess(param = 'studentId') {
  return async (req, res, next) => {
    try {
      const studentId = Number(req.params[param]);
      if (!Number.isInteger(studentId)) return res.status(400).json({ error: 'Некорректный id ученика' });
      if (!(await canAccessStudent(req.user, studentId))) {
        return res.status(404).json({ error: 'Ученик не найден' });
      }
      req.studentId = studentId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  authenticate,
  requireRole,
  requirePasswordChanged,
  accessibleStudentIds,
  canAccessStudent,
  requireStudentAccess,
};
