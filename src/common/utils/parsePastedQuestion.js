/**
 * Parse a coding-question dump copied from docs / Word / PDFs.
 *
 * Labels are on their own line. Content follows until the next label.
 * Multiple questions in one paste are split when a new Title heading appears.
 */

const LANGUAGE_ALIASES = {
  python: 'python',
  py: 'python',
  cpp: 'cpp',
  'c++': 'cpp',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  node: 'javascript',
  c: 'c',
  php: 'php',
  ruby: 'ruby',
  go: 'go',
  golang: 'go',
};

const DIFFICULTY_ALIASES = {
  easy: 'easy',
  e: 'easy',
  medium: 'medium',
  med: 'medium',
  moderate: 'medium',
  hard: 'hard',
  difficult: 'hard',
};

export const STARTER_STUBS = {
  javascript: '// Write your code here',
  python: '# Write your code here',
  java: '// Write your code here',
  c: '// Write your code here',
  cpp: '// Write your code here',
  php: '// Write your code here',
  ruby: '# Write your code here',
  go: '// Write your code here',
};

export function plainTextToSlate(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  const lines = raw.length ? raw.split('\n') : [''];
  return lines.map((line) => ({ type: 'paragraph', children: [{ text: line }] }));
}

function matchHeading(line) {
  const t = String(line || '').trim();
  if (!t) return null;

  const simple = [
    ['title', /^title$/i],
    ['difficulty', /^difficulty$/i],
    ['description', /^(problem\s*statement|description)$/i],
    ['inputFormat', /^input\s*format$/i],
    ['outputFormat', /^output\s*format$/i],
    ['constraints', /^constraints?$/i],
    ['explanation', /^explanations?$/i],
    ['solutionLink', /^solution\s*links?$/i],
  ];
  for (const [key, re] of simple) {
    if (re.test(t)) return { key };
  }

  let m = t.match(/^sample\s*input(?:\s*(\d+))?$/i);
  if (m) return { key: 'sampleInput', index: m[1] || null };
  m = t.match(/^sample\s*output(?:\s*(\d+))?$/i);
  if (m) return { key: 'sampleOutput', index: m[1] || null };
  m = t.match(/^test\s*cases?\s*input(?:\s*(\d+))?$/i);
  if (m) return { key: 'testInput', index: m[1] || null };
  m = t.match(/^test\s*cases?\s*output(?:\s*(\d+))?$/i);
  if (m) return { key: 'testOutput', index: m[1] || null };

  m = t.match(/^(python|py|cpp|c\+\+|java|javascript|js|node|php|ruby|go|golang)(?:\s+code)?$/i);
  if (m) return { key: 'code', language: normalizeLanguage(m[1]) };
  m = t.match(/^c\s+code$/i);
  if (m) return { key: 'code', language: 'c' };

  return null;
}

function normalizeLanguage(raw) {
  return LANGUAGE_ALIASES[String(raw || '').trim().toLowerCase()] || null;
}

