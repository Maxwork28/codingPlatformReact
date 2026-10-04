import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { validateToken } from './common/components/redux/authSlice';
import Navbar from './common/components/Navbar';
import ProtectedRoute from './common/components/ProtectedRoute';
import { ThemeProvider } from './common/context/ThemeContext';
import { ToastProvider } from './common/ui/Toast';

// Pages
import Login from './pannels/pages/Login';
import ForgotPassword from './pannels/pages/ForgotPassword';

// Admin Pages
import AdminDashboard from './pannels/admin/pages/AdminDashboard';
import ClassManagement from './pannels/admin/pages/ClassManagement';
import StudentManagement from './pannels/admin/pages/StudentManagement';
import TeacherManagement from './pannels/admin/pages/TeacherManagement';
import ExcelUpload from './pannels/admin/pages/ExcelUpload';
import QuestionBank from './pannels/admin/pages/QuestionBank';
import AdminCreateNewQuestion from './pannels/admin/pages/AdminCreateNewQuestion';
import AdminClassDetails from './pannels/admin/pages/AdminClassDetails';
import AdminQuestionEdit from './pannels/admin/components/AdminQuestionEdit.jsx';
import AdminQuestionPreview from './pannels/admin/components/AdminQuestionPreview';
import AdminDraftsPage from './pannels/admin/pages/AdminDraftsPage';
import ExamManagement from './pannels/admin/pages/ExamManagement';
import ExamReport from './pannels/admin/pages/ExamReport';
import ExamBuilder from './pannels/admin/pages/ExamBuilder';
import CreateExamTemplate from './pannels/admin/pages/CreateExamTemplate';
import UseExamTemplate from './pannels/admin/pages/UseExamTemplate';
import ExamTemplates from './pannels/admin/pages/ExamTemplates';

// Teacher Pages
import TakeClass from './pannels/teacher/pages/TakeClass';
import QuestionStatistics from './pannels/teacher/pages/QuestionStatistics';
import QuestionAttemptReview from './pannels/teacher/pages/QuestionAttemptReview';
import QuestionStatement from '../src/pannels/teacher/components/QuestionStatement.jsx';
import QuestionSolution from '../src/pannels/teacher/components/QuestionSolution.jsx';
import QuestionTestCases from '../src/pannels/teacher/components/QuestionTestCases.jsx';
// Student Pages
import StudentDashboard from './pannels/student/pages/StudentDashboard';
import StudentClassView from './pannels/student/pages/StudentClassView';
import StudentTakeClass from './pannels/student/pages/StudentTakeClass';
import QuestionSubmission from './pannels/student/pages/QuestionSubmission';
import Leaderboard from './pannels/student/pages/Leaderboard';
import StudentExamList from './pannels/student/pages/StudentExamList';
import StudentExamScreen from './pannels/student/pages/StudentExamScreen';
import StudentExamResults from './pannels/student/pages/StudentExamResults';

// Main content wrapper component
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

