// pages/tutor/Dashboard.jsx — главная преподавателя: сегодня и «требует внимания»
import { DailyMethodTip } from '../Method';
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, navigate } from '../../ui';
import { LessonModal, NewLessonModal } from './modals';
import BookingRequests from '../../components/BookingRequests';
import TodayLessons from '../../components/TodayLessons';
import { TutorAnnouncements } from '../../components/Announcements';
import { LeagueBoard } from '../../components/Motivation';
import { useAuth } from '../../auth';
import { time, dayMonth, weekday, cap, rub, relativeDay, LESSON_STATUS, monthName, prevMonth, plural } from '../../format';


// Первые шаги: показывается новому преподавателю, пока не пройдены все шаги (можно скрыть)
// Пример: два ученика с занятиями, домашкой и оплатами, чтобы увидеть платформу в работе
function DemoBanner({ demo, onChange }) {
  const [busy, setBusy] = useState(false);
  if (!demo.data?.active) return null;
  const remove = async () => {
    if (!window.confirm('Удалить пример? Анна и Миша пропадут вместе с занятиями, заданием и оплатами. Ваши ученики не пострадают.')) return;
    setBusy(true);
    try { await api.demoDelete(); onChange(); } finally { setBusy(false); }
  };
  return (
    <div className="demo-banner">
      <Icon name="star" size={18} />
      <div><b>В кабинете пример.</b> Анна и Миша не настоящие: посмотрите расписание, задания, оплаты и карточки учеников. Когда разберётесь, удалите пример одной кнопкой.</div>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={remove}>{busy ? 'Удаляем…' : 'Удалить пример'}</button>
    </div>
  );
}

