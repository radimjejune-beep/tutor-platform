// games/Quick.jsx: быстрые шаблоны. Преподаватель вводит список «вопрос и ответ» один раз,
// а игру выбирает из галереи и может сменить в любой момент: викторина, пары, мемори, анаграмма,
// верно или нет, напиши ответ, карточки. Ответ на i-ю строку хранится в answers.r[i].
import { useEffect, useMemo, useRef, useState } from 'react';
import { Field, Icon } from '../ui';
import { normalize, shuffle } from './logic';
import { speak, canSpeak } from '../voice';
import Wheel from './Wheel.jsx';

export const QUICK_TEMPLATES = {
  quiz: { label: 'Выбери правильный ответ', hint: 'Quiz: вопрос и ваши варианты ответа', ill: <><i>cat</i><b>→</b><s>собака</s><i>кот</i></> },
  match: { label: 'Соедини пары', hint: 'Слово и перевод, термин и определение', ill: <><i>cat</i><b>-</b><i>кот</i></> },
  memory: { label: 'Мемори', hint: 'Открывай по две карточки и находи пары', ill: <><i>?</i><i>?</i><i>кот</i></> },
  anagram: { label: 'Анаграмма', hint: 'Собери слово из перемешанных букв', ill: <><i>t</i><i>a</i><i>c</i></> },
  truefalse: {label:'Верно / неверно',hint:'True or False: утверждения с заданным верным ответом',ill:<><i>My aunt is my mum’s sister.</i><b>✓ ✗</b></>},
  wheel: {label:'Колесо вопросов',hint:'Random wheel: устная практика и вопросы без повторов',ill:<><b>◉</b><i>?</i></>},
  tf: { label: 'Проверь пару', hint: 'Пара показана правильно или с подвохом?', ill: <><i>cat = кот</i><b>✓ ✗</b></> },
  type: { label: 'Кто я? / Введи ответ', hint: 'Who am I? Загадки, определения и ответы текстом', ill: <><i>cat</i><u /></> },
  flip: { label: 'Карточки', hint: 'Переверни, вспомни, отметь «знаю» или «не знаю»', ill: <><i>cat</i><b>⟲</b><i>кот</i></> },
};
const TIMERS = [[0, 'Без таймера'], [60, '1 минута'], [120, '2 минуты'], [180, '3 минуты'], [300, '5 минут'], [600, '10 минут']];

export const emptyQuick = (template) => ({ type: 'quick', template, timer: 0, items: Array.from({length:4},()=>({q:'',a:template==='truefalse'?'true':''})) });

const hasLatin = (s) => /[a-z]/i.test(s || '');
const first = (a) => String(a || '').split('|')[0].trim();
const answerLabel=(game,x)=>game.template==='truefalse'?(x.a==='true'?'Утверждение верно':'Утверждение неверно'):first(game.template==='anagram'?x.q:x.a);

/* ============================================================
   Прохождение
   ============================================================ */
