import { Fragment, useId } from 'react';
import { parseInlineChoices } from './inline-choice';
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
  const parsed=parseInlineChoices(block.text),id=useId();
  // Keep spaces while typing multiword alternatives; grading still trims the canonical values.
  const choices=parsed.choices.map(c=>({...c,options:c.raw.slice(1,-1).split('|').map(value=>value.replace(/^(\s*)\*/,'$1'))}));
  const write=(parts,choices)=>onChange({text:parts.map((part,i)=>part+(choices[i]?'['+choices[i].options.map((value,j)=>(j===choices[i].correct?'*':'')+value).join('|')+']':'')).join('')});
  const part=(index,value)=>write(parsed.parts.map((p,i)=>i===index?value:p),choices);
  const choice=(index,patch)=>write(parsed.parts,choices.map((c,i)=>i===index?{...c,...patch}:c));
  const remove=index=>{const parts=[...parsed.parts];parts[index]+=parts[index+1];parts.splice(index+1,1);write(parts,choices.filter((_,i)=>i!==index));};
  const add=()=>write([...parsed.parts,''],[...choices,{options:['вариант 1','вариант 2'],correct:0}]);
  return <div className="inline-editor inline-visual-editor">
    <p className="small muted">Напишите текст, добавьте варианты и отметьте правильный ответ. В одном предложении можно сделать несколько мест выбора.</p>
    {choices.map((c,i)=><div className="inline-author-slot" key={i}>
      <label className="field">Текст перед выбором {i+1}<textarea className="textarea" rows={2} aria-label={`Текст перед выбором ${i+1}`} value={parsed.parts[i]} onChange={e=>part(i,e.target.value)}/></label>
      <fieldset className="inline-author-options"><legend>Выбор {i+1} · отметьте правильный вариант</legend>
      {c.options.map((option,k)=><div className="inline-author-option" key={k}><label className="inline-author-correct"><input type="radio" name={`${id}-inline-answer-${i}`} aria-label={`Выбор ${i+1}: вариант ${k+1} правильный`} checked={c.correct===k} onChange={()=>choice(i,{correct:k})}/><span className="small">Верный</span></label><input className="input" maxLength={300} aria-label={`Выбор ${i+1}: вариант ${k+1}`} value={option} onChange={e=>choice(i,{options:c.options.map((o,j)=>j===k?e.target.value:o)})}/><button className="btn btn-quiet btn-sm" type="button" aria-label={`Убрать вариант ${k+1} выбора ${i+1}`} disabled={c.options.length<=2} onClick={()=>choice(i,{options:c.options.filter((_,j)=>j!==k),correct:c.correct===k?-1:c.correct>k?c.correct-1:c.correct})}>Убрать</button></div>)}
      <div className="row wrap"><button className="btn btn-secondary btn-sm" type="button" disabled={c.options.length>=6} onClick={()=>choice(i,{options:[...c.options,'новый вариант']})}>Добавить вариант</button><button className="btn btn-quiet btn-sm" type="button" onClick={()=>remove(i)}>Удалить выбор {i+1}</button></div></fieldset>
    </div>)}
    <label className="field">{parsed.choices.length?'Текст после последнего выбора':'Текст задания'}<textarea className="textarea" rows={2} aria-label="Текст после последнего выбора" value={parsed.parts.at(-1)} onChange={e=>part(parsed.parts.length-1,e.target.value)}/></label>
    <button className="btn btn-secondary btn-sm" type="button" disabled={parsed.choices.length>=80} onClick={add}>Ещё одно место выбора</button>
    {parsed.errors.length>0&&<p className="small" role="status">Проверьте варианты: нужны от 2 до 6 разных непустых ответов и один отмеченный правильный ответ в каждом выборе.</p>}
    <details className="editor-extra"><summary>Редактировать текст целиком</summary><label className="field">Предложения с вариантами<textarea className="textarea" rows={4} aria-label="Предложения с вариантами" value={block.text} onChange={e=>onChange({text:e.target.value})}/></label><p className="small muted">Для вставки готового текста: She [work|*works] here. Звёздочкой отмечен правильный вариант.</p>{parsed.errors.length>0&&<div className="inline-validation" role="status">{parsed.errors.slice(0,4).map((error,i)=><p key={i}>{error}</p>)}</div>}</details>
  </div>;
}
