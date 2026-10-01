// components/BookingRequests.jsx — запросы учеников на запись и перенос (для преподавателя)
import { api } from '../api';
import { Badge, useToast } from '../ui';
import { relativeDay, dayMonth, time } from '../format';

const when = (d) => `${relativeDay(d)}, ${dayMonth(d)} в ${time(d)}`;

export default function BookingRequests({ requests, cancellations = [], onChanged }) {
  const toast = useToast();
  if (!requests.length && !cancellations.length) return null;

  const approve = async (r) => {
    try {
      await api.approveRequest(r.id);
      toast(r.kind === 'book' ? 'Занятие добавлено в расписание' : 'Занятие перенесено');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const decline = async (r) => {
    const comment = window.prompt('Причина для ученика (можно оставить пустым):', '');
    if (comment === null) return;
    try {
      await api.declineRequest(r.id, comment.trim());
      toast('Запрос отклонён');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head">
        <h2 className="section-title">Запросы учеников</h2>
        {requests.length > 0 && <Badge tone="brass">{requests.length}</Badge>}
      </div>
      <div className="list">
        {requests.map((r) => (
          <div key={r.id} className="list-item wrap">
            <div className="list-main" style={{ minWidth: 220 }}>
              <div className="list-title">
                {r.student_name}: {r.kind === 'book' ? 'новое занятие' : 'перенос'}
              </div>
              <div className="list-sub">
                {r.kind === 'reschedule' && r.lesson_starts_at ? `${when(r.lesson_starts_at)} → ` : ''}
                <strong style={{ color: 'var(--ink)' }}>{when(r.starts_at)}</strong>, {r.duration_min} мин
                {r.comment ? `. «${r.comment}»` : ''}
              </div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => decline(r)}>Отклонить</button>
              <button className="btn btn-sm" onClick={() => approve(r)}>Подтвердить</button>
            </div>
          </div>
        ))}
        {cancellations.map((c) => (
          <div key={`c${c.id}`} className="list-item">
            <div className="list-main">
              <div className="list-title">Отмена: {c.student_name}</div>
              <div className="list-sub">Было {when(c.starts_at)}. Отменено заранее, не списывается</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
