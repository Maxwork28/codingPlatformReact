import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { io } from "socket.io-client";
import axios from "axios";
import { Tab } from "@headlessui/react";
import StudentQuestionCard from "../components/StudentQuestionCard";
import { API_BASE_URL } from "../../../common/constants";
import { listClassExams } from "../../../common/services/api";
import { fetchClasses } from "../../../common/components/redux/classSlice";

const socket = io(`${API_BASE_URL}/`, {
  withCredentials: true,
});

/** Compare Mongo/ObjectId/string ids safely */
const idEq = (a, b) => {
  if (a == null || b == null) return false;
  return String(a) === String(b);
};

/** Question.classes[] entry may use classId as id string or populated { _id } */
const matchesClassEntry = (c, classId) => {
  if (!c || !classId) return false;
  const cid = c.classId;
  return idEq(cid, classId) || idEq(cid?._id, classId);
};

const isEnrolledInClass = (cls, userId) => {
  if (!cls || !userId) return false;
  const list = cls.students || [];
  return list.some((s) => idEq(s?._id ?? s, userId));
};

const StudentClassView = () => {
  const { classId } = useParams();
  const dispatch = useDispatch();
  const { classes, status: classesStatus, error: classesFetchError } = useSelector(
    (state) => state.classes
  );
  const { user } = useSelector((state) => state.auth);
  const [classData, setClassData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(null);
  const [leaderboardSearch, setLeaderboardSearch] = useState("");

  // Log initial render state
  console.log("[StudentClassView] Rendered", {
    classId,
    classesCount: classes.length,
    classesStatus,
    user: user ? { id: user.id, name: user.name, role: user.role } : null,
  });

  useEffect(() => {
    if (user?.id && classesStatus === "idle") {
      dispatch(fetchClasses(""));
    }
  }, [dispatch, user?.id, classesStatus]);

  useEffect(() => {
    // Log useEffect trigger
    console.log("[StudentClassView] useEffect triggered", {
      classId,
      classes: classes.map((c) => ({ id: c._id, name: c.name })),
      userId: user?.id,
    });

    // Fetch assignments for the class
    const fetchAssignments = async () => {
      console.log("[StudentClassView] Fetching assignments for class", {
        classId,
      });
      try {
        const response = await axios.get(
          `${API_BASE_URL}/admin/classes/${classId}/assignments`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        const assignmentsArray = Array.isArray(response.data.assignments)
          ? response.data.assignments
          : Array.isArray(response.data)
          ? response.data
          : [];
        console.log("[StudentClassView] Assignments fetched", {
          classId,
          assignmentCount: assignmentsArray.length,
          assignments: assignmentsArray,
        });
        setAssignments(assignmentsArray);
      } catch (err) {
        console.error("[StudentClassView] Failed to fetch assignments", {
          classId,
          error: err.message,
          response: err.response
            ? { status: err.response.status, data: err.response.data }
            : null,
        });
        setMessage(
          err.response?.data?.message || "Could not load assignments (try refresh)."
        );
      }
    };

    // Fetch exams for the class
    const fetchExams = async () => {
      if (!classId) return;
      try {
        setExamsLoading(true);
        const response = await listClassExams(classId);
        // Filter out draft and archived exams - students shouldn't see them
        const allExams = response.data.exams || [];
        const visibleExams = allExams.filter(exam => 
          exam.status !== 'draft' && exam.status !== 'archived'
        );
        setExams(visibleExams);
        setExamsLoading(false);
      } catch (error) {
        console.error("Failed to fetch exams:", error);
        setExamsLoading(false);
      }
    };

    // Fetch leaderboard for the class
    const fetchLeaderboard = async () => {
      console.log("[StudentClassView] Fetching leaderboard for class", {
        classId,
      });
      try {
        const response = await axios.get(
          `${API_BASE_URL}/questions/classes/${classId}/leaderboard`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        console.log("[StudentClassView] Leaderboard fetched", {
          classId,
          leaderboardCount: response.data.leaderboard?.length || 0,
          leaderboard: response.data.leaderboard,
        });
        setLeaderboard(response.data.leaderboard || []);
      } catch (err) {
        console.error("[StudentClassView] Failed to fetch leaderboard", {
          classId,
          error: err.message,
          errorResponse: err.response?.data,
          status: err.response?.status,
          fullError: err,
        });
        // Set empty leaderboard on error
        setLeaderboard([]);
      }
    };

    // Wait for class list from Redux (avoids false "not enrolled" on refresh / deep link)
    if (classesStatus === "idle" || classesStatus === "loading") {
      setLoading(true);
      setError(null);
      return;
    }

    if (classesStatus === "failed") {
      setClassData(null);
      setError(classesFetchError || "Failed to load classes.");
      setLoading(false);
      return;
    }

    // classesStatus === 'succeeded'
    const cls = classes.find((c) => idEq(c._id, classId));
    const enrolled = cls && isEnrolledInClass(cls, user?.id);

    if (cls && enrolled) {
      console.log("[StudentClassView] Class found and user authorized", {
        classId,
        className: cls.name,
        studentCount: cls.students?.length ?? 0,
        questionCount: cls.questions?.length ?? 0,
        userId: user.id,
      });
      const qs = Array.isArray(cls.questions) ? cls.questions : [];
      const updatedQuestions = qs.map((q) => {
        const classInfo = (q.classes || []).find((c) => matchesClassEntry(c, classId));
        console.log("[StudentClassView] Processing question", {
          questionId: q._id,
          questionTitle: q.title,
          isPublished: classInfo?.isPublished,
          isDisabled: classInfo?.isDisabled,
        });
        return {
          ...q,
          isPublished: classInfo ? classInfo.isPublished : false,
          isDisabled: classInfo ? classInfo.isDisabled : false,
        };
      });
      setError(null);
      setClassData({
        ...cls,
        questions: updatedQuestions,
      });
      fetchAssignments();
      fetchExams();
      fetchLeaderboard();
    } else {
      console.warn(
        "[StudentClassView] Class not found or user not authorized",
        {
          classId,
          classes: classes.map((c) => c._id),
          userId: user?.id,
          isEnrolled: enrolled,
        }
      );
      setClassData(null);
      setError(
        !cls
          ? "Class not found or you do not have access."
          : "You are not enrolled in this class."
      );
    }
    setLoading(false);

    if (!(cls && enrolled)) {
      return () => {
        socket.off("questionPublished");
        socket.off("questionDisabled");
        socket.off("questionDeleted");
        socket.off("questionUpdated");
        if (classId) socket.emit("leaveClass", classId);
      };
    }

    // Join socket room for class
    console.log("[StudentClassView] Emitting joinClass", { classId });
    socket.emit("joinClass", classId);

    // Socket event listeners
    socket.on("questionPublished", ({ questionId, isPublished }) => {
      console.log("[StudentClassView] questionPublished event", {
        questionId,
        isPublished,
      });
      setClassData((prev) => {
        if (!prev) {
          console.warn(
            "[StudentClassView] No classData for questionPublished",
            { questionId }
          );
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          idEq(q._id, questionId)
            ? {
                ...q,
                isPublished,
                classes: (q.classes || []).map((c) =>
                  matchesClassEntry(c, classId) ? { ...c, isPublished } : c
                ),
              }
            : q
        );
        console.log(
          "[StudentClassView] Updated classData for questionPublished",
          {
            questionId,
            updatedQuestions: updatedQuestions.map((q) => ({
              id: q._id,
              isPublished: q.isPublished,
            })),
          }
        );
        return { ...prev, questions: updatedQuestions };
      });
      setMessage(`Question ${isPublished ? "published" : "unpublished"}`);
      setTimeout(() => setMessage(""), 3000);
    });

    socket.on("questionDisabled", ({ questionId, isDisabled }) => {
      console.log("[StudentClassView] questionDisabled event", {
        questionId,
        isDisabled,
      });
      setClassData((prev) => {
        if (!prev) {
          console.warn("[StudentClassView] No classData for questionDisabled", {
            questionId,
          });
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          idEq(q._id, questionId)
            ? {
                ...q,
                isDisabled,
                classes: (q.classes || []).map((c) =>
                  matchesClassEntry(c, classId) ? { ...c, isDisabled } : c
                ),
              }
            : q
        );
        console.log(
          "[StudentClassView] Updated classData for questionDisabled",
          {
            questionId,
            updatedQuestions: updatedQuestions.map((q) => ({
              id: q._id,
              isDisabled: q.isDisabled,
            })),
          }
        );
        return { ...prev, questions: updatedQuestions };
      });
      setMessage(`Question ${isDisabled ? "disabled" : "enabled"}`);
      setTimeout(() => setMessage(""), 3000);
    });

    socket.on("questionDeleted", ({ questionId }) => {
      console.log("[StudentClassView] questionDeleted event", { questionId });
      setClassData((prev) => {
        if (!prev) {
          console.warn("[StudentClassView] No classData for questionDeleted", {
            questionId,
          });
          return prev;
        }
        const updatedQuestions = prev.questions.filter(
          (q) => !idEq(q._id, questionId)
        );
        console.log(
          "[StudentClassView] Updated classData for questionDeleted",
          {
            questionId,
            remainingQuestions: updatedQuestions.length,
          }
        );
        return { ...prev, questions: updatedQuestions };
      });
      setMessage("Question deleted");
      setTimeout(() => setMessage(""), 3000);
    });

    socket.on("questionUpdated", ({ questionId, updatedFields }) => {
      console.log("[StudentClassView] questionUpdated event", {
        questionId,
        updatedFields,
      });
      setClassData((prev) => {
        if (!prev) {
          console.warn("[StudentClassView] No classData for questionUpdated", {
            questionId,
          });
          return prev;
        }
        const updatedQuestions = prev.questions.map((q) =>
          idEq(q._id, questionId) ? { ...q, ...updatedFields } : q
        );
        console.log(
          "[StudentClassView] Updated classData for questionUpdated",
          {
            questionId,
            updatedFields,
            updatedQuestions: updatedQuestions.map((q) => ({
              id: q._id,
              title: q.title,
            })),
          }
        );
        return { ...prev, questions: updatedQuestions };
      });
      setMessage("Question updated");
      setTimeout(() => setMessage(""), 3000);
    });

    // Cleanup socket listeners
    return () => {
      console.log("[StudentClassView] Cleaning up socket listeners", {
        classId,
      });
      socket.off("questionPublished");
      socket.off("questionDisabled");
      socket.off("questionDeleted");
      socket.off("questionUpdated");
      socket.emit("leaveClass", classId);
    };
  }, [classId, user?.id, classes, classesStatus, classesFetchError]);

  // Log render state
  console.log("[StudentClassView] Rendering", {
    classId,
    classData: classData
      ? {
          id: classData._id,
          name: classData.name,
          questionCount: classData.questions.length,
        }
      : null,
    assignmentsCount: assignments.length,
    examsCount: exams.length,
    loading,
    error,
    message,
  });

  if (loading) {
    return (
      <div
        className="flex justify-center items-center py-16 backdrop-blur-sm rounded-xl shadow-lg"
        style={{ backgroundColor: "var(--card-white)" }}
      >
        <div
          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
          style={{
            borderColor: "var(--text-primary)",
            borderTopColor: "transparent",
          }}
        ></div>
      </div>
    );
  }

  if (error || !classData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg
            className="h-6 w-6 text-red-500 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-red-700 font-semibold">
            {error || "Class not found or you are not enrolled."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {message && (
        <div className="mb-6 p-4 rounded-xl bg-green-50/80 backdrop-blur-sm border border-green-200 shadow-sm">
          <p className="text-sm font-semibold text-green-800">{message}</p>
        </div>
      )}

      <div className="mb-10">
        <div className="flex justify-between items-start">
          <div>
            <h2
              className="text-3xl font-bold"
              style={{ color: "var(--text-heading)" }}
            >
              {classData.name}
            </h2>
            <p
              className="mt-2 text-lg font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {classData.description}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
            {classData.students?.length ?? 0} Students
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 shadow-sm">
            {assignments.length} Assignments
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 shadow-sm">
            {exams.length} Exams
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 shadow-sm">
            {classData.questions?.length ?? 0} question
            {(classData.questions?.length ?? 0) === 1 ? "" : "s"} attached
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tab.Group>
        <Tab.List
          className="flex gap-2 rounded-xl p-1.5 mb-8 border"
          style={{
            backgroundColor: "var(--background-light)",
            borderColor: "var(--card-border)",
          }}
        >
          {["Leaderboard", "Assignments", "Exams", "Questions"].map((tabName) => (
            <Tab key={tabName} className="flex-1">
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-3 px-4 text-sm font-semibold leading-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 text-center ${
                    selected ? "shadow-lg" : "hover:shadow"
                  }`}
                  style={{
                    backgroundColor: selected
                      ? "var(--accent-indigo)"
                      : "var(--card-white)",
                    color: "var(--text-primary)",
                    border: selected
                      ? "2px solid var(--accent-indigo)"
                      : "1px solid var(--card-border)",
                  }}
                >
                  {tabName}
                </button>
              )}
            </Tab>
          ))}
        </Tab.List>

        <Tab.Panels className="mt-2">
          {/* Leaderboard Tab */}
          <Tab.Panel className="rounded-xl p-3">
            <div
              className="backdrop-blur-sm rounded-2xl shadow-lg p-6 border transition-all duration-300 hover:shadow-xl"
              style={{
                backgroundColor: "var(--card-white)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <h3
                  className="text-xl font-semibold"
                  style={{ color: "var(--text-heading)" }}
                >
                  Class Leaderboard
                </h3>
              </div>

              {/* Search and Filter */}
              <div className="mb-6">
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={leaderboardSearch}
                      onChange={(e) => setLeaderboardSearch(e.target.value)}
                      placeholder="Search by student name..."
                      className="block w-full pl-10 pr-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all duration-200"
                      style={{
                        borderColor: "var(--card-border)",
                        backgroundColor: "var(--background-light)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  {leaderboardSearch && (
                    <button
                      onClick={() => setLeaderboardSearch("")}
                      className="px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-300"
                      style={{
                        color: "var(--text-primary)",
                        backgroundColor: "var(--card-white)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                // Filter leaderboard based on search
                const filteredLeaderboard = leaderboardSearch
                  ? leaderboard.filter((entry) => {
                      const studentName = (
                        entry.studentId?.name ||
                        entry.student?.name ||
                        entry.userId?.name ||
                        ""
                      ).toLowerCase();
                      return studentName.includes(
                        leaderboardSearch.toLowerCase()
                      );
                    })
                  : leaderboard;

                return filteredLeaderboard.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-14 w-14 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <h4
                      className="mt-3 text-base font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {leaderboardSearch
                        ? `No students found matching "${leaderboardSearch}"`
                        : "No leaderboard data available"}
                    </h4>
                    <p
                      className="mt-1 text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {leaderboardSearch
                        ? "Try a different search term"
                        : "Start submitting answers to appear on the leaderboard"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table
                      className="min-w-full divide-y"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <thead
                        style={{ backgroundColor: "var(--background-light)" }}
                      >
                        <tr>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Rank
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Student
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Total Score
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Submissions
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody
                        className="divide-y"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        {filteredLeaderboard.map((entry, index) => (
                          <tr
                            key={entry.studentId?._id || entry.studentId}
                            className="hover:bg-opacity-50 transition-colors"
                            style={{
                              backgroundColor:
                                index === 0
                                  ? "var(--background-light)"
                                  : "transparent",
                            }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {index === 0 && (
                                  <span className="text-2xl mr-2">🥇</span>
                                )}
                                {index === 1 && (
                                  <span className="text-2xl mr-2">🥈</span>
                                )}
                                {index === 2 && (
                                  <span className="text-2xl mr-2">🥉</span>
                                )}
                                <span
                                  className="text-sm font-medium"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {index + 1}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className="text-sm font-medium"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {entry.studentId?.name ||
                                  entry.student?.name ||
                                  entry.userId?.name ||
                                  "Unknown"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className="text-sm font-semibold"
                                style={{ color: "var(--accent-indigo)" }}
                              >
                                {entry.totalScore || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div
                                className="text-sm"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {entry.totalSubmits || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  entry.activityStatus === "active"
                                    ? "bg-green-100 text-green-800"
                                    : entry.activityStatus === "focused"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {entry.activityStatus || "inactive"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </Tab.Panel>

          {/* Assignments Tab */}
          <Tab.Panel className="rounded-xl p-3">
            <div className="flex justify-between items-center mb-6">
              <h3
                className="text-xl font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                Assignments
              </h3>
            </div>

            {assignments.length === 0 ? (
              <div
                className="backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border"
                style={{
                  backgroundColor: "var(--card-white)",
                  borderColor: "var(--card-border)",
                }}
              >
                <svg
                  className="mx-auto h-14 w-14 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h4
                  className="mt-3 text-base font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No assignments yet
                </h4>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Check back later for assignments from your teacher
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {assignments
                  .map((assignment) => {
                    const question = classData.questions.find((q) =>
                      idEq(q._id, assignment.questionId?._id || assignment.questionId)
                    );
                    const classInfo = question?.classes?.find((c) =>
                      matchesClassEntry(c, classId)
                    );
                    console.log("[StudentClassView] Rendering assignment", {
                      assignmentId: assignment._id,
                      questionId:
                        assignment.questionId?._id || assignment.questionId,
                      classId,
                      hasQuestion: !!question,
                      isPublished: classInfo?.isPublished,
                      isDisabled: classInfo?.isDisabled,
                      questionTitle: question?.title,
                    });
                    if (!question) {
                      console.warn(
                        "[StudentClassView] Question not found for assignment",
                        {
                          assignmentId: assignment._id,
                          questionId:
                            assignment.questionId?._id || assignment.questionId,
                          classId,
                        }
                      );
                      return null;
                    }
                    return {
                      assignment,
                      question,
                      classInfo,
                    };
                  })
                  .filter(Boolean)
                  .map(({ assignment, question, classInfo }) => {
                    const canSubmit =
                      classInfo?.isPublished && !classInfo?.isDisabled;
                    return (
                    <div
                      key={assignment._id}
                      className="backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
                      style={{
                        backgroundColor: "var(--card-white)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start gap-4">
                          <StudentQuestionCard
                            question={{
                              ...question,
                              isPublished: classInfo?.isPublished,
                              isDisabled: classInfo?.isDisabled,
                            }}
                            assignment={assignment}
                          />
                          <div className="ml-4 flex-shrink-0 flex flex-col items-end gap-2">
                            {!classInfo?.isPublished && (
                              <p className="text-xs text-right max-w-[200px]" style={{ color: "var(--text-secondary)" }}>
                                Your teacher has not published this question yet. You can open it after they publish it.
                              </p>
                            )}
                            {canSubmit ? (
                            <Link
                              to={`/student/questions/${
                                assignment.questionId?._id ||
                                assignment.questionId
                              }/submit`}
                              state={{ classId }}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 bg-indigo-600 hover:bg-indigo-700"
                              onClick={() =>
                                console.log(
                                  "[StudentClassView] Navigating to question submission",
                                  {
                                    questionId:
                                      assignment.questionId?._id ||
                                      assignment.questionId,
                                    classId,
                                  }
                                )
                              }
                            >
                              Submit Answer
                            </Link>
                            ) : classInfo?.isDisabled ? (
                              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-200 cursor-not-allowed">
                                Disabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-amber-900 bg-amber-100 border border-amber-200 cursor-not-allowed">
                                Not published yet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}
          </Tab.Panel>

          {/* Exams Tab */}
          <Tab.Panel className="rounded-xl p-3">
            <div className="flex justify-between items-center mb-6">
              <h3
                className="text-xl font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                Exams
              </h3>
              <Link
                to={`/student/classes/${classId}/exams`}
                className="text-sm text-blue-500 hover:underline"
              >
                View All Exams
              </Link>
            </div>

            {examsLoading ? (
              <div className="text-center py-8">
                <div
                  className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
                  style={{
                    borderColor: "var(--text-primary)",
                    borderTopColor: "transparent",
                  }}
                ></div>
                <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  Loading exams...
                </p>
              </div>
            ) : exams.length === 0 ? (
              <div
                className="backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border"
                style={{
                  backgroundColor: "var(--card-white)",
                  borderColor: "var(--card-border)",
                }}
              >
                <svg
                  className="mx-auto h-14 w-14 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h4
                  className="mt-3 text-base font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No exams available
                </h4>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Check back later for exams from your teacher
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {exams.map((exam) => (
                  <div
                    key={exam._id}
                    className="backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
                    style={{
                      backgroundColor: "var(--card-white)",
                      borderColor: "var(--card-border)",
                    }}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold mb-2" style={{ color: "var(--text-heading)" }}>
                            {exam.title}
                          </h4>
                          {exam.description && (
                            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
                              {exam.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mb-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {exam.proctoring?.durationMinutes || 0} minutes
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {exam.questions?.length || 0} questions
                            </span>
                            {exam.status && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                exam.status === 'active' ? 'bg-green-100 text-green-800' :
                                exam.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                                exam.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {exam.status}
                              </span>
                            )}
                          </div>
                          {exam.proctoring?.startTime && (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              Starts: {new Date(exam.proctoring.startTime).toLocaleString()}
                            </p>
                          )}
                          {exam.proctoring?.endTime && (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              Ends: {new Date(exam.proctoring.endTime).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {exam.studentAttemptStatus === 'in_progress' ? (
                            <Link
                              to={`/student/exams/${exam._id}/take`}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-300"
                            >
                              Continue Exam
                            </Link>
                          ) : (exam.studentAttemptStatus === 'submitted' || 
                                exam.studentAttemptStatus === 'auto_submitted' || 
                                exam.studentAttemptStatus === 'terminated') ? (
                            <Link
                              to={`/student/exams/${exam._id}/results`}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-300"
                            >
                              View Results
                            </Link>
                          ) : (exam.status === 'active' || 
                                (exam.status === 'scheduled' && exam.proctoring?.startTime && 
                                 new Date(exam.proctoring.startTime) <= new Date())) ? (
                            <Link
                              to={`/student/classes/${classId}/exams`}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                            >
                              Start Exam
                            </Link>
                          ) : (
                            <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 bg-gray-200 cursor-not-allowed">
                              Not Available
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Tab.Panel>

          {/* Questions Tab */}
          <Tab.Panel className="rounded-xl p-3">
            <div className="flex justify-between items-center mb-6">
              <h3
                className="text-xl font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                Attached Questions
              </h3>
            </div>

            {(classData.questions?.length ?? 0) === 0 ? (
              <div
                className="backdrop-blur-sm rounded-2xl shadow-lg p-8 text-center border"
                style={{
                  backgroundColor: "var(--card-white)",
                  borderColor: "var(--card-border)",
                }}
              >
                <svg
                  className="mx-auto h-14 w-14 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h4
                  className="mt-3 text-base font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  No attached questions yet
                </h4>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Check back later for questions from your teacher
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {classData.questions
                  .map((question) => {
                    const classInfo = (question.classes || []).find((c) =>
                      matchesClassEntry(c, classId)
                    );
                    console.log(
                      "[StudentClassView] Rendering attached question",
                      {
                        questionId: question._id,
                        questionTitle: question.title,
                        classId,
                        isPublished: classInfo?.isPublished,
                        isDisabled: classInfo?.isDisabled,
                      }
                    );
                    if (!classInfo) {
                      return null;
                    }
                    return {
                      question,
                      classInfo,
                    };
                  })
                  .filter(Boolean)
                  .map(({ question, classInfo }) => {
                    const canSubmit =
                      classInfo?.isPublished && !classInfo?.isDisabled;
                    return (
                    <div
                      key={question._id}
                      className="backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
                      style={{
                        backgroundColor: "var(--card-white)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      <div className="p-6">
                        <div className="flex justify-between items-start gap-4">
                          <StudentQuestionCard
                            question={{
                              ...question,
                              isPublished: classInfo?.isPublished,
                              isDisabled: classInfo?.isDisabled,
                            }}
                          />
                          <div className="ml-4 flex-shrink-0 flex flex-col items-end gap-2">
                            {!classInfo?.isPublished && (
                              <p className="text-xs text-right max-w-[200px]" style={{ color: "var(--text-secondary)" }}>
                                Your teacher has not published this question yet.
                              </p>
                            )}
                            {canSubmit ? (
                            <Link
                              to={`/student/questions/${question._id}/submit`}
                              state={{ classId }}
                              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 bg-indigo-600 hover:bg-indigo-700"
                              onClick={() =>
                                console.log(
                                  "[StudentClassView] Navigating to question submission",
                                  {
                                    questionId: question._id,
                                    classId,
                                  }
                                )
                              }
                            >
                              Submit Answer
                            </Link>
                            ) : classInfo?.isDisabled ? (
                              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-200 cursor-not-allowed">
                                Disabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-amber-900 bg-amber-100 border border-amber-200 cursor-not-allowed">
                                Not published yet
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    );
                  })}
              </div>
            )}
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
};

export default StudentClassView;
