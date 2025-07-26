import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { createEditor, Transforms, Editor, Text } from 'slate';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

// Unchanged: withFormatting, serializeToHTML, deserializeFromHTML, Leaf, Element, Toolbar, RichTextEditor, CollapsibleSection
const withFormatting = editor => {
  const { insertData, insertText } = editor;

  editor.insertData = data => {
    if (data.get('Text')) {
      insertText(data.get('Text'));
    } else {
      insertData(data);
    }
  };

  return editor;
};

const serializeToHTML = nodes => {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  return nodes.map(node => {
    if (Text.isText(node)) {
      let text = node.text;
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.code) text = `<code class="bg-gray-100 px-1 rounded">${text}</code>`;
      return text;
    }

    const children = serializeToHTML(node.children);
    switch (node.type) {
      case 'paragraph':
        return `<p>${children}</p>`;
      case 'code-block':
        return `<pre class="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm">${children}</pre>`;
      case 'bulleted-list':
        return `<ul class="list-disc pl-6">${children}</ul>`;
      case 'numbered-list':
        return `<ol class="list-decimal pl-6">${children}</ol>`;
      case 'list-item':
        return `<li>${children}</li>`;
      default:
        return children;
    }
  }).join('');
};

const deserializeFromHTML = (input) => {
  console.log('[deserializeFromHTML] Input:', { input, type: typeof input });

  if (!input || input === '' || input === null || typeof input !== 'string') {
    console.warn('[deserializeFromHTML] Returning default node for invalid input:', input);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  if (!input.includes('<') || !input.includes('>')) {
    console.log('[deserializeFromHTML] Treating input as plain text:', input);
    return [{ type: 'paragraph', children: [{ text: input.trim() }] }];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(input, 'text/html');
    const body = doc.body;

    const deserializeNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ? [{ text: node.textContent.trim() }] : [{ text: '' }];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return [{ text: '' }];
      }

      const children = Array.from(node.childNodes).flatMap(deserializeNode).filter(child => child);
      if (children.length === 0) {
        children.push({ text: '' });
      }

      switch (node.tagName.toLowerCase()) {
        case 'p':
          return [{ type: 'paragraph', children }];
        case 'pre':
          return [{ type: 'code-block', children }];
        case 'ul':
          return [{ type: 'bulleted-list', children: children.length ? children : [{ type: 'list-item', children: [{ text: '' }] }] }];
        case 'ol':
          return [{ type: 'numbered-list', children: children.length ? children : [{ type: 'list-item', children: [{ text: '' }] }] }];
        case 'li':
          return [{ type: 'list-item', children }];
        case 'strong':
          return children.map(child => ({ ...child, bold: true }));
        case 'em':
          return children.map(child => ({ ...child, italic: true }));
        case 'code':
          return children.map(child => ({ ...child, code: true }));
        default:
          return children;
      }
    };

    const nodes = Array.from(body.childNodes).flatMap(deserializeNode).filter(node => node);
    const result = nodes.length ? nodes : [{ type: 'paragraph', children: [{ text: '' }] }];
    console.log('[deserializeFromHTML] Output:', result);
    return result;
  } catch (err) {
    console.warn('[deserializeFromHTML] Error parsing HTML, treating as plain text:', err, { input });
    return [{ type: 'paragraph', children: [{ text: input.trim() }] }];
  }
};

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }
  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.code) {
    children = <code className="bg-gray-100 px-1 rounded">{children}</code>;
  }
  return <span {...attributes}>{children}</span>;
};

const Element = ({ attributes, children, element }) => {
  switch (element.type) {
    case 'code-block':
      return <pre className="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm" {...attributes}>{children}</pre>;
    case 'bulleted-list':
      return <ul className="list-disc pl-6" {...attributes}>{children}</ul>;
    case 'numbered-list':
      return <ol className="list-decimal pl-6" {...attributes}>{children}</ol>;
    case 'list-item':
      return <li {...attributes}>{children}</li>;
    default:
      return <p {...attributes}>{children}</p>;
  }
};

