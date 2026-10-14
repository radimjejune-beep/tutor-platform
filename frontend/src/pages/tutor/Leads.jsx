// pages/tutor/Leads.jsx — заявки со страницы записи
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Icon, Link, navigate, useToast } from '../../ui';
import { PeopleTabs } from './Groups';
import { CATEGORY, relativeDay, time } from '../../format';

const STATUS = { new: ['Новая', 'brass'], contacted: ['Связались', ''], student: ['Ученик', 'green'], rejected: ['Отказ', 'red'] };

export default function Leads() {
  const toast = useToast();
  const list = useLoad(() => Promise.all([api.leads(), api.profile()]), []);

  const act = (fn, msg) => async () => {
    try {
      const r = await fn();
      if (r?.student_id) {
        toast('Карточка ученика создана');
        navigate(`/students/${r.student_id}/access`);
        return;
      }
      if (msg) toast(msg);
      list.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const [leads, profile] = list.data;
  const link = `${window.location.origin}${window.location.pathname}#/join/${profile.login}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Заявки</h1>
          <div className="lead">С вашей страницы записи: контакты новых учеников и результат теста, если он был.</div>
        </div>
        <Link to="/settings/page" className="btn btn-secondary"><Icon name="settings" /> Страница записи</Link>
      </div>
      <PeopleTabs active="leads" />

      {!profile.enabled && (
        <div className="note" style={{ marginBottom: 20 }}>
          Страница записи выключена. Включите её в <Link to="/settings/page">настройках</Link>, и ссылку можно будет отправлять в соцсети и объявления.
        </div>
      )}
      {profile.enabled && (
        <div className="share-link">
          <span className="meta-label">Ваша ссылка для новых учеников</span>
          <div className="row" style={{ gap: 8 }}>
            <code className="truncate" style={{ flex: 1, minWidth: 0 }}>{link}</code>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); } catch { toast('Выделите ссылку и скопируйте вручную', 'error'); }
            }}>Скопировать</button>
          </div>
        </div>
      )}

      <section className="panel">
        {!leads.length && <Empty title="Заявок пока нет">Когда кто-то оставит заявку, она появится здесь, и придёт уведомление.</Empty>}
        <div className="list">
          {leads.map((l) => (
            <div key={l.id} className="lead-row">
              <div className="lead-level serif">{l.level || '—'}</div>
              <div className="list-main">
                <div className="list-title">{l.full_name} <Badge tone={STATUS[l.status][1]}>{STATUS[l.status][0]}</Badge></div>
                <div className="list-sub">
                  {[CATEGORY[l.age_group], l.contact, l.test_total && `тест ${l.test_score}/${l.test_total}`].filter(Boolean).join(' · ')}
                </div>
                {(l.goal || l.preferred_time) && <div className="small" style={{ marginTop: 4 }}>{[l.goal, l.preferred_time && `Время: ${l.preferred_time}`].filter(Boolean).join('. ')}</div>}
                <div className="small muted">{relativeDay(l.created_at)}, {time(l.created_at)}</div>
              </div>
              <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                {l.status === 'student' ? (
                  <Link to={`/students/${l.student_id}`} className="btn btn-secondary btn-sm">Карточка</Link>
                ) : (
                  <>
                    {l.status === 'new' && <button className="btn btn-quiet btn-sm" onClick={act(() => api.updateLead(l.id, 'contacted'), 'Отмечено')}>Связались</button>}
                    <button className="btn btn-quiet btn-sm" onClick={act(() => api.updateLead(l.id, 'rejected'), 'Отмечено')}>Отказ</button>
                    <button className="btn btn-sm" onClick={act(() => api.convertLead(l.id))}>Сделать учеником</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
