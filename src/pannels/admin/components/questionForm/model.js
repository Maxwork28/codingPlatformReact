import { CheckSquare, Code2, Puzzle, SquareCode, TextCursorInput, CircleDot } from 'lucide-react';
import { parseOptionalPoints, pointsFieldValue } from '../../../../common/utils/optionalPoints';
import { deserializeFromHTML, richTextIsEmpty, serializeToHTML } from './richText';

export const QUESTION_TYPE_OPTIONS = [
  { id: 'singleCorrectMcq', label: 'Single choice', hint: 'One correct option', icon: CircleDot },
  { id: 'multipleCorrectMcq', label: 'Multiple choice', hint: 'One or more correct options', icon: CheckSquare },
  { id: 'fillInTheBlanks', label: 'Fill in the blank', hint: 'Typed answer', icon: TextCursorInput },
  { id: 'fillInTheBlanksCoding', label: 'Fill the code', hint: 'Complete one line of code', icon: Puzzle },
  { id: 'coding', label: 'Coding', hint: 'Full program, stdin/stdout', icon: Code2 },
  { id: 'codingWithDriver', label: 'Function (driver)', hint: 'LeetCode-style stub + hidden driver', icon: SquareCode },
];

export const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'c', 'go', 'php', 'ruby'];
export const CODING_TYPES = ['coding', 'fillInTheBlanksCoding', 'codingWithDriver'];
export const isCodingType = (type) => CODING_TYPES.includes(type);
export const isMcqType = (type) => type === 'singleCorrectMcq' || type === 'multipleCorrectMcq';

const DRIVER_PLACEHOLDERS = ['{{USER_CODE}}', '// USER_CODE_HERE', '# USER_CODE_HERE'];

export function defaultDriverCode(lang) {
  if (lang === 'python') {
    return 'import json\n\n{{USER_CODE}}\n\nif __name__ == "__main__":\n    data = json.loads(input())\n    result = your_function(data)\n    print(result)';
  }
  return "{{USER_CODE}}\n\nconst fs = require('fs');\nconst data = JSON.parse(fs.readFileSync(0, 'utf8').trim());\nconst result = yourFunction(data);\nconsole.log(typeof result === 'object' ? JSON.stringify(result) : result);\n";
}

let optionSeq = 0;
export const newOption = (html = '') => ({ id: `opt-${(optionSeq += 1)}`, value: deserializeFromHTML(html) });

const blankTest = () => ({ input: '', expectedOutput: '', isPublic: true, isLargeTestCase: false });
const blankSample = () => ({ input: '', output: '', explanation: '' });

