// pages/Landing.jsx — продающая главная платформы для репетитора: боль, решение, расчёт выгоды, тарифы, вопросы.
// Готовые интерактивные уроки живут отдельно: страница /shop и сайт магазина.
import { useState } from 'react';
import { PlanTable } from '../components/Plans';
import { api } from '../api';
import { useLoad, Link, Icon } from '../ui';
import { BRAND } from '../config';
import { LegalFooter } from './Legal';
import { useAuth } from '../auth';

const scrollTo = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
const rub = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

const PAINS = [
  ['Расписание в заметках, переносы в переписке', 'Кто когда занимается, кто перенёс и на когда, держится в голове и в десятке чатов.'],
  ['Напоминания вручную', 'Перед каждым уроком пишете «не забудь, сегодня в 17:00», а кто-то всё равно забывает.'],
  ['Проверка домашки по вечерам', 'Фото тетрадей в мессенджере, одни и те же ошибки, ответы на вопросы до ночи.'],
  ['Кто сколько заплатил', 'Абонементы, долги и доход за месяц в таблице, которую вечно некогда обновить.'],
];

const BLOCKS = [
  {
    id: 'hw', kicker: 'Домашние задания', title: 'Задаёте за минуту, проверяет платформа',
    points: ['Тесты, пропуски, сопоставление, исправь ошибки, перепиши предложение, диктант на слух', 'Письмо с чек-листом: пока ученик пишет, сайт отмечает объём и нужные конструкции', 'Ответ голосом и фото тетради для того, что проверяете сами', 'Банк готовых заданий по учебникам и грамматике, свои упражнения в библиотеке'],
    mock: 'hw',
  },
  {
    id: 'words', kicker: 'Словарь и карточки', title: 'Слова с урока сразу у ученика',
    points: ['Добавили слова к уроку, и они появились в словаре ученика', 'Британское произношение: живой голос диктора для слов и транскрипция', 'Пять режимов тренировки, слова с ошибками возвращаются чаще', 'Вставка списком из Word или Excel: сотня слов за секунду'],
    mock: 'words',
  },
  {
    id: 'money', kicker: 'Оплаты и доход', title: 'Учёт, который ведётся сам',
    points: ['Абонементы и разовые оплаты: ученик платит вам напрямую, как привыкли', 'После урока занятие само списывается с абонемента', 'Видно, у кого заканчивается абонемент и кто должен', 'Доход по месяцам и подсказка, какую цену урока поставить'],
    mock: 'money',
  },
  {
    id: 'bot', kicker: 'Telegram-бот', title: 'Напоминает за вас',
    points: ['Ученику за час до урока: время и ссылка на занятие', 'О домашке накануне срока и в день сдачи, о словах вечером', 'Вам каждое утро: уроки на сегодня и что пришло на проверку', 'Никаких рассылок вручную'],
    mock: 'bot',
  },
];

const FAQ = [
  ['Ученикам и родителям нужно платить?', 'Нет. Кабинеты учеников и родителей бесплатные. Подписку оформляет только репетитор.'],
  ['Как ученики платят за уроки?', 'Как и раньше, напрямую вам: переводом, наличными, как договорились. Платформа только ведёт учёт оплат, абонементов и дохода.'],
  ['Подойдёт, если я веду не английский?', 'Да. Платформа сделана в первую очередь для английского: британская озвучка, банк заданий по учебникам, задания на письмо с чек-листом. Но расписание, домашка, карточки, учёт оплат и бот работают для любого предмета.'],
  ['Что будет после 14 дней?', `Если не оформить тариф, кабинет переходит на бесплатный «Старт» (до 3 учеников). Ученики, задания и история сохраняются.`],
  ['Работает на телефоне?', 'Да, на любом телефоне и компьютере в браузере. Ученику не нужно ничего устанавливать.'],
  ['Где хранятся данные?', 'На сервере в России, в соответствии с законом о персональных данных. Ученики входят по логину и паролю, которые вы им выдаёте: почта и телефон не нужны.'],
  ['Можно отказаться?', 'Да, в любой момент. Подписка просто не продлится, данные останутся в кабинете на тарифе «Старт».'],
];

