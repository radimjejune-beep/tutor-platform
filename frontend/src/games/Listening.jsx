import {useId,useRef,useState} from 'react';
import {FileAudio,FileImage,AttachButton} from './SheetMedia';
import {listeningChoice} from './listening.js';
import './listening.css';
const letter=index=>String.fromCharCode(65+index);

export function ListeningBlock({block,first=0,value,onChange,result}){
 const id=useId(),[active,setActive]=useState(0),index=Math.min(active,block.questions.length-1),question=block.questions[index],values=Array.isArray(value)?value:[],chosen=listeningChoice(values[index],block.options.length),checked=Boolean(result),detail=result?.find(d=>d.k===index);
 const answered=block.questions.filter((_,k)=>listeningChoice(values[k],block.options.length)!==null).length;
 const select=option=>onChange(block.questions.map((_,k)=>k===index?option:values[k]??null));
 return <section className="sheet-block listening-block" aria-label="Аудирование">
  <header className="listening-intro"><span className="meta-label">Слушаем и выбираем</span>{block.instruction&&<p>{block.instruction}</p>}{block.audio?<FileAudio id={block.audio}/>:<p className="listening-empty">Запись пока не добавлена. На уроке преподаватель может прочитать задание вслух.</p>}</header>
  <nav className="listening-steps" aria-label="Вопросы к аудио">{block.questions.map((q,k)=><button type="button" className={`btn btn-sm ${k===index?'':'btn-secondary'}`} aria-current={k===index?'step':undefined} aria-label={`Вопрос ${first+k+1}${listeningChoice(values[k],block.options.length)!==null?' · ответ выбран':''}`} key={k} onClick={()=>setActive(k)}>{first+k+1}{listeningChoice(values[k],block.options.length)!==null&&<span aria-hidden="true"> · ✓</span>}</button>)}</nav>
  <fieldset className="listening-question" disabled={checked}><legend><span className="sheet-n">{first+index+1}</span>{question.q}</legend>
   <div className="listening-options">{block.options.map((option,j)=><label key={j} className={['listening-option',chosen===j&&'selected',detail&&(j===question.correct?'correct':chosen===j?'incorrect':'')].filter(Boolean).join(' ')}>
    <input type="radio" name={id} value={j} checked={chosen===j} onChange={()=>select(j)}/>
    {option.image&&<FileImage id={option.image} alt={option.text}/>}
    <span className="listening-caption"><b aria-hidden="true">{letter(j)}</b><span>{option.text}</span></span>
   </label>)}</div>
  </fieldset>
  {detail&&<p className={`listening-feedback ${detail.ok?'ok':'bad'}`} role="status">{detail.ok?'Верно.':`Правильный ответ: ${detail.expected}.`}{!detail.ok&&detail.given&&` Ваш ответ: ${detail.given}.`}</p>}
  <footer className="listening-footer"><span className="small muted">Выбрано {answered} из {block.questions.length}</span><div className="row wrap"><button type="button" className="btn btn-secondary btn-sm" disabled={index===0} onClick={()=>setActive(index-1)}>Предыдущий вопрос</button><button type="button" className="btn btn-secondary btn-sm" disabled={index===block.questions.length-1} onClick={()=>setActive(index+1)}>Следующий вопрос</button></div></footer>
 </section>;
}

