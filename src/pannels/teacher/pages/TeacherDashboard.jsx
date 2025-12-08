import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchClasses } from '../../../common/components/redux/classSlice';
import { listClassExams } from '../../../common/services/api';
import { FaBookOpen, FaClipboardList } from "react-icons/fa";

const TeacherDashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { classes, status, error } = useSelector((state) => state.classes);
  const { user } = useSelector((state) => state.auth);
  const [activeExams, setActiveExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState('');

  useEffect(() => {
    if (status === 'idle' && user) {
      console.log('%c[TeacherDashboard] Dispatching fetchClasses', 'color: orange;');
      dispatch(fetchClasses(''));
    }
  }, [status, dispatch, user]);

  const myClasses = classes.filter(
    (cls) => cls.teachers.some((t) => t._id === user.id) || cls.createdBy._id === user.id
  );

  // Fetch active exams for all teacher's classes
  useEffect(() => {
    const fetchActiveExams = async () => {
      const teacherClasses = classes.filter(
        (cls) => cls.teachers.some((t) => t._id === user?.id) || cls.createdBy._id === user?.id
      );

      if (teacherClasses.length === 0) {
        setActiveExams([]);
        setExamsLoading(false);
        return;
      }

      setExamsLoading(true);
      setExamsError('');
      
      try {
        const allExams = [];
        
        // Fetch exams for each class
        for (const cls of teacherClasses) {
          try {
            const response = await listClassExams(cls._id);
            const exams = (response.data.exams || []).map(exam => ({
              ...exam,
              className: cls.name,
              classId: cls._id
            }));
            allExams.push(...exams);
          } catch (err) {
            console.error(`[TeacherDashboard] Failed to fetch exams for class ${cls._id}:`, err);
          }
        }

        // Filter for active exams only
        const active = allExams.filter(exam => exam.status === 'active');
        setActiveExams(active);
      } catch (err) {
        console.error('[TeacherDashboard] Error fetching exams:', err);
        setExamsError(err.response?.data?.error || 'Failed to fetch exams');
      } finally {
        setExamsLoading(false);
      }
    };

    if (status === 'succeeded' && user) {
      fetchActiveExams();
    }
  }, [status, classes, user]);

  if (!user) {
    return (
      <div className="p-6">
        <p className="text-red-700 font-semibold text-center">You must be logged in to view this page.</p>
      </div>
    );
  }

  console.log('%c[TeacherDashboard]', 'color: blue;');
  console.log('User:', user);
  console.log('Classes:', classes);
  console.log('My Classes:', myClasses);
  console.log('Status:', status);
  console.log('Error:', error);
  console.log('Active Exams:', activeExams);

  return (
    <div className="p-3 pt-6">
      <div className="mb-6">
        <h2 className="tracking-tight" style={{ 
          color: 'var(--text-heading)', 
          fontSize: '28px', 
          fontWeight: '700',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
        }}>
          Teacher Dashboard
        </h2>
      </div>
      {status === 'loading' && (
        <div className="flex justify-center items-center py-12 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--background-light)' }}>
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--python-blue)', borderTopColor: 'transparent' }}></div>
        </div>
      )}
      {error && (
        <div className="flex items-center p-4 mb-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error loading classes</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      {status === 'succeeded' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Total Classes Card */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-lg p-4 shadow-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                  <FaBookOpen className="h-8 w-8" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Total Classes</p>
                  <p className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>{myClasses.length}</p>
                </div>
              </div>
              {myClasses.length === 0 && (
                <p className="mt-4 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                  You haven't been assigned to any classes yet.
                </p>
              )}
            </div>

            {/* Active Exams Card */}
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center">
                <div className="flex-shrink-0 rounded-lg p-4 shadow-sm" style={{ backgroundColor: 'var(--background-light)' }}>
                  <FaClipboardList className="h-8 w-8" style={{ color: 'var(--text-primary)' }} />
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Active Exams</p>
                  <p className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {examsLoading ? '...' : activeExams.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Exams List */}
          {examsError && (
            <div className="mb-6 flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
              <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800">Error loading exams</h3>
                <p className="mt-1 text-sm text-red-700">{examsError}</p>
              </div>
            </div>
          )}

          {examsLoading && (
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-8 mb-6" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <div className="flex justify-center items-center py-8">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--python-blue)', borderTopColor: 'transparent' }}></div>
                <span className="ml-3 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading active exams...</span>
              </div>
            </div>
          )}

          {!examsLoading && !examsError && (
            <div className="backdrop-blur-sm rounded-2xl shadow-lg border p-8 transition-all duration-300 hover:shadow-2xl" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Active Exams
                </h3>
                {activeExams.length > 0 && (
                  <button
                    onClick={() => navigate('/teacher/exams')}
                    className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    style={{ 
                      backgroundColor: 'var(--accent-indigo)', 
                      color: 'white' 
                    }}
                  >
                    View All Exams
                  </button>
                )}
              </div>

              {activeExams.length === 0 ? (
                <div className="text-center py-8">
                  <FaClipboardList className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    No active exams at the moment
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeExams.map((exam) => (
                    <div
                      key={exam._id}
                      className="p-6 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer"
                      style={{ 
                        backgroundColor: 'var(--background-light)', 
                        borderColor: 'var(--card-border)' 
                      }}
                      onClick={() => navigate(`/teacher/classes/${exam.classId}/exams/${exam._id}/report`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-heading)' }}>
                            {exam.title}
                          </h4>
                          <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                            {exam.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span className="inline-flex items-center">
                              <FaBookOpen className="h-3 w-3 mr-1" />
                              {exam.className}
                            </span>
                            <span>
                              Duration: {exam.proctoring?.durationMinutes || 0} minutes
                            </span>
                            <span>
                              Questions: {exam.questions?.length || 0}
                            </span>
                            {exam.proctoring?.startTime && (
                              <span>
                                Started: {new Date(exam.proctoring.startTime).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <span className="px-3 py-1 bg-green-500 text-white rounded-full text-xs font-semibold">
                            Active
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherDashboard;