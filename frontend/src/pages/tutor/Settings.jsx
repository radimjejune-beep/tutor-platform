// pages/tutor/Settings.jsx — настройки: окна для записи и юридические документы
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, Field, Link, navigate, useToast, useSubmit } from '../../ui';
import { fullDate, plural } from '../../format';
import PageSettings from './PageSettings';
import SubjectInput from '../../components/SubjectInput';
import { subjectInfo } from '../../subjects';
import { useAuth } from '../../auth';

const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export default function Settings({ tab }) {
  return (
    <>
      <div className="page-head"><h1 className="page-title">Настройки</h1></div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'subject'} className={tab === 'subject' ? 'active' : ''} onClick={() => navigate('/settings/subject')}>Предмет</button>
        <button role="tab" aria-selected={tab === 'lessons'} className={tab === 'lessons' ? 'active' : ''} onClick={() => navigate('/settings/lessons')}>Списание</button>
        <button role="tab" aria-selected={tab === 'booking'} className={tab === 'booking' ? 'active' : ''} onClick={() => navigate('/settings/booking')}>Запись учеников</button>
        <button role="tab" aria-selected={tab === 'page'} className={tab === 'page' ? 'active' : ''} onClick={() => navigate('/settings/page')}>Страница записи</button>
        <button role="tab" aria-selected={tab === 'documents'} className={tab === 'documents' ? 'active' : ''} onClick={() => navigate('/settings/documents')}>Документы</button>
        <button role="tab" aria-selected={tab === 'telegram'} className={tab === 'telegram' ? 'active' : ''} onClick={() => navigate('/settings/telegram')}>Telegram</button>
      </div>
      {tab === 'subject' ? <SubjectTab /> : tab === 'lessons' ? <AutoTab /> : tab === 'page' ? <PageSettings /> : tab === 'documents' ? <DocumentsTab /> : tab === 'telegram' ? <TelegramTab /> : <BookingTab />}
    </>
  );
}

/* ============================================================
   Запись: включение, правила, окна по дням недели, закрытые дни
   ============================================================ */
function BookingTab() {
  const data = useLoad(() => api.bookingSettings(), []);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  return <BookingForm initial={data.data} />;
}

