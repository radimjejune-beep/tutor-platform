import MaterialTray,{useMaterialTray} from '../../components/MaterialTray';
import MaterialPreview from '../../components/MaterialPreview';
import {readWorkspace,saveWorkspace,finishWorkspaceScroll} from '../../workspace-state';
import ActivityActions from '../../components/ActivityActions';
import { BackLink } from '../../Shell';
// pages/tutor/Library.jsx — библиотека преподавателя: теория и задачник
import { useSubject, hasBank } from '../../subjects';
import { FolderTree, FolderSelect, MoveModal, dragItems } from '../../components/Folders';
import { BooksPanel } from '../../components/Books';
import FormulaBar from '../../components/FormulaBar';
import { useEffect,useRef,useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { ScrollTabs, useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Field, Link, Modal, navigate, useToast, useSubmit, readDraft, clearDraft, useDraftSave, DraftNotice } from '../../ui';
import { FileList, FileUploadButton } from '../../components/Files';
import HtmlLesson from '../../components/HtmlLesson';
import LibraryItem, { ItemMeta, examLabel } from '../../components/LibraryItem';
import { PublishButton } from './Market';
import GameEditor, { GameTypePicker, EMPTY_GAME, cleanGame } from '../../games/Editors';
import { GAME_TYPES, SHEET_PRESETS, gameSize } from '../../games/logic';
import { relativeDay, dayMonth, time } from '../../format';
import GamePlayer from '../../games/Players';
import { DeckEditor, DeckTemplatePicker, deckFromTemplate, parseDeck } from '../../components/Deck';

const KINDS = { all:'Все материалы', task: 'Задачник', game: 'Упражнения', html: 'Уроки', theory: 'Теория', books: 'Учебники' };
const KIND_PATH = { all:'all', task: 'tasks', game: 'games', html: 'lessons', deck: 'lessons', theory: 'theory', books: 'books' };
const NEW_LABEL = { task: 'Задача', game: 'Упражнение', html: 'Урок', deck: 'Урок из слайдов', theory: 'Теория', books: 'Учебник' };
function libraryReturnPath(){const p=readWorkspace('library-origin',{path:'/library'}).path;return /^\/library(?:\/(?:all|tasks|games|lessons|theory|books))?$/.test(p)?p:'/library';}
const orNull = (v) => (v && String(v).trim() ? String(v).trim() : null);

/* ============================================================
   Фильтры (общие для списка и выбора задач)
   ============================================================ */
// Последняя открытая папка запоминается в браузере (если хранилище недоступно, просто «Все материалы»)
function saveFolder(v){const f=readWorkspace('library',{});saveWorkspace('library',{...f,folder:v});}
function useFilters(kind,withFolder=false){
 const defaults={kind,subject:'',exam:'',exam_task:'',tag:'',q:'',fav:false,folder:''};
 const [f,setF]=useState(()=>withFolder?{...readWorkspace('library',defaults),kind}:defaults);
 useEffect(()=>{if(withFolder)saveWorkspace('library',f);},[f,withFolder]);
 useEffect(()=>{setF(p=>({...p,kind}));},[kind]);
 return [f,setF];
}

function Filters({ f, setF, facets }) {
  return (
    <div className="lib-filters">
      <input className="input" type="search" aria-label="Поиск по библиотеке" placeholder="Поиск по названию, тексту и заметкам" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      {f.kind !== 'theory' && (
        <button type="button" className={`btn btn-sm fav-filter ${f.fav ? 'on' : ''}`} aria-pressed={f.fav} onClick={() => setF({ ...f, fav: !f.fav })}>
          <Icon name="star" size={16} /> Избранное
        </button>
      )}
      <details className="library-advanced" open={Boolean(f.subject||f.exam||f.tag)}><summary>Фильтры</summary><div className="library-advanced-fields">      {facets.subjects.length > 1 && (
        <select className="select" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-label="Предмет">
          <option value="">Все предметы</option>
          {facets.subjects.map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      <select className="select" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value, exam_task: '' })} aria-label="Экзамен">
        <option value="">Любой экзамен</option>
        <option>ОГЭ</option><option>ЕГЭ</option><option>ВПР</option>
      </select>
      {f.exam && (
        <input className="input" type="number" min={1} max={50} placeholder="№ задания" value={f.exam_task}
          onChange={(e) => setF({ ...f, exam_task: e.target.value })} style={{ maxWidth: 130 }} />
      )}
      {facets.tags.length > 0 && (
        <select className="select" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} aria-label="Тег">
          <option value="">Все теги</option>
          {facets.tags.map((t) => <option key={t} value={t}>#{t}</option>)}
        </select>
      )}</div></details>{(f.q||f.fav||f.subject||f.exam||f.tag)&&<button className="btn btn-quiet btn-sm" type="button" onClick={()=>setF({...f,q:'',subject:'',exam:'',exam_task:'',tag:'',fav:false})}>Сбросить фильтры</button>}
    </div>
  );
}

const loadList = (f) => api.library({ kind: f.kind==='all'?'':f.kind, subject: f.subject, exam: f.exam, exam_task: f.exam_task, tag: f.tag, q: f.q, fav: f.fav ? 1 : '', folder: f.folder || '' });

// Звёздочка: избранные задачи быстро находятся на уроке
function FavStar({ item, onChanged }) {
  const toast = useToast();
  const [on, setOn] = useState(Boolean(item.favorite));
  const flip = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOn(!on);
    try {
      await api.updateLibraryItem(item.id, { favorite: !on });
      onChanged?.();
    } catch (err) {
      setOn(on);
      toast(err.message, 'error');
    }
  };
  return (
    <button type="button" className={`fav-star ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Убрать из избранного' : 'В избранное'} onClick={flip}>
      <Icon name="star" size={18} />
    </button>
  );
}

// Лист с заданиями создаётся сразу: к нему прикрепляются фото и аудио
async function createSheet(title, type = 'sheet') {
  try {
    const created = await api.createLibraryItem({ kind: 'game', title: (title || '').trim() || SHEET_PRESETS[type]?.label || GAME_TYPES[type]?.label || 'Лист с заданиями', game: EMPTY_GAME[type] });
    navigate(`/library/${created.id}`);
  } catch (err) {
    window.alert(err.message);
  }
}

/* ============================================================
   Список
   ============================================================ */
export function LibraryPage({ kind = 'all' }) {
  const subj = useSubject();
  const toast = useToast();
  const [f, setF] = useFilters(kind, true);
  const [wideFolders,setWideFolders]=useState(()=>window.matchMedia('(min-width:1024px)').matches);
  useEffect(()=>{const media=window.matchMedia('(min-width:1024px)'),on=()=>setWideFolders(media.matches);media.addEventListener('change',on);return()=>media.removeEventListener('change',on);},[]);
  const rememberList=()=>saveWorkspace('library-origin',{path:window.location.hash.slice(1)});
  const [query,setQuery]=useState(f.q),[more,setMore]=useState(false),[add,setAdd]=useState(false),[page,setPage]=useState(()=>readWorkspace('library-page',{page:1}).page),[sort,setSort]=useState(()=>readWorkspace('library-page',{sort:'recent'}).sort);
  const previousFilter=useRef('');
  useEffect(()=>{const timer=setTimeout(()=>setQuery(f.q),250);return()=>clearTimeout(timer);},[f.q]);
  useEffect(()=>{saveWorkspace('library-page',{page,sort});},[page,sort]);
  const facets = useLoad(() => api.libraryFacets(), []);
  const isBooks = kind === 'books';
  const [uploading, setUploading] = useState(false);
  const list = useLoad(() => (isBooks ? Promise.resolve([]) : loadList({ ...f,kind,q:query })), [kind, f.subject, f.exam, f.exam_task, f.tag, query, f.fav, f.folder]);
  const folders = useLoad(() => api.folders().then((r) => ({ folders: Array.isArray(r?.folders) ? r.folders : [], unfiled: r?.unfiled || 0 })).catch(() => ({ folders: [], unfiled: 0 })), []);
  const tray=useMaterialTray(),[preview,setPreview]=useState(null);
  const selected=new Set(tray.items.filter(i=>i.source==='library').map(i=>i.id));
  const setSelected=()=>tray.clearSource('library');
  const [toLesson, setToLesson] = useState(false);
  const [moving, setMoving] = useState(false);
  const pickFolder = (v) => { saveFolder(v); setF({ ...f, folder: v }); };
  const folderList = folders.data?.folders || [];
  // если папку удалили, а она была выбрана
  const folderNow = f.folder && f.folder !== 'none' && folders.data && !folderList.some((x) => x.id === f.folder) ? '' : f.folder;
  const curFolder = folderList.find((x) => x.id === folderNow);
  const rows=[...(list.data||[])].sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'ru'):sort==='favorite'?Number(b.favorite)-Number(a.favorite)||a.title.localeCompare(b.title,'ru'):String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
  const pages=Math.max(1,Math.ceil(rows.length/12)),currentPage=Math.min(page,pages),visible=rows.slice((currentPage-1)*12,currentPage*12);
  const canAssign=tray.items.filter(i=>i.source==='library').every(i=>i.kind!=='theory');
  useEffect(()=>{const signature=JSON.stringify([kind,f.subject,f.exam,f.exam_task,f.tag,f.q,f.fav,f.folder]);if(previousFilter.current&&previousFilter.current!==signature){setPage(1);}previousFilter.current=signature;},[kind,f]);
  useEffect(()=>{if(folders.data&&f.folder&&f.folder!=='none'&&!folderList.some(x=>x.id===f.folder)){setF(p=>({...p,folder:''}));saveFolder('');}},[folders.data,f.folder]);
  useEffect(()=>{if(!list.loading&&list.data)finishWorkspaceScroll();},[list.loading,list.data]);
  const newHref = `/library/new?kind=${kind}${typeof folderNow === 'number' ? `&folder=${folderNow}` : ''}`;

  const toggle = id => {const item=list.data?.find(i=>i.id===id);if(item)tray.toggle('library',item);};

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Библиотека</h1>
          <div className="lead">{isBooks ? 'Учебники и книги для учителя в PDF: открываются прямо в браузере, видите только вы' : kind==='all'?'Ваши задания, упражнения, уроки и теория вместе. PDF-учебники — в отдельной вкладке.':kind === 'theory' ? 'Теорию видят все ученики в разделе «Теория»' : 'Видите только вы. Ученик увидит задачу или упражнение, когда вы выдадите их на уроке или в задании'}</div>
        </div>
        <div className="row wrap library-header-actions">
          <Link to="/bank" className="btn btn-secondary"><Icon name="library"/>Найти в банке</Link>
          <details className="library-create-menu"><summary className="btn btn-secondary">Импорт и конструкторы</summary><div className="library-create-options">
          {!isBooks&&<ImportButton onDone={()=>{list.reload();facets.reload();}}/>}
          <button className="btn btn-secondary" onClick={()=>createSheet('', 'board')}>Конструктор упражнения</button>
          <button className="btn btn-secondary" onClick={()=>createSheet()}>Лист из фото</button>
          <Link to="/library/generate" className="btn btn-secondary">По тексту или видео</Link></div></details>
          {isBooks?<button className="btn" onClick={()=>setUploading(true)}><Icon name="plus"/>Учебник</button>:<button className="btn" onClick={()=>setAdd(true)}><Icon name="plus"/>Добавить материал</button>}
        </div>
      </div>

      <ScrollTabs label="Виды материалов">
        {Object.entries(KINDS).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'active' : ''}
            onClick={() => { navigate(`/library/${KIND_PATH[k]}`); }}>{label}</button>
        ))}
        {hasBank(subj.subject) && <button role="tab" aria-selected={false} onClick={() => navigate('/bank')}><Icon name="library" size={16} /> Банк заданий</button>}
      </ScrollTabs>

      <div className="lib-layout">
      {folders.data && <details className="library-folder-browser" open={wideFolders}><summary>Папки · {curFolder?.title|| (folderNow==='none'?'Без папки':'Все материалы')}</summary><FolderTree data={folders.data} current={folderNow} onPick={pickFolder} onChanged={(items) => { folders.reload(); if (items) { list.reload(); setSelected(new Set()); } }} /></details>}
      <div className="lib-main">
      {curFolder && <h2 className="section-title" style={{ margin: '0 0 12px' }}><Icon name="folder" size={18} /> {curFolder.title}</h2>}
      {isBooks && <BooksPanel folders={folderList} folder={folderNow} uploading={uploading} setUploading={setUploading} onChanged={() => folders.reload()} />}
      {!isBooks && facets.data && <Filters f={f} setF={setF} facets={facets.data} />}

      {!isBooks && selected.size > 0 && (
        <div className="select-bar">
          <span>Выбрано: {selected.size}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>Сбросить</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setMoving(true)}><Icon name="folder" size={14} /> В папку</button>
          </div>
        </div>
      )}

      {!isBooks&&<div className="library-results-toolbar"><span className="small muted" role="status">Найдено материалов: {rows.length}</span><label className="field">Порядок<select className="select" aria-label="Порядок материалов" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="recent">Недавно изменённые</option><option value="title">По названию</option><option value="favorite">Избранное сначала</option></select></label></div>}
      {!isBooks && <section className="panel library-result-list" aria-busy={list.loading}>
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !list.data.length && (
          <Empty title={f.fav && !f.q ? 'В избранном пусто' : f.q || f.exam || f.tag ? 'Ничего не нашлось' : folderNow ? 'В этой папке пусто' : { all:'Материалов пока нет',task: 'Задачник пуст', game: 'Упражнений пока нет', html: 'Уроков пока нет', theory: 'Теории пока нет' }[kind]}
            action={<button className="btn" onClick={()=>setAdd(true)}>Добавить материал</button>}>
            {folderNow && !f.q && !f.fav && 'В этой папке пока нет материалов этого вида. Перетащите сюда материалы из «Все материалы» или добавьте новый. '}
            {f.fav && 'Нажмите звёздочку у задачи, чтобы она появилась здесь и в выборе задач на уроке.'}
            {kind === 'task' && !f.q && !f.fav && 'Добавляйте задачи с пометками: номер задания ОГЭ/ЕГЭ, теги, заметка для себя.'}
            {kind === 'html' && !f.q && 'Соберите урок из слайдов в конструкторе: текст, картинки, слова с озвучкой, вопросы с таймером, упражнения и заметки для вас. Или загрузите готовый HTML-урок. Урок можно показать на занятии и выдать как ДЗ.'}
            {kind === 'game' && !f.q && 'Найди пару, собери предложение, вставь пропуск, распредели по группам. Ученик проходит прямо в кабинете, оценка ставится сама.'}
          </Empty>
        )}
        {visible.map((i) => (
          <div key={i.id} className="assign-row" inert={list.loading?'':undefined} data-row-native role="group" aria-label={`Материал: ${i.title}`} onClick={()=>{rememberList();navigate(`/library/${i.id}`);}} draggable
            onDragStart={(e) => dragItems(e, selected.has(i.id) ? [...selected] : [i.id])} title="Можно перетащить в папку">
            {(
              <input type="checkbox" className="row-check" disabled={!selected.has(i.id)&&tray.items.length>=40} checked={selected.has(i.id)} aria-label={`Выбрать материал: ${i.title}`}
                onClick={(e) => e.stopPropagation()} onChange={() => toggle(i.id)} />
            )}
            <div className="list-main">
              <Link className="list-title truncate row-title-link" to={`/library/${i.id}`} onClick={e=>{e.stopPropagation();rememberList();}}>{i.title}</Link>
              <div className="list-sub truncate">
                {[!folderNow && i.folder_id && folderList.find((x) => x.id === i.folder_id)?.title, i.game && `${GAME_TYPES[i.game.type]?.label}, ${gameSize(i.game)}`, i.kind === 'html' && 'Интерактивный урок', i.kind === 'deck' && 'Урок из слайдов', examLabel(i), i.subject, ...(i.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ')}
              </div>
              {i.tutor_note && <div className="list-sub truncate" style={{ color: '#7a5717' }}><Icon name="note" size={13} /> {i.tutor_note}</div>}
            </div>
            <button type="button" className="btn btn-secondary btn-sm library-preview-trigger" onClick={e=>{e.stopPropagation();setPreview(i.id);}}>Посмотреть</button>
            {i.files_count > 0 && <Badge>Файлов: {i.files_count}</Badge>}
            {kind !== 'theory' && <FavStar item={i} onChanged={f.fav||sort==='favorite' ? list.reload : undefined} />}
          </div>
        ))}
      {pages>1&&<nav className="workspace-pagination" aria-label="Страницы библиотеки"><button className="btn btn-secondary" disabled={currentPage===1} onClick={()=>setPage(p=>p-1)}>Назад</button><span>{currentPage} из {pages}</span><button className="btn btn-secondary" disabled={currentPage===pages} onClick={()=>setPage(p=>p+1)}>Дальше</button></nav>}
      </section>}

      </div>
      </div>

      {add&&<Modal title="Добавить материал" onClose={()=>setAdd(false)}><p className="muted">Выберите, что хотите подготовить. Материал останется в вашей библиотеке.</p><div className="library-add-types">{[['game','Интерактивное упражнение','Практика с автоматической проверкой'],['deck','Урок из слайдов','Объяснение и задания на одном занятии'],['html','Готовый HTML-урок','Загрузить свой интерактивный файл'],['theory','Объяснение темы','Теория для ваших учеников'],['task','Задача или письменная работа','Условие, решение и приложения']].map(([k,title,hint])=><Link key={k} className="library-add-type" to={`/library/new?kind=${k}${typeof folderNow==='number'?`&folder=${folderNow}`:''}`} onClick={()=>{rememberList();setAdd(false);}}><b>{title}</b><span className="small muted">{hint}</span></Link>)}</div></Modal>}
      <MaterialTray/>
      {preview&&<MaterialPreview id={preview} onClose={()=>setPreview(null)}/>}
      {toLesson && (
        <AddToLessonModal itemIds={[...selected]} onClose={() => setToLesson(false)} onDone={() => { setToLesson(false); setSelected(new Set()); }} />
      )}
      {moving && <MoveModal ids={[...selected]} folders={folderList} onClose={() => setMoving(false)} onDone={(n) => { setMoving(false); toast(`Перенесено: ${n}`); setSelected(new Set()); list.reload(); folders.reload(); }} />}
    </>
  );
}

/* ============================================================
   Добавить выбранные задачи к уроку
   ============================================================ */
function AddToLessonModal({ itemIds, onClose, onDone }) {
  const toast = useToast();
  const from = new Date(Date.now() - 3 * 3600e3).toISOString();
  const to = new Date(Date.now() + 14 * 864e5).toISOString();
  const lessons = useLoad(() => api.lessons({ from, to }), []);
  const upcoming = (lessons.data || []).filter((l) => l.status === 'scheduled');

  const add = async (l) => {
    try {
      const room = await api.lessonRoom(l.id);
      await api.setLessonItems(l.id, [...room.items.map((i) => i.id), ...itemIds]);
      toast(`Добавлено в урок: ${l.student_name}`);
      onDone();
      navigate(`/lesson/${l.id}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal title="Добавить к уроку" onClose={onClose}>
      {lessons.loading && <Spinner />}
      {lessons.data && !upcoming.length && <Empty title="Ближайших уроков нет" />}
      <div className="list">
        {upcoming.map((l) => (
          <div key={l.id} className="list-item clickable" onClick={() => add(l)}>
            <div className="time-chip">{time(l.starts_at)}</div>
            <div className="list-main">
              <div className="list-title">{l.student_name}</div>
              <div className="list-sub">{relativeDay(l.starts_at)}, {dayMonth(l.starts_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ============================================================
   Просмотр и редактирование материала
   ============================================================ */
export function LibraryEditor({ id, presetKind, presetFolder }) {
  const item = useLoad(() => (id ? api.libraryItem(id) : Promise.resolve(null)), [id]);
  const facets = useLoad(() => api.libraryFacets(), []);
  const folders = useLoad(() => api.folders().then((r) => (Array.isArray(r?.folders) ? r.folders : [])).catch(() => []), []);
  if (item.loading || facets.loading || folders.loading) return <Spinner />;
  if (item.error) return <ErrorBox error={item.error} onRetry={item.reload} />;
  return <EditorForm key={id || 'new'} item={item.data} presetKind={presetKind} presetFolder={presetFolder} folders={folders.data || []} facets={facets.data || { subjects: [], tags: [] }} reload={item.reload} />;
}

function EditorForm({ item, presetKind, presetFolder, folders, facets, reload }) {
  const { user } = useAuth();
  const tagHint = useSubjectTags();
  const toast = useToast();
  const isNew = !item;
  // Черновик: незаконченный материал сохраняется в браузере и возвращается при следующем открытии
  const dkey = isNew ? `lib:new:${presetKind || 'task'}` : `lib:${item.id}`;
  const [base] = useState(() => ({
    kind: item?.kind || presetKind || 'task',
    subject: item?.subject || user.subject || facets.subjects[0] || '',
    title: item?.title || '',
    body: item?.body || '',
    answer: item?.answer || '',
    exam: item?.exam || '',
    exam_task: item?.exam_task ?? '',
    tags: (item?.tags || []).join(', '),
    tutor_note: item?.tutor_note || '',
    links: (item?.links || []).join('\n'),
    game: item?.game || null,
    html: item?.kind === 'deck' ? null : item?.html || null,
    deck: item?.kind === 'deck' ? parseDeck(item.html) : null,
    folder_id: item ? item.folder_id ?? null : (Number(presetFolder) || null),
  }));
  const [draft] = useState(() => readDraft(dkey));
  const [f, setF] = useState(() => (draft?.value ? { ...base, ...draft.value } : base));
  const [restoredAt, setRestoredAt] = useState(draft?.value ? draft.at : null);
  const [baseJson] = useState(() => JSON.stringify(base));
  // Большой загруженный урок (html) в черновик не кладём: он и так приходит с сервера
  const snapshot = f.html && f.html.length > 200000 ? { ...f, html: base.html } : f;
  useDraftSave(dkey, snapshot, JSON.stringify(f) !== baseJson);
  const resetDraft = () => { clearDraft(dkey); setF(base); setRestoredAt(null); };
  const [pending, setPending] = useState([]);
  const [preview, setPreview] = useState(false);
  const [choosing,setChoosing]=useState(false),[picking,setPicking]=useState(false),[pickError,setPickError]=useState('');
  const assignAfter=useRef(false),createdId=useRef(null),uploaded=useRef(new Set());
  const needsFormat=f.kind==='game'&&!f.game;
  const openPreview=()=>{setPreview(p=>!p);window.scrollTo({top:0,behavior:'instant'});};

  const body = () => ({
    kind: f.kind,
    subject: f.subject.trim() || user.subject,
    title: f.title.trim(),
    body: orNull(f.body),
    answer: f.kind === 'task' ? orNull(f.answer) : null,
    exam: f.exam || null,
    exam_task: f.exam && f.exam_task !== '' ? Number(f.exam_task) : null,
    tags: f.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
    tutor_note: orNull(f.tutor_note),
    links: f.links.split(/\s+/).map((s) => s.trim()).filter(Boolean),
    game: f.kind === 'game' && f.game ? cleanGame(f.game) : null,
    html: f.kind === 'html' ? f.html : f.kind === 'deck' && f.deck ? JSON.stringify(f.deck) : null,
    folder_id: f.folder_id ?? null,
  });

  const save = useSubmit(async () => {
    if (f.kind === 'game' && !f.game) throw new Error('Выберите тип упражнения');
    if (f.kind === 'html' && !f.html) throw new Error('Загрузите файл урока (.html)');
    if (f.kind === 'deck' && !f.deck) throw new Error('Выберите шаблон урока');
    if (isNew) {
      const created=createdId.current?await api.updateLibraryItem(createdId.current,body()).then(()=>({id:createdId.current})):await api.createLibraryItem(body());
      createdId.current=created.id;
      for(const file of pending){if(!uploaded.current.has(file)){await api.uploadFile({library_item_id:created.id},file);uploaded.current.add(file);}}
      clearDraft(dkey);
      toast('Добавлено в библиотеку');
      navigate(assignAfter.current?`/homework/new?items=${created.id}`:`/library/${created.id}`);
    } else {
      await api.updateLibraryItem(item.id, body());
      clearDraft(dkey);
      setRestoredAt(null);
      toast('Сохранено');
      if(assignAfter.current)navigate(`/homework/new?items=${item.id}`);else reload();
    }
  });

  const remove = async () => {
    if (!window.confirm(`Удалить «${item.title}»? Из уже выданных заданий задача тоже пропадёт.`)) return;
    await api.deleteLibraryItem(item.id);
    toast('Удалено');
    navigate(`/library/${KIND_PATH[item.kind]}`);
  };

  const pickFormat=async type=>{
    let game=structuredClone(EMPTY_GAME[type]);
    if(f.game?.type==='quick'&&game?.type==='quick')game={...game,items:structuredClone(f.game.items),timer:f.game.timer,...(f.game.context?{context:f.game.context}:{})};
    else if(isNew&&f.game?.type==='quick'&&f.game.items.some(x=>x.q.trim()||x.a.trim())&&!window.confirm('Этот формат использует другое содержимое. Заменить текущие вопросы новым шаблоном?'))return;
    if(!game)return;
    if(!isNew){if(f.game&&!window.confirm('Заменить содержимое упражнения новым форматом? Сначала сохраните текущий вариант, если он нужен.'))return;setF({...f,game});setChoosing(false);return;}
    if(game.type==='sheet'||game.type==='board'){
      setPicking(true);setPickError('');
      try{const created=await api.createLibraryItem({...body(),kind:'game',title:f.title.trim()||SHEET_PRESETS[type]?.label||GAME_TYPES[type]?.label||'Моё упражнение',game:cleanGame(game)});clearDraft(dkey);navigate(`/library/${created.id}`);}
      catch(e){setPickError(e.message);}finally{setPicking(false);}
    }else{setF({...f,game});setChoosing(false);requestAnimationFrame(()=>document.getElementById('material-title')?.focus());}
  };
  const back = libraryReturnPath();

  return (
    <>
      <BackLink to={back}>Библиотека</BackLink>
      <DraftNotice at={restoredAt} onReset={resetDraft} />
      <div className="page-head">
        <h1 className="page-title">{isNew ? { task: 'Новая задача', game: 'Новое упражнение', html: 'Новый урок', deck: 'Урок из слайдов', theory: 'Новая теория' }[f.kind] : f.title || 'Материал'}</h1>
        <div className="row wrap" style={{ gap: 6 }}>
            {!needsFormat&&!choosing&&!preview&&<button className="btn" form="material-editor-form" type="submit" disabled={save.busy} onClick={()=>{assignAfter.current=false;}}>{save.busy?'Сохраняем…':'Сохранить'}</button>}
            <button type="button" className="btn btn-secondary" disabled={needsFormat||f.kind==='deck'&&!f.deck||f.kind==='html'&&!f.html} onClick={openPreview}>{preview?'Вернуться к редактированию':'Предпросмотр ученика'}</button>
            {!isNew&&<>
            {f.kind !== 'theory' && <Link to={`/homework/new?items=${item.id}`} className="btn btn-secondary btn-sm">Выдать как ДЗ</Link>}
            <PublishButton item={item} />
            </>}
          </div>
      </div>

      <ol className="material-editor-steps" aria-label="Создание материала"><li className={needsFormat?'current':'done'}>1 <span>Формат</span></li><li className={!needsFormat&&!preview?'current':''}>2 <span>Содержание</span></li><li className={preview?'current':''}>3 <span>Предпросмотр</span></li></ol>
      {!isNew&&!preview&&<details className="editor-share-tools"><summary>Ссылка на упражнение и публикация</summary><ActivityActions key={item.id} id={item.id}/></details>}
      {preview ? (
        <section className="editor-preview"><p className="learning-note">Это пробное прохождение. Результат не попадёт в журнал ученика.{pending.length?' Новые файлы появятся после сохранения.':''}</p><LibraryItem item={{ ...item, ...body(),title:f.title.trim()||'Без названия', files: item?.files||[] }} /><button type="button" className="btn btn-secondary" onClick={openPreview}>Вернуться к редактированию</button></section>
      ) : needsFormat||choosing ? <section className="panel editor-format-panel">{choosing&&<button type="button" className="btn btn-quiet btn-sm" onClick={()=>setChoosing(false)}>Вернуться к содержимому</button>}<fieldset disabled={picking}><GameTypePicker onPick={pickFormat}/></fieldset><p className="small muted">Для форматов с аудио, изображениями и своим макетом материал сохранится в библиотеку сразу — затем добавьте своё содержание.</p>{picking&&<p role="status">Открываем конструктор…</p>}{pickError&&<ErrorBox error={pickError}/>}</section> : (
        <form id="material-editor-form" className="assign-layout material-editor" onSubmit={save.submit}>
          {f.kind === 'deck' && (
            <section className="panel dk-panel">
              {f.deck ? <DeckEditor deck={f.deck} onChange={(deck) => setF({ ...f, deck })} itemId={item?.id} /> : (
                <Field label="С чего начать" hint="Шаблон задаёт порядок этапов урока. Тексты-подсказки замените своими">
                  <DeckTemplatePicker onPick={(k) => setF({ ...f, deck: deckFromTemplate(k), title: f.title || '' })} />
                </Field>
              )}
            </section>
          )}
          <section className="panel form">
            {isNew && f.kind!=='game' && (
              <div className="row wrap" style={{ gap: 6 }}>
                {Object.keys(NEW_LABEL).filter((k) => k !== 'books').map((k) => (
                  <button type="button" key={k} className={`btn btn-sm ${f.kind === k ? '' : 'btn-secondary'}`} onClick={() => setF({ ...f, kind: k })}>{NEW_LABEL[k]}</button>
                ))}
              </div>
            )}
            <Field label="Название">
              <input id="material-title" className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus={isNew}
                placeholder={{ task: 'Задача 13 ОГЭ: вариант 4', game: 'Термины: найди пару', html: 'Интерактивный урок по теме', deck: 'Present Continuous: что происходит сейчас', theory: 'Правило или конспект темы' }[f.kind]} />
            </Field>
            {f.kind==='game'&&f.game&&<div className="game-editor"><div className="editor-section-heading"><div><h2>{f.game.type==='quick'?'Список вопросов и ответов':f.game.type==='sheet'?'Содержание упражнения':GAME_TYPES[f.game.type]?.label}</h2><p className="small muted">Замените примеры своими. Проверить задание можно в «Предпросмотре ученика».</p></div>{isNew&&<button type="button" className="btn btn-quiet btn-sm" onClick={()=>setChoosing(true)}>Сменить формат</button>}</div><GameEditor key={f.game.type} game={f.game} itemId={item?.id} onChange={game=>setF({...f,game})}/></div>}
            {f.kind === 'html' && <HtmlUpload f={f} setF={setF} />}
            {f.kind === 'game' || f.kind === 'html' || f.kind === 'deck' ? (
              <Field label="Инструкция для ученика" hint="Необязательно">
                <input className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Соедините термины с определениями" />
              </Field>
            ) : (
              <Field label={f.kind === 'task' ? 'Условие' : 'Текст'} hint={f.kind === 'task' ? 'Это увидит ученик' : 'Пустая строка начинает новый абзац'}>
                <textarea className="textarea" style={{ minHeight: 220 }} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              </Field>
            )}
            {f.kind === 'task' && (
              <Field label="Ответ или решение" hint="Видите только вы">
                <textarea className="textarea" style={{ minHeight: 90 }} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} />
              </Field>
            )}
            <details className="editor-extra"><summary>Ссылки, файлы и формулы{pending.length?` · файлов: ${pending.length}`:''}</summary><div className="form"><FormulaBar/>
            <Field label="Ссылки" hint="Видео, онлайн-упражнения, статьи: каждая ссылка с новой строки">
              <textarea className="textarea" style={{ minHeight: 60 }} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} />
            </Field>
            <Field label="Файлы" hint="PDF, картинки, аудио до 10 МБ">
              {isNew ? (
                <>
                  {pending.length > 0 && <div className="small muted" style={{ marginBottom: 8 }}>{pending.map((p) => p.name).join(', ')}: загрузятся при сохранении</div>}
                  <FileUploadButton upload={async (file) => file} onUploaded={(file) => setPending((p) => [...p, file])} />
                </>
              ) : (
                <>
                  <FileList files={item.files} canDelete={() => true} onDeleted={reload} />
                  <div style={{ marginTop: item.files.length ? 10 : 0 }}>
                    <FileUploadButton upload={(file) => api.uploadFile({ library_item_id: item.id }, file)} onUploaded={reload} />
                  </div>
                </>
              )}
            </Field>
            </div></details>
            {save.error&&<div className="alert" role="alert">{save.error}</div>}
            <div className="editor-save-bar"><div><strong>{isNew?'Сохранить в библиотеку':'Сохранить изменения'}</strong><p className="small muted">Сохранение не выдаёт задание ученику.</p></div><div className="row wrap"><button className="btn" disabled={save.busy} onClick={()=>{assignAfter.current=false;}}>{save.busy?'Сохраняем…':'Сохранить'}</button>{f.kind!=='theory'&&<button className="btn btn-secondary" disabled={save.busy} onClick={()=>{assignAfter.current=true;}}>Сохранить и выдать</button>}</div></div>
          </section>

          <aside className="panel work-card form editor-settings"><h2 className="section-title">Где хранить</h2>
            <Field label="Предмет">
              <input className="input" list="subjects" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
              <datalist id="subjects">{facets.subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            {folders.length > 0 && <FolderSelect folders={folders} value={f.folder_id} onChange={(v) => setF({ ...f, folder_id: v })} />}
            <details className="editor-extra"><summary>Экзамен, теги и заметки</summary><div className="form">            <div className="form-row" style={{ gap: 10 }}>
              <Field label="Экзамен">
                <select className="select" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })}>
                  <option value="">Нет</option><option>ОГЭ</option><option>ЕГЭ</option><option>ВПР</option>
                </select>
              </Field>
              <Field label="№ задания">
                <input className="input" type="number" min={1} max={50} disabled={!f.exam} value={f.exam_task} onChange={(e) => setF({ ...f, exam_task: e.target.value })} />
              </Field>
            </div>
            <Field label="Теги" hint={`Через запятую${facets.tags.length ? `. Уже есть: ${facets.tags.slice(0, 8).join(', ')}` : ''}`}>
              <input className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder={tagHint} />
            </Field>
            <Field label="Комментарий к задаче" hint="Видите только вы: для какого задания, на что обратить внимание">
              <textarea className="textarea" style={{ minHeight: 80 }} value={f.tutor_note} onChange={(e) => setF({ ...f, tutor_note: e.target.value })}
                placeholder="Пригодится для 13 задания ОГЭ" />
            </Field>
            </div></details>
            <p className="small muted">Ученик увидит материал, когда вы добавите его в урок или домашнюю работу.</p>
            {!isNew&&<details className="editor-extra"><summary>Удаление материала</summary><button type="button" className="btn btn-danger" onClick={remove}>Удалить материал</button></details>}
          </aside>
        </form>
      )}
    </>
  );
}

/* ============================================================
   Выбор задач из задачника (для ДЗ и урока)
   ============================================================ */
export function TaskPicker({ selected, onClose, onPick }) {
  const [f, setF] = useFilters('task,game,html');
  const facets = useLoad(() => api.libraryFacets(), []);
  const list = useLoad(() => loadList(f), [f.subject, f.exam, f.exam_task, f.tag, query, f.fav, f.folder]);
  const folders = useLoad(() => api.folders().then((r) => (Array.isArray(r?.folders) ? r.folders : [])).catch(() => []), []);
  const [chosen, setChosen] = useState(new Set(selected));

  const toggle = (id) => {
    const n = new Set(chosen);
    n.has(id) ? n.delete(id) : n.add(id);
    setChosen(n);
  };

  return (
    <Modal title="Задачи и упражнения" onClose={onClose} wide>
      {folders.data?.length > 0 && (
        <div style={{ maxWidth: 360 }}>
          <FolderSelect folders={folders.data} value={typeof f.folder === 'number' ? f.folder : null} onChange={(v) => setF({ ...f, folder: v || '' })} label="Папка" noneLabel="Все папки" />
        </div>
      )}
      {facets.data && <Filters f={f} setF={setF} facets={facets.data} />}
      <div style={{ maxHeight: '50vh', overflowY: 'auto', marginTop: 8 }}>
        {list.loading && <Spinner />}
        {list.data && !list.data.length && <Empty title="Ничего не нашлось" action={<Link to="/library/new?kind=task" className="btn btn-secondary btn-sm">Добавить задачу</Link>} />}
        {(list.data || []).map((i) => (
          <label key={i.id} className={`pick-row ${chosen.has(i.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={chosen.has(i.id)} onChange={() => toggle(i.id)} />
            <span className="list-main">
              <span className="list-title" style={{ display: 'block' }}>{i.title}</span>
              <span className="list-sub" style={{ display: 'block' }}>
                {[i.game && GAME_TYPES[i.game.type]?.label, examLabel(i), ...(i.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ') || i.subject}
              </span>
              {i.tutor_note && <span className="list-sub pick-note"><Icon name="note" size={13} /> {i.tutor_note}</span>}
            </span>
            <FavStar item={i} />
          </label>
        ))}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="button" className="btn" onClick={() => onPick([...chosen])}>Готово{chosen.size ? ` (${chosen.size})` : ''}</button>
      </div>
    </Modal>
  );
}

// Список выбранных задач с возможностью убрать и поменять порядок
export function PickedTasks({ ids, onChange, onAdd, emptyText = 'Задачи не добавлены' }) {
  const items = useLoad(() => api.libraryBatch(ids), [ids.join(',')]);
  const move = (i, d) => {
    const n = [...ids];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div>
      {!ids.length && <div className="small muted">{emptyText}</div>}
      {(items.data || []).map((it, i) => (
        <div key={it.id} className="list-item" style={{ padding: '10px 2px' }}>
          <div className="list-main">
            <div className="list-title truncate">{i + 1}. {it.title}</div>
            <div className="list-sub truncate">{[it.game && GAME_TYPES[it.game.type]?.label, examLabel(it), ...(it.tags || []).map((t) => `#${t}`)].filter(Boolean).join(' · ') || it.subject}</div>
          </div>
          <button type="button" className="icon-btn" aria-label="Выше" onClick={() => move(i, -1)} disabled={i === 0}><Icon name="arrowUp" size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Ниже" onClick={() => move(i, 1)} disabled={i === ids.length - 1}><Icon name="arrowDown" size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Убрать" onClick={() => onChange(ids.filter((x) => x !== it.id))}><Icon name="close" size={16} /></button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={onAdd}><Icon name="library" /> Из библиотеки</button>
    </div>
  );
}

export { ItemMeta };

/* ============================================================
   Импорт набора из файла .json (уроки по учебникам)
   ============================================================ */
export function ImportButton({ onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      let data;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error('Это не файл импорта Lessonfold');
      }
      if (data?.format !== 'lessonfold-library') throw new Error('Это не файл импорта Lessonfold');
      const n = data.items?.length || 0;
      const u = (data.courses || []).reduce((sum, c) => sum + (c.units?.length || 0), 0);
      if (!window.confirm(`Добавить «${data.title || file.name}»: материалов ${n}${u ? `, юнитов курса ${u}` : ''}?`)) return;
      const r = await api.importLibrary(data);
      toast(`Добавлено: ${r.created}${r.skipped ? `, уже было: ${r.skipped}` : ''}${r.units ? `, юнитов: ${r.units}` : ''}`);
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <label className="btn btn-secondary" style={{ cursor: busy ? 'default' : 'pointer' }}>
      <input type="file" accept=".json,application/json" hidden onChange={pick} disabled={busy} />
      {busy ? 'Загружаем…' : 'Импорт'}
    </label>
  );
}

// Загрузка готового HTML-урока: файл целиком сохраняется в библиотеке
function HtmlUpload({ f, setF }) {
  const [err, setErr] = useState('');
  const [show, setShow] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    if (file.size > 3 * 1024 * 1024) return setErr('Файл больше 3 МБ. Уменьшите картинки внутри урока.');
    const text = await file.text();
    if (!/<(html|body|div|script|section|main)\b/i.test(text)) return setErr('Это не похоже на HTML-урок');
    const title = (text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();
    setF((cur) => ({ ...cur, html: text, title: cur.title || title || file.name.replace(/\.html?$/i, '') }));
  };
  return (
    <Field label="Файл урока" hint="Готовая страница .html. Чтобы результат ученика сохранялся, урок вызывает Lessonfold.report">
      <div className="row wrap" style={{ gap: 8 }}>
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
          <input type="file" accept=".html,.htm,text/html" hidden onChange={pick} />
          {f.html ? 'Заменить файл' : 'Выбрать файл'}
        </label>
        {f.html && <span className="small muted">Загружено: {Math.round(f.html.length / 1024)} КБ</span>}
        {f.html && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShow(!show)}>{show ? 'Скрыть' : 'Посмотреть'}</button>}
      </div>
      {err && <div className="alert" style={{ marginTop: 8 }}>{err}</div>}
      {show && f.html && <div style={{ marginTop: 10 }}><HtmlLesson html={f.html} /></div>}
    </Field>
  );
}

// Пример тегов под предмет репетитора
function useSubjectTags() {
  const subj = useSubject();
  return subj.isLang ? 'словообразование, сложное' : subj.formulas ? 'дроби, проценты, сложное' : 'реформы, XIX век, сложное';
}
