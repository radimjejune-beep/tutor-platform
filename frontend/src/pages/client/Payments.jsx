// pages/client/Payments.jsx — абонементы и история оплат
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, PassMarks } from '../../ui';
import { rub, fullDate, shortDate, METHOD, lessonsWord } from '../../format';

export default function ClientPayments({ student }) {
  const fin = useLoad(() => api.finance(student.id), [student.id]);
  if (fin.loading) return <Spinner />;
  if (fin.error) return <ErrorBox error={fin.error} onRetry={fin.reload} />;
  const f = fin.data;
  const active = f.subscriptions.find((s) => s.status === 'active');

  return (
    <>
      <div className="page-head"><h1 className="page-title">Оплата</h1></div>
      <div className="grid grid-2">
        <section className="panel">
          <h2 className="section-title">{active ? active.title : 'Баланс'}</h2>
          {active ? (
            <>
              <div style={{ marginTop: 14 }}>
                <span className="big-number num">{active.lessons_remaining}</span>
                <span className="muted"> из {lessonsWord(active.lessons_total)} осталось</span>
              </div>
              <PassMarks total={active.lessons_total} remaining={active.lessons_remaining} />
              <div className="small muted">
                С {shortDate(active.starts_on)}{active.expires_on ? ` до ${shortDate(active.expires_on)}` : ''}, {rub(active.price_total)}
              </div>
            </>
          ) : (
            <div className="big-number num" style={{ marginTop: 14, color: f.balance < 0 ? 'var(--danger)' : undefined }}>
              {rub(Math.abs(f.balance))}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            {f.balance < 0 ? (
              <div className="alert">К оплате: {rub(-f.balance)}</div>
            ) : f.balance > 0 ? (
              <div className="muted">Предоплата на балансе: {rub(f.balance)}</div>
            ) : (
              <div className="muted">Все занятия оплачены</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2 className="section-title">История оплат</h2></div>
          {!f.payments.length && <Empty title="Оплат пока не было" />}
          <div className="list">
            {f.payments.map((p) => (
              <div key={p.id} className="list-item">
                <div className="list-main">
                  <div className="list-title num">{rub(p.amount)}</div>
                  <div className="list-sub">{fullDate(p.paid_on)}, {METHOD[p.method].toLowerCase()}</div>
                </div>
                {p.receipt_url && (
                  <a className="badge badge-green" href={p.receipt_url} target="_blank" rel="noreferrer">Чек</a>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {f.subscriptions.length > 1 && (
        <section className="panel" style={{ marginTop: 20 }}>
          <h2 className="section-title">Все абонементы</h2>
          <div className="list" style={{ marginTop: 8 }}>
            {f.subscriptions.filter((s) => s.status !== 'cancelled').map((s) => (
              <div key={s.id} className="list-item">
                <div className="list-main">
                  <div className="list-title">{s.title}</div>
                  <div className="list-sub">С {shortDate(s.starts_on)}, {rub(s.price_total)}</div>
                </div>
                <Badge tone={s.status === 'active' ? 'green' : ''}>{s.status === 'active' ? 'Действует' : 'Использован'}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
