import { LayoutDashboard, Users, School, ClipboardList, MoreHorizontal, Home, TrendingUp, History as HistoryIcon, User, MessageCircle } from 'lucide-react';
import { Certificate } from './pages/Certificate';
import { Apply } from './pages/public/Apply';
import { useApp } from './app/context';
import { useRoute, href } from './app/router';
import { Spinner } from './components/ui';
import { Shell, type NavItem } from './components/Shell';
import { SignIn } from './pages/SignIn';
import { Welcome } from './pages/Welcome';
import { Today } from './pages/teacher/Today';
import { Students } from './pages/teacher/Students';
import { StudentDetail } from './pages/teacher/StudentDetail';
import { Classes } from './pages/teacher/Classes';
import { Assignments } from './pages/teacher/Assignments';
import { More } from './pages/teacher/More';
import { StudentApp } from './pages/student/StudentApp';
import { ParentApp } from './pages/parent/ParentApp';
import { NewPassword } from './components/NewPassword';

const STAFF_NAV: NavItem[] = [
  { key: 'today', label: 'Today', icon: LayoutDashboard, href: href('today') }, { key: 'students', label: 'Students', icon: Users, href: href('students') },
  { key: 'classes', label: 'Class', icon: School, href: href('classes') }, { key: 'assignments', label: 'Work', icon: ClipboardList, href: href('assignments') },
  { key: 'more', label: 'More', icon: MoreHorizontal, href: href('more') },
];
const STUDENT_NAV: NavItem[] = [
  { key: 'home', label: 'Today', icon: Home, href: href('home') }, { key: 'progress', label: 'Progress', icon: TrendingUp, href: href('progress') },
  { key: 'history', label: 'Sessions', icon: HistoryIcon, href: href('history') }, { key: 'messages', label: 'Messages', icon: MessageCircle, href: href('messages') }, { key: 'me', label: 'My plan', icon: User, href: href('me') },
];
export function App() {
  return <><Main /><NewPassword /></>;
}
function Main() {
  const { user, org, loading } = useApp();
  const route = useRoute();
  const [page = '', sub, third] = route;
  if (page === 'apply' && sub) return <Apply orgId={sub} />;
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
