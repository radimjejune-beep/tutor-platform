// components/Folders.jsx — папки библиотеки: дерево слева, создание папки по учебнику, перенос материалов.
// Материал можно перетащить на папку мышкой или выбрать галочками и нажать «В папку».
import { useState } from 'react';
import { api } from '../api';
import { useLoad, Spinner, Modal, Field, useSubmit, useToast, Icon } from '../ui';
import { useSubject } from '../subjects';

// Плоский список с отступами: для выбора папки в select
export function folderOptions(folders) {
  const out = [];
  const walk = (parent, depth) => {
    folders.filter((f) => (f.parent_id ?? null) === parent).forEach((f) => { out.push({ ...f, depth }); walk(f.id, depth + 1); });
  };
  walk(null, 0);
  return out;
}

export function FolderSelect({ folders, value, onChange, label = 'Папка', noneLabel = 'Без папки' }) {
  return (
    <Field label={label}>
      <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">{noneLabel}</option>
        {folderOptions(folders).map((f) => <option key={f.id} value={f.id}>{'   '.repeat(f.depth)}{f.title}</option>)}
      </select>
    </Field>
  );
}

// Перетаскивание материалов: id лежат в dataTransfer
export const DRAG_TYPE = 'application/x-lessonfold-items';
export function dragItems(e, ids) {
  e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = 'move';
}
const droppedIds = (e) => { try { return JSON.parse(e.dataTransfer.getData(DRAG_TYPE) || '[]'); } catch { return []; } };

