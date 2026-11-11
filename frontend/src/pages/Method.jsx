// pages/Method.jsx: методический раздел. У преподавателя «Методика» (/method), у ученика и родителя «Как учиться» (/learn).
// Тексты лежат в src/method/*.js. Страницы: оглавление с поиском, статья, банк активностей с фильтрами.
import { Fragment, useMemo, useState } from 'react';
import { Icon, Link, useToast } from '../ui';
import { BackLink } from '../Shell';
import { TUTOR_GROUPS, TUTOR_ARTICLES } from '../method/tutor';
import { EXAM_ARTICLES } from '../method/exams';
import { CLIENT_GROUPS, CLIENT_ARTICLES } from '../method/client';
import { ACTIVITIES, ACTIVITY_TYPES, AGES } from '../method/activities';

const TUTOR_ALL = [...TUTOR_ARTICLES, ...EXAM_ARTICLES];
const LEVELS = [['', 'Все'], ['start', 'Новичкам'], ['pro', 'Опытным'], ['exam', 'Экзамены']];
const LEVEL_LABEL = { start: 'Для начинающих', pro: 'Для опытных', exam: 'Экзамены' };

export const findTutorArticle = (slug) => TUTOR_ALL.find((a) => a.slug === slug);

// Текст статьи одной строкой: для поиска
const plain = (a) => [a.title, a.summary, ...(a.body || []).flatMap((b) => [b.h, b.text, b.tip, b.warn, b.example, ...(b.list || []), ...(b.steps || []), ...(b.check || []), ...(b.table?.rows || []).flat()])].filter(Boolean).join(' ').toLowerCase();

