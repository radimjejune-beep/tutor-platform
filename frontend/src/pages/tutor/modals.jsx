// pages/tutor/modals.jsx — формы преподавателя в модальных окнах
import { useState } from 'react';
import { api } from '../../api';
import { Modal, Field, useSubmit, useToast, useLoad, Badge, Icon } from '../../ui';
import {
  LESSON_STATUS, SKILLS, METHOD, CATEGORY,
  toLocalInput, fromLocalInput, todayISO, rub, relativeDay, time, dayMonth, lessonsWord,
} from '../../format';

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
const orNull = (v) => (v && String(v).trim() ? String(v).trim() : null);

function Actions({ onClose, busy, label, children }) {
  return (
    <div className="modal-actions">
      {children}
      <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
      <button className="btn" disabled={busy}>{busy ? 'Сохраняем…' : label}</button>
    </div>
  );
}

/* ============================================================
   Новое занятие (или серия)
   ============================================================ */
export function NewLessonModal({ studentId, defaultStart, onClose, onSaved }) {
  const toast = useToast();
  const students = useLoad(() => (studentId ? Promise.resolve([]) : api.students()), []);
  const start = defaultStart || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  })();

  const [f, setF] = useState({
    student_id: studentId || '',
    starts_at: toLocalInput(start),
    duration_min: '',
    price: '',
    topic: '',
    repeat_weeks: 1,
  });
  const [conflicts, setConflicts] = useState(null);

  const picked = (students.data || []).find((s) => s.id === Number(f.student_id));

  const { busy, error, submit } = useSubmit(async () => {
    const body = {
      student_id: Number(f.student_id),
      starts_at: fromLocalInput(f.starts_at),
      duration_min: num(f.duration_min),
      price: num(f.price),
      topic: f.topic.trim() || undefined,
      repeat_weeks: Number(f.repeat_weeks) || 1,
      force: Boolean(conflicts),
    };
    try {
      const created = await api.createLessons(body);
      toast(created.length > 1 ? `Создано ${lessonsWord(created.length)}` : 'Занятие добавлено');
      onSaved();
    } catch (err) {
      if (err.status === 409 && err.body?.conflicts) {
        setConflicts(err.body.conflicts);
        return;
      }
      throw err;
    }
  });

  return (
    <Modal title="Новое занятие" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!studentId && (
          <Field label="Ученик">
            <select className="select" value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} required>
              <option value="">Выберите ученика</option>
              {(students.data || []).map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-row">
          <Field label="Дата и время">
            <input className="input" type="datetime-local" value={f.starts_at}
              onChange={(e) => { setF({ ...f, starts_at: e.target.value }); setConflicts(null); }} required />
          </Field>
          <Field label="Повторять" hint="Каждую неделю в это же время">
            <select className="select" value={f.repeat_weeks} onChange={(e) => { setF({ ...f, repeat_weeks: e.target.value }); setConflicts(null); }}>
              <option value={1}>Один раз</option>
              {[4, 8, 12, 16].map((n) => <option key={n} value={n}>{n} недель</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Длительность, мин" hint={picked ? `По умолчанию ${picked.default_duration}` : undefined}>
            <input className="input" type="number" min={15} max={240} step={5} placeholder="60" value={f.duration_min}
              onChange={(e) => setF({ ...f, duration_min: e.target.value })} />
          </Field>
          <Field label="Цена разового занятия" hint={picked ? `По умолчанию ${rub(picked.default_price)}` : 'Если нет абонемента'}>
            <input className="input" type="number" min={0} step={50} placeholder="1500" value={f.price}
              onChange={(e) => setF({ ...f, price: e.target.value })} />
          </Field>
        </div>
        <Field label="Тема" hint="Видят ученик и родитель">
          <input className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Present Simple: questions" />
        </Field>

        {conflicts && (
          <div className="note">
            В это время уже есть занятия:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {conflicts.map((c) => (
                <li key={`${c.id}-${c.starts_at}`}>{c.student_name}, {dayMonth(c.starts_at)} в {time(c.starts_at)}</li>
              ))}
            </ul>
            Нажмите «Создать всё равно», если так и задумано.
          </div>
        )}
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label={conflicts ? 'Создать всё равно' : 'Создать'} />
      </form>
    </Modal>
  );
}

/* ============================================================
   Занятие: отметить, перенести, записать итог
   ============================================================ */
const STATUS_ORDER = ['done', 'missed', 'cancelled_late', 'cancelled', 'scheduled'];

export function LessonModal({ lesson, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    status: lesson.status,
    starts_at: toLocalInput(lesson.starts_at),
    duration_min: lesson.duration_min,
    price: lesson.price,
    topic: lesson.topic || '',
    summary: lesson.summary || '',
    private_notes: lesson.private_notes || '',
    call_link: lesson.call_link || '',
    notify: !lesson.summary_sent_at,
  });
  const tgStatus = useLoad(() => api.telegramStatus(), []);
  const tgOn = tgStatus.data?.enabled;

  const { busy, error, submit } = useSubmit(async () => {
    const saved = await api.updateLesson(lesson.id, {
      status: f.status,
      starts_at: fromLocalInput(f.starts_at),
      duration_min: Number(f.duration_min),
      price: Number(f.price),
      topic: orNull(f.topic),
      summary: orNull(f.summary),
      private_notes: orNull(f.private_notes),
      call_link: orNull(f.call_link),
    });
    let msg = saved.charged && !lesson.charged ? 'Сохранено, занятие списано' : 'Сохранено';
    // Итоги — родителям в Telegram
    if (tgOn && f.notify && (orNull(f.summary) || orNull(f.topic)) && f.status === 'done') {
      try {
        const r = await api.sendLessonSummary(lesson.id);
        msg += r.sent.length ? `. Итоги отправлены: ${r.sent.join(', ')}` : '. Никто из родителей не подключил Telegram';
      } catch (err) {
        msg += `. Итоги не отправлены: ${err.message}`;
      }
    }
    toast(msg);
    onSaved();
  });

  const remove = async () => {
    if (!window.confirm('Удалить занятие из расписания?')) return;
    try {
      await api.deleteLesson(lesson.id);
      toast('Занятие удалено');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal title={lesson.student_name || 'Занятие'} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: -12 }}>
        {relativeDay(lesson.starts_at)}, {dayMonth(lesson.starts_at)} в {time(lesson.starts_at)}
        {lesson.charged && (lesson.subscription_id ? ', списано с абонемента' : `, списано разово ${rub(lesson.price)}`)}
      </p>
      <div className="row wrap" style={{ gap: 8, marginTop: -4, marginBottom: 18 }}>
        <a className="btn btn-sm" href={`#/lesson/${lesson.id}`} onClick={onClose}><Icon name="board" /> Комната урока</a>
        {(lesson.join_link || lesson.call_link) && (
          <a className="btn btn-secondary btn-sm" href={lesson.join_link || lesson.call_link} target="_blank" rel="noreferrer"><Icon name="video" /> Звонок</a>
        )}
      </div>
      <form className="form" onSubmit={submit}>
        <Field label="Как прошло">
          <div className="row wrap" style={{ gap: 8 }}>
            {STATUS_ORDER.map((s) => (
              <button key={s} type="button"
                className={`btn btn-sm ${f.status === s ? '' : 'btn-secondary'}`}
                onClick={() => setF({ ...f, status: s })} aria-pressed={f.status === s}>
                {LESSON_STATUS[s].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Тема" hint="Видят ученик и родитель">
          <input className="input" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
        </Field>
        <Field label="Что сделали на занятии" hint="Видят ученик и родитель">
          <textarea className="textarea" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })}
            placeholder="Разобрали вопросы в Present Simple, новая лексика по теме Daily routine" />
        </Field>
        {tgOn && (
          <label className="check" style={{ marginTop: -6 }}>
            <input type="checkbox" checked={f.notify} onChange={(e) => setF({ ...f, notify: e.target.checked })} />
            <span>
              Отправить итоги родителям в Telegram при сохранении{f.status !== 'done' ? ' (когда урок отмечен проведённым)' : ''}
              {lesson.summary_sent_at && <span className="muted"> — уже отправлялись {dayMonth(lesson.summary_sent_at)} в {time(lesson.summary_sent_at)}</span>}
            </span>
          </label>
        )}
        <Field label="Заметки для себя" hint="Видите только вы">
          <textarea className="textarea" style={{ minHeight: 70 }} value={f.private_notes}
            onChange={(e) => setF({ ...f, private_notes: e.target.value })} />
        </Field>
        <Field label="Ссылка на звонок для этого урока" hint="Если пусто — берётся постоянная ссылка из карточки ученика">
          <input className="input" type="url" value={f.call_link} onChange={(e) => setF({ ...f, call_link: e.target.value })} placeholder="https://telemost.yandex.ru/j/…" />
        </Field>
        <div className="form-row">
          <Field label="Дата и время">
            <input className="input" type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} required />
          </Field>
          <div className="form-row" style={{ gap: 10 }}>
            <Field label="Минут">
              <input className="input" type="number" min={15} max={240} step={5} value={f.duration_min}
                onChange={(e) => setF({ ...f, duration_min: e.target.value })} required />
            </Field>
            <Field label="Цена, ₽">
              <input className="input" type="number" min={0} step={50} value={f.price}
                onChange={(e) => setF({ ...f, price: e.target.value })} required />
            </Field>
          </div>
        </div>
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label="Сохранить">
          {!lesson.charged && (
            <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>Удалить</button>
          )}
        </Actions>
      </form>
    </Modal>
  );
}