const MainContent = () => {
  const { pathname } = useLocation();
  const examRunner = isExamRunner(pathname);
  return (
    <main
      className="min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out"
      style={examRunner ? { height: '100vh' } : { height: 'calc(100vh - 4rem)' }}
    >
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes" element={
          <ProtectedRoute role="admin">
            <ClassManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute role="admin">
            <StudentManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/teachers" element={
          <ProtectedRoute role="admin">
            <TeacherManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/upload" element={
          <ProtectedRoute role="admin">
            <ExcelUpload />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions" element={
          <ProtectedRoute role="admin">
            <QuestionBank />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions/create" element={
          <ProtectedRoute role="admin">
            <AdminCreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions/new" element={
          <ProtectedRoute role="admin">
            <AdminCreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions/drafts" element={
          <ProtectedRoute role="admin">
            <AdminDraftsPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions/:questionId/preview" element={
          <ProtectedRoute role="admin">
            <AdminQuestionPreview />
          </ProtectedRoute>
        } />
        <Route path="/admin/questions/:questionId/edit" element={
          <ProtectedRoute role="admin">
            <AdminQuestionEdit />
          </ProtectedRoute>
        } />
        <Route path="/admin/class/:classId" element={<LegacyClassRedirect />} />
        <Route path="/admin/classes/:classId" element={
          <ProtectedRoute role="admin">
            <AdminClassDetails />
          </ProtectedRoute>
        } />
        {/* Teacher Routes */}
        <Route path="/teacher" element={
          <ProtectedRoute role="teacher">
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes" element={
          <ProtectedRoute role="teacher">
            <ClassManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/take-class" element={
          <ProtectedRoute role="teacher">
            <TakeClass />
          </ProtectedRoute>
        } />
        <Route path="/teacher/take-class/:classId/questions/:questionId/statistics" element={
          <ProtectedRoute role="teacher">
            <QuestionStatistics />
          </ProtectedRoute>
        } />
        <Route path="/teacher/take-class/:classId/questions/:questionId/statistics/attempts/:submissionId" element={
          <ProtectedRoute role="teacher">
            <QuestionAttemptReview />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId" element={
          <ProtectedRoute role="teacher">
            <AdminClassDetails />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/details" element={
          <ProtectedRoute role="teacher">
            <TeacherClassRedirect to="class" />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/edit" element={
          <ProtectedRoute role="teacher">
            <TeacherClassRedirect to="class" />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions" element={
          <ProtectedRoute role="teacher">
            <QuestionBank />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/drafts" element={
          <ProtectedRoute role="teacher">
            <AdminDraftsPage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/create" element={
          <ProtectedRoute role="teacher">
            <AdminCreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/new" element={
          <ProtectedRoute role="teacher">
            <AdminCreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/:classId/create" element={
          <ProtectedRoute role="teacher">
            <AdminCreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/assign" element={
          <ProtectedRoute role="teacher">
            <Navigate to="/teacher/questions" replace />
          </ProtectedRoute>
        } />
        <Route
              path="/teacher/questions/:questionId/edit"
              element={
                <ProtectedRoute role="teacher">
                  <AdminQuestionEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/questions/:questionId/statement"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionStatement />
                </ProtectedRoute>
              }
            />
        <Route
              path="/teacher/classes/:classId/questions/:questionId/edit"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherClassRedirect to="questions" />
                </ProtectedRoute>
              }
            />
        <Route path="/teacher/questions/:questionId/view" element={
          <ProtectedRoute role="teacher">
            <AdminQuestionPreview />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/questions/:questionId" element={
          <ProtectedRoute role="teacher">
            <TeacherClassRedirect />
          </ProtectedRoute>
        } />
        <Route
              path="/teacher/questions/:questionId/preview"
              element={
                <ProtectedRoute role="teacher">
                  <AdminQuestionPreview />
                </ProtectedRoute>
              }
            />
        <Route
              path="/teacher/questions/:questionId/solution"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionSolution />
                </ProtectedRoute>
              }
            />
        <Route
              path="/teacher/questions/:questionId/test-cases"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionTestCases />
                </ProtectedRoute>
              }
            />


        {/* Student Routes */}
        <Route path="/student" element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/student/take-class" element={
          <ProtectedRoute role="student">
            <StudentTakeClass />
          </ProtectedRoute>
        } />
        <Route path="/student/classes" element={
          <ProtectedRoute role="student">
            <StudentClassView />
          </ProtectedRoute>
        } />
        <Route path="/student/classes/:classId" element={
          <ProtectedRoute role="student">
            <StudentClassView />
          </ProtectedRoute>
        } />
        <Route path="/student/questions/:questionId/submit" element={
          <ProtectedRoute role="student">
            <QuestionSubmission />
          </ProtectedRoute>
        } />
        <Route path="/student/leaderboard/:classId" element={
          <ProtectedRoute role="student">
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/student/classes/:classId/leaderboard" element={
          <ProtectedRoute role="student">
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/student/leaderboard" element={
          <ProtectedRoute role="student">
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/student/exams" element={
          <ProtectedRoute role="student">
            <StudentExamList />
          </ProtectedRoute>
        } />
        <Route path="/student/exams/:examId" element={
          <ProtectedRoute role="student">
            <StudentExamScreen />
          </ProtectedRoute>
        } />
        <Route path="/student/exams/:examId/results" element={
          <ProtectedRoute role="student">
            <StudentExamResults />
          </ProtectedRoute>
        } />

        {/* Admin Exam Routes */}
        <Route path="/admin/exams" element={
          <ProtectedRoute role="admin">
            <ExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/exams/templates" element={
          <ProtectedRoute role="admin">
            <ExamTemplates />
          </ProtectedRoute>
        } />
        <Route path="/admin/exams/templates/create" element={
          <ProtectedRoute role="admin">
            <CreateExamTemplate />
          </ProtectedRoute>
        } />
        <Route path="/admin/exams/templates/:templateId/use" element={
          <ProtectedRoute role="admin">
            <UseExamTemplate />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId/exams" element={
          <ProtectedRoute role="admin">
            <ExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId/exams/create" element={
          <ProtectedRoute role="admin">
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId/exams/:examId/edit" element={
          <ProtectedRoute role="admin">
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId/exams/:examId/report" element={
          <ProtectedRoute role="admin">
            <ExamReport />
          </ProtectedRoute>
        } />

        {/* Teacher Exam Routes */}
        <Route path="/teacher/exams" element={
          <ProtectedRoute role="teacher">
            <ExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams" element={
          <ProtectedRoute role="teacher">
            <ExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams/templates" element={
          <ProtectedRoute role="teacher">
            <ExamTemplates />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams/templates/create" element={
          <ProtectedRoute role="teacher">
            <CreateExamTemplate />
          </ProtectedRoute>
        } />
        <Route path="/teacher/exams/templates/:templateId/use" element={
          <ProtectedRoute role="teacher">
            <UseExamTemplate />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams/create" element={
          <ProtectedRoute role="teacher">
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams/:examId/edit" element={
          <ProtectedRoute role="teacher">
            <ExamBuilder />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams/:examId/report" element={
          <ProtectedRoute role="teacher">
            <ExamReport />
          </ProtectedRoute>
        } />

        {/* Default redirect to login */}
        <Route path="/" element={
          <Navigate to="/login" replace />
        } />
        <Route path="*" element={
          <Navigate to="/login" replace />
        } />
      </Routes>
    </main>
  );
};

function App() {
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
      console.log('App: Auto-fetching user details');
      dispatch(validateToken());
    }
  }, [dispatch, hasToken, token, user?.name, status]);

  useEffect(() => {
    if (role) document.documentElement.dataset.role = role;
    else delete document.documentElement.dataset.role;
  }, [role]);

  if (restoringSession) {
    return (
      <ThemeProvider>
        <ToastProvider>
        <div className="flex min-h-screen items-center justify-center bg-page text-fg">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}
          />
        </div>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // If not authenticated, show login page
  if (!sessionReady) {
    return (
      <ThemeProvider>
        <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </ToastProvider>
      </ThemeProvider>
    );
  }

  // If authenticated, show appropriate dashboard based on role
  return (
    <ThemeProvider>
      <ToastProvider>
      <div className="min-h-screen bg-page text-fg font-sans transition-all duration-300 flex flex-col">
        {examRunner ? null : <Navbar />}
        <div className="relative flex min-w-0 flex-1">
          <MainContent />
        </div>
      </div>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;