// components/FinishLesson.jsx — завершить урок одним окном:
// отметка, итог для родителей, заметка для себя, ДЗ по юниту и переход к следующему юниту
import { useState } from 'react';
import { api } from '../api';
import { Modal, Field, Icon, useSubmit, useToast, useLoad } from '../ui';
import { dayKey, dayMonth, time, weekday, cap } from '../format';

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
  const tg = useLoad(() => api.telegramStatus().catch(() => null), []);
  const tgOn = Boolean(tg.data?.enabled);
  const [sendTg, setSendTg] = useState(!lesson.summary_sent_at);
  const parentText = parentMessage({ lesson, topic, summary, homework: done && homework, due: due || defaultDue });

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
    if (done && tgOn && sendTg && (summary.trim() || topic.trim())) {
      try {
        const t = await api.sendLessonSummary(lesson.id);
        parts.push(t.sent.length ? `итоги в Telegram: ${t.sent.join(', ')}` : 'родители ещё не подключили Telegram');
      } catch (err) {
        parts.push(`итоги не отправлены: ${err.message}`);
      }
    }
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
        {done && (summary.trim() || topic.trim()) && (
          <div className="parent-send">
            <div className="meta-label">Родителям</div>
            {tgOn && (
              <label className="check">
                <input type="checkbox" checked={sendTg} onChange={(e) => setSendTg(e.target.checked)} />
                <span>Отправить итоги в Telegram{lesson.summary_sent_at ? ' ещё раз' : ''}</span>
              </label>
            )}
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={async () => {
                try { await navigator.clipboard.writeText(parentText); toast('Текст скопирован: вставьте в WhatsApp, MAX или любой чат'); }
                catch { toast('Не получилось скопировать', 'error'); }
              }}><Icon name="note" /> Скопировать текст</button>
              <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(parentText)}`} target="_blank" rel="noreferrer">WhatsApp</a>
              <a className="btn btn-secondary btn-sm" href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(parentText)}`} target="_blank" rel="noreferrer">Telegram</a>
            </div>
            {!tgOn && <div className="small muted">Чтобы итоги уходили сами, подключите Telegram-бота в настройках.</div>}
          </div>
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

// Готовое сообщение родителям: для мессенджеров, где нет бота
export function parentMessage({ lesson, topic, summary, homework, due }) {
  const d = new Date(lesson.starts_at);
  const lines = [`Итоги урока: ${lesson.student_name || ''}`.trim(), `${cap(weekday(d))}, ${dayMonth(d)}, ${time(d)}`];
  if (topic?.trim()) lines.push('', `Тема: ${topic.trim()}`);
  if (summary?.trim()) lines.push('', summary.trim());
  if (homework) lines.push('', `Домашнее задание в личном кабинете${due ? `, срок ${dayMonth(new Date(`${due}T12:00:00`))}` : ''}.`);
  lines.push('', `Личный кабинет: ${window.location.origin}`);
  return lines.join('\n');
}