const plainTitle = (html) => {
  if (!html) return '';
  if (!html.includes('<')) return html;
  return (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').trim();
};

const byLanguage = (list) =>
  Object.fromEntries((Array.isArray(list) ? list : []).filter((x) => x?.language).map((x) => [x.language, x.code || '']));

/** Turns an API question (or null for a new one) into editable form state. */
export function formFromQuestion(q) {
  const languages = Array.isArray(q?.languages) && q.languages.length ? q.languages : ['javascript'];
  const solutions = byLanguage(q?.solutionCodes);
  if (q?.solutionCode && q?.solutionLanguage && !solutions[q.solutionLanguage]) solutions[q.solutionLanguage] = q.solutionCode;
  const starterSource = q?.starterCode?.length ? q.starterCode : q?.templateCode;

  return {
    type: q?.type || 'singleCorrectMcq',
    title: plainTitle(q?.title),
    description: deserializeFromHTML(q?.description || ''),
    explanation: deserializeFromHTML(q?.explanation || ''),
    difficulty: q?.difficulty || 'easy',
    points: String(pointsFieldValue(q?.points)),
    maxAttempts: q?.maxAttempts ? String(q.maxAttempts) : '',
    tags: Array.isArray(q?.tags) ? q.tags.filter(Boolean) : [],
    options: (q?.options?.length >= 2 ? q.options : ['', '', '', '']).map((o) => newOption(o || '')),
    correctOption: Number(q?.correctOption ?? 0),
    correctOptions: Array.isArray(q?.correctOptions) ? q.correctOptions.map(Number) : [],
    codeSnippet: deserializeFromHTML(q?.codeSnippet || ''),
    correctAnswer: deserializeFromHTML(q?.correctAnswer || ''),
    languages,
    starter: byLanguage(starterSource),
    driver: byLanguage(q?.driverCode),
    solutions,
    solutionLanguage: q?.solutionLanguage && languages.includes(q.solutionLanguage) ? q.solutionLanguage : languages[0],
    inputFormat: deserializeFromHTML(q?.inputFormat || ''),
    outputFormat: deserializeFromHTML(q?.outputFormat || ''),
    constraints: deserializeFromHTML(q?.constraints || ''),
    sampleIo: q?.sampleIo?.length
      ? q.sampleIo.map((p) => ({ input: p.input ?? '', output: p.output ?? '', explanation: p.explanation ?? '' }))
      : [blankSample()],
    testCases: q?.testCases?.length
      ? q.testCases.map((t) => ({
          input: t.input ?? '',
          expectedOutput: t.expectedOutput ?? '',
          isPublic: t.isPublic !== undefined ? Boolean(t.isPublic) : true,
          isLargeTestCase: Boolean(t.isLargeTestCase),
          ...(t.timeLimit ? { timeLimit: t.timeLimit } : {}),
          ...(t.memoryLimit ? { memoryLimit: t.memoryLimit } : {}),
        }))
      : [blankTest()],
    timeLimit: String(q?.timeLimit || 2),
    memoryLimit: String(q?.memoryLimit || 256),
  };
}

/** The request body for create/update. Kept deterministic so it doubles as the "unsaved changes" fingerprint. */
export function buildPayload(f) {
  const coding = isCodingType(f.type);
  const data = {
    type: f.type,
    title: f.title.trim(),
    description: serializeToHTML(f.description),
    points: parseOptionalPoints(f.points),
    difficulty: f.difficulty,
    tags: f.tags,
    constraints: serializeToHTML(f.constraints),
    explanation: coding ? '' : serializeToHTML(f.explanation),
    inputFormat: coding ? serializeToHTML(f.inputFormat) : '',
    outputFormat: coding ? serializeToHTML(f.outputFormat) : '',
    sampleIo: coding
      ? f.sampleIo
          .filter((p) => String(p.input || '').trim() || String(p.output || '').trim())
          .map((p) => ({ input: p.input || '', output: p.output || '', explanation: String(p.explanation || '').trim() }))
      : [],
    examples: [],
  };
  if (f.maxAttempts !== '') data.maxAttempts = Number(f.maxAttempts);

  if (f.type === 'singleCorrectMcq') {
    data.options = f.options.map((o) => serializeToHTML(o.value));
    data.correctOption = Number(f.correctOption);
  } else if (f.type === 'multipleCorrectMcq') {
    data.options = f.options.map((o) => serializeToHTML(o.value));
    data.correctOptions = [...f.correctOptions].sort((a, b) => a - b);
  } else if (f.type === 'fillInTheBlanks' || f.type === 'fillInTheBlanksCoding') {
    data.codeSnippet = serializeToHTML(f.codeSnippet);
    data.correctAnswer = serializeToHTML(f.correctAnswer);
  }

  if (coding) {
    const starter = f.languages.map((language) => ({ language, code: f.starter[language] || '' }));
    data.languages = f.languages;
    data.starterCode = starter;
    data.testCases = f.testCases.map((t) => ({
      input: t.input,
      expectedOutput: t.expectedOutput,
      isPublic: Boolean(t.isPublic),
      isLargeTestCase: Boolean(t.isLargeTestCase),
      ...(t.timeLimit ? { timeLimit: t.timeLimit } : {}),
      ...(t.memoryLimit ? { memoryLimit: t.memoryLimit } : {}),
    }));
    data.timeLimit = Number(f.timeLimit);
    data.memoryLimit = Number(f.memoryLimit);
    const filled = f.languages.filter((l) => String(f.solutions[l] || '').trim()).map((language) => ({ language, code: f.solutions[language] }));
    if (filled.length) {
      const primary = filled.find((s) => s.language === f.solutionLanguage) || filled[0];
      data.solutionCodes = filled;
      data.solutionCode = primary.code;
      data.solutionLanguage = primary.language;
    }
    if (f.type === 'codingWithDriver') {
      data.templateCode = starter;
      data.driverCode = f.languages.map((language) => ({ language, code: f.driver[language] || '' }));
    }
  }
  return data;
}

/** Sections shown for a question type, in page order. */
export function sectionsFor(type) {
  const list = [
    { id: 'basics', label: 'Basics' },
    { id: 'statement', label: 'Statement' },
  ];
  if (isMcqType(type) || type === 'fillInTheBlanks' || type === 'fillInTheBlanksCoding') list.push({ id: 'answer', label: 'Answer' });
  if (isCodingType(type)) {
    list.push(
      { id: 'io', label: 'Input & output' },
      { id: 'tests', label: 'Test cases' },
      { id: 'languages', label: 'Languages & limits' },
      { id: 'code', label: type === 'codingWithDriver' ? 'Stub & driver' : 'Starter code' },
      { id: 'solution', label: 'Solution' },
    );
  }
  return list;
}

/** Problems per section. `error` blocks saving, `warn` is advisory. */
export function validate(f) {
  const issues = [];
  const add = (section, message, level = 'error') => issues.push({ section, message, level });

  if (!f.title.trim()) add('statement', 'Add a title');
  if (richTextIsEmpty(f.description)) add('statement', 'Add a description');
  if (f.points !== '' && parseOptionalPoints(f.points) == null) add('basics', 'Points must be 0 or more');
  if (f.maxAttempts !== '' && !(Number.isInteger(Number(f.maxAttempts)) && Number(f.maxAttempts) > 0)) add('basics', 'Max attempts must be a whole number above 0');

  if (isMcqType(f.type)) {
    if (f.options.length < 2) add('answer', 'Add at least two options');
    const empty = f.options.findIndex((o) => richTextIsEmpty(o.value));
    if (empty >= 0) add('answer', `Option ${String.fromCharCode(65 + empty)} is empty`);
    if (f.type === 'singleCorrectMcq' && !(f.correctOption >= 0 && f.correctOption < f.options.length)) add('answer', 'Mark the correct option');
    if (f.type === 'multipleCorrectMcq' && f.correctOptions.length === 0) add('answer', 'Mark at least one correct option');
  }
  if (f.type === 'fillInTheBlanksCoding' && richTextIsEmpty(f.codeSnippet)) add('answer', 'Add the code template');
  if ((f.type === 'fillInTheBlanks' || f.type === 'fillInTheBlanksCoding') && richTextIsEmpty(f.correctAnswer)) add('answer', 'Add the correct answer');

  if (isCodingType(f.type)) {
    if (!f.languages.length) add('languages', 'Pick at least one language');
    if (!(Number(f.timeLimit) > 0)) add('languages', 'Time limit must be above 0');
    if (!(Number(f.memoryLimit) > 0)) add('languages', 'Memory limit must be above 0');
    if (!f.testCases.length) add('tests', 'Add at least one test case');
    const incomplete = f.testCases.filter((t) => !String(t.input).trim() || !String(t.expectedOutput).trim()).length;
    if (incomplete) add('tests', `${incomplete} test case${incomplete === 1 ? ' is' : 's are'} missing input or output`);
    if (!f.testCases.some((t) => t.isPublic)) add('tests', 'No public test case, so students see no example run', 'warn');
    const missingStarter = f.languages.filter((l) => !String(f.starter[l] || '').trim());
    if (missingStarter.length) add('code', `Starter code missing for ${missingStarter.join(', ')}`);
    if (f.type === 'codingWithDriver') {
      const missingDriver = f.languages.filter((l) => !String(f.driver[l] || '').trim());
      if (missingDriver.length) add('code', `Driver code missing for ${missingDriver.join(', ')}`);
      const noSlot = f.languages.filter((l) => f.driver[l]?.trim() && !DRIVER_PLACEHOLDERS.some((p) => f.driver[l].includes(p)));
      if (noSlot.length) add('code', `Driver for ${noSlot.join(', ')} needs a {{USER_CODE}} placeholder`);
    }
  }
  return issues;
}