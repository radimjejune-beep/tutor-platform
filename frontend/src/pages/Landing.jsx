// pages/Landing.jsx — главная до входа: платформа для репетитора, тарифы и вход.
// Готовые интерактивные уроки живут отдельно: страница /shop и сайт магазина.
import { PlanTable } from '../components/Plans';
import { api } from '../api';
import { useLoad, Link, Icon } from '../ui';
import { BRAND } from '../config';
import { useAuth } from '../auth';

const FEATURES = [
  { icon: 'calendar', title: 'Расписание и запись', text: 'Уроки, переносы и отмены по вашим правилам. Ученик сам записывается на свободное время, вы подтверждаете.' },
  { icon: 'book', title: 'Домашка с автопроверкой', text: 'Тесты, пропуски, исправь ошибки, диктант, письмо с чек-листом, ответ голосом. Проверяет сайт, вы видите только ошибки.' },
  { icon: 'cards', title: 'Словарь и карточки', text: 'Слова живым британским голосом диктора, транскрипция и пять режимов тренировки. Слова с урока сами попадают ученику.' },
  { icon: 'layers', title: 'Банк заданий и библиотека', text: 'Готовые задания по популярным учебникам и грамматике, ваши учебники в PDF и свои упражнения в папках.' },
  { icon: 'video', title: 'Комната урока', text: 'Звонок, доска, материалы и заметки в одном окне. Ученик заходит по одной ссылке.' },
  { icon: 'users', title: 'Кабинет родителя', text: 'Родитель видит расписание, домашку, прогресс и отчёт после урока. Меньше вопросов в мессенджерах.' },
  { icon: 'wallet', title: 'Абонементы и доход', text: 'Оплаты, абонементы и автосписание после урока. Доход по месяцам и подсказка, какую цену поставить.' },
  { icon: 'bell', title: 'Telegram-бот', text: 'Напоминание ученику за час до урока, о домашке и словах. Вам каждое утро сводка дня.' },
];

const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

export default function Landing() {
  const reg = useLoad(() => api.registrationStatus().catch(() => ({ open: false })), []);
  const plans = useLoad(() => api.publicPlans().catch(() => null), []);
  const { session } = useAuth();
  const open = !session && reg.data?.open;
  const paid = plans.data?.plans?.find((p) => p.price > 0);
  const trial = plans.data?.trial_days || 14;

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-wrap lp-top-in">
          <a href="#/" className="lp-brand"><span className="brand-name">{BRAND.name}</span></a>
          <nav className="lp-nav">
            <a href="#features" onClick={scrollTo('features')}>Возможности</a>
            <a href="#pricing" onClick={scrollTo('pricing')}>Тарифы</a>
            <Link to="/shop">Готовые уроки</Link>
            {session ? <Link to="/" className="btn btn-sm">Мой кабинет</Link> : <Link to="/login" className="btn btn-sm">Войти</Link>}
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-wrap">
          <div className="lp-kicker">Платформа для репетитора</div>
          <h1 className="lp-h1">Вы ведёте уроки. Расписание, домашку и оплаты платформа берёт на себя.</h1>
          <p className="lp-lead">Кабинеты для вас, учеников и родителей: расписание с напоминаниями, домашние задания с автопроверкой, словарь с британской озвучкой, банк заданий и абонементы. Для репетиторов английского и любого другого предмета.</p>
          <div className="lp-cta">
            {open ? <Link to="/register" className="btn">Попробовать бесплатно</Link> : <Link to={session ? '/' : '/login'} className="btn">{session ? 'Открыть кабинет' : 'Войти в кабинет'}</Link>}
            <a href="#features" className="btn btn-ghost-light" onClick={scrollTo('features')}>Что умеет платформа</a>
          </div>
          <div className="lp-stats">
            <div><b className="serif">{trial}</b><span>дней всё открыто бесплатно</span></div>
            {paid && <div><b className="serif">{paid.price} ₽</b><span>в месяц, без лимитов</span></div>}
            <div><b className="serif">0 ₽</b><span>ученикам и родителям</span></div>
          </div>
        </div>
      </section>

      <section className="lp-wrap lp-section" id="features">
        <div className="lp-kicker" style={{ color: 'var(--brass)' }}>Возможности</div>
        <h2 className="lp-h2">Всё для частной практики в одном месте</h2>
        <div className="lp-feat">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feat-card">
              <span className="lp-feat-ic"><Icon name={f.icon} size={20} /></span>
              <b>{f.title}</b>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-wrap lp-section">
        <h2 className="lp-h2">Как начать</h2>
        <div className="lp-steps">
          <div><span className="serif">1</span><b>Создайте кабинет</b><p>Две минуты: имя, предмет, цена урока. {trial} дней открыто всё, карта не нужна.</p></div>
          <div><span className="serif">2</span><b>Добавьте учеников</b><p>Платформа выдаст ученику и родителю логин и пароль. Почта и телефон не нужны.</p></div>
          <div><span className="serif">3</span><b>Ведите уроки</b><p>Расписание, домашка, слова и оплаты собираются сами. Ученик и родитель видят всё в своих кабинетах.</p></div>
        </div>
      </section>

      {plans.data?.plans?.length > 0 && (
        <section className="lp-wrap lp-section" id="pricing">
          <div className="lp-kicker" style={{ color: 'var(--brass)' }}>Тарифы</div>
          <h2 className="lp-h2">Один тариф, где открыто всё</h2>
          <PlanTable data={plans.data} />
          {open && <div style={{ marginTop: 18 }}><Link to="/register" className="btn">Попробовать бесплатно</Link></div>}
        </section>
      )}

      <section className="lp-wrap lp-section">
        <div className="lp-shop-teaser">
          <div>
            <div className="lp-kicker" style={{ color: 'var(--brass)' }}>Отдельно от платформы</div>
            <h2 className="lp-h2" style={{ marginBottom: 8 }}>Готовые интерактивные уроки</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 620 }}>Уроки на 40–60 минут к школьным учебникам: озвучка, игры с автопроверкой и подсказки для учителя. Покупаются отдельно, подписка на платформу не нужна.</p>
          </div>
          <Link to="/shop" className="btn btn-secondary">Смотреть уроки</Link>
        </div>
      </section>

      <section className="lp-tutors">
        <div className="lp-wrap lp-tutors-in">
          <div>
            <div className="lp-kicker">Ученикам и родителям</div>
            <h2 className="lp-h2 light">Уже занимаетесь с преподавателем?</h2>
            <p style={{ color: 'rgba(255,255,255,.8)', maxWidth: 560 }}>Войдите по логину и паролю, которые выдал преподаватель. Там расписание, домашние задания, словарь и оплаты.</p>
          </div>
          <div className="lp-login-box">
            {session ? <Link to="/" className="btn btn-light">Открыть кабинет</Link> : <Link to="/login" className="btn btn-light">Войти в кабинет</Link>}
            {open && <Link to="/register" className="btn btn-ghost-light">Я репетитор: создать кабинет</Link>}
          </div>
        </div>
      </section>

      <footer className="lp-wrap lp-foot">
        <span className="brand-name" style={{ fontSize: 20 }}>{BRAND.name}</span>
        <nav>
          <Link to="/shop">Готовые уроки</Link>
          <Link to="/login">Вход</Link>
        </nav>
      </footer>
    </div>
  );
}
