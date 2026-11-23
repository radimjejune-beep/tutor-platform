// api.js — все запросы к бэкенду в одном месте
// Адрес бэкенда. Берётся из VITE_API_URL; если переменная пустая, с ошибкой
// или указывает на localhost при открытии сайта из интернета, используем адрес бэкенда на RelaxDev.
// На своём домене lessonfold.ru бэкенд живёт на api.lessonfold.ru, на адресе RelaxDev остаётся прежний
import { resolveApiBase } from './api-config';
export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL, typeof location === 'undefined' ? '' : location.hostname);
const BASE = API_BASE;
const TOKEN_KEY = 'tp_token';

let memoryToken = null;
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return memoryToken; }
};
export const setToken = (t) => {
  memoryToken = t || null;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* Вход работает до закрытия вкладки. */ }
};

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(0, { error: err.name === 'AbortError' ? 'Сервер долго не отвечает. Попробуйте ещё раз' : `Нет связи с сервером (${BASE}). Проверьте интернет и попробуйте ещё раз` });
  } finally {
    clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login' && token && token === getToken()) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Собрать строку запроса без пустых значений
const qs = (params) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${new URLSearchParams(p)}` : '';
};

export const api = {
  coursePosition:(id,data)=>request('PUT',`/marketplace/enrollments/${id}/position`,data),
  registerLearner:data=>request('POST','/auth/register-learner',data),
  coursePreview:(slug,mi,ui)=>request('GET',`/marketplace/public/courses/${encodeURIComponent(slug)}/preview/${mi}/${ui}`),
  saveCourseDraft:(id,data)=>request('PUT',`/marketplace/enrollments/${id}/draft`,data),
  billing:()=>request('GET','/billing'),
  checkoutPlan:data=>request('POST','/billing/checkout',data),
  cancelRenewal:()=>request('POST','/billing/cancel-renewal',{}),
  syncOrder:id=>request('POST',`/billing/orders/${id}/sync`,{}),
  marketplaceCourses:()=>request('GET','/marketplace/public/courses'),
  marketplaceCourse:slug=>request('GET',`/marketplace/public/courses/${encodeURIComponent(slug)}`),
  authorCourses:()=>request('GET','/marketplace/author'),
  authorCourse:id=>request('GET',`/marketplace/author/${id}`),
  createAuthorCourse:()=>request('POST','/marketplace/author',{}),
  saveAuthorCourse:(id,data)=>request('PUT',`/marketplace/author/${id}`,data),
  publishAuthorCourse:id=>request('POST',`/marketplace/author/${id}/publish`,{rights_confirmed:true}),
  myMarketplaceCourses:()=>request('GET','/marketplace/mine'),
  enrollFreeCourse:id=>request('POST',`/marketplace/courses/${id}/enroll`,{}),
  checkoutCourse:(id,data)=>request('POST',`/marketplace/courses/${id}/checkout`,data),
  assignMarketplaceCourse:(id,student_id)=>request('POST',`/marketplace/purchases/${id}/assign`,{student_id}),
  courseEnrollment:id=>request('GET',`/marketplace/enrollments/${id}`),
  courseAttempt:(id,data)=>request('POST',`/marketplace/enrollments/${id}/attempt`,data),
  reviewCourseAttempt:(id,data)=>request('POST',`/marketplace/enrollments/${id}/review`,data),
  courseTemplates: () => request('GET','/supplementary-courses/templates'),
  installVocabularyCourse: () => request('POST','/supplementary-courses/templates/elementary-vocabulary/install',{}),
  supplementaryCourses: id => request('GET',`/supplementary-courses/students/${id}`),
  enrollSupplementary: (id,data) => request('PUT',`/supplementary-courses/students/${id}`,data),
  assignSupplementary: (id,data) => request('POST',`/supplementary-courses/students/${id}/assign`,data),
  languageProgress: id => request('GET', `/progress/students/${id}/language`),
  configureLanguage: (id,data) => request('PUT', `/progress/students/${id}/language`, data),
  assessLanguageGoal: (id,key,data) => request('PATCH', `/progress/students/${id}/language/goals/${encodeURIComponent(key)}`, data),
  confirmLanguageLevel: (id,data) => request('POST', `/progress/students/${id}/language/confirm`, data),
  switchProfile: mode => request('POST','/auth/profile',{mode}),
  familyAccounts: () => request('GET','/students/accounts/family'),
  attachFamilyLogin: (id,parent_user_id) => request('POST',`/students/${id}/family-login`,{parent_user_id}),
  familyConsent: () => request('GET','/legal/family'),
  acceptGuardian: data => request('POST','/legal/guardian-accept',data),
  revokeGuardian: student_id => request('POST','/legal/guardian-revoke',{student_id}),
  bankSearch: params => request('GET', `/bank/search${qs(params)}`),
  appendLessonItems: (id,item_ids) => request('POST', `/lessons/${id}/append-items`, {item_ids}),
  liveState: id => request('GET', `/live/lessons/${id}`),
  liveStart: (id, data) => request('POST', `/live/lessons/${id}/start`, data),
  liveEnd: (id, session_id) => request('POST', `/live/lessons/${id}/end`, {session_id}),
  liveSave: (id, session, data, submit = false) => request('PUT', `/live/lessons/${id}/sessions/${session}/${submit ? 'submit' : 'draft'}`, data),
  coach: id => request('GET', `/coaching/students/${id}`),
  startReview: (id, topic_id) => request('POST', `/coaching/students/${id}/reviews`, {topic_id}),
  review: id => request('GET', `/coaching/reviews/${id}`),
  submitReview: (id, answers) => request('POST', `/coaching/reviews/${id}/submit`, {answers}),
  materialTopic: id => request('GET', `/coaching/materials/${id}/topic`),
  setMaterialTopic: (id, topic_id) => request('PUT', `/coaching/materials/${id}/topic`, {topic_id}),
  preparationOptions: id => request('GET', `/coaching/students/${id}/preparations`),
  prepareLesson: (id, data) => request('POST', `/coaching/students/${id}/preparations`, data),
  preparation: id => request('GET', `/coaching/preparations/${id}`),
  savePreparation: (id, data) => request('PATCH', `/coaching/preparations/${id}`, data),
  applyPreparation: (id, data) => request('POST', `/coaching/preparations/${id}/apply`, data),
  activityLink: (source,id) => request('GET', `/activity-links/${source}/${id}`),
  createActivityLink: (source,id) => request('POST', `/activity-links/${source}/${id}`, {}),
  disableActivityLink: (source,id) => request('DELETE', `/activity-links/${source}/${id}`),
  moveStudentHomework: (studentId, data) => request('PATCH', `/learning/students/${studentId}/homework-sections`, data),
  grammarTopics: (q = '') => request('GET', `/learning/grammar${qs({ q })}`),
  grammarTopic: (id) => request('GET', `/learning/grammar/${encodeURIComponent(id)}`),
  grammarPractice: (id) => request('GET', `/learning/grammar/${encodeURIComponent(id)}/practice`),
  checkGrammarPractice: (id, data) => request('POST', `/learning/grammar/${encodeURIComponent(id)}/practice`, data),
  grammarBank: (id) => request('GET', `/learning/grammar/${encodeURIComponent(id)}/bank`),
  studySections: (student_id) => request('GET', `/learning/sections${qs({ student_id })}`),
  createStudySection: (data) => request('POST', '/learning/sections', data),
  updateStudySection: (id, data) => request('PATCH', `/learning/sections/${id}`, data),
  deleteStudySection: (id) => request('DELETE', `/learning/sections/${id}`),
  coveredGrammar: (id) => request('GET', `/learning/covered/${id}`),
  diagnostics: (student_id) => request('GET', `/learning/diagnostics${qs({ student_id })}`),
  diagnosticPreview: (data) => request('POST', '/learning/diagnostics/preview', data),
  createDiagnostic: (data) => request('POST', '/learning/diagnostics', data),
  diagnosticTest: (id) => request('GET', `/learning/diagnostics/tests/${id}`),
  diagnosticRun: (id) => request('GET', `/learning/diagnostics/runs/${id}`),
  diagnosticDraft: (id, answers) => request('PUT', `/learning/diagnostics/runs/${id}/draft`, { answers }),
  submitDiagnostic: (id, answers) => request('POST', `/learning/diagnostics/runs/${id}/submit`, { answers }),

  // Вход
  login: (login, password) => request('POST', '/auth/login', { login, password }),
  me: () => request('GET', '/auth/me'),
  register: (data) => request('POST', '/auth/register', data),
  forgotPassword: (email) => request('POST', '/auth/forgot', { email }),
  resetPassword: (token, password) => request('POST', '/auth/reset', { token, password }),
  registrationStatus: () => request('GET', '/auth/registration'),
  shop: () => request('GET', '/shop'),

  // Сисадмин
  adminTutors: () => request('GET', '/admin/tutors'),
  adminMetrics: () => request('GET', '/admin/metrics'),
  adminSystem: () => request('GET', '/admin/system'),
  adminBackup: () => request('POST', '/admin/backup'),
  adminTestMail: () => request('POST', '/admin/test-mail'),
  adminCreateTutor: (data) => request('POST', '/admin/tutors', data),
  adminSetTutorActive: (id, is_active) => request('PATCH', `/admin/tutors/${id}`, { is_active }),
  adminSetTutorAdmin: (id, is_admin) => request('PATCH', `/admin/tutors/${id}`, { is_admin }),
  shopAdminLink: () => request('POST', '/shop/admin-link', {}),
  adminResetTutor: (id) => request('POST', `/admin/tutors/${id}/reset-password`),
  adminSetRegistration: (open) => request('PUT', '/admin/registration', { open }),
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
  archiveAssignments:(ids,archived)=>request('POST','/assignments/archive',{ids,archived}),
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
  saveHomeworkDraft: (id, data) => request('PUT', `/homework/${id}/draft`, data),
  unsubmitHomework: (id) => request('POST', `/homework/${id}/unsubmit`),

  // Запись и перенос
  autoSettings: () => request('GET', '/lessons/auto-settings'),
  saveAutoSettings: (data) => request('PUT', '/lessons/auto-settings', data),
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
  legalPublic: (kind, t) => request('GET', `/legal/public/${kind}${qs({ t })}`),
  legalPending: () => request('GET', '/legal/pending'),
  legalAccept: (document_ids) => request('POST', '/legal/accept', { document_ids }),
  legalAdmin: () => request('GET', '/legal/admin'),
  saveLegalDoc: (kind, data) => request('PUT', `/legal/docs/${kind}`, data),

  // Библиотека
  library: (params) => request('GET', `/library${qs(params || {})}`),
  setSubject: (subject) => request('PUT', '/auth/subject', { subject }),
  setProfile: (full_name) => request('PUT', '/auth/profile', { full_name }),
  setEmail: (email, password) => request('PUT', '/auth/email', { email, password }),
  demoStatus: () => request('GET', '/demo'),
  sandboxCreate: () => request('POST', '/sandbox'),
  sandboxInfo: () => request('GET', '/sandbox'),
  sandboxAsStudent: (student_id) => request('POST', '/sandbox/as-student', student_id ? { student_id } : {}),
  demoCreate: () => request('POST', '/demo'),
  demoDelete: () => request('DELETE', '/demo'),
  libraryFacets: () => request('GET', '/library/facets'),
  folders: () => request('GET', '/library-folders'),
  createFolder: (data) => request('POST', '/library-folders', data),
  createBookFolder: (data) => request('POST', '/library-folders/book', data),
  updateFolder: (id, data) => request('PATCH', `/library-folders/${id}`, data),
  deleteFolder: (id) => request('DELETE', `/library-folders/${id}`),
  moveToFolder: (item_ids, folder_id) => request('POST', '/library-folders/move', { item_ids, folder_id }),
  myPlan: () => request('GET', '/plan'),
  requestPlan: (plan, period) => request('POST', '/plan/request', { plan, period }),
  publicPlans: () => request('GET', '/plans'),
  onboarding: () => request('GET', '/dashboard/onboarding'),
  platformDocs: () => request('GET', '/platform-docs'),
  platformDoc: (kind) => request('GET', `/platform-docs/${encodeURIComponent(kind)}`),
  platformTerms: () => request('GET', '/platform-terms'),
  platformAccept: () => request('POST', '/platform-terms/accept'),
  adminSetPlan: (id, plan, until) => request('PUT', `/admin/tutors/${id}/plan`, { plan, until: until || null }),
  books: () => request('GET', '/library-books'),
  createBook: (data) => request('POST', '/library-books', data),
  finishBook: (id) => request('POST', `/library-books/${id}/finish`),
  updateBook: (id, data) => request('PATCH', `/library-books/${id}`, data),
  deleteBook: (id) => request('DELETE', `/library-books/${id}`),
  // часть файла учебника (до 4 МБ) — сырыми байтами
  uploadBookPart: async (id, n, blob) => {
    const res = await fetch(`${BASE}/api/library-books/${id}/parts/${n}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${getToken()}` }, body: blob });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d); }
  },
  bookBlob: async (id) => {
    const res = await fetch(`${BASE}/api/library-books/${id}/file`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d); }
    return res.blob();
  },
  libraryItem: (id) => request('GET', `/library/${id}`),
  libraryBatch: (ids) => (ids?.length ? request('GET', `/library/batch${qs({ ids: ids.join(',') })}`) : Promise.resolve([])),
  createLibraryItem: (data) => request('POST', '/library', data),
  updateLibraryItem: (id, data) => request('PATCH', `/library/${id}`, data),
  deleteLibraryItem: (id) => request('DELETE', `/library/${id}`),
  importLibrary: (data) => request('POST', '/library/import', data),

  // Упражнения
  saveGameResult: (itemId, data) => request('POST', `/games/${itemId}/results`, data),
  gameResults: (params) => request('GET', `/games/results${qs(params)}`),

  // Комната урока
  lessonRoom: (id) => request('GET', `/lessons/${id}/room`),
  setLessonItems: (id, item_ids) => request('PUT', `/lessons/${id}/items`, { item_ids }),
  sendLessonSummary: (id) => request('POST', `/lessons/${id}/send-summary`),
  finishLesson: (id, data) => request('POST', `/lessons/${id}/finish`, data),
  extendSchedule: (data) => request('POST', '/lessons/extend', data),

  // Курсы по учебнику
  courses: () => request('GET', '/courses'),
  course: (id) => request('GET', `/courses/${id}`),
  createCourse: (data) => request('POST', '/courses', data),
  updateCourse: (id, data) => request('PATCH', `/courses/${id}`, data),
  deleteCourse: (id) => request('DELETE', `/courses/${id}`),
  createUnit: (courseId, data) => request('POST', `/courses/${courseId}/units`, data),
  updateUnit: (id, data) => request('PATCH', `/courses/units/${id}`, data),
  deleteUnit: (id) => request('DELETE', `/courses/units/${id}`),
  orderUnits: (courseId, unit_ids) => request('PUT', `/courses/${courseId}/order`, { unit_ids }),
  studentCourse: (studentId) => request('GET', `/courses/students/${studentId}`),
  setStudentCourse: (studentId, data) => request('POST', `/courses/students/${studentId}`, data),
  nextUnit: (studentId) => request('POST', `/courses/students/${studentId}/next`),
  unitHomework: (unitId, data) => request('POST', `/courses/units/${unitId}/homework`, data),
  unitToLesson: (unitId, lessonId) => request('POST', `/courses/units/${unitId}/lesson/${lessonId}`),

  // Группы
  groups: (status) => request('GET', `/groups${qs({ status })}`),
  group: (id) => request('GET', `/groups/${id}`),
  createGroup: (data) => request('POST', '/groups', data),
  updateGroup: (id, data) => request('PATCH', `/groups/${id}`, data),
  deleteGroup: (id) => request('DELETE', `/groups/${id}`),
  addGroupMember: (id, student_id) => request('POST', `/groups/${id}/members`, { student_id }),
  removeGroupMember: (id, sid) => request('DELETE', `/groups/${id}/members/${sid}`),
  createGroupLessons: (id, data) => request('POST', `/groups/${id}/lessons`, data),
  moveGroupLesson: (id, from, to) => request('POST', `/groups/${id}/lessons/move`, { from, to }),
  cancelGroupLesson: (id, starts_at) => request('POST', `/groups/${id}/lessons/cancel`, { starts_at }),
  finishGroupLesson: (id, data) => request('POST', `/groups/${id}/lessons/finish`, data),

  // Мотивация
  motivation: (student_id) => request('GET', `/motivation${qs({ student_id })}`),
  league: () => request('GET', '/motivation/league'),

  // Страница записи и заявки
  publicTutor: (login) => request('GET', `/public/tutors/${encodeURIComponent(login)}`),
  sendLead: (login, data) => request('POST', `/public/tutors/${encodeURIComponent(login)}/leads`, data),
  profile: () => request('GET', '/leads/profile'),
  saveProfile: (data) => request('PUT', '/leads/profile', data),
  leads: () => request('GET', '/leads'),
  updateLead: (id, status) => request('PATCH', `/leads/${id}`, { status }),
  convertLead: (id) => request('POST', `/leads/${id}/convert`),
  deleteLead: (id) => request('DELETE', `/leads/${id}`),

  // Цена и каталог
  pricing: () => request('GET', '/finance/pricing'),
  bankBooks: () => request('GET', '/bank/books'),
  bankItems: (book, unit) => request('GET', `/bank/items${qs({ book, unit })}`),
  bankBookVocab:book=>request('GET',`/bank/vocab-book${qs({book})}`).then(r=>r.groups),
  bankVocab: (book, unit) => request('GET', `/bank/vocab${qs({ book, unit })}`),
  bankItem: (id) => request('GET', `/bank/items/${id}`),
  bankTake: (id) => request('POST', `/bank/items/${id}/take`),
  bankShare: (data) => request('POST', '/bank/share', data),
  bankHide: (id) => request('DELETE', `/bank/items/${id}`),
  market: () => request('GET', '/market'),
  marketMine: () => request('GET', '/market/mine'),
  publishItem: (data) => request('POST', '/market', data),
  unpublishItem: (id) => request('DELETE', `/market/${id}`),
  getMarketItem: (id) => request('POST', `/market/${id}/get`),
  grantOrder: (id) => request('POST', `/market/orders/${id}/grant`),
  declineOrder: (id) => request('POST', `/market/orders/${id}/decline`),

  // Уведомления
  notifications: () => request('GET', '/notifications'),
  unreadCount: () => request('GET', '/notifications/unread'),
  markRead: (data) => request('POST', '/notifications/read', data),

  // Личный словарь
  // Наборы карточек и самостоятельная тренировка
  wordSets: () => request('GET', '/wordsets'),
  wordSet: (id, student_id) => request('GET', `/wordsets/${id}${qs({ student_id })}`),
  createWordSet: (data) => request('POST', '/wordsets', data),
  updateWordSet: (id, data) => request('PATCH', `/wordsets/${id}`, data),
  deleteWordSet: (id) => request('DELETE', `/wordsets/${id}`),
  mySets: (student_id) => request('GET', `/wordsets/my${qs({ student_id })}`),
  saveSetProgress: (id, data) => request('POST', `/wordsets/${id}/progress`, data),
  resetSet: (id, student_id) => request('POST', `/wordsets/${id}/reset`, { student_id }),
  setToVocab: (id, student_id) => request('POST', `/wordsets/${id}/to-vocab`, { student_id }),
  practiceActivity: (student_id) => request('GET', `/wordsets/activity${qs({ student_id })}`),
  addMyWords: (student_id, items) => request('POST', '/vocab/mine', { student_id, items }),
  deleteMyWord: (id) => request('DELETE', `/vocab/mine/${id}`),

  recommendations: (student_id) => request('GET', `/progress/students/${student_id}/recommendations`),

  // Объявления на главной
  announcements: () => request('GET', '/announcements'),
  createAnnouncement: (data) => request('POST', '/announcements', data),
  updateAnnouncement: (id, data) => request('PATCH', `/announcements/${id}`, data),
  deleteAnnouncement: (id) => request('DELETE', `/announcements/${id}`),

  vocabPractice: (student_id, count) => request('GET', `/vocab/practice${qs({ student_id, count })}`),
  savePractice: (data) => request('POST', '/vocab/practice', data),
  vocab: (student_id) => request('GET', `/vocab${qs({ student_id })}`),
  vocabDue: (student_id, limit) => request('GET', `/vocab/due${qs({ student_id, limit })}`),
  reviewWord: (id, known) => request('POST', `/vocab/${id}/review`, { known }),
  addWords: (student_id, items) => request('POST', '/vocab', { student_id, items }),
  updateWord: (id, data) => request('PATCH', `/vocab/${id}`, data),
  deleteWord: (id) => request('DELETE', `/vocab/${id}`),

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
  homeworkComments: (id) => request('GET', `/homework/${id}/comments`),
  addHomeworkComment: (id, body) => request('POST', `/homework/${id}/comments`, { body }),

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

// Гостевой показ не читает и не отправляет токен кабинета.
async function activityFetch(path,blob=false) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try {
  const r=await fetch(`${BASE}/api/activities/${path}`,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!r.ok)throw new ApiError(r.status,await r.json().catch(()=>({error:'Ссылка недоступна'})));
  return blob?r.blob():r.json();
 }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(0,{error:'Не удалось загрузить упражнение. Попробуйте ещё раз'});}finally{clearTimeout(timer);}
}
export const publicActivity=token=>activityFetch(encodeURIComponent(token));
export const publicActivityFile=(token,id)=>activityFetch(`${encodeURIComponent(token)}/files/${id}`,true);