function splitSections(raw) {
  const lines = String(raw || '').replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let current = null;

  const pushCurrent = () => {
    if (!current) return;
    current.body = current.lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    sections.push(current);
  };

  for (const line of lines) {
    const heading = matchHeading(line);
    if (heading) {
      pushCurrent();
      current = { ...heading, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  pushCurrent();
  return sections;
}

function parseDifficultyBlock(body) {
  const lines = String(body || '').split('\n');
  let difficulty = '';
  let points = '';
  let i = 0;
  while (i < lines.length && !String(lines[i]).trim()) i += 1;
  if (i >= lines.length) return { difficulty, points, leftover: '' };

  const first = String(lines[i]).trim();
  const tokens = first.split(/\s+/);
  const maybeDiff = DIFFICULTY_ALIASES[tokens[0].toLowerCase()];
  if (maybeDiff) {
    difficulty = maybeDiff;
    if (tokens.length > 1 && /^\d+(\.\d+)?$/.test(tokens[1])) {
      points = tokens[1];
    }
    i += 1;
  }

  while (i < lines.length && !String(lines[i]).trim()) i += 1;
  if (i < lines.length && /^\d+(\.\d+)?$/.test(String(lines[i]).trim()) && !points) {
    points = String(lines[i]).trim();
    i += 1;
  }

  const leftover = lines.slice(i).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return { difficulty, points, leftover };
}

function pairIndexed(inputs, outputs) {
  const keys = [...new Set([...Object.keys(inputs), ...Object.keys(outputs)])]
    .sort((a, b) => Number(a) - Number(b));
  return keys
    .map((k) => ({
      input: String(inputs[k] || '').replace(/\s+$/, ''),
      output: String(outputs[k] || '').replace(/\s+$/, ''),
    }))
    .filter((p) => p.input.trim() || p.output.trim());
}

function emptyQuestion() {
  return {
    title: '',
    difficulty: '',
    points: '',
    description: '',
    inputFormat: '',
    outputFormat: '',
    constraints: '',
    explanation: '',
    sampleInputs: {},
    sampleOutputs: {},
    testInputs: {},
    testOutputs: {},
    sampleAuto: 0,
    testAuto: 0,
    codes: {},
  };
}

function finalizeQuestion(q) {
  const sampleIo = pairIndexed(q.sampleInputs, q.sampleOutputs);
  const hiddenTests = pairIndexed(q.testInputs, q.testOutputs);
  const publicFromSamples = sampleIo.map((p) => ({
    input: p.input,
    expectedOutput: p.output,
    isPublic: true,
    isLargeTestCase: false,
  }));
  const hidden = hiddenTests.map((p) => ({
    input: p.input,
    expectedOutput: p.output,
    isPublic: false,
    isLargeTestCase: false,
  }));
  const testCases = hidden.length ? [...publicFromSamples, ...hidden] : publicFromSamples;
  const solutionCodes = Object.entries(q.codes)
    .filter(([, code]) => String(code || '').trim())
    .map(([language, code]) => ({ language, code: String(code).replace(/\s+$/, '') }));
  const languages = solutionCodes.map((s) => s.language);
  const starterCode = languages.map((language) => ({
    language,
    code: STARTER_STUBS[language] || '// Write your code here',
  }));

  return {
    type: 'coding',
    title: q.title.trim(),
    difficulty: q.difficulty || 'easy',
    points: q.points,
    description: q.description.trim(),
    inputFormat: q.inputFormat.trim(),
    outputFormat: q.outputFormat.trim(),
    constraints: q.constraints.trim(),
    explanation: q.explanation.trim(),
    sampleIo: sampleIo.length ? sampleIo : [{ input: '', output: '' }],
    testCases: testCases.length
      ? testCases
      : [{ input: '', expectedOutput: '', isPublic: true, isLargeTestCase: false }],
    languages,
    solutionCodes,
    starterCode,
    solutionLanguage: languages[0] || 'python',
  };
}

function applySection(q, section) {
  const body = section.body || '';
  switch (section.key) {
    case 'title':
      q.title = body.split('\n').map((l) => l.trim()).filter(Boolean)[0] || body.trim();
      break;
    case 'difficulty': {
      const parsed = parseDifficultyBlock(body);
      if (parsed.difficulty) q.difficulty = parsed.difficulty;
      if (parsed.points) q.points = parsed.points;
      if (parsed.leftover && !q.description) q.description = parsed.leftover;
      break;
    }
    case 'description':
      q.description = body;
      break;
    case 'inputFormat':
      q.inputFormat = body;
      break;
    case 'outputFormat':
      q.outputFormat = body;
      break;
    case 'constraints':
      q.constraints = body;
      break;
    case 'explanation':
      q.explanation = q.explanation ? `${q.explanation}\n${body}` : body;
      break;
    case 'solutionLink':
      break;
    case 'sampleInput': {
      const idx = section.index || String(++q.sampleAuto || 1);
      q.sampleAuto = Math.max(q.sampleAuto, Number(idx) || 0);
      q.sampleInputs[idx] = body;
      break;
    }
    case 'sampleOutput': {
      const idx = section.index || String(Math.max(q.sampleAuto, 1));
      q.sampleOutputs[idx] = body;
      break;
    }
    case 'testInput': {
      const idx = section.index || String(++q.testAuto || 1);
      q.testAuto = Math.max(q.testAuto, Number(idx) || 0);
      q.testInputs[idx] = body;
      break;
    }
    case 'testOutput': {
      const idx = section.index || String(Math.max(q.testAuto, 1));
      q.testOutputs[idx] = body;
      break;
    }
    case 'code':
      if (section.language) q.codes[section.language] = body;
      break;
    default:
      break;
  }
}

export function parsePastedQuestions(raw) {
  const sections = splitSections(raw);
  if (sections.length === 0) return [];

  const questions = [];
  let current = emptyQuestion();
  let started = false;

  for (const section of sections) {
    if (section.key === 'title' && started && current.title) {
      questions.push(finalizeQuestion(current));
      current = emptyQuestion();
    }
    applySection(current, section);
    started = true;
  }

  if (started && (current.title || current.description || current.solutionCodes?.length || Object.keys(current.codes).length)) {
    questions.push(finalizeQuestion(current));
  }

  return questions.filter((q) => q.title || q.description || q.solutionCodes.length > 0);
}

export function summarizePastedQuestion(q) {
  const langs = q.languages?.length ? q.languages.join(', ') : 'no solutions';
  const samples = (q.sampleIo || []).filter((p) => p.input || p.output).length;
  const tests = (q.testCases || []).filter((t) => t.input || t.expectedOutput).length;
  return `${q.title || 'Untitled'} · ${samples} sample${samples === 1 ? '' : 's'} · ${tests} test${tests === 1 ? '' : 's'} · ${langs}`;
}
