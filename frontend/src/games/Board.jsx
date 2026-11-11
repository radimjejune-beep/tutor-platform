// games/Board.jsx: конструктор заданий. Преподаватель сам расставляет на холсте детали
// (текст, поле, список, галочка, карточка и место для неё, картинка, аудио), ученик проходит, сайт проверяет.
// Координаты и размеры в процентах холста, шрифт масштабируется вместе с шириной.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Field, Icon } from '../ui';
import { api } from '../api';
import { FileImage, useFileUrl } from './Sheet';
import { alts, boardZoneName, shuffle } from './logic';
import { speak, canSpeak } from '../voice';

export const BOARD_PARTS = {
  text: { label: 'Текст', icon: 'note', w: 40, h: 8, hint: 'Инструкция, вопрос, предложение' },
  input: { label: 'Поле', icon: 'edit', w: 18, h: 6, hint: 'Ученик вписывает ответ' },
  select: { label: 'Список', icon: 'list', w: 18, h: 6, hint: 'Выбрать один вариант' },
  check: { label: 'Галочка', icon: 'check', w: 24, h: 6, hint: 'Отметить верные' },
  chip: { label: 'Карточка', icon: 'cards', w: 16, h: 6, hint: 'Ученик перетаскивает' },
  zone: { label: 'Место', icon: 'grid', w: 22, h: 12, hint: 'Сюда кладут карточки' },
  image: { label: 'Картинка', icon: 'board', w: 30, h: 30, hint: 'Фото или рисунок' },
  audio: { label: 'Аудио', icon: 'sound', w: 8, h: 8, hint: 'Ваша запись или озвучка текста' },
};
const PAPERS = [['white', 'Белый'], ['paper', 'Тетрадь'], ['lines', 'В линейку'], ['grid', 'В клетку'], ['dark', 'Доска']];
const RATIOS = [[4 / 3, 'Альбом 4:3'], [16 / 9, 'Широкий 16:9'], [1, 'Квадрат'], [0.707, 'Лист A4']];
const COLORS = [['ink', 'Чёрный'], ['pen', 'Красный'], ['blue', 'Синий'], ['green', 'Зелёный'], ['white', 'Белый']];
const BGS = [['none', 'Без фона'], ['white', 'Белый'], ['yellow', 'Жёлтый'], ['pink', 'Розовый'], ['blue', 'Голубой'], ['green', 'Зелёный'], ['dark', 'Тёмный']];

const uid = () => Math.random().toString(36).slice(2, 9);
const round = (v) => Math.round(v * 2) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const EMPTY_BOARD = { type: 'board', ratio: 4 / 3, paper: 'white', bg: null, elements: [
  { id: 'b1', k: 'text', x: 5, y: 5, w: 90, h: 9, text: 'Drag the words to the right box.', size: 26, bold: true },
  { id: 'b2', k: 'zone', x: 6, y: 22, w: 40, h: 34, text: 'Animals' },
  { id: 'b3', k: 'zone', x: 54, y: 22, w: 40, h: 34, text: 'Food' },
  { id: 'b4', k: 'chip', x: 8, y: 66, w: 16, h: 7, text: 'cat', zone: 'b2' },
  { id: 'b5', k: 'chip', x: 28, y: 66, w: 16, h: 7, text: 'bread', zone: 'b3' },
  { id: 'b6', k: 'chip', x: 48, y: 66, w: 16, h: 7, text: 'horse', zone: 'b2' },
  { id: 'b7', k: 'chip', x: 68, y: 66, w: 16, h: 7, text: 'cheese', zone: 'b3' },
  { id: 'b8', k: 'text', x: 5, y: 80, w: 30, h: 7, text: 'My favourite animal is', size: 18 },
  { id: 'b9', k: 'input', x: 36, y: 80, w: 20, h: 7, a: '', text: '' },
] };

// **жирный** в тексте детали
function Rich({ text }) {
  return String(text || '').split('\n').map((line, j) => (
    <Fragment key={j}>{j > 0 && <br />}{line.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>))}</Fragment>
  ));
}

