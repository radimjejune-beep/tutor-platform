// pages/tutor/StudentPage.jsx — карточка ученика с вкладками
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, navigate, PassMarks, Bar, useToast } from '../../ui';
import {
  StudentModal, NewLessonModal, LessonModal, SubscriptionModal,
  PaymentModal, AccountModal, ResetPasswordModal, TopicsModal, ReportModal,
} from './modals';
import LessonsByDay from '../../components/LessonsByDay';
import {
  CATEGORY, HW_STATUS, SKILLS, METHOD, rub, shortDate, fullDate, monthName, currentMonth, prevMonth,
  lessonsWord, relativeDay, time,
} from '../../format';

const TABS = [
  { key: 'lessons', label: 'Занятия' },
  { key: 'homework', label: 'Задания' },
  { key: 'progress', label: 'Прогресс' },
  { key: 'reports', label: 'Отчёты' },
  { key: 'finance', label: 'Оплаты' },
  { key: 'access', label: 'Доступ' },
];

export default function StudentPage({ id, tab }) {
  const student = useLoad(() => api.student(id), [id]);
  const [editing, setEditing] = useState(false);

  if (student.loading) return <Spinner />;
  if (student.error) return <ErrorBox error={student.error} onRetry={student.reload} />;
  const s = student.data;
  const f = s.finance;
  const activeSub = f.subscriptions.find((x) => x.status === 'active');

  return (
    <>
      <Link to="/students" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}>
        <Icon name="back" /> Ученики
      </Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{s.full_name}</h1>
          <div className="lead">
            {[CATEGORY[s.category], s.level, s.textbook].filter(Boolean).join(', ')}
            {s.goal ? `. ${s.goal}` : ''}
          </div>
        </div>
        <div className="row wrap">
          {s.status !== 'active' && <Badge tone="brass">{s.status === 'paused' ? 'На паузе' : 'В архиве'}</Badge>}
          {s.board_link && (
            <a className="btn btn-secondary" href={s.board_link} target="_blank" rel="noreferrer"><Icon name="board" /> Доска</a>
          )}
          <button className="btn btn-secondary" onClick={() => setEditing(true)}><Icon name="edit" /> Карточка</button>
        </div>
      </div>

      {/* Сводка */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="panel">
          <div className="stat-label">Баланс</div>
          <div className="stat-value num" style={{ color: f.balance < 0 ? 'var(--danger)' : undefined }}>
            {f.balance < 0 ? `−${rub(-f.balance)}` : rub(f.balance)}
          </div>
          <div className="stat-note">{f.balance < 0 ? 'Долг за занятия' : f.balance > 0 ? 'Предоплата' : 'Расчёты закрыты'}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Абонемент</div>
          {activeSub ? (
            <>
              <div className="stat-value num">{f.lessons_remaining} из {activeSub.lessons_total}</div>
              <PassMarks total={activeSub.lessons_total} remaining={activeSub.lessons_remaining} />
            </>
          ) : (
            <>
              <div className="stat-value">Нет</div>
              <div className="stat-note">Занятия списываются разово</div>
            </>
          )}
        </div>
        <div className="panel">
          <div className="stat-label">Разовое занятие</div>
          <div className="stat-value num">{rub(s.default_price)}</div>
          <div className="stat-note">{s.default_duration} минут</div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''}
            onClick={() => navigate(`/students/${id}/${t.key}`)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'lessons' && <LessonsTab student={s} onChange={student.reload} />}
      {tab === 'homework' && <HomeworkTab student={s} />}
      {tab === 'progress' && <ProgressTab student={s} />}
      {tab === 'reports' && <ReportsTab student={s} />}
      {tab === 'finance' && <FinanceTab student={s} onChange={student.reload} />}
      {tab === 'access' && <AccessTab student={s} onChange={student.reload} />}

      {editing && (
        <StudentModal student={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); student.reload(); }} />
      )}
    </>
  );
}

