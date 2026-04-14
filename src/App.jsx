import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { validateToken } from './common/components/redux/authSlice';
import Navbar from './common/components/Navbar';
import ProtectedRoute from './common/components/ProtectedRoute';
import { ThemeProvider } from './common/context/ThemeContext';

// Pages
import Login from './pannels/pages/Login';
import ForgotPassword from './pannels/pages/ForgotPassword';

// Admin Pages
import AdminDashboard from './pannels/admin/pages/AdminDashboard';
import ClassManagement from './pannels/admin/pages/ClassManagement';
import StudentManagement from './pannels/admin/pages/StudentManagement';
import TeacherManagement from './pannels/admin/pages/TeacherManagement';
import ExcelUpload from './pannels/admin/pages/ExcelUpload';
import QuesionBanks from './pannels/admin/pages/QuesionBanks';
import AdminCreateNewQuestion from './pannels/admin/pages/AdminCreateNewQuestion';
import AdminClassDetails from './pannels/admin/pages/AdminClassDetails';
import AdminQuestionEdit from './pannels/admin/components/AdminQuestionEdit.jsx';
import AdminQuestionPreview from './pannels/admin/components/AdminQuestionPreview';
import AdminDraftsPage from './pannels/admin/pages/AdminDraftsPage';
import TeacherDraftsPage from './pannels/teacher/pages/TeacherDraftsPage';
import ExamManagement from './pannels/admin/pages/ExamManagement';
import ExamReport from './pannels/admin/pages/ExamReport';
import CreateExam from './pannels/admin/pages/CreateExam';
import CreateExamTemplate from './pannels/admin/pages/CreateExamTemplate';
import UseExamTemplate from './pannels/admin/pages/UseExamTemplate';
import EditExam from './pannels/admin/pages/EditExam';
import ExamTemplates from './pannels/admin/pages/ExamTemplates';

// Teacher Pages
import TeacherDashboard from './pannels/teacher/pages/TeacherDashboard';
import TeacherClassManagement from './pannels/teacher/pages/TeacherClassManagement';
import TeacherClassView from './pannels/teacher/pages/TeacherClassView';
import TakeClass from './pannels/teacher/pages/TakeClass';
import ClassDetails from './pannels/teacher/pages/ClassDetails';
import ClassEdit from './pannels/teacher/pages/ClassEdit';
import QuestionManagement from './pannels/teacher/pages/QuestionManagement';
import CreateNewQuestion from './pannels/teacher/pages/CreateNewQuestion';
import QuestionAssignment from './pannels/teacher/pages/QuestionAssignment';
import QuestionEdit from '../src/pannels/teacher/components/QuestionEdit';
import QuestionStatement from '../src/pannels/teacher/components/QuestionStatement.jsx';
import QuestionPreview from '../src/pannels/teacher/components/QuestionPreview';
import QuestionSolution from '../src/pannels/teacher/components/QuestionSolution.jsx';
import QuestionTestCases from '../src/pannels/teacher/components/QuestionTestCases.jsx';
import QuestionView from './pannels/teacher/pages/QuestionView';
import TeacherQuestionDetail from './pannels/teacher/pages/TeacherQuestionDetail';
import TeacherExamManagement from './pannels/teacher/pages/TeacherExamManagement';

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
const MainContent = () => {
  return (
    <main
      className="min-w-0 flex-1 overflow-y-auto transition-all duration-300 ease-in-out"
      style={{
        height: 'calc(100vh - 64px)',
      }}
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
            <QuesionBanks />
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
        <Route path="/admin/class/:classId" element={
          <ProtectedRoute role="admin">
            <AdminClassDetails />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId" element={
          <ProtectedRoute role="admin">
            <AdminClassDetails />
          </ProtectedRoute>
        } />
        <Route
              path="/admin/questions/:questionId/edit"
              element={
                <ProtectedRoute role="admin">
                  <AdminQuestionEdit />
                </ProtectedRoute>
              }
            />


        {/* Teacher Routes */}
        <Route path="/teacher" element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes" element={
          <ProtectedRoute role="teacher">
            <TeacherClassManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/take-class" element={
          <ProtectedRoute role="teacher">
            <TakeClass />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId" element={
          <ProtectedRoute role="teacher">
            <TeacherClassView />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/details" element={
          <ProtectedRoute role="teacher">
            <ClassDetails />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/edit" element={
          <ProtectedRoute role="teacher">
            <ClassEdit />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions" element={
          <ProtectedRoute role="teacher">
            <QuestionManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/drafts" element={
          <ProtectedRoute role="teacher">
            <TeacherDraftsPage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/create" element={
          <ProtectedRoute role="teacher">
            <CreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/new" element={
          <ProtectedRoute role="teacher">
            <CreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/:classId/create" element={
          <ProtectedRoute role="teacher">
            <CreateNewQuestion />
          </ProtectedRoute>
        } />
        <Route path="/teacher/questions/assign" element={
          <ProtectedRoute role="teacher">
            <QuestionAssignment />
          </ProtectedRoute>
        } />
        <Route
              path="/teacher/questions/:questionId/edit"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionEdit />
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
                  <QuestionAssignment />
                </ProtectedRoute>
              }
            />
        <Route path="/teacher/questions/:questionId/view" element={
          <ProtectedRoute role="teacher">
            <QuestionView />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/questions/:questionId" element={
          <ProtectedRoute role="teacher">
            <TeacherQuestionDetail />
          </ProtectedRoute>
        } />
        <Route
              path="/teacher/questions/:questionId/preview"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionPreview />
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
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes/:classId/exams/:examId/edit" element={
          <ProtectedRoute role="admin">
            <EditExam />
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
            <TeacherExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams" element={
          <ProtectedRoute role="teacher">
            <ExamManagement />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams/create" element={
          <ProtectedRoute role="teacher">
            <CreateExam />
          </ProtectedRoute>
        } />
        <Route path="/teacher/classes/:classId/exams/:examId/edit" element={
          <ProtectedRoute role="teacher">
            <EditExam />
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
  const { user, token, status } = useSelector((state) => state.auth);
  const hasToken = token || localStorage.getItem('token');

  // Automatically fetch user details when app loads with a valid token
  useEffect(() => {
    if (hasToken && token && !user?.name && status === 'idle') {
      console.log('App: Auto-fetching user details');
      dispatch(validateToken());
    }
  }, [dispatch, hasToken, token, user?.name, status]);

  // If not authenticated, show login page
  if (!hasToken || !user) {
    return (
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ThemeProvider>
    );
  }

  // If authenticated, show appropriate dashboard based on role
  return (
    <ThemeProvider>
      <div className="min-h-screen transition-all duration-300 flex flex-col" style={{ backgroundColor: 'var(--background-content)' }}>
        <Navbar />
        <div className="relative flex min-w-0 flex-1">
          <MainContent />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;