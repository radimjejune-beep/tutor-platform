// pages/tutor/Dashboard.jsx — главная преподавателя: сегодня и «требует внимания»
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

export default function TutorDashboard() {
  const dash = useLoad(() => Promise.all([api.dashboard(), api.summary()]), []);
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

      <div className="grid grid-main" style={{ marginTop: 24 }}>
        {/* Требует внимания */}
        <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">Требует внимания</h2>
          {attentionCount > 0 && <Badge tone="brass">{attentionCount}</Badge>}
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
              <div className="stat-value num" style={{ fontSize: 30 }}>{month.income_per_hour ? rub(month.income_per_hour) : '—'}</div>
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
