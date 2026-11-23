import { Fragment, useId } from 'react';
import { parseInlineChoices, markInlineCorrect } from './inline-choice';
import './inline-choice.css';

export function InlineChoiceBlock({ n, block, value, onChange, result, audio }) {
  const { parts, choices, errors } = parseInlineChoices(block.text);
  const checked = Boolean(result);
  const choose = (i, v) => { if (!checked) onChange(choices.map((_, k) => k === i ? v : value?.[k] ?? null)); };
  return <div className="sheet-block inline-block">{audio}<div className="sheet-q"><span className="sheet-n">{n}</span><span>Выберите вариант в предложении</span></div>
    {errors.length ? <p className="small muted">Преподавателю нужно проверить варианты в этом блоке.</p> : <div className="inline-passage">{parts.map((part,i) => <Fragment key={i}>{part}{choices[i] && (() => {
      const c = choices[i], d = result?.find(x => x.k === i), chosen = value?.[i];
      return <span className="inline-answer"><span className={`inline-options${d ? d.ok ? ' ok' : ' bad' : ''}`} role="radiogroup" aria-label={`Выбор ${i + 1}`}>
        {c.options.map((option,k) => <button key={k} type="button" role="radio" aria-checked={chosen === k} disabled={checked} tabIndex={chosen === k || (chosen == null && k === 0) ? 0 : -1} className={`${chosen === k ? ' selected' : ''}${d && k === c.correct ? ' correct' : ''}`} onClick={() => choose(i,k)} onKeyDown={e => {
          if (checked || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
          e.preventDefault(); const next=e.key==='Home'?0:e.key==='End'?c.options.length-1:(k+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+c.options.length)%c.options.length;
          choose(i,next); e.currentTarget.parentElement.children[next].focus();
        }}>{option}{d && k === c.correct && <span aria-label="Правильный вариант"> ✓</span>}</button>)}
      </span>{d && !d.ok && <small className="inline-correction">Правильно: {d.expected}</small>}</span>;
    })()}</Fragment>)}</div>}
  </div>;
}

export function InlineChoiceEditor({ block, onChange }) {
  const parsed = parseInlineChoices(block.text);
  const id = useId();
  return <div className="inline-editor"><label>Предложения с вариантами<textarea className="textarea" rows={4} value={block.text} aria-label="Предложения с вариантами" placeholder={'She [work|*works] every day.\nI [*am|is] a teacher.'} onChange={e=>onChange({text:e.target.value})} /></label>
    <p className="small muted">Поместите варианты в скобки и разделите |. Правильный ответ выберите ниже или отметьте * перед ним. В одном тексте можно сделать несколько мест выбора.</p>
    {parsed.choices.map((c,i)=><fieldset key={i} className="inline-key"><legend>Правильный ответ · выбор {i+1}</legend><div className="row wrap">{c.options.map((option,k)=><label key={k}><input type="radio" name={`${id}-inline-answer-${i}`} checked={c.correct===k} onChange={()=>onChange({text:markInlineCorrect(block.text,i,k)})}/><span>{option || 'Пустой вариант'}</span></label>)}</div></fieldset>)}
    {parsed.errors.length > 0 && <div className="inline-validation" role="status">{parsed.errors.slice(0,4).map((error,i)=><p key={i}>{error}</p>)}</div>}
  </div>;
}
