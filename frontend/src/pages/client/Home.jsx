import {prioritizeHomework} from '../../learning-flow.js';
import {LessonRecap} from '../../components/LessonRecap';
// pages/client/Home.jsx — главная ученика / родителя
import { api } from '../../api';
import { useSubject } from '../../subjects';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, PassMarks, Bar } from '../../ui';
import { CONTACT_URL } from '../../config';
import { callService } from '../LessonRoom';
import TelegramCard from '../../components/TelegramCard';
import { ClientAnnouncements } from '../../components/Announcements';
import { SelfStudyStrip } from './SelfStudy';
import Recommendations from '../../components/Recommendations';
import {CoachSummary} from '../learning/Coach';
import { MotivationCard, WarmupBanner } from '../../components/Motivation';
import { time, dayMonth, relativeDay, rub, shortDate, monthName, lessonsWord, HW_STATUS, plural, givenName } from '../../format';

export default function ClientHome({ student, isParent }) {
  const subj = useSubject(student.subject);
  const dash = useLoad(() => Promise.all([api.dashboard({student_id:student.id,subject:student.subject}), api.finance(student.id)]), [student.id,student.subject]);

  if (dash.loading) return <Spinner />;
  if (dash.error) return <ErrorBox error={dash.error} onRetry={dash.reload} />;

  const [d, fin] = dash.data;
  const s = d.students.find((x) => x.student.id === student.id) || d.students[0];
  const next = s.upcoming[0];
  const activeSub = fin.subscriptions.find((x) => x.status === 'active');
  const firstName = givenName(s.student.full_name);
  const openHw = prioritizeHomework(s.homework).filter(h=>h.status==='assigned');
  const submittedCount=s.homework.filter(h=>h.status==='submitted').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{isParent ? firstName : `Привет, ${firstName}`}</h1>
          <div className="lead">{[s.student.level, s.unit ? `${s.unit.course_title}, ${[s.unit.code, s.unit.title].filter(Boolean).join(' ')}` : s.student.textbook].filter(Boolean).join(', ') || subj.subject}{s.student.goal ? `. ${s.student.goal}` : ''}</div>
        </div>
        <Link className="btn btn-secondary btn-sm" to="/marketplace/mine">Мои курсы</Link>
      </div>

      <ClientAnnouncements />
      <WarmupBanner lesson={next} studentId={student.id} onDone={dash.reload} />
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
            {next && (next.call_link || s.student.call_link) && (
              <a className="btn btn-light" href={next.call_link || s.student.call_link} target="_blank" rel="noreferrer">
                <Icon name="video" /> Войти в {callService(next.call_link || s.student.call_link)}
              </a>
            )}
            {next && <Link to={`/lesson/${next.id}`} className="btn btn-ghost-light">Комната урока</Link>}
            {s.student.board_link && !next && (
              <a className="btn btn-light" href={s.student.board_link} target="_blank" rel="noreferrer">
                <Icon name="board" /> Открыть доску
              </a>
            )}
            {s.upcoming.length > 1 && <Link to="/schedule" className="btn btn-ghost-light">Всё расписание</Link>}
            {CONTACT_URL && <a className="btn btn-ghost-light" href={CONTACT_URL} target="_blank" rel="noreferrer">Перенести</a>}
          </div>
        </section>

        {/* ДЗ */}
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">Домашнее задание</h2>
            {openHw.length > 0 && <Badge tone="brass">{openHw.length}</Badge>}
          </div>
          {!s.homework.length && <Empty title="Заданий нет">Новое появится здесь после занятия.</Empty>}
          <div className="list">
            {openHw.slice(0,3).map((h,i) => (
              <Link key={h.id} to={`/homework/${h.id}`} className={`list-item clickable ${i===0?'next-homework':''}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="list-main">
                  <div className="list-title truncate">{h.title}</div>
                  <div className="list-sub">{h.due_on ? `К ${shortDate(h.due_on)}` : 'Без срока'}</div>
                </div>
                <span className={i===0?"btn btn-sm":"small muted"}>{i===0?(isParent?"Посмотреть":"Продолжить"):"Открыть"}</span>
              </Link>
            ))}
          </div>
          {!openHw.length&&s.homework.length>0&&<p className="learning-done-note">Все текущие работы отправлены. Можно повторить тему или посмотреть комментарии преподавателя.</p>}
          {submittedCount>0&&<p className="small muted">На проверке: {submittedCount}. Эти работы уже отправлены.</p>}
          <Link className="btn btn-secondary btn-sm" to="/homework">Все задания и темы</Link>
        </section>

        {/* Абонемент */}
        <details className="client-finance-disclosure" open={isParent}><summary>Оплаты и абонемент</summary>
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
              {s.finance.lessons_remaining <= 1 && <div className="note" style={{ marginTop: 12 }}>Абонемент заканчивается, пора продлить.</div>}
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
        </details>
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

      {s.last_lesson&&<RecentLesson lesson={s.last_lesson}/>}
      <section className="client-practice" aria-label="Самостоятельная практика">
      <MotivationCard studentId={student.id} compact />

      {s.vocab?.due > 0 && (
        <Link to="/words" className="words-strip">
          <span>
            <span className="meta-label">Словарь</span>
            <span className="serif words-strip-title">{s.vocab.due} {plural(s.vocab.due, 'слово ждёт', 'слова ждут', 'слов ждут')} повторения</span>
          </span>
          <span className="btn btn-sm"><Icon name="play" /> Повторить</span>
        </Link>
      )}

      <CoachSummary key={student.id} studentId={student.id} subject={student.subject}/>
      {student.subject==='Английский язык'&&<SelfStudyStrip studentId={student.id}/>}
      <Recommendations studentId={student.id} compact />

      </section>
      <TelegramCard />
    </>
  );
}

function RecentLesson({lesson}){const data=useLoad(()=>api.lessonRoom(lesson.id),[lesson.id]);return <section className="panel" style={{marginTop:20}}><h2 className="section-title">На прошлом занятии</h2>{data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<LessonRecap lesson={data.data||lesson}/>}</section>;}
