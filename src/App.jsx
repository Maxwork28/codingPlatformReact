import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { validateToken } from './common/components/redux/authSlice';
import Navbar from './common/components/Navbar';
import ProtectedRoute from './common/components/ProtectedRoute';
import ErrorBoundary from './common/components/ErrorBoundary';
import NotFound from './common/components/NotFound';
import { ThemeProvider } from './common/context/ThemeProvider';
import { ToastProvider } from './common/ui/ToastProvider';
import { examReturnPath } from './common/utils/seb';

// Every page is a separate chunk; the shell (providers, navbar, route table) is all that ships up front.
// Public pages
const Login = lazy(() => import('./pannels/pages/Login'));
const ForgotPassword = lazy(() => import('./pannels/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pannels/pages/ResetPassword'));
const ChangePassword = lazy(() => import('./pannels/pages/ChangePassword'));

// Admin pages
const AdminDashboard = lazy(() => import('./pannels/admin/pages/AdminDashboard'));
const ClassManagement = lazy(() => import('./pannels/admin/pages/ClassManagement'));
const StudentManagement = lazy(() => import('./pannels/admin/pages/StudentManagement'));
const TeacherManagement = lazy(() => import('./pannels/admin/pages/TeacherManagement'));
const ExcelUpload = lazy(() => import('./pannels/admin/pages/ExcelUpload'));
const QuestionBank = lazy(() => import('./pannels/admin/pages/QuestionBank'));
const AdminCreateNewQuestion = lazy(() => import('./pannels/admin/pages/AdminCreateNewQuestion'));
const AdminClassDetails = lazy(() => import('./pannels/admin/pages/AdminClassDetails'));
const AdminQuestionEdit = lazy(() => import('./pannels/admin/components/AdminQuestionEdit.jsx'));
const AdminQuestionPreview = lazy(() => import('./pannels/admin/components/AdminQuestionPreview'));
const AdminDraftsPage = lazy(() => import('./pannels/admin/pages/AdminDraftsPage'));
const ExamManagement = lazy(() => import('./pannels/admin/pages/ExamManagement'));
const ExamReport = lazy(() => import('./pannels/admin/pages/ExamReport'));
const ExamBuilder = lazy(() => import('./pannels/admin/pages/ExamBuilder'));
const CreateExamTemplate = lazy(() => import('./pannels/admin/pages/CreateExamTemplate'));
const UseExamTemplate = lazy(() => import('./pannels/admin/pages/UseExamTemplate'));
const ExamTemplates = lazy(() => import('./pannels/admin/pages/ExamTemplates'));

// Teacher pages
const TakeClass = lazy(() => import('./pannels/teacher/pages/TakeClass'));
const QuestionStatistics = lazy(() => import('./pannels/teacher/pages/QuestionStatistics'));
const QuestionAttemptReview = lazy(() => import('./pannels/teacher/pages/QuestionAttemptReview'));
const QuestionStatement = lazy(() => import('./pannels/teacher/components/QuestionStatement.jsx'));
const QuestionSolution = lazy(() => import('./pannels/teacher/components/QuestionSolution.jsx'));
const QuestionTestCases = lazy(() => import('./pannels/teacher/components/QuestionTestCases.jsx'));

// Student pages
const StudentDashboard = lazy(() => import('./pannels/student/pages/StudentDashboard'));
const StudentClassView = lazy(() => import('./pannels/student/pages/StudentClassView'));
const StudentTakeClass = lazy(() => import('./pannels/student/pages/StudentTakeClass'));
const QuestionSubmission = lazy(() => import('./pannels/student/pages/QuestionSubmission'));
const Leaderboard = lazy(() => import('./pannels/student/pages/Leaderboard'));
const StudentExamList = lazy(() => import('./pannels/student/pages/StudentExamList'));
const StudentExamScreen = lazy(() => import('./pannels/student/pages/StudentExamScreen'));
const StudentExamResults = lazy(() => import('./pannels/student/pages/StudentExamResults'));

const ROLE_HOME = { admin: '/admin', teacher: '/teacher', student: '/student' };
const roleHome = (role) => ROLE_HOME[role] || '/login';

