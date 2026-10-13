// components/FinishLesson.jsx — завершить урок одним окном:
// отметка, итог для родителей, заметка для себя, ДЗ по юниту и переход к следующему юниту
import { useState } from 'react';
import { api } from '../api';
import { Modal, Field, useSubmit, useToast, useLoad } from '../ui';
import { dayKey } from '../format';

const STATUSES = [
  ['done', 'Проведено'],
  ['missed', 'Не пришёл'],
  ['cancelled_late', 'Поздняя отмена'],
];

export const unitLabel = (u) => (u ? [u.code, u.title].filter(Boolean).join(' · ') : '');

export default function FinishLessonModal({ lesson, unit, onClose, onDone }) {
  const toast = useToast();
  const [status, setStatus] = useState('done');
  const [topic, setTopic] = useState(lesson.topic || (unit ? [unit.code, unit.title].filter(Boolean).join(' ') : ''));
  const [summary, setSummary] = useState(lesson.summary || '');
  const [notes, setNotes] = useState(lesson.private_notes || '');
  const [homework, setHomework] = useState(Boolean(unit && (unit.homework_count || unit.item_count)));
  const [nextUnit, setNextUnit] = useState(false);
  const [due, setDue] = useState('');

  // Срок ДЗ по умолчанию: день следующего урока
  const next = useLoad(
    () =>
      api.lessons({ student_id: lesson.student_id, from: new Date(new Date(lesson.starts_at).getTime() + 3600e3).toISOString() })
        .then((ls) => ls.find((l) => l.status === 'scheduled' && l.id !== lesson.id) || null),
    [lesson.id]
  );
  const defaultDue = next.data ? dayKey(next.data.starts_at) : dayKey(new Date(Date.now() + 7 * 864e5));
  const done = status === 'done';

  const save = useSubmit(async () => {
    const r = await api.finishLesson(lesson.id, {
      status,
      topic: topic.trim() || null,
      summary: summary.trim() || null,
      private_notes: notes.trim() || null,
      homework: done && homework,
      due_on: done && homework ? due || defaultDue : undefined,
      next_unit: done && nextUnit,
    });
    const parts = [done ? 'Урок отмечен' : 'Сохранено'];
    if (r.assignment) parts.push('ДЗ выдано');
    if (r.next_unit) parts.push(`дальше ${unitLabel(r.next_unit)}`);
    toast(parts.join(', '));
    onDone(r);
  });

  return (
    <Modal title="Завершить урок" onClose={onClose} wide>
      <form className="form" onSubmit={save.submit}>
        <div className="seg" role="radiogroup" aria-label="Как прошёл урок">
          {STATUSES.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={status === k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
              {label}
            </button>
          ))}
        </div>

        {done && (
          <>
            <Field label="Тема">
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={255} />
            </Field>
            <Field label="Что сделали" hint="Видят ученик и родители">
              <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)}
                placeholder="Разобрали прилагательные с предлогами, потренировали фразы из текста. Хорошо: keen on, proud of." />
            </Field>
          </>
        )}
        <Field label="Заметка для себя" hint="Видите только вы. Покажется перед следующим уроком">
          <textarea className="textarea" style={{ minHeight: 72 }} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Путает about и of. Начать с повторения." />
        </Field>

        {done && unit && (
          <div className="finish-unit">
            <div className="meta-label">{unit.course_title} · {unitLabel(unit)}</div>
            <label className="check">
              <input type="checkbox" checked={homework} onChange={(e) => setHomework(e.target.checked)}
                disabled={!unit.homework_count && !unit.item_count} />
              <span>
                Выдать ДЗ по юниту
                {!unit.homework_count && !unit.item_count && <span className="muted"> (в юните нет упражнений)</span>}
              </span>
            </label>
            {homework && (
              <div className="row" style={{ paddingLeft: 28, gap: 10 }}>
                <span className="small muted">Срок</span>
                <input type="date" className="input" style={{ width: 170, height: 38 }} value={due || defaultDue} onChange={(e) => setDue(e.target.value)} />
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={nextUnit} onChange={(e) => setNextUnit(e.target.checked)} />
              <span>Юнит пройден, к следующему уроку перейти дальше</span>
            </label>
          </div>
        )}

        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Готово'}</button>
        </div>
      </form>
    </Modal>
  );
}