function Section({ b }) {
  return (
    <section className="m-sec">
      {b.h && <h2 className="m-h">{b.h}</h2>}
      {b.text && b.text.split('\n\n').map((p) => <p key={p}>{p}</p>)}
      {b.list && <ul className="m-list">{b.list.map((x) => <li key={x}>{x}</li>)}</ul>}
      {b.steps && <ol className="m-steps">{b.steps.map((x) => <li key={x}>{x}</li>)}</ol>}
      {b.check && <ul className="m-check">{b.check.map((x) => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}</ul>}
      {b.table && (
        <div className="table-scroll">
          <table className="m-table">
            <thead><tr>{b.table.head.map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{b.table.rows.map((r) => <tr key={r.join('|')}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {b.example && <pre className="m-example">{b.example}</pre>}
      {b.tip && <div className="m-tip"><Icon name="star" size={16} /><span>{b.tip}</span></div>}
      {b.warn && <div className="m-warn"><Icon name="flag" size={16} /><span>{b.warn}</span></div>}
    </section>
  );
}

function Article({ a, list, base, backLabel }) {
  const i = list.findIndex((x) => x.slug === a.slug);
  const next = list[i + 1];
  return (
    <article className="m-article">
      <BackLink to={base}>{backLabel}</BackLink>
      <div className="m-meta">{[a.level && LEVEL_LABEL[a.level], a.minutes && `${a.minutes} мин чтения`].filter(Boolean).join(' · ')}</div>
      <h1 className="page-title m-title">{a.title}</h1>
      <p className="lead">{a.summary}</p>
      {a.updated && <div className="m-updated small muted">{a.updated}</div>}
      {a.body.map((b, k) => <Section key={k} b={b} />)}
      {a.links?.length > 0 && (
        <div className="m-actions">
          <span className="small muted">Сделать на платформе:</span>
          {a.links.map(([to, label]) => <Link key={to} to={to} className="btn btn-secondary btn-sm">{label}</Link>)}
        </div>
      )}
      {a.sources?.length > 0 && (
        <div className="m-sources small muted">
          Источники: {a.sources.map(([href, label], k) => <Fragment key={href}>{k > 0 && ', '}<a href={href} target="_blank" rel="noreferrer">{label}</a></Fragment>)}
        </div>
      )}
      {next && (
        <Link to={`${base}/${next.slug}`} className="m-next panel">
          <span className="small muted">Дальше</span>
          <b>{next.title}</b>
        </Link>
      )}
    </article>
  );
}

function ArticleCard({ a, base }) {
  return (
    <Link to={`${base}/${a.slug}`} className="m-card">
      <b>{a.title}</b>
      <span className="muted small">{a.summary}</span>
      <span className="m-card-meta small">{a.minutes} мин</span>
    </Link>
  );
}

function Activities() {
  const toast = useToast();
  const [type, setType] = useState('');
  const [age, setAge] = useState('');
  const [level, setLevel] = useState('');
  const [open, setOpen] = useState(null);
  const order = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const list = ACTIVITIES.filter((x) => (!type || x.type === type) && (!age || x.ages.includes(age)) && (!level || order.indexOf(x.level) <= order.indexOf(level)));
  const copy = (x) => {
    const text = [`${x.title} (${x.minutes} мин, от ${x.level})`, `Подготовка: ${x.prep}`, ...x.steps.map((s, i) => `${i + 1}. ${s}`), x.variant && `Вариант: ${x.variant}`].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('Скопировано: вставьте в план урока'));
  };
  return (
    <>
      <BackLink to="/method">Методика</BackLink>
      <h1 className="page-title">Банк активностей</h1>
      <p className="lead">Разминки, игры и задания на говорение. Все работают онлайн, почти все без подготовки.</p>
      <div className="m-filters">
        <div className="seg seg-wrap">
          <button type="button" className={!type ? 'on' : ''} onClick={() => setType('')}>Все</button>
          {ACTIVITY_TYPES.map(([k, l]) => <button key={k} type="button" className={type === k ? 'on' : ''} onClick={() => setType(k)}>{l}</button>)}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Возраст">
            <option value="">Любой возраст</option>
            {AGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className="select" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Уровень ученика">
            <option value="">Любой уровень</option>
            {order.map((l) => <option key={l} value={l}>Ученик {l}</option>)}
          </select>
        </div>
      </div>
      <div className="small muted" style={{ margin: '4px 0 12px' }}>Найдено: {list.length}</div>
      <div className="m-acts">
        {list.map((x) => (
          <section key={x.id} className={`panel m-act${open === x.id ? ' open' : ''}`}>
            <button type="button" className="m-act-head" aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
              <span className="m-act-title">{x.title}</span>
              <span className="m-act-tags small muted">
                {ACTIVITY_TYPES.find((t) => t[0] === x.type)?.[1]} · {x.minutes} мин · от {x.level}
              </span>
            </button>
            {open === x.id && (
              <div className="m-act-body">
                <div className="small muted">Подготовка: {x.prep}. {x.ages.map((a) => AGES.find((g) => g[0] === a)?.[1]).join(', ')}.{!x.offline ? ' Лучше онлайн.' : ''}</div>
                <ol className="m-steps">{x.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                {x.variant && <div className="m-tip"><Icon name="star" size={16} /><span>{x.variant}</span></div>}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(x)}>Скопировать в план урока</button>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function Index({ title, lead, groups, articles, base, tutor }) {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('');
  const search = useMemo(() => articles.map((a) => [a, plain(a)]), [articles]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = search.filter(([a, t]) => (!level || a.level === level) && words.every((w) => t.includes(w))).map(([a]) => a);
  const searching = Boolean(words.length || level);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{title}</h1>
          <div className="lead">{lead}</div>
        </div>
      </div>
      <div className="m-search">
        <Icon name="search" size={18} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tutor ? 'Например: первый урок, ошибки, монолог' : 'Например: слова, домашка'} />
      </div>
      {tutor && (
        <div className="seg seg-wrap" style={{ marginBottom: 18 }}>
          {LEVELS.map(([k, l]) => <button key={k} type="button" className={level === k ? 'on' : ''} onClick={() => setLevel(k)}>{l}</button>)}
        </div>
      )}
      {tutor && !searching && (
        <Link to="/method/activities" className="m-feature">
          <Icon name="grid" size={22} />
          <div>
            <b>Банк активностей</b>
            <span className="small">{ACTIVITIES.length} разминок, игр и заданий на говорение с фильтром по возрасту и уровню</span>
          </div>
          <Icon name="back" size={18} />
        </Link>
      )}
      {searching ? (
        filtered.length ? <div className="m-grid">{filtered.map((a) => <ArticleCard key={a.slug} a={a} base={base} />)}</div>
          : <p className="muted">Ничего не нашлось. Попробуйте другое слово.</p>
      ) : groups.map((g) => {
        const items = articles.filter((a) => a.group === g.id);
        if (!items.length) return null;
        return (
          <section key={g.id} className="m-group">
            <h2 className="m-group-title">{g.title}</h2>
            <div className="small muted" style={{ marginBottom: 10 }}>{g.text}</div>
            <div className="m-grid">{items.map((a) => <ArticleCard key={a.slug} a={a} base={base} />)}</div>
          </section>
        );
      })}
    </>
  );
}

// Методика преподавателя: /method, /method/activities, /method/:slug
export function TutorMethod({ slug }) {
  if (slug === 'activities') return <Activities />;
  const a = slug && findTutorArticle(slug);
  if (a) return <Article a={a} list={TUTOR_ALL} base="/method" backLabel="Методика" />;
  return <Index title="Методика" lead="Как строить уроки, работать с разными учениками и готовить к экзаменам. Коротко и по делу." groups={TUTOR_GROUPS} articles={TUTOR_ALL} base="/method" tutor />;
}

// «Как учиться» для ученика и родителя: /learn, /learn/:slug
export function ClientMethod({ slug }) {
  const a = slug && CLIENT_ARTICLES.find((x) => x.slug === slug);
  if (a) return <Article a={a} list={CLIENT_ARTICLES} base="/learn" backLabel="Как учиться" />;
  return <Index title="Как учиться" lead="Советы ученикам и родителям: как учить слова, делать домашку и готовиться к экзаменам." groups={CLIENT_GROUPS} articles={CLIENT_ARTICLES} base="/learn" />;
}

// Подсказка из методики в нужном месте платформы
export function MethodTip({ slug, text }) {
  const a = findTutorArticle(slug);
  if (!a) return null;
  return (
    <Link to={`/method/${slug}`} className="m-inline-tip">
      <Icon name="bulb" size={16} />
      <span>{text || a.summary} <b>{a.title}</b></span>
    </Link>
  );
}

// Совет дня на главной: каждый день новая статья
export function DailyMethodTip() {
  const day = Math.floor(Date.now() / 864e5);
  const a = TUTOR_ALL[day % TUTOR_ALL.length];
  return (
    <Link to={`/method/${a.slug}`} className="m-daily panel">
      <span className="small muted"><Icon name="bulb" size={14} /> Из методики</span>
      <b>{a.title}</b>
      <span className="small muted">{a.summary}</span>
    </Link>
  );
}
