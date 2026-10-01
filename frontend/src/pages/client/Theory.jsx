// pages/client/Theory.jsx — теория для учеников и родителей
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Empty, Icon, Link, navigate } from '../../ui';
import LibraryItem, { examLabel } from '../../components/LibraryItem';

export function TheoryList() {
  const facets = useLoad(() => api.libraryFacets(), []);
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const list = useLoad(() => api.library({ subject, q }), [subject, q]);

  return (
    <>
      <div className="page-head"><h1 className="page-title">Теория</h1></div>
      <div className="lib-filters">
        <input className="input" placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        {facets.data?.subjects.length > 1 && (
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Предмет">
            <option value="">Все предметы</option>
            {facets.data.subjects.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </div>
      <section className="panel">
        {list.loading && <Spinner />}
        {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
        {list.data && !list.data.length && <Empty title={q ? 'Ничего не нашлось' : 'Материалов пока нет'} />}
        {(list.data || []).map((i) => (
          <div key={i.id} className="assign-row" onClick={() => navigate(`/theory/${i.id}`)}>
            <div className="assign-icon"><Icon name="library" /></div>
            <div className="list-main">
              <div className="list-title truncate">{i.title}</div>
              <div className="list-sub truncate">{[examLabel(i), i.subject].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

export function TheoryView({ id }) {
  const item = useLoad(() => api.libraryItem(id), [id]);
  return (
    <>
      <Link to="/theory" className="btn btn-quiet btn-sm" style={{ marginLeft: -10, marginBottom: 10 }}><Icon name="back" /> Теория</Link>
      {item.loading && <Spinner />}
      {item.error && <ErrorBox error={item.error} onRetry={item.reload} />}
      {item.data && <div style={{ maxWidth: 820 }}><LibraryItem item={item.data} /></div>}
    </>
  );
}
