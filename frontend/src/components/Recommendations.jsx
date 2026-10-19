// components/Recommendations.jsx — «Что повторить»: сайт сам подсказывает слабые темы
// Ученику: со ссылками на задание, словарь, набор карточек. Репетитору: куда смотреть перед уроком.
import { api } from '../api';
import { useLoad, Icon, Link } from '../ui';

const KIND = {
  topic: { label: 'Тема', icon: 'flag' },
  exercise: { label: 'Упражнение', icon: 'quiz' },
  homework: { label: 'Задание', icon: 'book' },
  words: { label: 'Слова', icon: 'cards' },
  due: { label: 'Повторение', icon: 'cards' },
  set: { label: 'Карточки', icon: 'cards' },
  review: { label: 'Пройдено давно', icon: 'clock' },
};

// Куда ведёт подсказка у репетитора
function tutorLink(r, studentId) {
  if (r.item_id) return `/library/${r.item_id}`;
  if (r.kind === 'words' || r.kind === 'due') return `/students/${studentId}/words`;
  if (r.kind === 'set' && r.link) return `/wordsets/${r.link.split('/').pop()}`;
  if (r.kind === 'homework') return `/students/${studentId}/homework`;
  if (r.kind === 'review') return `/students/${studentId}/progress`;
  return null;
}

export default function Recommendations({ studentId, tutor, compact }) {
  const rec = useLoad(() => api.recommendations(studentId), [studentId]);
  if (!rec.data) return null;
  const { items, more, strong } = rec.data;
  if (!items.length && !(tutor && strong.length)) {
    if (compact) return null;
    return (
      <section className="panel rec">
        <h2 className="section-title">Что повторить</h2>
        <p className="muted small" style={{ margin: '8px 0 0' }}>Пока всё хорошо: слабых тем нет. Подсказки появятся после упражнений и заданий.</p>
      </section>
    );
  }
  const list = compact ? items.slice(0, 3) : items;
  return (
    <section className="panel rec">
      <div className="panel-head">
        <h2 className="section-title">{tutor ? 'Что подтянуть' : 'Что повторить'}</h2>
        <span className="small muted">{tutor ? 'по результатам упражнений, заданий и словаря' : 'сайт подобрал сам по твоим результатам'}</span>
      </div>
      <div className="rec-list">
        {list.map((r, i) => {
          const k = KIND[r.kind] || KIND.topic;
          const to = tutor ? tutorLink(r, studentId) : r.link;
          const body = (
            <>
              <span className="rec-icon"><Icon name={k.icon} size={18} /></span>
              <span className="rec-main">
                <span className="meta-label">{k.label}</span>
                <span className="rec-title">{r.title}</span>
                <span className="small muted">{r.reason}</span>
              </span>
              {to && <span className="rec-go"><Icon name="play" size={14} /></span>}
            </>
          );
          return to ? <Link key={i} to={to} className="rec-item clickable">{body}</Link> : <div key={i} className="rec-item">{body}</div>;
        })}
      </div>
      {compact && items.length > 3 && <Link to="/progress" className="small" style={{ display: 'inline-block', marginTop: 10 }}>Все подсказки ({items.length + more})</Link>}
      {tutor && strong.length > 0 && (
        <div className="rec-strong small">
          <b>Хорошо получается:</b> {strong.map((s) => `${s.title} (${s.reason.replace('в среднем ', '')})`).join(', ')}
        </div>
      )}
    </section>
  );
}