export function FolderTree({ data, current, onPick, onChanged }) {
  const toast = useToast();
  const [open, setOpen] = useState(() => new Set());
  const [closed, setClosed] = useState(() => new Set());
  const [over, setOver] = useState(null);
  const [making, setMaking] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const folders = data.folders;
  const kids = (id) => folders.filter((f) => (f.parent_id ?? null) === id);
  const total = (f) => f.count + kids(f.id).reduce((n, k) => n + total(k), 0);
  // папка открыта, если выбрана она или её подпапка
  const chain = new Set();
  for (let f = folders.find((x) => x.id === current); f; f = folders.find((x) => x.id === f.parent_id)) chain.add(f.id);

  const drop = async (e, folderId) => {
    e.preventDefault();
    setOver(null);
    const ids = droppedIds(e);
    if (!ids.length) return;
    try {
      const r = await api.moveToFolder(ids, folderId);
      toast(`Перенесено: ${r.moved}`);
      onChanged(true);
    } catch (err) { toast(err.message, 'error'); }
  };
  const target = (key, folderId) => ({
    onDragOver: (e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); setOver(key); } },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e) => drop(e, folderId),
  });
  const remove = async (f) => {
    const sub = kids(f.id).length;
    if (!window.confirm(`Удалить папку «${f.title}»${sub ? ' вместе с подпапками' : ''}? Материалы останутся в библиотеке, просто без папки.`)) return;
    try { await api.deleteFolder(f.id); if (chain.has(f.id)) onPick(''); onChanged(true); } catch (err) { toast(err.message, 'error'); }
  };
  const addSub = async (f) => {
    const title = window.prompt(`Новая папка внутри «${f.title}»`, '');
    if (!title || !title.trim()) return;
    try { await api.createFolder({ title: title.trim(), parent_id: f.id }); setOpen(new Set([...open, f.id])); onChanged(); } catch (err) { toast(err.message, 'error'); }
  };

  const row = (f, depth) => {
    const children = kids(f.id);
    const isOpen = open.has(f.id) || (chain.has(f.id) && !closed.has(f.id));
    return (
      <li key={f.id}>
        <div className={`folder-row ${current === f.id ? 'on' : ''} ${over === f.id ? 'over' : ''}`} style={{ paddingLeft: 8 + depth * 16 }} {...target(f.id, f.id)}>
          {children.length ? (
            <button type="button" className="folder-toggle" aria-label={isOpen ? 'Свернуть' : 'Развернуть'} aria-expanded={isOpen}
              onClick={() => {
                const o = new Set(open); const c = new Set(closed);
                if (isOpen) { o.delete(f.id); c.add(f.id); } else { o.add(f.id); c.delete(f.id); }
                setOpen(o); setClosed(c);
              }}>{isOpen ? '▾' : '▸'}</button>
          ) : <span className="folder-toggle" />}
          <button type="button" className="folder-name" onClick={() => onPick(f.id)} title={f.title}>
            <Icon name="folder" size={16} /> <span className="truncate">{f.title}</span>
          </button>
          <span className="folder-count">{total(f) || ''}</span>
          <span className="folder-actions">
            <button type="button" className="icon-btn" title="Папка внутри" aria-label="Папка внутри" onClick={() => addSub(f)}><Icon name="plus" size={14} /></button>
            <button type="button" className="icon-btn" title="Переименовать" aria-label="Переименовать" onClick={() => setRenaming(f)}><Icon name="edit" size={14} /></button>
            <button type="button" className="icon-btn" title="Удалить папку" aria-label="Удалить папку" onClick={() => remove(f)}><Icon name="trash" size={14} /></button>
          </span>
        </div>
        {isOpen && children.length > 0 && <ul className="folder-list">{children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <aside className="folders panel">
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="meta-label">Папки</span>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMaking(true)}><Icon name="plus" size={14} /> Папка</button>
      </div>
      <ul className="folder-list">
        <li><div className={`folder-row ${current === '' ? 'on' : ''}`}><span className="folder-toggle" /><button type="button" className="folder-name" onClick={() => onPick('')}><Icon name="library" size={16} /> Все материалы</button></div></li>
        <li><div className={`folder-row ${current === 'none' ? 'on' : ''} ${over === 'none' ? 'over' : ''}`} {...target('none', null)}><span className="folder-toggle" /><button type="button" className="folder-name" onClick={() => onPick('none')}><Icon name="layers" size={16} /> Без папки</button><span className="folder-count">{data.unfiled || ''}</span></div></li>
        {kids(null).map((f) => row(f, 0))}
      </ul>
      {!folders.length && <p className="small muted" style={{ margin: '10px 0 0' }}>Сделайте папку учебника: внутри сразу появятся папки юнитов. Материалы можно перетаскивать в папки мышкой.</p>}
      {making && <NewFolderModal folders={folders} onClose={() => setMaking(false)} onDone={(id) => { setMaking(false); onChanged(); if (id) { onPick(id); setOpen(new Set([...open, id])); } }} />}
      {renaming && <RenameModal folder={renaming} onClose={() => setRenaming(null)} onDone={() => { setRenaming(null); onChanged(); }} />}
    </aside>
  );
}

function RenameModal({ folder, onClose, onDone }) {
  const [title, setTitle] = useState(folder.title);
  const save = useSubmit(async () => { await api.updateFolder(folder.id, { title: title.trim() }); onDone(); });
  return (
    <Modal title="Переименовать папку" onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus /></Field>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Сохранить</button>
        </div>
      </form>
    </Modal>
  );
}

// Новая папка: по учебнику из банка, свой учебник с юнитами или просто папка
function NewFolderModal({ folders, onClose, onDone }) {
  const subj = useSubject();
  const books = useLoad(() => (subj.isLang ? api.bankBooks().catch(() => []) : Promise.resolve([])), []);
  const [mode, setMode] = useState(subj.isLang ? 'book' : 'own');
  const [book, setBook] = useState('');
  const [title, setTitle] = useState('');
  const [units, setUnits] = useState('');
  const [count, setCount] = useState(8);
  const [parent, setParent] = useState(null);
  const toast = useToast();
  const have = new Set(folders.filter((f) => f.book && !f.parent_id).map((f) => f.book));
  const unitList = () => {
    const typed = units.split('\n').map((s) => s.trim()).filter(Boolean);
    return typed.length ? typed : Array.from({ length: Math.max(0, Math.min(40, Number(count) || 0)) }, (_, i) => `Unit ${i + 1}`);
  };
  const save = useSubmit(async () => {
    if (mode === 'book') {
      if (!book) throw new Error('Выберите учебник');
      const r = await api.createBookFolder({ book });
      toast(`Папка создана, юнитов внутри: ${r.units}`);
      onDone(r.id);
    } else if (mode === 'own') {
      if (!title.trim()) throw new Error('Введите название учебника');
      const r = await api.createBookFolder({ title: title.trim(), units: unitList() });
      toast(`Папка создана, юнитов внутри: ${r.units}`);
      onDone(r.id);
    } else {
      if (!title.trim()) throw new Error('Введите название папки');
      const r = await api.createFolder({ title: title.trim(), parent_id: parent });
      onDone(r.id);
    }
  });
  return (
    <Modal title="Новая папка" onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <div className="seg">
          {subj.isLang && <button type="button" className={mode === 'book' ? 'on' : ''} onClick={() => setMode('book')}>Учебник из банка</button>}
          <button type="button" className={mode === 'own' ? 'on' : ''} onClick={() => setMode('own')}>Свой учебник</button>
          <button type="button" className={mode === 'plain' ? 'on' : ''} onClick={() => setMode('plain')}>Просто папка</button>
        </div>
        {mode === 'book' && (books.loading ? <Spinner /> : (
          <Field label="Учебник" hint="Внутри сразу появятся папки всех юнитов. Задания из банка будут сами ложиться в папку своего юнита.">
            <select className="select" value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">Выберите</option>
              {(books.data || []).map((b) => <option key={b.id} value={b.id} disabled={have.has(b.id)}>{b.short}{have.has(b.id) ? ' (уже есть)' : ''}</option>)}
            </select>
          </Field>
        ))}
        {mode === 'own' && (
          <>
            <Field label="Название учебника"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Например, Spotlight 5" /></Field>
            <Field label="Юниты, по одному в строке" hint="Можно оставить пустым: тогда создадутся папки Unit 1, Unit 2 и так далее.">
              <textarea className="textarea" rows={5} value={units} onChange={(e) => setUnits(e.target.value)} placeholder={'1. Hello!\n2. My family'} />
            </Field>
            {!units.trim() && <Field label="Сколько юнитов"><input className="input" type="number" min={0} max={40} value={count} onChange={(e) => setCount(e.target.value)} style={{ maxWidth: 120 }} /></Field>}
          </>
        )}
        {mode === 'plain' && (
          <>
            <Field label="Название"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Например, Разговорные темы" autoFocus /></Field>
            {folders.length > 0 && <FolderSelect folders={folders} value={parent} onChange={setParent} label="Внутри папки" noneLabel="Нет, отдельная папка" />}
          </>
        )}
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Создать</button>
        </div>
      </form>
    </Modal>
  );
}

// Переложить выбранные материалы в папку
export function MoveModal({ ids, folders, onClose, onDone }) {
  const [to, setTo] = useState(null);
  const save = useSubmit(async () => { const r = await api.moveToFolder(ids, to); onDone(r.moved); });
  return (
    <Modal title={`В папку: ${ids.length}`} onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <FolderSelect folders={folders} value={to} onChange={setTo} label="Куда" noneLabel="Убрать из папки" />
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Перенести</button>
        </div>
      </form>
    </Modal>
  );
}
