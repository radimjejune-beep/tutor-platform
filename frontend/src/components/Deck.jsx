// components/Deck.jsx: конструктор интерактивных уроков. Урок = набор слайдов (титул, текст, картинка,
// слова с озвучкой, вопросы с таймером, правило, упражнение, видео, итоги). DeckEditor собирает урок,
// DeckPlayer показывает его на уроке (полный экран, стрелки, заметки преподавателя, таймер) и ученику дома.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, Field } from '../ui';
import { api } from '../api';
import { FileImage } from '../games/Sheet';
import GamePlayer from '../games/Players';
import GameEditor, { EMPTY_GAME } from '../games/Editors';
import { GAME_TYPES } from '../games/logic';
import { speak, canSpeak } from '../voice';

export const SLIDE_TYPES = {
  title: { label: 'Титул', icon: 'flag', hint: 'Название урока и тема' },
  text: { label: 'Текст', icon: 'note', hint: 'Объяснение, инструкция, текст для чтения' },
  image: { label: 'Картинка', icon: 'board', hint: 'Фото для обсуждения или описания' },
  words: { label: 'Слова', icon: 'cards', hint: 'Карточки: слово, перевод, пример и британская озвучка' },
  questions: { label: 'Вопросы', icon: 'users', hint: 'Вопросы для разговора с таймером' },
  rule: { label: 'Правило', icon: 'layers', hint: 'Схема и примеры с выделением' },
  exercise: { label: 'Упражнение', icon: 'grid', hint: 'Найди пару, вставь пропуск, порядок слов, группы' },
  video: { label: 'Видео', icon: 'video', hint: 'Ролик с YouTube или ссылка' },
  finish: { label: 'Итоги', icon: 'check', hint: 'Что научились делать и домашка' },
};
const THEMES = [['paper', 'Тетрадь'], ['ink', 'Чернила'], ['sky', 'Небо'], ['mint', 'Мята']];

const uid = () => Math.random().toString(36).slice(2, 10);
export const newSlide = (type) => ({
  id: uid(), type, minutes: { title: 2, text: 5, image: 5, words: 8, questions: 10, rule: 7, exercise: 8, video: 6, finish: 3 }[type] || 5,
  ...(type === 'words' ? { words: [{ term: '', translation: '', example: '' }] } : {}),
  ...(type === 'questions' || type === 'finish' ? { items: [''] } : {}),
  ...(type === 'rule' ? { examples: [''] } : {}),
  ...(type === 'questions' ? { timer: 120 } : {}),
});

// Шаблоны: каркас урока по методике, тексты-подсказки заменяются своими
export const DECK_TEMPLATES = {
  ppp: { label: 'Грамматика: показ, практика, речь', slides: [
    { type: 'title', title: 'Тема урока', subtitle: 'Сегодня научимся…', notes: 'Цель урока одной фразой: что ученик сможет сделать в конце.' },
    { type: 'questions', title: 'Warm-up', items: ['What did you do last weekend?', 'What are you planning to do this week?'], notes: 'Разогрев 5 минут. Записывайте ошибки, разберёте в конце.' },
    { type: 'image', title: 'Look at the picture', caption: 'What is happening?', notes: 'Ситуация, где новая грамматика нужна естественно. Сначала смысл, потом форма.' },
    { type: 'rule', title: 'Rule', text: 'Подлежащее + глагол + …', examples: ['Пример с **выделением**', 'Ещё один пример'], notes: 'Пусть ученик сам выведет правило из примеров. Вопросы на понимание вместо «понятно?».' },
    { type: 'exercise', title: 'Practice', game: EMPTY_GAME.gaps, notes: 'Контролируемая практика: ошибиться трудно.' },
    { type: 'questions', title: 'Speak', items: ['Вопрос, где нужна новая конструкция', 'Ещё вопрос'], timer: 180, notes: 'Свободная речь. Не исправляйте во время ответа.' },
    { type: 'finish', title: 'Today I can…', items: ['…', '…'], text: 'Домашка: …', notes: 'Ученик сам формулирует, что научился делать.' },
  ] },
  reading: { label: 'Урок по тексту', slides: [
    { type: 'title', title: 'Название текста', subtitle: 'Reading', notes: '' },
    { type: 'image', title: 'What is the text about?', caption: 'Look at the title and the picture', notes: 'Прогноз до чтения.' },
    { type: 'words', title: 'Key words', words: [{ term: '', translation: '', example: '' }], notes: '3–5 ключевых слов, без которых текст не понять.' },
    { type: 'text', title: 'Read the text', text: 'Вставьте свой текст или задание к тексту в учебнике.', notes: 'Первое чтение на общий смысл, с ограничением времени.' },
    { type: 'exercise', title: 'True or false?', game: EMPTY_GAME.match, notes: 'Второе чтение на детали.' },
    { type: 'questions', title: 'What do you think?', items: ['Do you agree with the author?', 'What would you do?'], notes: 'После чтения: мнение и перенос на себя.' },
    { type: 'finish', title: 'Words to remember', items: [''], text: 'Домашка: …', notes: 'Слова из текста добавьте ученику в карточки.' },
  ] },
  empty: { label: 'Пустой урок', slides: [{ type: 'title', title: 'Тема урока', subtitle: '' }] },
};
export const deckFromTemplate = (key) => ({ v: 1, theme: 'paper', slides: DECK_TEMPLATES[key].slides.map((s) => ({ ...newSlide(s.type), ...JSON.parse(JSON.stringify(s)), id: uid() })) });
export const parseDeck = (html) => { try { const d = JSON.parse(html); return d && Array.isArray(d.slides) ? d : null; } catch { return null; } };

