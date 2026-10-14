// pages/LessonRoom.jsx — комната урока: звонок, доска и задачи урока
// Ученик видит задачи сразу, как только преподаватель их добавил (обновляется сама)
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, useToast } from '../ui';
import LibraryItem from '../components/LibraryItem';
import { TaskPicker } from './tutor/Library';
import { ResultLine, byItem } from '../components/GameResults';
import { relativeDay, dayMonth, time } from '../format';
import FinishLessonModal, { unitLabel } from '../components/FinishLesson';
import { WarmupBanner } from '../components/Motivation';

export function callService(url) {
  if (!url) return null;
  if (/telemost|yandex/i.test(url)) return 'Телемост';
  if (/zoom\./i.test(url)) return 'Zoom';
  if (/meet\.google/i.test(url)) return 'Google Meet';
  return 'Видеозвонок';
}

// Доски, которые умеют встраиваться: обычную ссылку превращаем в ссылку для встраивания
export function boardEmbed(url) {
  if (!url) return url;
  const miro = url.match(/miro\.com\/app\/board\/([^/?#]+)/);
  if (miro) return `https://miro.com/app/live-embed/${miro[1]}/`;
  return url;
}

export default function LessonRoom({ id }) {
  const { user } = useAuth();
  const isTutor = user.role === 'tutor';
  const toast = useToast();
  const room = useLoad(() => Promise.all([api.lessonRoom(id), api.gameResults({ lesson_id: id }).catch(() => [])]), [id]);
  const [picking, setPicking] = useState(false);
  const [boardOpen, setBoardOpen] = useState(true);
  const [finishing, setFinishing] = useState(false);

  // Задачи (у ученика) и результаты упражнений (у преподавателя) обновляются каждые 15 секунд
  useEffect(() => {
    const t = setInterval(() => room.reload(), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (room.loading) return <Spinner />;
  if (room.error) return <ErrorBox error={room.error} onRetry={room.reload} />;
  const [l, results] = room.data;
  const resultsByItem = byItem(results);
  const saveGame = (itemId) => async (answers, _r, duration_sec) => {
    await api.saveGameResult(itemId, { student_id: l.student_id, lesson_id: l.id, answers, duration_sec });
  };
  const ids = l.items.map((i) => i.id);

  const saveItems = async (next) => {
    try {
      await api.setLessonItems(l.id, next);
      room.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <Link to={isTutor ? '/schedule' : '/schedule'} className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}>
        <Icon name="back" /> Расписание
      </Link>

      <div className="room-head">
        <div>
          <div className="muted small">{relativeDay(l.starts_at)}, {dayMonth(l.starts_at)}, {time(l.starts_at)}–{time(new Date(new Date(l.starts_at).getTime() + l.duration_min * 60000))}</div>
          <h1 className="page-title" style={{ marginTop: 4 }}>{isTutor ? l.student_name : l.topic || 'Урок'}</h1>
          {isTutor && l.topic && <div className="lead muted">{l.topic}</div>}
          {!isTutor && l.unit && <div className="lead muted">{unitLabel(l.unit)}</div>}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {l.join_link ? (
            <a className="btn" href={l.join_link} target="_blank" rel="noreferrer" style={{ height: 46 }}>
              <Icon name="video" /> Войти в {callService(l.join_link)}
            </a>
          ) : (
            <span className="small muted">{isTutor ? 'Ссылка на звонок не задана — добавьте её в карточке ученика' : 'Ссылку на звонок пришлёт преподаватель'}</span>
          )}
          {l.board_link && (
            <a className="btn btn-secondary" href={l.board_link} target="_blank" rel="noreferrer" style={{ height: 46 }}>
              <Icon name="board" /> Доска в новой вкладке
            </a>
          )}
        </div>
      </div>

      {!isTutor && <div style={{ marginTop: 20 }}><WarmupBanner lesson={l} studentId={l.student_id} onDone={room.reload} /></div>}

      {isTutor && (
        <section className="unit-strip">
          <div style={{ minWidth: 0 }}>
            <div className="meta-label">{l.unit ? l.unit.course_title : 'Курс'}</div>
            <div className="serif unit-strip-title">{l.unit ? unitLabel(l.unit) : 'Юнит не выбран'}</div>
            {l.unit?.goals && <div className="small muted" style={{ marginTop: 4 }}>{l.unit.goals}</div>}
            {!l.unit && <div className="small muted">Запишите ученика на курс в его карточке, и материалы юнита будут подставляться сами.</div>}
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {l.unit && l.unit.item_count > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                try {
                  const r = await api.unitToLesson(l.unit.id, l.id);
                  toast(r.added ? `Добавлено: ${r.added}` : 'Материалы юнита уже в уроке');
                  room.reload();
                } catch (err) { toast(err.message, 'error'); }
              }}><Icon name="layers" /> Материалы юнита</button>
            )}
            {!l.unit && <Link to={`/students/${l.student_id}/course`} className="btn btn-secondary btn-sm">Выбрать курс</Link>}
            {l.status === 'scheduled' && <button className="btn btn-sm" onClick={() => setFinishing(true)}><Icon name="check" /> Завершить урок</button>}
          </div>
        </section>
      )}

      {l.board_link && (
        <section className="panel" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <div className="row-between" style={{ padding: '12px 18px', borderBottom: boardOpen ? '1px solid var(--line)' : 0 }}>
            <h2 className="section-title">Доска</h2>
            <button className="btn btn-quiet btn-sm" onClick={() => setBoardOpen(!boardOpen)}>{boardOpen ? 'Свернуть' : 'Показать'}</button>
          </div>
          {boardOpen && (
            <>
              <iframe className="board-frame" src={boardEmbed(l.board_link)} title="Доска" allow="clipboard-read; clipboard-write; fullscreen; microphone; camera" />
              <div className="small muted" style={{ padding: '8px 18px' }}>
                Если доска не загрузилась, откройте её кнопкой «Доска в новой вкладке» — некоторые сервисы не разрешают показывать себя внутри других сайтов.
              </div>
            </>
          )}
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 className="section-title">Задачи урока</h2>
          {isTutor && <button className="btn btn-sm" onClick={() => setPicking(true)}><Icon name="library" /> Из библиотеки</button>}
        </div>
        {!l.items.length && (
          <div className="panel">
            <Empty title={isTutor ? 'Задач пока нет' : 'Здесь появятся задачи урока'}>
              {isTutor ? 'Добавьте задачи — ученик увидит их у себя через несколько секунд.' : 'Страница обновляется сама.'}
            </Empty>
          </div>
        )}
        <div className="stack" style={{ gap: 14 }}>
          {l.items.map((it, i) => (
            <LibraryItem key={it.id} item={it} index={i} showPrivate={isTutor}
              onGameFinish={isTutor ? undefined : saveGame(it.id)}
              gameExtra={<ResultLine results={resultsByItem[it.id]} who={isTutor ? `${l.student_name.split(' ')[0]}:` : 'Ваш'} />}
              actions={isTutor && (
                <button className="icon-btn" aria-label="Убрать из урока" onClick={() => saveItems(ids.filter((x) => x !== it.id))}>
                  <Icon name="close" size={18} />
                </button>
              )} />
          ))}
        </div>
        {isTutor && l.items.length > 0 && (
          <div className="row wrap" style={{ gap: 8, marginTop: 14 }}>
            <Link to={`/homework/new?student=${l.student_id}&items=${ids.join(',')}`} className="btn btn-secondary btn-sm">Отправить эти задачи в ДЗ</Link>
          </div>
        )}
      </section>

      {finishing && (
        <FinishLessonModal lesson={l} unit={l.unit} onClose={() => setFinishing(false)}
          onDone={() => { setFinishing(false); room.reload(); }} />
      )}

      {picking && (
        <TaskPicker selected={ids} onClose={() => setPicking(false)}
          onPick={(next) => { setPicking(false); saveItems(next); }} />
      )}
    </>
  );
}
