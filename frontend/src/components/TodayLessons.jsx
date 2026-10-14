// components/TodayLessons.jsx — экран «Сегодня»: всё, что нужно перед каждым уроком, в одной карточке
import { useState } from 'react';
import { Link, Icon, Badge, Empty } from '../ui';
import FinishLessonModal, { unitLabel } from './FinishLesson';
import { GroupFinishModal } from './GroupLesson';
import { callService } from '../pages/LessonRoom';
import { time, shortDate, rub, LESSON_STATUS, HW_STATUS, plural } from '../format';

export default function TodayLessons({ lessons, onChanged, onOpenLesson }) {
  const [finishing, setFinishing] = useState(null);
  const now = Date.now();
  // Ближайший незавершённый урок подсвечивается
  const current = lessons.find((l) => l.status === 'scheduled' && new Date(l.starts_at).getTime() + l.duration_min * 60000 > now);

  if (!lessons.length) {
    return (
      <div className="today-empty">
        <Empty title="Сегодня уроков нет">Можно спланировать неделю или подготовить материалы.</Empty>
      </div>
    );
  }

  // Групповое занятие приходит строкой на каждого ученика: собираем в одну карточку
  const rows = [];
  const sessions = {};
  for (const l of lessons) {
    if (!l.group_id) { rows.push({ type: 'one', l }); continue; }
    const key = `${l.group_id}|${l.starts_at}`;
    if (!sessions[key]) { sessions[key] = { type: 'group', key, l, members: [] }; rows.push(sessions[key]); }
    sessions[key].members.push(l);
  }

  return (
    <div className="today">
      {rows.map((r) =>
        r.type === 'one' ? (
          <TodayCard key={r.l.id} l={r.l} current={current?.id === r.l.id} onFinish={() => setFinishing({ one: r.l })} onOpen={() => onOpenLesson(r.l)} />
        ) : (
          <GroupCard key={r.key} s={r} current={r.members.some((m) => m.id === current?.id)} onFinish={() => setFinishing({ group: r })} />
        )
      )}
      {finishing?.one && (
        <FinishLessonModal lesson={finishing.one} unit={finishing.one.unit} onClose={() => setFinishing(null)}
          onDone={() => { setFinishing(null); onChanged(); }} />
      )}
      {finishing?.group && (
        <GroupFinishModal groupId={finishing.group.l.group_id}
          session={{ starts_at: finishing.group.l.starts_at, topic: finishing.group.l.topic,
            students: finishing.group.members.map((m) => ({ lesson_id: m.id, student_id: m.student_id, student_name: m.student_name, status: m.status })) }}
          onClose={() => setFinishing(null)} onDone={() => { setFinishing(null); onChanged(); }} />
      )}
    </div>
  );
}