function Countdown({ seconds, onEnd }) {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(onEnd);
  ended.current = onEnd;
  useEffect(() => {
    if (!seconds) return undefined;
    const deadline = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remaining);
      if (!remaining) { clearInterval(t); ended.current(); }
    }, 250);
    return () => clearInterval(t);
  }, [seconds]);
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
  const cardRef = useRef(null);
  const next = () => setPos((p) => Math.min(order.length, p + 1));
  const firstQuestion = useRef(true);
  useEffect(() => {
    if (firstQuestion.current) { firstQuestion.current = false; return; }
    const target = cardRef.current?.querySelector('input:not(:disabled)') || cardRef.current;
    target?.focus({ preventScroll: true });
  }, [pos]);
  const done = order.filter((i) => isDone(r[i])).length;
  const right = order.filter((i) => checkOne(game, i, r[i])).length;
  return (
    <div className="qk">
      <div className="qk-top">
        <span className="experience-step">{pos < order.length && !locked ? `Вопрос ${pos + 1} из ${order.length}` : `Пройдено ${done} из ${order.length}`}</span>
        <div className="qk-dots" aria-hidden="true">{order.map((i, k) => <span key={i} className={isDone(r[i]) ? (checkOne(game, i, r[i]) ? 'ok' : 'bad') : k === pos ? 'on' : ''} />)}</div>
        {!result && <Countdown seconds={game.timer} onEnd={() => setTimeUp(true)} />}
      </div>
      {pos < order.length && !locked ? (
        <div className="qk-card" key={order[pos]} ref={cardRef} tabIndex={-1}>
          {render(order[pos], r[order[pos]], (v) => answer(order[pos], v), next)}
          {isDone(r[order[pos]]) && game.template !== 'flip' && <div className="experience-feedback" role="status">
            <div><b>{checkOne(game, order[pos], r[order[pos]]) ? 'Верно' : 'Попробуем запомнить'}</b><p>{checkOne(game, order[pos], r[order[pos]]) ? 'Можно переходить дальше.' : `Ответ: ${answerLabel(game,game.items[order[pos]])}`}</p></div>
            <button type="button" className="btn" onClick={next}>{pos === order.length - 1 ? 'К итогу' : 'Следующий вопрос'}</button>
          </div>}
        </div>
      ) : (
        <div className="qk-card qk-end">
          <div className="qk-big num">{right} из {order.length}</div>
          <div className="muted">{timeUp && done < order.length ? 'Время вышло.' : done < order.length ? 'Не все вопросы были пройдены.' : 'Все вопросы пройдены.'} {result ? '' : 'Нажмите «Проверить», чтобы увидеть итог.'}</div>
        </div>
      )}
      {result && <ReviewList game={game} r={r} />}
    </div>
  );
}

function checkOne(game, i, g) {
  const x = game.items[i];
  if (g === undefined || g === null || g === '') return false;
  if(game.template==='truefalse')return typeof g==='boolean'&&g===(x.a==='true');
  if (game.template === 'tf') return typeof g.v === 'boolean' && (Number(g.j) === i) === g.v;
  if (game.template === 'flip') return g === true;
  return String(game.template === 'anagram' ? x.q : x.a).split('|').map((s) => s.trim()).filter(Boolean).some((v) => normalize(v) === normalize(String(g)));
}

function ReviewList({ game, r }) {
  return (
    <ol className="qk-review">
      {game.items.map((x, i) => {
        const ok = checkOne(game, i, r[i]);
        return <li key={i} className={ok ? 'ok' : 'bad'}><span>{game.template === 'anagram' ? first(x.a) : x.q}</span><b>{answerLabel(game,x)}</b>{!ok && r[i] !== undefined && !['tf','truefalse','flip'].includes(game.template) && <s>{String(r[i])}</s>}</li>;
      })}
    </ol>
  );
}

function QuizCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const opts = useMemo(() => {
    const accepted = String(x.a).split('|').map(normalize);
    const own = (x.wrong || []).filter(o => o && !accepted.includes(normalize(o)));
    const pool = shuffle(game.items.filter((_, j) => j !== i).map((y) => first(y.a)).filter((a) => !accepted.includes(normalize(a))));
    const seen = new Set(accepted);
    const wrong = (own.length?own:pool).filter(o => { const key = normalize(o); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, own.length?5:3);
    return shuffle([first(x.a), ...wrong]);
  }, [game, i]); // eslint-disable-line react-hooks/exhaustive-deps
  const answered = given !== undefined;
  const pick = (o) => { if (answered) return; set(o); };
  return (
    <>
      <div className="qk-q">{x.q}<Say text={x.q} /></div>
      <div className="qk-opts">
        {opts.map((o, k) => {
          const isRight = normalize(o) === normalize(first(x.a));
          const st = answered ? (isRight ? ' ok' : o === given ? ' bad' : ' dim') : '';
          return <button key={o} type="button" className={`qk-opt${st}`} onClick={() => pick(o)} disabled={answered}><span className="qk-letter">{'ABCDEF'[k]}</span>{o}</button>;
        })}
      </div>
    </>
  );
}

function TypeCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const [v, setV] = useState('');
  const answered = given !== undefined;
  const submit = (e) => { e.preventDefault(); if (answered || !v.trim()) return; set(v.trim()); };
  return (
    <form onSubmit={submit}>
      <div className="qk-q">{x.q}<Say text={x.q} /></div>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <input className={`input qk-input${answered ? (checkOne(game, i, given) ? ' ok' : ' bad') : ''}`} value={answered ? given : v} onChange={(e) => setV(e.target.value)} disabled={answered} autoFocus autoComplete="off" spellCheck={false} aria-label="Ответ" />
        {!answered && <button className="btn" type="submit">Ответить</button>}
      </div>
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
    set(out);
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
    </>
  );
}

function TfCard({ game, i, given, set, next }) {
  const x = game.items[i];
  const j = useMemo(() => {
    const accepted = String(x.a).split('|').map(normalize);
    const other = game.items.map((y, k) => ({ y, k })).filter(({ y, k }) => k !== i && !accepted.includes(normalize(first(y.a))));
    return Math.random() < 0.5 || !other.length ? i : shuffle(other)[0].k;
  }, [game, i]);
  const answered = given !== undefined;
  const say = (v) => { if (answered) return; set({ j, v }); };
  return (
    <>
      <div className="qk-q">{x.q} <span className="muted">=</span> {first(game.items[j].a)}</div>
      <div className="qk-tf">
        <button type="button" className={`qk-opt${answered ? (j === i ? ' ok' : given.v ? ' bad' : ' dim') : ''}`} onClick={() => say(true)} disabled={answered}><Icon name="check" size={20} /> Верно</button>
        <button type="button" className={`qk-opt${answered ? (j !== i ? ' ok' : !given.v ? ' bad' : ' dim') : ''}`} onClick={() => say(false)} disabled={answered}><Icon name="close" size={20} /> Неверно</button>
      </div>
    </>
  );
}

function StatementCard({game,i,given,set}){
 const answered=typeof given==='boolean',right=game.items[i].a==='true';
 return <><div className="qk-q">{game.items[i].q}<Say text={game.items[i].q}/></div><div className="qk-tf">{[[true,'Верно'],[false,'Неверно']].map(([value,label])=><button key={label} type="button" className={'qk-opt'+(answered?(value===right?' ok':given===value?' bad':' dim'):'')} disabled={answered} onClick={()=>set(value)}>{label}</button>)}</div></>;
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
      {!open && <p className="small muted" style={{textAlign: 'center'}}>Сначала откройте ответ, затем оцените себя.</p>}
      <div className="qk-tf">
        <button type="button" className="qk-opt" onClick={() => { set(false); next(); }} disabled={given !== undefined || !open}>Ещё учу</button>
        <button type="button" className="qk-opt" onClick={() => { set(true); next(); }} disabled={given !== undefined || !open}>Знаю</button>
      </div>
    </>
  );
}

function MemoryBoard({ game, answers, setAnswers, result }) {
  const tiles = useMemo(() => shuffle(game.items.flatMap((x, i) => [{ i, side: 'q', text: x.q }, { i, side: 'a', text: first(x.a) }])), [game]);
  const pending = useRef(null);
  const found = new Set(answers.found || []);
  const [open, setOpen] = useState([]);
  const [timeUp, setTimeUp] = useState(false);
  const locked = Boolean(result) || timeUp;
  useEffect(() => { if (locked) { clearTimeout(pending.current); setOpen([]); } return () => clearTimeout(pending.current); }, [locked]);
  const flip = (k) => {
    if (locked || open.length === 2 || open.includes(k) || found.has(tiles[k].i)) return;
    const now = [...open, k];
    setOpen(now);
    if (now.length === 2) {
      const [a, b] = now.map((n) => tiles[n]);
      pending.current = setTimeout(() => {
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
            <button key={k} type="button" className={`qk-mem${shown ? ' open' : ''}${found.has(t.i) ? ' found' : ''}${result && !found.has(t.i) ? ' bad' : ''}`} onClick={() => flip(k)} disabled={locked} aria-label={shown ? t.text : `Закрытая карточка ${k + 1}`} aria-pressed={shown}>
              {shown ? t.text : <span aria-hidden="true">◇</span>}
            </button>
          );
        })}
      </div>
      {found.size === game.items.length && !result && <div className="qk-correct">Все пары найдены! Нажмите «Проверить».</div>}
    </div>
  );
}

