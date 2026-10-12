// games/Players.jsx — прохождение упражнений
// Управление нажатиями (без перетаскивания), чтобы одинаково работало на телефоне и компьютере:
// выбрать карточку → нажать, куда её поставить.
import { useMemo, useRef, useState } from 'react';
import { GAME_TYPES, grade, parseGaps, shuffle, shuffleChanged, tokenize } from './logic';
import { Icon } from '../ui';

/* ============================================================
   Обёртка: заголовок, кнопка «Проверить», итог, «Ещё раз»
   onFinish(answers, result, durationSec) — сохранить результат (если не передан — режим тренировки)
   ============================================================ */
export default function GamePlayer({ game, onFinish, footer }) {
  const [round, setRound] = useState(0);
  // Страница периодически обновляет данные — без этого слова перемешивались бы заново посреди игры
  const key = JSON.stringify(game);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => game, [key]);
  return <Round key={`${round}-${key.length}`} game={stable} onFinish={onFinish} footer={footer} onRetry={() => setRound((r) => r + 1)} />;
}

function Round({ game, onFinish, footer, onRetry }) {
  const started = useRef(Date.now());
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const checked = Boolean(result);

  const Board = { match: MatchBoard, order: OrderBoard, gaps: GapsBoard, groups: GroupsBoard }[game.type];
  if (!Board) return null;

  const check = async () => {
    const r = grade(game, answers);
    setResult(r);
    if (onFinish) {
      setSaving(true);
      try {
        await onFinish(answers, r, Math.round((Date.now() - started.current) / 1000));
      } catch (err) {
        setSaveError(err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="game">
      <div className="game-head">
        <span className="game-type">{GAME_TYPES[game.type].label}</span>
        {!checked && <span className="small muted">{progressText(game, answers)}</span>}
      </div>

      <Board game={game} answers={answers} setAnswers={setAnswers} result={result} />

      {checked ? (
        <div className={`game-result ${result.score === 100 ? 'perfect' : ''}`}>
          <div>
            <div className="game-score num">{result.correct} из {result.total}</div>
            <div className="small">
              {result.score === 100 ? 'Всё верно!' : result.score >= 70 ? 'Хорошо, ошибки отмечены.' : 'Посмотрите ошибки и попробуйте ещё раз.'}
              {onFinish && (saving ? ' Сохраняем…' : saveError ? ` Не сохранилось: ${saveError}` : ' Результат сохранён.')}
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Ещё раз</button>
        </div>
      ) : (
        <div className="game-foot">
          <button type="button" className="btn" onClick={check}>Проверить</button>
          {!onFinish && <span className="small muted">Тренировка — результат не сохраняется</span>}
        </div>
      )}
      {footer}
    </div>
  );
}

function progressText(game, answers) {
  if (game.type === 'match') return `Соединено ${Object.keys(answers.pairs || {}).length} из ${game.pairs.length}`;
  if (game.type === 'order') return `Собрано ${(answers.sentences || []).filter((s, i) => s?.length === tokenize(game.sentences[i]).length).length} из ${game.sentences.length}`;
  if (game.type === 'gaps') return `Заполнено ${(answers.gaps || []).filter(Boolean).length} из ${parseGaps(game.text).gaps.length}`;
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
              className={`card-btn ${selected === i ? 'on' : ''} ${d ? (d.ok ? 'ok' : 'bad') : ''}`}
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
      {!checked && <p className="small muted match-hint">Нажмите слово слева, затем подходящее справа. Чтобы перевыбрать — нажмите слово слева ещё раз.</p>}
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
  const [built, setBuilt] = useState(() => game.sentences.map(() => []));
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
  const [slots, setSlots] = useState(() => gaps.map(() => null)); // id из банка для режима bank
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
                  <button type="button" className={`gap-slot ${cls} ${slots[i] !== null ? 'filled' : ''} ${selected !== null && !checked ? 'target' : ''}`} onClick={() => tapSlot(i)}>
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
          <div key={gi} className={`bucket ${selected !== null && !checked ? 'target' : ''}`} onClick={() => place(gi)}
            role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && place(gi)}>
            <div className="bucket-name">{g.name}</div>
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
      {!checked && <p className="small muted" style={{ marginTop: 10 }}>Нажмите слово, затем группу. Чтобы убрать слово из группы — нажмите на него.</p>}
    </div>
  );
}
