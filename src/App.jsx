import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { validateToken } from './common/components/redux/authSlice'; // Adjust path
import Login from '../src/pannels/pages/Login.jsx';
import ForgotPassword from '../src/pannels/pages/ForgotPassword';
import AdminDashboard from '../src/pannels/admin/pages/AdminDashboard.jsx';
import ClassManagement from '../src/pannels/admin/pages/ClassManagement.jsx';
import TeacherManagement from '../src/pannels/admin/pages/TeacherManagement.jsx';
import StudentManagement from '../src/pannels/admin/pages/StudentManagement.jsx';
import TeacherDashboard from '../src/pannels/teacher/pages/TeacherDashboard.jsx';
import TeacherClassView from './pannels/teacher/pages/TeacherClassView.jsx';
import ClassDetails from './pannels/teacher/pages/ClassDetails.jsx';
import QuestionAssignment from '../src/pannels/teacher/pages/QuestionAssignment.jsx';
import QuestionManagement from '../src/pannels/teacher/pages/QuestionManagement.jsx';
import QuestionStatement from '../src/pannels/teacher/components/QuestionStatement.jsx';
import QuestionEdit from '../src/pannels/teacher/components/QuestionEdit';
import QuestionPreview from '../src/pannels/teacher/components/QuestionPreview';
import QuestionSolution from '../src/pannels/teacher/components/QuestionSolution.jsx';
import QuestionTestCases from '../src/pannels/teacher/components/QuestionTestCases.jsx';
import ClassEdit from '../src/pannels/teacher/pages/ClassEdit.jsx';
import CreateNewQuestion from '../src/pannels/teacher/pages/CreateNewQuestion.jsx';
import StudentDashboard from '../src/pannels/student/pages/StudentDashboard.jsx';
import StudentClassView from './pannels/student/pages/StudentClassView.jsx';
import QuestionSubmission from '../src/pannels/student/pages/QuestionSubmission.jsx';
import Leaderboard from '../src/pannels/student/pages/Leaderboard.jsx';
import ProtectedRoute from '../src/common/components/ProtectedRoute.jsx';
import Navbar from '../src/common/components/Navbar.jsx';
import Sidebar from '../src/common/components/Sidebar.jsx';
import ExcelUpload from '../src/pannels/admin/pages/ExcelUpload.jsx';
import AdminClassDetails from './pannels/admin/pages/AdminClassDetails.jsx';
import QuesionBanks from './pannels/admin/pages/QuesionBanks.jsx';
import AdminCreateNewQuestion from './pannels/admin/pages/AdminCreateNewQuestion.jsx';
import AdminQuestionEdit from './pannels/admin/components/AdminQuestionEdit.jsx';

function App() {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  // Validate token on app startup
  useEffect(() => {
    if (localStorage.getItem('token')) {
      dispatch(validateToken());
    }
  }, [dispatch]);

  console.log('[App] Rendered', { user });

  return (
    <div className="flex flex-col min-h-screen">
      {user && <Navbar />}
      <div className="flex flex-1">
        {user && <Sidebar />}
        <main className="flex-1 bg-gray-100">
          <Routes>
            {/* General Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/" element={<Navigate to="/login" />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/upload"
              element={
                <ProtectedRoute role="admin">
                  <ExcelUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute role="admin">
                  <ClassManagement />
                </ProtectedRoute>
              }
            />
             <Route
          path="/admin/class/:classId"
          element={
            <ProtectedRoute role="admin">
              <AdminClassDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/questions"
          element={
            <ProtectedRoute role="admin">
              <QuesionBanks />
            </ProtectedRoute>
          }
        />
         <Route
          path="/admin/questions/new"
          element={
            <ProtectedRoute role="admin">
              <AdminCreateNewQuestion/>
            </ProtectedRoute>
          }
        />
        
            <Route
              path="/admin/teachers"
              element={
                <ProtectedRoute role="admin">
                  <TeacherManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute role="admin">
                  <StudentManagement />
                </ProtectedRoute>
              }
            />

                  <Route
              path="/admin/questions/:questionId/edit"
              element={
                <ProtectedRoute role="admin">
                  <AdminQuestionEdit />
                </ProtectedRoute>
              }
            />

            {/* Teacher Routes */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes/:classId"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherClassView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes/:classId/details"
              element={
                <ProtectedRoute role="teacher">
                  <ClassDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes/:classId/edit"
              element={
                <ProtectedRoute role="teacher">
                  <ClassEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/questions/new"
              element={
                <ProtectedRoute role="teacher">
                  <CreateNewQuestion />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/questions"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionManagement />
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
            <Route
              path="/teacher/questions/:questionId/statement"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionStatement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/questions/:questionId/edit"
              element={
                <ProtectedRoute role="teacher">
                  <QuestionEdit />
                </ProtectedRoute>
              }
            />
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
            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/classes"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/classes/:classId"
              element={
                <ProtectedRoute role="student">
                  <StudentClassView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/questions/:questionId/submit"
              element={
                <ProtectedRoute role="student">
                  <QuestionSubmission />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/classes/:classId/leaderboard"
              element={
                <ProtectedRoute role="student">
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;