// components/Materials.jsx — материалы задания как в Google Classroom:
// фото галереей (открываются крупно), аудио и видео сразу с плеером, ссылки карточками, YouTube прямо в задании.
// Здесь же загрузка: перетащить файлы, выбрать или записать голос.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, useToast } from '../ui';
import { FileList } from './Files';
import { useFileUrl } from '../games/Sheet';

const isImage = (f) => /^image\//.test(f.mime);
const isAudio = (f) => /^audio\//.test(f.mime);
const isVideo = (f) => /^video\//.test(f.mime);

export function youtubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'ссылка'; } };
const LINK_NAMES = { 'wordwall.net': 'Wordwall', 'quizlet.com': 'Quizlet', 'docs.google.com': 'Google Документы', 'drive.google.com': 'Google Диск', 'disk.yandex.ru': 'Яндекс Диск', 'holst.so': 'Холст', 'miro.com': 'Miro', 'liveworksheets.com': 'Liveworksheets', 'learningapps.org': 'LearningApps', 'vk.com': 'ВКонтакте', 'rutube.ru': 'Rutube' };

export default function Materials({ files = [], links = [], canDelete, onDeleted }) {
  const images = files.filter(isImage);
  const audio = files.filter(isAudio);
  const video = files.filter(isVideo);
  const other = files.filter((f) => !isImage(f) && !isAudio(f) && !isVideo(f));
  const [open, setOpen] = useState(null);
  const toast = useToast();
  if (!files.length && !links.length) return null;

  const remove = async (f) => {
    if (!window.confirm(`Удалить «${f.filename}»?`)) return;
    try { await api.deleteFile(f.id); onDeleted?.(f); } catch (err) { toast(err.message, 'error'); }
  };
  const del = (f) => canDelete?.(f) && (
    <button type="button" className="icon-btn mat-del" aria-label={`Удалить ${f.filename}`} onClick={(e) => { e.stopPropagation(); remove(f); }}><Icon name="close" size={16} /></button>
  );

  return (
    <div className="materials">
      {images.length > 0 && (
        <div className="mat-gallery">
          {images.map((f, i) => (
            <div key={f.id} className="mat-photo">
              <button type="button" onClick={() => setOpen(i)} aria-label={`Открыть ${f.filename}`}><Img id={f.id} /></button>
              {del(f)}
            </div>
          ))}
        </div>
      )}
      {audio.map((f) => (
        <div key={f.id} className="mat-audio">
          <span className="mat-audio-name"><Icon name="sound" size={16} /> {f.filename.replace(/\.[^.]+$/, '')}</span>
          <Player id={f.id} />
          {del(f)}
        </div>
      ))}
      {video.map((f) => (
        <div key={f.id} className="mat-video"><Player id={f.id} video />{del(f)}</div>
      ))}
      {links.map((url) => {
        const yt = youtubeId(url);
        if (yt) {
          return (
            <div key={url} className="mat-yt">
              <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Видео" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            </div>
          );
        }
        const h = host(url);
        return (
          <a key={url} className="mat-link" href={url} target="_blank" rel="noreferrer">
            <span className="mat-link-icon"><Icon name="send" size={16} /></span>
            <span className="mat-link-text">
              <span className="mat-link-title">{LINK_NAMES[h] || h}</span>
              <span className="mat-link-url">{url.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </span>
          </a>
        );
      })}
      {other.length > 0 && <FileList files={other} canDelete={canDelete} onDeleted={onDeleted} />}
      {open !== null && <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Img({ id }) {
  const url = useFileUrl(id);
  return url ? <img src={url} alt="" loading="lazy" /> : <span className="mat-wait" />;
}

function Player({ id, video }) {
  const url = useFileUrl(id);
  if (!url) return <span className="small muted">Загружаем…</span>;
  return video ? <video src={url} controls preload="metadata" /> : <audio src={url} controls preload="metadata" />;
}

// Фото на весь экран: стрелки, свайп, Esc
function Lightbox({ images, index, onIndex, onClose }) {
  const f = images[index];
  const url = useFileUrl(f.id);
  const startX = useRef(null);
  const go = (d) => onIndex((index + d + images.length) % images.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  return (
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (startX.current === null) return; const dx = e.changedTouches[0].clientX - startX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); startX.current = null; }}>
      {url && <img src={url} alt={f.filename} />}
      <button type="button" className="lb-close" aria-label="Закрыть" onClick={onClose}><Icon name="close" /></button>
      {images.length > 1 && (
        <>
          <button type="button" className="lb-nav lb-prev" aria-label="Предыдущее" onClick={() => go(-1)}><Icon name="back" /></button>
          <button type="button" className="lb-nav lb-next" aria-label="Следующее" onClick={() => go(1)}><Icon name="back" /></button>
          <div className="lb-count">{index + 1} / {images.length}</div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Загрузка: перетащить, выбрать, записать голос
   upload(file) → сохранённый файл; onUploaded вызывается после каждого
   ============================================================ */
export function UploadArea({ upload, onUploaded, hint = 'Фото, аудио, PDF, до 10 МБ каждый', voice = true }) {
  const toast = useToast();
  const input = useRef();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);

  const send = async (list) => {
    for (const file of list) {
      setBusy((n) => n + 1);
      try {
        onUploaded?.(await upload(file));
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  return (
    <div className={`upload-area ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); send(Array.from(e.dataTransfer.files || [])); }}>
      <input ref={input} type="file" multiple hidden onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; send(l); }} />
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current.click()} disabled={busy > 0}>
          <Icon name="clip" /> {busy ? `Загружаем${busy > 1 ? ` (${busy})` : ''}…` : 'Добавить файлы'}
        </button>
        {voice && <RecordButton onFile={(f) => send([f])} />}
      </div>
      <span className="small muted">{over ? 'Отпустите, чтобы загрузить' : `Или перетащите сюда. ${hint}`}</span>
    </div>
  );
}

// Записать голос в браузере → файл
export function RecordButton({ onFile, label = 'Записать голос' }) {
  const toast = useToast();
  const [rec, setRec] = useState(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef([]);
  useEffect(() => {
    if (!rec) return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = (r.mimeType || 'audio/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const d = new Date();
        const name = `Запись ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${d.getHours()}-${String(d.getMinutes()).padStart(2, '0')}.${ext}`;
        onFile(new File(chunks.current, name, { type }));
      };
      r.start();
      setSecs(0);
      setRec(r);
    } catch {
      toast('Нет доступа к микрофону. Разрешите его в настройках браузера', 'error');
    }
  };
  const stop = () => { rec?.stop(); setRec(null); };
  return rec ? (
    <button type="button" className="btn btn-danger-soft btn-sm" onClick={stop}>
      <span className="rec-dot" /> Остановить {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
    </button>
  ) : (
    <button type="button" className="btn btn-secondary btn-sm" onClick={start}><Icon name="sound" /> {label}</button>
  );
}

/* ============================================================
   Личные комментарии к работе
   ============================================================ */
export function Comments({ homeworkId }) {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.homeworkComments(homeworkId).then(setList).catch(() => setList([]));
  }, [homeworkId]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const c = await api.addHomeworkComment(homeworkId, text.trim());
      setList((l) => [...(l || []), c]);
      setText('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const when = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
  return (
    <div className="comments">
      <div className="meta-label">Личные комментарии</div>
      {list?.map((c) => (
        <div key={c.id} className={`comment ${c.mine ? 'mine' : ''}`}>
          <div className="comment-head"><b>{c.mine ? 'Вы' : c.full_name || 'Удалённый пользователь'}</b><span>{when(c.created_at)}</span></div>
          <div className="comment-body">{c.body}</div>
        </div>
      ))}
      <form className="comment-form" onSubmit={send}>
        <textarea className="textarea" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Написать комментарий"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e); }} />
        <button className="btn btn-sm" disabled={busy || !text.trim()}><Icon name="send" /> Отправить</button>
      </form>
    </div>
  );
}