export function QuickBoard(props){const {game}=props;return game.context?<div className="quick-reference-layout"><details className="quick-context" open><summary>Опора для задания</summary><div>{game.context}</div></details><div className="quick-reference-activity"><QuickBoardInner {...props}/></div></div>:<QuickBoardInner {...props}/>;}
function QuickBoardInner({ game, answers, setAnswers, result, MatchBoard }) {
  const t = game.template;
  const matching = useMemo(() => ({ type: 'match', pairs: game.items.map(x => ({ a: x.q, b: first(x.a) })) }), [game]);
  if(t==='wheel')return <Wheel game={game} answers={answers} setAnswers={setAnswers} result={result}/>;
  if (t === 'match') return <MatchBoard game={matching} answers={answers} setAnswers={setAnswers} result={result} />;
  if (t === 'memory') return <MemoryBoard game={game} answers={answers} setAnswers={setAnswers} result={result} />;
  const Card = { quiz: QuizCard, type: TypeCard, anagram: AnagramCard, tf: TfCard, truefalse:StatementCard, flip: FlipCard }[t];
  return (
    <Stepper game={game} answers={answers} setAnswers={setAnswers} result={result} isDone={(g) => g !== undefined && g !== null}
      render={(i, given, set, next) => <Card game={game} i={i} given={given} set={set} next={next} />} />
  );
}

