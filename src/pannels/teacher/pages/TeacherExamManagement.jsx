import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  createExam,
  createExamTemplate,
  getClassExams,
  getExamReport,
  listExamTemplates,
  releaseExamScores,
  createExamOnlyQuestion
} from '../../../common/services/api';

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
};

const TeacherExamManagement = () => {
  const { classes } = useSelector((state) => state.classes);
  const [templates, setTemplates] = useState([]);
  const [classExams, setClassExams] = useState({});
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    classId: '',
    durationMinutes: 60,
    tabSwitchLimit: 5,
    copyPasteDisabled: true,
    fullscreenRequired: true,
    autoSubmitOnEnd: true,
    immediateScoreRelease: false,
    questionIds: []
  });
  const [templateSections, setTemplateSections] = useState([
    { sectionId: 'template-section-1', title: 'Section 1', durationMinutes: 60, allowRevisit: true }
  ]);
  const [templateQuestionAssignments, setTemplateQuestionAssignments] = useState({});

  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    classId: '',
    durationMinutes: 60,
    startTime: '',
    endTime: '',
    tabSwitchLimit: 5,
    copyPasteDisabled: true,
    fullscreenRequired: true,
    autoSubmitOnEnd: true,
    immediateScoreRelease: false,
    templateId: ''
  });
  const [examSections, setExamSections] = useState([
    { sectionId: 'exam-section-1', title: 'Section 1', durationMinutes: 60, allowRevisit: true }
  ]);
  const [examQuestionAssignments, setExamQuestionAssignments] = useState({});
  const [examOnlyQuestions, setExamOnlyQuestions] = useState({});
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionModal, setQuestionModal] = useState({ open: false, context: null });

  const buildDefaultQuestionDraft = (sectionId = '') => ({
    type: 'singleCorrectMcq',
    title: '',
    description: '',
    difficulty: 'medium',
    points: 1,
    optionsText: 'Option 1\nOption 2',
    correctOption: 0,
    correctOptionsText: '',
    languages: ['javascript'],
    starterCode: '',
    testCasesText: '',
    sectionId,
    timeLimitMinutes: null
  });

  const [questionDraft, setQuestionDraft] = useState(buildDefaultQuestionDraft());

  const languageOptions = ['javascript', 'python', 'java', 'cpp'];

  const updateQuestionDraft = (patch) => {
    setQuestionDraft((prev) => ({ ...prev, ...patch }));
  };

  const parseTestCasesFromText = (value) => {
    if (!value) return [];
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [input, expectedOutput] = line.split('=>');
        if (!expectedOutput) return null;
        return {
          input: input.trim(),
          expectedOutput: expectedOutput.trim(),
          isPublic: true
        };
      })
      .filter(Boolean);
  };

  const classQuestionMap = useMemo(() => {
    const map = {};
    classes.forEach((cls) => {
      const baseQuestions = cls.questions || [];
      const extraQuestions = examOnlyQuestions[cls._id] || [];
      map[cls._id] = [...baseQuestions, ...extraQuestions];
    });
    return map;
  }, [classes, examOnlyQuestions]);

  const loadTemplates = async () => {
    try {
      const res = await listExamTemplates();
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('[TeacherExamManagement] loadTemplates error', err);
    }
  };

  const loadExams = async () => {
    const results = await Promise.allSettled(
      classes.map((cls) => getClassExams(cls._id))
    );
    const next = {};
    results.forEach((result, idx) => {
      const classId = classes[idx]?._id;
      if (!classId) return;
      next[classId] = result.status === 'fulfilled' ? result.value.data.exams || [] : [];
    });
    setClassExams(next);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (classes.length) {
      loadExams();
    }
  }, [classes]);

  useEffect(() => {
    if (!templateForm.classId) {
      setTemplateSections([{ sectionId: 'template-section-1', title: 'Section 1', durationMinutes: templateForm.durationMinutes, allowRevisit: true }]);
      setTemplateQuestionAssignments({});
      setTemplateForm((prev) => ({ ...prev, questionIds: [] }));
      return;
    }
    const baseSectionId = `template-section-${Date.now()}`;
    setTemplateSections([{ sectionId: baseSectionId, title: 'Section 1', durationMinutes: templateForm.durationMinutes, allowRevisit: true }]);
    const assignments = {};
    (classQuestionMap[templateForm.classId] || []).forEach((question) => {
      assignments[question._id] = { sectionId: baseSectionId, timeLimitMinutes: null };
    });
    setTemplateQuestionAssignments(assignments);
    setTemplateForm((prev) => ({ ...prev, questionIds: [] }));
  }, [templateForm.classId, classQuestionMap]);

  useEffect(() => {
    setTemplateSections((prev) =>
      prev.map((section, idx) =>
        idx === 0 ? { ...section, durationMinutes: templateForm.durationMinutes } : section
      )
    );
  }, [templateForm.durationMinutes]);

  const prevClassIdRef = useRef(examForm.classId);
  const prevTemplateIdRef = useRef(examForm.templateId);
  const sectionsInitializedRef = useRef(false);

  useEffect(() => {
    const classIdChanged = prevClassIdRef.current !== examForm.classId;
    const templateIdChanged = prevTemplateIdRef.current !== examForm.templateId;
    
    // Only reset sections when classId or templateId actually changes
    if (!classIdChanged && !templateIdChanged) {
      return;
    }

    prevClassIdRef.current = examForm.classId;
    prevTemplateIdRef.current = examForm.templateId;
    sectionsInitializedRef.current = false;

    if (!examForm.classId || examForm.templateId) {
      setExamSections([{ sectionId: 'exam-section-1', title: 'Section 1', durationMinutes: examForm.durationMinutes, allowRevisit: true }]);
      setExamQuestionAssignments({});
      sectionsInitializedRef.current = true;
      return;
    }
    
    // Only initialize sections if they haven't been initialized yet
    if (!sectionsInitializedRef.current) {
      const baseSectionId = `exam-section-${Date.now()}`;
      setExamSections([{ sectionId: baseSectionId, title: 'Section 1', durationMinutes: examForm.durationMinutes, allowRevisit: true }]);
      const assignments = {};
      (classQuestionMap[examForm.classId] || []).forEach((question) => {
        assignments[question._id] = { sectionId: baseSectionId, timeLimitMinutes: null };
      });
      setExamQuestionAssignments(assignments);
      sectionsInitializedRef.current = true;
    }
  }, [examForm.classId, examForm.templateId, examForm.durationMinutes, classQuestionMap]);

  // Auto-calculate duration from start/end time
  useEffect(() => {
    if (examForm.startTime && examForm.endTime) {
      const start = new Date(examForm.startTime);
      const end = new Date(examForm.endTime);
      if (end > start) {
        const diffMs = end.getTime() - start.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        if (diffMinutes > 0 && diffMinutes !== examForm.durationMinutes) {
          setExamForm((prev) => ({ ...prev, durationMinutes: diffMinutes }));
        }
      }
    }
  }, [examForm.startTime, examForm.endTime]);

  useEffect(() => {
    setExamSections((prev) =>
      prev.map((section, idx) =>
        idx === 0 ? { ...section, durationMinutes: examForm.durationMinutes } : section
      )
    );
  }, [examForm.durationMinutes]);

  useEffect(() => {
    if (!questionModal.open) return;
    const sections = questionModal.context === 'template' ? templateSections : examSections;
    if (!sections.length) return;
    if (!sections.find((section) => section.sectionId === questionDraft.sectionId)) {
      setQuestionDraft((prev) => ({ ...prev, sectionId: sections[0].sectionId }));
    }
  }, [questionModal, templateSections, examSections, questionDraft.sectionId]);

  const showFeedback = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setMessage(msg);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleOpenQuestionModal = (context) => {
    const selectedClassId = context === 'template' ? templateForm.classId : examForm.classId;
    if (!selectedClassId) {
      showFeedback('Please select a class before creating a question', true);
      return;
    }
    if (context === 'exam' && examForm.templateId) {
      showFeedback('Detach the template to create custom questions for this exam', true);
      return;
    }
    const sections = context === 'template' ? templateSections : examSections;
    const defaultSectionId = sections[0]?.sectionId || '';
    setQuestionDraft(buildDefaultQuestionDraft(defaultSectionId));
    setQuestionModal({ open: true, context });
  };

  const handleCloseQuestionModal = () => {
    setQuestionModal({ open: false, context: null });
    setQuestionDraft(buildDefaultQuestionDraft());
  };

  const handleTemplateSubmit = async (event) => {
    event.preventDefault();
    if (!templateForm.classId || !templateForm.questionIds.length) {
      showFeedback('Please select a class and at least one question', true);
      return;
    }
    setLoading(true);
    try {
      const sectionsPayload = templateSections.map((section, idx) => ({
        sectionId: section.sectionId || `template-section-${idx + 1}`,
        title: section.title || `Section ${idx + 1}`,
        durationMinutes: section.durationMinutes,
        allowRevisit: section.allowRevisit,
        order: idx
      }));
      const defaultSectionId = sectionsPayload[0]?.sectionId;
      const questionPayload = templateForm.questionIds.map((qid, idx) => {
        const assignment = templateQuestionAssignments[qid] || {};
        return {
          questionId: qid,
          order: idx,
          points: 1,
          sectionId: assignment.sectionId || defaultSectionId,
          timeLimitMinutes: assignment.timeLimitMinutes ?? null
        };
      });

      await createExamTemplate({
        title: templateForm.title,
        description: templateForm.description,
        classId: templateForm.classId,
        questions: questionPayload,
        sections: sectionsPayload,
        proctoring: {
          durationMinutes: templateForm.durationMinutes,
          tabSwitchLimit: templateForm.tabSwitchLimit,
          copyPasteDisabled: templateForm.copyPasteDisabled,
          fullscreenRequired: templateForm.fullscreenRequired,
          autoSubmitOnEnd: templateForm.autoSubmitOnEnd
        },
        scoring: {
          immediateScoreRelease: templateForm.immediateScoreRelease
        },
        templateDescription: templateForm.description
      });
      showFeedback('Template created successfully');
      setTemplateForm((prev) => ({ ...prev, title: '', description: '', questionIds: [] }));
      loadTemplates();
    } catch (err) {
      console.error('[TeacherExamManagement] handleTemplateSubmit', err);
      showFeedback(err.response?.data?.error || 'Failed to create template', true);
    } finally {
      setLoading(false);
    }
  };

  const handleExamSubmit = async (event) => {
    event.preventDefault();
    if (!examForm.classId) {
      showFeedback('Please select a class for the exam', true);
      return;
    }
    if (!examForm.templateId && !classQuestionMap[examForm.classId]?.length) {
      showFeedback('Selected class has no questions to include in the exam', true);
      return;
    }

    // Validate time distribution
    if (examTimeDistribution && !examTimeDistribution.isValid) {
      const totalSectionTime = examTimeDistribution.totalSectionTime;
      const totalQuestionTime = examTimeDistribution.totalQuestionTime;
      const totalDuration = examTimeDistribution.totalDurationMinutes;
      if (totalSectionTime > totalDuration) {
        showFeedback(`Total section time (${totalSectionTime} min) exceeds exam duration (${totalDuration} min)`, true);
        return;
      }
      if (totalQuestionTime > totalDuration) {
        showFeedback(`Total question time (${totalQuestionTime} min) exceeds exam duration (${totalDuration} min)`, true);
        return;
      }
    }

    setLoading(true);
    try {
      let sectionsPayload = undefined;
      let questionPayload = undefined;

      if (!examForm.templateId) {
        sectionsPayload = examSections.map((section, idx) => ({
          sectionId: section.sectionId || `exam-section-${idx + 1}`,
          title: section.title || `Section ${idx + 1}`,
          durationMinutes: section.durationMinutes,
          allowRevisit: section.allowRevisit,
          order: idx
        }));
        const defaultSectionId = sectionsPayload[0]?.sectionId;
        questionPayload = (classQuestionMap[examForm.classId] || []).map((q, idx) => {
          const assignment = examQuestionAssignments[q._id] || {};
          return {
            questionId: q._id,
            order: idx,
            points: 1,
            sectionId: assignment.sectionId || defaultSectionId,
            timeLimitMinutes: assignment.timeLimitMinutes ?? null
          };
        });
      }

      await createExam({
        title: examForm.title,
        description: examForm.description,
        classId: examForm.classId,
        templateId: examForm.templateId || undefined,
        questions: questionPayload,
        sections: sectionsPayload,
        proctoring: {
          durationMinutes: examForm.durationMinutes,
          startTime: examForm.startTime ? new Date(examForm.startTime).toISOString() : undefined,
          endTime: examForm.endTime ? new Date(examForm.endTime).toISOString() : undefined,
          tabSwitchLimit: examForm.tabSwitchLimit,
          copyPasteDisabled: examForm.copyPasteDisabled,
          fullscreenRequired: examForm.fullscreenRequired,
          autoSubmitOnEnd: examForm.autoSubmitOnEnd
        },
        scoring: {
          immediateScoreRelease: examForm.immediateScoreRelease
        }
      });
      showFeedback('Exam scheduled successfully');
      loadExams();
    } catch (err) {
      console.error('[TeacherExamManagement] handleExamSubmit', err);
      showFeedback(err.response?.data?.error || 'Failed to schedule exam', true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (examId) => {
    try {
      const res = await getExamReport(examId);
      setReport(res.data);
      showFeedback('Report loaded');
    } catch (err) {
      console.error('[TeacherExamManagement] handleViewReport', err);
      showFeedback(err.response?.data?.error || 'Failed to load report', true);
    }
  };

  const handleReleaseScores = async (examId) => {
    try {
      await releaseExamScores(examId);
      showFeedback('Scores released to students');
      loadExams();
    } catch (err) {
      console.error('[TeacherExamManagement] handleReleaseScores', err);
      showFeedback(err.response?.data?.error || 'Failed to release scores', true);
    }
  };

  const addTemplateSection = () => {
    setTemplateSections((prev) => {
      const newSectionId = `template-section-${Date.now()}-${prev.length + 1}`;
      return [
        ...prev,
        { sectionId: newSectionId, title: `Section ${prev.length + 1}`, durationMinutes: templateForm.durationMinutes, allowRevisit: true }
      ];
    });
  };

  const updateTemplateSectionField = (index, field, value) => {
    setTemplateSections((prev) =>
      prev.map((section, idx) =>
        idx === index
          ? {
              ...section,
              [field]: field === 'durationMinutes' ? Number(value) : value,
            }
          : section
      )
    );
  };

  const toggleTemplateSectionAllow = (index, checked) => {
    setTemplateSections((prev) =>
      prev.map((section, idx) => (idx === index ? { ...section, allowRevisit: checked } : section))
    );
  };

  const removeTemplateSection = (index) => {
    setTemplateSections((prev) => {
      if (prev.length <= 1) return prev;
      const removedSection = prev[index];
      const remaining = prev.filter((_, idx) => idx !== index);
      const fallbackSectionId = remaining[0]?.sectionId;
      setTemplateQuestionAssignments((assignments) => {
        const next = { ...assignments };
        Object.keys(next).forEach((questionId) => {
          if (next[questionId]?.sectionId === removedSection.sectionId) {
            next[questionId] = { ...next[questionId], sectionId: fallbackSectionId };
          }
        });
        return next;
      });
      return remaining;
    });
  };

  const updateTemplateQuestionAssignment = (questionId, updates) => {
    setTemplateQuestionAssignments((prev) => {
      const existing = prev[questionId] || { sectionId: templateSections[0]?.sectionId, timeLimitMinutes: null };
      const next = { ...existing };
      if (updates.sectionId) next.sectionId = updates.sectionId;
      if (Object.prototype.hasOwnProperty.call(updates, 'timeLimitMinutes')) {
        const value = updates.timeLimitMinutes;
        next.timeLimitMinutes = value === '' || value === null ? null : Number(value);
      }
      return { ...prev, [questionId]: next };
    });
  };

  const addExamSection = () => {
    setExamSections((prev) => {
      const newSectionId = `exam-section-${Date.now()}-${prev.length + 1}`;
      return [
        ...prev,
        { sectionId: newSectionId, title: `Section ${prev.length + 1}`, durationMinutes: examForm.durationMinutes, allowRevisit: true }
      ];
    });
  };

  const updateExamSectionField = (index, field, value) => {
    setExamSections((prev) =>
      prev.map((section, idx) =>
        idx === index
          ? {
              ...section,
              [field]: field === 'durationMinutes' ? Number(value) : value,
            }
          : section
      )
    );
  };

  const toggleExamSectionAllow = (index, checked) => {
    setExamSections((prev) =>
      prev.map((section, idx) => (idx === index ? { ...section, allowRevisit: checked } : section))
    );
  };

  const removeExamSection = (index) => {
    setExamSections((prev) => {
      if (prev.length <= 1) return prev;
      const removedSection = prev[index];
      const remaining = prev.filter((_, idx) => idx !== index);
      const fallbackSectionId = remaining[0]?.sectionId;
      setExamQuestionAssignments((assignments) => {
        const next = { ...assignments };
        Object.keys(next).forEach((questionId) => {
          if (next[questionId]?.sectionId === removedSection.sectionId) {
            next[questionId] = { ...next[questionId], sectionId: fallbackSectionId };
          }
        });
        return next;
      });
      return remaining;
    });
  };

  const updateExamQuestionAssignment = (questionId, updates) => {
    setExamQuestionAssignments((prev) => {
      const existing = prev[questionId] || { sectionId: examSections[0]?.sectionId, timeLimitMinutes: null };
      const next = { ...existing };
      if (updates.sectionId) next.sectionId = updates.sectionId;
      if (Object.prototype.hasOwnProperty.call(updates, 'timeLimitMinutes')) {
        const value = updates.timeLimitMinutes;
        next.timeLimitMinutes = value === '' || value === null ? null : Number(value);
      }
      return { ...prev, [questionId]: next };
    });
  };

  // Calculate time distribution for validation
  const calculateTimeDistribution = (sections, questionAssignments, totalDurationMinutes) => {
    const sectionTimeMap = {};
    sections.forEach((section) => {
      sectionTimeMap[section.sectionId] = {
        allocated: section.durationMinutes || 0,
        used: 0,
        questions: []
      };
    });

    Object.entries(questionAssignments).forEach(([questionId, assignment]) => {
      const sectionId = assignment.sectionId;
      if (sectionTimeMap[sectionId]) {
        const questionTime = assignment.timeLimitMinutes || 0;
        sectionTimeMap[sectionId].used += questionTime;
        sectionTimeMap[sectionId].questions.push({ questionId, time: questionTime });
      }
    });

    const totalSectionTime = sections.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalQuestionTime = Object.values(questionAssignments).reduce(
      (sum, a) => sum + (a.timeLimitMinutes || 0),
      0
    );

    return {
      sectionTimeMap,
      totalSectionTime,
      totalQuestionTime,
      totalDurationMinutes,
      isValid: totalSectionTime <= totalDurationMinutes && totalQuestionTime <= totalDurationMinutes
    };
  };

  const examTimeDistribution = useMemo(() => {
    if (!examForm.classId || examForm.templateId) return null;
    return calculateTimeDistribution(examSections, examQuestionAssignments, examForm.durationMinutes);
  }, [examSections, examQuestionAssignments, examForm.durationMinutes, examForm.classId, examForm.templateId]);

  const handleCreateExamOnlyQuestion = async (event) => {
    event.preventDefault();
    if (!questionModal.context) return;

    const targetClassId = questionModal.context === 'template' ? templateForm.classId : examForm.classId;
    if (!targetClassId) {
      showFeedback('Select a class before creating a question', true);
      return;
    }

    const sections = questionModal.context === 'template' ? templateSections : examSections;
    const sectionId = questionDraft.sectionId || sections[0]?.sectionId;
    if (!sectionId) {
      showFeedback('Add at least one section before creating a question', true);
      return;
    }

    if (!questionDraft.title.trim() || !questionDraft.description.trim()) {
      showFeedback('Question title and description are required', true);
      return;
    }

    const payload = {
      classId: targetClassId,
      title: questionDraft.title,
      description: questionDraft.description,
      difficulty: questionDraft.difficulty,
      points: Number(questionDraft.points) || 0,
      type: questionDraft.type,
      tags: [],
      hints: [],
      solution: '',
    };

    if (questionDraft.type === 'singleCorrectMcq' || questionDraft.type === 'multipleCorrectMcq') {
      const options = (questionDraft.optionsText || '')
        .split('\n')
        .map((opt) => opt.trim())
        .filter(Boolean);
      if (options.length < 2) {
        showFeedback('Provide at least two options for MCQ questions', true);
        return;
      }
      payload.options = options;
      if (questionDraft.type === 'singleCorrectMcq') {
        if (questionDraft.correctOption < 0 || questionDraft.correctOption >= options.length) {
          showFeedback('Select a valid correct option index', true);
          return;
        }
        payload.correctOption = Number(questionDraft.correctOption);
      } else {
        const selectedOptions = (questionDraft.correctOptionsText || '')
          .split(',')
          .map((value) => Number(value.trim()))
          .filter((value) => !Number.isNaN(value) && value >= 0 && value < options.length);
        if (!selectedOptions.length) {
          showFeedback('Provide comma separated indexes for correct options', true);
          return;
        }
        payload.correctOptions = selectedOptions;
      }
    } else {
      if (!questionDraft.languages || !questionDraft.languages.length) {
        showFeedback('Select at least one programming language', true);
        return;
      }
      payload.languages = questionDraft.languages;
      payload.starterCode = (questionDraft.languages || []).map((language) => ({
        language,
        code: questionDraft.starterCode || ''
      }));
      payload.testCases = parseTestCasesFromText(questionDraft.testCasesText);
      payload.timeLimit = 2;
      payload.memoryLimit = 256;
    }

    setQuestionSaving(true);
    try {
      const response = await createExamOnlyQuestion(payload);
      const createdQuestion = response.data.question;

      setExamOnlyQuestions((prev) => {
        const existing = prev[targetClassId] || [];
        return {
          ...prev,
          [targetClassId]: [...existing, createdQuestion]
        };
      });

      if (questionModal.context === 'template') {
        setTemplateForm((prev) => ({
          ...prev,
          questionIds: Array.from(new Set([...(prev.questionIds || []), createdQuestion._id]))
        }));
        setTemplateQuestionAssignments((prev) => ({
          ...prev,
          [createdQuestion._id]: {
            sectionId,
            timeLimitMinutes: questionDraft.timeLimitMinutes ?? null
          }
        }));
      } else {
        setExamQuestionAssignments((prev) => ({
          ...prev,
          [createdQuestion._id]: {
            sectionId,
            timeLimitMinutes: questionDraft.timeLimitMinutes ?? null
          }
        }));
      }

      showFeedback('Question created for this exam');
      handleCloseQuestionModal();
    } catch (err) {
      console.error('[TeacherExamManagement] handleCreateExamOnlyQuestion', err);
      showFeedback(err.response?.data?.error || 'Failed to create question', true);
    } finally {
      setQuestionSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Exam Management</h1>
        <p className="mt-2 text-sm text-gray-600">Create templates, schedule exams, monitor attempts, and release scores.</p>
      </header>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{message}</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleTemplateSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Create Template</h2>
            <span className="text-xs text-gray-500">Reusable configurations</span>
          </div>
          <div className="grid gap-4">
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Template title"
              value={templateForm.title}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
            <textarea
              className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Description"
              value={templateForm.description}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={templateForm.classId}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, classId: e.target.value, questionIds: [] }))}
              required
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>{cls.name}</option>
              ))}
            </select>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">Sections</div>
                <button
                  type="button"
                  onClick={addTemplateSection}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Add Section
                </button>
              </div>
              <div className="space-y-2">
                {templateSections.map((section, idx) => (
                  <div key={section.sectionId} className="grid gap-2 md:grid-cols-4 items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                    <input
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder={`Section ${idx + 1}`}
                      value={section.title}
                      onChange={(e) => updateTemplateSectionField(idx, 'title', e.target.value)}
                    />
                    <input
                      type="number"
                      min="1"
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={section.durationMinutes}
                      onChange={(e) => updateTemplateSectionField(idx, 'durationMinutes', Number(e.target.value))}
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={section.allowRevisit}
                        onChange={(e) => toggleTemplateSectionAllow(idx, e.target.checked)}
                      />
                      Allow revisit
                    </label>
                    {templateSections.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTemplateSection(idx)}
                        className="justify-self-end rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                <span>Questions</span>
                <button
                  type="button"
                  onClick={() => handleOpenQuestionModal('template')}
                  disabled={!templateForm.classId}
                  className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Create exam-only question
                </button>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2 text-sm">
                {(classQuestionMap[templateForm.classId] || []).map((question) => {
                  const isSelected = templateForm.questionIds.includes(question._id);
                  const assignment = templateQuestionAssignments[question._id] || {};
                  return (
                    <div key={question._id} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
                      <label className="flex items-center gap-2 text-gray-700">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setTemplateForm((prev) => {
                              const exists = prev.questionIds.includes(question._id);
                              return {
                                ...prev,
                                questionIds: exists
                                  ? prev.questionIds.filter((id) => id !== question._id)
                                  : [...prev.questionIds, question._id],
                              };
                            });
                            if (e.target.checked) {
                              setTemplateQuestionAssignments((prev) => ({
                                ...prev,
                                [question._id]: prev[question._id] || {
                                  sectionId: assignment.sectionId || templateSections[0]?.sectionId,
                                  timeLimitMinutes: assignment.timeLimitMinutes ?? null,
                                },
                              }));
                            }
                          }}
                        />
                        <span className="flex-1 truncate">{question.title}</span>
                      </label>
                      {isSelected && (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <select
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                            value={assignment.sectionId || templateSections[0]?.sectionId || ''}
                            onChange={(e) => updateTemplateQuestionAssignment(question._id, { sectionId: e.target.value })}
                          >
                            {templateSections.map((section) => (
                              <option key={section.sectionId} value={section.sectionId}>{section.title}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                            placeholder="Question time (minutes)"
                            value={assignment.timeLimitMinutes ?? ''}
                            onChange={(e) => updateTemplateQuestionAssignment(question._id, { timeLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-sm text-gray-700">
                Duration (minutes)
                <input
                  type="number"
                  min="10"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={templateForm.durationMinutes}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-700">
                Tab switch limit
                <input
                  type="number"
                  min="1"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={templateForm.tabSwitchLimit}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, tabSwitchLimit: Number(e.target.value) }))}
                />
              </label>
            </div>
            <div className="grid gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateForm.copyPasteDisabled}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, copyPasteDisabled: e.target.checked }))}
                />
                Disable copy/paste
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateForm.fullscreenRequired}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, fullscreenRequired: e.target.checked }))}
                />
                Require fullscreen
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateForm.autoSubmitOnEnd}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, autoSubmitOnEnd: e.target.checked }))}
                />
                Auto submit when time ends
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateForm.immediateScoreRelease}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, immediateScoreRelease: e.target.checked }))}
                />
                Release score immediately after submit
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Create Template'}
          </button>
        </form>

        <form onSubmit={handleExamSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Schedule Exam</h2>
            <span className="text-xs text-gray-500">Use template or custom setup</span>
          </div>
          <div className="grid gap-4">
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Exam title"
              value={examForm.title}
              onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
              required={!examForm.templateId}
            />
            <textarea
              className="min-h-[80px] rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Description"
              value={examForm.description}
              onChange={(e) => setExamForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={examForm.classId}
              onChange={(e) => setExamForm((prev) => ({ ...prev, classId: e.target.value }))}
              required
            >
              <option value="">Select class</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>{cls.name}</option>
              ))}
            </select>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={examForm.templateId}
              onChange={(e) => setExamForm((prev) => ({ ...prev, templateId: e.target.value }))}
            >
              <option value="">Create without template</option>
              {templates.map((tpl) => (
                <option key={tpl._id} value={tpl._id}>{tpl.title}</option>
              ))}
            </select>

            {!examForm.templateId && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-700">Sections</div>
                    <button
                      type="button"
                      onClick={addExamSection}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Add Section
                    </button>
                  </div>
                  <div className="space-y-2">
                    {examSections.map((section, idx) => (
                      <div key={section.sectionId} className="grid gap-2 md:grid-cols-4 items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <input
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder={`Section ${idx + 1}`}
                          value={section.title}
                          onChange={(e) => updateExamSectionField(idx, 'title', e.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          value={section.durationMinutes}
                          onChange={(e) => updateExamSectionField(idx, 'durationMinutes', Number(e.target.value))}
                        />
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={section.allowRevisit}
                            onChange={(e) => toggleExamSectionAllow(idx, e.target.checked)}
                          />
                          Allow revisit
                        </label>
                        {examSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExamSection(idx)}
                            className="justify-self-end rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {examTimeDistribution && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-blue-900">Time Distribution Summary</h4>
                    <div className="space-y-2 text-xs text-blue-800">
                      <div className="flex justify-between">
                        <span>Total Exam Duration:</span>
                        <span className="font-semibold">{examTimeDistribution.totalDurationMinutes} min</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Section Time:</span>
                        <span className={examTimeDistribution.totalSectionTime > examTimeDistribution.totalDurationMinutes ? 'font-semibold text-red-600' : 'font-semibold'}>
                          {examTimeDistribution.totalSectionTime} min
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Question Time:</span>
                        <span className={examTimeDistribution.totalQuestionTime > examTimeDistribution.totalDurationMinutes ? 'font-semibold text-red-600' : 'font-semibold'}>
                          {examTimeDistribution.totalQuestionTime} min
                        </span>
                      </div>
                      {examTimeDistribution.totalSectionTime > examTimeDistribution.totalDurationMinutes && (
                        <div className="mt-2 rounded border border-red-300 bg-red-100 p-2 text-red-700">
                          ⚠️ Section time exceeds exam duration
                        </div>
                      )}
                      {examTimeDistribution.totalQuestionTime > examTimeDistribution.totalDurationMinutes && (
                        <div className="mt-2 rounded border border-red-300 bg-red-100 p-2 text-red-700">
                          ⚠️ Question time exceeds exam duration
                        </div>
                      )}
                      {examTimeDistribution.isValid && (
                        <div className="mt-2 rounded border border-green-300 bg-green-100 p-2 text-green-700">
                          ✓ Time distribution is valid
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                    <span>Questions</span>
                    <button
                      type="button"
                      onClick={() => handleOpenQuestionModal('exam')}
                      disabled={!examForm.classId || Boolean(examForm.templateId)}
                      className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Create exam-only question
                    </button>
                  </div>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2 text-sm">
                    {(classQuestionMap[examForm.classId] || []).map((question) => {
                      const assignment = examQuestionAssignments[question._id] || {};
                      return (
                        <div key={question._id} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
                          <div className="text-sm font-semibold text-gray-800 truncate">{question.title}</div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            <select
                              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                              value={assignment.sectionId || examSections[0]?.sectionId || ''}
                              onChange={(e) => updateExamQuestionAssignment(question._id, { sectionId: e.target.value })}
                            >
                              {examSections.map((section) => (
                                <option key={section.sectionId} value={section.sectionId}>{section.title}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min="0"
                              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                              placeholder="Question time (minutes)"
                              value={assignment.timeLimitMinutes ?? ''}
                              onChange={(e) => updateExamQuestionAssignment(question._id, { timeLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col text-sm text-gray-700">
                Start time
                <input
                  type="datetime-local"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={examForm.startTime}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-700">
                End time
                <input
                  type="datetime-local"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={examForm.endTime}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm text-gray-700">
                Duration (minutes)
                <input
                  type="number"
                  min="10"
                  className={`mt-1 rounded-md border px-3 py-2 text-sm ${
                    examForm.startTime && examForm.endTime
                      ? 'border-blue-300 bg-blue-50 text-gray-600'
                      : 'border-gray-300'
                  }`}
                  value={examForm.durationMinutes}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                  readOnly={!!(examForm.startTime && examForm.endTime)}
                  title={examForm.startTime && examForm.endTime ? 'Auto-calculated from start/end time' : ''}
                />
                {examForm.startTime && examForm.endTime && (
                  <span className="mt-1 text-xs text-blue-600">Auto-calculated from start/end time</span>
                )}
              </label>
              <label className="flex flex-col text-sm text-gray-700">
                Tab switch limit
                <input
                  type="number"
                  min="1"
                  className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={examForm.tabSwitchLimit}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, tabSwitchLimit: Number(e.target.value) }))}
                />
              </label>
            </div>

            <div className="grid gap-2 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={examForm.copyPasteDisabled}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, copyPasteDisabled: e.target.checked }))}
                />
                Disable copy/paste
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={examForm.fullscreenRequired}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, fullscreenRequired: e.target.checked }))}
                />
                Require fullscreen
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={examForm.autoSubmitOnEnd}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, autoSubmitOnEnd: e.target.checked }))}
                />
                Auto submit when time ends
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={examForm.immediateScoreRelease}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, immediateScoreRelease: e.target.checked }))}
                />
                Release score immediately after submit
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Scheduling...' : 'Schedule Exam'}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Exams by Class</h2>
          <button
            onClick={loadExams}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
        {classes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
            Create or join a class to manage exams.
          </div>
        ) : (
          <div className="space-y-6">
            {classes.map((cls) => {
              const exams = classExams[cls._id] || [];
              return (
                <div key={cls._id} className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-800">{cls.name}</h3>
                  {exams.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-gray-500">
                      No exams scheduled yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exams.map((exam) => (
                        <div key={exam._id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{exam.title}</div>
                            <div className="text-xs text-gray-500">Status: {exam.status}</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewReport(exam._id)}
                              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              View Report
                            </button>
                            <button
                              onClick={() => handleReleaseScores(exam._id)}
                              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                            >
                              Release Scores
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {report && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Exam Report</h2>
            <button
              onClick={() => setReport(null)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Student</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Score</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Max Score</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Violations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {report.attempts.map((attempt) => (
                  <tr key={attempt._id}>
                    <td className="px-4 py-2 text-gray-700">{attempt.studentId?.name || 'Student'}</td>
                    <td className="px-4 py-2 text-gray-500">{attempt.status}</td>
                    <td className="px-4 py-2 text-gray-700">{attempt.totalScore}</td>
                    <td className="px-4 py-2 text-gray-700">{attempt.maxScore}</td>
                    <td className="px-4 py-2 text-gray-500">{attempt.violationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {questionModal.open && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !questionSaving) {
              handleCloseQuestionModal();
            }
          }}
        >
          <div 
            className="w-full max-w-3xl rounded-xl bg-white shadow-2xl my-8 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Question For This Exam</h3>
                <p className="text-xs text-gray-500">Questions created here are marked exam-only and hidden from the general bank.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseQuestionModal}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                disabled={questionSaving}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateExamOnlyQuestion} className="space-y-4 px-6 py-5 overflow-y-auto flex-1">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm text-gray-700">
                  Question type
                  <select
                    value={questionDraft.type}
                    onChange={(e) => updateQuestionDraft({ type: e.target.value })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={questionSaving}
                  >
                    <option value="singleCorrectMcq">Single correct MCQ</option>
                    <option value="multipleCorrectMcq">Multiple select MCQ</option>
                    <option value="coding">Coding</option>
                  </select>
                </label>
                <label className="flex flex-col text-sm text-gray-700">
                  Difficulty
                  <select
                    value={questionDraft.difficulty}
                    onChange={(e) => updateQuestionDraft({ difficulty: e.target.value })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={questionSaving}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm text-gray-700">
                  Title
                  <input
                    type="text"
                    value={questionDraft.title}
                    onChange={(e) => updateQuestionDraft({ title: e.target.value })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="E.g. Implement two sum"
                    disabled={questionSaving}
                  />
                </label>
                <label className="flex flex-col text-sm text-gray-700">
                  Points
                  <input
                    type="number"
                    min="1"
                    value={questionDraft.points}
                    onChange={(e) => updateQuestionDraft({ points: Number(e.target.value) })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={questionSaving}
                  />
                </label>
              </div>

              <label className="flex flex-col text-sm text-gray-700">
                Description
                <textarea
                  value={questionDraft.description}
                  onChange={(e) => updateQuestionDraft({ description: e.target.value })}
                  className="mt-1 h-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Problem statement or scenario"
                  disabled={questionSaving}
                />
              </label>

              {questionDraft.type === 'singleCorrectMcq' || questionDraft.type === 'multipleCorrectMcq' ? (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label className="flex flex-col text-sm text-gray-700">
                    Options (one per line)
                    <textarea
                      value={questionDraft.optionsText}
                      onChange={(e) => updateQuestionDraft({ optionsText: e.target.value })}
                      className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder={'Option 1\nOption 2\nOption 3'}
                      disabled={questionSaving}
                    />
                  </label>
                  {questionDraft.type === 'singleCorrectMcq' ? (
                    <label className="flex flex-col text-sm text-gray-700">
                      Correct option index (starting from 0)
                      <input
                        type="number"
                        min="0"
                        value={questionDraft.correctOption}
                        onChange={(e) => updateQuestionDraft({ correctOption: Number(e.target.value) })}
                        className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        disabled={questionSaving}
                      />
                    </label>
                  ) : (
                    <label className="flex flex-col text-sm text-gray-700">
                      Correct option indexes (comma separated)
                      <input
                        type="text"
                        value={questionDraft.correctOptionsText}
                        onChange={(e) => updateQuestionDraft({ correctOptionsText: e.target.value })}
                        className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                        placeholder="0,2"
                        disabled={questionSaving}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Languages</div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {languageOptions.map((language) => {
                        const checked = questionDraft.languages.includes(language);
                        return (
                          <label key={language} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setQuestionDraft((prev) => {
                                  const nextLanguages = e.target.checked
                                    ? Array.from(new Set([...(prev.languages || []), language]))
                                    : (prev.languages || []).filter((item) => item !== language);
                                  return { ...prev, languages: nextLanguages };
                                });
                              }}
                              disabled={questionSaving}
                            />
                            {language.toUpperCase()}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex flex-col text-sm text-gray-700">
                    Starter code (applied to every selected language)
                    <textarea
                      value={questionDraft.starterCode}
                      onChange={(e) => updateQuestionDraft({ starterCode: e.target.value })}
                      className="mt-1 h-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder="function solution(nums) {\n  // TODO\n}"
                      disabled={questionSaving}
                    />
                  </label>
                  <label className="flex flex-col text-sm text-gray-700">
                    Test cases (one per line, format: input = expected)
                    <textarea
                      value={questionDraft.testCasesText}
                      onChange={(e) => updateQuestionDraft({ testCasesText: e.target.value })}
                      className="mt-1 h-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                      placeholder={'1 2 => 3\n5 6 => 11'}
                      disabled={questionSaving}
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col text-sm text-gray-700">
                  Assign to section
                  <select
                    value={questionDraft.sectionId}
                    onChange={(e) => updateQuestionDraft({ sectionId: e.target.value })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    disabled={questionSaving}
                  >
                    {(questionModal.context === 'template' ? templateSections : examSections).map((section) => (
                      <option key={section.sectionId} value={section.sectionId}>{section.title}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm text-gray-700">
                  Question time limit (minutes)
                  <input
                    type="number"
                    min="0"
                    value={questionDraft.timeLimitMinutes ?? ''}
                    onChange={(e) => updateQuestionDraft({ timeLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })}
                    className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Optional"
                    disabled={questionSaving}
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleCloseQuestionModal}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  disabled={questionSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={questionSaving}
                >
                  {questionSaving ? 'Saving...' : 'Save question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherExamManagement;
