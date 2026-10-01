// pages/client/Schedule.jsx — расписание ученика: запись, перенос и отмена
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Modal, Field, useToast, useSubmit } from '../../ui';
import LessonsByDay from '../../components/LessonsByDay';
import { time, dayMonth, relativeDay, dayKey, isToday, cap, weekday } from '../../format';

const when = (d) => `${relativeDay(d)}, ${dayMonth(d)} в ${time(d)}`;

export default function ClientSchedule({ student }) {
  const toast = useToast();
  const [picker, setPicker] = useState(null); // { lesson? }
  const from = new Date(Date.now() - 30 * 864e5).toISOString();
  const to = new Date(Date.now() + 90 * 864e5).toISOString();
  const data = useLoad(
    () => Promise.all([api.lessons({ student_id: student.id, from, to }), api.bookingInfo(), api.bookingRequests()]),
    [student.id]
  );

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;

  const [lessons, info, allRequests] = data.data;
  const requests = allRequests.filter((r) => r.student_id === student.id);
  const pending = requests.filter((r) => r.status === 'pending');
  const declined = requests.filter((r) => r.status === 'declined');
  const now = Date.now();
  const noticeMs = info.notice_hours * 3600e3;
  const upcoming = lessons.filter((l) => new Date(l.starts_at) >= now && l.status === 'scheduled');
  const past = lessons.filter((l) => new Date(l.starts_at) < now && l.status !== 'scheduled').reverse();
  const movePending = new Set(pending.filter((r) => r.kind === 'reschedule').map((r) => r.lesson_id));

  const cancel = async (l) => {
    if (!window.confirm(`Отменить занятие ${when(l.starts_at).toLowerCase()}? Оно не спишется.`)) return;
    try {
      await api.cancelLessonClient(l.id);
      toast('Занятие отменено');
      data.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const withdraw = async (r) => {
    try {
      await api.withdrawRequest(r.id);
      toast('Запрос отозван');
      data.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // Группируем будущие занятия по дням
  const groups = [];
  for (const l of upcoming) {
    const key = dayKey(l.starts_at);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, date: l.starts_at, items: [] }));
    g.items.push(l);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Расписание</h1>
          {info.enabled && (
            <div className="lead">Перенести или отменить занятие можно не позже чем за {info.notice_hours} ч. Позже — через преподавателя</div>
          )}
        </div>
        {info.enabled && (
          <button className="btn" onClick={() => setPicker({})}><Icon name="plus" /> Записаться</button>
        )}
      </div>

      {(pending.length > 0 || declined.length > 0) && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head"><h2 className="section-title">Ваши запросы</h2></div>
          <div className="list">
            {pending.map((r) => (
              <div key={r.id} className="list-item wrap">
                <div className="list-main" style={{ minWidth: 200 }}>
                  <div className="list-title">{r.kind === 'book' ? 'Новое занятие' : 'Перенос'}: {when(r.starts_at)}</div>
                  <div className="list-sub">
                    {r.kind === 'reschedule' && r.lesson_starts_at ? `Вместо ${when(r.lesson_starts_at).toLowerCase()}. ` : ''}
                    Ждёт подтверждения преподавателя
                  </div>
                </div>
                <Badge tone="brass">На рассмотрении</Badge>
                <button className="btn btn-quiet btn-sm" onClick={() => withdraw(r)}>Отозвать</button>
              </div>
            ))}
            {declined.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-main">
                  <div className="list-title">{r.kind === 'book' ? 'Запись' : 'Перенос'} на {when(r.starts_at).toLowerCase()} отклонён</div>
                  <div className="list-sub">{r.tutor_comment || 'Выберите другое время или напишите преподавателю'}</div>
                </div>
                <Badge tone="red">Отклонено</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Впереди</h2></div>
          {!groups.length && (
            <Empty title="Занятия ещё не назначены" action={info.enabled && <button className="btn" onClick={() => setPicker({})}>Выбрать время</button>} />
          )}
          {groups.map((g) => (
            <div className="day-group" key={g.key}>
              <div className={`day-head ${isToday(g.date) ? 'today' : ''}`}>
                <span className="serif">{relativeDay(g.date)}</span>
                <span className="muted small">{dayMonth(g.date)}</span>
              </div>
              <div className="list">
                {g.items.map((l) => {
                  const inTime = new Date(l.starts_at) - now >= noticeMs;
                  return (
                    <div key={l.id} className="list-item wrap">
                      <div className="time-chip">{time(l.starts_at)}</div>
                      <div className="list-main" style={{ minWidth: 140 }}>
                        <div className="list-title truncate">{l.topic || 'Занятие'}</div>
                        <div className="list-sub">{l.duration_min} минут</div>
                      </div>
                      {info.enabled && (
                        movePending.has(l.id) ? (
                          <Badge tone="brass">Перенос на рассмотрении</Badge>
                        ) : inTime ? (
                          <div className="row" style={{ gap: 2 }}>
                            <button className="btn btn-quiet btn-sm" onClick={() => setPicker({ lesson: l })}>Перенести</button>
                            <button className="btn btn-quiet btn-sm" style={{ color: 'var(--danger)' }} onClick={() => cancel(l)}>Отменить</button>
                          </div>
                        ) : (
                          <span className="small muted">Перенос — через преподавателя</span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Прошедшие</h2></div>
          {!past.length ? <Empty title="Пока ничего" /> : <LessonsByDay lessons={past} showStudent={false} />}
        </section>
      </div>

      {picker && (
        <SlotPicker student={student} lesson={picker.lesson} onClose={() => setPicker(null)}
          onSent={() => { setPicker(null); data.reload(); }} />
      )}
    </>
  );
}

/* ============================================================
   Выбор свободного времени: сначала день, потом время
   ============================================================ */
function SlotPicker({ student, lesson, onClose, onSent }) {
  const toast = useToast();
  const slots = useLoad(() => api.slots(student.id, lesson?.id), [student.id, lesson?.id]);
  const [day, setDay] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [comment, setComment] = useState('');

  const { busy, error, submit } = useSubmit(async () => {
    await api.createBookingRequest({
      student_id: student.id,
      kind: lesson ? 'reschedule' : 'book',
      lesson_id: lesson?.id,
      starts_at: new Date(chosen).toISOString(),
      comment: comment.trim() || undefined,
    });
    toast('Запрос отправлен преподавателю');
    onSent();
  });

  const byDay = new Map();
  for (const s of slots.data?.slots || []) {
    const k = dayKey(s);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(s);
  }
  const days = [...byDay.keys()];
  const activeDay = day && byDay.has(day) ? day : days[0];

  return (
    <Modal title={lesson ? 'Перенести занятие' : 'Записаться на занятие'} onClose={onClose} wide>
      {lesson && <p className="muted" style={{ marginTop: -12 }}>Сейчас: {when(lesson.starts_at).toLowerCase()}</p>}
      {slots.loading && <Spinner />}
      {slots.error && <div className="alert">{slots.error.message}</div>}
      {slots.data && !days.length && (
        <Empty title="Свободного времени пока нет">Напишите преподавателю — он подберёт время.</Empty>
      )}
      {days.length > 0 && (
        <form className="form" onSubmit={submit}>
          <div className="day-chips" role="tablist" aria-label="День">
            {days.map((k) => {
              const d = byDay.get(k)[0];
              return (
                <button type="button" key={k} role="tab" aria-selected={k === activeDay}
                  className={`day-chip ${k === activeDay ? 'on' : ''}`} onClick={() => { setDay(k); setChosen(null); }}>
                  <span className="small">{cap(weekday(d)).slice(0, 2)}</span>
                  <b>{new Date(d).getDate()}</b>
                </button>
              );
            })}
          </div>
          <div className="small muted">{cap(relativeDay(byDay.get(activeDay)[0]))}, {dayMonth(byDay.get(activeDay)[0])}. {slots.data.duration_min} минут</div>
          <div className="time-grid">
            {byDay.get(activeDay).map((s) => (
              <button type="button" key={s} className={`time-btn ${chosen === s ? 'on' : ''}`} onClick={() => setChosen(s)} aria-pressed={chosen === s}>
                {time(s)}
              </button>
            ))}
          </div>
          <Field label="Комментарий" hint="Необязательно">
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: хотим заниматься по вторникам" maxLength={500} />
          </Field>
          {error && <div className="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button className="btn" disabled={!chosen || busy}>
              {busy ? 'Отправляем…' : chosen ? `Отправить запрос на ${time(chosen)}` : 'Выберите время'}
            </button>
          </div>
          <div className="small muted">Занятие появится в расписании после подтверждения преподавателем.</div>
        </form>
      )}
    </Modal>
  );
}
