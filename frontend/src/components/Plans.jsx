// components/Plans.jsx — тарифы платформы: таблица сравнения (главная и настройки) и вкладка «Тариф»
import { useState } from 'react';
import { api } from '../api';
import { useLoad, Spinner, ErrorBox, Badge, Icon, useToast } from '../ui';
import { fullDate, plural } from '../format';

const rub = (n) => `${Number(n).toLocaleString('ru-RU')} ₽`;
const limitText = (v, unit) => {
  if (v == null) return 'без ограничений';
  if (unit === 'МБ' && v >= 1024) return `до ${(v / 1024).toLocaleString('ru-RU')} ГБ`;
  return `до ${v.toLocaleString('ru-RU')}${unit ? ` ${unit}` : ''}`;
};

// Значение функции в тарифе: ✓, — или лимит
function cell(plan, f) {
  if (f.all) return <span className="plan-yes" aria-label="Есть">✓</span>;
  if (f.limit === true) return limitText(plan.limits[f.key], f.unit === 'МБ' ? 'МБ' : '');
  if (typeof f.limit === 'string') {
    if (!plan.features[f.key]) return <span className="plan-no" aria-label="Нет">—</span>;
    const v = plan.limits[f.limit];
    return v == null ? <span className="plan-yes" aria-label="Без ограничений">✓</span> : `${v} ${f.unit || ''}`.trim();
  }
  return plan.features[f.key] ? <span className="plan-yes" aria-label="Есть">✓</span> : <span className="plan-no" aria-label="Нет">—</span>;
}

export function PlanTable({ data, current, onPick, pickLabel = 'Выбрать' }) {
  const [period, setPeriod] = useState('month');
  return (
    <div className="plans">
      <div className="seg" style={{ marginBottom: 16 }}>
        <button type="button" className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>Помесячно</button>
        <button type="button" className={period === 'year' ? 'on' : ''} onClick={() => setPeriod('year')}>На год, два месяца в подарок</button>
      </div>
      <div className="plan-cards">
        {data.plans.map((p) => (
          <article key={p.id} className={`plan-card ${current === p.id ? 'current' : ''} ${p.id === 'tutor' ? 'accent' : ''}`}>
            <div className="row-between">
              <h3 className="plan-name">{p.name}</h3>
              {current === p.id ? <Badge tone="green">Ваш тариф</Badge> : p.id === 'tutor' ? <Badge>Выбор репетиторов</Badge> : null}
            </div>
            <div className="plan-price">
              {p.price ? (period === 'year' ? <>{rub(p.year)}<small> в год</small></> : <>{rub(p.price)}<small> в месяц</small></>) : <>0 ₽<small> навсегда</small></>}
            </div>
            <p className="small muted plan-tag">{p.tagline}</p>
            <ul className="plan-list">
              {data.features.map((f) => (
                <li key={f.key}><span>{f.label}</span><b>{cell(p, f)}</b></li>
              ))}
            </ul>
            {onPick && p.price > 0 && current !== p.id && (
              <button type="button" className={`btn ${p.id === 'tutor' ? '' : 'btn-secondary'}`} onClick={() => onPick(p, period)}>{pickLabel}</button>
            )}
          </article>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {data.trial_days} {plural(data.trial_days, 'день', 'дня', 'дней')} всё бесплатно: у нового преподавателя сразу открыты все возможности «Про». Потом можно остаться на «Старте» бесплатно.
      </p>
    </div>
  );
}

const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

export function PlanTab() {
  const toast = useToast();
  const data = useLoad(() => api.myPlan(), []);
  const [sent, setSent] = useState(null);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const d = data.data;
  const c = d.current;
  const days = c.until ? Math.max(0, Math.ceil((new Date(c.until) - Date.now()) / 864e5)) : null;

  const request = async (p, period) => {
    try {
      await api.requestPlan(p.id, period);
      setSent(p.name);
      toast('Заявка отправлена');
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const bars = [
    ['Ученики', d.usage.students, c.limits.students, ''],
    ['Учебники', d.usage.books_mb, c.limits.books_mb, 'МБ'],
    ['Задания из банка в этом месяце', d.usage.bank_takes, c.limits.bank_takes, ''],
  ];

  return (
    <>
      <section className="panel plan-now">
        <div>
          <div className="meta-label">Сейчас</div>
          <h2 className="section-title" style={{ marginTop: 4 }}>{c.name}</h2>
          <div className="small muted">
            {c.admin ? 'Сисадмину всё доступно без ограничений.'
              : c.trial ? `Пробный период: все возможности «Про» ещё ${days} ${plural(days, 'день', 'дня', 'дней')} (до ${fullDate(c.until)}), потом останется «Старт», если не выбрать тариф.`
                : c.until ? `Оплачен до ${fullDate(c.until)}`
                  : c.expired ? 'Срок тарифа закончился, сейчас действует «Старт». Ученики и материалы сохранены.'
                    : c.id === 'start' ? 'Бесплатный тариф.' : 'Бессрочно.'}
          </div>
        </div>
        <div className="plan-usage">
          {bars.map(([label, used, max, unit]) => (
            <div key={label}>
              <div className="row-between small"><span>{label}</span><span className="muted">{used}{unit ? ` ${unit}` : ''} из {max == null ? '∞' : `${max}${unit ? ` ${unit}` : ''}`}</span></div>
              <div className="bar"><i style={{ width: `${max == null ? 4 : pct(used, max)}%` }} className={max != null && used >= max ? 'full' : ''} /></div>
            </div>
          ))}
        </div>
      </section>
      {sent && (
        <section className="panel note-ok">
          <Icon name="check" /> Заявка на тариф «{sent}» отправлена. Мы подключим его и напишем вам. Оплата прямо на платформе появится в ближайшее время.
        </section>
      )}
      {!c.admin && <section className="panel"><PlanTable data={d} current={c.trial ? null : c.id} onPick={request} pickLabel="Хочу этот тариф" /></section>}
    </>
  );
}
