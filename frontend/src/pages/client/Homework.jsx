// pages/client/Homework.jsx — список заданий ученика
import { api } from '../../api';
import HomeworkSections from '../../components/HomeworkSections';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, navigate } from '../../ui';
import { shortDate, HW_STATUS, todayISO } from '../../format';

export default function ClientHomework({ student, isParent }) {
  const hw = useLoad(() => api.homework({ student_id: student.id, subject:student.subject }), [student.id]);
  if (hw.loading) return <Spinner />;
  if (hw.error) return <ErrorBox error={hw.error} onRetry={hw.reload} />;

  const today = todayISO();

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
            {h.status==='checked'&&h.submitted_at?`. Сдано ${shortDate(h.submitted_at)}`:''}
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
      <HomeworkSections key={student.id} items={hw.data} isParent={isParent} studentId={student.id} renderRow={h=><Row key={h.id} h={h}/>}/>
    </>
  );
}
