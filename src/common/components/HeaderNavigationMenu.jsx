import React, { Fragment, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Menu, Transition, Portal } from '@headlessui/react';
import {
  Award,
  BookOpen,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Play,
  Users,
} from 'lucide-react';
import { fetchClasses } from './redux/classSlice';
import { getDraftCount } from '../services/api';
import { DRAFTS_CHANGED_EVENT } from '../ui/events';
import { inactiveTab, roleOf } from '../ui/format';

const linkIcons = {
  '/admin': LayoutDashboard,
  '/admin/classes': Users,
  '/admin/teachers': BookOpen,
  '/admin/students': GraduationCap,
  '/admin/upload': FileSpreadsheet,
  '/admin/questions': Layers,
  '/admin/questions/drafts': FileText,
  '/admin/exams': Award,
  '/teacher': LayoutDashboard,
  '/teacher/classes': Users,
  '/teacher/take-class': Play,
  '/teacher/questions': FileText,
  '/teacher/questions/drafts': FileText,
  '/teacher/exams': Award,
  '/student': LayoutDashboard,
  '/student/take-class': Play,
  '/student/exams': Award,
};

const adminLinks = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/classes', label: 'Classes' },
  { to: '/admin/teachers', label: 'Teachers' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/upload', label: 'Data Import' },
  { to: '/admin/questions', label: 'Question Bank' },
  { to: '/admin/questions/drafts', label: 'Drafts' },
  { to: '/admin/exams', label: 'Exams' },
];

const teacherLinks = [
  { to: '/teacher', label: 'Dashboard' },
  { to: '/teacher/classes', label: 'My Classes' },
  { to: '/teacher/take-class', label: 'Take Class' },
  { to: '/teacher/questions', label: 'Questions' },
  { to: '/teacher/questions/drafts', label: 'Drafts' },
  { to: '/teacher/exams', label: 'Exams' },
];

const studentLinks = [
  { to: '/student', label: 'Dashboard' },
  { to: '/student/take-class', label: 'Practice Class' },
  { to: '/student/exams', label: 'Exams' },
];

const ROLE_HOMES = new Set(['/admin', '/teacher', '/student']);

/**
 * The single nav link to highlight: the longest `to` that equals or prefixes the current path.
 * Role dashboards only match exactly, so unlisted pages don't light up Dashboard.
 */
function activeLinkFor(pathname, links) {
  return links
    .filter((link) => pathname === link.to || (!ROLE_HOMES.has(link.to) && pathname.startsWith(`${link.to}/`)))
    .reduce((best, link) => (!best || link.to.length > best.length ? link.to : best), null);
}

function NavLinkRow({ link, active, draftCount, close }) {
  const Icon = linkIcons[link.to] || Layers;
  const badge =
    (link.to === '/admin/questions/drafts' || link.to === '/teacher/questions/drafts') &&
    draftCount > 0
      ? draftCount
      : null;

  return (
    <Menu.Item>
      {({ focus }) => (
        <Link
          to={link.to}
          onClick={close}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors rounded-xl mx-1 ${
            active ? 'bg-accent-soft text-accent-ink' : focus ? 'text-fg bg-hover' : 'text-muted'
          }`}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 font-medium">{link.label}</span>
          {badge != null && (
            <span className="rounded-full bg-bad-soft border border-bad-line px-2 py-0.5 text-[10px] font-bold text-bad">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </Link>
      )}
    </Menu.Item>
  );
}

function StudentAssignmentsSection({ close }) {
  const { classes, status } = useSelector((state) => state.classes || { classes: [], status: 'idle' });
  const location = useLocation();
  const navigate = useNavigate();

  if (!location.pathname.startsWith('/student/questions/')) {
    return null;
  }

  let classId = null;
  let cls = null;
  const classMatch = location.pathname.match(/\/student\/classes\/(?<id>[^/]+)/);
  if (classMatch) {
    classId = classMatch.groups.id;
    cls = classes?.find?.((c) => c._id === classId);
  }
  if (!cls && location.pathname.startsWith('/student/questions/')) {
    const urlClassId = new URLSearchParams(location.search).get('classId');
    if (urlClassId) {
      cls = classes?.find?.((c) => c._id === urlClassId);
      classId = urlClassId;
    }
  }

  if (!cls) {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm text-muted">Loading assignments…</p>
      </div>
    );
  }

  if (!cls.assignments || cls.assignments.length === 0) {
    return (
      <div className="border-t border-line px-4 py-3">
        <p className="text-sm text-muted">No assignments available</p>
      </div>
    );
  }

  const questionMatch = location.pathname.match(/\/student\/questions\/(?<questionId>[^/]+)\/submit/);
  const activeQ = questionMatch?.groups?.questionId;

  return (
    <div className="border-t border-line pt-2">
      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{cls.name}</p>
      <div className="max-h-48 overflow-y-auto">
        {cls.assignments.map((a, idx) => {
          const qid = a.questionId?._id || a.questionId;
          const question = cls.questions.find((q) => q._id === qid);
          const title = question?.title || 'Untitled';
          const type = question?.type || 'Question';
          const isActiveQuestion = activeQ === String(qid);

          return (
            <Menu.Item key={a._id || qid}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/student/questions/${qid}/submit?classId=${classId}`);
                    close();
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isActiveQuestion
                      ? 'bg-accent-soft text-accent-ink'
                      : focus
                        ? 'bg-hover text-fg'
                        : 'text-body'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActiveQuestion ? 'bg-accent text-on-accent' : 'bg-hover text-muted'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{title}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted">{String(type).toUpperCase()}</p>
                  </div>
                </button>
              )}
            </Menu.Item>
          );
        })}
      </div>
    </div>
  );
}

