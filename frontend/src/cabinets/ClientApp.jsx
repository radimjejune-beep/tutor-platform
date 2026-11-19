// cabinets/ClientApp.jsx — кабинет ученика и родителя (грузится отдельно, после входа)
import { ClientMethod } from '../pages/Method';
import { SandboxBackBar } from '../components/Sandbox';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Shell, TUTOR_NAV, CLIENT_NAV, MoreMenu } from '../Shell';
import { Spinner, ErrorBox, Empty, Link, useLoad, navigate } from '../ui';
import {CourseMine,CoursePlayer} from '../pages/MarketplaceLearning';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { ChangePassword } from '../pages/Login';
import { NotFound } from './NotFound';
import { AcceptDocuments } from '../pages/Legal';
import LessonRoom from '../pages/LessonRoom';
import Grammar from '../pages/learning/Grammar';
import {FamilyConsents,GuardianWaiting,FamilyPage} from '../components/FamilyConsent';
import Coach, {CoachReview} from '../pages/learning/Coach';
import { DiagnosticsList, DiagnosticRun } from '../pages/learning/Diagnostics';
import { TheoryList, TheoryView } from '../pages/client/Theory';
import Words from '../pages/client/Words';
import SetStudy from '../pages/client/SetStudy';
import ClientHome from '../pages/client/Home';
import ClientSchedule from '../pages/client/Schedule';
import ClientHomework from '../pages/client/Homework';
import ClientProgress from '../pages/client/Progress';
import ClientPayments from '../pages/client/Payments';
import ReportView from '../pages/client/ReportView';
import HomeworkPage from '../pages/client/HomeworkPage';
import { subjectInfo } from '../subjects';

/* ---------- Кабинет ученика / родителя ---------- */
export default function ClientApp({ path }) {
  const {user}=useAuth();
  const gate=useLoad(()=>Promise.all([api.legalPending(),api.familyConsent()]),[user.id,user.role]);
  useEffect(()=>{if(gate.data?.[1].can_use!==false)return;const t=setInterval(gate.reload,30000);return()=>clearInterval(t);},[gate.data?.[1].can_use,gate.reload]);
  if(gate.loading)return <Spinner/>;
  if(gate.error)return <ErrorBox error={gate.error} onRetry={gate.reload}/>;
  const [pending,family]=gate.data;
  if(!family.can_use)return user.role==='parent'?<FamilyConsents state={family} onDone={gate.reload} blocking/>:<GuardianWaiting onRetry={gate.reload}/>;
  if(pending.length)return <AcceptDocuments docs={pending} onDone={gate.reload}/>;
  return <ClientCabinet path={path} />;
}

