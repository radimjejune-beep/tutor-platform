// pages/tutor/HomeworkReview.jsx — все задания на проверке и выданные
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, navigate } from '../../ui';
import { CheckHomeworkModal } from './modals';
import { relativeDay, shortDate, time } from '../../format';

export default function HomeworkReview() {
  const [checking, setChecking] = useState(null);
  const data = useLoad(() => Promise.all([api.homework({ status: 'submitted' }), api.homework({ status: 'assigned' })]), []);

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const [submitted, assigned] = data.data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Проверка ДЗ</h1>
          <div className="lead">{submitted.length ? `Ждут проверки: ${submitted.length}` : 'Всё проверено'}</div>
        </div>
      </div>

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Сданы, ждут проверки</h2></div>
          {!submitted.length && <Empty title="Проверять нечего" />}
          <div className="list">
            {submitted.map((h) => (
              <div key={h.id} className="list-item clickable" onClick={() => setChecking(h)}>
                <div className="list-main">
                  <div className="list-title truncate">{h.title}</div>
                  <div className="list-sub">{h.student_name}, сдано {relativeDay(h.submitted_at).toLowerCase()} в {time(h.submitted_at)}</div>
                </div>
                <button className="btn btn-sm">Проверить</button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Выданы, ещё не сданы</h2></div>
          {!assigned.length && <Empty title="Открытых заданий нет" />}
          <div className="list">
            {assigned.map((h) => (
              <div key={h.id} className="list-item clickable" onClick={() => navigate(`/students/${h.student_id}/homework`)}>
                <div className="list-main">
                  <div className="list-title truncate">{h.title}</div>
                  <div className="list-sub">{h.student_name}{h.due_on ? `, к ${shortDate(h.due_on)}` : ''}</div>
                </div>
                {h.due_on && h.due_on < today && <Badge tone="red">Просрочено</Badge>}
              </div>
            ))}
          </div>
        </section>
      </div>

      {checking && <CheckHomeworkModal homework={checking} onClose={() => setChecking(null)} onSaved={() => { setChecking(null); data.reload(); }} />}
    </>
  );
}
