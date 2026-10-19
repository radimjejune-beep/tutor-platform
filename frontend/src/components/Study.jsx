// components/Study.jsx — учить набор слов как в Quizlet: карточки, заучивание, письмо, подбор, тест.
// words: [{ key, term, translation, example, level }] (level 0–3, если есть прогресс)
// onFinish(mode, results, durationSec) → Promise<string | null>: сохранить итог, вернуть текст для ученика.
// Каждое слово в итоге встречается один раз: ok = ответил верно с первой попытки.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui';
import { speak, canSpeak } from './Vocab';
import { useSubject } from '../subjects';
import { plural } from '../format';

export const MODES = [
  { k: 'cards', title: 'Карточки', icon: 'cards', text: 'Переворачивай и отмечай: знаю или ещё учу.' },
  { k: 'learn', title: 'Заучивание', icon: 'layers', text: 'Сначала выбор из вариантов, потом пишешь сам. Пока не выучишь все.' },
  { k: 'write', title: 'Письмо', icon: 'edit', text: 'Пишешь каждое слово. Ошибку нужно переписать правильно.' },
  { k: 'match', title: 'Подбор', icon: 'grid', text: 'Найди пары на время. Обгони свой рекорд.' },
  { k: 'test', title: 'Тест', icon: 'quiz', text: 'Смешанные вопросы, оценка в конце. Проверь себя.' },
];
const MODE_NAME = Object.fromEntries(MODES.map((m) => [m.k, m.title]));