function ClientCabinet({ path }) {
  const { students, user, switchProfile } = useAuth();
  const [childId, setChildId] = useState(()=>{let saved;try{saved=Number(sessionStorage.getItem(`lf-profile:${user.id}`));}catch{}const chosen=students.find(s=>s.id===saved&&Boolean(s.is_self)===(user.context==='self'));return chosen?.id||(user.context==='self'?students.find(s=>s.is_self):students.find(s=>!s.is_self))?.id||students[0]?.id;});
  const [switching,setSwitching]=useState(false),[switchError,setSwitchError]=useState('');
  const choose=async s=>{try{sessionStorage.setItem(`lf-profile:${user.id}`,String(s.id));}catch{}setSwitchError('');setSwitching(true);try{if(user.role==='parent'||user.account_role==='parent')await switchProfile(s.is_self?'self':'parent');setChildId(s.id);navigate('/');}catch(e){setSwitchError(e.message);}finally{setSwitching(false);}};
  const [counts, setCounts] = useState({});
  const parts = path.split('/').filter(Boolean);

  useEffect(() => {
    if (!childId) return;
    Promise.all([
      api.homework({ student_id: childId, status: 'assigned' }).catch(() => []),
      api.vocab(childId).catch(() => null),
    ]).then(([list, vocab]) => setCounts({ homework: list.length, words: vocab?.stats.due || 0 }));
  }, [path, childId]);

  if (!students.length) {
    return (
      <Shell nav={CLIENT_NAV} path={path}>
        <div className="panel">
          <Empty title="Кабинет ещё настраивается">
            {user.role === 'parent'
              ? 'Преподаватель пока не привязал к вашему входу ни одного ученика.'
              : 'Преподаватель скоро добавит ваше расписание.'}
          </Empty>
        </div>
      </Shell>
    );
  }

  if(switching)return <Shell nav={CLIENT_NAV} path={path}><Spinner/></Shell>;
  const child = students.find((s) => s.id === childId) || students[0];
  const props = { student: child, isParent: user.role === 'parent' };

  const clientNav = CLIENT_NAV.map((n) => (n.to === '/words' ? { ...n, label: subjectInfo(child.subject || user.subject).vocabTitle } : n));
  let page;
  if (parts.length === 0) page = <ClientHome {...props} />;
  else if(parts[0]==='marketplace'&&parts[1]==='mine')page=<CourseMine key={child.id}/>;
  else if(parts[0]==='learn-course'&&parts[1])page=<CoursePlayer key={parts[1]} id={Number(parts[1])}/>;
  else if (parts[0] === 'coach' && parts[1]==='reviews' && parts[2]) page=<CoachReview id={Number(parts[2])}/>;
  else if (parts[0] === 'coach') page=<Coach key={child.id} {...props}/>;
  else if (parts[0] === 'family') page=<FamilyPage/>;
  else if (parts[0] === 'grammar') page = <Grammar topic={parts[1]} />;
  else if (parts[0] === 'diagnostics' && parts[1] === 'runs' && parts[2]) page = <DiagnosticRun id={Number(parts[2])} />;
  else if (parts[0] === 'diagnostics') page = <DiagnosticsList key={child.id} {...props} />;
  else if (parts[0] === 'schedule') page = <ClientSchedule {...props} />;
  else if (parts[0] === 'homework' && parts[1]) page = <HomeworkPage id={Number(parts[1])} isParent={props.isParent} />;
  else if (parts[0] === 'homework') page = <ClientHomework {...props} />;
  else if (parts[0] === 'progress') page = <ClientProgress {...props} />;
  else if (parts[0] === 'words' && parts[1] === 'set' && parts[2]) page = <SetStudy key={`${child.id}-${parts[2]}`} id={Number(parts[2])} {...props} />;
  else if (parts[0] === 'words') page = <Words key={child.id} {...props} />;
  else if (parts[0] === 'theory' && parts[1]) page = <TheoryView id={Number(parts[1])} />;
  else if (parts[0] === 'theory') page = <TheoryList />;
  else if (parts[0] === 'lesson' && parts[1]) page = <LessonRoom id={Number(parts[1])} />;
  else if (parts[0] === 'payments') page = <ClientPayments {...props} />;
  else if (parts[0] === 'reports' && parts[1]) page = <ReportView id={Number(parts[1])} />;
  else if (parts[0] === 'password') page = <ChangePassword />;
  else if (parts[0] === 'profile') page = <Profile />;
  else if (parts[0] === 'learn') page = <ClientMethod slug={parts[1]} />;
  else if (parts[0] === 'help') page = <Help />;
  else if (parts[0] === 'more') page = <MoreMenu nav={clientNav} counts={counts} />;
  else page = <NotFound />;

  return (
    <Shell nav={clientNav} path={path} counts={counts}>
      <SandboxBackBar />
      {students.length > 1 && (
        <div className="row wrap" style={{ marginBottom: 22 }} role="tablist" aria-label="Профиль семьи">
          {students.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === child.id}
              className={`btn btn-sm ${s.id === child.id ? '' : 'btn-secondary'}`}
              onClick={() => choose(s)}
            >
              {s.is_self?'Моё обучение':s.full_name}
            </button>
          ))}
        </div>
      )}
      {switchError&&<div className="alert" role="alert">{switchError}</div>}
      {page}
    </Shell>
  );
}