function BookingForm({ initial }) {
  const toast = useToast();
  const [f, setF] = useState({
    enabled: initial.enabled,
    notice_hours: initial.notice_hours,
    horizon_days: initial.horizon_days,
    step_min: initial.step_min,
    closed_dates: initial.closed_dates || [],
    windows: initial.windows.map(({ weekday, starts, ends }) => ({ weekday, starts, ends })),
  });
  const [newClosed, setNewClosed] = useState('');

  const setWindow = (i, patch) => setF({ ...f, windows: f.windows.map((w, k) => (k === i ? { ...w, ...patch } : w)) });
  const addWindow = (weekday) => setF({ ...f, windows: [...f.windows, { weekday, starts: '16:00', ends: '20:00' }] });
  const removeWindow = (i) => setF({ ...f, windows: f.windows.filter((_, k) => k !== i) });
  const copyToWeekdays = (weekday) => {
    const src = f.windows.filter((w) => w.weekday === weekday);
    const others = f.windows.filter((w) => w.weekday === weekday || w.weekday > 5);
    const copies = [1, 2, 3, 4, 5].filter((d) => d !== weekday).flatMap((d) => src.map((w) => ({ ...w, weekday: d })));
    setF({ ...f, windows: [...others, ...copies] });
  };

  const { busy, error, submit } = useSubmit(async () => {
    await api.saveBookingSettings({
      ...f,
      notice_hours: Number(f.notice_hours),
      horizon_days: Number(f.horizon_days),
      step_min: Number(f.step_min),
    });
    toast('Настройки записи сохранены');
  });

  return (
    <form className="assign-layout" onSubmit={submit}>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2 className="section-title">Когда можно записаться</h2>
            <div className="small muted">Ученики видят свободное время внутри этих окон. Уже назначенные занятия и запросы на рассмотрении из них вычитаются.</div>
          </div>
        </div>
        {DAYS.map((name, idx) => {
          const weekday = idx + 1;
          const items = f.windows.map((w, i) => ({ ...w, i })).filter((w) => w.weekday === weekday);
          return (
            <div key={weekday} className="window-day">
              <div className="window-name">{name}</div>
              <div className="window-list">
                {!items.length && <span className="muted small">Нет записи</span>}
                {items.map((w) => (
                  <div key={w.i} className="row" style={{ gap: 6 }}>
                    <input className="input" type="time" step={900} value={w.starts} onChange={(e) => setWindow(w.i, { starts: e.target.value })} style={{ height: 38, width: 124 }} aria-label="Начало" />
                    <span className="muted">–</span>
                    <input className="input" type="time" step={900} value={w.ends} onChange={(e) => setWindow(w.i, { ends: e.target.value })} style={{ height: 38, width: 124 }} aria-label="Конец" />
                    <button type="button" className="icon-btn" aria-label="Убрать окно" onClick={() => removeWindow(w.i)}><Icon name="close" size={16} /></button>
                  </div>
                ))}
              </div>
              <div className="window-actions">
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => addWindow(weekday)}><Icon name="plus" /> Окно</button>
                {weekday <= 5 && items.length > 0 && (
                  <button type="button" className="btn btn-quiet btn-sm hide-sm" onClick={() => copyToWeekdays(weekday)} title="Скопировать на все будни">На все будни</button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <aside className="panel work-card form">
        <label className="check" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          Ученики могут записываться и переносить сами
        </label>
        <div className="small muted" style={{ marginTop: -8 }}>Каждую запись и перенос вы подтверждаете.</div>
        <Field label="Отмена и перенос без списания" hint="Позже — только через вас">
          <select className="select" value={f.notice_hours} onChange={(e) => setF({ ...f, notice_hours: e.target.value })}>
            {[12, 24, 48].map((h) => <option key={h} value={h}>Не позже чем за {h} ч</option>)}
          </select>
        </Field>
        <Field label="Насколько вперёд можно записаться">
          <select className="select" value={f.horizon_days} onChange={(e) => setF({ ...f, horizon_days: e.target.value })}>
            {[7, 14, 21, 30, 60].map((d) => <option key={d} value={d}>{d} {plural(d, 'день', 'дня', 'дней')}</option>)}
          </select>
        </Field>
        <Field label="Шаг времени начала">
          <select className="select" value={f.step_min} onChange={(e) => setF({ ...f, step_min: e.target.value })}>
            <option value={15}>Каждые 15 минут</option>
            <option value={30}>Каждые 30 минут</option>
            <option value={60}>Каждый час</option>
          </select>
        </Field>
        <Field label="Выходные и отпуск" hint="В эти дни записи не будет">
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="date" value={newClosed} onChange={(e) => setNewClosed(e.target.value)} style={{ height: 38 }} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={!newClosed}
              onClick={() => { setF({ ...f, closed_dates: [...new Set([...f.closed_dates, newClosed])].sort() }); setNewClosed(''); }}>
              Добавить
            </button>
          </div>
          {f.closed_dates.length > 0 && (
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              {f.closed_dates.map((d) => (
                <button type="button" key={d} className="badge" style={{ cursor: 'pointer' }} title="Убрать"
                  onClick={() => setF({ ...f, closed_dates: f.closed_dates.filter((x) => x !== d) })}>
                  {fullDate(d)} ×
                </button>
              ))}
            </div>
          )}
        </Field>
        {error && <div className="alert">{error}</div>}
        <button className="btn" style={{ height: 46 }} disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</button>
      </aside>
    </form>
  );
}

/* ============================================================
   Документы: оферта, политика, согласия
   ============================================================ */
const KIND_HINT = {
  offer: 'Принимают родители и взрослые ученики',
  privacy: 'Принимают все ученики и родители',
  consent_adult: 'Принимают взрослые ученики',
  consent_parent: 'Принимают родители',
};

function DocumentsTab() {
  const docs = useLoad(() => api.legalAdmin(), []);
  const [editing, setEditing] = useState(null);

  if (docs.loading) return <Spinner />;
  if (docs.error) return <ErrorBox error={docs.error} onRetry={docs.reload} />;
  if (editing) {
    return <DocEditor doc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); docs.reload(); }} />;
  }

  const unfinished = docs.data.filter((d) => d.has_placeholders);
  return (
    <>
      {unfinished.length > 0 && <FillPlaceholders docs={docs.data} onDone={docs.reload} />}
      <section className="panel">
        {docs.data.map((d) => (
          <div key={d.kind} className="assign-row" onClick={() => setEditing(d)}>
            <div className="assign-icon"><Icon name="shield" /></div>
            <div className="list-main">
              <div className="list-title">{d.title}</div>
              <div className="list-sub">Редакция {d.version} от {fullDate(d.published_at)}. {KIND_HINT[d.kind]}</div>
            </div>
            {d.has_placeholders ? <Badge tone="brass">Нужно заполнить</Badge> : <Badge tone="green">Принято: {d.accepted_count}</Badge>}
          </div>
        ))}
      </section>
      <p className="small muted" style={{ marginTop: 14 }}>
        Оферта и политика открыты всем по ссылкам со страницы входа:{' '}
        <Link to="/legal/offer">оферта</Link>, <Link to="/legal/privacy">политика</Link>. Кто и когда принял документы — во вкладке «Доступ» каждого ученика.
      </p>
    </>
  );
}

// Пропуски вида [ФИО полностью] во всех документах заполняются одной формой
const PH_HINT = {
  '[ФИО полностью]': { label: 'ФИО полностью', placeholder: 'Кочка Радим Отчество' },
  '[ИНН]': { label: 'ИНН (12 цифр)', placeholder: '123456789012', inputMode: 'numeric' },
  '[e-mail или Telegram]': { label: 'Почта или Telegram для связи и претензий', placeholder: 'name@mail.ru или @username' },
  '[предварительно / после Занятия]': { label: 'Когда ученик платит за занятие', options: ['предварительно', 'после Занятия'] },
  '[проверить у хостинга и указать]': { label: 'Где хранятся данные', value: 'на серверах хостинга RelaxDev в Российской Федерации', hint: 'Сервер должен быть в России (ч. 5 ст. 18 152-ФЗ). Город и юрлицо хостинга уточните в поддержке RelaxDev.' },
  '[предмет]': { label: 'Предмет', hint: 'Как он записан в оферте: «индивидуальные занятия по предмету …»' },
  '[3 года]': { label: 'Сколько хранить данные после окончания занятий', value: '3 года' },
};

function FillPlaceholders({ docs, onDone }) {
  const toast = useToast();
  const all = [...new Set(docs.flatMap((d) => (d.body + ' ' + d.title).match(/\[[^\]]+\]/g) || []))];
  const { user } = useAuth();
  const [vals, setVals] = useState(() => Object.fromEntries(all.map((p) => [p, p === '[предмет]' ? (user.subject || '').toLowerCase() : PH_HINT[p]?.value || ''])));
  const filled = all.filter((p) => vals[p].trim());
  const { busy, error, submit } = useSubmit(async () => {
    if (vals['[ИНН]'] && !/^\d{12}$/.test(vals['[ИНН]'].trim())) throw new Error('ИНН физического лица состоит из 12 цифр');
    const fix = (t) => filled.reduce((acc, p) => acc.split(p).join(vals[p].trim()), t);
    const touched = docs.filter((d) => fix(d.body) !== d.body || fix(d.title) !== d.title);
    if (!touched.length) return;
    if (touched.some((d) => d.accepted_count > 0) && !window.confirm('Сохранятся новые редакции документов. Те, кто уже принимал их, примут заново при следующем входе. Продолжить?')) return;
    for (const d of touched) await api.saveLegalDoc(d.kind, { title: fix(d.title).trim(), body: fix(d.body).trim() });
    toast(`Обновлено документов: ${touched.length}`);
    onDone();
  });
  return (
    <form className="panel form" style={{ marginBottom: 18 }} onSubmit={submit}>
      <h2 className="section-title">Заполните пропуски в документах</h2>
      <div className="small muted">
        Это поля в [квадратных скобках] из всех четырёх документов. Впишите один раз, и они подставятся везде. Пока пропуски есть, документы
        неполные, и давать их ученикам на подпись рано. Тексты остаются черновиками: проверьте их как юрист под свою ситуацию.
      </div>
      {all.map((p) => {
        const h = PH_HINT[p] || { label: p.slice(1, -1) };
        return (
          <Field key={p} label={h.label} hint={h.hint}>
            {h.options ? (
              <select className="input" value={vals[p]} onChange={(e) => setVals({ ...vals, [p]: e.target.value })}>
                <option value="">Выберите</option>
                {h.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className="input" value={vals[p]} placeholder={h.placeholder} inputMode={h.inputMode} onChange={(e) => setVals({ ...vals, [p]: e.target.value })} />
            )}
          </Field>
        );
      })}
      {error && <div className="alert">{error}</div>}
      <div><button className="btn" disabled={busy || !filled.length}>{busy ? 'Сохраняем…' : `Подставить в документы (${filled.length} из ${all.length})`}</button></div>
    </form>
  );
}

function DocEditor({ doc, onClose, onSaved }) {
  const toast = useToast();
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const changed = title !== doc.title || body !== doc.body;
  const placeholders = [...new Set(body.match(/\[[^\]]+\]/g) || [])];

  const { busy, error, submit } = useSubmit(async () => {
    if (doc.accepted_count > 0 && !window.confirm('Сохранится новая редакция. Все, кто принимал документ, увидят её при следующем входе и примут заново. Продолжить?')) return;
    await api.saveLegalDoc(doc.kind, { title: title.trim(), body: body.trim() });
    toast('Новая редакция сохранена');
    onSaved();
  });

  return (
    <div className="assign-layout">
      <section className="panel form">
        <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', marginLeft: -10 }} onClick={onClose}>
          <Icon name="back" /> Все документы
        </button>
        <Field label="Название">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Текст" hint="Пустая строка — новый абзац">
          <textarea className="textarea" style={{ minHeight: 560, fontSize: 14, lineHeight: 1.6 }} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
      </section>
      <aside className="panel work-card form">
        <div className="small muted">Сейчас действует редакция {doc.version}. Принято: {doc.accepted_count}.</div>
        {placeholders.length > 0 ? (
          <div className="note">
            Осталось заполнить:
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{placeholders.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        ) : (
          <div className="small" style={{ color: 'var(--green-ink)' }}>Все поля заполнены</div>
        )}
        {error && <div className="alert">{error}</div>}
        <button className="btn" style={{ height: 46 }} disabled={!changed || busy} onClick={submit}>
          {busy ? 'Сохраняем…' : 'Сохранить новую редакцию'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
      </aside>
    </div>
  );
}

/* ============================================================
   Telegram: состояние бота и кто подключился
   ============================================================ */
function TelegramTab() {
  const data = useLoad(() => api.telegramOverview(), []);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const d = data.data;
  const linked = d.users.filter((u) => u.linked_at);

  if (!d.enabled) {
    return (
      <section className="panel" style={{ maxWidth: 760 }}>
        <h2 className="section-title">Бот ещё не подключён</h2>
        <ol className="steps">
          <li>В Telegram откройте <b>@BotFather</b>, отправьте <code>/newbot</code>, придумайте имя (например, «Lessonfold — итоги уроков») и адрес бота, оканчивающийся на <code>bot</code>.</li>
          <li>BotFather пришлёт токен — длинную строку вида <code>123456:ABC…</code>. Никому её не показывайте.</li>
          <li>В RelaxDev, проект <b>tutor-platform</b> → «Переменные», добавьте <code>TELEGRAM_BOT_TOKEN</code> = токен и <code>TG_OPTION</code> = <code>1</code> (без неё сервер не достучится до Telegram).</li>
          <li>Нажмите «Редеплой» и обновите эту страницу.</li>
        </ol>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="section-title">Бот @{d.bot_username} работает</h2>
          <div className="small muted">Родители и взрослые ученики подключают его сами: на главной их кабинета есть кнопка «Подключить». Итоги уходят, когда вы отмечаете урок проведённым и пишете, что сделали.</div>
        </div>
        <Badge tone="green">Подключено: {linked.length} из {d.users.length}</Badge>
      </div>
      <div className="list">
        {d.users.map((u) => (
          <div key={u.id} className="list-item">
            <div className="list-main">
              <div className="list-title">{u.full_name}</div>
              <div className="list-sub">{u.role === 'parent' ? 'Родитель' : 'Ученик'}{u.students ? `: ${u.students}` : ''}</div>
            </div>
            {u.linked_at ? <Badge tone="green">С {fullDate(u.linked_at)}</Badge> : <Badge>Не подключил</Badge>}
          </div>
        ))}
      </div>
    </section>
  );
}

// Основной предмет: от него зависят словарь или термины, тест уровня и подсказки
function SubjectTab() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [subject, setSubject] = useState(user.subject || '');
  const info = subjectInfo(subject);
  const save = useSubmit(async () => {
    await api.setSubject(subject.trim());
    await refresh();
    toast('Предмет сохранён');
  });
  return (
    <form className="panel form" style={{ maxWidth: 640 }} onSubmit={save.submit}>
      <Field label="Основной предмет" hint="Если ведёте несколько предметов, у ученика в карточке можно указать свой">
        <SubjectInput value={subject} onChange={setSubject} required />
      </Field>
      <div className="note">
        {info.isLang
          ? `Раздел «Словарь»: слово и перевод, карточки${info.speech ? ', озвучка' : ''}, тренировки.${info.english ? ' На странице записи есть тест уровня A1–B2.' : ''}`
          : 'Раздел «Термины»: термин и определение, карточки и тренировки. Подойдёт для формул, дат, правил и понятий.'}
      </div>
      {save.error && <div className="alert">{save.error}</div>}
      <div><button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
    </form>
  );
}

/* ============================================================
   Автосписание: урок закончился — сам отмечается проведённым
   ============================================================ */
const DELAY_LABEL = { 0: 'сразу после конца урока', 15: 'через 15 минут', 30: 'через 30 минут', 60: 'через час', 180: 'через 3 часа', 720: 'через 12 часов' };

function AutoTab() {
  const data = useLoad(() => api.autoSettings(), []);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  return <AutoForm initial={data.data} />;
}

function AutoForm({ initial }) {
  const toast = useToast();
  const [f, setF] = useState({ enabled: initial.enabled, delay_min: initial.delay_min });
  const save = useSubmit(async () => {
    await api.saveAutoSettings({ enabled: f.enabled, delay_min: Number(f.delay_min) });
    toast(f.enabled ? 'Автосписание включено' : 'Автосписание выключено');
  });
  return (
    <form className="panel form" style={{ maxWidth: 640 }} onSubmit={save.submit}>
      <h2 className="section-title">Автосписание уроков</h2>
      <label className="check">
        <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
        <span>Когда время урока закончилось, отмечать его проведённым и списывать с абонемента</span>
      </label>
      {f.enabled && (
        <Field label="Когда списывать">
          <select className="input" value={f.delay_min} onChange={(e) => setF({ ...f, delay_min: Number(e.target.value) })}>
            {Object.entries(DELAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      )}
      <div className="note">
        Если абонемента нет, урок спишется как разовый по своей цене. Про каждое списание придёт уведомление.
        Если урок не состоялся, откройте его в расписании и поставьте «Отменено»: списание снимется само. «Пропуск» и «Поздняя отмена» остаются списанными, как и раньше.
        Уроки, которые закончились больше двух дней назад, автоматически не списываются.
      </div>
      {save.error && <div className="alert">{save.error}</div>}
      <div><button className="btn" disabled={save.busy}>{save.busy ? 'Сохраняем…' : 'Сохранить'}</button></div>
    </form>
  );
}
