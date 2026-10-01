// pages/Legal.jsx — просмотр документов и принятие при входе
import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { BRAND } from '../config';
import { useLoad, Spinner, ErrorBox, Icon, Link, useSubmit } from '../ui';
import { fullDate } from '../format';

export const LEGAL_LINKS = [
  { kind: 'offer', label: 'Оферта' },
  { kind: 'privacy', label: 'Политика обработки данных' },
];

// Текст документа: абзацы и нумерованные пункты сохраняются как есть
export function LegalText({ body }) {
  return (
    <div className="legal-text">
      {body.split(/\n{2,}/).map((block, i) => (
        <p key={i}>{block}</p>
      ))}
    </div>
  );
}

/* ---------- Отдельная страница документа (доступна без входа) ---------- */
export function LegalPage({ kind }) {
  const doc = useLoad(() => api.legalPublic(kind), [kind]);
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <Link to="/" className="btn btn-quiet btn-sm" style={{ marginLeft: -10 }}>
          <Icon name="back" /> {BRAND.name}
        </Link>
        {doc.loading && <Spinner />}
        {doc.error && <ErrorBox error={doc.error} onRetry={doc.reload} />}
        {doc.data && (
          <article className="panel" style={{ marginTop: 14 }}>
            <h1 className="page-title">{doc.data.title}</h1>
            <div className="muted small" style={{ margin: '8px 0 24px' }}>
              Редакция {doc.data.version} от {fullDate(doc.data.published_at)}
            </div>
            <LegalText body={doc.data.body} />
          </article>
        )}
      </div>
    </div>
  );
}

/* ---------- Принятие документов перед входом в кабинет ---------- */
export function AcceptDocuments({ docs, onDone }) {
  const { logout, user } = useAuth();
  const [open, setOpen] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const all = docs.every((d) => checked.has(d.id));

  const { busy, error, submit } = useSubmit(async () => {
    await api.legalAccept(docs.map((d) => d.id));
    onDone();
  });

  const toggle = (id) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };

  const labels = {
    offer: 'Принимаю условия оферты',
    privacy: 'Ознакомлен(а) с политикой обработки персональных данных',
    consent_adult: 'Даю согласие на обработку моих персональных данных',
    consent_parent: 'Как законный представитель даю согласие на обработку персональных данных ребёнка и моих',
  };

  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <div className="brand-name" style={{ fontSize: 22 }}>{BRAND.name}</div>
        <div className="brand-rule" />
        <h1 className="page-title" style={{ marginTop: 26 }}>
          {docs.some((d) => d.version > 1) ? 'Документы обновились' : 'Перед началом'}
        </h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>
          {user.full_name}, чтобы пользоваться кабинетом, ознакомьтесь с документами и подтвердите согласие.
        </p>

        <div className="panel">
          {docs.map((d) => (
            <div key={d.id} className="accept-row">
              <label className="check" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={checked.has(d.id)} onChange={() => toggle(d.id)} style={{ marginTop: 2 }} />
                <span>{labels[d.kind] || d.title}</span>
              </label>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(open === d.id ? null : d.id)}>
                {open === d.id ? 'Свернуть' : 'Читать'}
              </button>
              {open === d.id && (
                <div className="accept-doc">
                  <h3 className="section-title" style={{ marginBottom: 10 }}>{d.title}</h3>
                  <LegalText body={d.body} />
                </div>
              )}
            </div>
          ))}
          {error && <div className="alert" style={{ marginTop: 14 }}>{error}</div>}
          <button className="btn" style={{ width: '100%', height: 48, marginTop: 18 }} disabled={!all || busy} onClick={submit}>
            {busy ? 'Сохраняем…' : 'Подтвердить и продолжить'}
          </button>
        </div>
        <button className="btn btn-quiet btn-sm" style={{ marginTop: 14 }} onClick={logout}>Выйти</button>
      </div>
    </div>
  );
}
