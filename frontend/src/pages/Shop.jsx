// pages/Shop.jsx — витрина готовых интерактивных уроков (отдельно от платформы).
// Уроки берутся из магазина (бэкенд /api/shop). Покупка идёт на сайте магазина или в Telegram-боте.
import { useMemo, useState } from 'react';
import { api } from '../api';
import { useLoad, Link, Icon } from '../ui';
import { BRAND } from '../config';
import { useAuth } from '../auth';

const rub = (n) => `${Number(n).toLocaleString('ru-RU')} ₽`;
const where = (p) => (p.course ? `Курс на учебный год · ${p.gradeLabel}` : [p.gradeLabel, p.unit || p.moduleTitle].filter(Boolean).join(' · '));

function buyLink(p, shop) {
  if (p.free && p.demo) return { href: p.demo, label: 'Открыть бесплатно' };
  if (p.status === 'soon') return shop.bot || shop.channel ? { href: shop.channel || `https://t.me/${shop.bot}`, label: 'Узнать о выходе', quiet: true } : null;
  const label = p.status === 'preorder' ? 'Предзаказ' : 'Купить';
  if (shop.pay) return { href: `${shop.shop_url}/?buy=${encodeURIComponent(p.sku)}`, label };
  if (shop.bot) return { href: `https://t.me/${shop.bot}?start=p_${encodeURIComponent(p.sku)}`, label: `${label} в Telegram` };
  return null;
}

function Price({ p }) {
  if (p.free) return <span className="lp-price">Бесплатно</span>;
  return <span className="lp-price">{rub(p.price)}{p.oldPrice ? <s>{rub(p.oldPrice)}</s> : null}</span>;
}

function Card({ p, shop }) {
  const b = buyLink(p, shop);
  const cover = p.shots?.[0];
  return (
    <article className={`lp-card ${p.course ? 'course' : ''} ${p.status === 'soon' ? 'soon' : ''}`}>
      {cover ? (
        <div className="lp-cover"><img src={cover.src} alt={cover.caption || p.title} loading="lazy" />{p.shots.length > 1 && <span>{p.shots.length} экранов</span>}</div>
      ) : (
        <div className={`lp-cover blank ${p.course ? 'course' : p.type === 'pack' ? 'pack' : ''}`}><span className="serif">{p.course ? 'Весь курс' : p.type === 'pack' ? 'Модуль' : p.short}</span></div>
      )}
      <div className="lp-card-body">
        <span className="lp-where">{where(p)}{p.status === 'preorder' ? ' · предзаказ' : ''}{p.status === 'soon' ? ' · готовится' : ''}</span>
        <h3 className="lp-card-title">{p.title}</h3>
        {p.description && <p className="lp-desc">{p.description}</p>}
        {p.course && <p className="lp-course-note">Готово уроков: {p.ready}{p.total > p.ready ? `, ещё готовятся: ${p.total - p.ready}` : ''}. Новые уроки этого класса приходят сами, без доплаты.</p>}
        {p.meta?.length > 0 && <div className="lp-facts">{p.meta.slice(0, 4).map((m) => <span key={m}>{m}</span>)}</div>}
        <div className="lp-buy">
          {p.status !== 'soon' ? <Price p={p} /> : <span className="lp-badge">Скоро</span>}
          {b && <a className={`btn ${b.quiet ? 'btn-secondary' : ''} btn-sm`} href={b.href} target="_blank" rel="noopener noreferrer">{b.label}</a>}
        </div>
      </div>
    </article>
  );
}

