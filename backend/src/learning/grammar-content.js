// Одни и те же авторские объяснения доступны в справочнике, банке и личной тетради.
function contentOf(topic){
 const blocks=[];
 const paragraph=text=>blocks.push({type:'paragraph',text});
 const heading=text=>blocks.push({type:'heading',text});
 for(const part of topic.sections||[topic]){
  if(topic.sections?.length>1)heading(part.title);
  const l=part.lesson;
  if(!l){heading('Когда использовать');paragraph(part.when);heading('Как построить');paragraph(part.form);heading('Примеры');for(const x of part.examples)paragraph(x);heading('Обрати внимание');paragraph(part.mistake);continue;}
  paragraph(l.goal);heading('Разбираемся в смысле');l.meaning.forEach(paragraph);
  heading('Как построить');blocks.push({type:'table',headers:['Ситуация','Модель','Пояснение'],rows:l.patterns.map(x=>[x.label,x.form,x.note||''])});
  heading('Примеры с переводом');blocks.push({type:'table',headers:['Пример','Перевод','Почему так'],rows:l.examples.map(x=>[x.text,x.translation,x.note||''])});
  heading('Частые ошибки');blocks.push({type:'table',headers:['Неверно в этом значении','Исправление','Объяснение'],rows:l.errors.map(x=>[x.wrong,x.right,x.why])});
  heading('Сравни похожие конструкции');paragraph(l.contrast);heading('Проверь себя по шагам');blocks.push({type:'scheme',items:l.steps});heading('Примени в своей речи');paragraph(l.production);
 }
 return blocks;
}
function plainContent(blocks){return blocks.map(b=>b.type==='table'?[b.headers.join(' · '),...b.rows.map(row=>row.map((v,i)=>`${b.headers[i]}: ${v}`).join(' — '))].join('\n'):b.type==='scheme'?b.items.map((x,i)=>`${i+1}. ${x}`).join('\n'):b.text).join('\n\n');}
module.exports={contentOf,plainContent};
