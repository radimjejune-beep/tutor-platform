// cabinets/TutorApp.jsx — кабинет преподавателя (грузится отдельно, после входа)
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Shell, TUTOR_NAV, CLIENT_NAV } from '../Shell';
import { Spinner, Empty, Link, useLoad } from '../ui';
import { ChangePassword } from '../pages/Login';
import { NotFound } from './NotFound';
import AdminPage from '../pages/tutor/Admin';
import Settings from '../pages/tutor/Settings';
import { LibraryPage, LibraryEditor } from '../pages/tutor/Library';
import LessonRoom from '../pages/LessonRoom';
import { CoursesList, CourseEditor } from '../pages/tutor/Courses';
import { GroupsList, GroupPage } from '../pages/tutor/Groups';
import Leads from '../pages/tutor/Leads';
import Pricing from '../pages/tutor/Pricing';
import { MarketPage } from '../pages/tutor/Market';
import { WordSetsList, WordSetEditor } from '../pages/tutor/WordSets';
import Generator from '../pages/tutor/Generator';
import TutorDashboard from '../pages/tutor/Dashboard';
import TutorSchedule from '../pages/tutor/Schedule';
import Students from '../pages/tutor/Students';
import StudentPage from '../pages/tutor/StudentPage';
import { AssignmentsList, AssignmentEditor, AssignmentPage, ReviewPage } from '../pages/tutor/Assignments';
import Finance from '../pages/tutor/Finance';

/* ---------- Кабинет преподавателя ---------- */
export default function TutorApp({ path, params }) {
  const { user } = useAuth();
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
  else if (parts[0] === 'groups' && parts[1]) page = <GroupPage key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'groups') page = <GroupsList />;
  else if (parts[0] === 'homework' && parts[1] === 'new') page = <AssignmentEditor key={`new-${params.toString()}`} presetStudentId={Number(params.get('student')) || undefined} presetStudents={(params.get('students') || '').split(',').map(Number).filter(Boolean)} presetItems={(params.get('items') || '').split(',').map(Number).filter(Boolean)} />;
  else if (parts[0] === 'homework' && parts[2] === 'edit') page = <AssignmentEditor key={`edit-${parts[1]}`} id={Number(parts[1])} />;
  else if (parts[0] === 'homework' && parts[2] === 'review' && parts[3]) page = <ReviewPage assignmentId={Number(parts[1])} homeworkId={Number(parts[3])} />;
  else if (parts[0] === 'homework' && parts[1]) page = <AssignmentPage id={Number(parts[1])} />;
  else if (parts[0] === 'homework') page = <AssignmentsList />;
  else if (parts[0] === 'finance' && parts[1] === 'pricing') page = <Pricing />;
  else if (parts[0] === 'finance') page = <Finance />;
  else if (parts[0] === 'leads') page = <Leads />;
  else if (parts[0] === 'market') page = <MarketPage key={parts[1] || 'all'} tab={parts[1] === 'mine' ? 'mine' : 'all'} />;
  else if (parts[0] === 'settings') page = <Settings tab={parts[1] || 'booking'} />;
  else if (parts[0] === 'library' && parts[1] === 'generate') page = <Generator />;
  else if (parts[0] === 'library' && parts[1] === 'new') page = <LibraryEditor key={`new-${params.get('kind')}`} presetKind={params.get('kind') || 'task'} />;
  else if (parts[0] === 'library' && /^\d+$/.test(parts[1] || '')) page = <LibraryEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'library') page = <LibraryPage key={parts[1] || 'tasks'} kind={{ theory: 'theory', games: 'game', lessons: 'html' }[parts[1]] || 'task'} />;
  else if (parts[0] === 'lesson' && parts[1]) page = <LessonRoom id={Number(parts[1])} />;
  else if (parts[0] === 'wordsets' && parts[1] === 'new') page = <WordSetEditor key="new" />;
  else if (parts[0] === 'wordsets' && /^\d+$/.test(parts[1] || '')) page = <WordSetEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'wordsets') page = <WordSetsList />;
  else if (parts[0] === 'courses' && parts[1]) page = <CourseEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'courses') page = <CoursesList />;
  else if (parts[0] === 'admin' && user.is_admin) page = <AdminPage />;
  else if (parts[0] === 'password') page = <ChangePassword />;
  else page = <NotFound />;

  return (
    <Shell nav={user.is_admin ? [...TUTOR_NAV, { to: '/admin', label: 'Учителя', icon: 'shield', hideMobile: true }] : TUTOR_NAV} path={path} counts={counts}>
      {page}
    </Shell>
  );
}

