// pages/client/ReportView.jsx — ежемесячный отчёт преподавателя
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Icon, Link } from '../../ui';
import { BRAND } from '../../config';
import { monthName, plural } from '../../format';

export default function ReportView({ id }) {
  const r = useLoad(() => api.report(id), [id]);
  if (r.loading) return <Spinner />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const d = r.data;
  const s = d.stats;

  const blocks = [
    ['Итог месяца', d.summary],
    ['Что получается', d.strengths],
    ['Над чем работаем', d.to_improve],
    ['План на следующий месяц', d.plan_next],
  ].filter(([, text]) => text);

  return (
    <>
      <Link to="/progress" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}>
        <Icon name="back" /> Прогресс
      </Link>
      <article className="panel" style={{ maxWidth: 760, padding: '36px 40px' }}>
        <div className="muted small">Отчёт преподавателя</div>
        <h1 className="page-title" style={{ marginTop: 6 }}>{monthName(d.month_key)}</h1>
        <div className="brand-rule" style={{ margin: '18px 0 24px' }} />

        <div className="grid grid-3" style={{ gap: 14, marginBottom: 28 }}>
          <div>
            <div className="stat-value num">{s.lessons_done}</div>
            <div className="stat-note">{plural(s.lessons_done, 'занятие', 'занятия', 'занятий')}</div>
          </div>
          <div>
            <div className="stat-value num">{s.homework_done}/{s.homework_given}</div>
            <div className="stat-note">заданий сделано</div>
          </div>
          <div>
            <div className="stat-value num">{s.topics_completed?.length || 0}</div>
            <div className="stat-note">{plural(s.topics_completed?.length || 0, 'тема пройдена', 'темы пройдено', 'тем пройдено')}</div>
          </div>
        </div>

        {blocks.map(([title, text]) => (
          <div key={title} className="report-block">
            <h4>{title}</h4>
            <p>{text}</p>
          </div>
        ))}

        {s.topics_completed?.length > 0 && (
          <div className="report-block">
            <h4>Пройденные темы</h4>
            <p>{s.topics_completed.join(', ')}</p>
          </div>
        )}

        <div className="muted small" style={{ marginTop: 32 }}>{BRAND.name}</div>
      </article>
    </>
  );
}