function AudioButton({ el, live }) {
  const url = useFileUrl(el.audio || null);
  const play = () => {
    if (!live) return;
    if (url) { const a = new Audio(url); a.play().catch(() => {}); } else if (el.say && canSpeak()) speak(el.say);
  };
  return <button type="button" className="bd-audio" onClick={play} aria-label={el.say ? `Послушать: ${el.say}` : 'Послушать'} tabIndex={live ? 0 : -1}><Icon name="play" size={20} /></button>;
}

const boxStyle = (el) => ({ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%` });
const textStyle = (el) => ({ fontSize: `calc(${el.size || 18} / 800 * 100cqw)`, textAlign: el.align || undefined, fontWeight: el.bold ? 600 : undefined });
const cls = (el) => `bd-el bd-k-${el.k}${el.color ? ` c-${el.color}` : ''}${el.bg && el.bg !== 'none' ? ` bg-${el.bg}` : ''}`;

function Canvas({ game, children, innerRef, ...rest }) {
  return (
    <div className="bd-wrap">
      <div className={`bd-canvas paper-${game.paper || 'white'}`} style={{ aspectRatio: String(game.ratio || 4 / 3) }} ref={innerRef} {...rest}>
        {game.bg && <FileImage id={game.bg} className="bd-bg" alt="" draggable={false} />}
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   Прохождение
   ============================================================ */
export function BoardBoard({ game, answers, setAnswers, result }) {
  const e = answers.e || {};
  const checked = Boolean(result);
  const det = useMemo(() => Object.fromEntries((result?.details || []).filter((d) => d.el).map((d) => [d.el, d])), [result]);
  const set = (id, v) => setAnswers((prev) => ({ ...prev, e: { ...(prev.e || {}), [id]: v } }));
  const [pick, setPick] = useState(null); // карточка, выбранная нажатием
  const [drag, setDrag] = useState(null);
  const canvas = useRef(null);
  const zones = game.elements.filter((x) => x.k === 'zone');
  const options = useMemo(() => Object.fromEntries(game.elements.filter((x) => x.k === 'select').map((x) => [x.id, x.options.map((o, i) => ({ o, i }))])), [game]);
  const order = useMemo(() => shuffle(game.elements.filter((x) => x.k === 'chip').map((x) => x.id)), [game]);
  const mark = (el) => (checked && det[el.id] ? (det[el.id].ok ? ' ok' : det[el.id].ok === false ? ' bad' : '') : '');

  const place = (chipId, zoneId) => { set(chipId, zoneId || null); setPick(null); };
  const down = (ev, chip) => {
    if (checked || ev.button > 0) return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    setDrag({ id: chip.id, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0, moved: false });
  };
  const move = (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x0; const dy = ev.clientY - drag.y0;
    setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) + Math.abs(dy) > 6 });
  };
  const up = (ev) => {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (!d.moved) { setPick(pick === d.id ? null : d.id); return; }
    const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.dataset?.zone);
    place(d.id, under ? under.dataset.zone : null);
  };

  const chipNode = (chip, inZone) => (
    <button key={chip.id} type="button" className={`bd-chip-btn${pick === chip.id ? ' picked' : ''}${drag?.id === chip.id ? ' dragging' : ''}${mark(chip)}`}
      style={{ ...(inZone ? {} : boxStyle(chip)), ...textStyle(chip), ...(drag?.id === chip.id ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : {}) }}
      onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => down(ev, chip)} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPick(pick === chip.id ? null : chip.id); } }}
      aria-pressed={pick === chip.id} aria-label={`Карточка ${chip.text}${inZone ? `, лежит: ${boardZoneName(game, e[chip.id])}` : ''}`}>
      {chip.text}
    </button>
  );

  return (
    <div className="bd-play">
      {pick && <div className="small muted bd-tip">Нажмите на место, куда положить «{game.elements.find((x) => x.id === pick)?.text}». Нажмите на карточку ещё раз, чтобы отменить.</div>}
      <Canvas game={game} innerRef={canvas}>
        {game.elements.map((el) => {
          if (el.k === 'chip') return e[el.id] && zones.some((z) => z.id === e[el.id]) ? null : <div key={el.id} className="bd-chip-slot">{chipNode(el, false)}</div>;
          const st = { ...boxStyle(el), ...textStyle(el) };
          if (el.k === 'text') return <div key={el.id} className={cls(el)} style={st}><div className="bd-text"><Rich text={el.text} /></div></div>;
          if (el.k === 'image') return <div key={el.id} className={cls(el)} style={st}>{el.image ? <FileImage id={el.image} alt={el.text || ''} draggable={false} /> : null}</div>;
          if (el.k === 'audio') return <div key={el.id} className={cls(el)} style={st}><AudioButton el={el} live /></div>;
          if (el.k === 'input') return (
            <div key={el.id} className={cls(el) + mark(el)} style={st}>
              <input className="bd-input" value={e[el.id] || ''} disabled={checked} aria-label={el.text || 'Ответ'} onChange={(ev) => set(el.id, ev.target.value)} autoComplete="off" spellCheck={false} />
              {checked && det[el.id]?.ok === false && <span className="bd-right">{alts(el.a)[0]}</span>}
            </div>
          );
          if (el.k === 'select') return (
            <div key={el.id} className={cls(el) + mark(el)} style={st}>
              <select className="bd-select" value={e[el.id] ?? ''} disabled={checked} aria-label="Выберите вариант" onChange={(ev) => set(el.id, ev.target.value === '' ? null : Number(ev.target.value))}>
                <option value="">…</option>
                {options[el.id].map(({ o, i }) => <option key={i} value={i}>{o}</option>)}
              </select>
              {checked && det[el.id]?.ok === false && <span className="bd-right">{el.options[el.correct || 0]}</span>}
            </div>
          );
          if (el.k === 'check') return (
            <label key={el.id} className={cls(el) + mark(el)} style={st}>
              <input type="checkbox" checked={Boolean(e[el.id])} disabled={checked} onChange={(ev) => set(el.id, ev.target.checked)} />
              {el.text && <span><Rich text={el.text} /></span>}
            </label>
          );
          if (el.k === 'zone') {
            const inside = order.map((id) => game.elements.find((x) => x.id === id)).filter((c) => e[c.id] === el.id);
            return (
              <div key={el.id} className={`${cls(el)}${pick ? ' armed' : ''}`} style={st} data-zone={el.id}
                role={pick ? 'button' : undefined} tabIndex={pick ? 0 : undefined}
                onClick={() => pick && place(pick, el.id)} onKeyDown={(ev) => { if (pick && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); place(pick, el.id); } }}>
                {el.text && <span className="bd-zone-label" data-zone={el.id}>{el.text}</span>}
                <div className="bd-zone-items" data-zone={el.id}>{inside.map((c) => chipNode(c, true))}</div>
              </div>
            );
          }
          return null;
        })}
      </Canvas>
      {!checked && game.elements.some((x) => x.k === 'chip') && <div className="small muted bd-tip">Карточки перетаскивайте мышкой или пальцем. Можно нажать на карточку, а потом на место.</div>}
    </div>
  );
}

export function boardProgress(game, answers) {
  const e = answers.e || {};
  const items = game.elements.filter((x) => ['input', 'select', 'chip'].includes(x.k));
  const done = items.filter((x) => e[x.id] !== undefined && e[x.id] !== null && e[x.id] !== '').length;
  return items.length ? `Готово ${done} из ${items.length}` : '';
}

/* ============================================================
   Редактор
   ============================================================ */
export function BoardEditor({ game, onChange, itemId }) {
  const [sel, setSel] = useState(null);
  const [op, setOp] = useState(null); // перетаскивание или изменение размера
  const [busy, setBusy] = useState('');
  const box = useRef(null);
  const els = game.elements;
  const cur = els.find((x) => x.id === sel) || null;
  const setEls = (next) => onChange({ ...game, elements: next });
  const patch = (id, p) => setEls(els.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const zones = els.filter((x) => x.k === 'zone');

  const add = (k, extra = {}) => {
    const d = BOARD_PARTS[k];
    const n = els.length % 6;
    const el = { id: uid(), k, x: 10 + n * 4, y: 12 + n * 5, w: d.w, h: d.h,
      ...(k === 'text' ? { text: 'Текст', size: 20 } : {}), ...(k === 'input' ? { a: '' } : {}),
      ...(k === 'select' ? { options: ['', ''], correct: 0 } : {}), ...(k === 'check' ? { text: '', on: true } : {}),
      ...(k === 'chip' ? { text: 'word', zone: zones[0]?.id || null } : {}), ...(k === 'zone' ? { text: '' } : {}), ...extra };
    setEls([...els, el]); setSel(el.id);
  };
  const del = (id) => setEls(els.filter((x) => x.id !== id).map((x) => (x.zone === id ? { ...x, zone: null } : x)));
  const dup = () => { if (!cur) return; const c = { ...JSON.parse(JSON.stringify(cur)), id: uid(), x: clamp(cur.x + 3, 0, 100 - cur.w), y: clamp(cur.y + 3, 0, 100 - cur.h) }; setEls([...els, c]); setSel(c.id); };
  const toFront = () => cur && setEls([...els.filter((x) => x.id !== cur.id), cur]);

  const pos = (ev) => { const r = box.current.getBoundingClientRect(); return { px: ((ev.clientX - r.left) / r.width) * 100, py: ((ev.clientY - r.top) / r.height) * 100 }; };
  const start = (ev, el, mode) => {
    ev.stopPropagation(); ev.preventDefault();
    box.current.setPointerCapture?.(ev.pointerId);
    setSel(el.id);
    setOp({ id: el.id, mode, ...pos(ev), el: { ...el } });
  };
  const move = (ev) => {
    if (!op) return;
    const p = pos(ev); const dx = p.px - op.px; const dy = p.py - op.py; const o = op.el;
    if (op.mode === 'move') patch(op.id, { x: round(clamp(o.x + dx, 0, 100 - o.w)), y: round(clamp(o.y + dy, 0, 100 - o.h)) });
    else patch(op.id, { w: round(clamp(o.w + dx, 2, 100 - o.x)), h: round(clamp(o.h + dy, 2, 100 - o.y)) });
  };
  const end = () => setOp(null);

  useEffect(() => {
    const onKey = (ev) => {
      if (!cur || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ev.target.tagName)) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); del(cur.id); setSel(null); return; }
      const step = ev.shiftKey ? 5 : 0.5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
      if (d) { ev.preventDefault(); patch(cur.id, { x: clamp(cur.x + d[0], 0, 100 - cur.w), y: clamp(cur.y + d[1], 0, 100 - cur.h) }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const upload = async (file, then) => {
    if (!file) return;
    if (!itemId) { window.alert('Сначала сохраните задание, потом загружайте файлы'); return; }
    setBusy(file.name);
    try { const f = await api.uploadFile({ library_item_id: itemId }, file); await then(f); } catch (err) { window.alert(err.message); } finally { setBusy(''); }
  };
  const setBackground = (file) => upload(file, async (f) => {
    const ratio = await new Promise((res) => { const img = new Image(); img.onload = () => res(img.naturalWidth / img.naturalHeight); img.onerror = () => res(game.ratio); img.src = URL.createObjectURL(file); });
    onChange({ ...game, bg: f.id, ratio: clamp(+ratio.toFixed(3), 0.4, 2.5) });
  });
  const zoneLabel = (z) => boardZoneName(game, z.id);

  return (
    <div className="bd-editor">
      <div className="bd-tools" role="toolbar" aria-label="Детали задания">
        {Object.entries(BOARD_PARTS).map(([k, d]) => (
          <button key={k} type="button" className="bd-tool" onClick={() => add(k)} title={d.hint}><Icon name={d.icon} size={18} /><span>{d.label}</span></button>
        ))}
      </div>
      <div className="bd-layout">
        <div>
          <Canvas game={game} innerRef={box} className={`bd-canvas paper-${game.paper || 'white'} editing`} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
            onPointerDown={(ev) => { if (ev.target === box.current || ev.target.classList.contains('bd-bg')) setSel(null); }}>
            {els.map((el) => (
              <div key={el.id} className={`${cls(el)} bd-edit${sel === el.id ? ' sel' : ''}`} style={{ ...boxStyle(el), ...textStyle(el) }} onPointerDown={(ev) => start(ev, el, 'move')}>
                {el.k === 'text' && <div className="bd-text"><Rich text={el.text || 'Текст'} /></div>}
                {el.k === 'image' && (el.image ? <FileImage id={el.image} alt="" draggable={false} /> : <span className="bd-ph">Картинка</span>)}
                {el.k === 'audio' && <AudioButton el={el} live={false} />}
                {el.k === 'input' && <span className="bd-ph">{el.a ? alts(el.a)[0] : 'ответ'}</span>}
                {el.k === 'select' && <span className="bd-ph">{el.options?.[el.correct || 0] || 'список'} ▾</span>}
                {el.k === 'check' && <><input type="checkbox" checked={Boolean(el.on)} readOnly tabIndex={-1} />{el.text && <span><Rich text={el.text} /></span>}</>}
                {el.k === 'chip' && <span className="bd-chip-btn static">{el.text || 'карточка'}{el.zone && <i className="bd-chip-to">→ {zoneLabel({ id: el.zone })}</i>}</span>}
                {el.k === 'zone' && <span className="bd-zone-label">{zoneLabel(el)}</span>}
                {sel === el.id && <span className="bd-handle" onPointerDown={(ev) => start(ev, el, 'size')} aria-hidden="true" />}
              </div>
            ))}
          </Canvas>
          <div className="small muted" style={{ marginTop: 8 }}>Нажмите на деталь, чтобы выбрать. Тяните мышкой, чтобы передвинуть, за уголок, чтобы изменить размер. Стрелки двигают точно, Delete удаляет.</div>
        </div>

        <aside className="bd-props">
          {cur ? (
            <div className="form">
              <div className="row-between">
                <span className="section-title">{BOARD_PARTS[cur.k].label}</span>
                <div className="row" style={{ gap: 2 }}>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={dup}>Копия</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={toFront} title="Поверх остальных">Наверх</button>
                  <button type="button" className="icon-btn" aria-label="Удалить деталь" onClick={() => { del(cur.id); setSel(null); }}><Icon name="trash" size={16} /></button>
                </div>
              </div>
              <PartForm el={cur} set={(p) => patch(cur.id, p)} zones={zones} zoneLabel={zoneLabel} upload={upload} busy={busy} itemId={itemId}
                addChip={() => add('chip', { zone: cur.id, x: clamp(cur.x, 0, 84), y: clamp(cur.y + cur.h + 3, 0, 93) })} />
            </div>
          ) : (
            <div className="form">
              <span className="section-title">Холст</span>
              <Field label="Формат">
                <select className="select" value={RATIOS.find(([r]) => Math.abs(r - game.ratio) < 0.01)?.[0] ?? ''} onChange={(ev) => onChange({ ...game, ratio: Number(ev.target.value) })}>
                  {!RATIOS.some(([r]) => Math.abs(r - game.ratio) < 0.01) && <option value="">По фото</option>}
                  {RATIOS.map(([r, l]) => <option key={l} value={r}>{l}</option>)}
                </select>
              </Field>
              <Field label="Бумага">
                <div className="row wrap" style={{ gap: 6 }}>
                  {PAPERS.map(([k, l]) => <button key={k} type="button" className={`btn btn-sm ${game.paper === k ? '' : 'btn-secondary'}`} onClick={() => onChange({ ...game, paper: k })}>{l}</button>)}
                </div>
              </Field>
              <Field label="Фоновое фото" hint={itemId ? 'Например, страница учебника или рабочий лист: поверх ставите поля и карточки' : 'Сохраните задание, чтобы загрузить фото'}>
                <div className="row wrap" style={{ gap: 6 }}>
                  {itemId && <label className="btn btn-secondary btn-sm"><Icon name="clip" size={16} /> {busy ? 'Загружаем…' : game.bg ? 'Заменить фото' : 'Загрузить фото'}<input type="file" accept="image/*" hidden onChange={(ev) => setBackground(ev.target.files[0])} /></label>}
                  {game.bg && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ ...game, bg: null })}>Убрать фото</button>}
                </div>
              </Field>
              <div className="bd-legend small muted">
                <div><b>Проверяются сами:</b> поля с ответом, списки, галочки, карточки с выбранным местом.</div>
                <div>Поле без ответа проверяете вы. Карточка без места считается лишней: если её положат куда-то, это ошибка.</div>
                <div>Деталей: {els.length}, на проверку: {els.filter((x) => (x.k === 'input' && alts(x.a).length) || x.k === 'select' || x.k === 'check' || (x.k === 'chip' && x.zone)).length}</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StyleFields({ el, set }) {
  return (
    <>
      <div className="form-row" style={{ gap: 8 }}>
        <Field label="Размер шрифта"><input className="input" type="number" min="8" max="96" value={el.size || 18} onChange={(e) => set({ size: clamp(Number(e.target.value) || 18, 8, 96) })} /></Field>
        <Field label="Цвет">
          <select className="select" value={el.color || 'ink'} onChange={(e) => set({ color: e.target.value })}>{COLORS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
      </div>
      <div className="form-row" style={{ gap: 8 }}>
        <Field label="Фон">
          <select className="select" value={el.bg || 'none'} onChange={(e) => set({ bg: e.target.value })}>{BGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Выравнивание">
          <select className="select" value={el.align || 'left'} onChange={(e) => set({ align: e.target.value })}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select>
        </Field>
      </div>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={Boolean(el.bold)} onChange={(e) => set({ bold: e.target.checked })} /> Жирный</label>
    </>
  );
}

function PartForm({ el, set, zones, zoneLabel, upload, busy, itemId, addChip }) {
  const k = el.k;
  return (
    <>
      {k === 'text' && (
        <>
          <Field label="Текст" hint="**слово** выделяет жирным"><textarea className="textarea" rows={4} value={el.text || ''} onChange={(e) => set({ text: e.target.value })} autoFocus /></Field>
          <StyleFields el={el} set={set} />
        </>
      )}
      {k === 'input' && (
        <>
          <Field label="Правильный ответ" hint="Несколько вариантов через |. Пусто: поле проверяете вы"><input className="input" value={el.a || ''} onChange={(e) => set({ a: e.target.value })} placeholder="goes|is going" autoFocus /></Field>
          <Field label="Подсказка для проверки" hint="Видите в результатах, что это было за поле"><input className="input" value={el.text || ''} onChange={(e) => set({ text: e.target.value })} placeholder="1. He (go)…" /></Field>
          <Field label="Размер шрифта"><input className="input" type="number" min="8" max="96" value={el.size || 18} onChange={(e) => set({ size: clamp(Number(e.target.value) || 18, 8, 96) })} /></Field>
        </>
      )}
      {k === 'select' && (
        <>
          <Field label="Варианты" hint="Отметьте правильный кружком">
            <div className="stack" style={{ gap: 6 }}>
              {(el.options || []).map((o, i) => (
                <div key={i} className="row" style={{ gap: 6 }}>
                  <input type="radio" name={`ok-${el.id}`} checked={(el.correct || 0) === i} onChange={() => set({ correct: i })} aria-label="Правильный вариант" />
                  <input className="input" value={o} onChange={(e) => set({ options: el.options.map((x, j) => (j === i ? e.target.value : x)) })} placeholder={`Вариант ${i + 1}`} />
                  {el.options.length > 2 && <button type="button" className="icon-btn" aria-label="Убрать вариант" onClick={() => set({ options: el.options.filter((_, j) => j !== i), correct: (el.correct || 0) >= i && (el.correct || 0) > 0 ? (el.correct || 0) - ((el.correct || 0) === i ? 0 : 1) : el.correct || 0 })}><Icon name="close" size={16} /></button>}
                </div>
              ))}
              {el.options.length < 8 && <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ options: [...el.options, ''] })}><Icon name="plus" size={16} /> Вариант</button>}
            </div>
          </Field>
          <Field label="Размер шрифта"><input className="input" type="number" min="8" max="96" value={el.size || 18} onChange={(e) => set({ size: clamp(Number(e.target.value) || 18, 8, 96) })} /></Field>
        </>
      )}
      {k === 'check' && (
        <>
          <Field label="Подпись" hint="Можно оставить пустой и поставить галочку рядом с текстом или фото"><input className="input" value={el.text || ''} onChange={(e) => set({ text: e.target.value })} autoFocus /></Field>
          <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={Boolean(el.on)} onChange={(e) => set({ on: e.target.checked })} /> Правильно отметить</label>
          <StyleFields el={el} set={set} />
        </>
      )}
      {k === 'chip' && (
        <>
          <Field label="Текст карточки"><input className="input" value={el.text || ''} onChange={(e) => set({ text: e.target.value })} autoFocus /></Field>
          <Field label="Куда положить" hint={zones.length ? 'Карточка без места лишняя: её не должны никуда класть' : 'Сначала добавьте деталь «Место»'}>
            <select className="select" value={el.zone || ''} onChange={(e) => set({ zone: e.target.value || null })}>
              <option value="">Никуда (лишняя)</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{zoneLabel(z)}</option>)}
            </select>
          </Field>
          <StyleFields el={el} set={set} />
        </>
      )}
      {k === 'zone' && (
        <>
          <Field label="Подпись места" hint="Видна ученику, например название группы. Можно оставить пустой"><input className="input" value={el.text || ''} onChange={(e) => set({ text: e.target.value })} autoFocus /></Field>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addChip}><Icon name="plus" size={16} /> Карточка для этого места</button>
          <StyleFields el={el} set={set} />
        </>
      )}
      {k === 'image' && (
        <Field label="Картинка" hint={itemId ? 'PNG или JPG' : 'Сохраните задание, чтобы загружать картинки'}>
          {itemId && <label className="btn btn-secondary btn-sm"><Icon name="clip" size={16} /> {busy ? 'Загружаем…' : el.image ? 'Заменить' : 'Загрузить'}<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0], (f) => set({ image: f.id }))} /></label>}
        </Field>
      )}
      {k === 'audio' && (
        <>
          <Field label="Озвучить текст" hint="Британский голос прочитает это вслух"><input className="input" value={el.say || ''} onChange={(e) => set({ say: e.target.value })} placeholder="She is reading a book." /></Field>
          <Field label="Или своя запись" hint={itemId ? 'MP3 или M4A' : 'Сохраните задание, чтобы загрузить аудио'}>
            <div className="row" style={{ gap: 6 }}>
              {itemId && <label className="btn btn-secondary btn-sm"><Icon name="clip" size={16} /> {busy ? 'Загружаем…' : el.audio ? 'Заменить' : 'Загрузить'}<input type="file" accept="audio/*" hidden onChange={(e) => upload(e.target.files[0], (f) => set({ audio: f.id }))} /></label>}
              {el.audio && <button type="button" className="btn btn-quiet btn-sm" onClick={() => set({ audio: null })}>Убрать</button>}
            </div>
          </Field>
        </>
      )}
    </>
  );
}

// Перед сохранением: пустые варианты списка убрать, правильный пересчитать
export function cleanBoard(game) {
  const elements = game.elements.map((el) => {
    const base = { ...el, x: clamp(el.x, 0, 100), y: clamp(el.y, 0, 100), w: clamp(el.w, 1, 100), h: clamp(el.h, 1, 100) };
    if (el.k !== 'select') return base;
    const keep = (el.options || []).map((o, j) => ({ o: o.trim(), j })).filter((x) => x.o);
    return { ...base, options: keep.map((x) => x.o), correct: Math.max(0, keep.findIndex((x) => x.j === (el.correct || 0))) };
  }).filter((el) => el.k !== 'select' || el.options.length >= 2);
  return { ...game, elements };
}