/* ============================================================
   Ученик: создать / изменить карточку
   ============================================================ */
export function StudentModal({ student, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    full_name: student?.full_name || '',
    category: student?.category || 'adult',
    level: student?.level || '',
    goal: student?.goal || '',
    textbook: student?.textbook || '',
    default_price: student?.default_price ?? 1500,
    default_duration: student?.default_duration ?? 60,
    board_link: student?.board_link || '',
    call_link: student?.call_link || '',
    notes: student?.notes || '',
    status: student?.status || 'active',
    consent: Boolean(student?.pd_consent_at),
  });

  const { busy, error, submit } = useSubmit(async () => {
    const body = {
      full_name: f.full_name.trim(),
      category: f.category,
      level: orNull(f.level),
      goal: orNull(f.goal),
      textbook: orNull(f.textbook),
      default_price: Number(f.default_price) || 0,
      default_duration: Number(f.default_duration) || 60,
      board_link: orNull(f.board_link),
      call_link: orNull(f.call_link),
      notes: orNull(f.notes),
    };
    if (student) body.status = f.status;
    // Отметка о согласии на обработку ПДн: ставим дату один раз
    if (f.consent && !student?.pd_consent_at) body.pd_consent_at = new Date().toISOString();
    if (!f.consent && student?.pd_consent_at) body.pd_consent_at = null;

    const saved = student ? await api.updateStudent(student.id, body) : await api.createStudent(body);
    toast(student ? 'Карточка обновлена' : 'Ученик добавлен');
    onSaved(saved);
  });

  return (
    <Modal title={student ? 'Карточка ученика' : 'Новый ученик'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Field label="Имя и фамилия">
            <input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required minLength={2} autoFocus />
          </Field>
          <Field label="Кто">
            <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Уровень">
            <input className="input" value={f.level} placeholder="A2" onChange={(e) => setF({ ...f, level: e.target.value })} />
          </Field>
          <Field label="Учебник">
            <input className="input" value={f.textbook} placeholder="Speakout A1" onChange={(e) => setF({ ...f, textbook: e.target.value })} />
          </Field>
        </div>
        <Field label="Цель" hint="Видят ученик и родитель">
          <input className="input" value={f.goal} placeholder="Экзамен по юридическому английскому" onChange={(e) => setF({ ...f, goal: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Цена разового занятия, ₽">
            <input className="input" type="number" min={0} step={50} value={f.default_price} onChange={(e) => setF({ ...f, default_price: e.target.value })} />
          </Field>
          <Field label="Длительность, мин">
            <input className="input" type="number" min={15} max={240} step={5} value={f.default_duration} onChange={(e) => setF({ ...f, default_duration: e.target.value })} />
          </Field>
        </div>
        <Field label="Постоянная ссылка на звонок" hint="Телемост, Zoom или Meet — появится кнопка «Войти в звонок» у ученика">
          <input className="input" type="url" value={f.call_link} placeholder="https://telemost.yandex.ru/j/…" onChange={(e) => setF({ ...f, call_link: e.target.value })} />
        </Field>
        <Field label="Ссылка на доску в Холсте" hint="Ученик откроет её из кабинета одной кнопкой">
          <input className="input" type="url" value={f.board_link} placeholder="https://holst.so/…" onChange={(e) => setF({ ...f, board_link: e.target.value })} />
        </Field>
        <Field label="Заметки" hint="Видите только вы">
          <textarea className="textarea" style={{ minHeight: 70 }} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {student && (
          <Field label="Статус">
            <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="active">Занимается</option>
              <option value="paused">На паузе</option>
              <option value="archived">В архиве</option>
            </select>
          </Field>
        )}
        <label className="check">
          <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          Согласие на обработку персональных данных получено
        </label>
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label={student ? 'Сохранить' : 'Добавить ученика'} />
      </form>
    </Modal>
  );
}

/* ============================================================
   Выданный логин и пароль — показать один раз
   ============================================================ */
export function CredentialsCard({ login, password, who }) {
  const toast = useToast();
  const text = `Вход в кабинет\nЛогин: ${login}\nПароль: ${password}\nСайт: ${window.location.origin}`;
  return (
    <div className="secret">
      <div className="small muted" style={{ marginBottom: 6 }}>{who}</div>
      <div className="secret-row"><span>Логин</span><strong>{login}</strong></div>
      <div className="secret-row"><span>Пароль</span><strong>{password}</strong></div>
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }}
        onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Скопировано, можно отправить в мессенджер'))}>
        Скопировать для отправки
      </button>
      <div className="small muted" style={{ marginTop: 8 }}>Пароль больше нигде не покажется. Если потеряется — задайте новый.</div>
    </div>
  );
}

/* ============================================================
   Вход для ученика / родителя
   ============================================================ */
export function AccountModal({ student, kind, onClose, onSaved }) {
  const isParent = kind === 'parent';
  const parents = useLoad(() => (isParent ? api.parents() : Promise.resolve([])), []);
  const [mode, setMode] = useState('new');
  const [f, setF] = useState({ full_name: '', login: '', password: '', parent_user_id: '' });
  const [result, setResult] = useState(null);

  const { busy, error, submit } = useSubmit(async () => {
    const extra = { login: orNull(f.login) || undefined, password: orNull(f.password) || undefined };
    let res;
    if (!isParent) res = await api.createStudentLogin(student.id, extra);
    else if (mode === 'existing') res = await api.addParent(student.id, { parent_user_id: Number(f.parent_user_id) });
    else res = await api.addParent(student.id, { full_name: f.full_name.trim(), ...extra });
    onSaved();
    if (res.password) setResult(res);
    else onClose();
  });

  if (result) {
    return (
      <Modal title="Вход создан" onClose={onClose}>
        <CredentialsCard login={result.login} password={result.password} who={result.full_name} />
        <div className="modal-actions"><button className="btn" onClick={onClose}>Готово</button></div>
      </Modal>
    );
  }

  const otherParents = (parents.data || []).filter((p) => !p.children.some((c) => c.id === student.id));

  return (
    <Modal title={isParent ? 'Вход для родителя' : 'Вход для ученика'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {isParent && otherParents.length > 0 && (
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className={`btn btn-sm ${mode === 'new' ? '' : 'btn-secondary'}`} onClick={() => setMode('new')}>Новый родитель</button>
            <button type="button" className={`btn btn-sm ${mode === 'existing' ? '' : 'btn-secondary'}`} onClick={() => setMode('existing')}>Уже есть вход</button>
          </div>
        )}

        {isParent && mode === 'existing' ? (
          <Field label="Родитель" hint="Например, если второй ребёнок тоже занимается">
            <select className="select" value={f.parent_user_id} onChange={(e) => setF({ ...f, parent_user_id: e.target.value })} required>
              <option value="">Выберите</option>
              {otherParents.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.children.map((c) => c.full_name).join(', ')})</option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            {isParent ? (
              <Field label="Имя и фамилия родителя">
                <input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required minLength={2} autoFocus />
              </Field>
            ) : (
              <p className="muted" style={{ margin: 0 }}>Логин сделаем из имени: {student.full_name}. Можно задать свой.</p>
            )}
            <div className="form-row">
              <Field label="Логин" hint="Необязательно, латиницей">
                <input className="input" value={f.login} autoCapitalize="none" placeholder="создастся сам" onChange={(e) => setF({ ...f, login: e.target.value })} />
              </Field>
              <Field label="Пароль" hint="Необязательно, от 6 символов">
                <input className="input" value={f.password} placeholder="создастся сам" onChange={(e) => setF({ ...f, password: e.target.value })} />
              </Field>
            </div>
          </>
        )}
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label="Создать вход" />
      </form>
    </Modal>
  );
}

export function ResetPasswordModal({ account, onClose }) {
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const { busy, error, submit } = useSubmit(async () => {
    setResult(await api.resetPassword(account.id, orNull(password) || undefined));
  });
  return (
    <Modal title="Новый пароль" onClose={onClose}>
      {result ? (
        <>
          <CredentialsCard login={result.login} password={result.password} who={account.full_name} />
          <div className="modal-actions"><button className="btn" onClick={onClose}>Готово</button></div>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="muted" style={{ margin: 0 }}>{account.full_name}, логин {account.login}. Старый пароль перестанет работать.</p>
          <Field label="Новый пароль" hint="Оставьте пустым — придумаем сами">
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} />
          </Field>
          {error && <div className="alert">{error}</div>}
          <Actions onClose={onClose} busy={busy} label="Задать пароль" />
        </form>
      )}
    </Modal>
  );
}

