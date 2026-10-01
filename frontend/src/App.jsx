// App.jsx — выбор кабинета по роли и маршруты
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth';
import { api } from './api';
import { Shell, TUTOR_NAV, CLIENT_NAV } from './Shell';
import { ToastProvider, Spinner, useRoute, Empty, Link } from './ui';
import { Login, ChangePassword } from './pages/Login';

import TutorDashboard from './pages/tutor/Dashboard';
import TutorSchedule from './pages/tutor/Schedule';
import Students from './pages/tutor/Students';
import StudentPage from './pages/tutor/StudentPage';
import HomeworkReview from './pages/tutor/HomeworkReview';
import Finance from './pages/tutor/Finance';

import ClientHome from './pages/client/Home';
import ClientSchedule from './pages/client/Schedule';
import ClientHomework from './pages/client/Homework';
import ClientProgress from './pages/client/Progress';
import ClientPayments from './pages/client/Payments';
import ReportView from './pages/client/ReportView';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </ToastProvider>
  );
}

function Root() {
  const { session, user } = useAuth();
  const path = useRoute();

  if (session === undefined) return <Spinner />;
  if (!session) return <Login />;
  if (user.must_change_password) return <ChangePassword forced />;
  return user.role === 'tutor' ? <TutorApp path={path} /> : <ClientApp path={path} />;
}

const NotFound = () => (
  <div className="panel">
    <Empty title="Такой страницы нет" action={<Link to="/" className="btn">На главную</Link>} />
  </div>
);

/* ---------- Кабинет преподавателя ---------- */
function TutorApp({ path }) {
  const [counts, setCounts] = useState({});
  const parts = path.split('/').filter(Boolean);

  // Счётчик ДЗ на проверке в меню — обновляется при переходах
  useEffect(() => {
    api
      .homework({ status: 'submitted' })
      .then((list) => setCounts({ homework: list.length }))
      .catch(() => {});
  }, [path]);

  let page;
  if (parts.length === 0) page = <TutorDashboard />;
  else if (parts[0] === 'schedule') page = <TutorSchedule />;
  else if (parts[0] === 'students' && parts[1]) page = <StudentPage id={Number(parts[1])} tab={parts[2] || 'lessons'} />;
  else if (parts[0] === 'students') page = <Students />;
  else if (parts[0] === 'homework') page = <HomeworkReview />;
  else if (parts[0] === 'finance') page = <Finance />;
  else if (parts[0] === 'password') page = <ChangePassword />;
  else page = <NotFound />;

  return (
    <Shell nav={TUTOR_NAV} path={path} counts={counts}>
      {page}
    </Shell>
  );
}

/* ---------- Кабинет ученика / родителя ---------- */
function ClientApp({ path }) {
  const { students, user } = useAuth();
  const [childId, setChildId] = useState(students[0]?.id);
  const [counts, setCounts] = useState({});
  const parts = path.split('/').filter(Boolean);

  useEffect(() => {
    if (!childId) return;
    api
      .homework({ student_id: childId, status: 'assigned' })
      .then((list) => setCounts({ homework: list.length }))
      .catch(() => {});
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

  let page;
  if (parts.length === 0) page = <ClientHome {...props} />;
  else if (parts[0] === 'schedule') page = <ClientSchedule {...props} />;
  else if (parts[0] === 'homework') page = <ClientHomework {...props} />;
  else if (parts[0] === 'progress') page = <ClientProgress {...props} />;
  else if (parts[0] === 'payments') page = <ClientPayments {...props} />;
  else if (parts[0] === 'reports' && parts[1]) page = <ReportView id={Number(parts[1])} />;
  else if (parts[0] === 'password') page = <ChangePassword />;
  else page = <NotFound />;

  return (
    <Shell nav={CLIENT_NAV} path={path} counts={counts}>
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
