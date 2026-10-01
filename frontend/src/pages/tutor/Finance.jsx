// pages/tutor/Finance.jsx — доход по месяцам и доход за час
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox } from '../../ui';
import { rub, monthName, plural } from '../../format';

// Последние 6 месяцев, от старого к новому: ['2026-05', ..., '2026-10']
function lastMonths(n = 6) {
  const out = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export default function Finance() {
  const months = lastMonths();
  const [selected, setSelected] = useState(months[months.length - 1]);
  const data = useLoad(() => Promise.all(months.map((m) => api.summary(m))), []);

  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;

  const rows = data.data;
  const s = rows.find((r) => r.month === selected) || rows[rows.length - 1];
  const max = Math.max(1, ...rows.map((r) => r.income));
  const hours = Math.round((s.minutes_taught / 60) * 10) / 10;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Доход</h1>
          <div className="lead">Поступления по дате оплаты, часы — по проведённым занятиям</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2 className="section-title">Полгода</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, gap: 12, alignItems: 'end', height: 210 }}>
          {rows.map((r) => {
            const active = r.month === s.month;
            return (
              <button key={r.month} onClick={() => setSelected(r.month)} aria-pressed={active}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
                  gap: 8, background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
                <span className="small num" style={{ color: active ? 'var(--ink)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}>
                  {r.income ? `${Math.round(r.income / 1000)} тыс` : ''}
                </span>
                <span style={{
                  width: '100%', maxWidth: 64, height: `${Math.max(3, (r.income / max) * 140)}px`, borderRadius: '10px 10px 4px 4px',
                  background: active ? 'linear-gradient(180deg, #2f8a73, var(--green))' : 'var(--green-soft)',
                  transition: 'background .15s',
                }} />
                <span className="small" style={{ color: active ? 'var(--ink)' : 'var(--muted)' }}>
                  {monthName(r.month).split(' ')[0].slice(0, 3).toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <h2 className="serif" style={{ fontSize: 24, margin: '30px 0 14px' }}>{monthName(s.month)}</h2>
      <div className="grid grid-3">
        <div className="panel">
          <div className="stat-label">Поступило</div>
          <div className="stat-value num">{rub(s.income)}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Проведено</div>
          <div className="stat-value num">{hours} ч</div>
          <div className="stat-note">{s.lessons_done} {plural(s.lessons_done, 'занятие', 'занятия', 'занятий')}</div>
        </div>
        <div className="panel">
          <div className="stat-label">Доход за час</div>
          <div className="stat-value num">{s.income_per_hour ? rub(s.income_per_hour) : '—'}</div>
          <div className="stat-note">Главный показатель для повышения цены</div>
        </div>
      </div>
      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <div className="panel">
          <div className="stat-label">Отмены и пропуски</div>
          <div className="stat-value num">{s.lessons_cancelled}</div>
          <div className="stat-note">Поздние отмены и неявки списываются, если так указать при отметке</div>
        </div>
        <div className="panel">
          <div className="stat-label">Оплаты без чека</div>
          <div className="stat-value num" style={{ color: s.payments_without_receipt ? 'var(--brass)' : undefined }}>{s.payments_without_receipt}</div>
          <div className="stat-note">Чек в «Мой налог» нужно пробить по каждой оплате</div>
        </div>
      </div>
    </>
  );
}
