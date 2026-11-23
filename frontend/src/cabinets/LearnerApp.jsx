import {useAuth} from '../auth';
import {Shell,MoreMenu} from '../Shell';
import {Link} from '../ui';
import CoursesMarketplace from '../pages/CoursesMarketplace';
import CoursePage from '../pages/CoursePage';
import {CourseMine,CoursePlayer} from '../pages/MarketplaceLearning';
import {BillingHistory} from '../components/Checkout';
import {NameForm,EmailForm} from '../pages/Profile';
import {ChangePassword} from '../pages/Login';
import {NotFound} from './NotFound';
const NAV=[{to:'/',label:'Мои курсы',icon:'layers'},{to:'/marketplace',label:'Каталог курсов',icon:'grid'},{to:'/purchases',label:'Покупки',icon:'wallet'},{to:'/profile',label:'Профиль',icon:'user',hideMobile:true}];
export default function LearnerApp({path}){
 const {user,refresh,logout}=useAuth(),parts=path.split('/').filter(Boolean);let page;
 if(path==='/'||path==='/marketplace/mine')page=<CourseMine/>;
 else if(path==='/marketplace')page=<CoursesMarketplace/>;
 else if(parts[0]==='marketplace'&&parts[1]==='courses'&&parts[2])page=<CoursePage slug={parts[2]}/>;
 else if(parts[0]==='learn-course'&&/^\d+$/.test(parts[1]||''))page=<CoursePlayer key={parts[1]} id={Number(parts[1])}/>;
 else if(path==='/purchases')page=<><h1 className="page-title">Покупки</h1><p className="muted">Проверьте статус оплаты и вернитесь в курс после подтверждения.</p><BillingHistory/><Link className="btn btn-secondary" to="/marketplace/mine">К моим курсам</Link></>;
 else if(path==='/profile')page=<><h1 className="page-title">Профиль</h1><section className="panel"><h2 className="section-title">Имя</h2><NameForm user={user} refresh={refresh}/></section><section className="panel"><h2 className="section-title">Почта для входа</h2><EmailForm user={user} refresh={refresh}/></section><ChangePassword/><button className="btn btn-secondary" onClick={logout}>Выйти</button></>;
 else if(path==='/password')page=<ChangePassword/>;
 else if(path==='/more')page=<MoreMenu nav={NAV}/>;
 else if(path==='/help')page=<><h1 className="page-title">Помощь с обучением</h1><section className="panel"><h2 className="section-title">С чего начать</h2><p>Выберите курс в каталоге. Бесплатный можно добавить сразу, платный появится после подтверждения оплаты. Продолжайте занятия в «Моих курсах»; ответы сохраняются в вашем аккаунте.</p><p>Если оплата прошла, а доступа нет, откройте «Покупки» и нажмите «Проверить оплату».</p><p>Нужна помощь: <a href="mailto:support@lessonfold.ru">support@lessonfold.ru</a>. Укажите название курса и номер заказа, без пароля и данных карты.</p></section></>;
 else page=<NotFound/>;
 return <Shell nav={NAV} path={path}>{page}</Shell>;
}
