// pages/Join.jsx — открытая страница записи к репетитору: о себе, тест уровня, заявка
import { useState } from 'react';
import { api } from '../api';
import { BRAND } from '../config';
import { useLoad, Spinner, Field, Link, useSubmit } from '../ui';

export default function Join({ login }) {
  const page = useLoad(() => api.publicTutor(login), [login]);
  const [step, setStep] = useState('intro'); // intro → test → form → done
  const [answers, setAnswers] = useState({});
  const [q, setQ] = useState(0);
  const [f, setF] = useState({ full_name: '', contact: '', age_group: 'adult', goal: '', preferred_time: '', consent: false });
  const [result, setResult] = useState(null);

  const send = useSubmit(async () => {
    const r = await api.sendLead(login, { ...f, goal: f.goal.trim() || undefined, preferred_time: f.preferred_time.trim() || undefined, answers });
    setResult(r);
    setStep('done');
  });

  if (page.loading) return <div className="join"><Spinner /></div>;
  if (page.error) {
    return (
      <div className="join">
        <div className="join-wrap">
          <h1 className="page-title">Страница не найдена</h1>
          <p className="muted">Проверьте ссылку или напишите преподавателю напрямую.</p>
        </div>
      </div>
    );
  }
  const t = page.data;
  const test = t.test;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="join">
      <div className="join-wrap">
        <div className="join-brand">{BRAND.name}</div>

        {step === 'intro' && (
          <>
            <div className="meta-label">{t.subjects}</div>
            <h1 className="join-title">{t.full_name}</h1>
            {t.about && <p className="join-about">{t.about}</p>}
            {t.price_text && <p className="join-price">{t.price_text}</p>}
            {test?.length ? (
              <>
                <div className="join-steps">
                  <div><b>1</b><span>Тест уровня, {test.length} вопросов, 5–7 минут. Можно пропустить</span></div>
                  <div><b>2</b><span>Имя и контакт, чтобы договориться о пробном занятии</span></div>
                </div>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button className="btn" style={{ height: 48 }} onClick={() => setStep('test')}>Пройти тест уровня</button>
                  <button className="btn btn-secondary" style={{ height: 48 }} onClick={() => setStep('form')}>Сразу оставить заявку</button>
                </div>
              </>
            ) : (
              <button className="btn" style={{ height: 48, marginTop: 8 }} onClick={() => setStep('form')}>Записаться на пробное занятие</button>
            )}
          </>
        )}

        {step === 'test' && (
          <div className="join-test">
            <div className="row-between">
              <span className="meta-label">Вопрос {q + 1} из {test.length}</span>
              <button className="btn btn-quiet btn-sm" onClick={() => setStep('form')}>Пропустить тест</button>
            </div>
            <div className="bar" style={{ margin: '10px 0 28px' }}><span style={{ width: `${(q / test.length) * 100}%` }} /></div>
            <div className="join-q serif">{test[q].q.replace('___', '_____')}</div>
            <div className="practice-opts">
              {test[q].options.map((o, i) => (
                <button key={o} className={`practice-opt ${answers[test[q].id] === i ? 'chosen' : ''}`}
                  onClick={() => {
                    setAnswers({ ...answers, [test[q].id]: i });
                    if (q + 1 < test.length) setQ(q + 1);
                    else setStep('form');
                  }}>{o}</button>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 18 }}>Не знаете ответ? Выберите вариант наугад, тест учтёт это.</p>
            {q > 0 && <button className="btn btn-quiet btn-sm" onClick={() => setQ(q - 1)}>Назад</button>}
          </div>
        )}

        {step === 'form' && (
          <form className="form join-form" onSubmit={send.submit}>
            <h2 className="join-sub serif">Заявка на пробное занятие</h2>
            {Object.keys(answers).length > 0 && <p className="small muted" style={{ margin: 0 }}>Тест пройден: ответов {Object.keys(answers).length} из {test.length}. Результат увидите после отправки.</p>}
            <Field label="Как вас зовут"><input className="input" value={f.full_name} onChange={set('full_name')} autoComplete="name" required /></Field>
            <Field label="Телефон или Telegram"><input className="input" value={f.contact} onChange={set('contact')} placeholder="+7 900 000-00-00 или @username" required /></Field>
            <Field label="Кто будет заниматься">
              <div className="seg">
                {[['adult', 'Взрослый'], ['teen', 'Подросток'], ['child', 'Ребёнок']].map(([k, l]) => (
                  <button type="button" key={k} className={f.age_group === k ? 'on' : ''} onClick={() => setF({ ...f, age_group: k })}>{l}</button>
                ))}
              </div>
            </Field>
            <Field label="Цель" hint="Необязательно"><textarea className="textarea" style={{ minHeight: 70 }} value={f.goal} onChange={set('goal')} placeholder="ОГЭ, разговорный, школьная программа…" /></Field>
            <Field label="Удобное время" hint="Необязательно"><input className="input" value={f.preferred_time} onChange={set('preferred_time')} placeholder="Будни после 17:00" /></Field>
            <label className="check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required style={{ marginTop: 3 }} />
              <span className="small">
                Согласен(на) на обработку персональных данных для связи по поводу занятий
                {' '}(<Link to={`/legal/privacy?t=${t.login}`}>политика</Link>)
              </span>
            </label>
            {send.error && <div className="alert">{send.error}</div>}
            <button className="btn" style={{ height: 48 }} disabled={send.busy || !f.consent}>{send.busy ? 'Отправляем…' : 'Отправить заявку'}</button>
          </form>
        )}

        {step === 'done' && (
          <div className="join-done">
            {result?.level && (
              <>
                <div className="meta-label">Ваш уровень по тесту</div>
                <div className="join-level serif">{result.level}</div>
                <p className="muted">Верных ответов: {result.score} из {result.total}. На пробном занятии уровень уточним.</p>
              </>
            )}
            <h2 className="join-sub serif">Заявка отправлена</h2>
            <p>{t.full_name.split(' ')[0]} свяжется с вами, чтобы договориться о пробном занятии.</p>
          </div>
        )}
      </div>
    </div>
  );
}
