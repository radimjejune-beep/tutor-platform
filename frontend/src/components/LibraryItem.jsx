// components/LibraryItem.jsx — карточка материала библиотеки (теория или задача)
// showPrivate — показывать ответ и заметку преподавателя
import { Badge, Icon } from '../ui';
import { FileList } from './Files';

export const examLabel = (i) => (i.exam ? `${i.exam}${i.exam_task ? `, задание ${i.exam_task}` : ''}` : null);

export function ItemMeta({ item, showTags }) {
  const exam = examLabel(item);
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {exam && <Badge tone="green">{exam}</Badge>}
      <Badge>{item.subject}</Badge>
      {showTags && (item.tags || []).map((t) => <Badge key={t} tone="brass">#{t}</Badge>)}
    </div>
  );
}

export default function LibraryItem({ item, index, showPrivate, actions }) {
  return (
    <article className="lib-card">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="lib-title">{index !== undefined ? `${index + 1}. ` : ''}{item.title}</h3>
          <div style={{ marginTop: 6 }}><ItemMeta item={item} showTags={showPrivate} /></div>
        </div>
        {actions}
      </div>
      {item.body && <div className="instructions" style={{ marginTop: 14 }}>{item.body}</div>}
      {item.links?.length > 0 && (
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          {item.links.map((u) => (
            <a key={u} className="btn btn-secondary btn-sm" href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a>
          ))}
        </div>
      )}
      {item.files?.length > 0 && <div style={{ marginTop: 12 }}><FileList files={item.files} /></div>}
      {showPrivate && (item.answer || item.tutor_note) && (
        <div className="lib-private">
          {item.tutor_note && (
            <div><Icon name="note" size={16} /> <span>{item.tutor_note}</span></div>
          )}
          {item.answer && (
            <details>
              <summary>Ответ</summary>
              <div className="instructions">{item.answer}</div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
