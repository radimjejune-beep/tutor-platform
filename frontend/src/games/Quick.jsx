// games/Quick.jsx: быстрые шаблоны. Преподаватель вводит список «вопрос и ответ» один раз,
// а игру выбирает из галереи и может сменить в любой момент: викторина, пары, мемори, анаграмма,
// верно или нет, напиши ответ, карточки. Ответ на i-ю строку хранится в answers.r[i].
import { useEffect, useMemo, useState } from 'react';
import { Field, Icon } from '../ui';
import { normalize, shuffle } from './logic';
import { speak, canSpeak } from '../voice';

export const QUICK_TEMPLATES = {
  quiz: { label: 'Викторина', hint: 'Вопрос и 4 варианта ответа', ill: <><i>cat</i><b>→</b><s>собака</s><i>кот</i></> },
  match: { label: 'Соедини пары', hint: 'Слово и перевод, термин и определение', ill: <><i>cat</i><b>-</b><i>кот</i></> },
  memory: { label: 'Мемори', hint: 'Открывай по две карточки и находи пары', ill: <><i>?</i><i>?</i><i>кот</i></> },
  anagram: { label: 'Анаграмма', hint: 'Собери слово из перемешанных букв', ill: <><i>t</i><i>a</i><i>c</i></> },
  tf: { label: 'Верно или нет', hint: 'Пара показана правильно или с подвохом?', ill: <><i>cat = кот</i><b>✓ ✗</b></> },
  type: { label: 'Напиши ответ', hint: 'Видишь вопрос, впечатываешь ответ', ill: <><i>cat</i><u /></> },
  flip: { label: 'Карточки', hint: 'Переверни, вспомни, отметь «знаю» или «не знаю»', ill: <><i>cat</i><b>⟲</b><i>кот</i></> },
};
const TIMERS = [[0, 'Без таймера'], [60, '1 минута'], [120, '2 минуты'], [180, '3 минуты'], [300, '5 минут'], [600, '10 минут']];

export const emptyQuick = (template) => ({ type: 'quick', template, timer: 0, items: [{ q: '', a: '' }, { q: '', a: '' }, { q: '', a: '' }, { q: '', a: '' }] });

const hasLatin = (s) => /[a-z]/i.test(s || '');
const first = (a) => String(a || '').split('|')[0].trim();

/* ============================================================
   Прохождение
   ============================================================ */
