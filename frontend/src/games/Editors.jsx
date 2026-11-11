// games/Editors.jsx — конструктор упражнений
// Поля хранят «сырой» текст, а наверх отдаётся готовое упражнение — так удобно печатать и вставлять списки
import { useState } from 'react';
import { Field, Icon } from '../ui';
import { GAME_TYPES, SHEET_PRESETS, parseGaps } from './logic';
import { SheetEditor } from './Sheet';
import { BoardEditor, EMPTY_BOARD, cleanBoard } from './Board';
import { QuickEditor, QUICK_TEMPLATES, emptyQuick, cleanQuick } from './Quick';

export const EMPTY_GAME = {
  match: { type: 'match', pairs: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] },
  order: { type: 'order', sentences: [] },
  gaps: { type: 'gaps', text: '', mode: 'type', distractors: [] },
  groups: { type: 'groups', groups: [{ name: '', items: [] }, { name: '', items: [] }] },
  sheet: { type: 'sheet', blocks: [{ t: 'text', text: '' }] },
  board: EMPTY_BOARD,
  quick: emptyQuick('quiz'),
  ...Object.fromEntries(Object.keys(QUICK_TEMPLATES).map((t) => [`q_${t}`, emptyQuick(t)])),
  // Готовые листы: с примером внутри, его нужно заменить своим
  write: { type: 'sheet', blocks: [{ t: 'write', q: 'Write about your typical Monday (60–80 words).', min_words: 60, max_words: 80, min_sentences: 6,
    checks: [{ label: 'Наречия частоты: always, usually, often…', words: 'always|usually|often|sometimes|rarely|never', min: 3 }, { label: 'Слова порядка: first, then, after that…', words: 'first|then|next|after that|finally|later', min: 2 }],
    caps: true, stop: true, latin: true, starters: ['On Mondays I usually', 'After that,', 'My favourite part of Monday is'], model: '' }] },
  fix: { type: 'sheet', blocks: [{ t: 'fix', q: 'Find and correct 4 mistakes.', text: "My brother {go=goes} to school by bus. He {don't=doesn't} like Maths, but he {love=loves} Art. We {plays=play} football after school." }] },
  rewrite: { type: 'sheet', blocks: [
    { t: 'text', text: 'Make the sentences negative.' },
    { t: 'rewrite', q: '', src: 'She plays tennis.', a: "She doesn't play tennis.|She does not play tennis." },
    { t: 'rewrite', q: '', src: 'They live in London.', a: "They don't live in London.|They do not live in London." },
  ] },
  dictation: { type: 'sheet', blocks: [
    { t: 'text', text: 'Listen and write the sentences.' },
    { t: 'dictation', text: "I usually get up at seven o'clock." },
    { t: 'dictation', text: 'My sister never drinks coffee.' },
  ] },
};

// Выбор типа для нового упражнения
export function GameTypePicker({ onPick }) {
  return (
    <>
    <div className="section-title" style={{ marginBottom: 4 }}>Быстрые игры</div>
    <div className="small muted" style={{ marginBottom: 10 }}>Введите список слов или вопросов один раз, игру можно сменить потом</div>
    <div className="type-grid type-grid-quick" style={{ marginBottom: 18 }}>
      {Object.entries(QUICK_TEMPLATES).map(([k, t]) => (
        <button type="button" key={k} className="type-card" onClick={() => onPick(`q_${k}`)}>
          <span className="type-ill" aria-hidden="true">{t.ill}</span>
          <span className="list-title">{t.label}</span>
          <span className="list-sub">{t.hint}</span>
        </button>
      ))}
    </div>
    <div className="section-title" style={{ marginBottom: 10 }}>Другие задания</div>
    <div className="type-grid">
      {Object.entries({ ...GAME_TYPES, ...SHEET_PRESETS }).filter(([type]) => type !== 'quick').map(([type, t]) => (
        <button type="button" key={type} className="type-card" onClick={() => onPick(type)}>
          <span className="type-ill" aria-hidden="true">{ILLUSTRATION[type]}</span>
          <span className="list-title">{t.label}</span>
          <span className="list-sub">{t.hint}</span>
        </button>
      ))}
    </div>
    </>
  );
}