/* ============================================================
   Абонемент и оплата
   ============================================================ */
export function SubscriptionModal({ student, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    lessons_total: 8,
    price_total: (student.default_price || 0) * 8,
    starts_on: todayISO(),
    expires_on: '',
    paid: true,
    receipt_url: '',
  });
  const perLesson = f.lessons_total ? Math.round(f.price_total / f.lessons_total) : 0;

  const { busy, error, submit } = useSubmit(async () => {
    const lessons = Number(f.lessons_total);
    const price = Number(f.price_total);
    await api.createSubscription({
      student_id: student.id,
      title: `Абонемент на ${lessonsWord(lessons)}`,
      lessons_total: lessons,
      price_total: price,
      starts_on: f.starts_on,
      expires_on: f.expires_on || null,
      payment: f.paid && price > 0 ? { amount: price, paid_on: todayISO(), receipt_url: orNull(f.receipt_url) } : undefined,
    });
    toast('Абонемент оформлен');
    onSaved();
  });

  return (
    <Modal title="Новый абонемент" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="row wrap" style={{ gap: 8 }}>
          {[4, 8, 12].map((n) => (
            <button key={n} type="button" className={`btn btn-sm ${Number(f.lessons_total) === n ? '' : 'btn-secondary'}`}
              onClick={() => setF({ ...f, lessons_total: n, price_total: (student.default_price || 0) * n })}>
              {lessonsWord(n)}
            </button>
          ))}
        </div>
        <div className="form-row">
          <Field label="Занятий">
            <input className="input" type="number" min={1} max={200} value={f.lessons_total} onChange={(e) => setF({ ...f, lessons_total: e.target.value })} required />
          </Field>
          <Field label="Стоимость, ₽" hint={perLesson ? `${rub(perLesson)} за занятие` : undefined}>
            <input className="input" type="number" min={0} step={100} value={f.price_total} onChange={(e) => setF({ ...f, price_total: e.target.value })} required />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Действует с">
            <input className="input" type="date" value={f.starts_on} onChange={(e) => setF({ ...f, starts_on: e.target.value })} required />
          </Field>
          <Field label="Действует до" hint="Необязательно">
            <input className="input" type="date" value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />
          Оплачен сегодня
        </label>
        {f.paid && (
          <Field label="Ссылка на чек «Мой налог»" hint="Можно добавить позже">
            <input className="input" type="url" value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} />
          </Field>
        )}
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label="Оформить" />
      </form>
    </Modal>
  );
}

