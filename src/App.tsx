import { LayoutDashboard, Users, School, ClipboardList, MoreHorizontal, Home, TrendingUp, History as HistoryIcon, User, MessageCircle } from 'lucide-react';
import { useApp } from './app/context';
import { useRoute, href } from './app/router';
import { Spinner } from './components/ui';
import { Shell, type NavItem } from './components/Shell';
import { SignIn } from './pages/SignIn';
import { Welcome } from './pages/Welcome';
import { NewPassword } from './components/NewPassword';
import { lazy, Suspense, useEffect } from 'react';

// Each role downloads only its own screens (a student's phone never loads the teacher pages).
// After the first screen shows, the rest of that role's screens are fetched quietly so tab switches stay instant.
const load = {
  today: () => import('./pages/teacher/Today'), students: () => import('./pages/teacher/Students'), detail: () => import('./pages/teacher/StudentDetail'),
  classes: () => import('./pages/teacher/Classes'), tasks: () => import('./pages/teacher/Assignments'), more: () => import('./pages/teacher/More'),
  student: () => import('./pages/student/StudentApp'), parent: () => import('./pages/parent/ParentApp'),
  certificate: () => import('./pages/Certificate'), apply: () => import('./pages/public/Apply'),
};
const Today = lazy(() => load.today().then(m => ({ default: m.Today })));
const Students = lazy(() => load.students().then(m => ({ default: m.Students })));
const StudentDetail = lazy(() => load.detail().then(m => ({ default: m.StudentDetail })));
const Classes = lazy(() => load.classes().then(m => ({ default: m.Classes })));
const Assignments = lazy(() => load.tasks().then(m => ({ default: m.Assignments })));
const More = lazy(() => load.more().then(m => ({ default: m.More })));
const StudentApp = lazy(() => load.student().then(m => ({ default: m.StudentApp })));
const ParentApp = lazy(() => load.parent().then(m => ({ default: m.ParentApp })));
const Certificate = lazy(() => load.certificate().then(m => ({ default: m.Certificate })));
const MushafReaderPage = lazy(() => import('./components/Mushaf').then(m => ({ default: m.MushafReaderPage })));
const Apply = lazy(() => load.apply().then(m => ({ default: m.Apply })));
const idle = (f: () => void) => { const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void }; if (w.requestIdleCallback) w.requestIdleCallback(f); else setTimeout(f, 1500); };
function usePreload(role: string | undefined) {
  useEffect(() => {
    if (!role) return;
    idle(() => { const list = role === 'admin' || role === 'teacher' ? [load.today, load.students, load.detail, load.classes, load.tasks, load.more] : role === 'student' ? [load.student] : [load.parent]; list.forEach(f => f().catch(() => undefined)); });
  }, [role]);
}

const STAFF_NAV: NavItem[] = [
  { key: 'today', label: 'Today', icon: LayoutDashboard, href: href('today') }, { key: 'students', label: 'Students', icon: Users, href: href('students') },
  { key: 'classes', label: 'Halaqah', icon: School, href: href('classes') }, { key: 'assignments', label: 'Tasks', icon: ClipboardList, href: href('assignments') },
  { key: 'more', label: 'More', icon: MoreHorizontal, href: href('more') },
];
const STUDENT_NAV: NavItem[] = [
  { key: 'home', label: 'Today', icon: Home, href: href('home') }, { key: 'progress', label: 'Progress', icon: TrendingUp, href: href('progress') },
  { key: 'history', label: 'History', icon: HistoryIcon, href: href('history') }, { key: 'messages', label: 'Messages', icon: MessageCircle, href: href('messages') }, { key: 'me', label: 'My plan', icon: User, href: href('me') },
];
export function App() {
  return <><Suspense fallback={<Spinner />}><Main /></Suspense><NewPassword /></>;
}
function Main() {
  const { user, org, loading } = useApp();
  const route = useRoute();
  usePreload(org?.role);
  const [page = '', sub, third] = route;
  if (page === 'apply' && sub) return <Apply orgId={sub} />;
  if (page === 'mushaf') return <MushafReaderPage page={sub ? Number(sub) || undefined : undefined} />;
  if (loading) return <Spinner />;
  if (!user) return <SignIn />;
  if (!org) return <Welcome />;
  if (page === 'certificate' && sub && third) return <Certificate studentId={sub} code={third} />;
  if (org.role === 'admin' || org.role === 'teacher') {
    const key = STAFF_NAV.some(n => n.key === page) ? page : 'today';
    return <Shell nav={STAFF_NAV} active={key} key={org.id}>
      {key === 'today' && <Today />}
      {key === 'students' && (sub && sub !== 'new' ? <StudentDetail id={sub} key={sub} initialTab={third} /> : <Students />)}
      {key === 'classes' && <Classes />}
      {key === 'assignments' && <Assignments />}
      {key === 'more' && <More />}
    </Shell>;
  }
  if (org.role === 'student') {
    const key = STUDENT_NAV.some(n => n.key === page) ? page : 'home';
    return <Shell nav={STUDENT_NAV} active={key} key={org.id}><StudentApp tab={key} /></Shell>;
  }
  return <Shell nav={[{ key: 'child', label: 'My child', icon: Users, href: href('child') }]} active="child" key={org.id}><ParentApp /></Shell>;
}
