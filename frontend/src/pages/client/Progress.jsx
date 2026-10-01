// pages/client/Progress.jsx — программа, навыки, отчёты
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Bar, Link, Badge } from '../../ui';
import { SKILLS, shortDate, monthName } from '../../format';

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
      <div className="page-head"><h1 className="page-title">Прогресс</h1></div>
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