export function PaymentModal({ student, payment, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    amount: payment?.amount || '',
    paid_on: payment?.paid_on?.slice(0, 10) || todayISO(),
    method: payment?.method || 'transfer',
    receipt_url: payment?.receipt_url || '',
    comment: payment?.comment || '',
  });
  const { busy, error, submit } = useSubmit(async () => {
    if (payment) {
      await api.updatePayment(payment.id, { receipt_url: orNull(f.receipt_url), comment: orNull(f.comment) });
    } else {
      await api.createPayment({
        student_id: student.id,
        amount: Number(f.amount),
        paid_on: f.paid_on,
        method: f.method,
        receipt_url: orNull(f.receipt_url),
        comment: orNull(f.comment),
      });
    }
    toast(payment ? 'Оплата обновлена' : 'Оплата добавлена');
    onSaved();
  });

  return (
    <Modal title={payment ? 'Оплата' : 'Новая оплата'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Field label="Сумма, ₽">
            <input className="input" type="number" min={1} value={f.amount} disabled={Boolean(payment)}
              onChange={(e) => setF({ ...f, amount: e.target.value })} required autoFocus={!payment} />
          </Field>
          <Field label="Дата">
            <input className="input" type="date" value={f.paid_on} disabled={Boolean(payment)}
              onChange={(e) => setF({ ...f, paid_on: e.target.value })} required />
          </Field>
        </div>
        {!payment && (
          <Field label="Способ">
            <select className="select" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        )}
        <Field label="Ссылка на чек «Мой налог»">
          <input className="input" type="url" value={f.receipt_url} onChange={(e) => setF({ ...f, receipt_url: e.target.value })} />
        </Field>
        <Field label="Комментарий">
          <input className="input" value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} />
        </Field>
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label="Сохранить" />
      </form>
    </Modal>
  );
}

