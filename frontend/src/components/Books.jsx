// components/Books.jsx — учебники преподавателя в библиотеке: загрузка частями, просмотр, папки.
// Учебники видит только преподаватель: ученикам они не показываются.
import { useState } from 'react';
import { api } from '../api';
import { useLoad, Spinner, ErrorBox, Empty, Modal, Field, Icon, useToast } from '../ui';
import { FolderSelect } from './Folders';
import { plural } from '../format';

const ACCEPT = '.pdf,.djvu,.epub,.docx,.zip,.mp3,application/pdf';
const mb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`);
const titleFromFile = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);

// Учебники в выбранной папке (и её подпапках)
function inFolder(book, folder, folders) {
  if (folder === '') return true;
  if (folder === 'none') return !book.folder_id;
  const ids = new Set([folder]);
  let grew = true;
  while (grew) { grew = false; for (const f of folders) if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) { ids.add(f.id); grew = true; } }
  return ids.has(book.folder_id);
}

export function BooksPanel({ folders, folder, uploading, setUploading, onChanged }) {
  const toast = useToast();
  const data = useLoad(() => api.books(), []);
  const [editing, setEditing] = useState(null);
  if (data.loading) return <section className="panel"><Spinner /></section>;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const { books, used, quota } = data.data;
  const shown = books.filter((b) => inFolder(b, folder, folders));
  const folderName = (id) => folders.find((f) => f.id === id)?.title;

  const open = async (b, download = false) => {
    // окно открываем сразу, иначе браузер посчитает его всплывающим
    const win = download ? null : window.open('', '_blank');
    if (win) win.document.write('<p style="font:16px sans-serif;padding:24px">Открываем учебник…</p>');
    try {
      const blob = await api.bookBlob(b.id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url; a.download = b.filename; document.body.appendChild(a); a.click(); a.remove();
      } else if (win) win.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    } catch (err) {
      win?.close();
      toast(err.message, 'error');
    }
  };
  const remove = async (b) => {
    if (!window.confirm(`Удалить учебник «${b.title}»?`)) return;
    try { await api.deleteBook(b.id); toast('Учебник удалён'); data.reload(); onChanged?.(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div className="small muted">Учебники видите только вы: ученикам они не показываются. {books.length ? `Занято ${mb(used)} из ${mb(quota)}.` : ''}</div>
          <button type="button" className="btn btn-sm" onClick={() => setUploading(true)}><Icon name="plus" size={14} /> Загрузить учебник</button>
        </div>
        {!shown.length ? (
          <Empty title={books.length ? 'В этой папке учебников нет' : 'Учебников пока нет'}
            action={<button type="button" className="btn" onClick={() => setUploading(true)}>Загрузить учебник</button>}>
            PDF, DjVu или EPUB до 200 МБ: Student's Book, Workbook, книга для учителя. Можно сразу положить в папку учебника.
          </Empty>
        ) : shown.map((b) => (
          <div key={b.id} className="assign-row book-row">
            <div className="book-icon" aria-hidden="true">{(b.filename.split('.').pop() || '').toUpperCase().slice(0, 4)}</div>
            <div className="list-main" onClick={() => open(b)} style={{ cursor: 'pointer' }}>
              <div className="list-title truncate">{b.title}</div>
              <div className="list-sub truncate">{[mb(b.size_bytes), folderName(b.folder_id)].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => open(b)}>Открыть</button>
              <button type="button" className="icon-btn" title="Скачать" aria-label="Скачать" onClick={() => open(b, true)}><Icon name="arrowDown" size={16} /></button>
              <button type="button" className="icon-btn" title="Изменить" aria-label="Изменить" onClick={() => setEditing(b)}><Icon name="edit" size={16} /></button>
              <button type="button" className="icon-btn" title="Удалить" aria-label="Удалить" onClick={() => remove(b)}><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </section>
      {uploading && <UploadModal folders={folders} folder={typeof folder === 'number' ? folder : null} info={data.data} onClose={() => setUploading(false)} onDone={() => { setUploading(false); data.reload(); onChanged?.(); }} />}
      {editing && <EditModal book={editing} folders={folders} onClose={() => setEditing(null)} onDone={() => { setEditing(null); data.reload(); }} />}
    </>
  );
}

function UploadModal({ folders, folder, info, onClose, onDone }) {
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [title, setTitle] = useState('');
  const [to, setTo] = useState(folder);
  const [progress, setProgress] = useState(null); // { file, done, total }
  const [error, setError] = useState('');

  const pick = (list) => {
    const arr = [...list];
    setFiles(arr);
    setError('');
    if (arr.length === 1) setTitle(titleFromFile(arr[0].name));
  };
  const total = files.reduce((n, f) => n + f.size, 0);

  const uploadOne = async (file, name) => {
    if (file.size > info.max_file) throw new Error(`«${file.name}» больше 200 МБ`);
    const b = await api.createBook({ title: name, filename: file.name.slice(0, 255), mime: file.type || '', size_bytes: file.size, folder_id: to });
    for (let n = 0; n < b.parts; n++) {
      const blob = file.slice(n * b.part_size, Math.min(file.size, (n + 1) * b.part_size));
      let tries = 0;
      // на плохом интернете часть может не дойти: пробуем ещё два раза
      for (;;) {
        try { await api.uploadBookPart(b.id, n, blob); break; } catch (err) { if (++tries >= 3) throw err; await new Promise((r) => setTimeout(r, 1500 * tries)); }
      }
      setProgress((p) => ({ ...p, done: p.done + blob.size }));
    }
    await api.finishBook(b.id);
  };

  const start = async () => {
    if (!files.length) return setError('Выберите файл');
    if (info.used + total > info.quota) return setError('Не хватает места: удалите ненужные учебники');
    setError('');
    setProgress({ done: 0, total, file: '' });
    try {
      for (const f of files) {
        setProgress((p) => ({ ...p, file: f.name }));
        await uploadOne(f, files.length === 1 ? (title.trim() || titleFromFile(f.name)) : titleFromFile(f.name));
      }
      toast(files.length > 1 ? `Загружено учебников: ${files.length}` : 'Учебник загружен');
      onDone();
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  };

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  return (
    <Modal title="Загрузить учебник" onClose={progress ? () => {} : onClose}>
      <div className="form">
        <label className={`book-drop ${files.length ? 'has' : ''}`}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!progress) pick(e.dataTransfer.files); }}>
          <input type="file" accept={ACCEPT} multiple disabled={Boolean(progress)} onChange={(e) => pick(e.target.files)} />
          <Icon name="book" size={22} />
          {files.length
            ? <span><b>{files.length === 1 ? files[0].name : `${files.length} ${plural(files.length, 'файл', 'файла', 'файлов')}`}</b><small>{mb(total)}</small></span>
            : <span><b>Выберите или перетащите файл</b><small>PDF, DjVu, EPUB, DOCX, ZIP, MP3 до 200 МБ</small></span>}
        </label>
        {files.length === 1 && <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={Boolean(progress)} /></Field>}
        {folders.length > 0 && <FolderSelect folders={folders} value={to} onChange={setTo} />}
        {progress && (
          <div className="book-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="row-between small"><span className="truncate">{progress.file}</span><span>{pct}%</span></div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <div className="small muted">Не закрывайте вкладку до конца загрузки</div>
          </div>
        )}
        {error && <div className="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={Boolean(progress)}>Отмена</button>
          <button type="button" className="btn" onClick={start} disabled={Boolean(progress) || !files.length}>{progress ? 'Загружаем…' : 'Загрузить'}</button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({ book, folders, onClose, onDone }) {
  const toast = useToast();
  const [title, setTitle] = useState(book.title);
  const [to, setTo] = useState(book.folder_id ?? null);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.updateBook(book.id, { title: title.trim(), folder_id: to }); onDone(); } catch (err) { toast(err.message, 'error'); setBusy(false); }
  };
  return (
    <Modal title="Учебник" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
        {folders.length > 0 && <FolderSelect folders={folders} value={to} onChange={setTo} />}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={busy}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
}
