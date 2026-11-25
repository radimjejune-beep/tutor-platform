import {StudySubjectContext} from '../study-context';
// components/LibraryItem.jsx — карточка материала библиотеки (теория или задача)
// showPrivate — показывать ответ и заметку преподавателя
import { MathText } from './MathText';
import { Badge, Icon } from '../ui';
import { FileList } from './Files';
import GamePlayer from '../games/Players';
import HtmlLesson from './HtmlLesson';
import { GAME_TYPES, gameSize, gameLabel } from '../games/logic';
import { DeckPlayer, parseDeck } from './Deck';
import { useAuth } from '../auth';
import MaterialTopic from './MaterialTopic';

export const examLabel = (i) => (i.exam ? `${i.exam}${i.exam_task ? `, задание ${i.exam_task}` : ''}` : null);

const deckSize = (item) => { const n = parseDeck(item.html)?.slides.length; return n ? `, ${n} сл.` : ''; };

export function ItemMeta({ item, showTags }) {
  const exam = examLabel(item);
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      {item.kind === 'game' && item.game && <Badge tone="brass">{gameLabel(item.game)}, {gameSize(item.game)}</Badge>}
      {item.kind === 'html' && <Badge tone="brass">Интерактивный урок</Badge>}
      {item.kind === 'deck' && <Badge tone="brass">Урок из слайдов{deckSize(item)}</Badge>}
      {exam && <Badge tone="green">{exam}</Badge>}
      <Badge>{item.subject}</Badge>
      {showTags && (item.tags || []).map((t) => <Badge key={t} tone="brass">#{t}</Badge>)}
    </div>
  );
}

// onGameFinish — сохранить результат упражнения; gameExtra — что показать под упражнением (результаты)
export default function LibraryItem({ item, index, showPrivate, actions, onGameFinish, gameExtra, draftKey, gameNotice, compactGame=false }) {
  // Фото и аудио, которые уже стоят внутри листа с заданиями, отдельным списком не дублируем
  const user = useAuth()?.user;
  const deck = item.kind === 'deck' ? parseDeck(item.html) : null;
  const used = new Set([...(item.game?.type === 'sheet' ? item.game.blocks : []).flatMap((b) => [b.image, b.audio, ...(b.t === 'listening' ? b.options.map(option => option.image) : [])]), ...(deck?.slides || []).map((x) => x.image)].filter(Boolean));
  const files = (item.files || []).filter((f) => !used.has(f.id));
  return (
    <StudySubjectContext.Provider value={{subject:item.subject}}><article className={`lib-card${compactGame ? ' listening-public' : ''}`}>
      {!compactGame&&<div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="lib-title">{index !== undefined ? `${index + 1}. ` : ''}{item.title}</h3>
          <div style={{ marginTop: 6 }}><ItemMeta item={item} showTags={showPrivate} /></div>
        </div>
        {actions}
      </div>}
      {item.body && <MathText as="div" className="instructions" style={{ marginTop: 14 }}>{item.body}</MathText>}
      {gameNotice && <p className="learning-note">{gameNotice}</p>}
      {item.kind === 'game' && item.game && !gameNotice && (
        <div style={{ marginTop: 14 }}>
          <GamePlayer title={item.title} game={item.game} onFinish={onGameFinish} footer={gameExtra} draftKey={draftKey} />
        </div>
      )}
      {item.kind === 'html' && item.html && (
        <div style={{ marginTop: 14 }}>
          <HtmlLesson html={item.html} onFinish={onGameFinish} />
          {gameExtra}
        </div>
      )}
      {deck && (
        <div style={{ marginTop: 14 }}>
          <DeckPlayer deck={deck} isTutor={user?.role === 'tutor'} />
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
      {showPrivate && user?.role==='tutor' && item.kind==='game' && <MaterialTopic id={item.id} subject={item.subject}/>}
      {showPrivate && (item.answer || item.tutor_note) && (
        <div className="lib-private">
          {item.tutor_note && (
            <div><Icon name="note" size={16} /> <span>{item.tutor_note}</span></div>
          )}
          {item.answer && (
            <details>
              <summary>Ответ</summary>
              <MathText as="div" className="instructions">{item.answer}</MathText>
            </details>
          )}
        </div>
      )}
    </article></StudySubjectContext.Provider>
  );
}