// **жирный** в тексте слайда, без HTML
function Rich({ text }) {
  return String(text || '').split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));
}
function Paragraphs({ text }) {
  const blocks = String(text || '').split(/\n{2,}/);
  return blocks.map((b, i) => {
    const lines = b.split('\n');
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return <ul key={i}>{lines.map((l) => <li key={l}><Rich text={l.replace(/^\s*[-•]\s+/, '')} /></li>)}</ul>;
    return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Rich text={l} /></Fragment>)}</p>;
  });
}
const youtubeId = (u) => (String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];

function Timer({ seconds }) {
  const [left, setLeft] = useState(seconds);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => setLeft((s) => (s <= 1 ? (setOn(false), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [on]);
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <div className={`dk-timer${left === 0 ? ' done' : ''}`}>
      <span className="num">{mm}</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => (left === 0 ? (setLeft(seconds), setOn(true)) : setOn(!on))}>{on ? 'Пауза' : left === 0 ? 'Заново' : 'Старт'}</button>
    </div>
  );
}

function WordCard({ w }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`dk-word${open ? ' open' : ''}`}>
      <button type="button" className="dk-word-face" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="dk-word-term">{w.term}</span>
        {open && w.translation && <span className="dk-word-tr">{w.translation}</span>}
        {open && w.example && <span className="dk-word-ex"><Rich text={w.example} /></span>}
        {!open && <span className="dk-word-hint">нажмите, чтобы открыть</span>}
      </button>
      {canSpeak() && w.term && <button type="button" className="icon-btn dk-word-say" aria-label={`Послушать ${w.term}`} onClick={() => speak(w.term, open ? w.example : undefined)}><Icon name="sound" size={18} /></button>}
    </div>
  );
}

