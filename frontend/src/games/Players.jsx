// games/Players.jsx — прохождение упражнений
// Управление нажатиями (без перетаскивания), чтобы одинаково работало на телефоне и компьютере:
// выбрать карточку → нажать, куда её поставить.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildMistakePractice, exerciseInstruction, exerciseProgress } from './experience';
import './experience.css';
import { createPortal } from 'react-dom';
import { GAME_TYPES, grade, parseGaps, shuffle, shuffleChanged, tokenize } from './logic';
import { Icon, readDraft, writeDraft, clearDraft } from '../ui';
import { SheetBoard, sheetProgress } from './Sheet';
import { BoardBoard, boardProgress } from './Board';
import { QuickBoard, quickProgress, QUICK_TEMPLATES } from './Quick';

/* ============================================================
   Обёртка: заголовок, кнопка «Проверить», итог, «Ещё раз»
   onFinish(answers, result, durationSec) — сохранить результат (если не передан — режим тренировки)
   ============================================================ */
export default function GamePlayer({ game, title, onFinish, footer, draftKey, initialAnswers, initialResult, onDraft, allowRetry = true }) {
  const [round, setRound] = useState(0);
  const [mode, setMode] = useState('self');
  const [focus, setFocus] = useState(false);
  const [template, setTemplate] = useState(null);
  const root = useRef(null), focusButton = useRef(null), slot = useRef(null);
  const [host] = useState(() => document.createElement('div'));
  // Move one stable portal host, preserving answers and in-progress card state.
  // This also escapes mobile shell stacking/containing blocks.
  useLayoutEffect(() => {
    if (focus) {
      if (slot.current) slot.current.style.minHeight = `${root.current?.offsetHeight || 0}px`;
      document.body.appendChild(host);
    } else if (slot.current) { slot.current.appendChild(host); slot.current.style.minHeight = ''; }
    return () => { host.remove(); };
  }, [focus, host]);
  const headingId = useId();
  const key = JSON.stringify(game);
  // Preserve shuffled cards while a parent refreshes equivalent material.
  const stable = useMemo(() => game, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTemplate(null); setRound(0); }, [key]);
  const activeGame = useMemo(() => template && stable.type === 'quick' ? { ...stable, template } : stable, [stable, template]);
  const label = activeGame.type === 'quick' ? QUICK_TEMPLATES[activeGame.template]?.label : GAME_TYPES[activeGame.type]?.label;
  useEffect(() => {
    if (!focus || !root.current) return undefined;
    const element = root.current, previous = focusButton.current;
    const formats = element.querySelector('.experience-formats'); if (formats) formats.open = false;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Isolate the presented exercise from the cabinet for pointer, keyboard and AT.
    const siblings = [];
    for (let node = element; node.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) if (sibling !== node && sibling instanceof HTMLElement) {
        siblings.push([sibling, sibling.inert]); sibling.inert = true;
      }
      if (node.parentElement === document.body) break;
    }
    const controls = () => [...element.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"], summary')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
    const keydown = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setFocus(false); }
      if (e.key === 'Tab') {
        const items = controls(), first = items[0], last = items.at(-1);
        if (!first) { e.preventDefault(); element.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    focusButton.current?.focus();
    return () => { document.removeEventListener('keydown', keydown, true); document.body.style.overflow = priorOverflow; siblings.forEach(([el, inert]) => { el.inert = inert; }); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [focus]);
  return <><div ref={slot} className="experience-slot" />{createPortal(<section ref={root} tabIndex={-1} className={`game experience${mode === 'lesson' ? ' experience-lesson' : ''}${focus ? ' experience-focus' : ''}`} role={focus ? 'dialog' : undefined} aria-modal={focus || undefined} aria-labelledby={headingId}>
    <div className="experience-toolbar">
      <div className="experience-brand"><span className="experience-symbol" aria-hidden="true">L</span><span>LESSONFOLD <b>ПРАКТИКА</b></span></div>
      <button ref={focusButton} type="button" className="btn btn-secondary btn-sm" aria-pressed={focus} onClick={() => setFocus(v => !v)}>{focus ? 'Вернуться · Esc' : 'Развернуть упражнение'}</button>
    </div>
    <div className="experience-heading"><div><span className="game-type">{label}</span><h3 id={headingId}>{title || 'Время практики'}</h3></div>
      <div className="experience-modes" role="group" aria-label="Режим упражнения"><button type="button" aria-pressed={mode === 'self'} onClick={() => setMode('self')}>Самостоятельно</button><button type="button" aria-pressed={mode === 'lesson'} onClick={() => setMode('lesson')}>На уроке</button></div>
    </div>
    <p className="experience-instruction">{exerciseInstruction(activeGame)}</p>
    <p className="experience-mode-note">{mode === 'lesson' ? 'Обсуждайте ответы вслух и переключайте вопросы вместе.' : (allowRetry ? 'Отвечайте в своём темпе. После проверки можно вернуться к ошибкам.' : 'Отвечайте в своём темпе. Повторная попытка в этом задании недоступна.')}</p>
    {!onFinish && !initialResult && game.type === 'quick' && <details className="experience-formats"><summary>Другой формат тренировки</summary><label>Тот же набор слов<select className="input" value={activeGame.template} onChange={e => { setTemplate(e.target.value); setRound(r => r + 1); }}>{Object.entries(QUICK_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></label><span className="small muted">Смена формата начинает новую тренировку. Исходный материал не изменяется.</span></details>}
    <Round key={`${round}-${key}-${template}`} game={activeGame} onFinish={onFinish} footer={footer} draftKey={draftKey} initialAnswers={round === 0 ? initialAnswers : undefined} initialResult={round === 0 ? initialResult : undefined} onDraft={onDraft} allowRetry={allowRetry} onRetry={() => { if (draftKey) clearDraft(draftKey); setRound(r => r + 1); }} />
  </section>, host)}</>;
}

// Ответы листа с заданиями сохраняются как черновик: ушли со страницы, вернулись и продолжили
const DRAFTABLE = new Set(['sheet', 'board']);
const QuickWithMatch = (p) => <QuickBoard {...p} MatchBoard={MatchBoard} />;
function Round({ game, onFinish, footer, onRetry, draftKey, initialAnswers, initialResult, onDraft, allowRetry, isPractice = false }) {
  const started = useRef(Date.now());
  const useDraft = Boolean(draftKey && onFinish && DRAFTABLE.has(game.type));
  const [restored] = useState(() => (useDraft ? readDraft(draftKey) : null));
  const [answers, setAnswersRaw] = useState(() => initialAnswers || restored?.value || {});
  useEffect(() => { onDraft?.(answers); }, [answers, onDraft]);
  const setAnswers = (next) => setAnswersRaw((prev) => {
    const value = typeof next === 'function' ? next(prev) : next;
    if (useDraft) writeDraft(draftKey, value);
    return value;
  });
  const [result, setResult] = useState(initialResult || null);
  useEffect(() => { if (initialResult) setResult(initialResult); }, [initialResult]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);
  const checked = Boolean(result);
  const [practice, setPractice] = useState(null);
  const [practiceRound, setPracticeRound] = useState(0);
  const returnButton = useRef(null), practiceButton = useRef(null), resultPanel = useRef(null);
  const progress = exerciseProgress(game, answers);
  const focused = checked && allowRetry && !isPractice && !saving && !saveError ? buildMistakePractice(game, result) : null;
  useEffect(() => { if (practice) returnButton.current?.focus(); }, [practice]);

  const Board = { match: MatchBoard, order: OrderBoard, gaps: GapsBoard, groups: GroupsBoard, sheet: SheetBoard, board: BoardBoard, quick: QuickWithMatch }[game.type];
  if (!Board) return null;

  const check = async (confirmed = false) => {
    if (saving) return;
    if (!result && progress && progress.done < progress.total && !confirmed) { setConfirmIncomplete(true); return; }
    setConfirmIncomplete(false);
    setSaveError('');
    const r = grade(game, answers);
    setResult(r);
    requestAnimationFrame(() => resultPanel.current?.focus({ preventScroll: true }));
    if (onFinish) {
      setSaving(true);
      try {
        const saved = await onFinish(answers, r, Math.round((Date.now() - started.current) / 1000));
        if (saved?.result) setResult(saved.result);
        if (useDraft) clearDraft(draftKey);
      } catch (err) {
        setSaveError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  if (practice) return <div className="experience-practice">
    <div className="experience-practice-head"><div><b>Работа над ошибками</b><p className="small muted">Отдельная тренировка без таймера. Исходная оценка не изменяется.</p></div><button ref={returnButton} type="button" className="btn btn-secondary btn-sm" onClick={() => { setPractice(null); requestAnimationFrame(() => practiceButton.current?.focus()); }}>К исходному результату</button></div>
    <p className="experience-instruction">{exerciseInstruction(practice)}</p>
    <Round key={practiceRound} game={practice} allowRetry isPractice onRetry={() => setPracticeRound(r => r + 1)} />
  </div>;

  return (
    <div className="experience-round">
      <div className="game-head">
<span className="experience-step">{checked ? 'Разбор результата' : 'Ваш прогресс'}</span>
        {!checked && <span className="small muted">{progressText(game, answers)}</span>}
      </div>

      {progress && !checked && <div className="experience-progress" role="progressbar" aria-label="Ответы заполнены" aria-valuemin={0} aria-valuemax={progress.total || 1} aria-valuenow={progress.done}><span style={{ width: `${progress.percent}%` }} /></div>}
      {restored && !checked && <div className="small muted" style={{ marginBottom: 8 }}>Продолжаем с того места, где вы остановились.</div>}
      <Board game={game} answers={answers} setAnswers={setAnswers} result={result} />

      {checked ? (
        <div ref={resultPanel} tabIndex={-1} className={`game-result ${result.score === 100 ? 'perfect' : ''}`}>
          <div role="status">
            <div className="experience-step">{isPractice ? 'Результат тренировки' : game.type === 'sheet' && game.blocks.some(b => b.t === 'write') ? 'Автопроверка требований · не оценка текста' : 'Результат попытки'}</div>
            <div className="game-score num">{result.total ? `${result.correct} из ${result.total}` : 'Отправлено'}</div>
            <div className="small">
              {!result.total ? '' : result.score === 100 ? (game.type === 'quick' && game.template === 'flip' ? 'Вы отметили все карточки как знакомые.' : 'Всё верно!') : result.score >= 70 ? 'Хорошо, ошибки отмечены.' : 'Посмотрите ошибки и попробуйте ещё раз.'}
              {result.manual ? (onFinish ? ' Развёрнутые и устные ответы проверит преподаватель.' : ' Текст и устные ответы требуют проверки преподавателя. В этой тренировке они не отправляются.') : ''}
              {game.type === 'quick' && game.template === 'flip' && ' Это самооценка, а не проверка знаний.'}
              {onFinish && (saving ? ' Сохраняем…' : saveError ? ` Не сохранилось: ${saveError}` : ' Результат сохранён.')}
            </div>
          </div>
          <div className="experience-result-actions">
          {focused && <button ref={practiceButton} type="button" className="btn btn-sm" onClick={() => { setPracticeRound(0); setPractice(focused); }}>Повторить ошибки</button>}
          {saveError && <button type="button" className="btn btn-sm" disabled={saving} onClick={() => check(true)}>Повторить отправку</button>}
          {allowRetry && <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onRetry}>Начать заново</button>}
          </div>
        </div>
      ) : (
        <div className="game-foot">
          <button type="button" className="btn" disabled={saving} onClick={() => check()}>{game.type === 'sheet' || game.type === 'board' ? 'Сдать и проверить' : 'Проверить'}</button>
          {!onFinish && <span className="small muted">Тренировка · без сохранения оценки</span>}
        </div>
      )}
      {confirmIncomplete && !checked && <div className="experience-incomplete" role="alert"><p>Заполнено {progress.done} из {progress.total}. Пустые ответы будут отмечены как ошибки.</p><div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmIncomplete(false)}>Продолжить решать</button><button type="button" className="btn btn-sm" onClick={() => check(true)}>Всё равно проверить</button></div></div>}
      <div className="experience-aux">{footer}</div>
    </div>
  );
}

function progressText(game, answers) {
  if (game.type === 'match') return `Соединено ${Object.keys(answers.pairs || {}).length} из ${game.pairs.length}`;
  if (game.type === 'order') return `Собрано ${(answers.sentences || []).filter((s, i) => s?.length === tokenize(game.sentences[i]).length).length} из ${game.sentences.length}`;
  if (game.type === 'gaps') return `Заполнено ${(answers.gaps || []).filter(Boolean).length} из ${parseGaps(game.text).gaps.length}`;
  if (game.type === 'sheet') return sheetProgress(game, answers);
  if (game.type === 'board') return boardProgress(game, answers);
  if (game.type === 'quick') return quickProgress(game, answers);
  if (game.type === 'groups') {
    const total = game.groups.reduce((n, g) => n + g.items.length, 0);
    return `Разложено ${Object.keys(answers.items || {}).length} из ${total}`;
  }
  return '';
}

const Mark = ({ ok }) => (
  <span className={`mark ${ok ? 'ok' : 'bad'}`} aria-label={ok ? 'Верно' : 'Ошибка'}>
    <Icon name={ok ? 'check' : 'close'} size={14} />
  </span>
);

/* ============================================================
   Найди пару
   ============================================================ */
const PAIR_TINTS = ['#e7f1ee', '#f6efe1', '#e8eef8', '#f3e8f1', '#eef3e3', '#fbeee8', '#e9f2f6', '#f1efe6'];

function MatchBoard({ game, answers, setAnswers, result }) {
  const leftOrder = useMemo(() => shuffle(game.pairs.map((_, i) => i)), [game]);
  const rightOrder = useMemo(() => shuffleChanged(game.pairs.map((_, i) => i)), [game]);
  const [selected, setSelected] = useState(null);
  const pairs = answers.pairs || {};
  const checked = Boolean(result);
  // На какой левый элемент указывает правый
  const owner = Object.fromEntries(Object.entries(pairs).map(([l, r]) => [r, Number(l)]));
  const tint = (leftIdx) => PAIR_TINTS[leftOrder.indexOf(leftIdx) % PAIR_TINTS.length];

  const pickLeft = (i) => {
    if (checked) return;
    if (pairs[i] !== undefined) {
      const next = { ...pairs };
      delete next[i];
      setAnswers({ ...answers, pairs: next });
      setSelected(i);
      return;
    }
    setSelected(selected === i ? null : i);
  };
  const pickRight = (j) => {
    if (checked || selected === null) return;
    const next = { ...pairs };
    if (owner[j] !== undefined) delete next[owner[j]];
    next[selected] = j;
    setAnswers({ ...answers, pairs: next });
    setSelected(null);
  };

  return (
    <div className="match-grid">
      <div className="match-col">
        {leftOrder.map((i) => {
          const linked = pairs[i] !== undefined;
          const d = result?.details[i];
          return (
            <button type="button" key={i} onClick={() => pickLeft(i)}
              aria-pressed={selected === i || linked} className={`card-btn ${selected === i ? 'on' : ''} ${d ? (d.ok ? 'ok' : 'bad') : ''}`}
              style={linked && !d ? { background: tint(i), borderColor: 'transparent' } : undefined}>
              <span>{game.pairs[i].a}</span>
              {d && <Mark ok={d.ok} />}
              {d && !d.ok && <span className="expected">→ {d.expected}</span>}
            </button>
          );
        })}
      </div>
      <div className="match-col">
        {rightOrder.map((j) => {
          const by = owner[j];
          return (
            <button type="button" key={j} onClick={() => pickRight(j)} disabled={checked}
              className={`card-btn ${selected !== null && !checked ? 'target' : ''}`}
              style={by !== undefined ? { background: tint(by), borderColor: 'transparent' } : undefined}>
              <span>{game.pairs[j].b}</span>
            </button>
          );
        })}
      </div>
      {!checked && <p className="small muted match-hint">Нажмите слово слева, затем подходящее справа. Чтобы перевыбрать, нажмите слово слева ещё раз.</p>}
    </div>
  );
}

/* ============================================================
   Собери предложение
   ============================================================ */
function OrderBoard({ game, answers, setAnswers, result }) {
  // Для каждого предложения — перемешанные слова с уникальными id
  const pools = useMemo(
    () => game.sentences.map((s) => shuffleChanged(tokenize(s).map((w, k) => ({ id: k, w })), (a, b) => a.w === b.w)),
    [game]
  );
  const [built, setBuilt] = useState(() => game.sentences.map((_, i) => {
    const unused = [...pools[i]];
    return (answers.sentences?.[i] || []).map(w => { const n = unused.findIndex(t => t.w === w); return n < 0 ? null : unused.splice(n, 1)[0].id; }).filter(n => n !== null);
  }));
  const checked = Boolean(result);

  const update = (i, ids) => {
    const nextBuilt = built.map((b, k) => (k === i ? ids : b));
    setBuilt(nextBuilt);
    setAnswers({
      ...answers,
      sentences: nextBuilt.map((b, k) => b.map((id) => pools[k].find((t) => t.id === id).w)),
    });
  };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {game.sentences.map((s, i) => {
        const d = result?.details[i];
        const used = new Set(built[i]);
        return (
          <div key={i} className={`order-card ${d ? (d.ok ? 'ok' : 'bad') : ''}`}>
            <div className="order-line">
              <span className="order-num">{i + 1}</span>
              <div className="order-built">
                {!built[i].length && <span className="muted small">Нажимайте слова по порядку</span>}
                {built[i].map((id) => (
                  <button type="button" key={id} className="chip on" disabled={checked}
                    onClick={() => update(i, built[i].filter((x) => x !== id))}>
                    {pools[i].find((t) => t.id === id).w}
                  </button>
                ))}
              </div>
              {d && <Mark ok={d.ok} />}
            </div>
            {!checked && (
              <div className="order-pool">
                {pools[i].map((t) => (
                  <button type="button" key={t.id} className="chip" disabled={used.has(t.id)} style={used.has(t.id) ? { visibility: 'hidden' } : undefined}
                    onClick={() => update(i, [...built[i], t.id])}>
                    {t.w}
                  </button>
                ))}
              </div>
            )}
            {d && !d.ok && <div className="expected">Правильно: {d.expected}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Вставь пропуск
   ============================================================ */
function GapsBoard({ game, answers, setAnswers, result }) {
  const { parts, gaps } = useMemo(() => parseGaps(game.text), [game]);
  const bank = useMemo(
    () => (game.mode === 'bank' ? shuffle([...gaps.map((g) => g[0]), ...(game.distractors || [])].map((w, id) => ({ id, w }))) : []),
    [game, gaps]
  );
  const [slots, setSlots] = useState(() => { const unused = [...bank]; return gaps.map((_, i) => { const n = unused.findIndex(b => b.w === answers.gaps?.[i]); return n < 0 ? null : unused.splice(n, 1)[0].id; }); });
  const [selected, setSelected] = useState(null);
  const values = answers.gaps || [];
  const checked = Boolean(result);

  const setValue = (i, v) => {
    const next = gaps.map((_, k) => (k === i ? v : values[k] ?? ''));
    setAnswers({ ...answers, gaps: next });
  };

  const tapSlot = (i) => {
    if (checked) return;
    if (slots[i] !== null) {
      const ns = slots.map((s, k) => (k === i ? null : s));
      setSlots(ns);
      setValue(i, '');
      return;
    }
    if (selected === null) return;
    const ns = slots.map((s, k) => (k === i ? selected : s));
    setSlots(ns);
    setValue(i, bank.find((b) => b.id === selected).w);
    setSelected(null);
  };
  const usedIds = new Set(slots.filter((s) => s !== null));

  return (
    <div>
      {game.mode === 'bank' && !checked && (
        <div className="gap-bank">
          {bank.map((b) => (
            <button type="button" key={b.id} className={`chip ${selected === b.id ? 'on' : ''}`} disabled={usedIds.has(b.id)}
              style={usedIds.has(b.id) ? { opacity: 0.3 } : undefined}
              onClick={() => setSelected(selected === b.id ? null : b.id)}>
              {b.w}
            </button>
          ))}
        </div>
      )}
      <div className="gap-text">
        {parts.map((p, i) => (
          <span key={i}>
            {p}
            {i < gaps.length && (() => {
              const d = result?.details[i];
              const cls = d ? (d.ok ? 'ok' : 'bad') : '';
              if (game.mode === 'bank') {
                return (
                  <button type="button" aria-label={`Пропуск ${i + 1}${values[i] ? `: ${values[i]}` : ''}`} className={`gap-slot ${cls} ${slots[i] !== null ? 'filled' : ''} ${selected !== null && !checked ? 'target' : ''}`} onClick={() => tapSlot(i)}>
                    {values[i] || ' '}
                  </button>
                );
              }
              const w = Math.max(4, ...gaps[i].map((g) => g.length)) + 1;
              return (
                <input className={`gap-input ${cls}`} value={values[i] || ''} disabled={checked} style={{ width: `${w}ch` }}
                  aria-label={`Пропуск ${i + 1}`} autoCapitalize="none" autoComplete="off" spellCheck="false"
                  onChange={(e) => setValue(i, e.target.value)} />
              );
            })()}
            {i < gaps.length && result && !result.details[i].ok && <span className="gap-fix">{result.details[i].expected}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Распредели по группам
   ============================================================ */
function GroupsBoard({ game, answers, setAnswers, result }) {
  const all = useMemo(
    () => shuffle(game.groups.flatMap((g, gi) => g.items.map((w, k) => ({ key: `${gi}-${k}`, w })))),
    [game]
  );
  const [selected, setSelected] = useState(null);
  const placed = answers.items || {};
  const checked = Boolean(result);
  const detailOf = (key) => {
    if (!result) return null;
    let n = 0;
    for (let gi = 0; gi < game.groups.length; gi++) {
      for (let k = 0; k < game.groups[gi].items.length; k++) {
        if (`${gi}-${k}` === key) return result.details[n];
        n++;
      }
    }
    return null;
  };

  const place = (gi) => {
    if (checked || selected === null) return;
    setAnswers({ ...answers, items: { ...placed, [selected]: gi } });
    setSelected(null);
  };
  const unplace = (key) => {
    if (checked) return;
    const next = { ...placed };
    delete next[key];
    setAnswers({ ...answers, items: next });
    setSelected(key);
  };

  const pool = all.filter((x) => placed[x.key] === undefined);

  return (
    <div>
      {pool.length > 0 && (
        <div className="gap-bank">
          {pool.map((x) => (
            <button type="button" key={x.key} disabled={checked}
              className={`chip ${selected === x.key ? 'on' : ''} ${checked ? 'bad' : ''}`}
              onClick={() => setSelected(selected === x.key ? null : x.key)}>
              {x.w}{checked ? ` → ${detailOf(x.key)?.expected}` : ''}
            </button>
          ))}
        </div>
      )}
      <div className="buckets" style={{ gridTemplateColumns: `repeat(${Math.min(game.groups.length, 3)}, minmax(0, 1fr))` }}>
        {game.groups.map((g, gi) => (
          <div key={gi} className={`bucket ${selected !== null && !checked ? 'target' : ''}`} onClick={() => place(gi)} role="group" aria-label={`Группа: ${g.name}`}>
            <button type="button" className="bucket-name bucket-target" disabled={checked || selected === null} aria-label={`Поместить в группу: ${g.name}`} onClick={e => { e.stopPropagation(); place(gi); }}>{g.name}</button>
            <div className="bucket-items">
              {all.filter((x) => placed[x.key] === gi).map((x) => {
                const d = detailOf(x.key);
                return (
                  <button type="button" key={x.key} className={`chip on ${d ? (d.ok ? 'ok' : 'bad') : ''}`}
                    onClick={(e) => { e.stopPropagation(); unplace(x.key); }} disabled={checked}
                    title={d && !d.ok ? `Правильно: ${d.expected}` : undefined}>
                    {x.w}{d && !d.ok ? ` → ${d.expected}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!checked && <p className="small muted" style={{ marginTop: 10 }}>Нажмите слово, затем группу. Чтобы убрать слово из группы, нажмите на него.</p>}
    </div>
  );
}
