// components/LibraryItem.jsx — карточка материала библиотеки (теория или задача)
// showPrivate — показывать ответ и заметку преподавателя
import { Badge, Icon } from '../ui';
import { FileList } from './Files';
import GamePlayer from '../games/Players';
import HtmlLesson from './HtmlLesson';
import { GAME_TYPES, gameSize } from '../games/logic';

export const examLabel = (i) => (i.exam ? `${i.exam}${i.exam_task ? `, задание ${i.exam_task}` : ''}` : null);

export function ItemMeta({ item, showTags }) {
  const exam = examLabel(item);
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {item.kind === 'game' && item.game && <Badge tone="brass">{GAME_TYPES[item.game.type]?.label}, {gameSize(item.game)}</Badge>}
      {item.kind === 'html' && <Badge tone="brass">Интерактивный урок</Badge>}
      {exam && <Badge tone="green">{exam}</Badge>}
      <Badge>{item.subject}</Badge>
      {showTags && (item.tags || []).map((t) => <Badge key={t} tone="brass">#{t}</Badge>)}
    </div>
  );
}

// onGameFinish — сохранить результат упражнения; gameExtra — что показать под упражнением (результаты)
export default function LibraryItem({ item, index, showPrivate, actions, onGameFinish, gameExtra }) {
  // Фото и аудио, которые уже стоят внутри листа с заданиями, отдельным списком не дублируем
  const used = new Set((item.game?.type === 'sheet' ? item.game.blocks : []).flatMap((b) => [b.image, b.audio]).filter(Boolean));
  const files = (item.files || []).filter((f) => !used.has(f.id));
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
      {item.kind === 'game' && item.game && (
        <div style={{ marginTop: 14 }}>
          <GamePlayer game={item.game} onFinish={onGameFinish} footer={gameExtra} />
        </div>
      )}
      {item.kind === 'html' && item.html && (
        <div style={{ marginTop: 14 }}>
          <HtmlLesson html={item.html} onFinish={onGameFinish} />
          {gameExtra}
        </div>
      )}
      {item.links?.length > 0 && (
        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
          {item.links.map((u) => (
            <a key={u} className="btn btn-secondary btn-sm" href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a>
          ))}
        </div>
      )}
      {files.length > 0 && <div style={{ marginTop: 12 }}><FileList files={files} /></div>}
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
