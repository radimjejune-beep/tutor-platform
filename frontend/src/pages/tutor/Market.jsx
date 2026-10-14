// pages/tutor/Market.jsx — каталог уроков между репетиторами
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Badge, Link, navigate, Modal, Field, useSubmit, useToast } from '../../ui';
import { rub, relativeDay } from '../../format';

const KIND = { html: 'Интерактивный урок', game: 'Упражнение', task: 'Задача', theory: 'Теория' };

function MarketTabs({ active }) {
  return (
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'active' : ''} onClick={() => navigate('/market')}>Каталог</button>
      <button role="tab" aria-selected={active === 'mine'} className={active === 'mine' ? 'active' : ''} onClick={() => navigate('/market/mine')}>Мои публикации</button>
    </div>
  );
}

export function MarketPage({ tab }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Каталог уроков</h1>
          <div className="lead">Интерактивные уроки и упражнения других репетиторов. Бесплатные копируются сразу, платные после оплаты автору.</div>
        </div>
      </div>
      <MarketTabs active={tab} />
      {tab === 'mine' ? <Mine /> : <Catalog />}
    </>
  );
}

function Catalog() {
  const toast = useToast();
  const list = useLoad(() => api.market(), []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  const shown = list.data.filter((m) => `${m.title} ${m.description || ''} ${m.level || ''} ${m.author_name}`.toLowerCase().includes(q.trim().toLowerCase()));

  const get = async (m) => {
    setBusy(m.id);
    try {
      const r = await api.getMarketItem(m.id);
      if (r.status === 'granted') {
        toast('Урок добавлен в вашу библиотеку');
        navigate(`/library/${r.item_id}`);
        return;
      }
      toast('Заявка отправлена автору. Он свяжется с вами по поводу оплаты');
      list.reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <input className="input" style={{ maxWidth: 360, marginBottom: 16 }} placeholder="Поиск: Present Perfect, A2, Solutions…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по каталогу" />
      {!shown.length && (
        <div className="panel"><Empty title={q ? 'Ничего не нашлось' : 'Каталог пока пуст'}>
          Опубликуйте свой урок: откройте его в библиотеке и нажмите «В каталог».
        </Empty></div>
      )}
      <div className="market-grid">
        {shown.map((m) => (
          <article key={m.id} className="market-card">
            <span className="meta-label">{m.kind_label}{m.level ? ` · ${m.level}` : ''}</span>
            <h3 className="lib-title">{m.title}</h3>
            {m.description && <p className="small" style={{ margin: 0 }}>{m.description}</p>}
            <div className="small muted">{m.author_name}{m.copies ? ` · взяли ${m.copies}` : ''}</div>
            <div className="market-foot">
              <span className="serif market-price">{m.price ? rub(m.price) : 'Бесплатно'}</span>
              {m.mine ? <Badge>ваш</Badge>
                : m.my_order === 'granted' ? <Link to={`/library/${m.copied_item_id}`} className="btn btn-secondary btn-sm">В библиотеке</Link>
                : m.my_order === 'requested' ? <Badge tone="brass">ждём автора</Badge>
                : <button className="btn btn-sm" disabled={busy === m.id} onClick={() => get(m)}>{m.price ? 'Купить' : 'Взять себе'}</button>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Mine() {
  const toast = useToast();
  const data = useLoad(() => api.marketMine(), []);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  const { items, orders } = data.data;
  const act = (fn, msg) => async () => {
    try {
      await fn();
      toast(msg);
      data.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const waiting = orders.filter((o) => o.status === 'requested');

  return (
    <div className="grid grid-main">
      <section className="panel">
        <h2 className="section-title" style={{ marginBottom: 12 }}>Заявки на покупку</h2>
        {!orders.length && <p className="muted small" style={{ margin: 0 }}>Пока нет. Когда кто-то нажмёт «Купить», заявка появится здесь и придёт уведомление.</p>}
        {waiting.length > 0 && (
          <div className="note" style={{ marginBottom: 12 }}>
            Договоритесь с покупателем об оплате (например, перевод), пробейте чек в «Мой налог» и нажмите «Выдать доступ»: урок скопируется ему в библиотеку.
          </div>
        )}
        <div className="list">
          {orders.map((o) => (
            <div key={o.id} className="list-item">
              <div className="list-main">
                <div className="list-title">{o.title} · {rub(o.price)}</div>
                <div className="list-sub">{o.buyer_name}, логин {o.buyer_login} · {relativeDay(o.created_at)}</div>
              </div>
              {o.status === 'requested' ? (
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-quiet btn-sm" onClick={act(() => api.declineOrder(o.id), 'Отклонено')}>Отказать</button>
                  <button className="btn btn-sm" onClick={act(() => api.grantOrder(o.id), 'Доступ выдан')}>Выдать доступ</button>
                </div>
              ) : <Badge tone={o.status === 'granted' ? 'green' : 'red'}>{o.status === 'granted' ? 'выдано' : 'отказ'}</Badge>}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="section-title" style={{ marginBottom: 12 }}>Опубликовано</h2>
        {!items.length && <p className="muted small" style={{ margin: 0 }}>Откройте урок в библиотеке и нажмите «В каталог».</p>}
        <div className="list">
          {items.map((m) => (
            <div key={m.id} className="list-item">
              <div className="list-main">
                <Link to={`/library/${m.item_id}`} className="list-title" style={{ color: 'var(--ink)' }}>{m.title}</Link>
                <div className="list-sub">{KIND[m.kind]} · {m.price ? rub(m.price) : 'бесплатно'}{m.published ? '' : ' · снято с публикации'}</div>
              </div>
              {m.published && <button className="btn btn-quiet btn-sm" onClick={act(() => api.unpublishItem(m.id), 'Снято с публикации')}>Снять</button>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Кнопка в редакторе материала: опубликовать в каталоге
export function PublishButton({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>В каталог</button>
      {open && <PublishModal item={item} onClose={() => setOpen(false)} />}
    </>
  );
}

function PublishModal({ item, onClose }) {
  const toast = useToast();
  const [f, setF] = useState({ title: item.title, description: item.body || '', level: '', price: 0 });
  const save = useSubmit(async () => {
    await api.publishItem({ item_id: item.id, title: f.title.trim(), description: f.description.trim() || undefined, level: f.level.trim() || undefined, price: Number(f.price) || 0 });
    toast('Опубликовано в каталоге');
    onClose();
  });
  return (
    <Modal title="Опубликовать в каталоге" onClose={onClose}>
      <form className="form" onSubmit={save.submit}>
        <Field label="Название"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
        <Field label="Описание" hint="Для кого, сколько минут, что внутри">
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Уровень"><input className="input" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="A1, 3 класс" /></Field>
          <Field label="Цена, ₽" hint="0, если бесплатно"><input className="input" type="number" min={0} step={50} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Публикуйте только свои материалы. Тексты и картинки из учебников без разрешения издательства продавать нельзя.
        </p>
        {save.error && <div className="alert">{save.error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn" disabled={save.busy}>Опубликовать</button>
        </div>
      </form>
    </Modal>
  );
}
