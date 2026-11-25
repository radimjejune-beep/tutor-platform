import { useEffect, useId, useRef, useState } from 'react';
import { MathText } from '../components/MathText';
import { writeChecks } from './logic';
import { insertWritingStarter, writingMetrics, WRITING_REVIEW } from './writing.js';
import './writing.css';

export default function WritingStudio({ n, blk, value, onChange, checked, audio, notes = {}, onNotesChange }) {
  const [stage, setStage] = useState(checked ? 'review' : value ? 'write' : 'plan');
  const [showModel, setShowModel] = useState(false);
  const [large, setLarge] = useState(false);
  const area = useRef(null), stagePanel = useRef(null), studio = useRef(null), id = useId();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!studio.current || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(entries => setCompact(entries[0].contentRect.width < 680));
    observer.observe(studio.current); return () => observer.disconnect();
  }, []);
  const list = writeChecks(blk, value), done = list.filter(c => c.ok).length;
  const metrics = writingMetrics(value, blk);
  const maxChars = blk.t === 'open' ? 5000 : 8000;
  const changeStage = next => { setStage(next); requestAnimationFrame(() => (next === 'write' ? area.current : stagePanel.current)?.focus({ preventScroll: true })); };
  const updatePlan = (key, text) => onNotesChange?.({ ...notes, plan: { ...(notes.plan || {}), [key]: text } });
  const addStarter = st => {
    const el = area.current;
    const next = insertWritingStarter(value, el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length, st);
    onChange(next.text);
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(next.caret, next.caret); });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'Lessonfold-writing.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div ref={studio} className={`sheet-block writing-studio${large ? ' writing-large' : ''}`}>
    {audio}
    <div className="writing-heading"><div><div className="meta-label">{n}. Письменная практика</div><h4>От мысли к тексту</h4></div><span className="writing-target">{metrics.target}</span></div>
    <nav className="writing-stages" aria-label="Этапы письменной работы">{[['plan','План'],['write','Текст'],['review','Самопроверка']].map(([key,label],i) => <button key={key} type="button" aria-pressed={stage === key} onClick={() => changeStage(key)}><span aria-hidden="true">{i + 1}</span>{label}</button>)}</nav>
    <div className="writing-layout">
      <div className="writing-work" ref={stagePanel} tabIndex={-1}>
        {stage === 'plan' && <div className="writing-plan">
          <h5>Сначала соберите мысли</h5><p className="small muted">План не входит в текст ответа. Пишите коротко, можно на русском. Этот шаг можно пропустить.</p>
          {[['ideas','Что я хочу сказать','Ключевые мысли и ответы на вопросы задания'],['outline','В каком порядке','Начало → основная мысль → пример → завершение'],['vocabulary','Какие слова пригодятся','Слова, выражения, полезные связки']].map(([key,label,placeholder]) => <label className="writing-plan-field" key={key}>{label}<textarea className="textarea" aria-label={label} value={notes.plan?.[key] || ''} maxLength={1500} readOnly={checked} placeholder={placeholder} onChange={e => updatePlan(key, e.target.value)} /></label>)}
          <button type="button" className="btn" onClick={() => changeStage('write')}>{value ? 'Вернуться к тексту' : 'Перейти к тексту'}</button>
        </div>}
        {stage === 'write' && <div className="writing-pad">
          <div className="writing-pad-toolbar"><label htmlFor={`${id}-answer`}>Ваш текст</label><button type="button" className="btn btn-quiet btn-sm" aria-pressed={large} onClick={() => setLarge(v => !v)}>{large ? 'Обычный размер' : 'Больше места'}</button></div>
          <textarea id={`${id}-answer`} ref={area} className="textarea writing-area" value={value} readOnly={checked} maxLength={maxChars} placeholder="Start with one idea…" spellCheck="false" onChange={e => onChange(e.target.value)} aria-describedby={`${id}-count ${id}-limit`} />
          <div className="writing-counter" id={`${id}-count`}><b>{metrics.count} слов</b><span>{metrics.paragraphs} абз.</span></div>
          <p id={`${id}-limit`} className={`writing-volume${metrics.excess ? ' over' : ''}`}>{metrics.message}{value.length > maxChars * .9 && ` Лимит: ${maxChars} знаков.`}</p>
          {!checked && blk.starters?.length > 0 && <details className="writing-support"><summary>Опорные фразы преподавателя</summary><p className="small muted">Выберите фразу — она появится в месте курсора.</p><div className="writing-starters">{blk.starters.map((st,k) => <button key={k} type="button" className="chip-btn" aria-label={`Вставить: ${st}`} disabled={value.length + st.length + 2 > maxChars} onClick={() => addStarter(st)}>{st}</button>)}</div></details>}
          <button type="button" className="btn btn-secondary" onClick={() => changeStage('review')}>Перейти к самопроверке</button>
        </div>}
        {stage === 'review' && <div className="writing-review">
          <h5>{checked ? 'Отправленный текст' : 'Перечитайте перед сдачей'}</h5>
          <div className="writing-readback" tabIndex={0} aria-label="Текст для самопроверки">{value || 'Вы пока не написали ответ. Вернитесь к тексту, чтобы начать.'}</div>
          <div className="writing-counter"><b>{metrics.count} слов</b><span>{metrics.paragraphs} абз.</span></div>
          <fieldset className="writing-selfcheck"><legend>Моя самопроверка</legend>{WRITING_REVIEW.map((label,k) => <label key={k}><input type="checkbox" checked={Boolean(notes.review?.[k])} disabled={checked} onChange={e => onNotesChange?.({ ...notes, review: { ...(notes.review || {}), [k]: e.target.checked } })}/><span>{label}</span></label>)}</fieldset>
          <p className="small muted">Это напоминания для вас. Галочки не повышают оценку. Сдача работы — кнопкой под всем упражнением.</p>
          <div className="row wrap"><button type="button" className="btn btn-secondary" onClick={() => changeStage('write')}>{checked ? 'Посмотреть текст' : 'Доработать текст'}</button><button type="button" className="btn btn-quiet" disabled={!value.trim()} onClick={download}>Скачать текст</button></div>
        </div>}
      </div>
      <aside className="writing-brief" aria-label="Условие и требования к тексту">
        <details className="writing-task" open={!compact || stage === 'plan'}><summary>Задание</summary><MathText as="div">{blk.q || 'Напишите текст по заданию преподавателя.'}</MathText></details>
        {list.length > 0 && <details className="writing-auto" open={stage === 'review'}><summary>Проверка требований · {done}/{list.length}</summary><p className="small muted">Автоматически проверяются объём и формальные признаки. Употребление слова не доказывает правильность грамматики.</p><ul>{list.map(c => <li key={c.key} className={c.ok ? 'ok' : ''}><span aria-label={c.ok ? 'Выполнено' : 'Проверьте'}>{c.ok ? '✓' : '○'}</span><div>{c.label}{c.info && <small>{c.info}</small>}</div></li>)}</ul></details>}
        <p className="writing-manual">Содержание, логику и грамматику оценивает преподаватель.</p>
        {checked && blk.model && <details className="writing-model" open={showModel} onToggle={e => setShowModel(e.currentTarget.open)}><summary>Пример ответа преподавателя</summary><MathText as="div" className="write-model">{blk.model}</MathText></details>}
      </aside>
    </div>
  </div>;
}
