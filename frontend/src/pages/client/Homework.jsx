// pages/client/Homework.jsx — задания: ученик сдаёт, родитель смотрит
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Modal, Field, useSubmit, useToast } from '../../ui';
import { shortDate, HW_STATUS } from '../../format';

function linkLabel(url) {
  if (url.includes('holst')) return 'Доска в Холсте';
  if (url.includes('wordwall')) return 'Упражнение Wordwall';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Ссылка';
  }
}

export default function ClientHomework({ student, isParent }) {
  const hw = useLoad(() => api.homework({ student_id: student.id }), [student.id]);
  const [open, setOpen] = useState(null);

  if (hw.loading) return <Spinner />;
  if (hw.error) return <ErrorBox error={hw.error} onRetry={hw.reload} />;

  const todo = hw.data.filter((h) => h.status !== 'checked');
  const done = hw.data.filter((h) => h.status === 'checked');
  const today = new Date().toISOString().slice(0, 10);

  const Item = ({ h }) => (
    <div className="list-item clickable" onClick={() => setOpen(h)}>
      <div className="list-main">
        <div className="list-title">{h.title}</div>
        <div className="list-sub truncate">
          {h.due_on ? `К ${shortDate(h.due_on)}` : 'Без срока'}
          {h.score !== null && h.score !== undefined ? `. Оценка ${h.score}%` : ''}
        </div>
      </div>
      {h.status === 'assigned' && h.due_on && h.due_on < today ? (
        <Badge tone="red">Просрочено</Badge>
      ) : (
        <Badge tone={HW_STATUS[h.status].tone}>{HW_STATUS[h.status].label}</Badge>
      )}
    </div>
  );

  return (
    <>
      <div className="page-head"><h1 className="page-title">Домашние задания</h1></div>
      <div className="grid grid-2">
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Текущие</h2></div>
          {!todo.length ? <Empty title="Всё сделано" /> : <div className="list">{todo.map((h) => <Item key={h.id} h={h} />)}</div>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2 className="section-title">Проверенные</h2></div>
          {!done.length ? <Empty title="Пока нет" /> : <div className="list">{done.map((h) => <Item key={h.id} h={h} />)}</div>}
        </section>
      </div>
      {open && (
        <HomeworkView h={open} canSubmit={!isParent} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); hw.reload(); }} />
      )}
    </>
  );
}

function HomeworkView({ h, canSubmit, onClose, onSaved }) {
  const toast = useToast();
  const [answer, setAnswer] = useState(h.student_answer || '');
  const { busy, error, submit } = useSubmit(async () => {
    await api.submitHomework(h.id, answer.trim() || 'Сделано');
    toast('Отправлено на проверку');
    onSaved();
  });

  return (
    <Modal title={h.title} onClose={onClose} wide>
      <div className="row wrap" style={{ gap: 8, marginTop: -8, marginBottom: 16 }}>
        <Badge tone={HW_STATUS[h.status].tone}>{HW_STATUS[h.status].label}</Badge>
        {h.due_on && <Badge>К {shortDate(h.due_on)}</Badge>}
      </div>
      {h.description && <p style={{ whiteSpace: 'pre-line', marginTop: 0 }}>{h.description}</p>}
      {h.links?.length > 0 && (
        <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
          {h.links.map((url) => (
            <a key={url} className="btn btn-secondary btn-sm" href={url} target="_blank" rel="noreferrer">{linkLabel(url)}</a>
          ))}
        </div>
      )}

      {h.status === 'checked' ? (
        <div className="panel" style={{ background: 'var(--green-soft)', border: 0, boxShadow: 'none' }}>
          <div className="small" style={{ color: 'var(--green-ink)', fontWeight: 600, marginBottom: 4 }}>
            Комментарий преподавателя{h.score !== null && h.score !== undefined ? `, ${h.score}%` : ''}
          </div>
          <div style={{ whiteSpace: 'pre-line' }}>{h.tutor_feedback || 'Проверено, всё хорошо'}</div>
        </div>
      ) : canSubmit ? (
        <form className="form" onSubmit={submit}>
          {h.tutor_feedback && <div className="note">Преподаватель: {h.tutor_feedback}</div>}
          <Field label="Ваш ответ" hint="Можно написать ответы или просто отметить, что задание сделано">
            <textarea className="textarea" value={answer} onChange={(e) => setAnswer(e.target.value)} style={{ minHeight: 130 }} />
          </Field>
          {error && <div className="alert">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Закрыть</button>
            <button className="btn" disabled={busy}>
              {busy ? 'Отправляем…' : h.status === 'submitted' ? 'Отправить заново' : 'Сдать задание'}
            </button>
          </div>
        </form>
      ) : (
        h.student_answer && (
          <div className="panel" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
            <div className="small muted" style={{ marginBottom: 4 }}>Ответ ученика</div>
            <div style={{ whiteSpace: 'pre-line' }}>{h.student_answer}</div>
          </div>
        )
      )}
    </Modal>
  );
}