function HeroMock() {
  return (
    <div className="lx-mock" aria-hidden="true">
      <div className="lx-win">
        <div className="lx-win-top"><i /><i /><i /><span>Сегодня, вторник</span></div>
        <div className="lx-row"><b>15:00</b><span>Аня К. · English, Unit 4</span><em className="ok">оплачено</em></div>
        <div className="lx-row"><b>17:00</b><span>Миша и Лера · группа</span><em>через 2 ч</em></div>
        <div className="lx-row"><b>19:30</b><span>Олег · подготовка к ОГЭ</span><em className="warn">осталось 1 занятие</em></div>
        <div className="lx-sep">Пришло на проверку</div>
        <div className="lx-row"><span>Аня К. · Present Simple</span><em className="ok">18 / 20</em></div>
        <div className="lx-row"><span>Олег · письмо, чек-лист</span><em className="ok">5 / 6 ✓</em></div>
      </div>
      <div className="lx-bubble"><b>{BRAND.name}</b>⏰ Через час урок английского в 17:00. Ссылка на занятие внутри.</div>
    </div>
  );
}

function BlockMock({ kind }) {
  if (kind === 'hw') return (
    <div className="lx-card">
      <div className="lx-card-h">My typical Monday · письмо</div>
      <div className="lx-text">On Mondays I <u>usually</u> get up at 7. <u>Then</u> I have breakfast and I <u>often</u> walk to school…</div>
      {[['Не меньше 60 слов', 1], ['Наречия частоты: 3 из always, usually…', 1], ['Слова порядка: then, after that…', 1], ['Точка в конце предложений', 0]].map(([t, ok]) => (
        <div key={t} className={`lx-check ${ok ? 'ok' : ''}`}><i>{ok ? '✓' : ''}</i>{t}</div>
      ))}
    </div>
  );
  if (kind === 'words') return (
    <div className="lx-card lx-flash">
      <span className="lx-tag">Set: Unit 5 · 12 слов</span>
      <b className="serif">expensive</b>
      <span className="lx-ipa">/ɪkˈspensɪv/</span>
      <span className="lx-play"><Icon name="sound" size={16} /> голос диктора</span>
      <div className="lx-modes">{['Карточки', 'Заучивание', 'Письмо', 'Подбор', 'Тест'].map((m) => <span key={m}>{m}</span>)}</div>
    </div>
  );
  if (kind === 'money') return (
    <div className="lx-card">
      <div className="lx-card-h">Ноябрь</div>
      <div className="lx-big serif">48 500 ₽</div>
      <div className="lx-bars">{[38, 52, 44, 61, 47, 70, 58].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
      <div className="lx-row"><span>Аня К. · абонемент 8 уроков</span><em>осталось 2</em></div>
      <div className="lx-row"><span>Олег · абонемент закончился</span><em className="warn">напомнить</em></div>
    </div>
  );
  return (
    <div className="lx-card lx-chat">
      <div className="lx-msg">⏰ <b>Через час урок</b><br />Английский, 17:00<br /><u>Открыть занятие</u></div>
      <div className="lx-msg">📚 <b>Домашка на завтра</b><br />Present Simple: 20 вопросов</div>
      <div className="lx-msg me">☀️ <b>Доброе утро!</b> Сегодня 4 урока, на проверку пришло 3 работы</div>
    </div>
  );
}

function Calculator({ price }) {
  const [students, setStudents] = useState(10);
  const [rate, setRate] = useState(1200);
  const [mins, setMins] = useState(10);
  const hours = (students * mins * 4.3) / 60;
  const worth = hours * rate;
  const payback = price ? Math.ceil((price / rate) * 60) : 0;
  return (
    <div className="lx-calc">
      <div className="lx-calc-in">
        <label><span>Учеников</span><b>{students}</b><input type="range" min="1" max="40" value={students} onChange={(e) => setStudents(+e.target.value)} /></label>
        <label><span>Цена часа</span><b>{rub(rate)}</b><input type="range" min="500" max="4000" step="100" value={rate} onChange={(e) => setRate(+e.target.value)} /></label>
        <label><span>Сэкономленных минут в неделю на ученика</span><b>{mins} мин</b><input type="range" min="5" max="30" step="5" value={mins} onChange={(e) => setMins(+e.target.value)} /></label>
        <p className="small muted">Напоминания, переносы, проверка домашки и учёт оплат. Поставьте свою оценку.</p>
      </div>
      <div className="lx-calc-out">
        <div><b className="serif">{hours.toFixed(1).replace('.', ',')} ч</b><span>в месяц возвращается вам</span></div>
        <div><b className="serif">{rub(worth)}</b><span>столько стоит это время по вашей цене часа</span></div>
        {price > 0 && <div><b className="serif">{payback} мин</b><span>сэкономленного времени окупают подписку за {price} ₽</span></div>}
      </div>
    </div>
  );
}

export default function Landing() {
  const reg = useLoad(() => api.registrationStatus().catch(() => ({ open: false })), []);
  const plans = useLoad(() => api.publicPlans().catch(() => null), []);
  const { session } = useAuth();
  const [faq, setFaq] = useState(0);
  const open = !session && reg.data?.open;
  const paid = plans.data?.plans?.find((p) => p.price > 0);
  const price = paid?.price || 499;
  const trial = plans.data?.trial_days || 14;
  const Cta = ({ light, label }) => (open
    ? <Link to="/register" className={`btn ${light ? 'btn-light' : ''}`}>{label || `Попробовать ${trial} ${plural(trial, 'день', 'дня', 'дней')} бесплатно`}</Link>
    : <Link to={session ? '/' : '/login'} className={`btn ${light ? 'btn-light' : ''}`}>{session ? 'Открыть кабинет' : 'Войти в кабинет'}</Link>);

  return (
    <div className="lp lx">
      <header className="lp-top">
        <div className="lp-wrap lp-top-in">
          <a href="#/" className="lp-brand"><span className="brand-name">{BRAND.name}</span></a>
          <nav className="lp-nav">
            <a href="#features" onClick={scrollTo('features')}>Возможности</a>
            <a href="#calc" onClick={scrollTo('calc')}>Выгода</a>
            <a href="#pricing" onClick={scrollTo('pricing')}>Цена</a>
            <a href="#faq" onClick={scrollTo('faq')}>Вопросы</a>
            {session ? <Link to="/" className="btn btn-sm">Мой кабинет</Link> : <Link to="/login" className="btn btn-sm btn-secondary">Войти</Link>}
          </nav>
        </div>
      </header>

      <section className="lp-hero lx-hero">
        <div className="lp-wrap lx-hero-in">
          <div>
            <div className="lp-kicker">Платформа для репетитора английского</div>
            <h1 className="lp-h1">Ведите уроки, а не таблицы и переписки</h1>
            <p className="lp-lead">Расписание с напоминаниями, домашка с автопроверкой, словарь с британским диктором и учёт оплат в одном кабинете. Ученики и родители видят всё у себя. Вы возвращаете себе вечера.</p>
            <div className="lp-cta">
              <Cta />
              <a href="#features" className="btn btn-ghost-light" onClick={scrollTo('features')}>Посмотреть возможности</a>
            </div>
            <div className="lx-trust">
              <span><Icon name="check" size={14} /> {trial} дней всё открыто, без карты</span>
              <span><Icon name="check" size={14} /> ученикам и родителям бесплатно</span>
              <span><Icon name="check" size={14} /> данные на сервере в России</span>
            </div>
          </div>
          <HeroMock />
        </div>
      </section>

      <section className="lp-wrap lx-section">
        <div className="lp-kicker lx-k">Знакомо?</div>
        <h2 className="lp-h2">Репетитор работает больше, чем ведёт уроки</h2>
        <div className="lx-pains">
          {PAINS.map(([t, d]) => <div key={t}><b>{t}</b><p>{d}</p></div>)}
        </div>
        <p className="lx-answer"><b>{BRAND.name}</b> забирает эту рутину: напоминает, проверяет, считает и показывает родителям результат.</p>
      </section>

      <section className="lp-wrap lx-section" id="features">
        <div className="lp-kicker lx-k">Возможности</div>
        <h2 className="lp-h2">Всё, что окружает урок, в одном месте</h2>
        {BLOCKS.map((b, i) => (
          <div key={b.id} className={`lx-block ${i % 2 ? 'rev' : ''}`}>
            <div>
              <div className="lx-bk">{b.kicker}</div>
              <h3 className="lx-h3 serif">{b.title}</h3>
              <ul className="lx-points">{b.points.map((p) => <li key={p}><Icon name="check" size={16} />{p}</li>)}</ul>
            </div>
            <BlockMock kind={b.mock} />
          </div>
        ))}
        <div className="lx-more">
          {[['calendar', 'Запись на свободное время', 'Ученик выбирает слот, вы подтверждаете'], ['video', 'Комната урока', 'Звонок, доска и материалы по одной ссылке'], ['users', 'Группы', 'Пары и мини-группы с общей домашкой'], ['report', 'Отчёт после урока', 'Родитель видит, что прошли и что задано']].map(([ic, t, d]) => (
            <div key={t}><Icon name={ic} size={20} /><b>{t}</b><span>{d}</span></div>
          ))}
        </div>
      </section>

      <section className="lx-parents">
        <div className="lp-wrap lx-parents-in">
          <div>
            <div className="lp-kicker">Для родителей и учеников</div>
            <h2 className="lp-h2 light">Ваша работа становится видна</h2>
            <p>Родитель открывает кабинет и видит расписание, выполненные задания, выученные слова и отчёт после каждого урока. Вопросов «а что вы проходите?» становится меньше, а доверия больше.</p>
            <p>Это сильный аргумент, когда вы решите поднять цену урока.</p>
          </div>
          <div className="lx-parent-card">
            <div className="lx-card-h">Отчёт родителю · 12 ноября</div>
            <div className="lx-row"><span>Тема</span><em>Present Simple, вопросы</em></div>
            <div className="lx-row"><span>Домашка</span><em className="ok">18 из 20</em></div>
            <div className="lx-row"><span>Новые слова</span><em>12, выучено 9</em></div>
            <div className="lx-row"><span>Следующий урок</span><em>четверг, 17:00</em></div>
          </div>
        </div>
      </section>

      <section className="lp-wrap lx-section" id="calc">
        <div className="lp-kicker lx-k">Посчитайте сами</div>
        <h2 className="lp-h2">Сколько времени возвращает платформа</h2>
        <Calculator price={price} />
      </section>

      <section className="lp-wrap lx-section">
        <h2 className="lp-h2">Начать можно сегодня</h2>
        <div className="lp-steps">
          <div><span className="serif">1</span><b>Создайте кабинет</b><p>Две минуты: имя, предмет, цена урока. {trial} дней открыто всё, карта не нужна.</p></div>
          <div><span className="serif">2</span><b>Добавьте учеников</b><p>Платформа выдаст ученику и родителю логин и пароль. Почта и телефон не нужны.</p></div>
          <div><span className="serif">3</span><b>Ведите уроки</b><p>Расписание, домашка, слова и оплаты собираются сами, а бот напоминает ученикам.</p></div>
        </div>
      </section>

      {plans.data?.plans?.length > 0 && (
        <section className="lp-wrap lx-section" id="pricing">
          <div className="lp-kicker lx-k">Цена</div>
          <h2 className="lp-h2">{price} ₽ в месяц. Дешевле одного урока.</h2>
          <p className="muted" style={{ marginTop: -8, marginBottom: 22 }}>Один тариф, где открыто всё: ученики без ограничений, группы, бот, банк заданий и учёт. Есть бесплатный «Старт» до 3 учеников.</p>
          <PlanTable data={plans.data} />
        </section>
      )}

      <section className="lp-wrap lx-section" id="faq">
        <h2 className="lp-h2">Частые вопросы</h2>
        <div className="lx-faq">
          {FAQ.map(([q, a], i) => (
            <div key={q} className={`lx-faq-i ${faq === i ? 'open' : ''}`}>
              <button type="button" onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i}>{q}<span>{faq === i ? '−' : '+'}</span></button>
              {faq === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="lx-final">
        <div className="lp-wrap">
          <h2 className="lp-h2 light">Попробуйте на своих учениках</h2>
          <p>{trial} дней всё открыто. Не понравится, просто останетесь на бесплатном тарифе.</p>
          <div className="lp-cta" style={{ justifyContent: 'center' }}>
            <Cta light />
            {!session && <Link to="/login" className="btn btn-ghost-light">Я ученик или родитель: войти</Link>}
          </div>
        </div>
      </section>

      <section className="lp-wrap lx-section">
        <div className="lp-shop-teaser">
          <div>
            <div className="lp-kicker lx-k">Отдельно от платформы</div>
            <h2 className="lp-h2" style={{ marginBottom: 8, fontSize: 30 }}>Готовые интерактивные уроки</h2>
            <p className="muted" style={{ margin: 0, maxWidth: 620 }}>Уроки к школьным учебникам с озвучкой и играми с автопроверкой. Покупаются отдельно, подписка не нужна.</p>
          </div>
          <Link to="/shop" className="btn btn-secondary">Смотреть уроки</Link>
        </div>
      </section>

      <footer className="lp-wrap lp-foot">
        <span className="brand-name" style={{ fontSize: 20 }}>{BRAND.name}</span>
        <nav>
          <Link to="/shop">Готовые уроки</Link>
          <Link to="/login">Вход</Link>
        </nav>
        <LegalFooter />
      </footer>
    </div>
  );
}
