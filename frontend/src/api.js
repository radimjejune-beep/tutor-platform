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

  // Задания (преподаватель)
  assignments: () => request('GET', '/assignments'),
  assignment: (id) => request('GET', `/assignments/${id}`),
  createAssignment: (data) => request('POST', '/assignments', data),
  updateAssignment: (id, data) => request('PATCH', `/assignments/${id}`, data),
  deleteAssignment: (id) => request('DELETE', `/assignments/${id}`),

  // Работы учеников
  homework: (params) => request('GET', `/homework${qs(params)}`),
  homeworkItem: (id) => request('GET', `/homework/${id}`),
  updateHomework: (id, data) => request('PATCH', `/homework/${id}`, data),
  deleteHomework: (id) => request('DELETE', `/homework/${id}`),
  submitHomework: (id, data) => request('POST', `/homework/${id}/submit`, data),
  unsubmitHomework: (id) => request('POST', `/homework/${id}/unsubmit`),

  // Запись и перенос
  bookingSettings: () => request('GET', '/booking/settings'),
  saveBookingSettings: (data) => request('PUT', '/booking/settings', data),
  bookingInfo: () => request('GET', '/booking/info'),
  slots: (student_id, lesson_id) => request('GET', `/booking/slots${qs({ student_id, lesson_id })}`),
  bookingRequests: (status) => request('GET', `/booking/requests${qs({ status })}`),
  createBookingRequest: (data) => request('POST', '/booking/requests', data),
  withdrawRequest: (id) => request('POST', `/booking/requests/${id}/withdraw`),
  approveRequest: (id) => request('POST', `/booking/requests/${id}/approve`),
  declineRequest: (id, tutor_comment) => request('POST', `/booking/requests/${id}/decline`, tutor_comment ? { tutor_comment } : {}),
  cancelLessonClient: (id) => request('POST', `/booking/lessons/${id}/cancel`),

  // Итоги месяцев
  monthSummaries: (studentId) => request('GET', `/progress/students/${studentId}/months`),

  // Документы
  legalPublic: (kind) => request('GET', `/legal/public/${kind}`),
  legalPending: () => request('GET', '/legal/pending'),
  legalAccept: (document_ids) => request('POST', '/legal/accept', { document_ids }),
  legalAdmin: () => request('GET', '/legal/admin'),
  saveLegalDoc: (kind, data) => request('PUT', `/legal/docs/${kind}`, data),

  // Библиотека
  library: (params) => request('GET', `/library${qs(params || {})}`),
  libraryFacets: () => request('GET', '/library/facets'),
  libraryItem: (id) => request('GET', `/library/${id}`),
  libraryBatch: (ids) => (ids?.length ? request('GET', `/library/batch${qs({ ids: ids.join(',') })}`) : Promise.resolve([])),
  createLibraryItem: (data) => request('POST', '/library', data),
  updateLibraryItem: (id, data) => request('PATCH', `/library/${id}`, data),
  deleteLibraryItem: (id) => request('DELETE', `/library/${id}`),

  // Комната урока
  lessonRoom: (id) => request('GET', `/lessons/${id}/room`),
  setLessonItems: (id, item_ids) => request('PUT', `/lessons/${id}/items`, { item_ids }),
  sendLessonSummary: (id) => request('POST', `/lessons/${id}/send-summary`),

  // Telegram
  telegramStatus: () => request('GET', '/telegram/status'),
  telegramLink: () => request('POST', '/telegram/link'),
  telegramUnlink: () => request('DELETE', '/telegram/link'),
  telegramOverview: () => request('GET', '/telegram/overview'),

  // Файлы
  uploadFile: async (target, file) => {
    const prepared = await prepareFile(file);
    return request('POST', '/files', { ...target, filename: prepared.name, mime: prepared.type, data: prepared.base64 });
  },
  fileBlob: async (id) => {
    const res = await fetch(`${BASE}/api/files/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    return res.blob();
  },
  deleteFile: (id) => request('DELETE', `/files/${id}`),

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

/* ============================================================
   Подготовка файла к загрузке: фото уменьшаем (телефонные снимки весят 3–8 МБ)
   ============================================================ */
const MAX_UPLOAD = 10 * 1024 * 1024;

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Не удалось прочитать файл'));
    r.readAsDataURL(blob);
  });

async function shrinkImage(file, maxSide = 2000, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file; // не картинка, которую умеет браузер — загружаем как есть
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareFile(file) {
  let f = file;
  if (/^image\/(jpeg|png|webp)$/.test(file.type)) f = await shrinkImage(file);
  if (f.size > MAX_UPLOAD) throw new ApiError(413, { error: `«${file.name}» больше 10 МБ` });
  return { name: f.name, type: f.type || 'application/octet-stream', base64: await toBase64(f) };
}