const Toolbar = () => {
  const editor = useSlate();
  const marks = Editor.marks(editor) || {};
  const toggleMark = (mark) => {
    const isActive = marks[mark];
    if (isActive) {
      Editor.removeMark(editor, mark);
    } else {
      Editor.addMark(editor, mark, true);
    }
  };
  const toggleBlock = (block) => {
    const isActive = isBlockActive(editor, block);
    const isList = ['bulleted-list', 'numbered-list'].includes(block);
    Transforms.unwrapNodes(editor, {
      match: n => ['bulleted-list', 'numbered-list'].includes(n.type),
      split: true,
    });
    const newType = isActive ? 'paragraph' : isList ? 'list-item' : block;
    Transforms.setNodes(editor, { type: newType });
    if (!isActive && isList) {
      Transforms.wrapNodes(editor, { type: block, children: [] });
    }
  };
  const isBlockActive = (editor, block) => {
    const [match] = Editor.nodes(editor, {
      match: n => n.type === block,
    });
    return !!match;
  };

  return (
    <div className="flex space-x-1 p-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleMark('bold'); }}
        className={`px-2 py-1 rounded ${marks.bold ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleMark('italic'); }}
        className={`px-2 py-1 rounded ${marks.italic ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleMark('code'); }}
        className={`px-2 py-1 rounded ${marks.code ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Code"
      >
        <code>Code</code>
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleBlock('code-block'); }}
        className={`px-2 py-1 rounded ${isBlockActive(editor, 'code-block') ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Code Block"
      >
        Code Block
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleBlock('bulleted-list'); }}
        className={`px-2 py-1 rounded ${isBlockActive(editor, 'bulleted-list') ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Bulleted List"
      >
        Bullets
      </button>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); toggleBlock('numbered-list'); }}
        className={`px-2 py-1 rounded ${isBlockActive(editor, 'numbered-list') ? 'bg-indigo-100 text-indigo-800' : 'bg-white'} hover:bg-indigo-100 transition-colors`}
        aria-label="Numbered List"
      >
        Numbers
      </button>
    </div>
  );
};

const RichTextEditor = ({ value, onChange, placeholder, className }) => {
  const editor = useMemo(() => withHistory(withFormatting(withReact(createEditor()))), []);
  const renderElement = useCallback(props => <Element {...props} />, []);
  const renderLeaf = useCallback(props => <Leaf {...props} />, []);

  const initialValue = useMemo(() => {
    if (Array.isArray(value) && value.length > 0 && value.every(node => node.type && Array.isArray(node.children))) {
      console.log('[RichTextEditor] Valid initial value:', value);
      return value;
    }
    console.warn('[RichTextEditor] Invalid initial value, using default:', value);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }, [value]);

  const handleChange = newValue => {
    if (Array.isArray(newValue) && newValue.length > 0 && newValue.every(node => node.type && Array.isArray(node.children))) {
      console.log('[RichTextEditor] Value changed:', newValue);
      onChange(newValue);
    } else {
      console.warn('[RichTextEditor] Invalid Slate value, ignoring update:', newValue);
    }
  };

  const handleKeyDown = event => {
    if (isHotkey('mod+b', event)) {
      event.preventDefault();
      Editor.addMark(editor, 'bold', true);
    }
    if (isHotkey('mod+i', event)) {
      event.preventDefault();
      Editor.addMark(editor, 'italic', true);
    }
    if (isHotkey('mod+`', event)) {
      event.preventDefault();
      Editor.addMark(editor, 'code', true);
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
      <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
        <Toolbar />
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          className="p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-b-lg"
        />
      </Slate>
    </div>
  );
};

const CollapsibleSection = ({ title, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg focus:outline-none"
      >
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        {isOpen ? (
          <ChevronUpIcon className="h-5 w-5 text-gray-600" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 text-gray-600" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 bg-white rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
};

const AdminQuestionForm = ({ onSubmit, initialData, classes = [], defaultClassId }) => {
  const [type, setType] = useState(initialData?.type || 'singleCorrectMcq');
  const [title, setTitle] = useState(deserializeFromHTML(initialData?.title || ''));
  const [description, setDescription] = useState(deserializeFromHTML(initialData?.description || ''));
  const [points, setPoints] = useState(initialData?.points || 10);
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'easy');
  const [tags, setTags] = useState(initialData?.tags || '');
  const [constraints, setConstraints] = useState(deserializeFromHTML(initialData?.constraints || ''));
  const [examples, setExamples] = useState(
    (Array.isArray(initialData?.examples) ? initialData.examples : ['']).map(ex => deserializeFromHTML(ex || ''))
  );
  const [options, setOptions] = useState(
    (Array.isArray(initialData?.options) ? initialData.options : ['', '', '', '']).map(opt => deserializeFromHTML(opt || ''))
  );
  const [correctOption, setCorrectOption] = useState(initialData?.correctOption || 0);
  const [correctOptions, setCorrectOptions] = useState(initialData?.correctOptions || []);
  const [codeSnippet, setCodeSnippet] = useState(deserializeFromHTML(initialData?.codeSnippet || ''));
  const [correctAnswer, setCorrectAnswer] = useState(deserializeFromHTML(initialData?.correctAnswer || ''));
  const [starterCode, setStarterCode] = useState(
    initialData?.starterCode?.map(sc => ({ language: sc.language, code: sc.code })) || []
  );
  const [testCases, setTestCases] = useState(
    (Array.isArray(initialData?.testCases) ? initialData.testCases : [{ input: '', expectedOutput: '', isPublic: true }]).map(tc => ({
      input: tc.input || '',
      expectedOutput: tc.expectedOutput || '',
      isPublic: tc.isPublic !== undefined ? tc.isPublic : true,
    }))
  );
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 2);
  const [memoryLimit, setMemoryLimit] = useState(initialData?.memoryLimit || 256);
  const [maxAttempts, setMaxAttempts] = useState(initialData?.maxAttempts || '');
  const [explanation, setExplanation] = useState(deserializeFromHTML(initialData?.explanation || ''));
  const [languages, setLanguages] = useState(initialData?.languages || ['javascript']);
  const [classIds, setClassIds] = useState(
    initialData?.classes?.map(c => c.classId?.toString()) || (defaultClassId ? [defaultClassId] : [])
  );
  const [inputErrors, setInputErrors] = useState(testCases.map(() => ''));

  // Log initial state for debugging
  useEffect(() => {
    console.log('[AdminQuestionForm] Initial state:', {
      type,
      title,
      description,
      options,
      correctOption,
      correctOptions,
      examples,
      constraints,
      codeSnippet,
      correctAnswer,
      starterCode,
      testCases,
      timeLimit,
      memoryLimit,
      maxAttempts,
      explanation,
      tags,
      languages,
      classIds,
    });
  }, []);

  const supportedLanguages = ['javascript', 'c', 'cpp', 'java', 'python', 'php', 'ruby', 'go'];

  // Default starter code for coding questions
  const getDefaultStarterCode = (lang) => {
    switch (lang) {
      case 'c':
      case 'cpp':
        return `// Reads space-separated integers (e.g., "1 2 5") and outputs their sum
#include <stdio.h>
int main() {
    int a, b, c;
    if (scanf("%d %d %d", &a, &b, &c) != 3) {
        fprintf(stderr, "Error: Expected three space-separated integers\\n");
        return 1;
    }
    printf("%d", a + b + c);
    return 0;
}`;
      case 'javascript':
        return `// Reads space-separated integers from input (e.g., "1 2 5")
const fs = require('fs');
let input = fs.readFileSync('/dev/stdin').toString().trim().split(' ').map(Number);
let result = input[0] + input[1] + input[2];
console.log(result);`;
      case 'python':
        return `# Reads space-separated integers (e.g., "1 2 5")
a, b, c = map(int, input().split())
print(a + b + c)`;
      case 'java':
        return `// Reads space-separated integers (e.g., "1 2 5")
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        int a = scanner.nextInt();
        int b = scanner.nextInt();
        int c = scanner.nextInt();
        System.out.println(a + b + c);
    }
}`;
      case 'php':
        return `<?php
// Reads space-separated integers (e.g., "1 2 5")
$input = trim(fgets(STDIN));
$numbers = array_map('intval', explode(' ', $input));
echo array_sum(array_slice($numbers, 0, 3));
?>`;
      case 'ruby':
        return `# Reads space-separated integers (e.g., "1 2 5")
numbers = gets.strip.split.map(&:to_i)
puts numbers[0] + numbers[1] + numbers[2]`;
      case 'go':
        return `// Reads space-separated integers (e.g., "1 2 5")
package main
import "fmt"
func main() {
    var a, b, c int
    fmt.Scan(&a, &b, &c)
    fmt.Println(a + b + c)
}`;
      default:
        return '// Write your code here';
    }
  };

  // Sync starterCode with selected languages
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      const updatedStarterCode = languages.map(lang => {
        const existing = starterCode.find(sc => sc.language === lang);
        return existing || { language: lang, code: getDefaultStarterCode(lang) };
      });
      setStarterCode(updatedStarterCode);
    } else {
      setStarterCode([]);
    }
  }, [languages, type]);

  // Validate test case input for C/C++
  const validateTestCaseInput = (input, lang) => {
    if (lang === 'c' || lang === 'cpp') {
      const normalizedInput = input.trim();
      const numbers = normalizedInput.split(/\s+/);
      return numbers.every(num => /^\d+$/.test(num)) ? '' : 'Input must be space-separated integers (e.g., "1 2 5")';
    }
    return '';
  };

  // Update input errors when test cases or languages change
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      const errors = testCases.map(tc => languages.some(lang => lang === 'c' || lang === 'cpp')
        ? validateTestCaseInput(tc.input, 'c')
        : '');
      setInputErrors(errors);
    } else {
      setInputErrors(testCases.map(() => ''));
    }
  }, [testCases, languages, type]);

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isPublic: true }]);
    setInputErrors([...inputErrors, '']);
  };

  const handleTestCaseChange = (index, field, value) => {
    const updatedTestCases = [...testCases];
    updatedTestCases[index] = { ...updatedTestCases[index], [field]: value };
    setTestCases(updatedTestCases);

    if (field === 'input' && (languages.includes('c') || languages.includes('cpp'))) {
      const updatedErrors = [...inputErrors];
      updatedErrors[index] = validateTestCaseInput(value, 'c');
      setInputErrors(updatedErrors);
    }
  };

  const handleRemoveTestCase = (index) => {
    setTestCases(testCases.filter((_, i) => i !== index));
    setInputErrors(inputErrors.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  const handleAddOption = () => {
    setOptions([...options, deserializeFromHTML('')]);
  };

  const handleRemoveOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
    if (type === 'singleCorrectMcq' && correctOption >= index && correctOption > 0) {
      setCorrectOption(correctOption - 1);
    }
    if (type === 'multipleCorrectMcq') {
      setCorrectOptions(correctOptions.filter(idx => idx !== index).map(idx => idx > index ? idx - 1 : idx));
    }
  };

  const handleCorrectOptionToggle = (index) => {
    setCorrectOptions(prev =>
      prev.includes(index) ? prev.filter(idx => idx !== index) : [...prev, index]
    );
  };

  const handleAddExample = () => {
    setExamples([...examples, deserializeFromHTML('')]);
  };

  const handleExampleChange = (index, value) => {
    const updatedExamples = [...examples];
    updatedExamples[index] = value;
    setExamples(updatedExamples);
  };

  const handleRemoveExample = (index) => {
    setExamples(examples.filter((_, i) => i !== index));
  };

  const handleLanguageToggle = (lang) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const handleClassToggle = (classId) => {
    setClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleStarterCodeChange = (index, value) => {
    const updatedStarterCode = [...starterCode];
    updatedStarterCode[index].code = value;
    setStarterCode(updatedStarterCode);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!serializeToHTML(title).trim()) {
      alert('Title is required.');
      return;
    }

    if (!serializeToHTML(description).trim()) {
      alert('Description is required.');
      return;
    }

    if (points <= 0) {
      alert('Points must be a positive number.');
      return;
    }

    if (maxAttempts && (isNaN(maxAttempts) || maxAttempts <= 0)) {
      alert('Max attempts must be a positive number.');
      return;
    }

    if (type === 'singleCorrectMcq') {
      if (options.length < 2 || !options.every(opt => serializeToHTML(opt).trim())) {
        alert('Single correct MCQ requires at least two non-empty options.');
        return;
      }
      if (correctOption >= options.length) {
        alert('Correct option index is invalid.');
        return;
      }
    }

    if (type === 'multipleCorrectMcq') {
      if (options.length < 2 || !options.every(opt => serializeToHTML(opt).trim())) {
        alert('Multiple correct MCQ requires at least two non-empty options.');
        return;
      }
      if (correctOptions.length === 0) {
        alert('Multiple correct MCQ requires at least one correct option.');
        return;
      }
      if (correctOptions.some(idx => idx >= options.length)) {
        alert('One or more correct option indices are invalid.');
        return;
      }
    }

    if (type === 'fillInTheBlanks' && !serializeToHTML(correctAnswer).trim()) {
      alert('Fill in the blanks requires a non-empty correct answer.');
      return;
    }

    if (type === 'fillInTheBlanksCoding') {
      if (!serializeToHTML(codeSnippet).trim()) {
        alert('Fill in the blanks (coding) requires a non-empty code snippet.');
        return;
      }
      if (!serializeToHTML(correctAnswer).trim()) {
        alert('Fill in the blanks (coding) requires a non-empty correct answer.');
        return;
      }
    }

    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      if (languages.length === 0) {
        alert('Please select at least one language for coding questions.');
        return;
      }
      if (!languages.every(lang => supportedLanguages.includes(lang))) {
        alert('One or more selected languages are not supported.');
        return;
      }
      if (testCases.length === 0) {
        alert('Please add at least one test case for coding questions.');
        return;
      }
      if (testCases.some(tc => !tc.input.trim() || !tc.expectedOutput.trim())) {
        alert('All test cases must have non-empty input and expected output.');
        return;
      }
      if (inputErrors.some(error => error)) {
        alert('Please fix test case input errors before submitting.');
        return;
      }
      if (starterCode.length !== languages.length) {
        alert('Please provide starter code for all selected languages.');
        return;
      }
      if (starterCode.some(sc => !sc.language || !sc.code.trim())) {
        alert('All starter codes must have a valid language and non-empty code.');
        return;
      }
      if (timeLimit <= 0) {
        alert('Time limit must be a positive number.');
        return;
      }
      if (memoryLimit <= 0) {
        alert('Memory limit must be a positive number.');
        return;
      }
    }

    const questionData = {
      type,
      title: serializeToHTML(title),
      description: serializeToHTML(description),
      points: Number(points),
      difficulty,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      constraints: serializeToHTML(constraints),
      examples: examples.map(ex => serializeToHTML(ex)).filter(ex => ex.trim()),
      explanation: serializeToHTML(explanation),
      classIds,
    };

    if (type === 'singleCorrectMcq') {
      questionData.options = options.map(opt => serializeToHTML(opt));
      questionData.correctOption = Number(correctOption);
    } else if (type === 'multipleCorrectMcq') {
      questionData.options = options.map(opt => serializeToHTML(opt));
      questionData.correctOptions = correctOptions;
    } else if (type === 'fillInTheBlanks' || type === 'fillInTheBlanksCoding') {
      questionData.codeSnippet = serializeToHTML(codeSnippet);
      questionData.correctAnswer = serializeToHTML(correctAnswer);
    }

    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      questionData.languages = languages;
      questionData.starterCode = starterCode.map(sc => ({
        language: sc.language,
        code: sc.code,
      }));
      questionData.testCases = testCases.map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
      }));
      questionData.timeLimit = Number(timeLimit);
      questionData.memoryLimit = Number(memoryLimit);
    }

    if (maxAttempts) {
      questionData.maxAttempts = Number(maxAttempts);
    }

    console.log('[AdminQuestionForm] Submitting:', questionData);
    onSubmit(questionData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <CollapsibleSection title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Question Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              required
            >
              <option value="singleCorrectMcq">Single Correct MCQ</option>
              <option value="multipleCorrectMcq">Multiple Correct MCQ</option>
              <option value="fillInTheBlanks">Fill in the Blanks</option>
              <option value="fillInTheBlanksCoding">Fill in the Blanks (Coding)</option>
              <option value="coding">Coding Problem</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Points</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              required
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Max Attempts (optional)</label>
            <input
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              min="1"
              placeholder="Leave blank for unlimited"
            />
          </div>
        </div>
        {classes.length > 0 && (
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to Classes</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classes.map(cls => (
                <div key={cls._id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={classIds.includes(cls._id)}
                    onChange={() => handleClassToggle(cls._id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    id={`class-${cls._id}`}
                  />
                  <label htmlFor={`class-${cls._id}`} className="ml-2 text-sm text-gray-700">{cls.name}</label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Title and Description">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
            <RichTextEditor
              value={title}
              onChange={setTitle}
              placeholder="Enter question title"
              className="w-full"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="text-lg font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: serializeToHTML(title) || 'No content' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Provide detailed question description"
              className="w-full"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: serializeToHTML(description) || 'No content' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Explanation (optional)</label>
            <RichTextEditor
              value={explanation}
              onChange={setExplanation}
              placeholder="Provide explanation for the solution"
              className="w-full"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: serializeToHTML(explanation) || 'No content' }} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Metadata">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              required
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              placeholder="e.g., array, sorting, algorithm"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="flex flex-wrap gap-2">
                {tags.split(',').map(tag => tag.trim()).filter(tag => tag).map((tag, idx) => (
                  <span key={idx} className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {tag}
                  </span>
                ))}
                {!tags && <span className="text-gray-500 text-sm">No tags</span>}
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {(type === 'singleCorrectMcq' || type === 'multipleCorrectMcq') && (
        <CollapsibleSection title="Multiple Choice Options">
          <div className="space-y-4">
            {options.map((option, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <RichTextEditor
                  value={option}
                  onChange={value => handleOptionChange(idx, value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:bg-red-300 transition-colors"
                  disabled={options.length <= 2}
                  aria-label="Remove option"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Option
            </button>
            {type === 'singleCorrectMcq' && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Option</label>
                <select
                  value={correctOption}
                  onChange={(e) => setCorrectOption(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  required
                >
                  {options.map((_, idx) => (
                    <option key={idx} value={idx}>{`Option ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
            )}
            {type === 'multipleCorrectMcq' && (
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Options (select all that apply)</label>
                <div className="space-y-2">
                  {options.map((_, idx) => (
                    <div key={idx} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={correctOptions.includes(idx)}
                        onChange={() => handleCorrectOptionToggle(idx)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        id={`correct-option-${idx}`}
                      />
                      <label htmlFor={`correct-option-${idx}`} className="ml-2 text-sm text-gray-700">{`Option ${idx + 1}`}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview Options</h3>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center mb-2">
                  {type === 'singleCorrectMcq' ? (
                    <input
                      type="radio"
                      name="options"
                      checked={correctOption === idx}
                      disabled
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={correctOptions.includes(idx)}
                      disabled
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                  )}
                  <span className="ml-2 text-gray-800" dangerouslySetInnerHTML={{ __html: serializeToHTML(opt) || 'No content' }} />
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {(type === 'fillInTheBlanks' || type === 'fillInTheBlanksCoding') && (
        <CollapsibleSection title="Fill in the Blanks">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Code Snippet</label>
              <RichTextEditor
                value={codeSnippet}
                onChange={setCodeSnippet}
                placeholder="Enter code snippet with blanks (e.g., console.log(____);)"
                className="font-mono"
              />
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
                <div className="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm" dangerouslySetInnerHTML={{ __html: serializeToHTML(codeSnippet) || 'No content' }} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer</label>
              <RichTextEditor
                value={correctAnswer}
                onChange={setCorrectAnswer}
                placeholder="Enter the correct answer for the blank"
                className="w-full"
              />
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
                <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: serializeToHTML(correctAnswer) || 'No content' }} />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {(type === 'coding' || type === 'fillInTheBlanksCoding') && (
        <>
          <CollapsibleSection title="Languages and Starter Code">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Supported Languages</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {supportedLanguages.map(lang => (
                    <div key={lang} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={languages.includes(lang)}
                        onChange={() => handleLanguageToggle(lang)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        id={`lang-${lang}`}
                      />
                      <label htmlFor={`lang-${lang}`} className="ml-2 text-sm text-gray-700 capitalize">{lang}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Starter Code</label>
                {starterCode.map((sc, idx) => (
                  <CollapsibleSection key={sc.language} title={`Starter Code for ${sc.language}`} defaultOpen={false}>
                    <textarea
                      value={sc.code}
                      onChange={(e) => handleStarterCodeChange(idx, e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      rows={10}
                      placeholder={`Starter code for ${sc.language}`}
                    />
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
                      <pre className="bg-gray-900 text-white p-4 rounded-lg font-mono text-sm">{sc.code || 'No content'}</pre>
                    </div>
                  </CollapsibleSection>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Constraints and Examples">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Constraints</label>
                <RichTextEditor
                  value={constraints}
                  onChange={setConstraints}
                  placeholder="e.g., 1 <= n <= 10^5"
                  className="w-full"
                />
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
                  <div className="text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: serializeToHTML(constraints) || 'No content' }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Examples</label>
                {examples.map((example, idx) => (
                  <div key={idx} className="flex items-start gap-3 mb-4">
                    <RichTextEditor
                      value={example}
                      onChange={value => handleExampleChange(idx, value)}
                      placeholder={`Example ${idx + 1}`}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveExample(idx)}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:bg-red-300 transition-colors"
                      disabled={examples.length <= 1}
                      aria-label="Remove example"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddExample}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Add Example
                </button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview Examples</h3>
                  {examples.map((ex, idx) => (
                    <div key={idx} className="mb-2">
                      <span className="text-sm font-semibold text-gray-700">Example {idx + 1}</span>
                      <div className="text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: serializeToHTML(ex) || 'No content' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Test Cases">
            <div className="space-y-4">
              {testCases.map((tc, idx) => (
                <CollapsibleSection key={idx} title={`Test Case ${idx + 1}`} defaultOpen={idx === 0}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Input</label>
                      <textarea
                        value={tc.input}
                        onChange={(e) => handleTestCaseChange(idx, 'input', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                        rows={3}
                        placeholder="e.g., 1 2 5"
                      />
                      {inputErrors[idx] && (
                        <p className="mt-1 text-sm text-red-600">{inputErrors[idx]}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Output</label>
                      <textarea
                        value={tc.expectedOutput}
                        onChange={(e) => handleTestCaseChange(idx, 'expectedOutput', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                        rows={3}
                        placeholder="e.g., 8"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <input
                      type="checkbox"
                      checked={tc.isPublic}
                      onChange={(e) => handleTestCaseChange(idx, 'isPublic', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      id={`public-${idx}`}
                    />
                    <label htmlFor={`public-${idx}`} className="ml-2 text-sm text-gray-700">Public Test Case</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTestCase(idx)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-300 transition-colors"
                    disabled={testCases.length <= 1}
                  >
                    <TrashIcon className="h-5 w-5 mr-2" />
                    Remove Test Case
                  </button>
                </CollapsibleSection>
              ))}
              <button
                type="button"
                onClick={handleAddTestCase}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Test Case
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Limits">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time Limit (seconds)</label>
                <input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  required
                  min="1"
                  max="5"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Memory Limit (MB)</label>
                <input
                  type="number"
                  value={memoryLimit}
                  onChange={(e) => setMemoryLimit(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                  required
                  min="128"
                  max="1024"
                />
              </div>
            </div>
          </CollapsibleSection>
        </>
      )}

      <div className="flex justify-end pt-6">
        <button
          type="submit"
          className="inline-flex items-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
        >
          {initialData ? 'Update Question' : 'Create Question'}
        </button>
      </div>
    </form>
  );
};

export default AdminQuestionForm;