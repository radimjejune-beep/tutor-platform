// cabinets/ClientApp.jsx — кабинет ученика и родителя (грузится отдельно, после входа)
import { SandboxBackBar } from '../components/Sandbox';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Shell, TUTOR_NAV, CLIENT_NAV, MoreMenu } from '../Shell';
import { Spinner, Empty, Link, useLoad } from '../ui';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { ChangePassword } from '../pages/Login';
import { NotFound } from './NotFound';
import { AcceptDocuments } from '../pages/Legal';
import LessonRoom from '../pages/LessonRoom';
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
  const pending = useLoad(() => api.legalPending(), []);
  if (pending.loading) return <Spinner />;
  if (pending.data?.length) return <AcceptDocuments docs={pending.data} onDone={pending.reload} />;
  return <ClientCabinet path={path} />;
}

function ClientCabinet({ path }) {
  const { students, user } = useAuth();
  const [childId, setChildId] = useState(students[0]?.id);
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

  const child = students.find((s) => s.id === childId) || students[0];
  const props = { student: child, isParent: user.role === 'parent' };

  const clientNav = CLIENT_NAV.map((n) => (n.to === '/words' ? { ...n, label: subjectInfo(child.subject || user.subject).vocabTitle } : n));
  let page;
  if (parts.length === 0) page = <ClientHome {...props} />;
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
  else if (parts[0] === 'help') page = <Help />;
  else if (parts[0] === 'more') page = <MoreMenu nav={clientNav} counts={counts} />;
  else page = <NotFound />;

  return (
    <Shell nav={clientNav} path={path} counts={counts}>
      <SandboxBackBar />
      {students.length > 1 && (
        <div className="row wrap" style={{ marginBottom: 22 }} role="tablist" aria-label="Ребёнок">
          {students.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === child.id}
              className={`btn btn-sm ${s.id === child.id ? '' : 'btn-secondary'}`}
              onClick={() => setChildId(s.id)}
            >
              {s.full_name}
            </button>
          ))}
        </div>
      )}
      {page}
    </Shell>
  );
}
