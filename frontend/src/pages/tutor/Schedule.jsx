// pages/tutor/Schedule.jsx — расписание по неделям
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon } from '../../ui';
import { LessonModal, NewLessonModal } from './modals';
import LessonsByDay from '../../components/LessonsByDay';
import { dayMonth, lessonsWord } from '../../format';

// Понедельник недели со сдвигом offset
function weekStart(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

export default function TutorSchedule() {
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState(null);
  const from = weekStart(offset);
  const to = new Date(from.getTime() + 7 * 864e5);
  const lessons = useLoad(() => api.lessons({ from: from.toISOString(), to: to.toISOString() }), [offset]);

  const saved = () => {
    setModal(null);
    lessons.reload();
  };
  const active = (lessons.data || []).filter((l) => l.status !== 'cancelled');
  const label =
    offset === 0 ? 'Эта неделя' : offset === 1 ? 'Следующая неделя' : offset === -1 ? 'Прошлая неделя' : `${dayMonth(from)} – ${dayMonth(new Date(to - 1))}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Расписание</h1>
          <div className="lead">
            {label}{lessons.data ? `, ${lessonsWord(active.length)}` : ''}
          </div>
        </div>
        <div className="row wrap">
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setOffset(offset - 1)} aria-label="Предыдущая неделя">
              <Icon name="back" />
            </button>
            {offset !== 0 && <button className="btn btn-secondary btn-sm" onClick={() => setOffset(0)}>Сегодня</button>}
            <button className="btn btn-secondary btn-sm" onClick={() => setOffset(offset + 1)} aria-label="Следующая неделя">
              <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}><Icon name="back" /></span>
            </button>
          </div>
          <button className="btn" onClick={() => setModal({ type: 'new' })}><Icon name="plus" /> Занятие</button>
        </div>
      </div>

      <div className="panel">
        {lessons.loading && <Spinner />}
        {lessons.error && <ErrorBox error={lessons.error} onRetry={lessons.reload} />}
        {lessons.data && !lessons.data.length && (
          <Empty title="На этой неделе занятий нет"
            action={<button className="btn" onClick={() => setModal({ type: 'new' })}>Добавить занятие</button>} />
        )}
        {lessons.data?.length > 0 && <LessonsByDay lessons={lessons.data} onOpen={(l) => setModal({ type: 'lesson', lesson: l })} />}
      </div>

      {modal?.type === 'new' && <NewLessonModal onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'lesson' && <LessonModal lesson={modal.lesson} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}
