// pages/client/Home.jsx — главная ученика / родителя
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, PassMarks, Bar } from '../../ui';
import { CONTACT_URL } from '../../config';
import { time, dayMonth, relativeDay, rub, shortDate, monthName, lessonsWord, HW_STATUS } from '../../format';

export default function ClientHome({ student, isParent }) {
  const dash = useLoad(() => Promise.all([api.dashboard(), api.finance(student.id)]), [student.id]);

  if (dash.loading) return <Spinner />;
  if (dash.error) return <ErrorBox error={dash.error} onRetry={dash.reload} />;

  const [d, fin] = dash.data;
  const s = d.students.find((x) => x.student.id === student.id) || d.students[0];
  const next = s.upcoming[0];
  const activeSub = fin.subscriptions.find((x) => x.status === 'active');
  const firstName = s.student.full_name.split(/\s+/)[0];
  const openHw = s.homework.filter((h) => h.status === 'assigned');

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{isParent ? firstName : `Привет, ${firstName}`}</h1>
          <div className="lead">{[s.student.level, s.student.textbook].filter(Boolean).join(', ') || 'Английский язык'}{s.student.goal ? `. ${s.student.goal}` : ''}</div>
        </div>
      </div>

      <div className="grid grid-main">
        {/* Следующее занятие */}
        <section className="hero">
          <div className="hero-label">Следующее занятие</div>
          {next ? (
            <>
              <div className="hero-date">
                {relativeDay(next.starts_at)}, {dayMonth(next.starts_at)}
                <br />
                <span className="hero-time">в {time(next.starts_at)}</span>
              </div>
              <div className="hero-meta">
                {next.topic ? `Тема: ${next.topic}. ` : ''}{next.duration_min} минут
              </div>
            </>
          ) : (
            <div className="hero-date" style={{ fontSize: 32 }}>Пока не назначено</div>
          )}
          <div className="hero-actions">
            {s.student.board_link && (
              <a className="btn btn-light" href={s.student.board_link} target="_blank" rel="noreferrer">
                <Icon name="board" /> Открыть доску
              </a>
            )}
            {s.upcoming.length > 1 && <Link to="/schedule" className="btn btn-ghost-light">Всё расписание</Link>}
            {CONTACT_URL && <a className="btn btn-ghost-light" href={CONTACT_URL} target="_blank" rel="noreferrer">Перенести</a>}
          </div>
        </section>

        {/* Абонемент */}
        <section className="panel">
          <h2 className="section-title">{activeSub ? 'Абонемент' : 'Оплата'}</h2>
          {activeSub ? (
            <>
              <div style={{ marginTop: 14 }}>
                <span className="big-number num">{s.finance.lessons_remaining}</span>
                <span className="muted"> из {lessonsWord(activeSub.lessons_total)} осталось</span>
              </div>
              <PassMarks total={activeSub.lessons_total} remaining={activeSub.lessons_remaining} />
              {activeSub.expires_on && <div className="small muted">Действует до {shortDate(activeSub.expires_on)}</div>}
              {s.finance.lessons_remaining <= 1 && <div className="note" style={{ marginTop: 12 }}>Абонемент заканчивается — пора продлить.</div>}
            </>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div className="big-number num" style={{ color: s.finance.balance < 0 ? 'var(--danger)' : undefined }}>
                {s.finance.balance < 0 ? rub(-s.finance.balance) : rub(s.finance.balance)}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {s.finance.balance < 0 ? 'К оплате за проведённые занятия' : s.finance.balance > 0 ? 'Предоплата на балансе' : 'Все занятия оплачены'}
              </div>
            </div>
          )}
          {activeSub && s.finance.balance < 0 && (
            <div className="alert" style={{ marginTop: 12 }}>К оплате: {rub(-s.finance.balance)}</div>
          )}
          <Link to="/payments" className="small" style={{ display: 'inline-block', marginTop: 14 }}>История оплат</Link>
        </section>
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        {/* ДЗ */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Домашнее задание</h2>
            {openHw.length > 0 && <Badge tone="brass">{openHw.length}</Badge>}
          </div>
          {!s.homework.length && <Empty title="Заданий нет">Новое появится здесь после занятия.</Empty>}
          <div className="list">
            {s.homework.slice(0, 4).map((h) => (
              <Link key={h.id} to="/homework" className="list-item clickable" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="list-main">
                  <div className="list-title truncate">{h.title}</div>
                  <div className="list-sub">{h.due_on ? `К ${shortDate(h.due_on)}` : 'Без срока'}</div>
                </div>
                <Badge tone={HW_STATUS[h.status].tone}>{HW_STATUS[h.status].label}</Badge>
              </Link>
            ))}
          </div>
        </section>

        {/* Прогресс и отчёт */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Прогресс</h2>
            <Link to="/progress" className="small">Подробнее</Link>
          </div>
          {s.progress.total ? (
            <>
              <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
                <span className="big-number num">{s.progress.completion}%</span>
                <span className="muted">программы пройдено, {s.progress.done} из {s.progress.total} тем</span>
              </div>
              <div style={{ marginTop: 14 }}><Bar value={s.progress.completion} /></div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Программа появится после первых занятий.</p>
          )}
          {s.latest_report && (
            <Link to={`/reports/${s.latest_report.id}`} className="list-item clickable"
              style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 14, color: 'inherit', textDecoration: 'none', padding: '14px 16px', margin: '18px 0 0' }}>
              <div className="avatar" style={{ background: 'var(--brass-soft)', color: '#7a5717' }}><Icon name="report" size={20} /></div>
              <div className="list-main">
                <div className="list-title">Отчёт за {monthName(s.latest_report.month_key).toLowerCase()}</div>
                <div className="list-sub">Итоги месяца от преподавателя</div>
              </div>
            </Link>
          )}
        </section>
      </div>

      {s.last_lesson?.summary && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2 className="section-title">На прошлом занятии</h2>
          <div className="muted small" style={{ margin: '4px 0 10px' }}>{dayMonth(s.last_lesson.starts_at)}{s.last_lesson.topic ? `, ${s.last_lesson.topic}` : ''}</div>
          <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{s.last_lesson.summary}</p>
        </section>
      )}
    </>
  );
}
