import {useEffect,useState} from 'react';
import {api} from '../api';
export function GrammarContent({blocks=[]}){
 return <div className="grammar-content">{blocks.map((b,i)=>b.type==='heading'?<h2 className="section-title grammar-heading" key={i}>{b.text}</h2>:b.type==='table'?<div className="grammar-table-scroll" key={i} role="region" aria-label={blocks[i-1]?.text||'Таблица'} tabIndex={0}><table className="grammar-table"><thead><tr>{b.headers.map((h,j)=><th key={j} scope="col">{h}</th>)}</tr></thead><tbody>{b.rows.map((r,k)=><tr key={k}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>:b.type==='scheme'?<ol className="grammar-scheme" key={i}>{b.items.map((x,j)=><li key={j}><span>{j+1}</span><div>{x}</div></li>)}</ol>:<p className="grammar-paragraph" key={i}>{b.text}</p>)}</div>;
}
export function NotebookImages({files=[]}){
 return <div className="notebook-images">{files.filter(f=>/^image\//.test(f.mime)).map(f=><Photo key={f.id} file={f}/>)}</div>;
}
function Photo({file}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let active=true,blobURL;api.fileBlob(file.id).then(blob=>{blobURL=URL.createObjectURL(blob);if(active)setUrl(blobURL);}).catch(()=>{if(active)setError(true);});return()=>{active=false;if(blobURL)URL.revokeObjectURL(blobURL);};},[file.id]);
 return <figure>{url?<img src={url} alt={file.filename}/>:<p className="small muted">{error?'Не удалось загрузить фото. Обновите страницу.':'Загружаем фото…'}</p>}<figcaption className="small muted">{file.filename}</figcaption></figure>;
}
