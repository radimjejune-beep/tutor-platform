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
      'SELECT id, role, login, full_name, is_active, must_change_password, is_admin, tutor_id FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Учётная запись недоступна' });
    }

    // tid — чей это кабинет: у репетитора он сам, у ученика и родителя — их репетитор
    user.tid = user.role === 'tutor' ? user.id : user.tutor_id;
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

// Список id учеников, доступных пользователю: репетитору — только его ученики
async function accessibleStudentIds(user) {
  if (user.role === 'tutor') {
    const { rows } = await query('SELECT id FROM students WHERE tutor_id = $1', [user.id]);
    return rows.map((r) => r.id);
  }
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
  if (user.role === 'tutor') {
    const { rows } = await query('SELECT 1 FROM students WHERE id = $1 AND tutor_id = $2', [Number(studentId), user.id]);
    return Boolean(rows[0]);
  }
  const ids = await accessibleStudentIds(user);
  return ids.includes(Number(studentId));
}

// Принадлежит ли запись репетитору. Путь к владельцу для каждой таблицы
const OWNER_SQL = {
  students: 'SELECT 1 FROM students WHERE id = $1 AND tutor_id = $2',
  groups: 'SELECT 1 FROM groups WHERE id = $1 AND tutor_id = $2',
  library_items: 'SELECT 1 FROM library_items WHERE id = $1 AND tutor_id = $2',
  courses: 'SELECT 1 FROM courses WHERE id = $1 AND tutor_id = $2',
  assignments: 'SELECT 1 FROM assignments WHERE id = $1 AND tutor_id = $2',
  course_units: 'SELECT 1 FROM course_units u JOIN courses c ON c.id = u.course_id WHERE u.id = $1 AND c.tutor_id = $2',
  lessons: 'SELECT 1 FROM lessons x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  homework: 'SELECT 1 FROM homework x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  subscriptions: 'SELECT 1 FROM subscriptions x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  payments: 'SELECT 1 FROM payments x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  progress_topics: 'SELECT 1 FROM progress_topics x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  monthly_reports: 'SELECT 1 FROM monthly_reports x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  vocab_items: 'SELECT 1 FROM vocab_items x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  booking_requests: 'SELECT 1 FROM booking_requests x JOIN students s ON s.id = x.student_id WHERE x.id = $1 AND s.tutor_id = $2',
  users: 'SELECT 1 FROM users WHERE id = $1 AND tutor_id = $2',
};
async function owns(user, table, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return false;
  const { rows } = await query(OWNER_SQL[table], [n, user.tid]);
  return Boolean(rows[0]);
}

// Middleware: запись из :param должна принадлежать репетитору, иначе 404
function requireOwn(table, param = 'id', message = 'Не найдено') {
  return async (req, res, next) => {
    try {
      if (!(await owns(req.user, table, req.params[param]))) return res.status(404).json({ error: message });
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Только сисадмин
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Недостаточно прав' });
  next();
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
  owns,
  requireOwn,
  requireAdmin,
};