export function quickProgress(game, answers) {
  if (game.template === 'match') return `Соединено ${Object.keys(answers.pairs || {}).length} из ${game.items.length}`;
  if (game.template === 'memory') return `Найдено ${new Set(answers.found || []).size} из ${game.items.length}`;
  if(game.template==='wheel')return `Обсуждено ${game.items.filter((_,i)=>answers.r?.[i]?.done===true).length} из ${game.items.length}`;
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
  const filled = items.filter((x) => x.q.trim() && (game.template==='wheel'||x.a.trim())).length;
  const isQuiz = game.template === 'quiz',isStatement=game.template==='truefalse',isWheel=game.template==='wheel';
  const maxItems=isWheel?24:60;
  const pasted=()=>isWheel?text.split('\n').map(q=>({q:q.trim(),a:''})).filter(x=>x.q):parseLines(text);
  const applyPaste = () => {
    const rows = pasted();
    if (!rows.length) return;
    const keep = items.filter((x) => x.q.trim() || x.a.trim());
    onChange({ ...game, items: [...keep, ...rows].slice(0, maxItems) });
    setText(''); setPaste(false);
  };
  return (
    <div className="qk-editor">
      <Field label="Игра" hint="При смене формата строки сохранятся. Проверьте, подходят ли ответы новому формату.">
        <select className="select" aria-label="Формат игры" value={game.template} onChange={e=>onChange({...game,template:e.target.value})}>{Object.entries(QUICK_TEMPLATES).map(([k,t])=><option key={k} value={k}>{t.label}</option>)}</select>
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
            placeholder={isWheel?'По одному вопросу в строке:\nHave you got a big family?\nWhat is your favourite game?':'Каждая пара с новой строки:\ncat - кот\ndog - собака\nto run - бежать\n\nМожно скопировать из Word или таблицы'} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-sm" onClick={applyPaste} disabled={!text.trim()}>Добавить {pasted().length || ''}</button>
            <span className="small muted">{isWheel?'По одному вопросу в строке. Ответы не обязательны.':'Разделитель: тире, знак =, двоеточие или табуляция'}{isQuiz ? '. Неправильные варианты после второго тире через запятую' : ''}</span>
          </div>
        </div>
      )}
      <div className={`qk-rows${isQuiz ? ' quiz' : ''}`}>
        <div className="qk-row qk-head small muted"><span /><span>{isStatement?'Утверждение':isWheel||game.template === 'quiz' || game.template === 'type' ? 'Вопрос' : game.template === 'anagram' ? 'Слово (соберут из букв)' : 'Слово'}</span><span>{isStatement?'Правильный выбор':isWheel?'Подсказка (необязательно)':game.template === 'quiz' || game.template === 'type' ? 'Ответ' : game.template === 'anagram' ? 'Подсказка (перевод)' : 'Перевод или пара'}</span>{isQuiz && <span>Неправильные варианты</span>}<span /></div>
        {items.map((x, k) => (
          <div key={k} className="qk-row">
            <span className="qk-n num">{k + 1}</span>
            <input className="input" value={x.q} onChange={(e) => set(k, { q: e.target.value })} placeholder={k===0?(isWheel?'Have you got a big family?':isStatement?'Your aunt is your mum’s sister.':game.template==='type'?"I am your mum’s mum.":'Вопрос'):''} aria-label={`Строка ${k + 1}: вопрос`}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.parentElement.querySelectorAll('input')[1]?.focus(); } }} />
            {isStatement?<select className="select" aria-label={`Строка ${k+1}: верно или неверно`} value={['true','false'].includes(x.a)?x.a:''} onChange={e=>set(k,{a:e.target.value})}><option value="">Выберите ответ</option><option value="true">Верно</option><option value="false">Неверно</option></select>:<input className="input" value={x.a} onChange={(e) => set(k, { a: e.target.value })} placeholder={k===0?(isWheel?'Идея для обсуждения':game.template==='type'?'grandma | grandmother':'Правильный ответ'):''} aria-label={`Строка ${k + 1}: ответ`}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const row = e.currentTarget.parentElement;
                if (k === items.length - 1 && items.length<maxItems) { onChange({ ...game, items: [...items, { q: '', a: '' }] }); setTimeout(() => row.nextElementSibling?.querySelector('input')?.focus(), 0); } else row.nextElementSibling?.querySelector('input')?.focus();
              }} />}
            {isQuiz && <input className="input" value={(x.wrong || []).join(', ')} onChange={(e) => set(k, { wrong: e.target.value.split(',').map((s) => s.trimStart()).slice(0, 5) })} placeholder={k === 0 ? 'сам подберёт' : ''} aria-label={`Строка ${k + 1}: неправильные варианты`} />}
            <button type="button" className="icon-btn" aria-label="Убрать строку" onClick={() => onChange({ ...game, items: items.length > 1 ? items.filter((_, j) => j !== k) : [{ q: '', a: '' }] })}><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 10, marginTop: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ ...game, items: [...items, { q: '', a: '' }] })} disabled={items.length >= maxItems}><Icon name="plus" size={16} /> Строка</button>
        <span className="small muted">Enter переходит к следующему полю. Несколько верных ответов через |</span>
      </div>
      {!isWheel&&<div className="form-row" style={{ marginTop: 12 }}>
        <Field label="Таймер">
          <select className="select" value={game.timer || 0} onChange={(e) => onChange({ ...game, timer: Number(e.target.value) })}>{TIMERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      </div>}
      {isWheel&&<p className="small muted">Вопросы выбираются без повторов в одном круге. Отметка «Ответил устно» не даёт автоматический балл за правильность.</p>}{game.template==='type'&&<p className="small muted">Допустимые варианты разделяйте знаком |: grandma | grandmother. Регистр и точка в конце не важны.</p>}
      <Field label="Опора для задания" hint="Необязательно: текст, описание ситуации или семейное дерево. Ученик увидит его над вопросами."><textarea className="input" rows={5} maxLength={4000} value={game.context||''} onChange={e=>onChange({...game,context:e.target.value})}/></Field>
      {isQuiz && <div className="small muted">Если неправильные варианты не заданы, сайт возьмёт их из ответов других строк.</div>}
    </div>
  );
}

export function cleanQuick(game) {
  const items = game.items.map((x) => ({ q: x.q.trim(), a: x.a.trim(), ...(x.wrong?.filter((w) => w.trim()).length ? { wrong: x.wrong.map((w) => w.trim()).filter(Boolean) } : {}) })).filter((x) => x.q && (game.template==='wheel'||x.a));
  return { ...game, items };
}