export default function Shop() {
  const shop = useLoad(() => api.shop().catch(() => ({ enabled: false, products: [], textbooks: [] })), []);
  const reg = useLoad(() => api.registrationStatus().catch(() => ({ open: false })), []);
  const [book, setBook] = useState('all');
  const { session } = useAuth();
  const raw = shop.data || {};
  const s = { ...raw, enabled: Boolean(raw.enabled), products: Array.isArray(raw.products) ? raw.products : [], textbooks: Array.isArray(raw.textbooks) ? raw.textbooks : [] };
  const books = s.textbooks.filter((t) => s.products.some((p) => p.book === t.id));
  const list = useMemo(() => {
    const rank = (p) => (p.course ? 0 : p.status === 'soon' ? 3 : p.type === 'pack' ? 2 : 1);
    return s.products.filter((p) => book === 'all' || p.book === book).sort((a, b) => rank(a) - rank(b));
  }, [s.products, book]);
  const free = s.products.find((p) => p.free && p.demo);
  const lessons = s.products.filter((p) => p.type === 'lesson' && p.status !== 'soon').length;

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-top-in">
          <a href="#/" className="lp-brand"><span className="brand-name">{BRAND.name}</span></a>
          <nav className="lp-nav">
            <a href="#lessons" onClick={(e) => { e.preventDefault(); document.getElementById('lessons')?.scrollIntoView({ behavior: 'smooth' }); }}>Уроки</a>
            <Link to="/">Платформа</Link>
            {session ? <Link to="/" className="btn btn-sm">Мой кабинет</Link> : <Link to="/login" className="btn btn-sm">Войти</Link>}
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-kicker">Интерактивные уроки английского</div>
          <h1 className="lp-h1">Готовые уроки к школьным учебникам. Открыл, вывел на доску, провёл.</h1>
          <p className="lp-lead">В каждом уроке озвучка, игры с автопроверкой, режимы для сильных и слабых, счёт команд и PDF для учителя с ответами. Для школьных учителей и репетиторов.</p>
          <div className="lp-cta">
            <a href="#lessons" className="btn" onClick={(e) => { e.preventDefault(); document.getElementById('lessons')?.scrollIntoView({ behavior: 'smooth' }); }}>Смотреть уроки</a>
            {free && <a href={free.demo} className="btn btn-ghost-light" target="_blank" rel="noopener noreferrer">Бесплатный урок</a>}
            {!free && s.bot && <a href={`https://t.me/${s.bot}`} className="btn btn-ghost-light" target="_blank" rel="noopener noreferrer">Бот с уроками</a>}
          </div>
          {s.enabled && lessons > 0 && (
            <div className="lp-stats">
              <div><b className="serif">{lessons}</b><span>{lessons === 1 ? 'урок готов' : 'уроков готово'}</span></div>
              <div><b className="serif">{books.length}</b><span>{books.length === 1 ? 'учебник' : 'учебника'}</span></div>
              <div><b className="serif">40-60</b><span>минут урок</span></div>
            </div>
          )}
        </div>
      </section>

      <section className="lp-wrap lp-section" id="lessons">
        <div className="lp-head">
          <h2 className="lp-h2">Уроки и курсы</h2>
          {books.length > 1 && (
            <div className="seg">
              <button type="button" className={book === 'all' ? 'on' : ''} onClick={() => setBook('all')}>Все</button>
              {books.map((t) => <button key={t.id} type="button" className={book === t.id ? 'on' : ''} onClick={() => setBook(t.id)}>{t.short || t.title}</button>)}
            </div>
          )}
        </div>
        {shop.loading ? <div className="spinner" /> : !list.length ? (
          <div className="lp-empty">
            <div className="serif">Первые уроки скоро появятся</div>
            <p className="muted">{s.bot ? <>Подпишитесь на бота <a href={`https://t.me/${s.bot}`} target="_blank" rel="noopener noreferrer">@{s.bot}</a>, он пришлёт новые уроки.</> : 'Загляните чуть позже.'}</p>
          </div>
        ) : (
          <div className="lp-grid">{list.map((p) => <Card key={p.sku} p={p} shop={s} />)}</div>
        )}
      </section>

      <section className="lp-wrap lp-section">
        <h2 className="lp-h2">Как это работает</h2>
        <div className="lp-steps">
          <div><span className="serif">1</span><b>Выберите урок</b><p>По учебнику, классу и модулю. Начните с бесплатного, чтобы посмотреть, как всё устроено.</p></div>
          <div><span className="serif">2</span><b>Оплатите</b><p>Картой или СБП через ЮKassa прямо на сайте. Ссылка на урок придёт на почту, файлы навсегда ваши.</p></div>
          <div><span className="serif">3</span><b>Проведите урок</b><p>Откройте файл урока в браузере и выведите на доску или экран. Ничего устанавливать не нужно.</p></div>
        </div>
      </section>

      <section className="lp-tutors">
        <div className="lp-wrap lp-tutors-in">
          <div>
            <div className="lp-kicker">{BRAND.name}</div>
            <h2 className="lp-h2 light">Ведёте учеников? Попробуйте платформу</h2>
            <p style={{ color: 'rgba(255,255,255,.8)', maxWidth: 560 }}>Расписание, домашние задания с автопроверкой, карточки, банк заданий и кабинеты для учеников и родителей. Уроки из магазина открываются прямо на ней.</p>
          </div>
          <div className="lp-login-box">
            <Link to="/" className="btn btn-light">О платформе</Link>
            {!session && reg.data?.open && <Link to="/register" className="btn btn-ghost-light">Создать кабинет бесплатно</Link>}
          </div>
        </div>
      </section>

      <footer className="lp-wrap lp-foot">
        <span className="brand-name" style={{ fontSize: 20 }}>{BRAND.name}</span>
        {s.enabled && (
          <nav>
            <a href={`${s.shop_url}/my`} target="_blank" rel="noopener noreferrer">Мои уроки</a>
            <a href={`${s.shop_url}/offer`} target="_blank" rel="noopener noreferrer">Оферта</a>
            <a href={`${s.shop_url}/privacy`} target="_blank" rel="noopener noreferrer">Персональные данные</a>
            <a href={`${s.shop_url}/seller`} target="_blank" rel="noopener noreferrer">Продавец</a>
            {s.bot && <a href={`https://t.me/${s.bot}`} target="_blank" rel="noopener noreferrer">Telegram-бот</a>}
          </nav>
        )}
      </footer>
    </div>
  );
}
