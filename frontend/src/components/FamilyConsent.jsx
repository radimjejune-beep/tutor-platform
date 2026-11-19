import {useState} from 'react';
import {api} from '../api';
import {useAuth} from '../auth';
import {Field,Link,Spinner,ErrorBox,useLoad,navigate} from '../ui';
import {LegalText} from '../pages/Legal';

export function GuardianWaiting({onRetry}) {
 const {logout}=useAuth();
 return <main className="legal-page"><section className="legal-wrap panel"><h1 className="page-title">Нужно подтверждение родителя</h1><p>Родителю или законному представителю нужно войти в свой аккаунт и подтвердить документы за тебя. После этого откроются занятия и задания.</p><p className="muted">Если у родителя ещё нет входа, попросите преподавателя создать его и связать с твоим профилем. Вход ребёнка не подходит для подтверждения за родителя.</p><div className="row wrap"><button className="btn" onClick={onRetry}>Проверить подтверждение</button><button className="btn btn-secondary" onClick={logout}>Выйти</button></div></section></main>;
}
export function FamilyConsents({state,onDone,blocking=false}) {
 const {students,switchProfile,logout}=useAuth(),[selected,setSelected]=useState([]),[checked,setChecked]=useState([]),[declared,setDeclared]=useState(false),[relationship,setRelationship]=useState('parent'),[opened,setOpened]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=state.children.filter(s=>!s.confirmed),docs=state.documents||[];
 const toggle=(list,set,id)=>set(list.includes(id)?list.filter(x=>x!==id):[...list,id]);
 const accept=async()=>{const document_ids=docs.filter(d=>checked.includes(d.id)).map(d=>d.id);if(document_ids.length!==3||!selected.length||!declared){setError('Подтвердите действующие редакции документов за выбранных детей');return;}setBusy(true);setError('');try{await api.acceptGuardian({student_ids:selected,document_ids,declaration:true,relationship});setSelected([]);setChecked([]);setDeclared(false);onDone();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const revoke=async id=>{if(!window.confirm('Отозвать ваше подтверждение за этого ребёнка? Доступ к учебным функциям может быть ограничен. История подтверждений сохранится.'))return;setBusy(true);setError('');try{await api.revokeGuardian(id);onDone();}catch(e){setError(e.message);}finally{setBusy(false);}};
 const own=async()=>{setBusy(true);try{await switchProfile('self');navigate('/');}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <div className={blocking?'legal-page':''}><section className={blocking?'legal-wrap panel':'panel'}><h1 className="page-title">Семья и согласия</h1><p>Подтверждение за ребёнка выполняет родитель или другой законный представитель в своём аккаунте. Дата, версия документов и выбранный ребёнок сохраняются отдельно.</p>
  {state.children.filter(s=>s.confirmed).map(s=><div className="family-child row-between wrap" key={s.id}><div><b>{s.full_name}</b><div className="small muted">Документы подтверждены в вашем аккаунте</div></div><button className="btn btn-quiet btn-sm" disabled={busy} onClick={()=>revoke(s.id)}>Отозвать подтверждение</button></div>)}
  {pending.length>0?<><h2 className="section-title">За кого подтверждаете</h2><p className="small muted">Отметьте только детей, законным представителем которых вы являетесь. Если ребёнок привязан ошибочно, обратитесь к преподавателю.</p>
   {pending.map(s=><label className="check family-child" key={s.id}><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggle(selected,setSelected,s.id)}/>{s.full_name}</label>)}
   <Field label="Кем вы приходитесь ребёнку"><select className="select" value={relationship} onChange={e=>setRelationship(e.target.value)}><option value="parent">Родитель</option><option value="guardian">Другой законный представитель</option></select></Field>
   {docs.map(d=><div className="family-document" key={d.id}><label className="check"><input type="checkbox" checked={checked.includes(d.id)} onChange={()=>toggle(checked,setChecked,d.id)}/><span>{d.kind==='offer'?'Принимаю условия оферты для выбранных детей':d.kind==='privacy'?'Ознакомлен(а) с политикой обработки персональных данных':'Даю согласие на обработку персональных данных выбранных детей и моих данных как представителя'} · редакция {d.version}</span></label><button className="btn btn-quiet btn-sm" onClick={()=>setOpened(opened===d.id?null:d.id)}>Прочитать: {d.title}</button>{opened===d.id&&<div className="family-document-body"><LegalText body={d.body}/></div>}</div>)}
   <label className="check family-child"><input type="checkbox" checked={declared} onChange={e=>setDeclared(e.target.checked)}/>Подтверждаю, что являюсь законным представителем отмеченных детей и имею право действовать от их имени.</label>
   <p className="small muted">Не отмечайте документы, если данные или условия неверны. Для вопросов и отзыва согласия используйте контакт оператора, указанный в документе.</p><button className="btn" disabled={busy||!selected.length||docs.length!==3||!docs.every(d=>checked.includes(d.id))||!declared} onClick={accept}>{busy?'Сохраняем…':'Подтвердить за выбранных детей'}</button>
  </>:<p role="status">Нет детей, которым требуется новое подтверждение. Вы можете пользоваться кабинетом.</p>}
  {!state.children.length&&<p className="muted">Профили несовершеннолетних детей пока не привязаны. Это делает преподаватель в карточке ребёнка.</p>}
  {error&&<div className="alert" role="alert">{error}</div>}
  {blocking&&<div className="row wrap" style={{marginTop:20}}>{students.some(s=>s.is_self)&&<button className="btn btn-secondary" disabled={busy} onClick={own}>Перейти к моему обучению</button>}<button className="btn btn-quiet" onClick={logout}>Выйти</button></div>}
 </section></div>;
}
export function FamilyPage(){
 const {user,switchProfile}=useAuth(),data=useLoad(()=>api.familyConsent(),[user.id,user.role]),[error,setError]=useState('');
 if(user.account_role==='parent'&&user.context==='self')return <div className="panel"><h1 className="page-title">Семейный кабинет</h1><p>Сейчас открыт ваш собственный учебный профиль. Подтверждения за детей доступны в родительском профиле.</p><button className="btn" onClick={async()=>{try{await switchProfile('parent');navigate('/');}catch(e){setError(e.message);}}}>Открыть родительский профиль</button>{error&&<p className="alert">{error}</p>}</div>;
 if(data.loading)return <Spinner/>;if(data.error)return <ErrorBox error={data.error} onRetry={data.reload}/>;
 return user.role==='parent'?<FamilyConsents state={data.data} onDone={data.reload}/>:<div className="panel"><h1 className="page-title">Семья и согласия</h1><p>Подтверждения за ребёнка доступны в аккаунте законного представителя.</p><Link to="/">На главную</Link></div>;
}
