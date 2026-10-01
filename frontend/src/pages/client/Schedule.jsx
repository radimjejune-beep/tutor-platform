// pages/client/Schedule.jsx — расписание ученика
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty } from '../../ui';
import LessonsByDay from '../../components/LessonsByDay';

export default function ClientSchedule({ student }) {
  const from = new Date(Date.now() - 30 * 864e5).toISOString();
  const to = new Date(Date.now() + 60 * 864e5).toISOString();
  const lessons = useLoad(() => api.lessons({ student_id: student.id, from, to }), [student.id]);

  if (lessons.loading) return <Spinner />;
  if (lessons.error) return <ErrorBox error={lessons.error} onRetry={lessons.reload} />;

  const now = Date.now();
  const upcoming = lessons.data.filter((l) => new Date(l.starts_at) >= now && l.status !== 'cancelled');
  const past = lessons.data.filter((l) => new Date(l.starts_at) < now && l.status !== 'scheduled').reverse();

  return (
    <>
      <div className="page-head"><h1 className="page-title">Расписание</h1></div>
      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Впереди</h2></div>
          {!upcoming.length ? <Empty title="Занятия ещё не назначены" /> : <LessonsByDay lessons={upcoming} showStudent={false} />}
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Прошедшие</h2></div>
          {!past.length ? <Empty title="Пока ничего" /> : <LessonsByDay lessons={past} showStudent={false} />}
        </section>
      </div>
    </>
  );
}
