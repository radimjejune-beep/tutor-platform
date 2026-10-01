// pages/client/Homework.jsx — список заданий ученика
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, navigate } from '../../ui';
import { shortDate, HW_STATUS, todayISO } from '../../format';

export default function ClientHomework({ student }) {
  const hw = useLoad(() => api.homework({ student_id: student.id }), [student.id]);
  if (hw.loading) return <Spinner />;
  if (hw.error) return <ErrorBox error={hw.error} onRetry={hw.reload} />;

  const today = todayISO();
  const todo = hw.data.filter((h) => h.status !== 'checked');
  const done = hw.data.filter((h) => h.status === 'checked');

  const Row = ({ h }) => {
    const overdue = h.status === 'assigned' && h.due_on && h.due_on < today;
    return (
      <div className="assign-row" onClick={() => navigate(`/homework/${h.id}`)}>
        <div className="assign-icon"><Icon name={h.question_count ? 'quiz' : 'book'} /></div>
        <div className="list-main">
          <div className="list-title truncate">{h.title}</div>
          <div className="list-sub">
            {h.due_on ? `До ${shortDate(h.due_on)}` : 'Без срока'}
            {h.question_count ? '. Есть тест' : ''}
          </div>
        </div>
        {h.status === 'checked' && h.score !== null ? (
          <Badge tone="green">{h.score}%</Badge>
        ) : overdue ? (
          <Badge tone="red">Просрочено</Badge>
        ) : (
          <Badge tone={HW_STATUS[h.status].tone}>{HW_STATUS[h.status].label}</Badge>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="page-head"><h1 className="page-title">Задания</h1></div>
      <section className="panel">
        <div className="panel-head"><h2 className="section-title">Текущие</h2></div>
        {!todo.length ? <Empty title="Всё сделано">Новое задание появится здесь.</Empty> : todo.map((h) => <Row key={h.id} h={h} />)}
      </section>
      {done.length > 0 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-head"><h2 className="section-title">Проверенные</h2></div>
          {done.map((h) => <Row key={h.id} h={h} />)}
        </section>
      )}
    </>
  );
}
