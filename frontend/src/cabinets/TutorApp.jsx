import Workout from '../pages/learning/Workout';
import WritingReview from '../pages/learning/WritingReview';
// cabinets/TutorApp.jsx — кабинет преподавателя (грузится отдельно, после входа)
import { TutorMethod } from '../pages/Method';
import { SandboxBar } from '../components/Sandbox';
import { subjectInfo, hasBank } from '../subjects';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Shell, TUTOR_NAV, CLIENT_NAV, MoreMenu } from '../Shell';
import { Spinner, Empty, Link, useLoad } from '../ui';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { ChangePassword } from '../pages/Login';
import { AcceptPlatformTerms } from '../pages/Legal';
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
import {CoachReview} from '../pages/learning/Coach';
import { AssignmentsList, AssignmentEditor, AssignmentPage, ReviewPage } from '../pages/tutor/Assignments';
import Finance from '../pages/tutor/Finance';
import Grammar from '../pages/learning/Grammar';
import GrammarNotebook from '../pages/learning/GrammarNotebook.jsx';
import { DiagnosticsList, DiagnosticBuilder, DiagnosticTest, DiagnosticRun } from '../pages/learning/Diagnostics';
import CoursesMarketplace from '../pages/CoursesMarketplace';
import CoursePage from '../pages/CoursePage';
import MyCoursesAuthor from '../pages/tutor/MyCoursesAuthor';
import {CourseMine,CoursePlayer} from '../pages/MarketplaceLearning';
import BankPage from '../pages/tutor/Bank';

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

  // Новая редакция условий платформы: сначала принять (данные учеников обрабатываются по поручению преподавателя)
  const terms = useLoad(() => api.platformTerms().catch(() => ({ pending: false })), []);
  // Банк заданий пока по учебникам английского: показываем его тем, кто преподаёт язык
  const baseNav = hasBank(user.subject) ? TUTOR_NAV : TUTOR_NAV.filter((n) => n.to !== '/bank');
  const tutorNav = user.is_admin ? [...baseNav, { to: '/admin', label: 'Учителя', icon: 'shield', hideMobile: true, group: 'Учёт' }] : baseNav;
  if (terms.data?.pending && !user.is_admin) return <AcceptPlatformTerms docs={terms.data.docs} onDone={terms.reload} />;
  let page;
  if (parts.length === 0) page = <TutorDashboard />;
  else if(parts[0]==='learn-course'&&parts[1])page=<CoursePlayer key={parts[1]} id={Number(parts[1])}/>;
  else if(parts[0]==='marketplace'&&parts[1]==='mine')page=<CourseMine/>;
  else if(parts[0]==='marketplace'&&parts[1]==='author')page=<MyCoursesAuthor id={parts[2]?Number(parts[2]):undefined}/>;
  else if(parts[0]==='marketplace'&&parts[1]==='courses'&&parts[2])page=<CoursePage key={parts[2]} slug={parts[2]}/>;
  else if(parts[0]==='marketplace')page=<CoursesMarketplace/>;
  else if(parts[0]==='writing'&&parts[1])page=<WritingReview id={Number(parts[1])}/>;
  else if(parts[0]==='workouts'&&parts[1])page=<Workout id={Number(parts[1])}/>;
  else if (parts[0] === 'coach' && parts[1]==='reviews' && parts[2]) page=<CoachReview id={Number(parts[2])}/>;
  else if (parts[0] === 'notebook') page = <GrammarNotebook key={path} id={parts[1]}/>;
  else if (parts[0] === 'grammar') page = <Grammar topic={parts[1]} />;
  else if (parts[0] === 'diagnostics' && parts[1] === 'new') page = <DiagnosticBuilder />;
  else if (parts[0] === 'diagnostics' && parts[1] === 'tests' && parts[2]) page = <DiagnosticTest id={Number(parts[2])} />;
  else if (parts[0] === 'diagnostics' && parts[1] === 'runs' && parts[2]) page = <DiagnosticRun id={Number(parts[2])} />;
  else if (parts[0] === 'diagnostics') page = <DiagnosticsList />;
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
  else if (parts[0] === 'bank') page = <BankPage params={params} book={parts[1]} unit={parts[2] ? decodeURIComponent(parts[2]) : undefined} />;
  else if (parts[0] === 'market') page = <MarketPage key={parts[1] || 'all'} tab={parts[1] === 'mine' ? 'mine' : 'all'} />;
  else if (parts[0] === 'settings') page = <Settings tab={parts[1] || 'booking'} />;
  else if (parts[0] === 'more') page = <MoreMenu nav={tutorNav} counts={counts} />;
  else if (parts[0] === 'library' && parts[1] === 'generate') page = <Generator />;
  else if (parts[0] === 'library' && parts[1] === 'new') page = <LibraryEditor key={`new-${params.get('kind')}-${params.get('folder')}`} presetKind={params.get('kind') || 'task'} presetFolder={params.get('folder')} />;
  else if (parts[0] === 'library' && /^\d+$/.test(parts[1] || '')) page = <LibraryEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'library') page = <LibraryPage kind={{ all:'all',tasks:'task',theory: 'theory', games: 'game', lessons: 'html', books: 'books' }[parts[1]] || 'all'} />;
  else if (parts[0] === 'lesson' && parts[1]) page = <LessonRoom id={Number(parts[1])} />;
  else if (parts[0] === 'wordsets' && parts[1] === 'new') page = <WordSetEditor key="new" />;
  else if (parts[0] === 'wordsets' && /^\d+$/.test(parts[1] || '')) page = <WordSetEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'wordsets') page = <WordSetsList />;
  else if (parts[0] === 'courses' && parts[1]) page = <CourseEditor key={parts[1]} id={Number(parts[1])} />;
  else if (parts[0] === 'courses') page = <CoursesList />;
  else if (parts[0] === 'admin' && user.is_admin) page = <AdminPage />;
  else if (parts[0] === 'password') page = <ChangePassword />;
  else if (parts[0] === 'profile') page = <Profile />;
  else if (parts[0] === 'method') page = <TutorMethod slug={parts[1]} />;
  else if (parts[0] === 'help') page = <Help />;
  else page = <NotFound />;

  return (
    <Shell nav={tutorNav} path={path} counts={counts}>
      <SandboxBar />
      {page}
    </Shell>
  );
}

