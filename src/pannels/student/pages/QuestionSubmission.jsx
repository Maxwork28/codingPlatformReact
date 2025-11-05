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
const socket = io('http://localhost:3000/', {
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
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const [editorHeight, setEditorHeight] = useState(60); // Percentage of right panel
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const classId = location.state?.classId || (question?.classes?.length > 0 ? question.classes[0].classId : null);

  // Hide sidebar effect - MUST be at the top before any conditional returns
  useEffect(() => {
    document.body.classList.add('hide-sidebar');
    
    return () => {
      document.body.classList.remove('hide-sidebar');
    };
  }, []);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const containerWidth = window.innerWidth;
      const newLeftWidth = (e.clientX / containerWidth) * 100;
      
      // Constrain between 20% and 80%
      if (newLeftWidth >= 20 && newLeftWidth <= 80) {
        setLeftPanelWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle vertical panel resizing (editor height)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingVertical) return;
      
      const rightPanel = document.getElementById('right-panel');
      if (!rightPanel) return;
      
      const rect = rightPanel.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newHeight = (relativeY / rect.height) * 100;
      
      // Constrain between 30% and 80%
      if (newHeight >= 30 && newHeight <= 80) {
        setEditorHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDraggingVertical) {
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVertical]);

  const handleVerticalDividerMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle keyboard shortcuts for fullscreen
  useEffect(() => {
    const handleKeyboard = (e) => {
      // ESC to exit fullscreen
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      // F11 to toggle fullscreen (prevent default browser fullscreen)
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => {
      document.removeEventListener('keydown', handleKeyboard);
    };
  }, [isFullscreen]);

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
        <div className="mt-4 p-4 rounded-xl border shadow-sm backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-gray-800">Submission Result</h3>
          <div className={`flex items-center p-4 rounded-lg border backdrop-blur-sm ${isCorrect ? 'bg-green-50/80 border-green-200' : 'bg-red-50/80 border-red-200'}`}>
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
        <div className="mt-4 p-4 bg-yellow-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-yellow-200">
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
        <div className="mt-4 p-4 bg-yellow-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-yellow-200">
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
              className={`p-4 rounded-xl border backdrop-blur-sm ${result.passed ? 'border-green-200 bg-green-50/80' : 'border-red-200 bg-red-50/80'} shadow-sm`}
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
            <div className="mt-4 p-4 bg-blue-50/80 backdrop-blur-sm rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-800">
                Test Cases Passed: {passedTestCases}/{totalTestCases}
              </p>
              <p className="text-sm text-blue-800 mt-2">Score: {apiResponse?.submission?.score ?? submission?.score ?? 0}</p>
            </div>
          )}
          {source === 'run' && (
            <div className="mt-4 p-4 bg-blue-50/80 backdrop-blur-sm rounded-xl border border-blue-200">
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
      <div className="flex justify-center items-center py-16 backdrop-blur-sm rounded-xl shadow-lg" style={{ backgroundColor: 'var(--card-white)' }}>
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (error) {
    console.log('[QuestionSubmission] Rendering error state:', error);
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center p-4 bg-red-50/80 backdrop-blur-sm rounded-xl shadow-sm border border-red-200">
          <svg className="h-6 w-6 text-red-500 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 0 100-16 8 0 000 16zM8.707 7.293a1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--background-content)' }}>
      {/* Top Status Bar */}
      {statusMessage && (
        <div className="p-3 bg-green-50/80 backdrop-blur-sm border-b border-green-200 shadow-sm">
          <p className="text-sm font-semibold text-green-800 text-center">{statusMessage}</p>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Question */}
        <div 
          className="overflow-y-auto transition-all duration-150" 
          style={{ 
            width: `${leftPanelWidth}%`,
            backgroundColor: 'var(--card-white)', 
            borderRight: '1px solid var(--card-border)'
          }}
        >
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
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
        </div>
        </div>

        {/* Draggable Divider */}
        <div
          className="flex-shrink-0 relative group"
          style={{ 
            width: '4px',
            cursor: 'col-resize',
            backgroundColor: isDragging ? 'var(--accent-indigo)' : 'var(--card-border)',
            transition: isDragging ? 'none' : 'background-color 0.2s'
          }}
          onMouseDown={handleDividerMouseDown}
        >
          {/* Visual indicator */}
          <div 
            className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ 
              backgroundColor: 'var(--accent-indigo)',
              width: '2px'
            }}
          />
          {/* Hover area (wider for easier grabbing) */}
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right Panel - Code Editor & Submission */}
        <div 
          id="right-panel"
          className="flex flex-col overflow-hidden transition-all duration-150" 
          style={{ 
            width: `${100 - leftPanelWidth}%`,
            backgroundColor: 'var(--background-content)' 
          }}
        >
          <div className="flex-1 flex flex-col overflow-hidden p-4 relative">
            {/* Language Selector and Fullscreen Button */}
            {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && (
              <div className="mb-3 flex-shrink-0 flex items-end gap-3">
                <div className="flex-1">
                  <label htmlFor="language" className="text-xs font-medium text-gray-700">
                    Language
                  </label>
                  <select
                    id="language"
                    value={selectedLanguage}
                    onChange={handleLanguageChange}
                    className="mt-1 block w-full rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed py-1.5"
                    disabled={!isQuestionActive}
                  >
                    {question.languages?.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow text-sm"
                  style={{ 
                    backgroundColor: 'var(--card-white)', 
                    borderColor: 'var(--card-border)', 
                    color: 'var(--text-primary)' 
                  }}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            {/* Code Editor or Answer Input */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  {question.type === 'coding' || question.type === 'fillInTheBlanksCoding' ? 'Your Solution' : 'Your Answer'}
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                {/* Code Editor Section - Dynamic height */}
                <div 
                  className="overflow-auto mb-2 transition-all duration-150"
                  style={{ 
                    height: isFullscreen ? '100%' : `${editorHeight}%`
                  }}
                >
                {question.type === 'coding' ? (
                <>
                  <div className="h-full">
                    <CodeEditor
                      value={answer}
                      onChange={setAnswer}
                      defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
                      language={selectedLanguage}
                      disabled={!isQuestionActive}
                      isFillInTheBlanks={false}
                    />
                  </div>
                </>
              ) : question.type === 'fillInTheBlanksCoding' ? (
                <>
                  <div className="h-full">
                    <CodeEditor
                      value={answer}
                      onChange={setAnswer}
                      defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || question.codeSnippet || ''}
                      language={selectedLanguage}
                      disabled={!isQuestionActive}
                      isFillInTheBlanks={true}
                    />
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

                {/* Vertical Divider (Horizontal drag handle for resizing editor height) */}
                {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && !isFullscreen && (
                  <div
                    className="flex-shrink-0 relative group"
                    style={{ 
                      height: '4px',
                      cursor: 'row-resize',
                      backgroundColor: isDraggingVertical ? 'var(--accent-indigo)' : 'var(--card-border)',
                      transition: isDraggingVertical ? 'none' : 'background-color 0.2s'
                    }}
                    onMouseDown={handleVerticalDividerMouseDown}
                  >
                    {/* Visual indicator */}
                    <div 
                      className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ 
                        backgroundColor: 'var(--accent-indigo)',
                        height: '2px'
                      }}
                    />
                    {/* Hover area (taller for easier grabbing) */}
                    <div className="absolute inset-x-0 -top-1 -bottom-1" />
                  </div>
                )}

                {/* Custom Input/Output for Coding Questions - Compact */}
                {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && !isFullscreen && (
                  <div className="flex-shrink-0 border-t pt-2 space-y-2" style={{ borderColor: 'var(--card-border)' }}>
                    <h4 className="text-sm font-semibold text-gray-800">Custom Test</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="customInput" className="text-xs font-medium text-gray-700">
                          Custom Input
                        </label>
                        <textarea
                          id="customInput"
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          rows={2}
                          className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="e.g., [1, 5, 3, 9, 2]"
                          disabled={!isQuestionActive}
                        />
                      </div>
                      <div>
                        <label htmlFor="expectedOutput" className="text-xs font-medium text-gray-700">
                          Expected Output
                        </label>
                        <textarea
                          id="expectedOutput"
                          value={expectedOutput}
                          onChange={(e) => setExpectedOutput(e.target.value)}
                          rows={2}
                          className="block w-full mt-1 rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="e.g., 9"
                          disabled={!isQuestionActive}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons - Compact */}
                {!isFullscreen && (
                  <div className="flex-shrink-0 flex justify-end space-x-2 border-t pt-3 mt-2" style={{ borderColor: 'var(--card-border)' }}>
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
                )}
              </form>
            </div>

            {/* Results Section - Compact */}
            {(apiResponse || submission) && !isFullscreen && (
              <div className="overflow-y-auto border-t p-4 flex-shrink-0 max-h-[40vh]" style={{ backgroundColor: 'var(--background-light)', borderColor: 'var(--card-border)' }}>
              {(apiResponse?.submission || submission) && (
                <>
                  <div className={`p-4 rounded-lg border backdrop-blur-sm ${apiResponse?.error ? 'bg-red-50/80 border-red-200' : 'bg-blue-50/80 border-blue-200'}`}>
                    <h3 className="text-lg font-semibold">
                      {apiResponse?.error
                        ? 'Error Response'
                        : `${apiResponse?.type === 'submission' ? 'Submission' : apiResponse?.type === 'customRun' ? 'Custom Input Run' : 'Run'} Response`}
                    </h3>
                    <p className="mt-2 text-sm">{apiResponse?.message || 'Action completed'}</p>
                  </div>

                  <div className="mt-4">
                    <div
                      className={`rounded-xl p-4 backdrop-blur-sm ${apiResponse?.submission?.isCorrect || submission?.isCorrect ? 'bg-green-50/80 border border-green-200' : 'bg-red-50/80 border border-red-200'}`}
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

      {/* Fullscreen Editor Overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'var(--background-content)' }}>
          {/* Fullscreen Header */}
          <div className="flex-shrink-0 border-b p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card-white)', borderColor: 'var(--card-border)' }}>
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-heading)' }}>
                  Code Editor - Fullscreen
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">ESC</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-300 text-xs">F11</kbd> to exit
                </p>
              </div>
              {(question.type === 'coding' || question.type === 'fillInTheBlanksCoding') && (
                <select
                  id="language-fullscreen"
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="rounded-lg border border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed px-3 py-1.5"
                  disabled={!isQuestionActive}
                >
                  {question.languages?.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunCode}
                disabled={isRunning || isRunningCustom || !isQuestionActive}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isRunning || isRunningCustom || !isQuestionActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isRunning ? 'Running...' : 'Run Code'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubmit(e);
                }}
                disabled={isSubmitting || !isQuestionActive}
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isSubmitting || !isQuestionActive ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-2 rounded-lg border transition-all duration-200 hover:shadow"
                style={{ 
                  backgroundColor: 'var(--card-white)', 
                  borderColor: 'var(--card-border)', 
                  color: 'var(--text-primary)' 
                }}
                title="Exit Fullscreen"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Fullscreen Editor */}
          <div className="flex-1 overflow-hidden p-4">
            {question.type === 'coding' ? (
              <CodeEditor
                value={answer}
                onChange={setAnswer}
                defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || ''}
                language={selectedLanguage}
                disabled={!isQuestionActive}
                isFillInTheBlanks={false}
              />
            ) : question.type === 'fillInTheBlanksCoding' ? (
              <CodeEditor
                value={answer}
                onChange={setAnswer}
                defaultValue={question.starterCode?.find((sc) => sc.language === selectedLanguage)?.code || question.codeSnippet || ''}
                language={selectedLanguage}
                disabled={!isQuestionActive}
                isFillInTheBlanks={true}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSubmission;