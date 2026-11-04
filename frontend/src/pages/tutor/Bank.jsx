// pages/tutor/Bank.jsx — банк заданий по учебникам: учебник → юнит → задания.
// Задания можно посмотреть, проверить на себе и взять в свою библиотеку. Своими заданиями можно поделиться.
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Link, navigate, Modal, Field, useSubmit, useToast, Icon } from '../../ui';
import { useAuth } from '../../auth';
import LibraryItem from '../../components/LibraryItem';
import { GAME_TYPES, gameSize } from '../../games/logic';
import { plural } from '../../format';

const KIND = { game: 'Упражнение', task: 'Задача', theory: 'Теория' };
const kindLabel = (it) => (it.kind === 'game' && it.game ? GAME_TYPES[it.game.type]?.label || 'Упражнение' : KIND[it.kind]);

export default function BankPage({ book, unit }) {
  const wordsView = unit === 'words';
  const books = useLoad(() => api.bankBooks(), []);
  const [sharing, setSharing] = useState(false);
  if (books.loading) return <Spinner />;
  if (books.error) return <ErrorBox error={books.error} onRetry={books.reload} />;
  const b = books.data.find((x) => x.id === book) || books.data[0];
  const u = b.units.find((x) => x.code === unit) || b.units.find((x) => x.count) || b.units[0];
  const totalWords = b.units.reduce((n, x) => n + (x.words || 0), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Банк заданий</h1>
          <div className="lead">Готовые упражнения по юнитам учебников от Lessonfold и других репетиторов. Посмотрите, пройдите сами и возьмите себе в библиотеку: оттуда их можно выдать в задании или открыть на уроке.</div>
        </div>
        <button className="btn" onClick={() => setSharing(true)}><Icon name="plus" /> Поделиться своим</button>
      </div>

      <div className="seg" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {books.data.map((x) => (
          <button key={x.id} type="button" className={x.id === b.id ? 'on' : ''} onClick={() => navigate(`/bank/${x.id}`)}>{x.short} <span className="muted">{x.total}</span></button>
        ))}
      </div>

      <div className="bank-layout">
        <nav className="panel bank-units" aria-label="Юниты">
          <div className="meta-label" style={{ marginBottom: 8 }}>{b.title}</div>
          {totalWords > 0 && (
            <Link to={`/bank/${b.id}/words`} className={`bank-unit ${wordsView ? 'active' : ''}`}>
              <span className="bank-code serif">Aa</span>
              <span className="bank-unit-main"><b>Словарь учебника</b><small>все слова по юнитам и поиск</small></span>
              <span className="bank-count">{totalWords}</span>
            </Link>
          )}
          {b.units.map((x) => (
            <Link key={x.code} to={`/bank/${b.id}/${encodeURIComponent(x.code)}`} className={`bank-unit ${!wordsView && x.code === u.code ? 'active' : ''}`}>
              <span className="bank-code serif">{x.code}</span>
              <span className="bank-unit-main"><b>{x.title}</b>{x.topics && <small>{x.topics}</small>}</span>
              <span className="bank-count">{x.count || ''}</span>
            </Link>
          ))}
        </nav>
        {wordsView ? <BookWords key={b.id} book={b} /> : (
          <div className="stack">
            {u.words > 0 && <UnitWords key={`w-${b.id}/${u.code}`} book={b} unit={u} />}
            <UnitItems key={`${b.id}/${u.code}`} book={b} unit={u} onShare={() => setSharing(true)} />
          </div>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 18 }}>
        Названия учебников указаны только для удобства поиска. Банк не связан с издательствами: все задания авторские,
        тексты и упражнения из учебников сюда не загружаются.
      </p>
      {sharing && <ShareModal books={books.data} book={b.id} unit={u.code} onClose={() => setSharing(false)} onDone={() => { setSharing(false); books.reload(); navigate(`/bank/${b.id}/${encodeURIComponent(u.code)}?r=${Date.now()}`); }} />}
    </>
  );
}