/* ============================================================
   Темы программы: список строк → темы
   ============================================================ */
export function TopicsModal({ studentId, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ section: '', skill: 'grammar', items: '' });
  const { busy, error, submit } = useSubmit(async () => {
    const items = f.items.split('\n').map((s) => s.trim()).filter(Boolean).map((title) => ({ title, skill: f.skill }));
    if (!items.length) throw new Error('Добавьте хотя бы одну тему');
    await api.addTopics({ student_id: studentId, section: orNull(f.section), items });
    toast(`Добавлено тем: ${items.length}`);
    onSaved();
  });
  return (
    <Modal title="Темы программы" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="form-row">
          <Field label="Раздел">
            <input className="input" value={f.section} placeholder="Speakout A1, Unit 3" onChange={(e) => setF({ ...f, section: e.target.value })} />
          </Field>
          <Field label="Навык">
            <select className="select" value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })}>
              {Object.entries(SKILLS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Темы" hint="Каждая с новой строки">
          <textarea className="textarea" style={{ minHeight: 150 }} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })}
            placeholder={'Present Simple: questions\nDaily routine vocabulary\nTelling the time'} autoFocus />
        </Field>
        {error && <div className="alert">{error}</div>}
        <Actions onClose={onClose} busy={busy} label="Добавить" />
      </form>
    </Modal>
  );
}