function Countdown({ seconds, onEnd }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!seconds) return undefined;
    const t = setInterval(() => setLeft((s) => { if (s <= 1) { clearInterval(t); onEnd(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!seconds) return null;
  return <span className={`qk-timer num${left <= 10 ? ' low' : ''}`} aria-live="off">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>;
}

function Say({ text }) {
  if (!canSpeak() || !hasLatin(text)) return null;
  return <button type="button" className="icon-btn qk-say" aria-label={`Послушать ${text}`} onClick={(e) => { e.stopPropagation(); speak(text); }}><Icon name="sound" size={18} /></button>;
}

// Пошаговые игры: одна строка на экране, сразу видно, верно или нет
function Stepper({ game, answers, setAnswers, result, render, isDone }) {
  const order = useMemo(() => shuffle(game.items.map((_, i) => i)), [game]);
  const r = answers.r || {};
  const [pos, setPos] = useState(() => { const k = order.findIndex((i) => !isDone(r[i])); return k < 0 ? order.length : k; });
  const [timeUp, setTimeUp] = useState(false);
  const locked = Boolean(result) || timeUp;
  const answer = (i, v) => setAnswers((prev) => ({ ...prev, r: { ...(prev.r || {}), [i]: v } }));
  const next = () => setPos((p) => p + 1);
  const done = order.filter((i) => isDone(r[i])).length;
  const right = order.filter((i) => checkOne(game, i, r[i])).length;
  return (
    <div className="qk">
      <div className="qk-top">
        <div className="qk-dots" aria-hidden="true">{order.map((i, k) => <span key={i} className={isDone(r[i]) ? (checkOne(game, i, r[i]) ? 'ok' : 'bad') : k === pos ? 'on' : ''} />)}</div>
        {!result && <Countdown seconds={game.timer} onEnd={() => setTimeUp(true)} />}
      </div>
      {pos < order.length && !locked ? (
        <div className="qk-card" key={order[pos]}>{render(order[pos], r[order[pos]], (v) => answer(order[pos], v), next)}</div>
      ) : (
        <div className="qk-card qk-end">
          <div className="qk-big num">{right} из {order.length}</div>
          <div className="muted">{timeUp && done < order.length ? 'Время вышло.' : 'Все вопросы пройдены.'} {result ? '' : 'Нажмите «Проверить», чтобы сохранить результат.'}</div>
        </div>
      )}
      {result && <ReviewList game={game} r={r} />}
    </div>
  );
}

function checkOne(game, i, g) {
  const x = game.items[i];
  if (g === undefined || g === null || g === '') return false;
  if (game.template === 'tf') return typeof g.v === 'boolean' && (Number(g.j) === i) === g.v;
  if (game.template === 'flip') return g === true;
  return String(game.template === 'anagram' ? x.q : x.a).split('|').map((s) => s.trim()).filter(Boolean).some((v) => normalize(v) === normalize(String(g)));
}

function ReviewList({ game, r }) {
  return (
    <ol className="qk-review">
      {game.items.map((x, i) => {
        const ok = checkOne(game, i, r[i]);
        return <li key={i} className={ok ? 'ok' : 'bad'}><span>{game.template === 'anagram' ? first(x.a) : x.q}</span><b>{game.template === 'anagram' ? first(x.q) : first(x.a)}</b>{!ok && r[i] !== undefined && game.template !== 'tf' && game.template !== 'flip' && <s>{String(r[i])}</s>}</li>;
      })}
    </ol>
  );
}

function QuizCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const opts = useMemo(() => {
    const own = (x.wrong || []).filter(Boolean);
    const pool = shuffle(game.items.filter((_, j) => j !== i).map((y) => first(y.a)).filter((a) => normalize(a) !== normalize(first(x.a))));
    const wrong = [...new Set([...own, ...pool])].slice(0, 3);
    return shuffle([first(x.a), ...wrong]);
  }, [game, i]); // eslint-disable-line react-hooks/exhaustive-deps
  const answered = given !== undefined;
  const pick = (o) => { if (answered) return; set(o); setTimeout(next, normalize(o) === normalize(first(x.a)) ? 700 : 1500); };
  return (
    <>
      <div className="qk-q">{x.q}<Say text={x.q} /></div>
      <div className="qk-opts">
        {opts.map((o, k) => {
          const isRight = normalize(o) === normalize(first(x.a));
          const st = answered ? (isRight ? ' ok' : o === given ? ' bad' : ' dim') : '';
          return <button key={o} type="button" className={`qk-opt${st}`} onClick={() => pick(o)} disabled={answered}><span className="qk-letter">{'ABCD'[k]}</span>{o}</button>;
        })}
      </div>
    </>
  );
}

function TypeCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const [v, setV] = useState('');
  const answered = given !== undefined;
  const submit = (e) => { e.preventDefault(); if (answered || !v.trim()) return; set(v.trim()); if (checkOne(game, i, v.trim())) setTimeout(next, 700); };
  return (
    <form onSubmit={submit}>
      <div className="qk-q">{x.q}<Say text={x.q} /></div>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <input className={`input qk-input${answered ? (checkOne(game, i, given) ? ' ok' : ' bad') : ''}`} value={answered ? given : v} onChange={(e) => setV(e.target.value)} disabled={answered} autoFocus autoComplete="off" spellCheck={false} aria-label="Ответ" />
        {!answered && <button className="btn" type="submit">Ответить</button>}
      </div>
      {answered && !checkOne(game, i, given) && <div className="qk-correct">Правильно: <b>{first(x.a)}</b></div>}
      {answered && !checkOne(game, i, given) && <div style={{ textAlign: 'center', marginTop: 10 }}><button type="button" className="btn btn-secondary btn-sm" onClick={next}>Дальше</button></div>}
    </form>
  );
}

function AnagramCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const word = first(x.q); // собирают слово, перевод служит подсказкой
  const letters = useMemo(() => {
    const chars = [...word].map((c, k) => ({ c, k })).filter((o) => o.c !== ' ');
    let s = shuffle(chars);
    for (let t = 0; t < 8 && chars.length > 1 && s.map((o) => o.c).join('') === chars.map((o) => o.c).join(''); t++) s = shuffle(chars);
    return s;
  }, [word]);
  const [picked, setPicked] = useState([]);
  const answered = given !== undefined;
  const built = picked.map((k) => letters.find((o) => o.k === k).c).join('');
  const target = word.replace(/ /g, '');
  useEffect(() => {
    if (answered || built.length !== target.length) return;
    // пробелы из фразы возвращаем на место
    let out = ''; let n = 0;
    for (const ch of word) out += ch === ' ' ? ' ' : built[n++];
    set(out); setTimeout(next, normalize(out) === normalize(word) ? 700 : 1600);
  }, [built]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="qk-q">{first(x.a)}</div>
      <div className={`qk-slots${answered ? (checkOne(game, i, given) ? ' ok' : ' bad') : ''}`}>
        {[...target].map((_, k) => <span key={k} className="qk-slot">{built[k] || ''}</span>)}
      </div>
      <div className="qk-letters">
        {letters.map((o) => <button key={o.k} type="button" className="qk-tile" disabled={answered || picked.includes(o.k)} onClick={() => setPicked([...picked, o.k])}>{o.c}</button>)}
      </div>
      {!answered && picked.length > 0 && <div style={{ textAlign: 'center' }}><button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicked(picked.slice(0, -1))}>Стереть букву</button></div>}
      {answered && !checkOne(game, i, given) && <div className="qk-correct">Правильно: <b>{word}</b></div>}
    </>
  );
}

function TfCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const j = useMemo(() => (Math.random() < 0.5 || game.items.length < 2 ? i : shuffle(game.items.map((_, k) => k).filter((k) => k !== i))[0]), [game, i]);
  const answered = given !== undefined;
  const say = (v) => { if (answered) return; set({ j, v }); setTimeout(next, (j === i) === v ? 700 : 1600); };
  return (
    <>
      <div className="qk-q">{x.q} <span className="muted">=</span> {first(game.items[j].a)}</div>
      <div className="qk-tf">
        <button type="button" className={`qk-opt${answered ? (j === i ? ' ok' : given.v ? ' bad' : ' dim') : ''}`} onClick={() => say(true)} disabled={answered}><Icon name="check" size={20} /> Верно</button>
        <button type="button" className={`qk-opt${answered ? (j !== i ? ' ok' : !given.v ? ' bad' : ' dim') : ''}`} onClick={() => say(false)} disabled={answered}><Icon name="close" size={20} /> Неверно</button>
      </div>
      {answered && j !== i && <div className="qk-correct">На самом деле: <b>{first(x.a)}</b></div>}
    </>
  );
}

function FlipCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`qk-flip${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-label={open ? 'Скрыть ответ' : 'Показать ответ'}>
        <span className="qk-flip-q">{x.q}</span>
        {open ? <span className="qk-flip-a">{first(x.a)}</span> : <span className="small muted">нажмите, чтобы перевернуть</span>}
      </button>
      <div className="qk-tf">
        <button type="button" className="qk-opt" onClick={() => { set(false); next(); }} disabled={given !== undefined}>Не знаю</button>
        <button type="button" className="qk-opt" onClick={() => { set(true); next(); }} disabled={given !== undefined}>Знаю</button>
      </div>
    </>
  );
}

function MemoryBoard({ game, answers, setAnswers, result }) {
  const tiles = useMemo(() => shuffle(game.items.flatMap((x, i) => [{ i, side: 'q', text: x.q }, { i, side: 'a', text: first(x.a) }])), [game]);
  const found = new Set(answers.found || []);
  const [open, setOpen] = useState([]);
  const [timeUp, setTimeUp] = useState(false);
  const locked = Boolean(result) || timeUp;
  const flip = (k) => {
    if (locked || open.length === 2 || open.includes(k) || found.has(tiles[k].i)) return;
    const now = [...open, k];
    setOpen(now);
    if (now.length === 2) {
      const [a, b] = now.map((n) => tiles[n]);
      setTimeout(() => {
        if (a.i === b.i) setAnswers((prev) => ({ ...prev, found: [...(prev.found || []), a.i] }));
        else setAnswers((prev) => ({ ...prev, misses: (prev.misses || 0) + 1 }));
        setOpen([]);
      }, a.i === b.i ? 350 : 900);
    }
  };
  return (
    <div className="qk">
      <div className="qk-top">
        <span className="small muted">Найдено {found.size} из {game.items.length}{answers.misses ? ` · промахов ${answers.misses}` : ''}</span>
        {!result && <Countdown seconds={game.timer} onEnd={() => setTimeUp(true)} />}
      </div>
      <div className="qk-memory" style={{ gridTemplateColumns: `repeat(${tiles.length > 12 ? 5 : 4}, minmax(0, 1fr))` }}>
        {tiles.map((t, k) => {
          const shown = open.includes(k) || found.has(t.i) || Boolean(result);
          return (
            <button key={k} type="button" className={`qk-mem${shown ? ' open' : ''}${found.has(t.i) ? ' found' : ''}${result && !found.has(t.i) ? ' bad' : ''}`} onClick={() => flip(k)} disabled={locked} aria-label={shown ? t.text : 'Закрытая карточка'}>
              {shown ? t.text : ''}
            </button>
          );
        })}
      </div>
      {found.size === game.items.length && !result && <div className="qk-correct">Все пары найдены! Нажмите «Проверить».</div>}
    </div>
  );
}

export function QuickBoard({ game, answers, setAnswers, result, MatchBoard }) {
  const t = game.template;
  if (t === 'match') return <MatchBoard game={{ type: 'match', pairs: game.items.map((x) => ({ a: x.q, b: first(x.a) })) }} answers={answers} setAnswers={setAnswers} result={result} />;
  if (t === 'memory') return <MemoryBoard game={game} answers={answers} setAnswers={setAnswers} result={result} />;
  const Card = { quiz: QuizCard, type: TypeCard, anagram: AnagramCard, tf: TfCard, flip: FlipCard }[t];
  return (
    <Stepper game={game} answers={answers} setAnswers={setAnswers} result={result} isDone={(g) => g !== undefined && g !== null}
      render={(i, given, set, next) => <Card game={game} i={i} given={given} set={set} next={next} />} />
  );
}

export function quickProgress(game, answers) {
  if (game.template === 'match') return `Соединено ${Object.keys(answers.pairs || {}).length} из ${game.items.length}`;
  if (game.template === 'memory') return '';
  return `Ответов ${Object.keys(answers.r || {}).length} из ${game.items.length}`;
}

/* ============================================================
   Редактор: шаблон, список строк, вставка списком
   ============================================================ */
// «cat - кот», «cat — кот», «cat = кот», «cat<Tab>кот», «cat: кот»
export function parseLines(text) {
  return String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.split(/\t|\s+[-–—]\s+|\s*=\s*|:\s+/);
    if (m.length >= 2) {
      const [q, a, ...rest] = m.map((s) => s.trim());
      const wrong = rest.join(' ').split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      return { q, a, ...(wrong.length ? { wrong } : {}) };
    }
    return { q: l, a: '' };
  });
}

export function TemplateGallery({ value, onPick, compact }) {
  return (
    <div className={`qk-gallery${compact ? ' compact' : ''}`} role="radiogroup" aria-label="Игра">
      {Object.entries(QUICK_TEMPLATES).map(([k, t]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} className={`qk-tpl${value === k ? ' on' : ''}`} onClick={() => onPick(k)}>
          <span className="type-ill" aria-hidden="true">{t.ill}</span>
          <span className="list-title">{t.label}</span>
          {!compact && <span className="list-sub">{t.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function QuickEditor({ game, onChange }) {
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const items = game.items;
  const set = (k, p) => onChange({ ...game, items: items.map((x, j) => (j === k ? { ...x, ...p } : x)) });
  const filled = items.filter((x) => x.q.trim() && x.a.trim()).length;
  const isQuiz = game.template === 'quiz';
  const applyPaste = () => {
    const rows = parseLines(text);
    if (!rows.length) return;
    const keep = items.filter((x) => x.q.trim() || x.a.trim());
    onChange({ ...game, items: [...keep, ...rows].slice(0, 60) });
    setText(''); setPaste(false);
  };
  return (
    <div className="qk-editor">
      <Field label="Игра" hint="Можно сменить в любой момент: слова останутся, поменяется только игра">
        <TemplateGallery value={game.template} onPick={(template) => onChange({ ...game, template })} compact />
      </Field>
      <div className="row-between wrap" style={{ gap: 8, margin: '6px 0 8px' }}>
        <span className="section-title">Слова и вопросы · {filled}</span>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className={`btn btn-sm ${paste ? '' : 'btn-secondary'}`} onClick={() => setPaste(!paste)}><Icon name="clip" size={16} /> Вставить списком</button>
        </div>
      </div>
      {paste && (
        <div className="qk-paste">
          <textarea className="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder={'Каждая пара с новой строки:\ncat - кот\ndog - собака\nto run - бежать\n\nМожно скопировать из Word или таблицы'} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={applyPaste} disabled={!text.trim()}>Добавить {parseLines(text).length || ''}</button>
            <span className="small muted">Разделитель: тире, знак =, двоеточие или табуляция{isQuiz ? '. Неправильные варианты после второго тире через запятую' : ''}</span>
          </div>
        </div>
      )}
      <div className={`qk-rows${isQuiz ? ' quiz' : ''}`}>
        <div className="qk-row qk-head small muted"><span /><span>{game.template === 'quiz' || game.template === 'type' ? 'Вопрос' : game.template === 'anagram' ? 'Слово (соберут из букв)' : 'Слово'}</span><span>{game.template === 'quiz' || game.template === 'type' ? 'Ответ' : game.template === 'anagram' ? 'Подсказка (перевод)' : 'Перевод или пара'}</span>{isQuiz && <span>Неправильные варианты</span>}<span /></div>
        {items.map((x, k) => (
          <div key={k} className="qk-row">
            <span className="qk-n num">{k + 1}</span>
            <input className="input" value={x.q} onChange={(e) => set(k, { q: e.target.value })} placeholder={k === 0 ? 'cat' : ''} aria-label={`Строка ${k + 1}: вопрос`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.parentElement.querySelectorAll('input')[1]?.focus(); } }} />
            <input className="input" value={x.a} onChange={(e) => set(k, { a: e.target.value })} placeholder={k === 0 ? 'кот' : ''} aria-label={`Строка ${k + 1}: ответ`}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const row = e.currentTarget.parentElement;
                if (k === items.length - 1) { onChange({ ...game, items: [...items, { q: '', a: '' }] }); setTimeout(() => row.nextElementSibling?.querySelector('input')?.focus(), 0); } else row.nextElementSibling?.querySelector('input')?.focus();
              }} />
            {isQuiz && <input className="input" value={(x.wrong || []).join(', ')} onChange={(e) => set(k, { wrong: e.target.value.split(',').map((s) => s.trimStart()).slice(0, 5) })} placeholder={k === 0 ? 'сам подберёт' : ''} aria-label={`Строка ${k + 1}: неправильные варианты`} />}
            <button type="button" className="icon-btn" aria-label="Убрать строку" onClick={() => onChange({ ...game, items: items.length > 1 ? items.filter((_, j) => j !== k) : [{ q: '', a: '' }] })}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ ...game, items: [...items, { q: '', a: '' }] })} disabled={items.length >= 60}><Icon name="plus" size={16} /> Строка</button>
        <span className="small muted">Enter переходит к следующему полю. Несколько верных ответов через |</span>
      </div>
      <div className="form-row" style={{ marginTop: 12 }}>
        <Field label="Таймер">
          <select className="select" value={game.timer || 0} onChange={(e) => onChange({ ...game, timer: Number(e.target.value) })}>{TIMERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      </div>
      {isQuiz && <div className="small muted">Если неправильные варианты не заданы, сайт возьмёт их из ответов других строк.</div>}
    </div>
  );
}

export function cleanQuick(game) {
  const items = game.items.map((x) => ({ q: x.q.trim(), a: x.a.trim(), ...(x.wrong?.filter((w) => w.trim()).length ? { wrong: x.wrong.map((w) => w.trim()).filter(Boolean) } : {}) })).filter((x) => x.q && x.a);
  return { ...game, items };
}
