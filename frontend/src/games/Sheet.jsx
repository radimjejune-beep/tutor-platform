// games/Sheet.jsx — лист с заданиями: из фото учебника или тетради делается интерактивное задание
// Блоки: текст, пропуски, выбор ответа, развёрнутый ответ, ответ голосом, фото страницы с полями поверх.
// К любому блоку можно прикрепить аудио (аудирование), к тексту ещё и картинку.
import { MathText } from '../components/MathText';
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, useToast } from '../ui';
import { parseGaps, alts, writeChecks, parseFix, words } from './logic';
import { say } from '../voice';

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
              {blk.text && <MathText as="div" className="sheet-instr">{blk.text}</MathText>}
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
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span><MathText>{blk.q}</MathText></div>}
              <div className="sheet-options" role="radiogroup">
                {blk.options.map((o, j) => {
                  const chosen = Number(b[i]) === j && b[i] !== undefined && b[i] !== null;
                  const cls = d ? (j === blk.correct ? 'ok' : chosen ? 'bad' : '') : chosen ? 'on' : '';
                  return (
                    <button type="button" key={j} role="radio" aria-checked={chosen} className={`sheet-opt ${cls}`} disabled={checked} onClick={() => set(i, j)}>
                      <MathText>{o}</MathText>
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
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span><MathText>{blk.q}</MathText></div>}
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
              {blk.q && <div className="sheet-q"><span className="sheet-n">{n}</span><MathText>{blk.q}</MathText></div>}
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
        if (blk.t === 'write') {
          n++;
          return <WriteBlock key={i} n={n} blk={blk} value={b[i] || ''} onChange={(v) => set(i, v)} checked={checked} audio={audio} />;
        }
        if (blk.t === 'rewrite') {
          n++;
          const d = res(i);
          return (
            <div key={i} className="sheet-block">
              {audio}
              <div className="sheet-q"><span className="sheet-n">{n}</span><span>{blk.q || 'Перепишите предложение'}</span></div>
              {blk.src && <div className="rw-src"><MathText>{blk.src}</MathText></div>}
              <input className={`input rw-input ${d ? (d.ok ? 'ok' : 'bad') : ''}`} value={b[i] || ''} disabled={checked} placeholder="Новое предложение"
                autoCapitalize="none" autoComplete="off" spellCheck="false" onChange={(e) => set(i, e.target.value)} />
              {d && !d.ok && <div className="rw-fix">Правильно: <b>{d.expected}</b></div>}
            </div>
          );
        }
        if (blk.t === 'fix') {
          n++;
          return <FixBlock key={i} n={n} blk={blk} value={b[i] || {}} onChange={(v) => set(i, v)} result={checked ? result.details.filter((d) => d.block === i) : null} audio={audio} />;
        }
        if (blk.t === 'dictation') {
          n++;
          const d = res(i);
          return (
            <div key={i} className="sheet-block">
              <div className="sheet-q"><span className="sheet-n">{n}</span><span>Послушайте и запишите</span></div>
              {blk.audio ? audio : (
                <div className="row wrap" style={{ gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => say(blk.text, 0.9)}><Icon name="sound" /> Слушать</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => say(blk.text, 0.6)}>Медленно</button>
                </div>
              )}
              <textarea className={`textarea ${d ? (d.ok ? 'ok' : 'bad') : ''}`} style={{ minHeight: 70 }} value={b[i] || ''} disabled={checked}
                placeholder="Пишите, что слышите" spellCheck="false" autoCapitalize="sentences" onChange={(e) => set(i, e.target.value)} />
              {d && !d.ok && <div className="rw-fix">Правильно: <b>{blk.text}</b></div>}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}


/* ---------- Письмо: чек-лист обновляется, пока ученик пишет ---------- */
function WriteBlock({ n, blk, value, onChange, checked, audio }) {
  const list = writeChecks(blk, value);
  const done = list.filter((c) => c.ok).length;
  const count = words(value).length;
  const [showModel, setShowModel] = useState(false);
  const add = (st) => onChange(`${value.trim() ? `${value.trimEnd()} ` : ''}${st} `);
  return (
    <div className="sheet-block write-block">
      {audio}
      <div className="sheet-q"><span className="sheet-n">{n}</span><MathText>{blk.q || 'Напишите текст'}</MathText></div>
      {!checked && blk.starters?.length > 0 && (
        <div className="write-starters">
          <span className="small muted">Начала фраз:</span>
          {blk.starters.map((st, k) => <button type="button" key={k} className="chip-btn" onClick={() => add(st)}>{st}</button>)}
        </div>
      )}
      <div className="write-grid">
        <div className="write-pad">
          <textarea className="textarea write-area" value={value} disabled={checked} placeholder="Пишите здесь…" spellCheck="false"
            onChange={(e) => onChange(e.target.value)} />
          <div className="small muted">Слов: {count}{blk.max_words ? ` из ${blk.max_words}` : blk.min_words ? `, нужно не меньше ${blk.min_words}` : ''}</div>
        </div>
        {list.length > 0 && (
          <div className="write-checks" aria-live="polite">
            <div className="meta-label">Чек-лист · {done} из {list.length}</div>
            {list.map((c) => (
              <div key={c.key} className={`write-check ${c.ok ? 'ok' : ''}`}>
                <span className="write-tick" aria-hidden="true">{c.ok ? '✓' : ''}</span>
                <span><span>{c.label}</span>{c.info && <small>{c.info}</small>}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {checked && <div className="small muted">Пункты чек-листа засчитаны сразу, сам текст проверит преподаватель.</div>}
      {checked && blk.model && (
        <div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowModel(!showModel)}>{showModel ? 'Скрыть пример' : 'Показать пример ответа'}</button>
          {showModel && <MathText as="div" className="write-model">{blk.model}</MathText>}
        </div>
      )}
    </div>
  );
}

/* ---------- Найди и исправь: нажать на слово, вписать верный вариант ---------- */
function FixBlock({ n, blk, value, onChange, result, audio }) {
  const toks = parseFix(blk.text);
  const [edit, setEdit] = useState(null);
  const errors = toks.filter((t) => t.right).length;
  const changed = Object.keys(value).filter((k) => value[k] !== toks[k]?.s).length;
  const resOf = (k) => result?.find((d) => d.k === k);
  return (
    <div className="sheet-block">
      {audio}
      <div className="sheet-q"><span className="sheet-n">{n}</span><span>{blk.q || 'Найдите и исправьте ошибки'}</span></div>
      <div className="small muted">{result ? '' : `Ошибок в тексте: ${errors}. Нажмите на слово с ошибкой и впишите верный вариант. Исправлено: ${changed}.`}</div>
      <div className="fix-text">
        {toks.map((t, k) => {
          if (!t.word) return <span key={k}>{t.s}</span>;
          const v = value[k];
          const d = resOf(k);
          const isChanged = v !== undefined && v !== t.s;
          if (result) {
            if (d && d.ok) return <span key={k} className="fix-tok ok"><s>{t.s}</s> {v}</span>;
            if (d && !d.ok) return <span key={k} className="fix-tok bad">{isChanged ? <><s>{v}</s> </> : <s>{t.s}</s>}{' '}<b>{d.expected}</b></span>;
            return <span key={k}>{t.s}</span>;
          }
          if (edit === k) {
            return (
              <input key={k} className="fix-input" autoFocus defaultValue={v ?? t.s} style={{ width: `${Math.max(4, (v ?? t.s).length + 2)}ch` }}
                autoCapitalize="none" autoComplete="off" spellCheck="false"
                onBlur={(e) => { const nv = { ...value }; const x = e.target.value.trim(); if (x === t.s) delete nv[k]; else nv[k] = x; onChange(nv); setEdit(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEdit(null); }} />
            );
          }
          return (
            <button type="button" key={k} className={`fix-tok ${isChanged ? 'changed' : ''}`} onClick={() => setEdit(k)}>
              {isChanged ? <><s>{t.s}</s> {v || '∅'}</> : t.s}
            </button>
          );
        })}
      </div>
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
    } else if (blk.t === 'fix') {
      total += parseFix(blk.text).filter((x) => x.right).length;
      done += Math.min(parseFix(blk.text).filter((x) => x.right).length, Object.keys(b[i] || {}).length);
    } else if (['choice', 'open', 'voice', 'write', 'rewrite', 'dictation'].includes(blk.t)) {
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
export const BLOCK_LABEL = { text: 'Текст или инструкция', gaps: 'Пропуски', choice: 'Выбор ответа', write: 'Письмо с чек-листом', fix: 'Исправь ошибки', rewrite: 'Перепиши предложение', dictation: 'Диктант', open: 'Развёрнутый ответ', voice: 'Ответ голосом', page: 'Фото с полями' };
const NEW_BLOCK = {
  text: () => ({ t: 'text', text: '' }),
  gaps: () => ({ t: 'gaps', text: '' }),
  choice: () => ({ t: 'choice', q: '', options: ['', ''], correct: 0 }),
  write: () => ({ t: 'write', q: '', min_words: 50, max_words: 0, min_sentences: 0, checks: [], caps: true, stop: true, latin: true, starters: [], model: '' }),
  fix: () => ({ t: 'fix', q: '', text: '' }),
  rewrite: () => ({ t: 'rewrite', q: '', src: '', a: '' }),
  dictation: () => ({ t: 'dictation', text: '' }),
  open: () => ({ t: 'open', q: '' }),
  voice: () => ({ t: 'voice', q: '' }),
};
export { NEW_BLOCK };

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
  if (b.t === 'write') return <WriteEditor b={b} onChange={onChange} upload={upload} />;
  if (b.t === 'fix') {
    const toks = parseFix(b.text);
    const errs = toks.filter((x) => x.right);
    return (
      <>
        <input className="input" value={b.q} placeholder="Инструкция (необязательно): В тексте 4 ошибки в Present Simple" onChange={(e) => onChange({ q: e.target.value })} />
        <textarea className="textarea" style={{ minHeight: 90 }} value={b.text}
          placeholder={'Ошибку пишите так: {неверно=верно}\nMy brother {go=goes} to school by bus. He {don\'t=doesn\'t} like {apple=apples}.\nНесколько верных вариантов через |: {dont=don\'t|do not}'}
          onChange={(e) => onChange({ text: e.target.value })} />
        <div className="small muted">
          Ошибок: {errs.length}. {errs.length > 0 && <>Ученик увидит: «{toks.map((x) => x.s).join('')}»</>}
        </div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
  }
  if (b.t === 'rewrite') {
    return (
      <>
        <input className="input" value={b.q} placeholder="Задание: Make the sentence negative / Поставьте в Past Simple" onChange={(e) => onChange({ q: e.target.value })} />
        <input className="input" value={b.src} placeholder="Исходное предложение: She plays tennis." onChange={(e) => onChange({ src: e.target.value })} />
        <input className="input" value={b.a} placeholder="Правильный ответ, варианты через |: She doesn't play tennis.|She does not play tennis." onChange={(e) => onChange({ a: e.target.value })} />
        <div className="small muted">Регистр букв, апостроф ’ или ' и точка в конце не важны. Сокращение и полную форму укажите как два варианта.</div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
  }
  if (b.t === 'dictation') {
    return (
      <>
        <textarea className="textarea" style={{ minHeight: 60 }} value={b.text} placeholder="Предложение для диктанта: I usually get up at seven o'clock." onChange={(e) => onChange({ text: e.target.value })} />
        <div className="row wrap" style={{ gap: 8 }}>
          {b.text && !b.audio && <button type="button" className="btn btn-quiet btn-sm" onClick={() => say(b.text)}><Icon name="sound" /> Как услышит ученик</button>}
          <span className="small muted">{b.audio ? 'Ученик послушает ваше аудио.' : 'Без аудио текст прочитает британский голос (обычно и медленно).'} Знаки препинания и регистр не проверяются, слова должны совпасть.</span>
        </div>
        <MediaRow b={b} onChange={onChange} upload={upload} />
      </>
    );
  }
  return null;
}

// Готовые пункты чек-листа: то, что чаще всего нужно отрабатывать в письме
export const WRITE_PRESETS = [
  { name: 'Наречия частоты', label: 'Наречия частоты: always, usually, often…', words: 'always|usually|often|sometimes|rarely|never', min: 3 },
  { name: 'Слова порядка', label: 'Слова порядка: first, then, after that…', words: 'first|then|next|after that|finally|later', min: 2 },
  { name: 'Связки', label: 'Связки: and, but, because, so…', words: 'and|but|because|so|also|however|or', min: 3 },
  { name: 'Время', label: 'Время: at 7 o’clock, in the morning…', words: "o'clock|half past|quarter past|quarter to|in the morning|in the afternoon|in the evening|at night|at the weekend", min: 2 },
  { name: 'Past Simple', label: 'Глаголы в прошедшем: …ed, went, was…', words: '*ed|was|were|went|had|did|saw|made|got|came|took|ate|bought|met|left', min: 4 },
  { name: 'Present Perfect', label: 'Present Perfect: have / has + V3', words: 'have *ed|has *ed|have been|has been|have never|has never|have just|has just|have already|has already', min: 2 },
  { name: 'Future', label: 'Будущее: will, going to', words: "will|going to|'ll|won't", min: 2 },
  { name: 'Сравнения', label: 'Сравнения: …er than, more, the most', words: '*er than|more|the most|the best|the worst|better|worse', min: 2 },
  { name: 'Can / could', label: 'Модальные: can, could, should, must', words: "can|could|should|must|can't|couldn't", min: 2 },
  { name: 'Мнение', label: 'Мнение: I think, in my opinion…', words: "I think|in my opinion|I believe|I like|I don't like|I love|I prefer", min: 1 },
  { name: 'Письмо другу', label: 'Приветствие и прощание', words: 'Dear|Hi|Hello|Love|Best wishes|See you|Write soon|Take care', min: 2 },
];

function NumField({ label, value, onChange }) {
  return (
    <label className="write-num">
      <span className="small muted">{label}</span>
      <input className="input" type="number" min="0" inputMode="numeric" value={value || ''} placeholder="нет"
        onChange={(e) => onChange(Math.max(0, Math.min(5000, parseInt(e.target.value, 10) || 0)))} />
    </label>
  );
}

function WriteEditor({ b, onChange, upload }) {
  const checks = b.checks || [];
  const setCheck = (k, patch) => onChange({ checks: checks.map((c, j) => (j === k ? { ...c, ...patch } : c)) });
  const [trial, setTrial] = useState('');
  const preview = writeChecks(b, trial);
  return (
    <>
      <textarea className="textarea" style={{ minHeight: 70 }} value={b.q}
        placeholder="Задание: Write about your typical Monday. Use adverbs of frequency and time expressions." onChange={(e) => onChange({ q: e.target.value })} />
      <div className="row wrap" style={{ gap: 10 }}>
        <NumField label="Слов не меньше" value={b.min_words} onChange={(v) => onChange({ min_words: v })} />
        <NumField label="Слов не больше" value={b.max_words} onChange={(v) => onChange({ max_words: v })} />
        <NumField label="Предложений не меньше" value={b.min_sentences} onChange={(v) => onChange({ min_sentences: v })} />
      </div>

      <div className="meta-label" style={{ marginTop: 6 }}>Что должно быть в тексте</div>
      {checks.map((c, k) => (
        <div key={k} className="write-check-edit">
          <input className="input" value={c.label} placeholder="Как увидит ученик: Наречия частоты" onChange={(e) => setCheck(k, { label: e.target.value })} />
          <input className="input" value={c.words} placeholder="Слова через |: always|usually|often" onChange={(e) => setCheck(k, { words: e.target.value })} />
          <label className="write-min"><span className="small muted">сколько</span>
            <input className="input" type="number" min="1" max="30" value={c.min} onChange={(e) => setCheck(k, { min: Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)) })} />
          </label>
          <button type="button" className="icon-btn" aria-label="Убрать пункт" onClick={() => onChange({ checks: checks.filter((_, j) => j !== k) })}><Icon name="close" size={16} /></button>
        </div>
      ))}
      <div className="row wrap" style={{ gap: 6 }}>
        {checks.length < 15 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange({ checks: [...checks, { label: '', words: '', min: 1 }] })}><Icon name="plus" /> Свой пункт</button>}
        {WRITE_PRESETS.filter((p) => !checks.some((c) => c.words === p.words)).map((p) => (
          <button type="button" key={p.name} className="chip-btn" disabled={checks.length >= 15}
            onClick={() => onChange({ checks: [...checks, { label: p.label, words: p.words, min: p.min }] })}>+ {p.name}</button>
        ))}
      </div>
      <div className="small muted">Звёздочка заменяет любое окончание или начало: <b>watch*</b> найдёт watches и watched, <b>*ed</b> любые глаголы на -ed. Фраза ищется целиком: <b>after that</b>.</div>

      <div className="row wrap" style={{ gap: 14 }}>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={b.caps} onChange={(e) => onChange({ caps: e.target.checked })} /> <span className="small">Большие буквы в начале предложений</span></label>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={b.stop} onChange={(e) => onChange({ stop: e.target.checked })} /> <span className="small">Точка в конце</span></label>
        <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={b.latin} onChange={(e) => onChange({ latin: e.target.checked })} /> <span className="small">Без русских букв</span></label>
      </div>

      <Field2 label="Начала фраз для подсказки (каждое с новой строки, необязательно)">
        <textarea className="textarea" style={{ minHeight: 60 }} value={(b.starters || []).join('\n')} placeholder={'On Mondays I usually\nAfter that,\nMy favourite part of the day is'}
          onChange={(e) => onChange({ starters: e.target.value.split('\n').map((x) => x.slice(0, 160)).slice(0, 20) })} />
      </Field2>
      <Field2 label="Пример ответа (ученик увидит после сдачи, необязательно)">
        <textarea className="textarea" style={{ minHeight: 60 }} value={b.model || ''} onChange={(e) => onChange({ model: e.target.value })} />
      </Field2>

      <details className="write-try">
        <summary className="small">Проверить чек-лист на своём тексте</summary>
        <textarea className="textarea" style={{ minHeight: 60 }} value={trial} placeholder="Вставьте текст, чтобы увидеть, что засчитает сайт" onChange={(e) => setTrial(e.target.value)} />
        {trial && preview.map((c) => <div key={c.key} className={`write-check ${c.ok ? 'ok' : ''}`}><span className="write-tick">{c.ok ? '✓' : ''}</span><span><span>{c.label}</span>{c.info && <small>{c.info}</small>}</span></div>)}
      </details>
      <MediaRow b={b} onChange={onChange} upload={upload} />
    </>
  );
}

const Field2 = ({ label, children }) => (
  <label className="stack" style={{ gap: 4 }}><span className="small muted">{label}</span>{children}</label>
);


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
