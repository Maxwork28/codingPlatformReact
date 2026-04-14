import React, { Fragment, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Menu, Transition, Portal } from '@headlessui/react';
import { fetchClasses } from './redux/classSlice';
import { getDraftCount } from '../services/api';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/admin/classes', label: 'Classes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/admin/teachers', label: 'Teachers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { to: '/admin/students', label: 'Students', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { to: '/admin/upload', label: 'Data Import', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
  { to: '/admin/questions', label: 'Question Bank', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/admin/questions/drafts', label: 'Drafts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/admin/exams/templates', label: 'Exam Templates', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const teacherLinks = [
  { to: '/teacher', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/teacher/classes', label: 'My Classes', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { to: '/teacher/take-class', label: 'Take Class', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { to: '/teacher/questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/teacher/questions/drafts', label: 'Drafts', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { to: '/teacher/exams', label: 'Exams', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

const studentLinks = [
  { to: '/student', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { to: '/student/take-class', label: 'Practice Class', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { to: '/student/exams', label: 'Exams', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

function NavLinkRow({ link, draftCount, close }) {
  const badge =
    (link.to === '/admin/questions/drafts' || link.to === '/teacher/questions/drafts') &&
    draftCount > 0
      ? draftCount
      : null;

  return (
    <Menu.Item>
      {({ focus }) => (
        <NavLink
          to={link.to}
          end={link.to === '/admin' || link.to === '/teacher' || link.to === '/student'}
          onClick={close}
          className={({ isActive }) => {
            const base =
              'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-gray-200 ';
            if (isActive) return `${base} bg-[var(--accent-indigo)]/40 text-white`;
            if (focus) return `${base} bg-white/10`;
            return base;
          }}
        >
          <svg
            className="h-5 w-5 flex-shrink-0 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
          </svg>
          <span className="flex-1 font-medium">{link.label}</span>
          {badge != null && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </NavLink>
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
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm text-gray-300">Loading assignments…</p>
      </div>
    );
  }

  if (!cls.assignments || cls.assignments.length === 0) {
    return (
      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-sm text-gray-300">No assignments available</p>
      </div>
    );
  }

  const questionMatch = location.pathname.match(/\/student\/questions\/(?<questionId>[^/]+)\/submit/);
  const activeQ = questionMatch?.groups?.questionId;

  return (
    <div className="border-t border-white/10 pt-2">
      <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-white/50">{cls.name}</p>
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
                      ? 'bg-[var(--accent-indigo)]/40 text-white'
                      : focus
                        ? 'bg-white/10 text-gray-200'
                        : 'text-gray-200'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActiveQuestion ? 'bg-white text-indigo-600' : 'bg-gray-600 text-white'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{title}</p>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">{String(type).toUpperCase()}</p>
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
  const { role } = useSelector((state) => state.auth);
  const { classes, status } = useSelector((state) => state.classes || { classes: [], status: 'idle' });
  const dispatch = useDispatch();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    if (classes.length === 0 && status === 'idle') {
      dispatch(fetchClasses(''));
    }
  }, [dispatch, classes.length, status]);

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
      return () => clearInterval(interval);
    }
  }, [role]);

  const links =
    role === 'admin' ? adminLinks : role === 'teacher' ? teacherLinks : studentLinks;

  return (
    <Menu as="div" className="relative inline-block text-left">
      {({ open, close }) => (
        <>
          <Menu.Button
            type="button"
            className="inline-flex items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
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
                className="z-[100] mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,32rem)] overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/20 focus:outline-none"
                style={{
                  background: 'linear-gradient(180deg, var(--primary-navy) 0%, #1a252f 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Navigation</p>
                </div>
                <div className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
                  {links.map((link) => (
                    <NavLinkRow key={link.to} link={link} draftCount={draftCount} close={close} />
                  ))}
                  {role === 'student' && <StudentAssignmentsSection close={close} />}
                </div>
              </Menu.Items>
            </Portal>
          </Transition>
        </>
      )}
    </Menu>
  );
};

export default HeaderNavigationMenu;
