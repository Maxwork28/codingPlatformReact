import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { createEditor, Transforms, Editor, Text, Range } from 'slate';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import CodeEditor from '../../student/components/CodeEditor';
import { teacherTestQuestion } from '../../../common/services/api';
import BulkIoPairsEditor, { QuestionFormStepper } from '../../../common/components/BulkIoPairsEditor';
import PasteFullQuestion from '../../../common/components/PasteFullQuestion';
import TestSolutionResults from '../../../common/components/TestSolutionResults';
import { parseOptionalPoints, pointsFieldValue } from '../../../common/utils/optionalPoints';
import { plainTextToSlate, STARTER_STUBS } from '../../../common/utils/parsePastedQuestion';
import {
  withQuestionImages,
  serializeImageHtml,
  deserializeImgNode,
} from '../../../common/utils/questionRichTextImages';
import QuestionImageElement from '../../../common/components/QuestionImageElement';
import InsertQuestionImageButton from '../../../common/components/InsertQuestionImageButton';

// Custom Slate editor with formatting and multi-line paste
const withFormatting = editor => {
  const { insertData: originalInsertData, isInline, isVoid, normalizeNode } = editor;

  editor.isInline = element => (element.type === 'link' ? true : isInline(element));
  editor.isVoid = element => (element.type === 'code-block' ? true : isVoid(element));

  editor.insertData = data => {
    try {
      const text = data.getData('text/plain');
      const html = data.getData('text/html');

      if (html && html.trim() && html.includes('<')) {
        originalInsertData(data);
        return;
      }

      if (text && text.trim()) {
        const lines = text.split(/\r?\n/);

        if (lines.length <= 1) {
          Transforms.insertText(editor, text);
          return;
        }

        if (!editor.selection) {
          Transforms.select(editor, Editor.end(editor, []));
        }
        if (editor.selection && !Range.isCollapsed(editor.selection)) {
          Transforms.delete(editor);
        }

        const paragraphNodes = lines
          .filter(line => line !== undefined && line !== null)
          .map(line => ({ type: 'paragraph', children: [{ text: line || '' }] }));

        if (paragraphNodes.length === 1) {
          Transforms.insertText(editor, lines[0] || '');
        } else if (paragraphNodes.length > 1) {
          const [, ...restParagraphs] = paragraphNodes;
          Transforms.insertText(editor, paragraphNodes[0].children[0].text || '');
          restParagraphs.forEach(paragraph => {
            Transforms.insertNodes(editor, paragraph);
          });
        }
        return;
      }

      originalInsertData(data);
    } catch (error) {
      console.error('[withFormatting] Error in insertData:', error);
      try {
        originalInsertData(data);
      } catch {
        // ignore fallback failure
      }
    }
  };

  editor.normalizeNode = entry => {
    const [node, path] = entry;
    if (node && typeof node === 'object' && !Text.isText(node)) {
      if (!node.children || !Array.isArray(node.children)) {
        Transforms.removeNodes(editor, { at: path });
        return;
      }
    }
    normalizeNode(entry);
  };

  return editor;
};