const HeaderNavigationMenu = () => {
  const { token, role } = useSelector((state) => state.auth);
  const { status } = useSelector((state) => state.classes || { status: 'idle' });
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    if (status === 'idle' || status === 'failed') {
      dispatch(fetchClasses(''));
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (role === 'admin' || role === 'teacher') {
      const fetchDraftCount = async () => {
        try {
          const response = await getDraftCount();
          setDraftCount(response.data.count || 0);
        } catch {
          setDraftCount(0);
        }
      };
      fetchDraftCount();
      const interval = setInterval(fetchDraftCount, 30000);
      window.addEventListener(DRAFTS_CHANGED_EVENT, fetchDraftCount);
      return () => {
        clearInterval(interval);
        window.removeEventListener(DRAFTS_CHANGED_EVENT, fetchDraftCount);
      };
    }
  }, [role]);

  const links =
    role === 'admin' ? adminLinks : role === 'teacher' ? teacherLinks : studentLinks;

  const tone = roleOf(role);
  const activeTo = activeLinkFor(pathname, links);

  return (
    <>
    <nav className="hidden lg:flex flex-1 min-w-0 justify-center bg-surface p-1 rounded-xl border border-line items-center gap-0.5">
      {links.map((link) => {
        const Icon = linkIcons[link.to] || Layers;
        const badge =
          (link.to === '/admin/questions/drafts' || link.to === '/teacher/questions/drafts') && draftCount > 0
            ? draftCount
            : null;
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={activeTo === link.to ? 'page' : undefined}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-[11px] font-semibold transition whitespace-nowrap ${
              activeTo === link.to ? tone.tab : inactiveTab
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {link.label}
            {badge != null && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-bad-soft text-bad border border-bad-line">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
    <Menu as="div" className="relative inline-block text-left lg:hidden">
      {({ open, close }) => (
        <>
          <Menu.Button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Open navigation menu"
          >
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </Menu.Button>

          <Transition
            show={open}
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Portal>
              <Menu.Items
                anchor="bottom end"
                className="z-[100] mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,32rem)] overflow-hidden rounded-2xl shadow-2xl border border-line bg-surface focus:outline-none"
              >
                <div className="border-b border-line px-4 py-3">
                  <p className="text-sm font-semibold text-fg">Navigation</p>
                </div>
                <div className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
                  {links.map((link) => (
                    <NavLinkRow key={link.to} link={link} active={activeTo === link.to} draftCount={draftCount} close={close} />
                  ))}
                  {role === 'student' && <StudentAssignmentsSection close={close} />}
                </div>
              </Menu.Items>
            </Portal>
          </Transition>
        </>
      )}
    </Menu>
    </>
  );
};

export default HeaderNavigationMenu;
