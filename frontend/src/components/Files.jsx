// components/Files.jsx — список файлов с превью и кнопка «Прикрепить»
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icon, useToast } from '../ui';

const isImage = (mime) => /^image\//.test(mime);
const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);

function kindLabel(f) {
  if (isImage(f.mime)) return 'Фото';
  if (f.mime === 'application/pdf') return 'PDF';
  if (/^audio\//.test(f.mime)) return 'Аудио';
  if (/^video\//.test(f.mime)) return 'Видео';
  const ext = f.filename.split('.').pop();
  return ext && ext !== f.filename ? ext.toUpperCase() : 'Файл';
}

// Миниатюра картинки: файл загружается с токеном, поэтому через blob
function Thumb({ file }) {
  const [url, setUrl] = useState(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let alive = true;
    let u;
    api.fileBlob(file.id).then((b) => {
      u = URL.createObjectURL(b);
      if (alive) setUrl(u);
    }).catch(() => {});
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [file.id]);
  return url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : <span className="file-kind">Фото</span>;
}

export function FileList({ files, canDelete, onDeleted, empty }) {
  const toast = useToast();

  const open = async (f) => {
    // Открываем вкладку сразу (иначе браузер заблокирует как всплывающее окно), потом подставляем файл
    const win = isImage(f.mime) || f.mime === 'application/pdf' ? window.open('', '_blank') : null;
    try {
      const blob = await api.fileBlob(f.id);
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = f.filename;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      win?.close();
      toast(err.message, 'error');
    }
  };

  const remove = async (f) => {
    if (!window.confirm(`Удалить «${f.filename}»?`)) return;
    try {
      await api.deleteFile(f.id);
      onDeleted?.(f);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (!files?.length) return empty || null;

  return (
    <div className="files">
      {files.map((f) => (
        <div key={f.id} className="file">
          <button type="button" className="file-main" onClick={() => open(f)} title="Открыть">
            <span className="file-thumb">{isImage(f.mime) ? <Thumb file={f} /> : <span className="file-kind">{kindLabel(f)}</span>}</span>
            <span className="file-text">
              <span className="file-name">{f.filename}</span>
              <span className="file-size">{kindLabel(f)}, {kb(f.size_bytes)}</span>
            </span>
          </button>
          {canDelete?.(f) && (
            <button type="button" className="icon-btn" aria-label={`Удалить ${f.filename}`} onClick={() => remove(f)}>
              <Icon name="close" size={18} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Кнопка «Прикрепить файл»: upload(file) должен вернуть сохранённый файл
export function FileUploadButton({ upload, onUploaded, label = 'Прикрепить файл', accept, className = 'btn btn-secondary btn-sm' }) {
  const toast = useToast();
  const input = useRef();
  const [busy, setBusy] = useState(0);

  const pick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    for (const file of list) {
      setBusy((n) => n + 1);
      try {
        const saved = await upload(file);
        onUploaded?.(saved);
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };

  return (
    <>
      <input ref={input} type="file" multiple hidden accept={accept} onChange={pick} />
      <button type="button" className={className} disabled={busy > 0} onClick={() => input.current.click()}>
        <Icon name="clip" /> {busy ? 'Загружаем…' : label}
      </button>
    </>
  );
}