function TodayCard({ l, current, onFinish, onOpen }) {
  const end = new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000);
  const scheduled = l.status === 'scheduled';
  const f = l.finance || {};
  const money =
    f.balance < 0 ? `Долг ${rub(-f.balance)}` : f.lessons_remaining !== null && f.lessons_remaining !== undefined && f.lessons_remaining <= 1
      ? f.lessons_remaining === 0 ? 'Абонемент закончился' : 'В абонементе последнее занятие' : null;
  const v = l.vocab || {};
  const prev = l.previous;

  return (
    <article className={`today-card ${current ? 'current' : ''} ${scheduled ? '' : 'past'}`}>
      <div className="today-time">
        <span className="serif">{time(l.starts_at)}</span>
        <span className="small muted">до {time(end)}</span>
      </div>

      <div className="today-body">
        <div className="today-head">
          <div style={{ minWidth: 0 }}>
            <Link to={`/students/${l.student_id}`} className="today-name serif">{l.student_name}</Link>
            <div className="small muted">
              {l.unit ? `${l.unit.course_title} · ${unitLabel(l.unit)}` : l.topic || 'Курс не выбран'}
            </div>
          </div>
          {!scheduled && <Badge tone={LESSON_STATUS[l.status]?.tone}>{LESSON_STATUS[l.status]?.label}</Badge>}
        </div>

        <dl className="brief">
          {prev && (
            <div>
              <dt>В прошлый раз, {shortDate(prev.starts_at)}</dt>
              <dd>
                {[prev.topic, prev.summary].filter(Boolean).join('. ') || 'Без записей'}
                {prev.private_notes && <span className="brief-note">{prev.private_notes}</span>}
              </dd>
            </div>
          )}
          {scheduled && (
            <div>
              <dt>Разминка</dt>
              <dd>
                {l.warmup_result ? (
                  <>
                    {l.warmup_result.correct} из {l.warmup_result.total}
                    {l.warmup_result.missed?.length > 0 && <>, ошибки: <b>{l.warmup_result.missed.join(', ')}</b></>}
                  </>
                ) : <span className="muted">ещё не сделана (откроется ученику за час до урока)</span>}
              </dd>
            </div>
          )}
          {l.homework?.length > 0 && (
            <div>
              <dt>Задания</dt>
              <dd className="brief-hw">
                {l.homework.map((h) => (
                  <Link key={h.id} to={h.status === 'submitted' ? `/homework/${h.assignment_id}/review/${h.id}` : `/homework/${h.assignment_id}`}>
                    <span className="truncate">{h.title}</span>
                    <Badge tone={HW_STATUS[h.status]?.tone}>
                      {HW_STATUS[h.status]?.label}{h.status === 'checked' && h.score !== null ? ` ${h.score}%` : ''}
                    </Badge>
                  </Link>
                ))}
              </dd>
            </div>
          )}
          {v.total > 0 && (
            <div>
              <dt>Словарь</dt>
              <dd>
                {v.total} {plural(v.total, 'слово', 'слова', 'слов')}
                {v.due > 0 && `, ${v.due} ждут повторения`}
                {v.weak > 0 && <>, <b>{v.weak} из ошибок</b>, с них можно начать</>}
              </dd>
            </div>
          )}
          {money && (
            <div>
              <dt>Оплата</dt>
              <dd><Link to={`/students/${l.student_id}/finance`} className="brief-warn">{money}</Link></dd>
            </div>
          )}
        </dl>

        <div className="today-actions">
          {l.join_link && scheduled && (
            <a className="btn btn-sm" href={l.join_link} target="_blank" rel="noreferrer"><Icon name="video" /> {callService(l.join_link)}</a>
          )}
          <Link to={`/lesson/${l.id}`} className="btn btn-secondary btn-sm">
            Комната урока{l.item_count ? ` · ${l.item_count}` : ''}
          </Link>
          {scheduled ? (
            <button className="btn btn-secondary btn-sm" onClick={onFinish}><Icon name="check" /> Завершить</button>
          ) : (
            <button className="btn btn-quiet btn-sm" onClick={onOpen}>Изменить</button>
          )}
        </div>
      </div>
    </article>
  );
}

function GroupCard({ s, current, onFinish }) {
  const l = s.l;
  const end = new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000);
  const scheduled = s.members.some((m) => m.status === 'scheduled');
  return (
    <article className={`today-card ${current ? 'current' : ''} ${scheduled ? '' : 'past'}`}>
      <div className="today-time">
        <span className="serif">{time(l.starts_at)}</span>
        <span className="small muted">до {time(end)}</span>
      </div>
      <div className="today-body">
        <div className="today-head">
          <div style={{ minWidth: 0 }}>
            <Link to={`/groups/${l.group_id}`} className="today-name serif">{l.group_name}</Link>
            <div className="small muted">Группа · {s.members.length} {plural(s.members.length, 'ученик', 'ученика', 'учеников')}{l.topic ? ` · ${l.topic}` : ''}</div>
          </div>
        </div>
        <dl className="brief">
          {s.members.map((m) => {
            const notes = [];
            if (m.status !== 'scheduled') notes.push(LESSON_STATUS[m.status]?.label);
            const open = (m.homework || []).filter((h) => h.status === 'assigned').length;
            const toCheck = (m.homework || []).filter((h) => h.status === 'submitted').length;
            if (toCheck) notes.push(`ДЗ на проверке: ${toCheck}`);
            if (open) notes.push(`не сдано ДЗ: ${open}`);
            if (m.vocab?.weak) notes.push(`${m.vocab.weak} слов из ошибок`);
            if (m.finance?.balance < 0) notes.push(<span key="d" className="brief-warn">долг {rub(-m.finance.balance)}</span>);
            return (
              <div key={m.id}>
                <dt><Link to={`/students/${m.student_id}`} style={{ color: 'var(--ink)' }}>{m.student_name}</Link></dt>
                <dd>{notes.length ? notes.reduce((acc, n, i) => (i ? [...acc, ', ', n] : [n]), []) : <span className="muted">всё в порядке</span>}</dd>
              </div>
            );
          })}
        </dl>
        <div className="today-actions">
          {l.join_link && scheduled && (
            <a className="btn btn-sm" href={l.join_link} target="_blank" rel="noreferrer"><Icon name="video" /> {callService(l.join_link)}</a>
          )}
          <Link to={`/lesson/${l.id}`} className="btn btn-secondary btn-sm">Комната урока</Link>
          {scheduled && <button className="btn btn-secondary btn-sm" onClick={onFinish}><Icon name="check" /> Завершить</button>}
        </div>
      </div>
    </article>
  );
}
