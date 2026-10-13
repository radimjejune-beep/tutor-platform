// components/TodayLessons.jsx — экран «Сегодня»: всё, что нужно перед каждым уроком, в одной карточке
import { useState } from 'react';
import { Link, Icon, Badge, Empty } from '../ui';
import FinishLessonModal, { unitLabel } from './FinishLesson';
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

  return (
    <div className="today">
      {lessons.map((l) => (
        <TodayCard key={l.id} l={l} current={current?.id === l.id} onFinish={() => setFinishing(l)} onOpen={() => onOpenLesson(l)} />
      ))}
      {finishing && (
        <FinishLessonModal lesson={finishing} unit={finishing.unit} onClose={() => setFinishing(null)}
          onDone={() => { setFinishing(null); onChanged(); }} />
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