/* ============================================================
   Ежемесячный отчёт
   ============================================================ */
export function ReportModal({ studentId, month, report, onClose, onSaved }) {
  const toast = useToast();
  const stats = useLoad(() => api.monthStats(studentId, month), [studentId, month]);
  const [f, setF] = useState({
    summary: report?.summary || '',
    strengths: report?.strengths || '',
    to_improve: report?.to_improve || '',
    plan_next: report?.plan_next || '',
  });

  const save = async (publish) => {
    const saved = await api.saveReport({
      student_id: studentId,
      month,
      summary: orNull(f.summary),
      strengths: orNull(f.strengths),
      to_improve: orNull(f.to_improve),
      plan_next: orNull(f.plan_next),
    });
    if (publish !== undefined) await api.updateReport(saved.id, { published: publish });
    toast(publish ? 'Отчёт опубликован, его видят ученик и родители' : 'Черновик сохранён');
    onSaved();
  };
  const draft = useSubmit(() => save());
  const publish = useSubmit(() => save(true));
  const s = stats.data;

  return (
    <Modal title="Отчёт за месяц" onClose={onClose} wide>
      {s && (
        <div className="row wrap" style={{ gap: 8, marginTop: -8, marginBottom: 18 }}>
          <Badge tone="green">Занятий: {s.lessons_done}</Badge>
          {s.lessons_missed > 0 && <Badge tone="brass">Пропусков: {s.lessons_missed}</Badge>}
          <Badge>ДЗ: {s.homework_done} из {s.homework_given}</Badge>
          {s.homework_avg_score !== null && <Badge>Средняя оценка ДЗ: {s.homework_avg_score}%</Badge>}
          {s.topics_completed?.length > 0 && <Badge>Пройдено тем: {s.topics_completed.length}</Badge>}
        </div>
      )}
      <div className="form">
        <Field label="Общий итог">
          <textarea className="textarea" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} autoFocus />
        </Field>
        <div className="form-row">
          <Field label="Что получается">
            <textarea className="textarea" value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} />
          </Field>
          <Field label="Над чем работаем">
            <textarea className="textarea" value={f.to_improve} onChange={(e) => setF({ ...f, to_improve: e.target.value })} />
          </Field>
        </div>
        <Field label="План на следующий месяц">
          <textarea className="textarea" style={{ minHeight: 70 }} value={f.plan_next} onChange={(e) => setF({ ...f, plan_next: e.target.value })} />
        </Field>
        {(draft.error || publish.error) && <div className="alert">{draft.error || publish.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-secondary" disabled={draft.busy} onClick={draft.submit}>Сохранить черновик</button>
          <button type="button" className="btn" disabled={publish.busy} onClick={publish.submit}>Опубликовать</button>
        </div>
      </div>
    </Modal>
  );
}
