// pages/tutor/Schedule.jsx — расписание по неделям
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Modal, navigate, useToast, useSubmit } from '../../ui';
import WeekGrid from '../../components/WeekGrid';
import { LessonModal, NewLessonModal } from './modals';
import LessonsByDay from '../../components/LessonsByDay';
import { dayMonth, lessonsWord, time, relativeDay } from '../../format';

const VIEW_KEY = 'lf-schedule-view';
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) || 'week'; } catch { return 'week'; } };

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
  const [view, setViewState] = useState(savedView);
  const toast = useToast();
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* без памяти */ } };
  const from = weekStart(offset);
  const to = new Date(from.getTime() + 7 * 864e5);
  const lessons = useLoad(() => api.lessons({ from: from.toISOString(), to: to.toISOString() }), [offset]);

  const saved = () => {
    setModal(null);
    lessons.reload();
  };
  const active = (lessons.data || []).filter((l) => l.status !== 'cancelled');

  // Перенос перетаскиванием
  const move = async (b, to) => {
    try {
      if (b.group) await api.moveGroupLesson(b.lesson.group_id, b.lesson.starts_at, to.toISOString());
      else await api.updateLesson(b.lesson.id, { starts_at: to.toISOString() });
      toast(`Перенесено: ${relativeDay(to).toLowerCase()}, ${dayMonth(to)} в ${time(to)}. Ученик получит уведомление`);
      lessons.reload();
    } catch (err) {
      toast(err.message, 'error');
      lessons.reload();
    }
  };
  const openBlock = (b) => (b.group ? navigate(`/groups/${b.lesson.group_id}`) : setModal({ type: 'lesson', lesson: b.lesson }));
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
          <div className="seg seg-quiet">
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Неделя</button>
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Список</button>
          </div>
          <button className="btn btn-secondary" onClick={() => setModal({ type: 'extend' })}>Продлить</button>
          <button className="btn" onClick={() => setModal({ type: 'new' })}><Icon name="plus" /> Занятие</button>
        </div>
      </div>

      {view === 'week' && lessons.data && (
        <section className="panel week-panel">
          <WeekGrid from={from} lessons={lessons.data} onOpen={openBlock} onMove={move}
            onCreate={(d) => setModal({ type: 'new', start: d })} />
          <div className="small muted" style={{ marginTop: 10 }}>Перетащите занятие, чтобы перенести. Нажмите на пустое место, чтобы поставить новое.</div>
        </section>
      )}

      <div className="panel" hidden={view === 'week' && Boolean(lessons.data)}>
        {lessons.loading && <Spinner />}
        {lessons.error && <ErrorBox error={lessons.error} onRetry={lessons.reload} />}
        {lessons.data && !lessons.data.length && (
          <Empty title="На этой неделе занятий нет"
            action={<button className="btn" onClick={() => setModal({ type: 'new' })}>Добавить занятие</button>} />
        )}
        {lessons.data?.length > 0 && <LessonsByDay lessons={lessons.data} onOpen={(l) => setModal({ type: 'lesson', lesson: l })} />}
      </div>

      {modal?.type === 'new' && <NewLessonModal defaultStart={modal.start} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.type === 'extend' && <ExtendModal onClose={() => setModal(null)} onDone={saved} />}
      {modal?.type === 'lesson' && <LessonModal lesson={modal.lesson} onClose={() => setModal(null)} onSaved={saved} />}
    </>
  );
}

// Продлить расписание: повторить последнюю неделю каждого ученика и группы
function ExtendModal({ onClose, onDone }) {
  const toast = useToast();
  const [weeks, setWeeks] = useState(4);
  const preview = useLoad(() => api.extendSchedule({ weeks, preview: true }), [weeks]);
  const save = useSubmit(async () => {
    const r = await api.extendSchedule({ weeks, preview: false });
    toast(r.sessions ? `Добавлено занятий: ${r.sessions}` : 'Добавлять нечего');
    onDone();
  });
  const p = preview.data;
  return (
    <Modal title="Продлить расписание" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Последняя неделя каждого ученика и группы повторится вперёд. Время, которое уже занято, пропускается.
      </p>
      <div className="seg" style={{ marginBottom: 16 }}>
        {[2, 4, 8].map((n) => <button key={n} className={weeks === n ? 'on' : ''} onClick={() => setWeeks(n)}>{n} недели</button>)}
      </div>
      {preview.loading && <Spinner />}
      {p && (
        <div className="note">
          {p.sessions ? `Будет добавлено занятий: ${p.sessions} (учеников и групп: ${p.owners}).` : 'Нечего продлевать: нет запланированных занятий.'}
          {p.skipped > 0 && ` Пропущено из-за пересечений: ${p.skipped}.`}
        </div>
      )}
      {save.error && <div className="alert" style={{ marginTop: 12 }}>{save.error}</div>}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button className="btn" disabled={save.busy || !p?.sessions} onClick={save.submit}>Продлить</button>
      </div>
    </Modal>
  );
}
