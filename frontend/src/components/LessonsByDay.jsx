// components/LessonsByDay.jsx — список занятий, сгруппированный по дням
import { Badge } from '../ui';
import { time, dayMonth, relativeDay, dayKey, isToday, LESSON_STATUS } from '../format';

export default function LessonsByDay({ lessons, onOpen, showStudent = true }) {
  const groups = [];
  for (const l of lessons) {
    const key = dayKey(l.starts_at);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, date: l.starts_at, items: [] };
      groups.push(g);
    }
    g.items.push(l);
  }

  return groups.map((g) => (
    <div className="day-group" key={g.key}>
      <div className={`day-head ${isToday(g.date) ? 'today' : ''}`}>
        <span className="serif">{relativeDay(g.date)}</span>
        <span className="muted small">{dayMonth(g.date)}</span>
      </div>
      <div className="list">
        {g.items.map((l) => {
          const st = LESSON_STATUS[l.status];
          const faded = l.status === 'cancelled';
          return (
            <div
              key={l.id}
              className={`list-item ${onOpen ? 'clickable' : ''}`}
              onClick={onOpen ? () => onOpen(l) : undefined}
              style={faded ? { opacity: 0.55 } : undefined}
            >
              <div className="time-chip">{time(l.starts_at)}</div>
              <div className="list-main">
                <div className="list-title truncate">{showStudent ? l.student_name : l.topic || 'Занятие'}</div>
                <div className="list-sub truncate">
                  {showStudent ? l.topic || `${l.duration_min} минут` : `${l.duration_min} минут`}
                  {!showStudent && l.summary ? `. ${l.summary}` : ''}
                </div>
              </div>
              {l.status !== 'scheduled' && <Badge tone={st.tone}>{st.label}</Badge>}
            </div>
          );
        })}
      </div>
    </div>
  ));
}
