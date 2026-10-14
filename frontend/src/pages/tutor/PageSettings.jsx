// pages/tutor/PageSettings.jsx — настройки страницы записи и лиги учеников
import { useState } from 'react';
import { api } from '../../api';
import { useLoad, Spinner, ErrorBox, Field, useSubmit, useToast } from '../../ui';

export default function PageSettings() {
  const data = useLoad(() => api.profile(), []);
  if (data.loading) return <Spinner />;
  if (data.error) return <ErrorBox error={data.error} onRetry={data.reload} />;
  return <Form p={data.data} />;
}

function Form({ p }) {
  const toast = useToast();
  const [f, setF] = useState({ enabled: p.enabled, about: p.about, price_text: p.price_text, subjects: p.subjects, league_enabled: p.league_enabled });
  const link = `${window.location.origin}${window.location.pathname}#/join/${p.login}`;
  const save = useSubmit(async () => {
    await api.saveProfile(f);
    toast('Сохранено');
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid grid-main" onSubmit={save.submit}>
      <section className="panel form">
        <h2 className="section-title">Страница записи</h2>
        <label className="check">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          <span>Включить страницу: новые ученики оставляют заявку (для английского ещё и проходят тест уровня)</span>
        </label>
        <Field label="Предметы"><input className="input" value={f.subjects} onChange={set('subjects')} placeholder="Математика, ОГЭ, ЕГЭ" /></Field>
        <Field label="О себе" hint="Опыт, подход, кому подойдёт. Видят все, у кого есть ссылка">
          <textarea className="textarea" style={{ minHeight: 140 }} value={f.about} onChange={set('about')}
            placeholder="Преподаю английский 5 лет. Готовлю к ОГЭ и ЕГЭ, занимаюсь с детьми с 8 лет. Уроки онлайн, в игровом формате для младших." />
        </Field>
        <Field label="Цена" hint="Как показать стоимость"><input className="input" value={f.price_text} onChange={set('price_text')} placeholder="Занятие 60 минут: от 1500 ₽. Пробное бесплатно" /></Field>
        {f.enabled && (
          <div className="share-link">
            <span className="meta-label">Ссылка</span>
            <code style={{ wordBreak: 'break-all' }}>{link}</code>
          </div>
        )}
        {save.error && <div className="alert">{save.error}</div>}
        <div><button className="btn" disabled={save.busy}>Сохранить</button></div>
      </section>

      <section className="panel form">
        <h2 className="section-title">Мотивация учеников</h2>
        <label className="check" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={f.league_enabled} onChange={(e) => setF({ ...f, league_enabled: e.target.checked })} style={{ marginTop: 3 }} />
          <span>Лига недели: ученики видят рейтинг по очкам среди ваших учеников (имя и первая буква фамилии)</span>
        </label>
        <p className="small muted" style={{ margin: 0 }}>
          Очки и серия дней подряд работают всегда. Разминка перед уроком открывается ученику за час до занятия, вы видите её итог на главной.
        </p>
      </section>
    </form>
  );
}