/* ---------- Занятия ---------- */
function LessonsTab({ student, onChange }) {
  const [modal, setModal] = useState(null);
  const from = new Date(Date.now() - 60 * 864e5).toISOString();
  const to = new Date(Date.now() + 90 * 864e5).toISOString();
  const lessons = useLoad(() => api.lessons({ student_id: student.id, from, to }), [student.id]);
  const saved = () => { setModal(null); lessons.reload(); onChange(); };

  const now = Date.now();
  const upcoming = (lessons.data || []).filter((l) => new Date(l.starts_at) >= now || l.status === 'scheduled');
  const past = (lessons.data || []).filter((l) => !upcoming.includes(l)).reverse();

  return (
    <>
      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Впереди</h2>
            <button className="btn btn-sm" onClick={() => setModal({ type: 'new' })}><Icon name="plus" /> Занятие</button>
          </div>
          {lessons.loading && <Spinner />}
          {lessons.data && !upcoming.length && <Empty title="Занятий не запланировано">Добавьте серию, чтобы расписание было на месяц вперёд.</Empty>}
          <LessonsByDay lessons={upcoming} showStudent={false} onOpen={(l) => setModal({ type: 'lesson', lesson: { ...l, student_name: student.full_name } })} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Прошедшие</h2></div>
          {lessons.data && !past.length && <Empty title="Пока ничего" />}
          <LessonsByDay lessons={past} showStudent={false} onOpen={(l) => setModal({ type: 'lesson', lesson: { ...l, student_name: student.full_name } })} />
        </section>
      </div>
      {modal?.type === 'new' && <NewLessonModal studentId={student.id} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'lesson' && <LessonModal lesson={modal.lesson} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}

/* ---------- Задания ---------- */
function HomeworkTab({ student }) {
  const hw = useLoad(() => api.homework({ student_id: student.id }), [student.id]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">Задания</h2>
        <Link to={`/homework/new?student=${student.id}`} className="btn btn-sm"><Icon name="plus" /> Задание</Link>
      </div>
      {hw.loading && <Spinner />}
      {hw.data && !hw.data.length && <Empty title="Заданий пока нет" />}
      {(hw.data || []).map((h) => (
        <div key={h.id} className="assign-row" onClick={() => navigate(`/homework/${h.assignment_id}/review/${h.id}`)}>
          <div className="assign-icon"><Icon name={h.question_count ? 'quiz' : 'book'} /></div>
          <div className="list-main">
            <div className="list-title truncate">{h.title}</div>
            <div className="list-sub truncate">
              {h.due_on ? `Срок: ${shortDate(h.due_on)}` : 'Без срока'}
              {h.quiz_score !== null && h.quiz_score !== undefined ? `. Тест ${h.quiz_score}%` : ''}
            </div>
          </div>
          {h.status === 'checked' && h.score !== null ? (
            <Badge tone="green">{h.score}%</Badge>
          ) : (
            <Badge tone={HW_STATUS[h.status].tone}>{h.status === 'submitted' ? 'Проверить' : HW_STATUS[h.status].label}</Badge>
          )}
        </div>
      ))}
    </section>
  );
}

/* ---------- Прогресс ---------- */
const NEXT_STATUS = { planned: 'in_progress', in_progress: 'done', done: 'planned' };
const TOPIC_STATUS = { planned: 'В плане', in_progress: 'Проходим', done: 'Пройдено' };

function ProgressTab({ student }) {
  const [adding, setAdding] = useState(false);
  const p = useLoad(() => api.progress(student.id), [student.id]);
  const toast = useToast();

  const cycle = async (t) => {
    await api.updateTopic(t.id, { status: NEXT_STATUS[t.status] });
    p.reload();
  };
  const remove = async (t) => {
    if (!window.confirm(`Удалить тему «${t.title}»?`)) return;
    await api.deleteTopic(t.id);
    toast('Тема удалена');
    p.reload();
  };

  if (p.loading) return <Spinner />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data;

  // Группируем темы по разделам
  const sections = [];
  for (const t of d.topics) {
    const name = t.section || 'Без раздела';
    let sec = sections.find((x) => x.name === name);
    if (!sec) sections.push((sec = { name, items: [] }));
    sec.items.push(t);
  }

  return (
    <div className="grid grid-main">
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Программа</h2>
          <button className="btn btn-sm" onClick={() => setAdding(true)}><Icon name="plus" /> Темы</button>
        </div>
        {!d.topics.length && <Empty title="Программа пуста">Добавьте темы юнита списком, по одной на строку.</Empty>}
        {sections.map((sec) => (
          <div key={sec.name} className="day-group">
            <div className="day-head"><span className="serif">{sec.name}</span></div>
            <div className="list">
              {sec.items.map((t) => (
                <div key={t.id} className="list-item">
                  <button className={`badge ${t.status === 'done' ? 'badge-green' : t.status === 'in_progress' ? 'badge-brass' : ''}`}
                    style={{ cursor: 'pointer', minWidth: 92, justifyContent: 'center' }} onClick={() => cycle(t)}
                    title="Нажмите, чтобы сменить статус">
                    {TOPIC_STATUS[t.status]}
                  </button>
                  <div className="list-main">
                    <div className="list-title">{t.title}</div>
                    <div className="list-sub">{SKILLS[t.skill]}{t.completed_on ? `, ${shortDate(t.completed_on)}` : ''}</div>
                  </div>
                  <button className="icon-btn" aria-label="Удалить" onClick={() => remove(t)}><Icon name="trash" size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2 className="section-title">Пройдено</h2>
        <div className="big-number num" style={{ margin: '12px 0 10px' }}>{d.completion}%</div>
        <Bar value={d.completion} />
        <div className="stack" style={{ gap: 12, marginTop: 22 }}>
          {d.by_skill.map((b) => (
            <div key={b.skill}>
              <div className="row-between small"><span>{SKILLS[b.skill]}</span><span className="muted num">{b.done} из {b.total}</span></div>
              <div style={{ marginTop: 6 }}><Bar value={(b.done / b.total) * 100} /></div>
            </div>
          ))}
        </div>
      </section>
      {adding && <TopicsModal studentId={student.id} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); p.reload(); }} />}
    </div>
  );
}

/* ---------- Отчёты ---------- */
function ReportsTab({ student }) {
  const [modal, setModal] = useState(null);
  const p = useLoad(() => api.progress(student.id), [student.id]);
  const toast = useToast();
  const reports = p.data?.reports || [];
  const hasPrev = reports.some((r) => r.month_key === prevMonth());

  const unpublish = async (r) => {
    await api.updateReport(r.id, { published: false });
    toast('Отчёт скрыт');
    p.reload();
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">Ежемесячные отчёты</h2>
        <div className="row" style={{ gap: 6 }}>
          {!hasPrev && <button className="btn btn-sm" onClick={() => setModal({ month: prevMonth() })}>За {monthName(prevMonth()).toLowerCase()}</button>}
          <button className="btn btn-sm btn-secondary" onClick={() => setModal({ month: currentMonth() })}>За текущий месяц</button>
        </div>
      </div>
      {p.loading && <Spinner />}
      {p.data && !reports.length && <Empty title="Отчётов ещё не было">Короткий итог месяца для ученика и родителей: что получается, над чем работаем, что дальше.</Empty>}
      <div className="list">
        {reports.map((r) => (
          <div key={r.id} className="list-item clickable" onClick={() => setModal({ month: r.month_key, report: r })}>
            <div className="list-main">
              <div className="list-title">{monthName(r.month_key)}</div>
              <div className="list-sub truncate">{r.summary || 'Черновик без текста'}</div>
            </div>
            {r.published ? (
              <>
                <Badge tone="green">Опубликован</Badge>
                <button className="btn btn-quiet btn-sm hide-sm" onClick={(e) => { e.stopPropagation(); unpublish(r); }}>Скрыть</button>
              </>
            ) : (
              <Badge>Черновик</Badge>
            )}
          </div>
        ))}
      </div>
      {modal && (
        <ReportModal studentId={student.id} month={modal.month} report={modal.report || reports.find((r) => r.month_key === modal.month)}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); p.reload(); }} />
      )}
    </section>
  );
}

/* ---------- Оплаты ---------- */
function FinanceTab({ student, onChange }) {
  const [modal, setModal] = useState(null);
  const fin = useLoad(() => api.finance(student.id), [student.id]);
  const toast = useToast();
  const saved = () => { setModal(null); fin.reload(); onChange(); };

  const removePayment = async (p) => {
    if (!window.confirm(`Удалить оплату ${rub(p.amount)}?`)) return;
    await api.deletePayment(p.id);
    toast('Оплата удалена');
    saved();
  };
  const cancelSub = async (s) => {
    if (!window.confirm('Аннулировать абонемент? Его стоимость перестанет учитываться в балансе.')) return;
    await api.updateSubscription(s.id, { status: 'cancelled' });
    toast('Абонемент аннулирован');
    saved();
  };

  if (fin.loading) return <Spinner />;
  if (fin.error) return <ErrorBox error={fin.error} onRetry={fin.reload} />;
  const f = fin.data;
  const SUB_STATUS = { active: ['Действует', 'green'], finished: ['Завершён', ''], cancelled: ['Аннулирован', 'red'] };

  return (
    <div className="grid grid-2">
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Абонементы</h2>
          <button className="btn btn-sm" onClick={() => setModal({ type: 'sub' })}><Icon name="plus" /> Абонемент</button>
        </div>
        {!f.subscriptions.length && <Empty title="Абонементов не было">Пакет занятий с предоплатой: меньше пропусков, стабильный доход.</Empty>}
        <div className="list">
          {f.subscriptions.map((s) => (
            <div key={s.id} className="list-item">
              <div className="list-main">
                <div className="list-title">{s.title}</div>
                <div className="list-sub">
                  {rub(s.price_total)}, с {shortDate(s.starts_on)}{s.expires_on ? ` до ${shortDate(s.expires_on)}` : ''}.
                  {s.status !== 'cancelled' && ` Осталось ${s.lessons_remaining}`}
                </div>
              </div>
              <Badge tone={SUB_STATUS[s.status][1]}>{SUB_STATUS[s.status][0]}</Badge>
              {s.status === 'active' && (
                <button className="icon-btn" aria-label="Аннулировать" onClick={() => cancelSub(s)}><Icon name="close" size={18} /></button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Оплаты</h2>
          <button className="btn btn-sm btn-secondary" onClick={() => setModal({ type: 'pay' })}><Icon name="plus" /> Оплата</button>
        </div>
        {!f.payments.length && <Empty title="Оплат пока нет" />}
        <div className="list">
          {f.payments.map((p) => (
            <div key={p.id} className="list-item clickable" onClick={() => setModal({ type: 'pay', payment: p })}>
              <div className="list-main">
                <div className="list-title num">{rub(p.amount)}</div>
                <div className="list-sub">{fullDate(p.paid_on)}, {METHOD[p.method].toLowerCase()}{p.comment ? `. ${p.comment}` : ''}</div>
              </div>
              {p.receipt_url ? (
                <a className="badge badge-green" href={p.receipt_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Чек</a>
              ) : (
                <Badge tone="brass">Нет чека</Badge>
              )}
              <button className="icon-btn" aria-label="Удалить" onClick={(e) => { e.stopPropagation(); removePayment(p); }}><Icon name="trash" size={18} /></button>
            </div>
          ))}
        </div>
      </section>
      {modal?.type === 'sub' && <SubscriptionModal student={student} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'pay' && <PaymentModal student={student} payment={modal.payment} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}

/* ---------- Доступ ---------- */
const DOC_NAMES = { offer: 'оферта', privacy: 'политика', consent_adult: 'согласие', consent_parent: 'согласие родителя' };

function AccessTab({ student, onChange }) {
  const [modal, setModal] = useState(null);
  const toast = useToast();
  const accounts = student.accounts || [];
  const own = accounts.find((a) => a.role === 'student');
  const parents = accounts.filter((a) => a.role === 'parent');
  const saved = () => { onChange(); };

  const toggle = async (a) => {
    await api.setAccountActive(a.id, !a.is_active);
    toast(a.is_active ? 'Вход заблокирован' : 'Вход разблокирован');
    onChange();
  };
  const unlink = async (a) => {
    if (!window.confirm(`Отвязать ${a.full_name} от ученика?`)) return;
    await api.removeParent(student.id, a.id);
    toast('Родитель отвязан');
    onChange();
  };

  const Row = ({ a, label, extra }) => (
    <div className="list-item wrap">
      <div className="avatar">{a.full_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}</div>
      <div className="list-main" style={{ minWidth: 200 }}>
        <div className="list-title">{a.full_name}</div>
        <div className="list-sub">
          {label}, логин <strong>{a.login}</strong>.{' '}
          {a.last_login_at ? `Заходил ${relativeDay(a.last_login_at).toLowerCase()} в ${time(a.last_login_at)}` : 'Ещё не заходил'}
        </div>
        <div className="list-sub">
          {a.accepted_docs?.length
            ? `Принял документы: ${a.accepted_docs.map((d) => `${DOC_NAMES[d.kind]} (ред. ${d.version}, ${shortDate(d.accepted_at)})`).join(', ')}`
            : 'Документы ещё не приняты'}
          {a.telegram_linked ? '. Telegram подключён' : ''}
        </div>
      </div>
      {!a.is_active && <Badge tone="red">Заблокирован</Badge>}
      <div className="row wrap" style={{ gap: 4 }}>
        <button className="btn btn-quiet btn-sm" onClick={() => setModal({ type: 'reset', account: a })}>Пароль</button>
        <button className="btn btn-quiet btn-sm" onClick={() => toggle(a)}>{a.is_active ? 'Заблокировать' : 'Разблокировать'}</button>
        {extra}
      </div>
    </div>
  );

  return (
    <section className="panel">
      <div className="panel-head"><h2 className="section-title">Кто заходит в кабинет</h2></div>
      <p className="muted" style={{ marginTop: -6 }}>
        Для входа нужны только логин и пароль. Ученик видит расписание, задания, прогресс и опубликованные отчёты; родитель — то же самое по своим детям.
      </p>
      <div className="list">
        {own ? (
          <Row a={own} label="Ученик" />
        ) : (
          <div className="list-item">
            <div className="list-main">
              <div className="list-title">Вход ученика</div>
              <div className="list-sub">{student.category === 'child' ? 'Детям обычно хватает входа родителя' : 'Ещё не создан'}</div>
            </div>
            <button className="btn btn-sm" onClick={() => setModal({ type: 'student' })}>Создать вход</button>
          </div>
        )}
        {parents.map((a) => (
          <Row key={a.id} a={a} label="Родитель"
            extra={<button className="btn btn-quiet btn-sm" onClick={() => unlink(a)}>Отвязать</button>} />
        ))}
        <div className="list-item">
          <div className="list-main">
            <div className="list-title">Родитель</div>
            <div className="list-sub">{parents.length ? 'Можно добавить второго родителя' : 'Нужен для детей и подростков'}</div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => setModal({ type: 'parent' })}><Icon name="plus" /> Родитель</button>
        </div>
      </div>
      {!student.pd_consent_at && (
        <div className="note" style={{ marginTop: 16 }}>
          Не отмечено согласие на обработку персональных данных. Отметьте его в карточке ученика, когда получите.
        </div>
      )}
      {(modal?.type === 'student' || modal?.type === 'parent') && (
        <AccountModal student={student} kind={modal.type} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.type === 'reset' && <ResetPasswordModal account={modal.account} onClose={() => setModal(null)} />}
    </section>
  );
}