function PageSpinner({ fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center bg-page text-fg ${fullScreen ? 'min-h-screen' : 'h-full min-h-[40vh] w-full'}`}
      role="status"
      aria-label="Loading"
    >
      <div
        className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

function LegacyClassRedirect() {
  const { classId } = useParams();
  return <Navigate to={`/admin/classes/${classId}`} replace />;
}

function TeacherClassRedirect({ to }) {
  const { classId, questionId } = useParams();
  if (to === 'class') return <Navigate to={`/teacher/classes/${classId}`} replace />;
  if (to === 'questions') return <Navigate to={`/teacher/classes/${classId}?tab=questions`} replace />;
  return (
    <Navigate
      to={`/teacher/questions/${questionId}/preview`}
      replace
      state={{ classId, returnTo: `/teacher/classes/${classId}?tab=questions` }}
    />
  );
}

const isExamRunner = (pathname) => /^\/student\/exams\/[^/]+$/.test(pathname);

/** Routes for a signed-in user. `home` is the role dashboard used for `/`, `/login` and the 404 link. */
const MainContent = ({ home, mustChangePassword }) => {
  const { pathname, state: locationState } = useLocation();
  const examRunner = isExamRunner(pathname);

  // A forced password change blocks every other authenticated page until it is done.
  if (mustChangePassword && pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <main
      className="min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out"
      style={examRunner ? { height: '100vh' } : { height: 'calc(100vh - 4rem)' }}
    >
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Account */}
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/classes" element={<ProtectedRoute role="admin"><ClassManagement /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute role="admin"><StudentManagement /></ProtectedRoute>} />
          <Route path="/admin/teachers" element={<ProtectedRoute role="admin"><TeacherManagement /></ProtectedRoute>} />
          <Route path="/admin/upload" element={<ProtectedRoute role="admin"><ExcelUpload /></ProtectedRoute>} />
          <Route path="/admin/questions" element={<ProtectedRoute role="admin"><QuestionBank /></ProtectedRoute>} />
          <Route path="/admin/questions/create" element={<ProtectedRoute role="admin"><AdminCreateNewQuestion /></ProtectedRoute>} />
          <Route path="/admin/questions/new" element={<ProtectedRoute role="admin"><AdminCreateNewQuestion /></ProtectedRoute>} />
          <Route path="/admin/questions/drafts" element={<ProtectedRoute role="admin"><AdminDraftsPage /></ProtectedRoute>} />
          <Route path="/admin/questions/:questionId/preview" element={<ProtectedRoute role="admin"><AdminQuestionPreview /></ProtectedRoute>} />
          <Route path="/admin/questions/:questionId/edit" element={<ProtectedRoute role="admin"><AdminQuestionEdit /></ProtectedRoute>} />
          <Route path="/admin/class/:classId" element={<LegacyClassRedirect />} />
          <Route path="/admin/classes/:classId" element={<ProtectedRoute role="admin"><AdminClassDetails /></ProtectedRoute>} />

          {/* Admin Exam Routes */}
          <Route path="/admin/exams" element={<ProtectedRoute role="admin"><ExamManagement /></ProtectedRoute>} />
          <Route path="/admin/exams/templates" element={<ProtectedRoute role="admin"><ExamTemplates /></ProtectedRoute>} />
          <Route path="/admin/exams/templates/create" element={<ProtectedRoute role="admin"><CreateExamTemplate /></ProtectedRoute>} />
          <Route path="/admin/exams/templates/:templateId/use" element={<ProtectedRoute role="admin"><UseExamTemplate /></ProtectedRoute>} />
          <Route path="/admin/classes/:classId/exams" element={<ProtectedRoute role="admin"><ExamManagement /></ProtectedRoute>} />
          <Route path="/admin/classes/:classId/exams/create" element={<ProtectedRoute role="admin"><ExamBuilder /></ProtectedRoute>} />
          <Route path="/admin/classes/:classId/exams/:examId/edit" element={<ProtectedRoute role="admin"><ExamBuilder /></ProtectedRoute>} />
          <Route path="/admin/classes/:classId/exams/:examId/report" element={<ProtectedRoute role="admin"><ExamReport /></ProtectedRoute>} />

          {/* Teacher Routes */}
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/teacher/classes" element={<ProtectedRoute role="teacher"><ClassManagement /></ProtectedRoute>} />
          <Route path="/teacher/take-class" element={<ProtectedRoute role="teacher"><TakeClass /></ProtectedRoute>} />
          <Route path="/teacher/take-class/:classId/questions/:questionId/statistics" element={<ProtectedRoute role="teacher"><QuestionStatistics /></ProtectedRoute>} />
          <Route path="/teacher/take-class/:classId/questions/:questionId/statistics/attempts/:submissionId" element={<ProtectedRoute role="teacher"><QuestionAttemptReview /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId" element={<ProtectedRoute role="teacher"><AdminClassDetails /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/details" element={<ProtectedRoute role="teacher"><TeacherClassRedirect to="class" /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/edit" element={<ProtectedRoute role="teacher"><TeacherClassRedirect to="class" /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/questions/:questionId/edit" element={<ProtectedRoute role="teacher"><TeacherClassRedirect to="questions" /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/questions/:questionId" element={<ProtectedRoute role="teacher"><TeacherClassRedirect /></ProtectedRoute>} />
          <Route path="/teacher/questions" element={<ProtectedRoute role="teacher"><QuestionBank /></ProtectedRoute>} />
          <Route path="/teacher/questions/drafts" element={<ProtectedRoute role="teacher"><AdminDraftsPage /></ProtectedRoute>} />
          <Route path="/teacher/questions/create" element={<ProtectedRoute role="teacher"><AdminCreateNewQuestion /></ProtectedRoute>} />
          <Route path="/teacher/questions/new" element={<ProtectedRoute role="teacher"><AdminCreateNewQuestion /></ProtectedRoute>} />
          <Route path="/teacher/questions/:classId/create" element={<ProtectedRoute role="teacher"><AdminCreateNewQuestion /></ProtectedRoute>} />
          <Route path="/teacher/questions/assign" element={<ProtectedRoute role="teacher"><Navigate to="/teacher/questions" replace /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/edit" element={<ProtectedRoute role="teacher"><AdminQuestionEdit /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/statement" element={<ProtectedRoute role="teacher"><QuestionStatement /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/view" element={<ProtectedRoute role="teacher"><AdminQuestionPreview /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/preview" element={<ProtectedRoute role="teacher"><AdminQuestionPreview /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/solution" element={<ProtectedRoute role="teacher"><QuestionSolution /></ProtectedRoute>} />
          <Route path="/teacher/questions/:questionId/test-cases" element={<ProtectedRoute role="teacher"><QuestionTestCases /></ProtectedRoute>} />

          {/* Teacher Exam Routes */}
          <Route path="/teacher/exams" element={<ProtectedRoute role="teacher"><ExamManagement /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/exams" element={<ProtectedRoute role="teacher"><ExamManagement /></ProtectedRoute>} />
          <Route path="/teacher/exams/templates" element={<ProtectedRoute role="teacher"><ExamTemplates /></ProtectedRoute>} />
          <Route path="/teacher/exams/templates/create" element={<ProtectedRoute role="teacher"><CreateExamTemplate /></ProtectedRoute>} />
          <Route path="/teacher/exams/templates/:templateId/use" element={<ProtectedRoute role="teacher"><UseExamTemplate /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/exams/create" element={<ProtectedRoute role="teacher"><ExamBuilder /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/exams/:examId/edit" element={<ProtectedRoute role="teacher"><ExamBuilder /></ProtectedRoute>} />
          <Route path="/teacher/classes/:classId/exams/:examId/report" element={<ProtectedRoute role="teacher"><ExamReport /></ProtectedRoute>} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/take-class" element={<ProtectedRoute role="student"><StudentTakeClass /></ProtectedRoute>} />
          <Route path="/student/classes" element={<ProtectedRoute role="student"><StudentClassView /></ProtectedRoute>} />
          <Route path="/student/classes/:classId" element={<ProtectedRoute role="student"><StudentClassView /></ProtectedRoute>} />
          <Route path="/student/questions/:questionId/submit" element={<ProtectedRoute role="student"><QuestionSubmission /></ProtectedRoute>} />
          <Route path="/student/leaderboard/:classId" element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/classes/:classId/leaderboard" element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/leaderboard" element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/exams" element={<ProtectedRoute role="student"><StudentExamList /></ProtectedRoute>} />
          <Route path="/student/exams/:examId" element={<ProtectedRoute role="student"><StudentExamScreen /></ProtectedRoute>} />
          <Route path="/student/exams/:examId/results" element={<ProtectedRoute role="student"><StudentExamResults /></ProtectedRoute>} />

          {/* Signed-in users never see the public auth pages; send them to their dashboard. */}
          <Route path="/" element={<Navigate to={home} replace />} />
          {/* After signing in, a student who was sent to /login from an exam page (e.g. a fresh Safe Exam Browser session) returns to it. */}
          <Route path="/login" element={<Navigate to={(home === '/student' && examReturnPath(locationState?.from)) || home} replace />} />
          <Route path="/forgot-password" element={<Navigate to={home} replace />} />
          <Route path="/reset-password" element={<Navigate to={home} replace />} />
          <Route path="*" element={<NotFound homePath={home} />} />
        </Routes>
      </Suspense>
    </main>
  );
};

function AppRoutes() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { user, role, token, status } = useSelector((state) => state.auth);
  const examRunner = isExamRunner(location.pathname);
  const hasToken = Boolean(token || localStorage.getItem('token'));
  const sessionReady = Boolean(user?.name && hasToken);
  const restoringSession = hasToken && !user?.name && status !== 'failed';

  // Restore the session before mounting the dashboard so a stale token cannot
  // mark classes as unauthorized and leave that error after a fresh login.
  useEffect(() => {
    if (hasToken && token && !user?.name && status === 'idle') {
      dispatch(validateToken());
    }
  }, [dispatch, hasToken, token, user?.name, status]);

  useEffect(() => {
    if (role) document.documentElement.dataset.role = role;
    else delete document.documentElement.dataset.role;
  }, [role]);

  if (restoringSession) {
    return <PageSpinner fullScreen />;
  }

  // Signed out: only the public auth pages exist.
  if (!sessionReady) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }

  const home = roleHome(role || user?.role);
  const mustChangePassword = Boolean(user?.mustChangePassword);

  return (
    <div className="min-h-screen bg-page text-fg font-sans transition-all duration-300 flex flex-col">
      {examRunner ? null : <Navbar />}
      <div className="relative flex min-w-0 flex-1">
        <MainContent home={home} mustChangePassword={mustChangePassword} />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <Suspense fallback={<PageSpinner fullScreen />}>
            <AppRoutes />
          </Suspense>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