export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Сравнение ответов: без регистра, знаков, скобок; ё = е; артикль и to в начале можно не писать
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\(.*?\)/g, ' ').replace(/[’`]/g, "'")
  .replace(/[^\p{L}\p{N}' ]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^(to|a|an|the) /, '');
const variants = (ans) => [ans, ...String(ans || '').split(/\s*[,;/]\s*/)].map(norm).filter(Boolean);
export const isRight = (given, ans) => Boolean(norm(given)) && variants(ans).includes(norm(given));

// Что спрашиваем и что отвечаем
const side = (w, dir) => (dir === 'term' ? { q: w.translation, a: w.term, speakQ: false } : { q: w.term, a: w.translation, speakQ: true });

const LEVEL = ['Не изучено', 'Знакомо', 'Почти выучено', 'Выучено'];
export function LevelDot({ level = 0 }) {
  return <span className={`lvl lvl-${level}`} title={LEVEL[level]} aria-label={LEVEL[level]} />;
}

export default function Study({ words, subject, onFinish, startMode }) {
  const subj = useSubject(subject);
  const usable = useMemo(() => words.filter((w) => w.term && w.translation), [words]);
  const [mode, setMode] = useState(startMode || null);
  const [dir, setDir] = useState('term'); // term: видишь перевод, пишешь слово; def: видишь слово, отвечаешь переводом
  const [onlyNew, setOnlyNew] = useState(false);
  const [only, setOnly] = useState(null); // повтор ошибок: список ключей
  const [result, setResult] = useState(null);
  const [session, setSession] = useState(null); // перемешанная колода на одну тренировку
  const started = useRef(Date.now());

  const notLearned = usable.filter((w) => (w.level ?? 0) < 3);
  const deck = session?.deck || usable;

  const start = (k, keys = null) => {
    let d = usable;
    if (keys) d = d.filter((w) => keys.includes(w.key));
    else if (onlyNew && notLearned.length) d = notLearned;
    setOnly(keys); setResult(null); setMode(k);
    setSession((x) => ({ n: (x?.n || 0) + 1, deck: shuffle(d) }));
    started.current = Date.now();
  };
  const done = async (results, extra = {}) => {
    const sec = Math.round((Date.now() - started.current) / 1000);
    const r = { mode, results, sec, keep: false, ...extra, note: null, saving: Boolean(onFinish) };
    setResult(r);
    if (onFinish && results.length) {
      try {
        const note = await onFinish(mode, results, sec);
        setResult((x) => (x === r || x?.results === results ? { ...x, note, saving: false } : x));
      } catch (err) {
        setResult((x) => ({ ...x, note: `Не сохранилось: ${err.message}`, saving: false }));
      }
    } else setResult((x) => ({ ...x, saving: false }));
  };

  if (usable.length < 2) {
    return <p className="muted">Для тренировки нужно хотя бы 2 {subj.isLang ? 'слова с переводом' : 'термина с определением'}.</p>;
  }

  // Меню режимов
  if (!mode) {
    return (
      <div className="study">
        <div className="study-modes">
          {MODES.map((m) => (
            <button key={m.k} type="button" className="study-mode" onClick={() => start(m.k)}>
              <Icon name={m.icon} size={22} />
              <span className="study-mode-title">{m.title}</span>
              <span className="small muted">{m.text}</span>
            </button>
          ))}
        </div>
        <div className="study-settings">
          <div>
            <div className="meta-label">Отвечать</div>
            <div className="seg seg-quiet">
              <button type="button" className={dir === 'term' ? 'on' : ''} onClick={() => setDir('term')}>{subj.isLang ? 'словом' : 'термином'} ({subj.dirs[1]})</button>
              <button type="button" className={dir === 'def' ? 'on' : ''} onClick={() => setDir('def')}>{subj.isLang ? 'переводом' : 'определением'} ({subj.dirs[0]})</button>
            </div>
          </div>
          {notLearned.length > 0 && notLearned.length < usable.length && (
            <label className="check"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Только невыученные ({notLearned.length})</label>
          )}
        </div>
      </div>
    );
  }

  if (result && !result.keep) return <Result r={result} deck={deck} dir={dir} onAgain={(keys) => start(mode, keys)} onMenu={() => { setMode(null); setResult(null); setOnly(null); }} />;

  if (!session) { start(mode); return null; }
  const props = { deck: session.deck, dir, subj, done, release: () => setResult((x) => x && { ...x, keep: false }) };
  const k = session.n;
  return (
    <div className="study">
      <div className="row-between study-top">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setMode(null); setOnly(null); }}><Icon name="back" /> Режимы</button>
        <span className="meta-label">{MODE_NAME[mode]}{only ? ' · ошибки' : ''}</span>
      </div>
      {mode === 'cards' && <Cards key={k} {...props} />}
      {mode === 'learn' && <Learn key={k} {...props} />}
      {mode === 'write' && <Write key={k} {...props} />}
      {mode === 'match' && <Match key={k} {...props} />}
      {mode === 'test' && <Test key={k} {...props} />}
    </div>
  );
}

function Result({ r, deck, onAgain, onMenu }) {
  const bad = r.results.filter((x) => !x.ok);
  const good = r.results.length - bad.length;
  const byKey = new Map(deck.map((w) => [w.key, w]));
  const pct = r.results.length ? Math.round((good / r.results.length) * 100) : 0;
  const mm = Math.floor(r.sec / 60), ss = r.sec % 60;
  return (
    <div className="study study-result">
      <div className="serif flash-big">{r.mode === 'match' && r.time != null ? `${r.time.toFixed(1)} с` : `${pct}%`}</div>
      <p className="muted" style={{ margin: '6px 0 4px' }}>
        {r.mode === 'match'
          ? (r.best ? 'Новый рекорд!' : `Рекорд: ${r.record?.toFixed(1)} с`) + ` · ошибок: ${r.mistakes}`
          : `С первой попытки: ${good} из ${r.results.length}`}
        {r.mode !== 'match' ? ` · ${mm ? `${mm} мин ` : ''}${ss} с` : ''}
      </p>
      <p className="small muted" style={{ margin: '0 0 18px' }}>{r.saving ? 'Сохраняем…' : r.note || ''}</p>
      {bad.length > 0 && (
        <div className="study-missed">
          <div className="meta-label">Ошибки</div>
          {bad.map((x) => {
            const w = byKey.get(x.key);
            return w ? <div key={x.key} className="study-missed-row"><span className="serif">{w.term}</span><span className="muted">{w.translation}</span></div> : null;
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {bad.length > 0 && <button type="button" className="btn" onClick={() => onAgain(bad.map((x) => x.key))}>Повторить ошибки ({bad.length})</button>}
        <button type="button" className={`btn ${bad.length ? 'btn-secondary' : ''}`} onClick={() => onAgain(null)}>Ещё раз</button>
        <button type="button" className="btn btn-secondary" onClick={onMenu}>Другой режим</button>
      </div>
    </div>
  );
}

function Progress({ i, n, label }) {
  return (
    <div className="study-progress">
      <span className="meta-label">{label || `${Math.min(i + 1, n)} / ${n}`}</span>
      <div className="bar"><span style={{ width: `${n ? (i / n) * 100 : 0}%` }} /></div>
    </div>
  );
}

/* ---------------- Карточки ---------------- */
function Cards({ deck, subj, done }) {
  const [dir, setDir] = useState('def'); // def: спереди слово, term: спереди перевод
  const [queue, setQueue] = useState(deck);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const first = useRef(new Map());
  const w = queue[i];
  const s = w && side(w, dir);
  useEffect(() => { if (w && s.speakQ) speak(w.term); }, [w, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = (known) => {
    if (!first.current.has(w.key)) first.current.set(w.key, known);
    const nq = known ? queue : [...queue, w];
    setFlip(false);
    if (i + 1 >= nq.length) return done(deck.map((x) => ({ key: x.key, term: x.term, ok: Boolean(first.current.get(x.key)) })));
    setQueue(nq);
    setI(i + 1);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); setFlip((f) => !f); }
      if (e.key === 'ArrowRight') answer(true);
      if (e.key === 'ArrowLeft') answer(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  if (!w) return null;
  return (
    <div className="flash">
      <div className="row-between">
        <span className="meta-label">{i + 1} / {queue.length}{queue.length > deck.length ? ` · повтор ${queue.length - deck.length}` : ''}</span>
        <div className="seg seg-quiet">
          <button type="button" className={dir === 'def' ? 'on' : ''} onClick={() => { setDir('def'); setFlip(false); }}>{subj.dirs[0]}</button>
          <button type="button" className={dir === 'term' ? 'on' : ''} onClick={() => { setDir('term'); setFlip(false); }}>{subj.dirs[1]}</button>
        </div>
      </div>
      <div className="bar" style={{ marginTop: 10 }}><span style={{ width: `${(i / queue.length) * 100}%` }} /></div>
      <button type="button" className={`flash-card ${flip ? 'flipped' : ''}`} onClick={() => { setFlip(!flip); if (!flip && !s.speakQ) speak(w.term); }}>
        <span className="flash-inner">
          <span className="flash-face"><span className="serif flash-big" style={s.q.length > 40 ? { fontSize: 26 } : undefined}>{s.q}</span><span className="small muted">нажми или пробел, чтобы перевернуть</span></span>
          <span className="flash-face flash-back"><span className="serif flash-big" style={s.a.length > 40 ? { fontSize: 26 } : undefined}>{s.a}</span>{w.example && <span className="flash-example">{w.example}</span>}</span>
        </span>
      </button>
      <div className="flash-actions">
        {canSpeak() ? <button type="button" className="btn btn-quiet btn-sm" onClick={() => speak(`${w.term}. ${w.example || ''}`)}><Icon name="sound" /> Послушать</button> : <span />}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => answer(false)}>← Ещё учу</button>
          <button type="button" className="btn" onClick={() => answer(true)}>Знаю →</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Вопрос с вариантами и письменный ответ ---------------- */
function Choice({ w, dir, pool, onAnswer }) {
  const s = side(w, dir);
  const opts = useMemo(() => shuffle([s.a, ...shuffle(pool.filter((x) => x.key !== w.key).map((x) => side(x, dir).a).filter((a) => norm(a) !== norm(s.a))).filter((a, k, arr) => arr.indexOf(a) === k).slice(0, 3)]), [w.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState(null);
  useEffect(() => { if (s.speakQ) speak(w.term); }, [w.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (o) => {
    if (picked) return;
    setPicked(o);
    if (!s.speakQ) speak(w.term);
    setTimeout(() => onAnswer(o === s.a), o === s.a ? 650 : 1500);
  };
  return (
    <>
      <div className="practice-q"><span className="meta-label">Выбери ответ</span><span className="serif flash-big study-q">{s.q}</span></div>
      <div className="practice-opts">
        {opts.map((o, k) => (
          <button key={o} type="button" className={`practice-opt ${picked ? (o === s.a ? 'ok' : o === picked ? 'bad' : '') : ''}`} disabled={Boolean(picked)} onClick={() => pick(o)}>
            <span className="study-key">{k + 1}</span>{o}
          </button>
        ))}
      </div>
      <KeyPick n={opts.length} onPick={(k) => pick(opts[k])} />
    </>
  );
}
function KeyPick({ n, onPick }) {
  useEffect(() => {
    const onKey = (e) => { const k = Number(e.key); if (k >= 1 && k <= n) onPick(k - 1); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  return null;
}

function Typed({ w, dir, onAnswer, retype, hint }) {
  const s = side(w, dir);
  const [val, setVal] = useState('');
  const [state, setState] = useState(null); // null | 'ok' | 'bad' | 'copy'
  const [copy, setCopy] = useState('');
  const input = useRef();
  useEffect(() => { input.current?.focus(); if (s.speakQ) speak(w.term); }, [w.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const check = (e) => {
    e.preventDefault();
    if (state) return;
    if (!val.trim()) return;
    const ok = isRight(val, s.a);
    setState(ok ? 'ok' : 'bad');
    speak(w.term);
    if (ok) setTimeout(() => onAnswer(true), 700);
  };
  const dontKnow = () => { setState('bad'); setVal(''); speak(w.term); };
  return (
    <>
      <div className="practice-q">
        <span className="meta-label">{hint || (dir === 'term' ? 'Напиши слово' : 'Напиши перевод')}</span>
        <span className="serif flash-big study-q">{s.q}</span>
      </div>
      <form onSubmit={check} className="study-type">
        <input ref={input} className={`input practice-input ${state === 'ok' ? 'is-ok' : state === 'bad' ? 'is-bad' : ''}`} value={val} onChange={(e) => setVal(e.target.value)}
          disabled={Boolean(state)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Ответ" aria-label="Ответ" />
        {!state && (
          <div className="row-between" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={dontKnow}>Не знаю</button>
            <button className="btn" disabled={!val.trim()}>Проверить</button>
          </div>
        )}
      </form>
      {state === 'ok' && <div className="practice-fb ok">Верно!</div>}
      {state === 'bad' && (
        <div className="practice-fb bad study-bad">
          <div>Правильно: <b>{s.a}</b>{val && <span className="muted"> · твой ответ: {val}</span>}</div>
          {w.example && <div className="small muted">{w.example}</div>}
          {retype ? (
            <form className="study-type" onSubmit={(e) => { e.preventDefault(); if (isRight(copy, s.a)) onAnswer(false); }}>
              <input className="input practice-input" autoFocus value={copy} onChange={(e) => setCopy(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Перепиши правильный ответ" aria-label="Перепиши правильный ответ" />
              <div className="row-between" style={{ marginTop: 10 }}>
                {val ? <button type="button" className="btn btn-quiet btn-sm" onClick={() => onAnswer(true)}>Я ответил правильно</button> : <span />}
                <button className="btn" disabled={!isRight(copy, s.a)}>Дальше</button>
              </div>
            </form>
          ) : (
            <div className="row-between" style={{ marginTop: 10 }}>
              {val ? <button type="button" className="btn btn-quiet btn-sm" onClick={() => onAnswer(true)}>Я ответил правильно</button> : <span />}
              <button type="button" className="btn" autoFocus onClick={() => onAnswer(false)}>Дальше</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Заучивание ---------------- */
// Каждое слово: сначала выбор из вариантов, потом письменно. Ошибка возвращает к выбору.
const ROUND = 7;
function Learn({ deck, dir, done }) {
  const items = useRef(deck.map((w) => ({ w, stage: deck.length >= 3 ? 0 : 1, wrong: false, done: false })));
  const [round, setRound] = useState(() => items.current.slice(0, ROUND));
  const [pos, setPos] = useState(0);
  const [pause, setPause] = useState(null);
  const [tick, setTick] = useState(0);
  const total = items.current.length;
  const mastered = items.current.filter((x) => x.done).length;
  const it = round[pos];

  const answer = (ok) => {
    if (ok) { it.stage++; if (it.stage >= 2) it.done = true; } else { it.wrong = true; it.stage = deck.length >= 3 ? 0 : 1; }
    if (pos + 1 < round.length) { setPos(pos + 1); setTick(tick + 1); return; }
    const left = items.current.filter((x) => !x.done);
    if (!left.length) return done(items.current.map((x) => ({ key: x.w.key, term: x.w.term, ok: !x.wrong })));
    // Новый раунд: сначала недоученные, потом новые
    const inRound = round.filter((x) => !x.done);
    const fresh = left.filter((x) => !round.includes(x));
    setPause({ learned: total - left.length });
    setRound([...inRound, ...fresh].slice(0, ROUND));
    setPos(0);
    setTick(tick + 1);
  };

  if (pause) {
    return (
      <div className="study-result">
        <div className="serif flash-big">{pause.learned} / {total}</div>
        <p className="muted">Раунд пройден. Выучено слов: {pause.learned}. Продолжаем!</p>
        <button type="button" className="btn" autoFocus onClick={() => setPause(null)}>Продолжить</button>
      </div>
    );
  }
  return (
    <div className="practice">
      <Progress i={mastered} n={total} label={`Выучено ${mastered} из ${total}`} />
      {it.stage === 0
        ? <Choice key={`c${tick}`} w={it.w} dir={dir} pool={deck} onAnswer={answer} />
        : <Typed key={`t${tick}`} w={it.w} dir={dir} onAnswer={answer} hint={it.wrong ? 'Ещё раз, теперь сам' : undefined} />}
    </div>
  );
}

/* ---------------- Письмо ---------------- */
function Write({ deck, dir, done }) {
  const [i, setI] = useState(0);
  const res = useRef([]);
  const answer = (ok) => {
    res.current.push({ key: deck[i].key, term: deck[i].term, ok });
    if (i + 1 >= deck.length) return done(res.current);
    setI(i + 1);
  };
  return (
    <div className="practice">
      <Progress i={i} n={deck.length} label={`${i + 1} / ${deck.length} · верно ${res.current.filter((x) => x.ok).length}`} />
      <Typed key={i} w={deck[i]} dir={dir} onAnswer={answer} retype />
    </div>
  );
}

/* ---------------- Подбор ---------------- */
const records = {};
function Match({ deck, dir, done }) {
  const set = useMemo(() => deck.slice(0, 6), [deck]);
  const tiles = useMemo(() => shuffle(set.flatMap((w) => [{ id: `${w.key}:a`, key: w.key, text: w.term }, { id: `${w.key}:b`, key: w.key, text: w.translation }])), [set]);
  const [gone, setGone] = useState(new Set());
  const [sel, setSel] = useState(null);
  const [shake, setShake] = useState(null);
  const [penalty, setPenalty] = useState(0);
  const [now, setNow] = useState(Date.now());
  const missed = useRef(new Set());
  const t0 = useRef(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, []);
  const time = (now - t0.current) / 1000 + penalty;
  const recKey = set.map((w) => w.key).sort().join('|');

  const click = (t) => {
    if (gone.has(t.id)) return;
    if (!sel) { setSel(t); return; }
    if (sel.id === t.id) { setSel(null); return; }
    if (sel.key === t.key) {
      const g = new Set(gone); g.add(sel.id); g.add(t.id);
      setGone(g); setSel(null);
      speak(set.find((w) => w.key === t.key).term);
      if (g.size === tiles.length) {
        const final = (Date.now() - t0.current) / 1000 + penalty;
        const prev = records[recKey];
        const best = prev == null || final < prev;
        if (best) records[recKey] = final;
        done(set.map((w) => ({ key: w.key, term: w.term, ok: !missed.current.has(w.key) })), { time: final, best, record: records[recKey], mistakes: missed.current.size });
      }
    } else {
      missed.current.add(sel.key); missed.current.add(t.key);
      setPenalty((p) => p + 1);
      setShake([sel.id, t.id]); setSel(null);
      setTimeout(() => setShake(null), 400);
    }
  };
  return (
    <div className="practice">
      <div className="row-between"><span className="meta-label">Найди пары · ошибка +1 секунда</span><span className="serif match-time">{time.toFixed(1)}</span></div>
      <div className="match-grid">
        {tiles.map((t) => (
          <button key={t.id} type="button" className={`match-tile ${gone.has(t.id) ? 'gone' : ''} ${sel?.id === t.id ? 'sel' : ''} ${shake?.includes(t.id) ? 'shake' : ''}`} onClick={() => click(t)} disabled={gone.has(t.id)}>
            {t.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Тест ---------------- */
function Test({ deck, dir, done, release }) {
  const qs = useMemo(() => {
    const n = Math.min(deck.length, 20);
    const kinds = deck.length >= 4 ? ['mc', 'write', 'tf'] : ['write', 'tf'];
    return deck.slice(0, n).map((w, i) => {
      const kind = kinds[i % kinds.length];
      const s = side(w, dir);
      if (kind === 'mc') {
        const others = shuffle(deck.filter((x) => x.key !== w.key).map((x) => side(x, dir).a).filter((a) => norm(a) !== norm(s.a))).slice(0, 3);
        return { w, kind, q: s.q, a: s.a, opts: shuffle([s.a, ...others]) };
      }
      if (kind === 'tf') {
        const truth = Math.random() < 0.5;
        const other = deck.find((x) => x.key !== w.key && norm(side(x, dir).a) !== norm(s.a));
        const shown = truth || !other ? s.a : side(other, dir).a;
        return { w, kind, q: s.q, a: s.a, shown, truth: truth || !other };
      }
      return { w, kind, q: s.q, a: s.a };
    });
  }, [deck, dir]);
  const [ans, setAns] = useState({});
  const [checked, setChecked] = useState(false);
  const [warn, setWarn] = useState(false);
  const top = useRef();
  const ok = (q, k) => (q.kind === 'mc' ? ans[k] === q.a : q.kind === 'tf' ? ans[k] === q.truth : isRight(ans[k], q.a));
  const answered = qs.filter((q, k) => ans[k] !== undefined && ans[k] !== '').length;
  const finish = () => {
    if (answered < qs.length && !warn) { setWarn(true); return; }
    setChecked(true);
    top.current?.scrollIntoView({ behavior: 'smooth' });
    done(qs.map((q, k) => ({ key: q.w.key, term: q.w.term, ok: ok(q, k) })), { keep: true });
  };
  const score = qs.filter((q, k) => ok(q, k)).length;
  return (
    <div className="practice study-test" ref={top}>
      {checked
        ? <div className="study-result" style={{ padding: '10px 0 20px' }}><div className="serif flash-big">{score} / {qs.length}</div><p className="muted">Ошибки отмечены ниже.</p><button type="button" className="btn" onClick={release}>К итогу</button></div>
        : <Progress i={answered} n={qs.length} label={`Отвечено ${answered} из ${qs.length}`} />}
      {qs.map((q, k) => {
        const st = checked ? (ok(q, k) ? 'ok' : 'bad') : '';
        return (
          <div key={k} className={`test-q ${st}`}>
            <div className="meta-label">{k + 1}. {q.kind === 'mc' ? 'Выбери ответ' : q.kind === 'tf' ? 'Верно или нет?' : 'Напиши ответ'}</div>
            <div className="serif test-term">{q.q}</div>
            {q.kind === 'tf' && <div className="test-shown">= {q.shown}</div>}
            {q.kind === 'mc' && (
              <div className="practice-opts">
                {q.opts.map((o) => (
                  <button key={o} type="button" disabled={checked} className={`practice-opt ${checked ? (o === q.a ? 'ok' : ans[k] === o ? 'bad' : '') : ans[k] === o ? 'picked' : ''}`} onClick={() => setAns({ ...ans, [k]: o })}>{o}</button>
                ))}
              </div>
            )}
            {q.kind === 'tf' && (
              <div className="row" style={{ gap: 8 }}>
                {[[true, 'Верно'], [false, 'Неверно']].map(([v, l]) => (
                  <button key={l} type="button" disabled={checked} className={`practice-opt ${checked ? (v === q.truth ? 'ok' : ans[k] === v ? 'bad' : '') : ans[k] === v ? 'picked' : ''}`} style={{ flex: 1 }} onClick={() => setAns({ ...ans, [k]: v })}>{l}</button>
                ))}
              </div>
            )}
            {q.kind === 'write' && (
              <input className="input practice-input" disabled={checked} value={ans[k] || ''} onChange={(e) => setAns({ ...ans, [k]: e.target.value })} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Ответ" aria-label={`Ответ ${k + 1}`} />
            )}
            {checked && !ok(q, k) && <div className="small" style={{ color: 'var(--ok)', marginTop: 6 }}>Правильно: {q.kind === 'tf' ? `${q.truth ? 'верно' : 'неверно'}, ${q.q} = ${q.a}` : q.a}</div>}
          </div>
        );
      })}
      {!checked && (
        <div className="row-between" style={{ marginTop: 16 }}>
          <span className="small" style={{ color: warn ? 'var(--danger)' : 'var(--muted)' }}>{warn ? `Без ответа: ${qs.length - answered}. Нажми ещё раз, чтобы сдать так.` : ''}</span>
          <button type="button" className="btn" onClick={finish}>Проверить тест</button>
        </div>
      )}
    </div>
  );
}

export const wordsCount = (n) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
