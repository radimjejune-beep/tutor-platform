// api.js — все запросы к бэкенду в одном месте
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const TOKEN_KEY = 'tp_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

// Ошибка API с понятным текстом от сервера
export class ApiError extends Error {
  constructor(status, body) {
    const details = body?.details?.length ? ` (${body.details.join('; ')})` : '';
    super((body?.error || 'Не удалось выполнить запрос') + details);
    this.status = status;
    this.body = body;
  }
}

// Вызывается при 401 — приложение выкидывает на экран входа
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { error: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз' });
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Собрать строку запроса без пустых значений
const qs = (params) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p)}` : '';
};

export const api = {
  // Вход
  login: (login, password) => request('POST', '/auth/login', { login, password }),
  me: () => request('GET', '/auth/me'),
  changePassword: (current_password, new_password) =>
    request('POST', '/auth/change-password', { current_password, new_password }),

  dashboard: () => request('GET', '/dashboard'),

  // Ученики
  students: (status = 'active') => request('GET', `/students${qs({ status })}`),
  student: (id) => request('GET', `/students/${id}`),
  createStudent: (data) => request('POST', '/students', data),
  updateStudent: (id, data) => request('PATCH', `/students/${id}`, data),
  createStudentLogin: (id, data) => request('POST', `/students/${id}/login`, data),
  addParent: (id, data) => request('POST', `/students/${id}/parents`, data),
  removeParent: (id, userId) => request('DELETE', `/students/${id}/parents/${userId}`),
  parents: () => request('GET', '/students/accounts/parents'),
  resetPassword: (userId, password) =>
    request('POST', `/accounts/${userId}/reset-password`, password ? { password } : {}),
  setAccountActive: (userId, is_active) => request('PATCH', `/accounts/${userId}`, { is_active }),

  // Занятия
  lessons: (params) => request('GET', `/lessons${qs(params)}`),
  createLessons: (data) => request('POST', '/lessons', data),
  updateLesson: (id, data) => request('PATCH', `/lessons/${id}`, data),
  deleteLesson: (id) => request('DELETE', `/lessons/${id}`),

  // Финансы
  finance: (studentId) => request('GET', `/finance/students/${studentId}`),
  createSubscription: (data) => request('POST', '/finance/subscriptions', data),
  updateSubscription: (id, data) => request('PATCH', `/finance/subscriptions/${id}`, data),
  createPayment: (data) => request('POST', '/finance/payments', data),
  updatePayment: (id, data) => request('PATCH', `/finance/payments/${id}`, data),
  deletePayment: (id) => request('DELETE', `/finance/payments/${id}`),
  summary: (month) => request('GET', `/finance/summary${qs({ month })}`),

  // ДЗ
  homework: (params) => request('GET', `/homework${qs(params)}`),
  createHomework: (data) => request('POST', '/homework', data),
  updateHomework: (id, data) => request('PATCH', `/homework/${id}`, data),
  deleteHomework: (id) => request('DELETE', `/homework/${id}`),
  submitHomework: (id, student_answer) => request('POST', `/homework/${id}/submit`, { student_answer }),

  // Прогресс и отчёты
  progress: (studentId) => request('GET', `/progress/students/${studentId}`),
  addTopics: (data) => request('POST', '/progress/topics', data),
  updateTopic: (id, data) => request('PATCH', `/progress/topics/${id}`, data),
  deleteTopic: (id) => request('DELETE', `/progress/topics/${id}`),
  monthStats: (studentId, month) => request('GET', `/progress/students/${studentId}/month-stats${qs({ month })}`),
  saveReport: (data) => request('PUT', '/progress/reports', data),
  updateReport: (id, data) => request('PATCH', `/progress/reports/${id}`, data),
  report: (id) => request('GET', `/progress/reports/${id}`),
};
