// pages/tutor/Students.jsx — список учеников
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, navigate } from '../../ui';
import { StudentModal } from './modals';
import { CATEGORY, rub, relativeDay, time } from '../../format';

const FILTERS = [
  { key: 'active', label: 'Занимаются' },
  { key: 'paused', label: 'На паузе' },
  { key: 'archived', label: 'Архив' },
];

export default function Students() {
  const [status, setStatus] = useState('active');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const list = useLoad(() => api.students(status), [status]);

  const shown = (list.data || []).filter((s) => s.full_name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Ученики</h1>
          {list.data && status === 'active' && <div className="lead">Сейчас занимаются {list.data.length}</div>}
        </div>
        <button className="btn" onClick={() => setAdding(true)}><Icon name="plus" /> Ученик</button>
      </div>

      <div className="row wrap" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`btn btn-sm ${status === f.key ? '' : 'btn-secondary'}`} onClick={() => setStatus(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 260, height: 38 }} placeholder="Поиск по имени" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="panel">
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !shown.length && (
          <Empty title={q ? 'Никого не нашли' : 'Здесь пока пусто'}
            action={!q && status === 'active' && <button className="btn" onClick={() => setAdding(true)}>Добавить ученика</button>} />
        )}
        <div className="list">
          {shown.map((s) => (
            <div key={s.id} className="list-item clickable" onClick={() => navigate(`/students/${s.id}`)}>
              <div className="avatar">{s.full_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}</div>
              <div className="list-main">
                <div className="list-title">{s.full_name}</div>
                <div className="list-sub truncate">
                  {[CATEGORY[s.category], s.level, s.textbook].filter(Boolean).join(', ')}
                  {s.next_lesson_at && `. Следующее: ${relativeDay(s.next_lesson_at).toLowerCase()} в ${time(s.next_lesson_at)}`}
                </div>
              </div>
              <div className="row hide-sm" style={{ gap: 6 }}>
                {s.homework_to_check > 0 && <Badge>ДЗ на проверке: {s.homework_to_check}</Badge>}
                {s.balance < 0 && <Badge tone="red">Долг {rub(-s.balance)}</Badge>}
                {s.lessons_remaining > 0 && <Badge tone="green">Абонемент: {s.lessons_remaining}</Badge>}
                {!s.login && <Badge>Без входа</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {adding && (
        <StudentModal onClose={() => setAdding(false)} onSaved={(s) => navigate(`/students/${s.id}/access`)} />
      )}
    </>
  );
}
