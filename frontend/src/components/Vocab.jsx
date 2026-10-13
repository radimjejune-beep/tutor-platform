// components/Vocab.jsx — личный словарь: карточки с интервальным повторением, список слов, добавление
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { Modal, Field, useSubmit, useToast, Icon, Empty, Spinner } from '../ui';
import { shortDate, todayISO, plural } from '../format';

// Озвучка британским голосом, если он есть в системе
let voice = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  voice = vs.find((v) => v.lang === 'en-GB') || vs.find((v) => v.lang?.startsWith('en')) || null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}
export function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, ''));
  u.lang = 'en-GB';
  if (voice) u.voice = voice;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

export const wordsWord = (n) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
const SOURCE = { tutor: 'от преподавателя', unit: 'из юнита', mistake: 'из ошибок' };

// Коробка 0–5 точками: сколько раз подряд вспомнил
export function BoxDots({ box }) {
  return (
    <span className="box-dots" aria-label={`Уровень ${box} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= box ? 'on' : ''} />)}
    </span>
  );
}

// ------------------------------------------------------------
// Сессия повторения: карточка → перевернуть → «знаю» / «ещё учу»
// «Ещё учу» возвращает карточку в конец сессии, пока не вспомнит
// ------------------------------------------------------------
export function FlashSession({ studentId, onDone }) {
  const [deck, setDeck] = useState(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState('en'); // en: слово → перевод, ru: перевод → слово
  const [stats, setStats] = useState({ known: 0, again: 0 });
  const toast = useToast();

  useEffect(() => {
    api.vocabDue(studentId, 40).then(setDeck).catch((e) => toast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const w = deck?.[i];
  useEffect(() => {
    if (w && dir === 'en') speak(w.term);
  }, [w, dir]);

  if (!deck) return <Spinner />;
  if (!deck.length) return <Empty title="На сегодня всё повторено">Новые слова появятся завтра или после следующего задания.</Empty>;

  if (i >= deck.length) {
    return (
      <div className="flash-done">
        <div className="serif flash-big">Готово</div>
        <p className="muted">
          {stats.again ? `С первого раза: ${stats.known}. Повторили ещё раз: ${stats.again}.` : 'Всё с первого раза.'}{' '}
          Следующее повторение словарь назначит сам.
        </p>
        <button className="btn" onClick={onDone}>Закрыть</button>
      </div>
    );
  }

  const answer = async (known) => {
    const first = !w.repeat;
    setFlipped(false);
    if (first) {
      api.reviewWord(w.id, known).catch((e) => toast(e.message, 'error'));
      setStats((s) => ({ ...s, [known ? 'known' : 'again']: s[known ? 'known' : 'again'] + 1 }));
    }
    if (!known) setDeck((d) => [...d, { ...w, repeat: true }]);
    setI(i + 1);
  };

  // Слово без перевода (из ошибки): в режиме RU → EN показываем предложение с пропуском
  const gapped = w.example && w.example.toLowerCase().includes(w.term.toLowerCase())
    ? w.example.replace(new RegExp(w.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '___')
    : null;
  const front = dir === 'en' ? w.term : w.translation || gapped || w.term;
  const back = dir === 'en' ? w.translation || w.term : w.term;

  return (
    <div className="flash">
      <div className="row-between">
        <span className="meta-label">{Math.min(i + 1, deck.length)} / {deck.length}</span>
        <div className="seg seg-quiet">
          <button className={dir === 'en' ? 'on' : ''} onClick={() => { setDir('en'); setFlipped(false); }}>EN → RU</button>
          <button className={dir === 'ru' ? 'on' : ''} onClick={() => { setDir('ru'); setFlipped(false); }}>RU → EN</button>
        </div>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>

      <button className={`flash-card ${flipped ? 'flipped' : ''}`} onClick={() => { setFlipped(!flipped); if (!flipped && dir === 'ru') speak(w.term); }}>
        <span className="flash-inner">
          <span className="flash-face">
            <span className="serif flash-big" style={front.length > 36 ? { fontSize: 26 } : undefined}>{front}</span>
            <span className="small muted">{w.source === 'mistake' ? 'было с ошибкой · ' : ''}нажмите, чтобы перевернуть</span>
          </span>
          <span className="flash-face flash-back">
            <span className="serif flash-big">{back}</span>
            {w.example && <span className="flash-example">{w.example}</span>}
          </span>
        </span>
      </button>

      <div className="flash-actions">
        <button className="btn btn-quiet btn-sm" onClick={() => speak(`${w.term}. ${w.example || ''}`)}><Icon name="sound" /> Послушать</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => answer(false)}>Ещё учу</button>
          <button className="btn" onClick={() => answer(true)}>Знаю</button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Список слов
// ------------------------------------------------------------
export function VocabList({ items, tutor, onChanged }) {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const today = todayISO();
  const shown = useMemo(
    () =>
      items.filter((w) =>
        filter === 'due' ? w.due_on <= today : filter === 'mistake' ? w.source === 'mistake' : filter === 'learned' ? w.box >= 4 : true
      ),
    [items, filter, today]
  );
  const act = (fn) => async () => {
    try {
      await fn();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!items.length) return null;
  return (
    <>
      <div className="seg seg-quiet" style={{ marginBottom: 8 }}>
        {[['all', 'Все'], ['due', 'На сегодня'], ['mistake', 'Из ошибок'], ['learned', 'Выучены']].map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <table className="vocab-table">
        <tbody>
          {shown.map((w) => (
            <tr key={w.id}>
              <td>
                <button className="icon-btn" aria-label="Послушать" onClick={() => speak(w.term)}><Icon name="sound" size={16} /></button>
              </td>
              <td className="vocab-term">
                <span className="serif">{w.term}</span>
                {w.translation && <span className="vocab-tr-sm">{w.translation}</span>}
                {w.example && <span className="small muted vocab-example">{w.example}</span>}
              </td>
              <td className="vocab-tr">{w.translation || <span className="muted">—</span>}</td>
              <td className="vocab-meta">
                <BoxDots box={w.box} />
                <span className="small muted">{w.due_on <= today ? 'сегодня' : shortDate(w.due_on)}</span>
              </td>
              {tutor && (
                <td className="vocab-actions">
                  <span className="small muted hide-sm">{SOURCE[w.source]}{w.lapses ? `, забыл ${w.lapses}` : ''}</span>
                  {w.box > 0 && <button className="icon-btn" title="Повторить заново" aria-label="Повторить заново" onClick={act(() => api.updateWord(w.id, { reset: true }))}><Icon name="back" size={16} /></button>}
                  <button className="icon-btn" title="Удалить" aria-label="Удалить" onClick={act(() => api.deleteWord(w.id))}><Icon name="trash" size={16} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!shown.length && <p className="muted small">В этом списке пусто.</p>}
    </>
  );
}

// Статистика словаря строкой
export function VocabStats({ stats }) {
  return (
    <div className="vocab-stats">
      <div><b className="serif">{stats.due}</b><span>на сегодня</span></div>
      <div><b className="serif">{stats.total}</b><span>всего</span></div>
      <div><b className="serif">{stats.learned}</b><span>выучено</span></div>
      <div><b className="serif">{stats.from_mistakes}</b><span>из ошибок</span></div>
    </div>
  );
}

// ------------------------------------------------------------
// Добавить слова списком: «слово — перевод — пример», по одному на строку
// ------------------------------------------------------------
export function parseWordLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, translation, ...rest] = line.split(/\s+[—–-]\s+|\t|;/).map((x) => x.trim());
      return { term, translation: translation || null, example: rest.join(' ').trim() || null };
    })
    .filter((w) => w.term);
}

export function AddWordsModal({ studentId, onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const words = parseWordLines(text);
  const save = useSubmit(async () => {
    if (!words.length) throw new Error('Добавьте хотя бы одно слово');
    const r = await api.addWords(studentId, words);
    toast(r.added === r.total ? `Добавлено: ${r.added}` : `Добавлено: ${r.added}, остальные уже были в словаре`);
    onSaved();
  });
  return (
    <Modal title="Добавить слова" onClose={onClose} wide>
      <form className="form" onSubmit={save.submit}>
        <Field label="По одному на строку" hint="Слово — перевод — пример. Перевод и пример можно не писать">
          <textarea className="textarea" style={{ minHeight: 200, fontFamily: 'inherit' }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'keen on — увлекаться — She is very keen on music.\nproud of — гордиться\nget on well with — ладить с'} autoFocus />
        </Field>
        {words.length > 0 && <div className="small muted">Будет добавлено: {wordsWord(words.length)}</div>}
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Добавить'}</button>
        </div>
      </form>
    </Modal>
  );
}