function Onboarding({ demo, onDemo }) {
  const ob = useLoad(() => api.onboarding().catch(() => null), []);
  const [making, setMaking] = useState(false);
  const makeDemo = async () => {
    setMaking(true);
    try { await api.demoCreate(); onDemo(); } catch (e) { window.alert(e.message); } finally { setMaking(false); }
  };
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('lf-onb-hide') === '1'; } catch { return false; } });
  const steps = ob.data?.steps || [];
  const done = steps.filter((s) => s.done).length;
  if (hidden || !steps.length || done === steps.length) return null;
  const hide = () => { try { localStorage.setItem('lf-onb-hide', '1'); } catch { /* приватный режим */ } setHidden(true); };
  return (
    <section className="panel onb">
      <div className="row-between">
        <div>
          <h2 className="section-title">Первые шаги · {done} из {steps.length}</h2>
          <div className="small muted">Пять шагов, и платформа начнёт работать на вас.</div>
        </div>
        <button className="btn btn-quiet btn-sm" onClick={hide}>Скрыть</button>
      </div>
      <div className="bar" style={{ margin: "12px 0 6px", height: 4 }}><span style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      {done === 0 && demo.data && !demo.data.active && (
        <div className="onb-demo">
          <div><b>Сначала посмотреть, как это выглядит?</b><span className="small muted">Добавим двух учеников-примеров с расписанием, домашкой и оплатами. Удаляются одной кнопкой.</span></div>
          <button className="btn btn-sm" disabled={making} onClick={makeDemo}>{making ? 'Заполняем…' : 'Заполнить примером'}</button>
        </div>
      )}
      <ol className="onb-list">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? 'done' : ''}>
            <span className="onb-tick" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <div><b>{s.title}</b><span className="small muted">{s.text}</span></div>
            {!s.done && <Link to={s.link} className="btn btn-secondary btn-sm">Сделать</Link>}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function TutorDashboard() {
  const dash = useLoad(() => Promise.all([api.dashboard(), api.summary()]), []);
  const demo = useLoad(() => api.demoStatus().catch(() => null), []);
  const [modal, setModal] = useState(null);
  const { user } = useAuth();
  // Приветствие по имени из учётки (у «Преподаватель» — без имени)
  const firstName = user.full_name && user.full_name !== 'Преподаватель' ? user.full_name.split(/\s+/)[0] : '';
  const close = () => setModal(null);
  const saved = () => {
    setModal(null);
    dash.reload();
  };

  if (dash.loading) return <Spinner />;
  if (dash.error) return <ErrorBox error={dash.error} onRetry={dash.reload} />;

  const [d, month] = dash.data;
  const a = d.attention;
  const attentionCount =
    a.unmarked_lessons.length + a.homework_to_check.length + a.payments.length;
  const now = new Date();
  const hours = Math.round((month.minutes_taught / 60) * 10) / 10;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{firstName ? `Добрый день, ${firstName}` : 'Добрый день'}</h1>
          <div className="lead">{cap(weekday(now))}, {dayMonth(now)}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setModal({ type: 'new' })}>
            <Icon name="plus" /> Занятие
          </button>
        </div>
      </div>

      <DemoBanner demo={demo} onChange={() => window.location.reload()} />
      <Onboarding demo={demo} onDemo={() => window.location.reload()} />

      <section className="today-section">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2 className="section-title">
            Сегодня{d.today.length ? ` · ${d.today.length} ${plural(d.today.length, 'занятие', 'занятия', 'занятий')}` : ''}
          </h2>
          <Link to="/schedule" className="small muted">Вся неделя</Link>
        </div>
        <TodayLessons lessons={d.today} onChanged={dash.reload} onOpenLesson={(l) => setModal({ type: 'lesson', lesson: l })} />
      </section>

      <BookingRequests requests={d.booking_requests || []} cancellations={d.client_cancellations || []} onChanged={dash.reload} />
      <TutorAnnouncements />
      <DailyMethodTip />

      <div className="grid grid-main" style={{ marginTop: 24 }}>
        {/* Требует внимания */}
        <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Требует внимания</h2>
          {attentionCount > 0 && <span className="pen-num" style={{ fontSize: 28, lineHeight: 1 }} aria-label={`Дел: ${attentionCount}`}>{attentionCount}</span>}
        </div>

        {attentionCount === 0 ? (
          <Empty title="Всё в порядке">Занятия отмечены, задания проверены, абонементы в силе.</Empty>
        ) : (
          <div className="list">
            {a.unmarked_lessons.map((l) => (
              <div key={`l${l.id}`} className="list-item clickable" onClick={() => setModal({ type: 'lesson', lesson: l })}>
                <div className="avatar" style={{ background: 'var(--brass-soft)', borderColor: 'transparent' }}><Icon name="clock" size={20} /></div>
                <div className="list-main">
                  <div className="list-title">Отметить занятие: {l.student_name}</div>
                  <div className="list-sub">{relativeDay(l.starts_at)}, {dayMonth(l.starts_at)} в {time(l.starts_at)}. Без отметки не спишется</div>
                </div>
                <button className="btn btn-secondary btn-sm">Отметить</button>
              </div>
            ))}
            {a.homework_to_check.map((h) => (
              <div key={`h${h.id}`} className="list-item clickable" onClick={() => navigate(`/homework/${h.assignment_id}/review/${h.id}`)}>
                <div className="avatar"><Icon name="book" size={20} /></div>
                <div className="list-main">
                  <div className="list-title">Проверить работу: {h.student_name}</div>
                  <div className="list-sub truncate">{h.title}</div>
                </div>
                <button className="btn btn-secondary btn-sm">Проверить</button>
              </div>
            ))}
            {a.payments.map((p) => (
              <div key={`p${p.student_id}`} className="list-item clickable" onClick={() => navigate(`/students/${p.student_id}/finance`)}>
                <div className="avatar" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }}><Icon name="wallet" size={20} /></div>
                <div className="list-main">
                  <div className="list-title">{p.balance < 0 ? 'Ждём оплату' : 'Пора продлить абонемент'}: {p.student_name}</div>
                  <div className="list-sub">
                    {p.balance < 0 && `Долг ${rub(-p.balance)}`}
                    {p.balance < 0 && p.lessons_remaining !== null && '. '}
                    {p.lessons_remaining !== null && `В абонементе ${p.lessons_remaining === 0 ? 'не осталось занятий' : `осталось ${p.lessons_remaining}`}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

        {/* Месяц */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">{monthName(month.month)}</h2>
            <Link to="/finance" className="small">Подробнее</Link>
          </div>
          <div className="stat-label">Поступило</div>
          <div className="stat-value num">{rub(month.income)}</div>
          <div className="grid grid-2" style={{ marginTop: 18, gap: 14 }}>
            <div>
              <div className="stat-label">Проведено</div>
              <div className="stat-value num" style={{ fontSize: 30 }}>{hours} ч</div>
            </div>
            <div>
              <div className="stat-label">Доход за час</div>
              <div className="stat-value num" style={{ fontSize: 30 }}>{month.income_per_hour ? rub(month.income_per_hour) : 'нет'}</div>
            </div>
          </div>
          {month.payments_without_receipt > 0 && (
            <div className="note" style={{ marginTop: 16 }}>
              Без чека: {month.payments_without_receipt} {plural(month.payments_without_receipt, 'оплата', 'оплаты', 'оплат')}. Не забудьте пробить в «Мой налог».
            </div>
          )}
        </section>
      </div>

      <LeagueBoard />

      {modal?.type === 'new' && <NewLessonModal onClose={close} onSaved={saved} />}
      {modal?.type === 'lesson' && <LessonModal lesson={modal.lesson} onClose={close} onSaved={saved} />}
    </>
  );
}
