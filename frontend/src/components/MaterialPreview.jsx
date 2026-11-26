import {api} from '../api';
import {Modal,useLoad,Spinner,ErrorBox,Link} from '../ui';
import LibraryItem from './LibraryItem';
import ActivityActions from './ActivityActions';
import {TrayButton} from './MaterialTray';
export default function MaterialPreview({id,onClose}) {
  const data=useLoad(()=>api.libraryItem(id),[id]);
  return <Modal title="Предпросмотр материала" onClose={onClose} drawer><div className="material-preview"><p className="small muted">Проверьте задание и вернитесь к подбору. Фильтры и место в списке сохраняются.</p>{data.loading?<Spinner/>:data.error?<ErrorBox error={data.error} onRetry={data.reload}/>:<><LibraryItem item={data.data} compactGame={data.data.game?.type==='sheet'}/><div className="row wrap"><TrayButton source="library" item={data.data}/><Link className="btn btn-secondary btn-sm" to={'/library/'+id}>Открыть редактор</Link></div><ActivityActions id={id}/></>}</div></Modal>;
}
