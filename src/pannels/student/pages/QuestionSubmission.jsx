import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import {
  fetchQuestion,
  submitQuestionAnswer,
  runQuestionCode,
  runQuestionCodeWithCustomInput,
  resetSubmission,
} from '../../../common/components/redux/questionSlice';
import CodeEditor from '../components/CodeEditor';

// Socket.IO initialization
const socket = io('https://api.algosutra.co.in/', {
  withCredentials: true,
});

socket.on('connect', () => {
  console.log('[QuestionSubmission] Socket.IO connected successfully');
});

socket.on('connect_error', (error) => {
  console.error('[QuestionSubmission] Socket.IO connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('[QuestionSubmission] Socket.IO disconnected:', reason);
});

const QuestionSubmission = () => {
  const { questionId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const { question, submission, runResults, status, error } = useSelector((state) => state.questions);
  const [answer, setAnswer] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [customInput, setCustomInput] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  const [isQuestionActive, setIsQuestionActive] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [apiResponse, setApiResponse] = useState(null);

  const classId = location.state?.classId || (question?.classes?.length > 0 ? question.classes[0].classId : null);

  useEffect(() => {
    if (questionId) {
      console.log('[QuestionSubmission] Fetching question with ID:', questionId);
      dispatch(fetchQuestion(questionId)).then((result) => {
        console.log('[QuestionSubmission] fetchQuestion result:', result);
      });
      dispatch(resetSubmission());
    }
    return () => {
      dispatch(resetSubmission());
    };
  }, [dispatch, questionId]);

  useEffect(() => {
    if (question && classId) {
      console.log('[QuestionSubmission] Joining class:', classId);
      socket.emit('joinClass', classId);

      socket.on('questionPublished', ({ questionId: updatedId, isPublished }) => {
        if (updatedId === questionId) {
          const classData = question.classes.find((cls) => cls.classId === classId);
          const newActiveState = classData ? isPublished && !classData.isDisabled : false;
          console.log('[QuestionSubmission] Updating isQuestionActive:', newActiveState);
          setIsQuestionActive(newActiveState);
          setStatusMessage(`Question ${isPublished ? 'published' : 'unpublished'}`);
        }
      });

      socket.on('questionDisabled', ({ questionId: updatedId, isDisabled }) => {
        if (updatedId === questionId) {
          const classData = question.classes.find((cls) => cls.classId === classId);
          const newActiveState = classData ? classData.isPublished && !isDisabled : false;
          console.log('[QuestionSubmission] Updating isQuestionActive:', newActiveState);
          setIsQuestionActive(newActiveState);
          setStatusMessage(`Question ${isDisabled ? 'disabled' : 'enabled'}`);
        }
      });

      socket.on('questionDeleted', ({ questionId: updatedId }) => {
        if (updatedId === questionId) {
          setIsQuestionActive(false);
          setStatusMessage('Question deleted');
        }
      });

      socket.on('codeRun', ({ submissionId, isCorrect, passedTestCases, totalTestCases }) => {
        console.log('[QuestionSubmission] codeRun event:', { submissionId, isCorrect, passedTestCases, totalTestCases });
        setStatusMessage(`Run completed: ${passedTestCases}/${totalTestCases} test cases passed`);
      });

      socket.on('customInputRun', ({ submissionId, customInput, expectedOutput }) => {
        console.log('[QuestionSubmission] customInputRun event:', { submissionId, customInput, expectedOutput });
        setStatusMessage('Custom input run completed');
      });

      socket.on('submissionUpdate', ({ submissionId, isCorrect, passedTestCases, totalTestCases }) => {
        console.log('[QuestionSubmission] submissionUpdate event:', { submissionId, isCorrect, passedTestCases, totalTestCases });
        setStatusMessage(`Submission completed: ${passedTestCases}/${totalTestCases} test cases passed`);
      });

      return () => {
        if (classId) {
          console.log('[QuestionSubmission] Leaving class:', classId);
          socket.emit('leaveClass', classId);
        }
        socket.off('questionPublished');
        socket.off('questionDisabled');
        socket.off('questionDeleted');
        socket.off('codeRun');
        socket.off('customInputRun');
        socket.off('submissionUpdate');
      };
    }
  }, [question, classId, questionId]);

  useEffect(() => {
    if (statusMessage) {
      console.log('[QuestionSubmission] Status message set:', statusMessage);
      const timer = setTimeout(() => {
        console.log('[QuestionSubmission] Clearing status message');
        setStatusMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  useEffect(() => {
    if (question && classId) {
      const classData = question.classes.find((cls) => cls.classId === classId);
      if (classData) {
        const active = classData.isPublished && !classData.isDisabled;
        console.log('[QuestionSubmission] Setting isQuestionActive:', active);
        setIsQuestionActive(active);
      } else {
        console.log('[QuestionSubmission] Class not found for question');
        setIsQuestionActive(false);
        setStatusMessage('Class not found for this question');
      }
      if (question.type === 'coding' || question.type === 'fillInTheBlanksCoding') {
        const starterCode = question.starterCode?.find((sc) => sc.language === selectedLanguage);
        console.log('[QuestionSubmission] Setting starter code for', selectedLanguage, ':', starterCode?.code);
        setAnswer(starterCode?.code || question.codeSnippet || '');
      } else if (question.type === 'fillInTheBlanks') {
        setAnswer('');
      } else if (question.type === 'multipleCorrectMcq') {
        setAnswer([]);
      } else {
        setAnswer('');
      }
    } else if (!classId) {
      console.log('[QuestionSubmission] No classId provided');
      setIsQuestionActive(false);
      setStatusMessage('No class associated with this question');
    }
  }, [question, classId, selectedLanguage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isQuestionActive) {
      console.log('[QuestionSubmission] Submission blocked: Question is inactive');
      setStatusMessage('Cannot submit: Question is inactive');
      return;
    }
    if (!classId) {
      console.log('[QuestionSubmission] Submission blocked: classId is undefined');
      setStatusMessage('Cannot submit: No class associated with this question');
      return;
    }
    if ((question.type === 'coding' || question.type === 'fillInTheBlanksCoding') &&
        (!selectedLanguage || !question.languages.includes(selectedLanguage))) {
      console.log('[QuestionSubmission] Submission blocked: Invalid or undefined language', selectedLanguage);
      setStatusMessage('Cannot submit: No valid language selected');
      return;
    }
    if (question.type === 'fillInTheBlanks' && !answer.trim()) {
      console.log('[QuestionSubmission] Submission blocked: Empty answer for fill-in-the-blanks');
      setStatusMessage('Cannot submit: Answer cannot be empty');
      return;
    }
    if (question.type === 'fillInTheBlanksCoding' && !answer.trim()) {
      console.log('[QuestionSubmission] Submission blocked: Empty answer for fill-in-the-blanks coding');
      setStatusMessage('Cannot submit: Answer cannot be empty');
      return;
    }
    if ((question.type === 'singleCorrectMcq' || question.type === 'multipleCorrectMcq') &&
        !answer.length && answer !== '0') {
      console.log('[QuestionSubmission] Submission blocked: No option selected for MCQ');
      setStatusMessage('Cannot submit: Please select an option');
      return;
    }

    setIsSubmitting(true);
    setApiResponse(null);
    try {
      const submissionData = {
        questionId,
        classId,
        answer:
          question.type === 'fillInTheBlanks'
            ? answer
            : question.type === 'fillInTheBlanksCoding'
            ? answer
            : question.type === 'multipleCorrectMcq'
            ? answer.map((idx) => parseInt(idx))
            : question.type === 'singleCorrectMcq'
            ? parseInt(answer)
            : answer,
        language: question.type === 'coding' || question.type === 'fillInTheBlanksCoding' ? selectedLanguage : undefined,
        isRun: false,
      };
      console.log('[QuestionSubmission] Submitting answer:', submissionData);
      const result = await dispatch(submitQuestionAnswer(submissionData)).unwrap();
      console.log('[QuestionSubmission] Submission result:', result.passedTestCases);
      // Normalize response: move top-level passedTestCases/totalTestCases to submission
      const normalizedSubmission = {
        ...result.submission,
        passedTestCases: result.passedTestCases ?? result.submission.passedTestCases ?? 0,
        totalTestCases: result.totalTestCases ?? result.submission.totalTestCases ?? 0,
        explanation: result.explanation ?? result.submission.explanation,
      };
      setApiResponse({
        message: `Submission completed: ${normalizedSubmission.passedTestCases}/${normalizedSubmission.totalTestCases} test cases passed`,
        submission: normalizedSubmission,
        type: 'submission',
      });
      setStatusMessage(`Submission completed: ${normalizedSubmission.passedTestCases}/${normalizedSubmission.totalTestCases} test cases passed`);
    } catch (err) {
      console.error('[QuestionSubmission] Submission error:', err);
      setApiResponse({
        message: `Submission failed: ${err.message || 'Unknown error'}`,
        error: true,
      });
      setStatusMessage(`Submission failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunCode = async () => {
    if (!isQuestionActive) {
      console.log('[QuestionSubmission] Code run blocked: Question is inactive');
      setStatusMessage('Cannot run code: Question is inactive');
      return;
    }
    if (question.type !== 'coding' && question.type !== 'fillInTheBlanksCoding') {
      console.log('[QuestionSubmission] Code run blocked: Not a coding question');
      setStatusMessage('Run is only available for coding questions');
      return;
    }
    if (!classId) {
      console.log('[QuestionSubmission] Code run blocked: classId is undefined');
      setStatusMessage('Cannot run code: No class associated with this question');
      return;
    }
    if (!selectedLanguage || !question.languages.includes(selectedLanguage)) {
      console.log('[QuestionSubmission] Code run blocked: Invalid or undefined language', selectedLanguage);
      setStatusMessage('Cannot run code: No valid language selected');
      return;
    }
    if (!answer.trim()) {
      console.log('[QuestionSubmission] Code run blocked: Empty code');
      setStatusMessage('Cannot run code: Code cannot be empty');
      return;
    }
    setIsRunning(true);
    setApiResponse(null);
    try {
      console.log('[QuestionSubmission] Running code:', { questionId, answer, classId, language: selectedLanguage });
      const result = await dispatch(
        runQuestionCode({
          questionId,
          answer,
          classId,
          language: selectedLanguage,
          isRun: true,
        })
      ).unwrap();
      console.log('[QuestionSubmission] Run code result:', result);
      setApiResponse({
        message: 'Code run successfully',
        submission: result.submission,
        testResults: result.testResults,
        type: 'run',
      });
      setStatusMessage(`Run completed: ${result.submission.passedTestCases}/${result.submission.totalTestCases} test cases passed`);
    } catch (err) {
      console.error('[QuestionSubmission] Run code error:', err);
      setApiResponse({
        message: `Run failed: ${err.message || 'Unknown error'}`,
        error: true,
      });
      setStatusMessage(`Run failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunCodeWithCustomInput = async () => {
    if (!isQuestionActive) {
      console.log('[QuestionSubmission] Custom input run blocked: Question is inactive');
      setStatusMessage('Cannot run code: Question is inactive');
      return;
    }
    if (question.type !== 'coding' && question.type !== 'fillInTheBlanksCoding') {
      console.log('[QuestionSubmission] Custom input run blocked: Not a coding question');
      setStatusMessage('Run is only available for coding questions');
      return;
    }
    if (!classId) {
      console.log('[QuestionSubmission] Custom input run blocked: classId is undefined');
      setStatusMessage('Cannot run code: No class associated with this question');
      return;
    }
    if (!selectedLanguage || !question.languages.includes(selectedLanguage)) {
      console.log('[QuestionSubmission] Custom input run blocked: Invalid or undefined language', selectedLanguage);
      setStatusMessage('Cannot run code: No valid language selected');
      return;
    }
    if (!customInput.trim()) {
      console.log('[QuestionSubmission] Custom input run blocked: No custom input provided');
      setStatusMessage('Please provide a valid custom input');
      return;
    }
    if (!customInput.match(/^\[\s*-?\d+(\s*,\s*-?\d+)*\s*\]$/)) {
      console.log('[QuestionSubmission] Custom input run blocked: Invalid array format');
      setStatusMessage('Custom input must be a valid array (e.g., [1, 2, 3])');
      return;
    }
    if (expectedOutput && typeof expectedOutput !== 'string') {
      console.log('[QuestionSubmission] Custom input run blocked: Invalid expected output');
      setStatusMessage('Expected output must be a string');
      return;
    }
    setIsRunningCustom(true);
    setApiResponse(null);
    try {
      console.log('[QuestionSubmission] Running code with custom input:', {
        questionId,
        answer,
        classId,
        language: selectedLanguage,
        customInput,
        expectedOutput,
      });
      const result = await dispatch(
        runQuestionCodeWithCustomInput({
          questionId,
          answer,
          classId,
          language: selectedLanguage,
          customInput,
          expectedOutput,
          isRun: true,
        })
      ).unwrap();
      console.log('[QuestionSubmission] Run code with custom input result:', result);
      setApiResponse({
        message: 'Code run with custom input successfully',
        submission: result.submission,
        testResults: result.testResults,
        type: 'customRun',
      });
      setStatusMessage(`Custom input run ${result.testResults.passed ? 'passed' : 'failed'}`);
    } catch (err) {
      console.error('[QuestionSubmission] Run code with custom input error:', err);
      setApiResponse({
        message: `Custom input run failed: ${err.message || 'Unknown error'}`,
        error: true,
      });
      setStatusMessage(`Custom input run failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRunningCustom(false);
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    console.log('[QuestionSubmission] Language changed to:', newLanguage);
    setSelectedLanguage(newLanguage);
    if (question?.type === 'coding' || question?.type === 'fillInTheBlanksCoding') {
      const starterCode = question.starterCode?.find((sc) => sc.language === newLanguage);
      console.log('[QuestionSubmission] Starter code for', newLanguage, ':', starterCode?.code);
      setAnswer(starterCode?.code || question.codeSnippet || '');
    }
  };

  const renderTestCaseResults = (results, source = 'submission') => {
    console.log('[QuestionSubmission] Rendering test case results:', { results, source });

    if (question?.type && ['singleCorrectMcq', 'multipleCorrectMcq', 'fillInTheBlanks'].includes(question.type)) {
      const isCorrect = apiResponse?.submission?.isCorrect ?? submission?.isCorrect ?? false;
      const explanation = apiResponse?.submission?.explanation ?? submission?.explanation ?? question.explanation ?? '';
      const submittedAnswer = apiResponse?.submission?.output ?? submission?.output ?? '';
      const passedTestCases = apiResponse?.submission?.passedTestCases ?? submission?.passedTestCases ?? (isCorrect ? 1 : 0);
      const totalTestCases = apiResponse?.submission?.totalTestCases ?? submission?.totalTestCases ?? 1;

      console.log('[QuestionSubmission] Rendering non-coding question result:', { isCorrect, explanation, submittedAnswer, passedTestCases, totalTestCases });

      return (
        <div className="mt-4 p-4 rounded-xl border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Submission Result</h3>
          <div className={`flex items-center p-4 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className={`flex-shrink-0 h-6 w-6 ${isCorrect ? 'text-green-500' : 'text-red-500'}`}>
              {isCorrect ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zm3.707-9.293a1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 0 00-1.414 1.414l2 2a1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-semibold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
              </p>
              <p className="text-sm text-gray-600 mt-2">Test Cases Passed: {passedTestCases}/{totalTestCases}</p>
              {(apiResponse?.submission?.score !== undefined || submission?.score !== undefined) && (
                <p className="text-sm text-gray-600 mt-2">Score: {apiResponse?.submission?.score ?? submission?.score ?? 0}</p>
              )}
              {(apiResponse?.submission?.submittedAt || submission?.submittedAt) && (
                <p className="text-sm text-gray-600 mt-2">
                  Submitted At: {new Date(apiResponse?.submission?.submittedAt ?? submission?.submittedAt).toLocaleString()}
                </p>
              )}
              {question.type === 'fillInTheBlanks' && (
                <p className="text-sm text-gray-600 mt-2">Your Answer: {submittedAnswer}</p>
              )}
              {explanation && (
                <p className="text-sm text-gray-600 mt-2">Explanation: {explanation}</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Normalize results to always be an array
    let resultArray = [];
    if (!results) {
      console.log('[QuestionSubmission] No valid results to render');
      return (
        <div className="mt-4 p-4 bg-yellow-50 rounded-xl shadow-sm border border-yellow-200">
          <p className="text-sm text-yellow-700 font-semibold">No test case results available</p>
        </div>
      );
    } else if (Array.isArray(results)) {
      resultArray = results;
    } else if (typeof results === 'object') {
      resultArray = [results]; // Wrap single object in an array
    } else {
      console.log('[QuestionSubmission] Invalid results format:', results);
      return (
        <div className="mt-4 p-4 bg-yellow-50 rounded-xl shadow-sm border border-yellow-200">
          <p className="text-sm text-yellow-700 font-semibold">Invalid test case results format</p>
        </div>
      );
    }

    const passedTestCases = apiResponse?.submission?.passedTestCases ?? submission?.passedTestCases ?? 0;
    const totalTestCases = apiResponse?.submission?.totalTestCases ?? submission?.totalTestCases ?? 0;

    return (
      <div className="mt-4 space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">
          {source === 'run' ? 'Run Results' : source === 'customRun' ? 'Custom Input Results' : 'Test Results'}
        </h3>
        <div className="space-y-4">
          {resultArray.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} shadow-sm`}
            >
              <div className="flex items-start">
                <div className={`flex-shrink-0 h-6 w-6 ${result.passed ? 'text-green-500' : 'text-red-500'}`}>
                  {result.passed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zm3.707-9.293a1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 0 00-1.414 1.414l2 2a1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {source === 'customRun' ? 'Custom Input Result' : `Test Case ${index + 1}: `}
                    <span className={result.passed ? 'text-green-700' : 'text-red-700'}>{result.passed ? 'Passed' : 'Failed'}</span>
                  </h4>
                  {result.error && (
                    <div className="mt-2 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Error</p>
                      <pre className="text-sm p-2 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap break-words text-red-600">
                        {result.error}
                      </pre>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Input</p>
                      <pre className="text-sm p-2 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {typeof result.input === 'string' ? result.input : JSON.stringify(result.input, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Output</p>
                      <pre className="text-sm p-2 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected</p>
                      <pre className="text-sm p-2 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap break-words">
                        {typeof result.expected === 'string' ? result.expected : JSON.stringify(result.expected, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {source === 'submission' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-800">
                Test Cases Passed: {passedTestCases}/{totalTestCases}
              </p>
              <p className="text-sm text-blue-800 mt-2">Score: {apiResponse?.submission?.score ?? submission?.score ?? 0}</p>
            </div>
          )}
          {source === 'run' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-800">
                Public Test Cases Passed: {passedTestCases}/{totalTestCases}
              </p>
              <p className="text-sm text-blue-800 mt-2">Note: No score is assigned for running code.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (status === 'loading') {
    console.log('[QuestionSubmission] Rendering loading state');
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    console.log('[QuestionSubmission] Rendering error state:', error);
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50 rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700 font-semibold">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!question) {
    console.log('[QuestionSubmission] Rendering question not found');
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <svg
          className="mx-auto h-14 w-14 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v1.5m0 3h.01" />
        </svg>
        <h3 className="mt-3 text-lg font-semibold text-gray-800">Question not found</h3>
        <p className="mt-1 text-sm text-gray-500">The requested question could not be loaded.</p>
      </div>
    );
  }

  console.log('[QuestionSubmission] Rendering main component with question:', question.title);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {statusMessage && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 shadow-sm">
          <p className="text-sm font-semibold text-green-800">{statusMessage}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400 tracking-tight"
                dangerouslySetInnerHTML={{ __html: question.title }}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 shadow-sm">
                  {question.difficulty}
                </span>
                {question.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-800">Description</h3>
            <div className="text-gray-600 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: question.description }} />

            {question.constraints && (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Constraints</h3>
                <div className="text-gray-600 mt-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: question.constraints }} />
              </>
            )}

            {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && question.starterCode?.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Starter Code</h3>
                <pre className="bg-gray-50 p-4 rounded-lg mt-2 overflow-x-auto text-sm border border-gray-100">
                  <code>{question.starterCode.find((sc) => sc.language === selectedLanguage)?.code || 'No starter code available'}</code>
                </pre>
              </>
            )}

            {(question.type === 'fillInTheBlanks' || question.type === 'fillInTheBlanksCoding') && question.codeSnippet && (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Code Snippet</h3>
                <pre className="bg-gray-50 p-4 rounded-lg mt-2 overflow-x-auto text-sm border border-gray-100">
                  <code dangerouslySetInnerHTML={{ __html: question.codeSnippet }} />
                </pre>
              </>
            )}

            {question.examples?.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-800 mt-6">Examples</h3>
                <div className="space-y-4 mt-2">
                  {question.examples.map((example, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
                      <pre className="text-sm overflow-x-auto whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: example }} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {question.type === 'coding' || question.type === 'fillInTheBlanksCoding' ? 'Your Solution' : 'Your Answer'}
              </h3>

              {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && (
                <div className="mb-4">
                  <label htmlFor="language" className="text-sm font-medium text-gray-700">
                    Select Language
                  </label>
                  <select
                    id="language"
                    value={selectedLanguage}
                    onChange={handleLanguageChange}
                    className="mt-1 block w-48 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!isQuestionActive}
                  >
                    {question.languages?.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {question.type === 'coding' ? (
                <>
                  <CodeEditor
                    value={answer}
                    onChange={setAnswer}
                    defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
                    language={selectedLanguage}
                    disabled={!isQuestionActive}
                    isFillInTheBlanks={false}
                  />
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="customInput" className="text-sm font-medium text-gray-700">
                        Custom Input
                      </label>
                      <textarea
                        id="customInput"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        rows={4}
                        className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter custom input (e.g., [1, 5, 3, 9, 2])"
                        disabled={!isQuestionActive}
                      />
                    </div>
                    <div>
                      <label htmlFor="expectedOutput" className="text-sm font-medium text-gray-700">
                        Expected Output
                      </label>
                      <textarea
                        id="expectedOutput"
                        value={expectedOutput}
                        onChange={(e) => setExpectedOutput(e.target.value)}
                        rows={4}
                        className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter expected output (e.g., 9)"
                        disabled={!isQuestionActive}
                      />
                    </div>
                  </div>
                </>
              ) : question.type === 'fillInTheBlanksCoding' ? (
                <>
                  <CodeEditor
                    value={answer}
                    onChange={setAnswer}
                    defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || question.codeSnippet || ''}
                    language={selectedLanguage}
                    disabled={!isQuestionActive}
                    isFillInTheBlanks={true}
                  />
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="customInput" className="text-sm font-medium text-gray-700">
                        Custom Input
                      </label>
                      <textarea
                        id="customInput"
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        rows={4}
                        className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter custom input (e.g., [1, 5, 3, 9, 2])"
                        disabled={!isQuestionActive}
                      />
                    </div>
                    <div>
                      <label htmlFor="expectedOutput" className="text-sm font-medium text-gray-700">
                        Expected Output
                      </label>
                      <textarea
                        id="expectedOutput"
                        value={expectedOutput}
                        onChange={(e) => setExpectedOutput(e.target.value)}
                        rows={4}
                        className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Enter expected output (e.g., 9)"
                        disabled={!isQuestionActive}
                      />
                    </div>
                  </div>
                </>
              ) : question.type === 'singleCorrectMcq' && question.options?.length > 0 ? (
                <div className="space-y-4">
                  {question.options.map((option, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        type="radio"
                        name="answer"
                        value={index}
                        checked={answer === String(index)}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 disabled:opacity-50"
                        id={`option-${index}`}
                        disabled={!isQuestionActive}
                      />
                      <label
                        htmlFor={`option-${index}`}
                        className="ml-3 block text-sm font-medium text-gray-700 disabled:text-gray-400"
                        dangerouslySetInnerHTML={{ __html: option }}
                      />
                    </div>
                  ))}
                </div>
              ) : question.type === 'multipleCorrectMcq' && question.options?.length > 0 ? (
                <div className="space-y-4">
                  {question.options.map((option, index) => (
                    <div key={index} className="flex items-center">
                      <input
                        type="checkbox"
                        name={`answer-${index}`}
                        value={index}
                        checked={answer.includes(String(index))}
                        onChange={(e) => {
                          const idx = String(e.target.value);
                          setAnswer((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 disabled:opacity-50"
                        id={`option-${index}`}
                        disabled={!isQuestionActive}
                      />
                      <label
                        htmlFor={`option-${index}`}
                        className="ml-3 block text-sm font-medium text-gray-700 disabled:text-gray-400"
                        dangerouslySetInnerHTML={{ __html: option }}
                      />
                    </div>
                  ))}
                </div>
              ) : question.type === 'fillInTheBlanks' ? (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">Your Answer</label>
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Enter your answer..."
                    className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!isQuestionActive}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end space-x-4">
              {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && (
                <>
                  <button
                    type="button"
                    onClick={handleRunCode}
                    disabled={isRunning || isRunningCustom || !isQuestionActive}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isRunning || isRunningCustom || !isQuestionActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Running...
                      </>
                    ) : isQuestionActive ? (
                      'Run Code'
                    ) : (
                      'Question Inactive'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRunCodeWithCustomInput}
                    disabled={isRunning || isRunningCustom || !isQuestionActive || !customInput.trim()}
                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isRunning || isRunningCustom || !isQuestionActive || !customInput.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isRunningCustom ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Running Custom...
                      </>
                    ) : isQuestionActive ? (
                      'Run with Custom Input'
                    ) : (
                      'Question Inactive'
                    )}
                  </button>
                </>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !isQuestionActive}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isSubmitting || !isQuestionActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </>
                ) : isQuestionActive ? (
                  'Submit Answer'
                ) : (
                  'Question Inactive'
                )}
              </button>
            </div>
          </form>

          {(apiResponse || submission) && (
            <div className="mt-6 p-6 bg-gray-50 rounded-xl border border-gray-200">
              {(apiResponse?.submission || submission) && (
                <>
                  <div className={`p-4 rounded-lg border ${apiResponse?.error ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <h3 className="text-lg font-semibold">
                      {apiResponse?.error
                        ? 'Error Response'
                        : `${apiResponse?.type === 'submission' ? 'Submission' : apiResponse?.type === 'customRun' ? 'Custom Input Run' : 'Run'} Response`}
                    </h3>
                    <p className="mt-2 text-sm">{apiResponse?.message || 'Action completed'}</p>
                  </div>

                  <div className="mt-4">
                    <div
                      className={`rounded-xl p-4 ${apiResponse?.submission?.isCorrect || submission?.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                    >
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {(apiResponse?.submission?.isCorrect || submission?.isCorrect) ? (
                            <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zm3.707-9.293a1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 0 00-1.414 1.414l2 2a1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <h3
                            className={`text-sm font-semibold ${apiResponse?.submission?.isCorrect || submission?.isCorrect ? 'text-green-800' : 'text-red-800'}`}
                          >
                            {(apiResponse?.submission?.isCorrect || submission?.isCorrect) ? 'Correct Answer!' : 'Incorrect Answer'}
                          </h3>
                          <div className="mt-2 text-sm">
                            {(apiResponse?.submission?.score !== undefined || submission?.score !== undefined) && (
                              <p className={(apiResponse?.submission?.isCorrect || submission?.isCorrect) ? 'text-green-700' : 'text-red-700'}>
                                Score: {apiResponse?.submission?.score ?? submission?.score}
                              </p>
                            )}
                            {(apiResponse?.submission?.submittedAt || submission?.submittedAt) && (
                              <p className="text-gray-600">
                                Submitted At: {new Date(apiResponse?.submission?.submittedAt ?? submission?.submittedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(apiResponse?.testResults || (apiResponse?.submission?.output && apiResponse?.type !== 'submission')) && (
                    renderTestCaseResults(apiResponse?.testResults || JSON.parse(apiResponse?.submission?.output || '[]'), apiResponse?.type)
                  )}
                </>
              )}

              {runResults && !apiResponse?.submission && renderTestCaseResults(runResults, 'run')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionSubmission;