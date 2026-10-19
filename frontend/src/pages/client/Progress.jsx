// pages/client/Progress.jsx — программа, навыки, отчёты
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Bar, Link, Badge } from '../../ui';
import { relativeDay } from '../../format';
import { MotivationCard } from '../../components/Motivation';
import Recommendations from '../../components/Recommendations';
import { SKILLS, shortDate, monthName, plural } from '../../format';

export default function ClientProgress({ student }) {
  const p = useLoad(() => api.progress(student.id), [student.id]);
  if (p.loading) return <Spinner />;
  if (p.error) return <ErrorBox error={p.error} onRetry={p.reload} />;
  const d = p.data;

  const sections = [];
  for (const t of d.topics) {
    const name = t.section || 'Темы';
    let sec = sections.find((x) => x.name === name);
    if (!sec) sections.push((sec = { name, items: [] }));
    sec.items.push(t);
  }
  const maxLessons = Math.max(1, ...d.lessons_by_month.map((m) => m.lessons_done));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Прогресс</h1>
          <div className="lead">Всё, что уже получилось: слова, упражнения, задания и курс. Обновляется само после каждого урока и задания.</div>
        </div>
      </div>
      <MotivationCard studentId={student.id} />
      <Recommendations studentId={student.id} />
      <Achievements d={d} />
      <MonthSummaries studentId={student.id} />
      <div className="grid grid-main">
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Программа</h2></div>
          {!d.topics.length && <Empty title="Программа появится после первых занятий" />}
          {sections.map((sec) => (
            <div key={sec.name} className="day-group">
              <div className="day-head"><span className="serif">{sec.name}</span></div>
              <div className="list">
                {sec.items.map((t) => (
                  <div key={t.id} className="list-item">
                    <span aria-hidden="true" style={{
                      width: 12, height: 12, borderRadius: '50%', flex: 'none',
                      background: t.status === 'done' ? 'var(--green)' : t.status === 'in_progress' ? 'var(--brass)' : 'transparent',
                      boxShadow: t.status === 'planned' ? 'inset 0 0 0 1.5px var(--line-strong)' : 'none',
                    }} />
                    <div className="list-main">
                      <div className="list-title" style={{ fontWeight: t.status === 'done' ? 500 : 600, color: t.status === 'done' ? 'var(--ink-2)' : undefined }}>
                        {t.title}
                      </div>
                      <div className="list-sub">{SKILLS[t.skill]}{t.completed_on ? `, пройдено ${shortDate(t.completed_on)}` : t.status === 'in_progress' ? ', проходим сейчас' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="stack">
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

          {d.lessons_by_month.length > 0 && (
            <section className="panel">
              <h2 className="section-title">Занятия по месяцам</h2>
              <div className="stack" style={{ gap: 10, marginTop: 14 }}>
                {d.lessons_by_month.map((m) => (
                  <div key={m.month} className="row" style={{ gap: 12 }}>
                    <span className="small" style={{ width: 70 }}>{monthName(m.month).split(' ')[0]}</span>
                    <div style={{ flex: 1 }}><Bar value={(m.lessons_done / maxLessons) * 100} /></div>
                    <span className="small num muted" style={{ width: 20, textAlign: 'right' }}>{m.lessons_done}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="section-title">Отчёты</h2>
            {!d.reports.length && <p className="muted" style={{ marginBottom: 0 }}>Первый отчёт появится в начале следующего месяца.</p>}
            <div className="list" style={{ marginTop: 8 }}>
              {d.reports.map((r) => (
                <Link key={r.id} to={`/reports/${r.id}`} className="list-item clickable" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="list-main"><div className="list-title">{monthName(r.month_key)}</div></div>
                  <Badge tone="green">Открыть</Badge>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   Итоги по месяцам — собираются сами из занятий, заданий и тем
   ============================================================ */
function MonthSummaries({ studentId }) {
  const months = useLoad(() => api.monthSummaries(studentId), [studentId]);
  if (months.loading || months.error || !months.data?.length) return null;

  return (
    <section className="panel" style={{ marginBottom: 20 }}>
      <div className="panel-head">
        <h2 className="section-title">Итоги по месяцам</h2>
        <span className="small muted">Обновляются автоматически</span>
      </div>
      {months.data.map((m) => {
        const attendance = m.lessons_done + m.lessons_missed ? Math.round((m.lessons_done / (m.lessons_done + m.lessons_missed)) * 100) : null;
        return (
          <div key={m.month} className="month-card">
            <div className="row-between">
              <div className="serif" style={{ fontSize: 26 }}>{monthName(m.month)}</div>
              {m.report_id && <Link to={`/reports/${m.report_id}`} className="small">Отзыв преподавателя</Link>}
            </div>
            <div className="month-stats">
              <div><b className="num">{m.lessons_done}</b><span>{plural(m.lessons_done, 'занятие', 'занятия', 'занятий')}</span></div>
              <div><b className="num">{attendance === null ? '—' : `${attendance}%`}</b><span>посещаемость</span></div>
              <div><b className="num">{m.homework_given ? `${m.homework_done}/${m.homework_given}` : '—'}</b><span>заданий сдано</span></div>
              <div><b className="num">{m.homework_avg_score === null ? '—' : `${m.homework_avg_score}%`}</b><span>средняя оценка</span></div>
            </div>
            {m.topics_completed?.length > 0 && (
              <div className="small" style={{ marginTop: 12 }}>
                <span className="muted">Пройдено: </span>{m.topics_completed.join(', ')}
              </div>
            )}
            {m.tutor_summary && <p style={{ margin: '12px 0 0', whiteSpace: 'pre-line' }}>{m.tutor_summary}</p>}
          </div>
        );
      })}
    </section>
  );
}

/* ============================================================
   Достижения: словарь, упражнения, задания, курс
   ============================================================ */
function Achievements({ d }) {
  const v = d.vocab || { total: 0, learned: 0, boxes: [0, 0, 0, 0, 0, 0] };
  const g = d.games || { attempts: 0, avg_score: 0, perfect: 0, recent: [] };
  const h = d.homework || { given: 0, done: 0, on_time: 0 };
  const c = d.course;
  const coursePct = c?.units_total ? Math.round((c.units_done / c.units_total) * 100) : 0;
  const segs = [
    { n: v.boxes[0], cls: 'b0', label: 'новые' },
    { n: v.boxes[1] + v.boxes[2], cls: 'b1', label: 'учим' },
    { n: v.boxes[3], cls: 'b3', label: 'почти' },
    { n: v.boxes[4] + v.boxes[5], cls: 'b4', label: 'выучены' },
  ];

  return (
    <section className="achv">
      <div className="achv-tile">
        <span className="meta-label">Словарь</span>
        <div className="achv-num"><b className="serif">{v.learned}</b><span>из {v.total} {plural(v.total, 'слова', 'слов', 'слов')} выучено</span></div>
        {v.total > 0 && (
          <>
            <div className="achv-stack" aria-hidden="true">
              {segs.map((x) => x.n > 0 && <i key={x.cls} className={x.cls} style={{ flexGrow: x.n }} />)}
            </div>
            <div className="achv-legend">{segs.filter((x) => x.n).map((x) => <span key={x.cls}><i className={x.cls} />{x.label}: {x.n}</span>)}</div>
          </>
        )}
        {v.due > 0 && <Link to="/words" className="small">Повторить сегодня: {v.due}</Link>}
      </div>

      <div className="achv-tile">
        <span className="meta-label">Упражнения, 3 месяца</span>
        <div className="achv-num"><b className="serif">{g.attempts ? `${g.avg_score}%` : '—'}</b><span>средний результат</span></div>
        {g.attempts > 0 && <div className="small muted">Пройдено: {g.attempts}. Без ошибок: {g.perfect}</div>}
      </div>

      <div className="achv-tile">
        <span className="meta-label">Задания, 3 месяца</span>
        <div className="achv-num"><b className="serif">{h.given ? `${h.done}/${h.given}` : '—'}</b><span>сдано</span></div>
        {h.done > 0 && <div className="small muted">Вовремя: {h.on_time} из {h.done}{h.avg_score ? `. Средняя оценка ${h.avg_score}%` : ''}</div>}
      </div>

      <div className="achv-tile">
        <span className="meta-label">{c ? c.title : 'Курс'}</span>
        {c ? (
          <>
            <div className="achv-num"><b className="serif">{coursePct}%</b><span>курса пройдено</span></div>
            <Bar value={coursePct} />
            {c.code && <div className="small muted" style={{ marginTop: 8 }}>Сейчас: {[c.code, c.unit_title].filter(Boolean).join(' ')}</div>}
          </>
        ) : (
          <div className="small muted" style={{ marginTop: 10 }}>Курс по учебнику ещё не выбран</div>
        )}
      </div>

      {g.recent?.length > 0 && (
        <div className="achv-recent">
          <span className="meta-label">Последние упражнения</span>
          <div className="list">
            {g.recent.slice(0, 6).map((r, i) => (
              <div key={i} className="list-item" style={{ padding: '10px 2px' }}>
                <div className="list-main">
                  <div className="list-title truncate">{r.title}</div>
                  <div className="list-sub">{relativeDay(r.created_at)}</div>
                </div>
                <Badge tone={r.score === 100 ? 'green' : r.score >= 70 ? '' : 'brass'}>{r.correct}/{r.total}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
