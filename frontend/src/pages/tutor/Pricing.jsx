// pages/tutor/Pricing.jsx — советник по цене: реальный доход в час и что даст повышение
import { useMemo, useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Link, Modal, useToast, navigate } from '../../ui';
import { rub, plural, dayMonth, dayKey } from '../../format';

export function FinanceTabs({ active }) {
  return (
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={active === 'income'} className={active === 'income' ? 'active' : ''} onClick={() => navigate('/finance')}>Доход</button>
      <button role="tab" aria-selected={active === 'pricing'} className={active === 'pricing' ? 'active' : ''} onClick={() => navigate('/finance/pricing')}>Цена</button>
    </div>
  );
}

const monthsSince = (d) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / (30.4 * 864e5))) : 0);

export default function Pricing() {
  const data = useLoad(() => api.pricing(), []);
  const [target, setTarget] = useState('');
  const [msgFor, setMsgFor] = useState(null);

  const d = data.data;
  const goal = Number(target) || d?.top_price_per_60 || 0;
  const rows = useMemo(() => {
    if (!d) return [];
    return d.students.map((s) => {
      const dur = s.default_duration || 60;
      const newPrice = Math.round((goal * dur) / 60 / 50) * 50; // цена занятия его длительности, кратно 50 ₽
      const gainMonth = Math.max(0, newPrice - s.price) * s.lessons_per_month;
      return { ...s, newPrice, gainMonth, below: s.price_per_60 < goal };
    });
  }, [d, goal]);

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;

  const below = rows.filter((r) => r.below);
  const gain = Math.round(below.reduce((sum, r) => sum + r.gainMonth, 0));
  const hours = rows.reduce((sum, r) => sum + r.minutes_90, 0) / 60;
  const income = rows.reduce((sum, r) => sum + r.income_90, 0);
  const lost = rows.reduce((sum, r) => sum + r.lost_90, 0);
  const done = rows.reduce((sum, r) => sum + r.done_90, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Доход</h1>
          <div className="lead">Сколько вы реально зарабатываете в час с каждого ученика и что даст новая цена. Данные за 90 дней.</div>
        </div>
      </div>
      <FinanceTabs active="pricing" />

      {!rows.length ? (
        <div className="panel"><Empty title="Пока нет данных">Советник появится, когда будут проведённые занятия.</Empty></div>
      ) : (
        <>
          <section className="price-hero">
            <div>
              <span className="meta-label">Реально в час</span>
              <b className="serif">{hours ? rub(Math.round(income / hours)) : '—'}</b>
              <span className="small muted">{rub(income)} за {Math.round(hours)} ч занятий</span>
            </div>
            <div>
              <span className="meta-label">Поздние отмены и пропуски</span>
              <b className="serif">{done + lost ? Math.round((lost / (done + lost)) * 100) : 0}%</b>
              <span className="small muted">{lost} из {done + lost} занятий</span>
            </div>
            <div>
              <span className="meta-label">Целевая цена за 60 минут</span>
              <div className="row" style={{ gap: 8 }}>
                <input className="input price-input" type="number" min={0} step={100} value={target} placeholder={String(d.top_price_per_60)}
                  onChange={(e) => setTarget(e.target.value)} aria-label="Целевая цена за 60 минут" />
                <span className="muted">₽</span>
              </div>
              <span className="small muted">По умолчанию ваша самая высокая цена сейчас</span>
            </div>
            <div>
              <span className="meta-label">Если поднять до цели</span>
              <b className="serif">+{rub(gain)}</b>
              <span className="small muted">в месяц, {below.length} {plural(below.length, 'ученик', 'ученика', 'учеников')} ниже цели</span>
            </div>
          </section>

          <section className="panel" style={{ padding: 0 }}>
            <div className="table-scroll">
              <table className="admin-table price-table">
                <thead>
                  <tr><th>Ученик</th><th>Цена сейчас</th><th>За 60 мин</th><th>Реально в час</th><th>Занятий в месяц</th><th>Отмены</th><th>Новая цена</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.below ? '' : 'ok-row'}>
                      <td>
                        <Link to={`/students/${r.id}/finance`} className="list-title" style={{ color: 'var(--ink)' }}>{r.full_name}</Link>
                        <div className="list-sub">{r.sub_price !== null ? 'абонемент' : 'разово'}, {r.default_duration} мин{r.first_lesson_at ? `, занимается ${monthsSince(r.first_lesson_at)} мес.` : ''}</div>
                      </td>
                      <td className="num">{rub(r.price)}</td>
                      <td className="num">{rub(r.price_per_60)}</td>
                      <td className="num">{r.real_per_hour ? rub(r.real_per_hour) : '—'}</td>
                      <td className="num">{r.lessons_per_month}</td>
                      <td className="num">{r.lost_90 ? <Badge tone="red">{r.lost_90}</Badge> : '0'}</td>
                      <td className="num">{r.below ? <b>{rub(r.newPrice)}</b> : <span className="muted">уже по цели</span>}</td>
                      <td>{r.below && <button className="btn btn-secondary btn-sm" onClick={() => setMsgFor(r)}>Сообщение</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="small muted" style={{ marginTop: 12 }}>
            «Реально в час» учитывает абонементы, разовые занятия и списанные поздние отмены, делённые на часы проведённых занятий.
            Прибавка считается по среднему числу занятий в месяц за последние 3 месяца.
          </p>
        </>
      )}

      {msgFor && <MessageModal s={msgFor} onClose={() => setMsgFor(null)} />}
    </>
  );
}

// Вежливое сообщение о новой цене с датой через месяц
function MessageModal({ s, onClose }) {
  const toast = useToast();
  const from = new Date(Date.now() + 30 * 864e5);
  from.setDate(1);
  if (from.getTime() - Date.now() < 21 * 864e5) from.setMonth(from.getMonth() + 1);
  const first = s.full_name.split(' ')[0];
  const parent = s.category !== 'adult';
  const months = monthsSince(s.first_lesson_at);
  const text = [
    parent ? 'Здравствуйте!' : `${first}, здравствуйте!`,
    '',
    `${months >= 2 ? `Мы занимаемся уже ${months} ${plural(months, 'месяц', 'месяца', 'месяцев')}, и ` : ''}спасибо за доверие и регулярные занятия${parent ? ` ${first}` : ''}.`,
    `С ${dayMonth(from)} стоимость занятия (${s.default_duration} минут) будет ${s.newPrice.toLocaleString('ru-RU')} ₽ вместо ${s.price.toLocaleString('ru-RU')} ₽.`,
    'Уже оплаченные абонементы действуют по прежней цене до конца.',
    '',
    'Если есть вопросы, напишите, обсудим.',
  ].join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Скопировано');
    } catch {
      toast('Выделите текст и скопируйте вручную', 'error');
    }
  };
  return (
    <Modal title={`Сообщение: ${s.full_name}`} onClose={onClose}>
      <textarea className="textarea" style={{ minHeight: 220 }} defaultValue={text} id={`price-msg-${s.id}`} />
      <p className="small muted">Дата повышения: не раньше чем через 3 недели ({dayKey(from)}). Текст можно поправить перед отправкой.</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
        <button className="btn" onClick={copy}>Скопировать</button>
      </div>
    </Modal>
  );
}