// Один слайд. live=false: превью в редакторе (без интерактива)
export function Slide({ s, live = true }) {
  const t = s.type;
  return (
    <div className={`dk-slide dk-t-${t}`}>
      {t === 'title' ? (
        <div className="dk-cover">
          <h1 className="dk-cover-title">{s.title || 'Тема урока'}</h1>
          {s.subtitle && <p className="dk-cover-sub">{s.subtitle}</p>}
        </div>
      ) : (
        <>
          {s.title && <h2 className="dk-h">{s.title}</h2>}
          {t === 'text' && <div className="dk-text"><Paragraphs text={s.text} /></div>}
          {t === 'image' && (
            <figure className="dk-figure">
              {s.image ? <FileImage id={s.image} alt={s.caption || ''} /> : s.url ? <img src={s.url} alt={s.caption || ''} /> : <div className="dk-img-empty">Картинка</div>}
              {s.caption && <figcaption>{s.caption}</figcaption>}
            </figure>
          )}
          {t === 'words' && <div className="dk-words">{(s.words || []).filter((w) => w.term).map((w, i) => (live ? <WordCard key={i} w={w} /> : <div key={i} className="dk-word"><div className="dk-word-face"><span className="dk-word-term">{w.term}</span></div></div>))}</div>}
          {t === 'questions' && (
            <>
              <ol className="dk-list">{(s.items || []).filter(Boolean).map((q) => <li key={q}><Rich text={q} /></li>)}</ol>
              {live && s.timer > 0 && <Timer seconds={s.timer} />}
            </>
          )}
          {t === 'rule' && (
            <>
              {s.text && <div className="dk-formula"><Rich text={s.text} /></div>}
              <ul className="dk-examples">{(s.examples || []).filter(Boolean).map((e) => <li key={e}><Rich text={e} /></li>)}</ul>
            </>
          )}
          {t === 'exercise' && (s.game ? (live ? <div className="dk-game"><GamePlayer game={s.game} /></div> : <div className="dk-img-empty">{GAME_TYPES[s.game.type]?.label || 'Упражнение'}</div>) : <div className="dk-img-empty">Упражнение не выбрано</div>)}
          {t === 'video' && (youtubeId(s.url) ? (
            live ? <div className="dk-video"><iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(s.url)}`} title={s.title || 'Видео'} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
              : <div className="dk-img-empty">Видео YouTube</div>
          ) : s.url ? <a className="btn" href={s.url} target="_blank" rel="noreferrer"><Icon name="video" /> Открыть видео</a> : <div className="dk-img-empty">Вставьте ссылку на видео</div>)}
          {t === 'finish' && (
            <>
              <ul className="dk-check">{(s.items || []).filter(Boolean).map((x) => <li key={x}><Icon name="check" size={20} /><span><Rich text={x} /></span></li>)}</ul>
              {s.text && <div className="dk-homework"><Rich text={s.text} /></div>}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   Показ урока
   ============================================================ */
export function DeckPlayer({ deck, isTutor }) {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(Boolean(isTutor));
  const box = useRef(null);
  const slides = deck?.slides || [];
  const s = slides[i];
  const go = (d) => setI((x) => Math.max(0, Math.min(slides.length - 1, x + d)));
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [slides.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // Слайд сменился, а фокус был на кнопке старого слайда: возвращаем его плееру, чтобы стрелки работали дальше
  useEffect(() => { if (box.current && document.activeElement === document.body) box.current.focus({ preventScroll: true }); }, [i]);
  if (!s) return null;
  const full = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.());
  const total = slides.reduce((a, x) => a + (Number(x.minutes) || 0), 0);
  const passed = slides.slice(0, i).reduce((a, x) => a + (Number(x.minutes) || 0), 0);
  return (
    <div className={`dk-player dk-theme-${deck.theme || 'paper'}`} ref={box} tabIndex={0} aria-label="Интерактивный урок: стрелки влево и вправо листают слайды">
      <div className="dk-stage">
        <Slide key={s.id} s={s} />
      </div>
      <div className="dk-bar">
        <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={i === 0} aria-label="Предыдущий слайд"><Icon name="back" size={20} /></button>
        <div className="dk-dots" role="tablist" aria-label="Слайды">
          {slides.map((x, k) => <button key={x.id} type="button" role="tab" aria-selected={k === i} aria-label={`Слайд ${k + 1}: ${x.title || SLIDE_TYPES[x.type]?.label}`} className={k === i ? 'on' : k < i ? 'past' : ''} onClick={() => setI(k)} />)}
        </div>
        <span className="small muted num">{i + 1} / {slides.length}{total ? ` · ${passed}–${passed + (Number(s.minutes) || 0)} из ${total} мин` : ''}</span>
        {isTutor && <button type="button" className={`btn btn-sm ${notes ? '' : 'btn-secondary'}`} onClick={() => setNotes(!notes)}>Заметки</button>}
        <button type="button" className="icon-btn" onClick={full} aria-label="Во весь экран" title="Во весь экран"><Icon name="arrowUp" size={18} /></button>
        <button type="button" className="icon-btn dk-next" onClick={() => go(1)} disabled={i === slides.length - 1} aria-label="Следующий слайд"><Icon name="back" size={20} /></button>
      </div>
      {isTutor && notes && s.notes && <div className="dk-notes"><b>Заметка для вас:</b> {s.notes}</div>}
    </div>
  );
}

/* ============================================================
   Конструктор
   ============================================================ */
function ListEditor({ items, onChange, placeholder, label }) {
  const set = (k, v) => onChange(items.map((x, j) => (j === k ? v : x)));
  return (
    <Field label={label}>
      <div className="stack" style={{ gap: 6 }}>
        {items.map((x, k) => (
          <div key={k} className="row" style={{ gap: 6 }}>
            <input className="input" value={x} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
            <button type="button" className="icon-btn" aria-label="Убрать строку" onClick={() => onChange(items.filter((_, j) => j !== k))}><Icon name="close" size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', justifySelf: 'start' }} onClick={() => onChange([...items, ''])}><Icon name="plus" size={16} /> Строка</button>
      </div>
    </Field>
  );
}

function SlideForm({ s, set, itemId }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const f = await api.uploadFile({ library_item_id: itemId }, file); set({ image: f.id, url: '' }); } catch (e) { window.alert(e.message); } finally { setUploading(false); }
  };
  const t = s.type;
  return (
    <div className="form">
      <Field label={t === 'title' ? 'Название урока' : 'Заголовок слайда'}>
        <input className="input" value={s.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder={t === 'title' ? 'Например: Present Continuous' : 'Например: Warm-up'} />
      </Field>
      {t === 'title' && <Field label="Подзаголовок"><input className="input" value={s.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Что научимся делать" /></Field>}
      {(t === 'text' || t === 'rule' || t === 'finish') && (
        <Field label={t === 'rule' ? 'Схема правила' : t === 'finish' ? 'Домашнее задание' : 'Текст'} hint="**слово** выделяет жирным. Строки с «- » становятся списком. Пустая строка начинает новый абзац">
          <textarea className="textarea" rows={t === 'text' ? 8 : 3} value={s.text || ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )}
      {t === 'image' && (
        <>
          <Field label="Картинка" hint={itemId ? 'Загрузите фото или вставьте ссылку на картинку' : 'Сохраните урок, чтобы загружать свои фото. Ссылку на картинку можно вставить сразу'}>
            <div className="row wrap" style={{ gap: 8 }}>
              {itemId && <label className="btn btn-secondary btn-sm"><Icon name="clip" size={16} /> {uploading ? 'Загружаем…' : 'Загрузить фото'}<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0])} /></label>}
              <input className="input" style={{ flex: 1, minWidth: 220 }} value={s.url || ''} placeholder="https://…" onChange={(e) => set({ url: e.target.value, image: null })} />
            </div>
          </Field>
          <Field label="Подпись или задание"><input className="input" value={s.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Describe the picture" /></Field>
        </>
      )}
      {t === 'words' && (
        <Field label="Слова" hint="Ученик открывает карточку нажатием и слушает британскую озвучку">
          <div className="stack" style={{ gap: 6 }}>
            {(s.words || []).map((w, k) => (
              <div key={k} className="dk-word-row">
                <input className="input" value={w.term} placeholder="word" onChange={(e) => set({ words: s.words.map((x, j) => (j === k ? { ...x, term: e.target.value } : x)) })} />
                <input className="input" value={w.translation || ''} placeholder="перевод" onChange={(e) => set({ words: s.words.map((x, j) => (j === k ? { ...x, translation: e.target.value } : x)) })} />
                <input className="input" value={w.example || ''} placeholder="пример" onChange={(e) => set({ words: s.words.map((x, j) => (j === k ? { ...x, example: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" aria-label="Убрать слово" onClick={() => set({ words: s.words.filter((_, j) => j !== k) })}><Icon name="close" size={16} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', justifySelf: 'start' }} onClick={() => set({ words: [...(s.words || []), { term: '', translation: '', example: '' }] })}><Icon name="plus" size={16} /> Слово</button>
          </div>
        </Field>
      )}
      {(t === 'questions' || t === 'finish') && <ListEditor label={t === 'finish' ? 'Что научились делать' : 'Вопросы'} items={s.items || []} onChange={(items) => set({ items })} placeholder={t === 'finish' ? 'I can…' : 'Question'} />}
      {t === 'questions' && (
        <Field label="Таймер на разговор">
          <select className="select" value={s.timer || 0} onChange={(e) => set({ timer: Number(e.target.value) })}>
            {[0, 60, 120, 180, 300, 600].map((x) => <option key={x} value={x}>{x ? `${x / 60} мин` : 'Без таймера'}</option>)}
          </select>
        </Field>
      )}
      {t === 'rule' && <ListEditor label="Примеры" items={s.examples || []} onChange={(examples) => set({ examples })} placeholder="She **is reading** now." />}
      {t === 'exercise' && (
        <Field label="Упражнение">
          <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
            {['match', 'gaps', 'order', 'groups', 'board'].map((k) => (
              <button key={k} type="button" className={`btn btn-sm ${s.game?.type === k ? '' : 'btn-secondary'}`} onClick={() => (s.game?.type === k ? null : set({ game: JSON.parse(JSON.stringify(EMPTY_GAME[k])) }))}>{GAME_TYPES[k].label}</button>
            ))}
          </div>
          {s.game && <GameEditor game={s.game} onChange={(game) => set({ game })} itemId={itemId} />}
        </Field>
      )}
      {t === 'video' && <Field label="Ссылка на видео" hint="Ролик с YouTube покажется прямо на слайде, другие ссылки откроются кнопкой"><input className="input" value={s.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://youtu.be/…" /></Field>}
      <div className="dk-meta-row">
        <Field label="Минут на слайд"><input className="input" type="number" min="0" max="120" value={s.minutes ?? ''} onChange={(e) => set({ minutes: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
      </div>
      <Field label="Заметка для вас" hint="Видите только вы во время показа. Ученик её не получает">
        <textarea className="textarea" rows={2} value={s.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Что спросить, на что обратить внимание, ответы" />
      </Field>
    </div>
  );
}

export function DeckEditor({ deck, onChange, itemId }) {
  const [cur, setCur] = useState(0);
  const [adding, setAdding] = useState(false);
  const slides = deck.slides;
  const s = slides[Math.min(cur, slides.length - 1)];
  const update = (patch) => onChange({ ...deck, slides: slides.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) });
  const move = (d) => {
    const k = slides.indexOf(s); const j = k + d;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides]; [next[k], next[j]] = [next[j], next[k]];
    onChange({ ...deck, slides: next }); setCur(j);
  };
  const add = (type) => {
    const k = slides.indexOf(s) + 1;
    const next = [...slides.slice(0, k), newSlide(type), ...slides.slice(k)];
    onChange({ ...deck, slides: next }); setCur(k); setAdding(false);
  };
  const dup = () => { const k = slides.indexOf(s) + 1; onChange({ ...deck, slides: [...slides.slice(0, k), { ...JSON.parse(JSON.stringify(s)), id: uid() }, ...slides.slice(k)] }); setCur(k); };
  const del = () => { if (slides.length < 2) return; if (!window.confirm('Удалить слайд?')) return; onChange({ ...deck, slides: slides.filter((x) => x.id !== s.id) }); setCur(Math.max(0, cur - 1)); };
  const total = useMemo(() => slides.reduce((a, x) => a + (Number(x.minutes) || 0), 0), [slides]);

  return (
    <div className="dk-editor">
      <aside className="dk-rail">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="section-title">Слайды · {total} мин</span>
          <select className="select dk-theme-pick" value={deck.theme || 'paper'} onChange={(e) => onChange({ ...deck, theme: e.target.value })} aria-label="Оформление">
            {THEMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <ol className="dk-thumbs">
          {slides.map((x, k) => (
            <li key={x.id}>
              <button type="button" className={`dk-thumb${x.id === s.id ? ' on' : ''}`} onClick={() => setCur(k)}>
                <span className="dk-thumb-n num">{k + 1}</span>
                <span className="dk-thumb-body"><b>{x.title || SLIDE_TYPES[x.type].label}</b><span className="small muted">{SLIDE_TYPES[x.type].label}{x.minutes ? ` · ${x.minutes} мин` : ''}</span></span>
              </button>
            </li>
          ))}
        </ol>
        {adding ? (
          <div className="dk-add">
            {Object.entries(SLIDE_TYPES).map(([k, v]) => (
              <button key={k} type="button" className="dk-add-type" onClick={() => add(k)}><Icon name={v.icon} size={18} /><span><b>{v.label}</b><span className="small muted">{v.hint}</span></span></button>
            ))}
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAdding(false)}>Отмена</button>
          </div>
        ) : <button type="button" className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Добавить слайд</button>}
      </aside>
      <section className="dk-work">
        <div className="row-between wrap" style={{ marginBottom: 12, gap: 8 }}>
          <span className="section-title">{SLIDE_TYPES[s.type].label}: слайд {slides.indexOf(s) + 1}</span>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className="icon-btn" aria-label="Выше" onClick={() => move(-1)}><Icon name="arrowUp" size={18} /></button>
            <button type="button" className="icon-btn" aria-label="Ниже" onClick={() => move(1)}><Icon name="arrowDown" size={18} /></button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={dup}>Копия</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={del} disabled={slides.length < 2}>Удалить</button>
          </div>
        </div>
        <div className={`dk-preview dk-theme-${deck.theme || 'paper'}`} aria-label="Как выглядит слайд"><div className="dk-stage"><Slide s={s} live={false} /></div></div>
        <SlideForm key={s.id} s={s} set={update} itemId={itemId} />
      </section>
    </div>
  );
}

// Выбор шаблона для нового урока
export function DeckTemplatePicker({ onPick }) {
  return (
    <div className="type-grid">
      {Object.entries(DECK_TEMPLATES).map(([k, t]) => (
        <button key={k} type="button" className="type-card" onClick={() => onPick(k)}>
          <span className="list-title">{t.label}</span>
          <span className="list-sub">{t.slides.length} {t.slides.length === 1 ? 'слайд' : t.slides.length < 5 ? 'слайда' : 'слайдов'}: {t.slides.map((x) => SLIDE_TYPES[x.type].label.toLowerCase()).join(', ')}</span>
        </button>
      ))}
    </div>
  );
}
