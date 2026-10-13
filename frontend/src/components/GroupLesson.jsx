// components/GroupLesson.jsx — завершить групповое занятие: отметка каждого, общий итог, ДЗ
import { useState } from 'react';
import { api } from '../api';
import { Modal, Field, useSubmit, useToast } from '../ui';
import { dayKey } from '../format';

const MARKS = [
  ['done', 'Был'],
  ['missed', 'Не был'],
  ['cancelled_late', 'Поздняя отмена'],
];

// session: { starts_at, topic, students: [{ lesson_id, student_id, student_name, status }] }
export function GroupFinishModal({ groupId, session, onClose, onDone }) {
  const toast = useToast();
  const [att, setAtt] = useState(Object.fromEntries(session.students.map((s) => [s.student_id, 'done'])));
  const [topic, setTopic] = useState(session.topic || '');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState(true);
  const [nextUnit, setNextUnit] = useState(false);
  const [due, setDue] = useState(dayKey(new Date(new Date(session.starts_at).getTime() + 7 * 864e5)));

  const save = useSubmit(async () => {
    const r = await api.finishGroupLesson(groupId, {
      starts_at: session.starts_at,
      attendance: att,
      topic: topic.trim() || null,
      summary: summary.trim() || null,
      private_notes: notes.trim() || null,
      homework,
      due_on: homework ? due : undefined,
      next_unit: nextUnit,
    });
    toast(`Отмечено: ${r.finished}${r.homework ? `, ДЗ по юниту выдано: ${r.homework}` : ''}`);
    onDone(r);
  });

  return (
    <Modal title="Завершить занятие группы" onClose={onClose} wide>
      <form className="form" onSubmit={save.submit}>
        <div className="attendance">
          {session.students.map((s) => (
            <div key={s.student_id} className="attendance-row">
              <span className="list-title">{s.student_name}</span>
              <div className="seg">
                {MARKS.map(([k, label]) => (
                  <button key={k} type="button" className={att[s.student_id] === k ? 'on' : ''} aria-pressed={att[s.student_id] === k}
                    onClick={() => setAtt({ ...att, [s.student_id]: k })}>{label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Field label="Тема"><input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={255} /></Field>
        <Field label="Что сделали" hint="Видят ученики и родители всей группы">
          <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </Field>
        <Field label="Заметка для себя"><textarea className="textarea" style={{ minHeight: 64 }} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <div className="finish-unit">
          <label className="check">
            <input type="checkbox" checked={homework} onChange={(e) => setHomework(e.target.checked)} />
            <span>Выдать ДЗ по текущему юниту курса каждому, кто был</span>
          </label>
          {homework && (
            <div className="row" style={{ paddingLeft: 28, gap: 10 }}>
              <span className="small muted">Срок</span>
              <input type="date" className="input" style={{ width: 170, height: 38 }} value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={nextUnit} onChange={(e) => setNextUnit(e.target.checked)} />
            <span>Юнит пройден, перейти дальше</span>
          </label>
          <div className="small muted">Ученики без курса получат только отметку и итог.</div>
        </div>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Готово'}</button>
        </div>
      </form>
    </Modal>
  );
}