// Serialize Slate nodes to HTML
const serializeToHTML = nodes => {
  if (!nodes || typeof nodes !== 'object') return '';
  const nodeArray = Array.isArray(nodes) ? nodes : [nodes];

  return nodeArray.map(node => {
    if (!node) return '';
    
    if (Text.isText(node)) {
      let text = node.text || '';
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.code) text = `<code class="bg-gray-100 px-1 rounded">${text}</code>`;
      return text;
    }

    if (node.type === 'image') {
      return serializeImageHtml(node);
    }

    if (!node.children || !Array.isArray(node.children)) {
      return '';
    }

    const children = serializeToHTML(node.children);
    switch (node.type) {
      case 'image':
        return serializeImageHtml(node);
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

// Deserialize HTML to Slate nodes
const deserializeFromHTML = (html) => {
  if (!html || typeof html !== 'string') {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;

    const deserializeNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ? [{ text: node.textContent }] : [];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return [];
      }

      const children = Array.from(node.childNodes).flatMap(deserializeNode);
      const validChildren = children.length ? children : [{ text: '' }];
      
      switch (node.tagName.toLowerCase()) {
        case 'img':
          return deserializeImgNode(node);
        case 'p':
          return [{ type: 'paragraph', children: validChildren }];
        case 'pre':
          return [{ type: 'code-block', children: validChildren }];
        case 'ul':
          return [{ type: 'bulleted-list', children: validChildren.map(child => 
            child.type === 'list-item' ? child : { type: 'list-item', children: [child] }
          ) }];
        case 'ol':
          return [{ type: 'numbered-list', children: validChildren.map(child =>
            child.type === 'list-item' ? child : { type: 'list-item', children: [child] }
          ) }];
        case 'li':
          return [{ type: 'list-item', children: validChildren }];
        case 'strong':
          return children.map(child => Text.isText(child) ? { ...child, bold: true } : child);
        case 'em':
          return children.map(child => Text.isText(child) ? { ...child, italic: true } : child);
        case 'code':
          return children.map(child => Text.isText(child) ? { ...child, code: true } : child);
        case 'br':
          return [{ text: '\n' }];
        default:
          return children.length ? children : [{ text: '' }];
      }
    };

    const nodes = Array.from(body.childNodes).flatMap(deserializeNode);
    const validNodes = nodes.length ? nodes : [{ type: 'paragraph', children: [{ text: '' }] }];
    
    // Ensure all nodes are valid
    return validNodes.map(node => {
      if (Text.isText(node)) {
        return { type: 'paragraph', children: [node] };
      }
      if (!node.children || !Array.isArray(node.children)) {
        return { ...node, children: [{ text: '' }] };
      }
      return node;
    });
  } catch (error) {
    console.error('Error deserializing HTML:', error);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
};

// Leaf component for rendering text with marks
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

// Element component for rendering block elements
const Element = ({ attributes, children, element }) => {
  switch (element.type) {
    case 'image':
      return <QuestionImageElement attributes={attributes} children={children} element={element} />;
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

// Toolbar component for formatting buttons
const Toolbar = ({ allowImages = false }) => {
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
      {allowImages && <InsertQuestionImageButton />}
    </div>
  );
};

// Validate and fix Slate node structure
const validateSlateValue = (value) => {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }

  const fixNode = (node) => {
    if (!node || typeof node !== 'object') {
      return { text: '' };
    }

    if (Text.isText(node)) {
      return { text: node.text || '', ...node };
    }

    const children = node.children && Array.isArray(node.children)
      ? node.children.map(fixNode).filter(Boolean)
      : [{ text: '' }];

    return {
      ...node,
      children: children.length > 0 ? children : [{ text: '' }],
      type: node.type || 'paragraph'
    };
  };

  try {
    return value.map(fixNode).filter(Boolean);
  } catch (error) {
    console.error('Error validating Slate value:', error);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
};

// Slate editor component
const RichTextEditor = ({ value, onChange, placeholder, className, allowImages = false }) => {
  // Create new editor instance only once
  const editor = useMemo(
    () => withHistory((allowImages ? withQuestionImages : (e) => e)(withFormatting(withReact(createEditor())))),
    [allowImages]
  );
  
  // Ensure value is always valid for Slate
  const safeValue = useMemo(() => validateSlateValue(value), [value]);
  
  const renderElement = useCallback(props => <Element {...props} />, []);
  const renderLeaf = useCallback(props => <Leaf {...props} />, []);

  // Wrap onChange to ensure valid values
  const handleChange = useCallback((newValue) => {
    try {
      const validatedValue = validateSlateValue(newValue);
      onChange(validatedValue);
    } catch (error) {
      console.error('Error in RichTextEditor onChange:', error);
    }
  }, [onChange]);

  const handleKeyDown = event => {
    if (isHotkey('mod+b', event)) {
      event.preventDefault();
      const isActive = Editor.marks(editor)?.bold;
      if (isActive) {
        Editor.removeMark(editor, 'bold');
      } else {
        Editor.addMark(editor, 'bold', true);
      }
    }
    if (isHotkey('mod+i', event)) {
      event.preventDefault();
      const isActive = Editor.marks(editor)?.italic;
      if (isActive) {
        Editor.removeMark(editor, 'italic');
      } else {
        Editor.addMark(editor, 'italic', true);
      }
    }
    if (isHotkey('mod+`', event)) {
      event.preventDefault();
      const isActive = Editor.marks(editor)?.code;
      if (isActive) {
        Editor.removeMark(editor, 'code');
      } else {
        Editor.addMark(editor, 'code', true);
      }
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
      <Slate editor={editor} initialValue={safeValue} onChange={handleChange}>
        <Toolbar allowImages={allowImages} />
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

// Collapsible Section Component
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

const QuestionForm = ({ onSubmit, initialData, classes = [], defaultClassId }) => {
  const [type, setType] = useState(initialData?.type || 'singleCorrectMcq');
  const [title, setTitle] = useState(deserializeFromHTML(initialData?.title || ''));
  const [description, setDescription] = useState(deserializeFromHTML(initialData?.description || ''));
  const [inputFormat, setInputFormat] = useState(deserializeFromHTML(initialData?.inputFormat || ''));
  const [outputFormat, setOutputFormat] = useState(deserializeFromHTML(initialData?.outputFormat || ''));
  const [points, setPoints] = useState(pointsFieldValue(initialData?.points));
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'easy');
  const [tags, setTags] = useState(
    typeof initialData?.tags === 'string' 
      ? initialData.tags 
      : Array.isArray(initialData?.tags) 
        ? initialData.tags.join(', ') 
        : ''
  );
  const [constraints, setConstraints] = useState(deserializeFromHTML(initialData?.constraints || ''));
  const [sampleIo, setSampleIo] = useState(() => {
    if (Array.isArray(initialData?.sampleIo) && initialData.sampleIo.length > 0) {
      return initialData.sampleIo.map((p) => ({ input: p.input ?? '', output: p.output ?? '' }));
    }
    return [{ input: '', output: '' }];
  });
  const [options, setOptions] = useState(
    (Array.isArray(initialData?.options) ? initialData.options : ['', '', '', '']).map(opt => deserializeFromHTML(opt))
  );

  const [correctOption, setCorrectOption] = useState(initialData?.correctOption || 0);
  const [correctOptions, setCorrectOptions] = useState(initialData?.correctOptions || []);
  const [codeSnippet, setCodeSnippet] = useState(deserializeFromHTML(initialData?.codeSnippet || ''));
  const [correctAnswer, setCorrectAnswer] = useState(deserializeFromHTML(initialData?.correctAnswer || ''));
  const [starterCode, setStarterCode] = useState(
    initialData?.starterCode?.map(sc => ({ language: sc.language, code: sc.code })) ||
    initialData?.templateCode?.map(tc => ({ language: tc.language, code: tc.code })) ||
    []
  );
  const [driverCode, setDriverCode] = useState(
    initialData?.driverCode?.map(dc => ({ language: dc.language, code: dc.code || '' })) || []
  );
  const [testCases, setTestCases] = useState(
    (Array.isArray(initialData?.testCases) ? initialData.testCases : [{ input: '', expectedOutput: '', isPublic: true }]).map(tc => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isPublic: tc.isPublic !== undefined ? tc.isPublic : true,
      isLargeTestCase: tc.isLargeTestCase || false,
    }))
  );
  const [timeLimit, setTimeLimit] = useState(initialData?.timeLimit || 2);
  const [memoryLimit, setMemoryLimit] = useState(initialData?.memoryLimit || 256);
  const [maxAttempts, setMaxAttempts] = useState(initialData?.maxAttempts || '');
  const [explanation, setExplanation] = useState(deserializeFromHTML(initialData?.explanation || ''));
  const [languages, setLanguages] = useState(initialData?.languages || []);
  const [classIds, setClassIds] = useState(
    initialData?.classIds || 
    initialData?.classes?.map(c => c.classId?.toString()) || 
    (defaultClassId ? [defaultClassId] : [])
  );
  const [inputErrors, setInputErrors] = useState(testCases.map(() => ''));
  const buildSolutionCodesFromInitial = (data, langs = []) => {
    if (Array.isArray(data?.solutionCodes) && data.solutionCodes.length > 0) {
      const fromApi = data.solutionCodes.map((s) => ({ language: s.language, code: s.code || '' }));
      const langList = langs.length > 0 ? langs : fromApi.map((s) => s.language);
      return langList.map((lang) => {
        const existing = fromApi.find((s) => s.language === lang);
        return existing || { language: lang, code: '' };
      });
    }
    const primaryLang = data?.solutionLanguage || langs[0] || 'python';
    const primaryCode = data?.solutionCode || '';
    if (langs.length > 0) {
      return langs.map((lang) => ({ language: lang, code: lang === primaryLang ? primaryCode : '' }));
    }
    return primaryCode ? [{ language: primaryLang, code: primaryCode }] : [];
  };
  const [solutionCodes, setSolutionCodes] = useState(() =>
    buildSolutionCodesFromInitial(initialData, initialData?.languages || [])
  );
  const [solutionLanguage, setSolutionLanguage] = useState(
    initialData?.solutionLanguage || initialData?.languages?.[0] || 'python'
  );
  const activeSolutionCode = solutionCodes.find((s) => s.language === solutionLanguage)?.code ?? '';
  const [isTestingSolution, setIsTestingSolution] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [editorPasteKey, setEditorPasteKey] = useState(0);
  const editorResetKey = `${initialData?._id || initialData?.id || 'new'}-${editorPasteKey}`;
  const [formStep, setFormStep] = useState(1);
  const isCodingType = type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver';
  const formSteps = isCodingType
    ? [
        { id: 1, label: 'Basics' },
        { id: 2, label: 'I/O & tests' },
        { id: 3, label: 'Code' },
      ]
    : [
        { id: 1, label: 'Basics' },
        { id: 2, label: 'Answers' },
      ];
  const totalFormSteps = formSteps.length;

  useEffect(() => {
    setFormStep((s) => Math.min(s, totalFormSteps));
  }, [totalFormSteps]);

  // Update state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'singleCorrectMcq');
      setTitle(deserializeFromHTML(initialData.title || ''));
      setDescription(deserializeFromHTML(initialData.description || ''));
      setInputFormat(deserializeFromHTML(initialData.inputFormat || ''));
      setOutputFormat(deserializeFromHTML(initialData.outputFormat || ''));
      setPoints(pointsFieldValue(initialData.points));
      setDifficulty(initialData.difficulty || 'easy');
      setTags(
        typeof initialData.tags === 'string' 
          ? initialData.tags 
          : Array.isArray(initialData.tags) 
            ? initialData.tags.join(', ') 
            : ''
      );
      setConstraints(deserializeFromHTML(initialData.constraints || ''));
      setSampleIo(
        Array.isArray(initialData.sampleIo) && initialData.sampleIo.length > 0
          ? initialData.sampleIo.map((p) => ({ input: p.input ?? '', output: p.output ?? '' }))
          : [{ input: '', output: '' }]
      );
      setOptions((Array.isArray(initialData.options) ? initialData.options : ['', '', '', '']).map(opt => deserializeFromHTML(opt)));
      setCorrectOption(initialData.correctOption || 0);
      setCorrectOptions(initialData.correctOptions || []);
      setCodeSnippet(deserializeFromHTML(initialData.codeSnippet || ''));
      setCorrectAnswer(deserializeFromHTML(initialData.correctAnswer || ''));
      setStarterCode(
        initialData.starterCode?.map(sc => ({ language: sc.language, code: sc.code })) ||
        initialData.templateCode?.map(tc => ({ language: tc.language, code: tc.code })) ||
        []
      );
      setDriverCode(
        initialData.driverCode?.map(dc => ({ language: dc.language, code: dc.code || '' })) || []
      );
      const tCases = (Array.isArray(initialData.testCases) ? initialData.testCases : [{ input: '', expectedOutput: '', isPublic: true }]).map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic !== undefined ? tc.isPublic : true,
        isLargeTestCase: tc.isLargeTestCase || false,
      }));
      setTestCases(tCases);
      setInputErrors(tCases.map(() => ''));
      setTimeLimit(initialData.timeLimit || 2);
      setMemoryLimit(initialData.memoryLimit || 256);
      setMaxAttempts(initialData.maxAttempts || '');
      setExplanation(deserializeFromHTML(initialData.explanation || ''));
      setLanguages(initialData.languages || []);
      setClassIds(
        initialData.classIds || 
        initialData.classes?.map(c => c.classId?.toString()) || 
        (defaultClassId ? [defaultClassId] : [])
      );
      setSolutionCodes(buildSolutionCodesFromInitial(initialData, initialData.languages || []));
      setSolutionLanguage(initialData.solutionLanguage || (initialData.languages?.[0] || 'python'));
    }
  }, [initialData, defaultClassId]);

  // Sync solutionCodes with selected languages (preserve code per language)
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') {
      setSolutionCodes((prev) =>
        languages.map((lang) => {
          const existing = prev.find((s) => s.language === lang);
          return existing || { language: lang, code: '' };
        })
      );
    } else {
      setSolutionCodes([]);
    }
  }, [languages, type]);

  // Update solutionLanguage when languages change (if current language is not in the list)
  useEffect(() => {
    if ((type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') && languages.length > 0) {
      if (!languages.includes(solutionLanguage)) {
        setSolutionLanguage(languages[0]);
      }
    }
  }, [languages, type, solutionLanguage]);

  const supportedLanguages = ['javascript', 'c', 'cpp', 'java', 'python', 'php', 'ruby', 'go'];

  // Sync starterCode with selected languages (new languages start empty — no default template)
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') {
      setStarterCode(prevStarterCode => {
        const updatedStarterCode = languages.map(lang => {
          const existing = prevStarterCode.find(sc => sc.language === lang);
          return existing || { language: lang, code: '' };
        });
        return updatedStarterCode;
      });
    } else {
      setStarterCode([]);
    }
  }, [languages, type]);

  // Sync driverCode with selected languages (LeetCode-style only)
  useEffect(() => {
    if (type === 'codingWithDriver') {
      setDriverCode(prevDriverCode => {
        const getDefaultDriverCode = (lang) => {
          if (lang === 'python') {
            return 'import json\n\n{{USER_CODE}}\n\nif __name__ == "__main__":\n    data = json.loads(input())\n    result = your_function(data)  # customize param names\n    print(result)';
          }
          if (lang === 'javascript') {
            return '{{USER_CODE}}\n\nconst fs = require(\'fs\');\nconst data = JSON.parse(fs.readFileSync(0, \'utf8\').trim());\nconst result = yourFunction(data);\nconsole.log(typeof result === \'object\' ? JSON.stringify(result) : result);\n';
          }
          return '{{USER_CODE}}\n\n// Add driver logic that reads stdin, calls user function, prints result';
        };
        return languages.map(lang => {
          const existing = prevDriverCode.find(dc => dc.language === lang);
          return existing || { language: lang, code: getDefaultDriverCode(lang) };
        });
      });
    } else {
      setDriverCode([]);
    }
  }, [languages, type]);

  const validateTestCaseInput = () => '';

  // Update input errors when test cases or languages change
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      const errors = testCases.map(tc => languages.some(lang => lang === 'c' || lang === 'cpp')
        ? validateTestCaseInput(tc.input, 'c')
        : '');
      setInputErrors(errors);
    }
  }, [testCases, languages, type]);

  const handleAddTestCase = () => {
    setTestCases([...testCases, { input: '', expectedOutput: '', isPublic: true, isLargeTestCase: false }]);
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
      setCorrectOptions(correctOptions.filter(opt => opt !== index).map(opt => opt > index ? opt - 1 : opt));
    }
  };

  const handleCorrectOptionToggle = (index) => {
    if (type === 'singleCorrectMcq') {
      setCorrectOption(index);
    } else if (type === 'multipleCorrectMcq') {
      setCorrectOptions(prev =>
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index].sort((a, b) => a - b)
      );
    }
  };

  const handleSampleIoChange = (index, field, value) => {
    const next = [...sampleIo];
    next[index] = { ...next[index], [field]: value };
    setSampleIo(next);
  };

  const handleAddSampleIo = () => {
    setSampleIo([...sampleIo, { input: '', output: '' }]);
  };

  const handleRemoveSampleIo = (index) => {
    if (sampleIo.length <= 1) return;
    setSampleIo(sampleIo.filter((_, i) => i !== index));
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

  const handleDriverCodeChange = (index, value) => {
    const updatedDriverCode = [...driverCode];
    updatedDriverCode[index].code = value;
    setDriverCode(updatedDriverCode);
  };

  const handleSolutionCodeChange = (code) => {
    setSolutionCodes((prev) =>
      prev.map((s) => (s.language === solutionLanguage ? { ...s, code } : s))
    );
  };

  const applyPastedQuestion = (parsed) => {
    const langs = parsed.languages?.length ? parsed.languages : ['python'];
    setType('coding');
    setTitle(plainTextToSlate(parsed.title));
    setDescription(plainTextToSlate(parsed.description));
    setInputFormat(plainTextToSlate(parsed.inputFormat));
    setOutputFormat(plainTextToSlate(parsed.outputFormat));
    setConstraints(plainTextToSlate(parsed.constraints));
    setExplanation(plainTextToSlate(parsed.explanation));
    setDifficulty(parsed.difficulty || 'easy');
    if (parsed.points !== '' && parsed.points != null) setPoints(parsed.points);
    setSampleIo(parsed.sampleIo?.length ? parsed.sampleIo : [{ input: '', output: '' }]);
    setTestCases(
      parsed.testCases?.length
        ? parsed.testCases
        : [{ input: '', expectedOutput: '', isPublic: true, isLargeTestCase: false }]
    );
    setLanguages(langs);
    setStarterCode(
      parsed.starterCode?.length
        ? parsed.starterCode
        : langs.map((language) => ({ language, code: STARTER_STUBS[language] || '// Write your code here' }))
    );
    setSolutionCodes(
      parsed.solutionCodes?.length
        ? parsed.solutionCodes
        : langs.map((language) => ({ language, code: '' }))
    );
    setSolutionLanguage(parsed.solutionLanguage || langs[0]);
    setFormStep(1);
    setEditorPasteKey((k) => k + 1);
  };

  // Test solution against test cases
  const handleTestSolution = async () => {
    if (!activeSolutionCode.trim()) {
      alert('Please write a solution first');
      return;
    }
    if (testCases.length === 0) {
      alert('Please add at least one test case');
      return;
    }
    if (testCases.some(tc => !tc.input.trim() || !tc.expectedOutput.trim())) {
      alert('All test cases must have input and expected output');
      return;
    }

    // Check if question exists (for questions that have been saved)
    if (!initialData?._id) {
      alert('Please save the question first before testing. The question needs to be saved to test the solution.');
      return;
    }

    // Check if it's a coding question
    if (type !== 'coding' && type !== 'fillInTheBlanksCoding' && type !== 'codingWithDriver') {
      alert('Solution testing is only available for coding questions');
      return;
    }

    setIsTestingSolution(true);
    setTestResults(null);

    try {
      console.log('[QuestionForm] Testing solution for question:', initialData._id);
      
      // Use the first classId if available, otherwise null (for testing purposes)
      const classIdForTest = classIds && classIds.length > 0 ? classIds[0] : null;
      
      // Call the teacher test API (which also works for admins and drafts)
      const response = await teacherTestQuestion(
        initialData._id,
        activeSolutionCode,
        classIdForTest, // classId is optional for drafts
        solutionLanguage
      );

      const { testResults, passedTestCases, totalTestCases, isCorrect, publicTestCases, hiddenTestCases } = response.data;

      setTestResults({
        message: isCorrect 
          ? `✅ All ${totalTestCases} test cases passed! (${publicTestCases} public, ${hiddenTestCases} hidden)`
          : `⚠️ ${passedTestCases}/${totalTestCases} test cases passed (${publicTestCases} public, ${hiddenTestCases} hidden)`,
        results: testResults,
        totalTestCases,
        passedTestCases,
        isCorrect,
        publicTestCases,
        hiddenTestCases
      });
    } catch (err) {
      console.error('[QuestionForm] Error testing solution:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to test solution';
      setTestResults({
        error: true,
        message: `Error: ${errorMessage}`
      });
    } finally {
      setIsTestingSolution(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    console.log('[QuestionForm] Form submit validation:', {
      type,
      languages,
      starterCodeLength: starterCode.length,
      starterCode: starterCode.map(sc => ({ language: sc.language, codeLength: sc.code?.length })),
      testCasesLength: testCases.length
    });

    if (inputErrors.some(error => error)) {
      alert('Please fix test case input errors before submitting.');
      return;
    }

    // For drafts, classIds are optional (can be empty)
    // For published questions, classIds are required
    if (!initialData?.isDraft && classIds.length === 0) {
      alert('Please select at least one class.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') && languages.length === 0) {
      alert('Please select at least one language for coding questions.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') && testCases.length === 0) {
      alert('Please add at least one test case for coding questions.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver') && starterCode.length !== languages.length) {
      const missingLanguages = languages.filter(lang => !starterCode.find(sc => sc.language === lang));
      console.error('[QuestionForm] Starter code validation failed:', {
        languages,
        starterCodeLanguages: starterCode.map(sc => sc.language),
        missingLanguages
      });
      if (missingLanguages.length > 0) {
        alert(`Please provide starter code for: ${missingLanguages.join(', ')}`);
      } else {
        alert('Please ensure starter code matches selected languages.');
      }
      return;
    }

    // Validate that all starter code entries have actual code
    if ((type === 'coding' || type === 'fillInTheBlanksCoding' || type === 'codingWithDriver')) {
      const emptyStarterCode = starterCode.filter(sc => !sc.code || sc.code.trim() === '');
      if (emptyStarterCode.length > 0) {
        alert(`Please provide starter code for: ${emptyStarterCode.map(sc => sc.language).join(', ')}`);
        return;
      }
      if (type === 'codingWithDriver') {
        const emptyDriverCode = driverCode.filter(dc => !dc.code || dc.code.trim() === '');
        if (emptyDriverCode.length > 0) {
          alert(`Please provide driver code for: ${emptyDriverCode.map(dc => dc.language).join(', ')}`);
          return;
        }
        const missingPlaceholder = driverCode.filter(dc => !dc.code.includes('{{USER_CODE}}') && !dc.code.includes('// USER_CODE_HERE') && !dc.code.includes('# USER_CODE_HERE'));
        if (missingPlaceholder.length > 0) {
          alert(`Driver code must contain {{USER_CODE}} or // USER_CODE_HERE or # USER_CODE_HERE. Missing in: ${missingPlaceholder.map(dc => dc.language).join(', ')}`);
          return;
        }
      }
    }

    if ((type === 'singleCorrectMcq' || type === 'multipleCorrectMcq') && options.length < 2) {
      alert('Please provide at least two options for MCQ questions.');
      return;
    }

    if (type === 'singleCorrectMcq' && correctOption === null) {
      alert('Please select a correct option for single correct MCQ.');
      return;
    }

    if (type === 'multipleCorrectMcq' && correctOptions.length === 0) {
      alert('Please select at least one correct option for multiple correct MCQ.');
      return;
    }

    const questionData = {
      type,
      title: serializeToHTML(title),
      description: serializeToHTML(description),
      points: parseOptionalPoints(points),
      difficulty,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      constraints: serializeToHTML(constraints),
      explanation: serializeToHTML(explanation),
      maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      classIds,
    };

    const codingTypes = ['fillInTheBlanksCoding', 'coding', 'codingWithDriver'];
    if (codingTypes.includes(type)) {
      questionData.inputFormat = serializeToHTML(inputFormat);
      questionData.outputFormat = serializeToHTML(outputFormat);
      questionData.sampleIo = sampleIo
        .filter((p) => (p.input || '').trim() !== '' || (p.output || '').trim() !== '')
        .map((p) => ({ input: p.input || '', output: p.output || '' }));
      questionData.examples = [];
    } else {
      questionData.inputFormat = '';
      questionData.outputFormat = '';
      questionData.sampleIo = [];
      questionData.examples = [];
    }

    if (type === 'singleCorrectMcq') {
      questionData.options = options.map(opt => serializeToHTML(opt));
      questionData.correctOption = Number(correctOption);
    } else if (type === 'multipleCorrectMcq') {
      questionData.options = options.map(opt => serializeToHTML(opt));
      questionData.correctOptions = correctOptions;
    } else if (type === 'fillInTheBlanks') {
      questionData.correctAnswer = serializeToHTML(correctAnswer);
    } else if (type === 'fillInTheBlanksCoding') {
      questionData.languages = languages;
      questionData.templateCode = starterCode.map(sc => ({
        language: sc.language,
        code: sc.code,
      }));
      questionData.testCases = testCases.map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
        isLargeTestCase: tc.isLargeTestCase,
      }));
      questionData.timeLimit = Number(timeLimit);
      questionData.memoryLimit = Number(memoryLimit);
      const filledSolutions = solutionCodes.filter((s) => (s.code || '').trim());
      if (filledSolutions.length > 0) {
        questionData.solutionCodes = filledSolutions;
        const primary = filledSolutions.find((s) => s.language === solutionLanguage) || filledSolutions[0];
        questionData.solutionCode = primary.code;
        questionData.solutionLanguage = primary.language;
      }
    } else if (type === 'coding' || type === 'codingWithDriver') {
      questionData.languages = languages;
      questionData.templateCode = starterCode.map(sc => ({
        language: sc.language,
        code: sc.code,
      }));
      questionData.testCases = testCases.map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic,
        isLargeTestCase: tc.isLargeTestCase,
      }));
      questionData.timeLimit = Number(timeLimit);
      questionData.memoryLimit = Number(memoryLimit);
      const filledSolutions = solutionCodes.filter((s) => (s.code || '').trim());
      if (filledSolutions.length > 0) {
        questionData.solutionCodes = filledSolutions;
        const primary = filledSolutions.find((s) => s.language === solutionLanguage) || filledSolutions[0];
        questionData.solutionCode = primary.code;
        questionData.solutionLanguage = primary.language;
      }
      if (type === 'codingWithDriver') {
        questionData.driverCode = driverCode.map(dc => ({
          language: dc.language,
          code: dc.code,
        }));
      }
    }

    console.log('QuestionForm: Submitting', questionData);
    onSubmit(questionData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <PasteFullQuestion onApply={applyPastedQuestion} />
      <QuestionFormStepper step={formStep} steps={formSteps} onStepChange={setFormStep} />

      {formStep === 1 && (
      <>
      {/* Basic Information */}
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
              <option value="codingWithDriver">Coding (LeetCode-style)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Points (optional)</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
              min="0"
              placeholder="Leave blank if not scored"
            />
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Max Attempts (optional)</label>
          <input
            type="number"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
            min="1"
            placeholder="Leave blank for unlimited attempts"
          />
        </div>
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
      </CollapsibleSection>

      {/* Title and Description */}
      <CollapsibleSection title="Title and Description">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
            <RichTextEditor
              key={`title-${editorResetKey}`}
              value={title}
              onChange={setTitle}
              placeholder="Enter question title"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
              <span className="ml-2 font-normal text-gray-500">
                (use Image in the toolbar, or paste a screenshot)
              </span>
            </label>
            <RichTextEditor
              key={`description-${editorResetKey}`}
              value={description}
              onChange={setDescription}
              placeholder="Provide detailed question description"
              className="w-full"
              allowImages
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Explanation</label>
            <RichTextEditor
              key={`explanation-${editorResetKey}`}
              value={explanation}
              onChange={setExplanation}
              placeholder="Provide explanation for the correct answer"
              className="w-full"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Metadata */}
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
          </div>
        </div>
      </CollapsibleSection>
      </>
      )}

      {formStep === 2 && (
      <>
      {/* MCQ Options */}
      {(type === 'singleCorrectMcq' || type === 'multipleCorrectMcq') && (
        <CollapsibleSection title="Multiple Choice Options">
          <div className="space-y-4">
            {options.map((option, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <RichTextEditor
                  key={`option-${idx}-${editorResetKey}`}
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
            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {type === 'singleCorrectMcq' ? 'Correct Option' : 'Correct Options (select all that apply)'}
              </label>
              <div className="space-y-2">
                {options.map((_, idx) => (
                  <div key={idx} className="flex items-center">
                    <input
                      type={type === 'singleCorrectMcq' ? 'radio' : 'checkbox'}
                      checked={type === 'singleCorrectMcq' ? correctOption === idx : correctOptions.includes(idx)}
                      onChange={() => handleCorrectOptionToggle(idx)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      id={`option-${idx}`}
                    />
                    <label htmlFor={`option-${idx}`} className="ml-2 text-sm text-gray-700">{`Option ${idx + 1}`}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Fill in the Blanks */}
      {type === 'fillInTheBlanks' && (
        <CollapsibleSection title="Fill in the Blanks">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer</label>
              <RichTextEditor
                key={`correctAnswer-${editorResetKey}`}
                value={correctAnswer}
                onChange={setCorrectAnswer}
                placeholder="Correct answer"
                className="w-full"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Fill in the Blanks (Coding) or Coding Problem */}
      {(type === 'fillInTheBlanksCoding' || type === 'coding' || type === 'codingWithDriver') && (
        <>
          <CollapsibleSection title="Languages">
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
          </CollapsibleSection>

          <CollapsibleSection title="I/O format & sample cases" defaultOpen>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Input format (optional)</label>
                <p className="text-xs text-gray-500 mb-2">How students should read stdin or arguments.</p>
                <RichTextEditor
                  key={`inputFormat-${editorResetKey}`}
                  value={inputFormat}
                  onChange={setInputFormat}
                  placeholder="e.g. First line: n. Second line: n space-separated integers."
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Output format (optional)</label>
                <p className="text-xs text-gray-500 mb-2">Expected stdout or printed result shape.</p>
                <RichTextEditor
                  key={`outputFormat-${editorResetKey}`}
                  value={outputFormat}
                  onChange={setOutputFormat}
                  placeholder="e.g. Print a single integer on one line."
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sample input / output</label>
                <p className="text-xs text-gray-500 mb-2">Shown to students. Paste many pairs at once, or edit the compact table.</p>
                <BulkIoPairsEditor
                  items={sampleIo}
                  onChange={setSampleIo}
                  emptyItem={{ input: '', output: '' }}
                  inputKey="input"
                  outputKey="output"
                  minItems={1}
                  addLabel="Add sample"
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Constraints">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Constraints</label>
                <RichTextEditor
                  key={`constraints-${editorResetKey}`}
                  value={constraints}
                  onChange={setConstraints}
                  placeholder="e.g., 1 <= n <= 10^5"
                  className="w-full"
                />
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Test Cases">
            <p className="text-xs text-gray-500 mb-3">Paste many cases at once, or edit rows. Public cases are shown to students.</p>
            <BulkIoPairsEditor
              items={testCases}
              onChange={setTestCases}
              emptyItem={{ input: '', expectedOutput: '', isPublic: true, isLargeTestCase: false }}
              inputKey="input"
              outputKey="expectedOutput"
              showFlags
              minItems={1}
              addLabel="Add test case"
              errors={inputErrors}
            />
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
      </>
      )}

      {formStep === 3 && isCodingType && (
        <>
          <CollapsibleSection title="Starter Code">
            <div className="space-y-4">
              {starterCode.map((sc, idx) => (
                <CollapsibleSection key={sc.language} title={`Starter Code for ${sc.language}`} defaultOpen={false}>
                  <textarea
                    value={sc.code}
                    onChange={(e) => handleStarterCodeChange(idx, e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                    rows={10}
                    placeholder={`Starter code for ${sc.language}`}
                  />
                </CollapsibleSection>
              ))}
              {starterCode.length === 0 && (
                <p className="text-sm text-gray-500">Select languages in the previous step first.</p>
              )}
            </div>
          </CollapsibleSection>

          {type === 'codingWithDriver' && (
            <CollapsibleSection title="Driver Code (LeetCode-style - handles input/output)" defaultOpen={false}>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Driver code reads test input, calls the student&apos;s function, and prints the result. Include <code className="bg-gray-100 px-1 rounded">{'{{USER_CODE}}'}</code>, <code className="bg-gray-100 px-1 rounded">// USER_CODE_HERE</code>, or <code className="bg-gray-100 px-1 rounded"># USER_CODE_HERE</code> where student code is injected.
                </p>
                {driverCode.map((dc, idx) => (
                  <CollapsibleSection key={dc.language} title={`Driver for ${dc.language}`} defaultOpen={false}>
                    <textarea
                      value={dc.code}
                      onChange={(e) => handleDriverCodeChange(idx, e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                      rows={12}
                      placeholder={`Driver code for ${dc.language}`}
                    />
                  </CollapsibleSection>
                ))}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Solution Code (Optional)">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Language</label>
                <select
                  value={solutionLanguage}
                  onChange={(e) => setSolutionLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
                >
                  {languages.map(lang => (
                    <option key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Solution Code</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CodeEditor
                    key={`solution-${solutionLanguage}-${editorResetKey}`}
                    value={activeSolutionCode}
                    onChange={handleSolutionCodeChange}
                    language={solutionLanguage}
                    disabled={false}
                    isFillInTheBlanks={false}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Write the solution code here. Save the question first, then you can test it against all test cases (including hidden ones).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestSolution}
                  disabled={isTestingSolution || !activeSolutionCode.trim() || testCases.length === 0 || !initialData?._id}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isTestingSolution ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    'Test Solution'
                  )}
                </button>
              </div>
              {testResults && <TestSolutionResults testResults={testResults} />}
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Step nav + save */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <button
          type="button"
          onClick={() => setFormStep((s) => Math.max(1, s - 1))}
          disabled={formStep === 1}
          className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-40"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--card-border)', backgroundColor: 'var(--background-light)' }}
        >
          Back
        </button>
        <div className="flex gap-3">
          {formStep < totalFormSteps && (
            <button
              type="button"
              onClick={() => setFormStep((s) => Math.min(totalFormSteps, s + 1))}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
            >
              Next
            </button>
          )}
          <button
            type="submit"
            className="inline-flex items-center px-6 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {initialData?._id
              ? (initialData?.isDraft ? 'Update Draft' : 'Update Question')
              : 'Save as Draft'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default QuestionForm;