const ILLUSTRATION = {
  match: (<><i>cat</i><b>-</b><i>кот</i></>),
  order: (<><i>to</i><i>I</i><i>go</i></>),
  gaps: (<><i>She</i><u /><i>here</i></>),
  groups: (<><i>go</i><i>play</i><b>|</b><i>see</i></>),
  sheet: (<><i>1.</i><u /><i>фото</i></>),
  board: (<><i>A</i><b>✥</b><u /></>),
  write: (<><i>Dear</i><u /><b>✓</b></>),
  fix: (<><i>He</i><s>go</s><i>goes</i></>),
  rewrite: (<><i>He</i><b>→</b><i>doesn't</i></>),
  dictation: (<><b>♪</b><u /><u /></>),
};

export default function GameEditor({ game, onChange, itemId }) {
  if (game.type === 'quick') return <QuickEditor game={game} onChange={onChange} />;
  if (game.type === 'board') return <BoardEditor game={game} onChange={onChange} itemId={itemId} />;
  if (game.type === 'sheet') return <SheetEditor game={game} onChange={onChange} itemId={itemId} />;
  if (game.type === 'match') return <MatchEditor game={game} onChange={onChange} />;
  if (game.type === 'order') return <OrderEditor game={game} onChange={onChange} />;
  if (game.type === 'gaps') return <GapsEditor game={game} onChange={onChange} />;
  if (game.type === 'groups') return <GroupsEditor game={game} onChange={onChange} />;
  return null;
}

/* ---------- Пары ---------- */
function MatchEditor({ game, onChange }) {
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const set = (pairs) => onChange({ ...game, pairs });
  const setPair = (i, patch) => set(game.pairs.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  // «claimant - истец» / «claimant — истец» / через Tab
  const importBulk = () => {
    const rows = bulkText
      .split('\n')
      .map((l) => l.split(/\t| [-—–:] /))
      .filter((r) => r.length >= 2 && r[0].trim() && r[1].trim())
      .map((r) => ({ a: r[0].trim(), b: r.slice(1).join(' - ').trim() }));
    if (rows.length) set([...game.pairs.filter((p) => p.a.trim() || p.b.trim()), ...rows]);
    setBulk(false);
    setBulkText('');
  };

  return (
    <div>
      <div className="pair-head small muted"><span>Слово / термин</span><span>Пара</span></div>
      {game.pairs.map((p, i) => (
        <div key={i} className="pair-row">
          <input className="input" value={p.a} onChange={(e) => setPair(i, { a: e.target.value })} placeholder="claimant" aria-label={`Слово ${i + 1}`} />
          <input className="input" value={p.b} onChange={(e) => setPair(i, { b: e.target.value })} placeholder="истец" aria-label={`Пара ${i + 1}`} />
          <button type="button" className="icon-btn" aria-label="Убрать пару" disabled={game.pairs.length <= 2}
            onClick={() => set(game.pairs.filter((_, k) => k !== i))}><Icon name="close" size={16} /></button>
        </div>
      ))}
      <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => set([...game.pairs, { a: '', b: '' }])} disabled={game.pairs.length >= 24}>
          <Icon name="plus" /> Пара
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setBulk(!bulk)}>Вставить списком</button>
      </div>
      {bulk && (
        <div className="form" style={{ marginTop: 10 }}>
          <Field label="Каждая пара с новой строки" hint="Через дефис или из таблицы (Excel, Google Таблицы)">
            <textarea className="textarea" value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'claimant - истец\ndefendant - ответчик'} autoFocus />
          </Field>
          <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={importBulk}>Добавить</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Предложения ---------- */
function OrderEditor({ game, onChange }) {
  const [text, setText] = useState(game.sentences.join('\n'));
  const update = (v) => {
    setText(v);
    onChange({ ...game, sentences: v.split('\n').map((s) => s.trim()).filter(Boolean) });
  };
  return (
    <Field label="Предложения, каждое с новой строки" hint={`Слова перемешаются автоматически. Предложений: ${game.sentences.length}`}>
      <textarea className="textarea" style={{ minHeight: 160 }} value={text} onChange={(e) => update(e.target.value)}
        placeholder={'I have never been to London.\nShe is reading a book now.'} />
    </Field>
  );
}

/* ---------- Пропуски ---------- */
function GapsEditor({ game, onChange }) {
  const [distractors, setDistractors] = useState((game.distractors || []).join(', '));
  const n = parseGaps(game.text).gaps.length;
  return (
    <div className="form">
      <Field label="Текст" hint="Пропуск обозначается словом в квадратных скобках: [since]. Несколько верных вариантов пишутся через черту: [has|'s]">
        <textarea className="textarea" style={{ minHeight: 160 }} value={game.text} onChange={(e) => onChange({ ...game, text: e.target.value })}
          placeholder={"She [has|'s] lived here [since] 2010. We [went] to the cinema yesterday."} />
      </Field>
      <div className="small" style={{ marginTop: -8, color: n ? 'var(--green-ink)' : 'var(--muted)' }}>Пропусков: {n}</div>
      <Field label="Как отвечать">
        <div className="row wrap" style={{ gap: 6 }}>
          <button type="button" className={`btn btn-sm ${game.mode === 'type' ? '' : 'btn-secondary'}`} onClick={() => onChange({ ...game, mode: 'type' })}>Вписать слово</button>
          <button type="button" className={`btn btn-sm ${game.mode === 'bank' ? '' : 'btn-secondary'}`} onClick={() => onChange({ ...game, mode: 'bank' })}>Выбрать из слов</button>
        </div>
      </Field>
      {game.mode === 'bank' && (
        <Field label="Лишние слова" hint="Через запятую, добавятся к правильным, чтобы было из чего выбирать">
          <input className="input" value={distractors} placeholder="for, during, ago"
            onChange={(e) => {
              setDistractors(e.target.value);
              onChange({ ...game, distractors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
            }} />
        </Field>
      )}
    </div>
  );
}

/* ---------- Группы ---------- */
function GroupsEditor({ game, onChange }) {
  const [texts, setTexts] = useState(() => game.groups.map((g) => g.items.join('\n')));
  const setGroups = (groups) => onChange({ ...game, groups });
  const setName = (i, name) => setGroups(game.groups.map((g, k) => (k === i ? { ...g, name } : g)));
  const setItems = (i, v) => {
    setTexts(texts.map((t, k) => (k === i ? v : t)));
    setGroups(game.groups.map((g, k) => (k === i ? { ...g, items: v.split('\n').map((s) => s.trim()).filter(Boolean) } : g)));
  };
  const add = () => {
    setTexts([...texts, '']);
    setGroups([...game.groups, { name: '', items: [] }]);
  };
  const remove = (i) => {
    setTexts(texts.filter((_, k) => k !== i));
    setGroups(game.groups.filter((_, k) => k !== i));
  };

  return (
    <div>
      <div className="group-edit-grid">
        {game.groups.map((g, i) => (
          <div key={i} className="q-edit" style={{ marginTop: 0 }}>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              <input className="input" style={{ height: 38, fontWeight: 600 }} value={g.name} placeholder={i === 0 ? 'Regular' : 'Irregular'}
                onChange={(e) => setName(i, e.target.value)} aria-label={`Группа ${i + 1}`} />
              {game.groups.length > 2 && (
                <button type="button" className="icon-btn" aria-label="Убрать группу" onClick={() => remove(i)}><Icon name="close" size={16} /></button>
              )}
            </div>
            <textarea className="textarea" style={{ minHeight: 120 }} value={texts[i]} onChange={(e) => setItems(i, e.target.value)}
              placeholder={i === 0 ? 'play\nwork\nwatch' : 'go\nsee\nbuy'} aria-label={`Слова группы ${i + 1}`} />
            <div className="small muted" style={{ marginTop: 4 }}>Слов: {g.items.length}</div>
          </div>
        ))}
      </div>
      {game.groups.length < 5 && (
        <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={add}><Icon name="plus" /> Группа</button>
      )}
    </div>
  );
}

// Перед сохранением: убрать пустые строки
export function cleanGame(game) {
  if (game.type === 'match') return { ...game, pairs: game.pairs.map((p) => ({ a: p.a.trim(), b: p.b.trim() })).filter((p) => p.a && p.b) };
  if (game.type === 'groups') return { ...game, groups: game.groups.map((g) => ({ name: g.name.trim(), items: g.items })).filter((g) => g.name) };
  if (game.type === 'board') return cleanBoard(game);
  if (game.type === 'quick') return cleanQuick(game);
  if (game.type === 'sheet') {
    const blocks = game.blocks
      .map((b) => {
        if (b.t === 'write') return { ...b, checks: (b.checks || []).map((c) => ({ ...c, label: c.label.trim(), words: c.words.trim() })).filter((c) => c.words), starters: (b.starters || []).map((x) => x.trim()).filter(Boolean) };
        if (b.t !== 'choice') return b;
        const keep = b.options.map((o, j) => ({ o: o.trim(), j })).filter((x) => x.o);
        const correct = Math.max(0, keep.findIndex((x) => x.j === b.correct));
        return { ...b, options: keep.map((x) => x.o), correct };
      })
      .filter((b) => !(b.t === 'gaps' && !b.text.trim()) && !(b.t === 'dictation' && !b.text.trim()) && !(b.t === 'rewrite' && !b.a.trim()) && !(b.t === 'fix' && !/\{[^}=]+=[^}]*\}/.test(b.text)));
    return { ...game, blocks: blocks.length ? blocks : [{ t: 'text', text: '' }] };
  }
  return game;
}
