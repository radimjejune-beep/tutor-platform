// games/Sheet.jsx — лист с заданиями: из фото учебника или тетради делается интерактивное задание
// Блоки: текст, пропуски, выбор ответа, развёрнутый ответ, ответ голосом, фото страницы с полями поверх.
// К любому блоку можно прикрепить аудио (аудирование), к тексту ещё и картинку.
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, useToast } from '../ui';
import { parseGaps, alts } from './logic';

// Где проходят лист: в домашнем задании можно записать голос (файл прикрепится к работе)
export const SheetContext = createContext({ homeworkId: null });

/* ============================================================
   Файлы листа: загружаются с токеном, поэтому через blob
   ============================================================ */
const urlCache = new Map();
export function useFileUrl(id) {
  const [url, setUrl] = useState(() => (id ? urlCache.get(id) || null : null));
  useEffect(() => {
    if (!id) return setUrl(null);
    if (urlCache.has(id)) return setUrl(urlCache.get(id));
    let alive = true;
    api.fileBlob(id).then((b) => {
      const u = URL.createObjectURL(b);
      urlCache.set(id, u);
      if (alive) setUrl(u);
    }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  return url;
}

// Ссылка YouTube → id ролика (для встроенного плеера)
export function ytId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function FileImage({ id, alt = '', ...rest }) {
  const url = useFileUrl(id);
  return url ? <img src={url} alt={alt} {...rest} /> : <div className="sheet-img-wait">Загружаем фото…</div>;
}

export function FileAudio({ id }) {
  const url = useFileUrl(id);
  return url ? <audio className="sheet-audio" controls preload="metadata" src={url} /> : <div className="small muted">Загружаем аудио…</div>;
}

/* ============================================================
   Прохождение
   ============================================================ */
export function SheetBoard({ game, answers, setAnswers, result }) {
  const b = answers.b || {};
  const set = (i, v) => setAnswers({ ...answers, b: { ...b, [i]: v } });
  const checked = Boolean(result);
  // Результат по блоку и номеру поля
  const res = (i, k) => result?.details.find((d) => d.block === i && (k === undefined || d.k === k));

  let n = 0; // сквозная нумерация вопросов
  return (
    <div className="sheet">
      {game.blocks.map((blk, i) => {
        const audio = blk.audio ? <FileAudio id={blk.audio} /> : null;
        if (blk.t === 'text') {
          const yt = ytId(blk.video);
          return (
            <div key={i} className="sheet-block sheet-text">
              {yt && <div className="mat-yt"><iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Видео" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
              {blk.video && !yt && <a className="mat-link" href={blk.video} target="_blank" rel="noreferrer"><span className="mat-link-text"><span className="mat-link-title">Видео</span><span className="mat-link-url">{blk.video.replace(/^https?:\/\/(www\.)?/, '')}</span></span></a>}
              {blk.text && <div className="sheet-instr">{blk.text}</div>}
              {blk.image && <FileImage id={blk.image} className="sheet-pic" />}
              {audio}
            </div>
          );
        }
        if (blk.t === 'gaps') {
          const { parts, gaps } = parseGaps(blk.text);
          const vals = Array.isArray(b[i]) ? b[i] : [];
          return (
            <div key={i} className="sheet-block">
              {audio}
              <div className="gap-text sheet-gaps">
                {parts.map((p, k) => (
                  <span key={k}>
                    {p}
                    {k < gaps.length && (() => {
                      const d = res(i, k);
                      const w = Math.max(4, ...gaps[k].map((g) => g.length)) + 1;
                      return (
                        <>
                          <input className={`gap-input ${d ? (d.ok ? 'ok' : 'bad') : ''}`} value={vals[k] || ''} disabled={checked}
                            style={{ width: `${Math.min(w, 28)}ch` }} aria-label={`Пропуск ${k + 1}`} autoCapitalize="none" autoComplete="off" spellCheck="false"
                            onChange={(e) => { const nv = gaps.map((_, x) => (x === k ? e.target.value : vals[x] || '')); set(i, nv); }} />
                          {d && !d.ok && <span className="gap-fix">{d.expected}</span>}
                        </>
                      );
                    })()}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        if (blk.t === 'choice') {
          n++;
          const d = res(i);
          return (
            <div key={i} className="sheet-block">
              {audio}
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span>{blk.q}</div>}
              <div className="sheet-options" role="radiogroup">
                {blk.options.map((o, j) => {
                  const chosen = Number(b[i]) === j && b[i] !== undefined && b[i] !== null;
                  const cls = d ? (j === blk.correct ? 'ok' : chosen ? 'bad' : '') : chosen ? 'on' : '';
                  return (
                    <button type="button" key={j} role="radio" aria-checked={chosen} className={`sheet-opt ${cls}`} disabled={checked} onClick={() => set(i, j)}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        if (blk.t === 'open') {
          n++;
          return (
            <div key={i} className="sheet-block">
              {audio}
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span>{blk.q}</div>}
              <textarea className="textarea" value={b[i] || ''} disabled={checked} placeholder="Ваш ответ" onChange={(e) => set(i, e.target.value)} />
              {checked && <div className="small muted">Этот ответ проверит преподаватель.</div>}
            </div>
          );
        }
        if (blk.t === 'voice') {
          n++;
          return (
            <div key={i} className="sheet-block">
              {audio}
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span>{blk.q}</div>}
              <VoiceAnswer value={b[i]} disabled={checked} onChange={(id) => set(i, id)} />
            </div>
          );
        }
        if (blk.t === 'page') {
          const vals = Array.isArray(b[i]) ? b[i] : [];
          return (
            <div key={i} className="sheet-block">
              <div className="sheet-page">
                <FileImage id={blk.image} className="sheet-page-img" />
                {blk.fields.map((f, k) => {
                  const d = res(i, k);
                  return (
                    <div key={k} className="sheet-field-wrap" style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }}>
                      <input className={`sheet-field ${d && d.ok !== null ? (d.ok ? 'ok' : 'bad') : ''}`} value={vals[k] || ''} disabled={checked}
                        aria-label={`Поле ${k + 1}`} autoCapitalize="none" autoComplete="off" spellCheck="false"
                        onChange={(e) => { const nv = blk.fields.map((_, x) => (x === k ? e.target.value : vals[x] || '')); set(i, nv); }} />
                      {d && d.ok === false && <span className="sheet-fix">{d.expected}</span>}
                    </div>
                  );
                })}
              </div>
              {checked && blk.fields.some((_, k) => res(i, k)?.ok === false) && (
                <div className="sheet-fixes small">
                  Правильно: {blk.fields.map((_, k) => res(i, k)).map((d, k) => (d?.ok === false ? <span key={k}><b>{k + 1}</b> {d.expected}</span> : null))}
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// Сколько ответов уже дано (для строки прогресса)
export function sheetProgress(game, answers) {
  const b = answers.b || {};
  let done = 0;
  let total = 0;
  game.blocks.forEach((blk, i) => {
    if (blk.t === 'gaps' || blk.t === 'page') {
      const cnt = blk.t === 'gaps' ? parseGaps(blk.text).gaps.length : blk.fields.length;
      total += cnt;
      done += (Array.isArray(b[i]) ? b[i] : []).filter((v) => String(v || '').trim()).length;
    } else if (['choice', 'open', 'voice'].includes(blk.t)) {
      total++;
      if (b[i] !== undefined && b[i] !== null && b[i] !== '') done++;
    }
  });
  return `Заполнено ${done} из ${total}`;
}

/* ============================================================
   Ответ голосом: запись в браузере, файл прикрепляется к работе
   ============================================================ */
function VoiceAnswer({ value, disabled, onChange }) {
  const { homeworkId } = useContext(SheetContext);
  const toast = useToast();
  const [rec, setRec] = useState(null);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const chunks = useRef([]);

  useEffect(() => {
    if (!rec) return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);

  if (!homeworkId) {
    return <div className="voice-box muted small">Ответ голосом записывается, когда лист выдан как домашнее задание и работа ещё не проверена.</div>;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return <div className="voice-box muted small">Этот браузер не умеет записывать звук. Откройте задание в Chrome или Safari.</div>;
  }

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (r.mimeType || 'audio/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(chunks.current, `voice-${Date.now()}.${ext}`, { type });
        setBusy(true);
        try {
          const saved = await api.uploadFile({ homework_id: homeworkId }, file);
          onChange(saved.id);
        } catch (err) {
          toast(err.message, 'error');
        } finally {
          setBusy(false);
        }
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      toast('Нет доступа к микрофону. Разрешите его в настройках браузера', 'error');
    }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <div className="voice-box">
      {value && !rec && <FileAudio id={value} />}
      {!disabled && (
        rec ? (
          <button type="button" className="btn btn-danger-soft" onClick={stop}><span className="rec-dot" /> Остановить {mmss}</button>
        ) : (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={start}>
            <Icon name="sound" /> {busy ? 'Сохраняем запись…' : value ? 'Записать заново' : 'Записать ответ'}
          </button>
        )
      )}
    </div>
  );
}

/* ============================================================
   Конструктор листа
   ============================================================ */
const BLOCK_LABEL = { text: 'Текст или инструкция', gaps: 'Пропуски', choice: 'Выбор ответа', open: 'Развёрнутый ответ', voice: 'Ответ голосом', page: 'Фото с полями' };
const NEW_BLOCK = {
  text: () => ({ t: 'text', text: '' }),
  gaps: () => ({ t: 'gaps', text: '' }),
  choice: () => ({ t: 'choice', q: '', options: ['', ''], correct: 0 }),
  open: () => ({ t: 'open', q: '' }),
  voice: () => ({ t: 'voice', q: '' }),
};

export function SheetEditor({ game, onChange, itemId }) {
  const toast = useToast();
  const blocks = game.blocks;
  const [busy, setBusy] = useState('');

  const setBlocks = (next) => onChange({ ...game, blocks: next });
  const update = (i, patch) => setBlocks(blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const n = [...blocks];
    [n[i], n[j]] = [n[j], n[i]];
    setBlocks(n);
  };
  const remove = (i) => setBlocks(blocks.filter((_, k) => k !== i));
  const upload = async (file) => api.uploadFile({ library_item_id: itemId }, file);

  // Фото страниц: каждое становится блоком «фото с полями»
  const addPhotos = async (files) => {
    if (!files.length) return;
    setBusy(`Загружаем фото: 0 из ${files.length}`);
    const added = [];
    try {
      for (const [k, f] of [...files].entries()) {
        setBusy(`Загружаем фото: ${k + 1} из ${files.length}`);
        const saved = await upload(f);
        added.push({ t: 'page', image: saved.id, fields: [] });
      }
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusy('');
    // Пустой стартовый блок заменяем фотографиями
    const base = blocks.length === 1 && blocks[0].t === 'text' && !blocks[0].text && !blocks[0].image && !blocks[0].audio ? [] : blocks;
    setBlocks([...base, ...added]);
  };

  return (
    <div className="sheet-editor">
      <div className="sheet-start">
        <label className="btn btn-secondary">
          <Icon name="plus" /> Фото страниц
          <input type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
        </label>
        <span className="small muted">{busy || 'Загрузите фото и нажмите на них там, где ученик должен вписать ответ. Или соберите задания блоками ниже.'}</span>
      </div>

      {blocks.map((b, i) => (
        <div key={i} className="sheet-edit-block">
          <div className="row-between">
            <span className="meta-label">{i + 1}. {BLOCK_LABEL[b.t]}</span>
            <div className="row" style={{ gap: 2 }}>
              <button type="button" className="icon-btn" aria-label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="back" size={16} /></span></button>
              <button type="button" className="icon-btn" aria-label="Ниже" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}><span style={{ display: 'inline-flex', transform: 'rotate(-90deg)' }}><Icon name="back" size={16} /></span></button>
              <button type="button" className="icon-btn" aria-label="Удалить блок" onClick={() => remove(i)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
          <BlockEditor b={b} onChange={(patch) => update(i, patch)} upload={upload} />
        </div>
      ))}

      <div className="sheet-add">
        <span className="small muted">Добавить:</span>
        {Object.keys(NEW_BLOCK).map((t) => (
          <button type="button" key={t} className="btn btn-secondary btn-sm" onClick={() => setBlocks([...blocks, NEW_BLOCK[t]()])}>{BLOCK_LABEL[t]}</button>
        ))}
      </div>
    </div>
  );
}

function AttachButton({ accept, label, onFile }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <label className={`btn btn-quiet btn-sm ${busy ? 'disabled' : ''}`}>
      <Icon name="clip" /> {busy ? 'Загружаем…' : label}
      <input type="file" accept={accept} hidden disabled={busy} onChange={async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        setBusy(true);
        try { await onFile(f); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
      }} />
    </label>
  );
}

function MediaRow({ b, onChange, upload, image }) {
  return (
    <div className="sheet-media">
      {b.audio ? (
        <div className="row" style={{ gap: 6, flex: 1, minWidth: 0 }}>
          <FileAudio id={b.audio} />
          <button type="button" className="icon-btn" aria-label="Убрать аудио" onClick={() => onChange({ audio: null })}><Icon name="close" size={16} /></button>
        </div>
      ) : (
        <AttachButton accept="audio/*" label="Аудио" onFile={async (f) => onChange({ audio: (await upload(f)).id })} />
      )}
      {image && !b.image && <AttachButton accept="image/*" label="Картинка" onFile={async (f) => onChange({ image: (await upload(f)).id })} />}
    </div>
  );
}

function BlockEditor({ b, onChange, upload }) {
  if (b.t === 'text') {
    return (
      <>
        <textarea className="textarea" style={{ minHeight: 70 }} value={b.text} placeholder="Например: 3. Listen and complete the sentences." onChange={(e) => onChange({ text: e.target.value })} />
        <input className="input" value={b.video || ''} placeholder="Ссылка на видео YouTube (необязательно)" onChange={(e) => onChange({ video: e.target.value })} />
        {b.image && (
          <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
            <FileImage id={b.image} className="sheet-pic" />
            <button type="button" className="icon-btn" aria-label="Убрать картинку" onClick={() => onChange({ image: null })}><Icon name="close" size={16} /></button>
          </div>
        )}
        <MediaRow b={b} onChange={onChange} upload={upload} image />
      </>
    );
  }
  if (b.t === 'gaps') {
    const n = parseGaps(b.text).gaps.length;
    return (
      <>
        <textarea className="textarea" style={{ minHeight: 90 }} value={b.text} placeholder={'Ответ в квадратных скобках:\nShe [goes] to school by bus.\nThey [don\'t|do not] like pizza.'} onChange={(e) => onChange({ text: e.target.value })} />
        <div className="small muted">Пропусков: {n}. Несколько верных ответов через |</div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
  }
  if (b.t === 'choice') return <ChoiceEditor b={b} onChange={onChange} upload={upload} />;
  if (b.t === 'open' || b.t === 'voice') {
    return (
      <>
        <textarea className="textarea" style={{ minHeight: 60 }} value={b.q}
          placeholder={b.t === 'voice' ? 'Например: Прочитайте текст вслух. Расскажите о своих выходных' : 'Например: Напишите 5 предложений о своей семье'}
          onChange={(e) => onChange({ q: e.target.value })} />
        <div className="small muted">{b.t === 'voice' ? 'Ученик запишет ответ голосом прямо в задании, вы послушаете при проверке.' : 'Ответ проверяете вы, в автоматическую оценку не входит.'}</div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
  }
  if (b.t === 'page') return <PageEditor b={b} onChange={onChange} />;
  return null;
}


function ChoiceEditor({ b, onChange, upload }) {
  const group = useId();
  const opts = b.options;
    const setOpt = (j, v) => onChange({ options: opts.map((o, k) => (k === j ? v : o)) });
    return (
      <>
        <input className="input" value={b.q} placeholder="Вопрос или утверждение" onChange={(e) => onChange({ q: e.target.value })} />
        <div className="stack" style={{ gap: 6 }}>
          {opts.map((o, j) => (
            <div key={j} className="row" style={{ gap: 8 }}>
              <input type="radio" name={group} checked={b.correct === j} onChange={() => onChange({ correct: j })} aria-label="Верный ответ" />
              <input className="input" value={o} placeholder={`Вариант ${j + 1}`} onChange={(e) => setOpt(j, e.target.value)} />
              {opts.length > 2 && (
                <button type="button" className="icon-btn" aria-label="Убрать вариант"
                  onClick={() => onChange({ options: opts.filter((_, k) => k !== j), correct: b.correct === j ? 0 : b.correct > j ? b.correct - 1 : b.correct })}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          {opts.length < 8 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ options: [...opts, ''] })}><Icon name="plus" /> Вариант</button>}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ options: ['True', 'False'], correct: b.correct > 1 ? 0 : b.correct })}>True / False</button>
          <span className="small muted">Кружком отмечен верный ответ</span>
        </div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
}

// Фото страницы: потяните по фото, чтобы обвести место для ответа
function PageEditor({ b, onChange }) {
  const box = useRef(null);
  const [draft, setDraft] = useState(null);
  const [sel, setSel] = useState(null);
  const justAdded = useRef(null); // новое поле: сразу печатать ответ, без прокрутки страницы
  const fields = b.fields;
  const pos = (e) => {
    const r = box.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
  };
  const down = (e) => {
    if (e.target.closest('.sheet-field-edit')) return;
    e.preventDefault();
    box.current.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    setDraft({ x0: p.x, y0: p.y, x: p.x, y: p.y });
  };
  const moveP = (e) => draft && setDraft({ ...draft, ...pos(e) });
  const up = () => {
    if (!draft) return;
    const x = Math.min(draft.x0, draft.x);
    const y = Math.min(draft.y0, draft.y);
    let w = Math.abs(draft.x - draft.x0);
    let h = Math.abs(draft.y - draft.y0);
    // Простое нажатие: поле стандартного размера
    if (w < 1.5 && h < 1) { w = 16; h = 3.2; }
    const f = { x: +x.toFixed(2), y: +y.toFixed(2), w: +Math.min(w, 100 - x).toFixed(2), h: +Math.min(h, 100 - y).toFixed(2), a: '' };
    onChange({ fields: [...fields, f] });
    justAdded.current = fields.length;
    setSel(fields.length);
    setDraft(null);
  };
  const setField = (k, patch) => onChange({ fields: fields.map((f, j) => (j === k ? { ...f, ...patch } : f)) });
  const del = (k) => { onChange({ fields: fields.filter((_, j) => j !== k) }); setSel(null); };
  const d = draft && { left: Math.min(draft.x0, draft.x), top: Math.min(draft.y0, draft.y), width: Math.abs(draft.x - draft.x0), height: Math.abs(draft.y - draft.y0) };

  return (
    <>
      <div className="small muted">Нажмите на фото или протяните рамку там, где ученик должен вписать ответ. Ответ можно не указывать, тогда поле просто для записи.</div>
      <div className="sheet-page editing" ref={box} onPointerDown={down} onPointerMove={moveP} onPointerUp={up}>
        <FileImage id={b.image} className="sheet-page-img" draggable={false} />
        {fields.map((f, k) => (
          <button type="button" key={k} className={`sheet-field-edit ${sel === k ? 'sel' : ''} ${f.a ? '' : 'empty'}`}
            style={{ left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%` }} onClick={() => setSel(k)}>
            <span>{k + 1}</span>
          </button>
        ))}
        {d && <div className="sheet-draft" style={{ left: `${d.left}%`, top: `${d.top}%`, width: `${d.width}%`, height: `${d.height}%` }} />}
      </div>
      {fields.length > 0 && (
        <div className="sheet-field-list">
          {fields.map((f, k) => (
            <div key={k} className={`sheet-field-row ${sel === k ? 'sel' : ''}`} onClick={() => setSel(k)}>
              <span className="sheet-n">{k + 1}</span>
              <input className="input" value={f.a} placeholder="Ответ (варианты через |)" onChange={(e) => setField(k, { a: e.target.value })}
                ref={(el) => { if (el && sel === k && justAdded.current === k) { justAdded.current = null; el.focus({ preventScroll: true }); } }}
                onFocus={() => setSel(k)} />
              <button type="button" className="icon-btn" aria-label="Удалить поле" onClick={(e) => { e.stopPropagation(); del(k); }}><Icon name="close" size={16} /></button>
            </div>
          ))}
          <div className="small muted">С ответами: {fields.filter((f) => alts(f.a).length).length} из {fields.length}. Поля без ответа проверяете вы.</div>
        </div>
      )}
    </>
  );
}