function UnitItems({ book, unit, onShare }) {
  const toast = useToast();
  const { user } = useAuth();
  const list = useLoad(() => api.bankItems(book.id, unit.code), [book.id, unit.code]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [part, setPart] = useState('all');
  if (list.loading) return <div className="panel"><Spinner /></div>;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;

  const take = async (it) => {
    setBusy(it.id);
    try {
      const r = await api.bankTake(it.id);
      toast(r.again ? 'Это задание уже есть в вашей библиотеке' : 'Добавлено в вашу библиотеку');
      list.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };
  const hide = async (it) => {
    if (!window.confirm('Убрать задание из банка? У тех, кто уже взял его себе, копии останутся.')) return;
    try { await api.bankHide(it.id); toast('Убрано из банка'); list.reload(); } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <section className="bank-items">
      <div className="row-between" style={{ marginBottom: 12, alignItems: 'baseline' }}>
        <h2 className="section-title">{unit.code}. {unit.title}</h2>
        {list.data.length > 0 && <span className="small muted">{list.data.length} {plural(list.data.length, 'задание', 'задания', 'заданий')}</span>}
      </div>
      {!list.data.length && (
        <div className="panel"><Empty title="Пока пусто" action={<button className="btn btn-secondary" onClick={onShare}>Поделиться своим заданием</button>}>
          В этом юните ещё нет заданий. Добавьте своё: так банк растёт для всех.
        </Empty></div>
      )}
      {(() => {
        const n = { main: list.data.filter((x) => x.section !== 'words').length, words: list.data.filter((x) => x.section === 'words').length };
        if (!n.main || !n.words) return null;
        return (
          <div className="seg bank-filter" role="tablist" aria-label="Какие задания показать">
            <button type="button" className={part === 'all' ? 'on' : ''} onClick={() => setPart('all')}>Все {list.data.length}</button>
            <button type="button" className={part === 'main' ? 'on' : ''} onClick={() => setPart('main')}>Грамматика и речь {n.main}</button>
            <button type="button" className={part === 'words' ? 'on' : ''} onClick={() => setPart('words')}>Слова {n.words}</button>
          </div>
        );
      })()}
      <div className="market-grid">
        {list.data.filter((it) => part === 'all' || (part === 'words') === (it.section === 'words')).map((it) => (
          <article key={it.id} className="market-card">
            <span className="meta-label">{kindLabel(it)}{it.game ? ` · ${gameSize(it.game)}` : ''}</span>
            <h3 className="lib-title">{it.title}</h3>
            <div className="small muted">{it.author}{it.uses ? ` · взяли ${it.uses}` : ''}</div>
            <div className="market-foot">
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(it)}>Посмотреть</button>
              {it.taken_id ? <Link to={`/library/${it.taken_id}`} className="btn btn-quiet btn-sm">В библиотеке</Link>
                : <button className="btn btn-sm" disabled={busy === it.id} onClick={() => take(it)}>Взять себе</button>}
            </div>
            {(it.mine || user.is_admin) && <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onClick={() => hide(it)}>Убрать из банка</button>}
          </article>
        ))}
      </div>
      {open && <Preview id={open.id} onClose={() => setOpen(null)} onTake={() => { take(open); setOpen(null); }} taken={open.taken_id} />}
    </section>
  );
}

function Preview({ id, onClose, onTake, taken }) {
  const item = useLoad(() => api.bankItem(id), [id]);
  return (
    <Modal title="Задание из банка" onClose={onClose} wide>
      {item.loading ? <Spinner /> : item.error ? <ErrorBox error={item.error} /> : (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>Можно пройти задание прямо здесь: так его увидит ученик. Результат никуда не сохраняется.</p>
          <LibraryItem item={item.data} />
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
            {taken ? <Link to={`/library/${taken}`} className="btn">Открыть в библиотеке</Link> : <button className="btn" onClick={onTake}>Взять себе</button>}
          </div>
        </>
      )}
    </Modal>
  );
}

function ShareModal({ books, book, unit, onClose, onDone }) {
  const toast = useToast();
  const lib = useLoad(() => api.library(), []);
  const [f, setF] = useState({ item: '', book, unit, own: false });
  const b = books.find((x) => x.id === f.book) || books[0];
  const save = useSubmit(async () => {
    if (!f.item) throw new Error('Выберите задание из своей библиотеки');
    await api.bankShare({ library_item_id: Number(f.item), book: f.book, unit: f.unit, own_work: f.own });
    toast('Задание в банке. Спасибо!');
    onDone();
  });
  const items = (lib.data || []).filter((x) => ['task', 'game', 'theory'].includes(x.kind));
  return (
    <Modal title="Поделиться заданием" onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        {lib.loading ? <Spinner /> : (
          <Field label="Задание из вашей библиотеки" hint="Задачи, упражнения и теория без прикреплённых файлов">
            <select className="input" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })}>
              <option value="">Выберите</option>
              {items.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Учебник">
          <select className="input" value={f.book} onChange={(e) => setF({ ...f, book: e.target.value, unit: books.find((x) => x.id === e.target.value).units[0].code })}>
            {books.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
        <Field label="Юнит">
          <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {b.units.map((x) => <option key={x.code} value={x.code}>{x.code}. {x.title}</option>)}
          </select>
        </Field>
        <label className="check" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={f.own} onChange={(e) => setF({ ...f, own: e.target.checked })} />
          <span>Задание составил я сам. В нём нет текстов, упражнений, картинок и аудио из учебника. Разрешаю другим репетиторам бесплатно брать его для своих занятий.</span>
        </label>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy || !f.own}>Отправить в банк</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Слова юнита по темам, из них делается набор карточек ---------- */
// Слова с номером: одно и то же слово может встречаться в двух темах
const withIds = (words) => words.map((w, i) => ({ ...w, i }));
function byTopic(words) {
  const map = new Map();
  for (const w of words) { const t = w.topic || ''; if (!map.has(t)) map.set(t, []); map.get(t).push(w); }
  return [...map].map(([topic, list]) => ({ topic, list }));
}

function UnitWords({ book, unit }) {
  const words = useLoad(() => api.bankVocab(book.id, unit.code).then((r) => withIds(r.words)), [book.id, unit.code]);
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  if (words.loading || words.error) return null;
  const list = words.data;
  const topics = byTopic(list).filter((t) => t.topic).map((t) => t.topic);
  return (
    <section className="panel">
      <div className="row-between wrap" style={{ gap: 10 }}>
        <div>
          <h2 className="section-title">Слова юнита</h2>
          <div className="small muted" style={{ marginTop: 4 }}>{list.length} {plural(list.length, 'слово', 'слова', 'слов')} с переводом{topics.length ? `: ${topics.join(', ').toLowerCase()}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>{open ? 'Свернуть' : 'Показать слова'}</button>
          <button className="btn btn-sm" onClick={() => setMaking(true)}><Icon name="cards" /> Сделать карточки</button>
        </div>
      </div>
      {open && <WordTable words={list} />}
      {making && <MakeSet book={book} unit={unit} words={list} onClose={() => setMaking(false)} />}
    </section>
  );
}

function WordTable({ words }) {
  return byTopic(words).map(({ topic, list }) => (
    <div key={topic} className="bank-topic">
      {topic && <div className="meta-label">{topic}</div>}
      <div className="bank-words">
        {list.map((w) => (
          <div key={w.i} className="bank-word"><span>{w.term}</span><span className="muted">{w.translation}</span></div>
        ))}
      </div>
    </div>
  ));
}

// Набор карточек из слов юнита: выбрать темы или отдельные слова и кому выдать
function MakeSet({ book, unit, words, onClose }) {
  const toast = useToast();
  const students = useLoad(() => api.students(), []);
  const [title, setTitle] = useState(`${book.short} ${unit.code}: ${unit.title}`);
  const [picked, setPicked] = useState(() => new Set(words.map((w) => w.i)));
  const [who, setWho] = useState('none');
  const [ids, setIds] = useState([]);
  const groups = byTopic(words);
  const save = useSubmit(async () => {
    // одинаковые слова из разных тем в набор попадают один раз
    const seen = new Set();
    const chosen = words.filter((w) => picked.has(w.i) && !seen.has(w.term.toLowerCase()) && seen.add(w.term.toLowerCase())).map((w) => ({ term: w.term, translation: w.translation }));
    if (!chosen.length) throw new Error('Выберите хотя бы одно слово');
    if (who === 'some' && !ids.length) throw new Error('Отметьте учеников или выберите «Пока никому»');
    const r = await api.createWordSet({ title: title.trim(), words: chosen, for_all: who === 'all', student_ids: who === 'some' ? ids : undefined });
    toast(`Набор создан: ${chosen.length} ${plural(chosen.length, 'карточка', 'карточки', 'карточек')}`);
    navigate(`/wordsets/${r.id}`);
  });
  const toggle = (i) => { const n = new Set(picked); if (n.has(i)) n.delete(i); else n.add(i); setPicked(n); };
  // только одна тема: снять всё и отметить её слова; повторное нажатие на выбранную тему вернёт все слова
  const onlyTopic = (list) => {
    const only = list.every((w) => picked.has(w.i)) && picked.size === list.length;
    setPicked(new Set((only ? words : list).map((w) => w.i)));
    const t = list[0]?.topic;
    if (t) setTitle(only ? `${book.short} ${unit.code}: ${unit.title}` : `${book.short} ${unit.code}: ${t}`);
  };
  return (
    <Modal title="Набор карточек из слов юнита" onClose={onClose} wide>
      <form className="form" onSubmit={save.submit}>
        <Field label="Название набора"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required /></Field>
        {groups.length > 1 && (
          <Field label="Только одна тема">
            <div className="seg">
              {groups.map((g) => {
                const on = picked.size === g.list.length && g.list.every((w) => picked.has(w.i));
                return <button key={g.topic} type="button" className={on ? 'on' : ''} onClick={() => onlyTopic(g.list)}>{g.topic || 'Без темы'} {g.list.length}</button>;
              })}
            </div>
          </Field>
        )}
        <div className="row-between">
          <span className="meta-label">Слова: {picked.size} из {words.length}</span>
          <span className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicked(new Set(words.map((w) => w.i)))}>Все</button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setPicked(new Set())}>Ни одного</button>
          </span>
        </div>
        <div className="bank-pick">
          {groups.map(({ topic, list }) => (
            <div key={topic} className="bank-topic">
              {topic && <div className="meta-label">{topic}</div>}
              <div className="bank-words pick">
                {list.map((w) => (
                  <label key={w.i} className="bank-word check"><input type="checkbox" checked={picked.has(w.i)} onChange={() => toggle(w.i)} /><span>{w.term}</span><span className="muted">{w.translation}</span></label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Field label="Кому выдать">
          <div className="seg">
            <button type="button" className={who === 'none' ? 'on' : ''} onClick={() => setWho('none')}>Пока никому</button>
            <button type="button" className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>Всем ученикам</button>
            <button type="button" className={who === 'some' ? 'on' : ''} onClick={() => setWho('some')}>Выбрать</button>
          </div>
        </Field>
        {who === 'some' && (students.loading ? <Spinner /> : (
          <div className="bank-words">
            {(students.data || []).map((s) => (
              <label key={s.id} className="check"><input type="checkbox" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} /> {s.full_name}</label>
            ))}
          </div>
        ))}
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Создать набор</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Словарь всего учебника: все юниты подряд и поиск ---------- */
function BookWords({ book }) {
  const units = book.units.filter((u) => u.words > 0);
  const all = useLoad(() => Promise.all(units.map((u) => api.bankVocab(book.id, u.code).then((r) => ({ unit: u, words: withIds(r.words) })))), [book.id]);
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(null);
  if (all.loading) return <div className="panel"><Spinner /></div>;
  if (all.error) return <ErrorBox error={all.error} onRetry={all.reload} />;
  const s = q.trim().toLowerCase();
  const shown = all.data.map((g) => ({ ...g, words: s ? g.words.filter((w) => `${w.term} ${w.translation}`.toLowerCase().includes(s)) : g.words })).filter((g) => g.words.length);
  const total = all.data.reduce((n, g) => n + g.words.length, 0);
  return (
    <section className="bank-items stack">
      <div className="row-between wrap" style={{ gap: 10 }}>
        <h2 className="section-title">Словарь: {book.short}</h2>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Найти слово или перевод" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по словарю" />
      </div>
      <p className="small muted" style={{ margin: 0 }}>{total} {plural(total, 'слово', 'слова', 'слов')} по юнитам и темам, перевод Lessonfold. Из любого юнита или темы можно сделать набор карточек и выдать ученикам.</p>
      {!shown.length && <div className="panel"><Empty title="Ничего не нашлось">Попробуйте другое слово.</Empty></div>}
      {shown.map((g) => (
        <section key={g.unit.code} className="panel">
          <div className="row-between wrap" style={{ gap: 10 }}>
            <h3 className="lib-title">{g.unit.code}. {g.unit.title}</h3>
            <div className="row" style={{ gap: 8 }}>
              <Link to={`/bank/${book.id}/${encodeURIComponent(g.unit.code)}`} className="btn btn-quiet btn-sm">Задания юнита</Link>
              <button className="btn btn-sm" onClick={() => setMaking(g.unit)}><Icon name="cards" /> Сделать карточки</button>
            </div>
          </div>
          <WordTable words={g.words} />
        </section>
      ))}
      {making && <MakeSet book={book} unit={making} words={all.data.find((g) => g.unit.code === making.code).words} onClose={() => setMaking(null)} />}
    </section>
  );
}