export function ListeningEditor({block,onChange,upload}){
 const [busy,setBusy]=useState(false),latest=useRef({block,onChange});latest.current={block,onChange};
 const patch=value=>latest.current.onChange(value);
 const attach=async(file,save)=>{setBusy(true);try{save(await upload(file));}finally{setBusy(false);}};
 const option=(index,value)=>patch({options:latest.current.block.options.map((item,j)=>j===index?{...item,...value}:item)});
 const question=(index,value)=>patch({questions:latest.current.block.questions.map((item,j)=>j===index?{...item,...value}:item)});
 const remove=index=>patch({options:block.options.filter((_,j)=>j!==index),questions:block.questions.map(q=>({...q,correct:q.correct===index?0:q.correct>index?q.correct-1:q.correct}))});
 return <fieldset className="listening-editor" disabled={busy}><legend className="sr-only">Настройка аудирования</legend>
  <label className="field">Инструкция к аудио<textarea aria-label="Инструкция к аудио" className="textarea" rows={2} maxLength={2000} value={block.instruction} onChange={e=>patch({instruction:e.target.value})}/></label>
  <div className="listening-recording"><h3>1. Запись</h3><p className="small muted">Одна запись для всех вопросов этого блока. Замените примеры вопросов и подписи под свою запись. MP3, M4A, WAV или другой поддерживаемый браузером аудиофайл, до 10 МБ.</p>{block.audio&&<FileAudio id={block.audio}/>}<div className="row wrap"><AttachButton accept="audio/*" label={block.audio?'Заменить запись':'Загрузить запись'} onFile={file=>attach(file,saved=>patch({audio:saved.id}))}/>{block.audio&&<button type="button" className="btn btn-quiet btn-sm" onClick={()=>patch({audio:null})}>Убрать запись</button>}</div></div>
  <h3>2. Картинки или текстовые варианты</h3><p className="small muted">Можно загрузить отдельные фотографии A–H или оставить текст. Подпись также описывает изображение для ученика, который его не видит.</p>
  <div className="listening-edit-options">{block.options.map((item,index)=><section key={index} className="listening-edit-option"><div className="row-between"><b>Вариант {letter(index)}</b><button type="button" className="btn btn-quiet btn-sm" aria-label={`Удалить вариант ${letter(index)}`} disabled={block.options.length<=2} onClick={()=>remove(index)}>Убрать</button></div>{item.image&&<FileImage id={item.image} alt={item.text}/>}
   <label className="field">Подпись варианта {letter(index)}<textarea aria-label={`Подпись варианта ${letter(index)}`} className="textarea" rows={2} maxLength={500} value={item.text} onChange={e=>option(index,{text:e.target.value})}/></label><div className="row wrap"><AttachButton accept="image/*" label={`Картинка ${letter(index)}`} onFile={file=>attach(file,saved=>option(index,{image:saved.id}))}/>{item.image&&<button type="button" className="btn btn-quiet btn-sm" onClick={()=>option(index,{image:null})}>Убрать картинку</button>}</div>
  </section>)}</div>
  <button type="button" className="btn btn-secondary btn-sm" disabled={block.options.length>=8} onClick={()=>patch({options:[...block.options,{text:`Вариант ${letter(block.options.length)}`,image:null}]})}>Добавить вариант</button>
  <h3>3. Вопросы к записи</h3>{block.questions.map((item,index)=><div key={index} className="listening-edit-question"><label className="field">Вопрос к записи {index+1}<input aria-label={`Вопрос к записи ${index+1}`} className="input" maxLength={1000} value={item.q} onChange={e=>question(index,{q:e.target.value})}/></label><label className="field">Правильный ответ на вопрос {index+1}<select aria-label={`Правильный ответ на вопрос ${index+1}`} className="select" value={item.correct} onChange={e=>question(index,{correct:Number(e.target.value)})}>{block.options.map((option,j)=><option key={j} value={j}>{letter(j)} · {option.text}</option>)}</select></label><button type="button" className="btn btn-quiet btn-sm" disabled={block.questions.length<=1} aria-label={`Удалить вопрос к записи ${index+1}`} onClick={()=>patch({questions:block.questions.filter((_,j)=>j!==index)})}>Убрать вопрос</button></div>)}
  <button type="button" className="btn btn-secondary btn-sm" disabled={block.questions.length>=20} onClick={()=>patch({questions:[...block.questions,{q:`Вопрос ${block.questions.length+1}`,correct:0}]})}>Добавить вопрос к записи</button>
  <p className="small muted">После этого блока можно добавить выбор слов в предложении, пропуски, диктант или письменный ответ. Используйте собственные записи и материалы либо материалы, на которые у вас есть права.</p>
 </fieldset>;
}
