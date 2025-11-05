import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { createEditor, Transforms, Editor, Text } from 'slate';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import { ChevronDownIcon, ChevronUpIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

// Custom Slate editor with formatting
const withFormatting = editor => {
  const { insertData, insertText, normalizeNode } = editor;

  editor.insertData = data => {
    const text = data.getData('text/plain');
    if (text) {
      insertText(text);
      return;
    }
    insertData(data);
  };

  editor.normalizeNode = entry => {
    const [node, path] = entry;

    // Ensure all nodes have children array
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

    if (!node.children || !Array.isArray(node.children)) {
      return '';
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
const RichTextEditor = ({ value, onChange, placeholder, className }) => {
  // Create new editor instance only once
  const editor = useMemo(() => withHistory(withFormatting(withReact(createEditor()))), []);
  
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
  const [points, setPoints] = useState(initialData?.points || 10);
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 'easy');
  const [tags, setTags] = useState(
    typeof initialData?.tags === 'string' 
      ? initialData.tags 
      : Array.isArray(initialData?.tags) 
        ? initialData.tags.join(', ') 
        : ''
  );
  const [constraints, setConstraints] = useState(deserializeFromHTML(initialData?.constraints || ''));
  const [examples, setExamples] = useState(
    (Array.isArray(initialData?.examples) ? initialData.examples : ['']).map(ex => deserializeFromHTML(ex))
  );
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
  const [testCases, setTestCases] = useState(
    (Array.isArray(initialData?.testCases) ? initialData.testCases : [{ input: '', expectedOutput: '', isPublic: true }]).map(tc => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isPublic: tc.isPublic !== undefined ? tc.isPublic : true,
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
  // Use initialData ID or timestamp to force editor remount only when question changes
  const editorResetKey = useMemo(() => initialData?._id || initialData?.id || Date.now(), [initialData?._id, initialData?.id]);

  // Update state when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'singleCorrectMcq');
      setTitle(deserializeFromHTML(initialData.title || ''));
      setDescription(deserializeFromHTML(initialData.description || ''));
      setPoints(initialData.points || 10);
      setDifficulty(initialData.difficulty || 'easy');
      setTags(
        typeof initialData.tags === 'string' 
          ? initialData.tags 
          : Array.isArray(initialData.tags) 
            ? initialData.tags.join(', ') 
            : ''
      );
      setConstraints(deserializeFromHTML(initialData.constraints || ''));
      setExamples((Array.isArray(initialData.examples) ? initialData.examples : ['']).map(ex => deserializeFromHTML(ex)));
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
      const tCases = (Array.isArray(initialData.testCases) ? initialData.testCases : [{ input: '', expectedOutput: '', isPublic: true }]).map(tc => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isPublic: tc.isPublic !== undefined ? tc.isPublic : true,
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
    }
  }, [initialData, defaultClassId]);

  const supportedLanguages = ['javascript', 'c', 'cpp', 'java', 'python', 'php', 'ruby', 'go'];

  // Default starter code for coding questions
  const getDefaultStarterCode = useCallback((lang) => {
    switch (lang) {
      case 'c':
      case 'cpp':
        return `// Write your solution here
#include <stdio.h>
int main() {
    // Input handling
    return 0;
}`;
      case 'javascript':
        return `// Write your solution here
function solution() {
    // Input handling
}`;
      case 'python':
        return `# Write your solution here
def solution():
    # Input handling
    pass`;
      case 'java':
        return `// Write your solution here
public class Solution {
    public static void main(String[] args) {
        // Input handling
    }
}`;
      case 'php':
        return `<?php
// Write your solution here
function solution() {
    // Input handling
}
?>`;
      case 'ruby':
        return `# Write your solution here
def solution
    # Input handling
end`;
      case 'go':
        return `// Write your solution here
package main
import "fmt"
func main() {
    // Input handling
}`;
      default:
        return '// Write your code here';
    }
  }, []);

  // Sync starterCode with selected languages
  useEffect(() => {
    if (type === 'coding' || type === 'fillInTheBlanksCoding') {
      setStarterCode(prevStarterCode => {
        // Map over languages and preserve existing code or use default
        const updatedStarterCode = languages.map(lang => {
          const existing = prevStarterCode.find(sc => sc.language === lang);
          return existing || { language: lang, code: getDefaultStarterCode(lang) };
        });
        console.log('[QuestionForm] Syncing starterCode:', {
          languages,
          prevStarterCodeLength: prevStarterCode.length,
          updatedStarterCodeLength: updatedStarterCode.length,
          prevStarterCode,
          updatedStarterCode
        });
        return updatedStarterCode;
      });
    } else {
      setStarterCode([]);
    }
  }, [languages, type, getDefaultStarterCode]);

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

    if (classIds.length === 0) {
      alert('Please select at least one class.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding') && languages.length === 0) {
      alert('Please select at least one language for coding questions.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding') && testCases.length === 0) {
      alert('Please add at least one test case for coding questions.');
      return;
    }

    if ((type === 'coding' || type === 'fillInTheBlanksCoding') && starterCode.length !== languages.length) {
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
    if ((type === 'coding' || type === 'fillInTheBlanksCoding')) {
      const emptyStarterCode = starterCode.filter(sc => !sc.code || sc.code.trim() === '');
      if (emptyStarterCode.length > 0) {
        alert(`Please provide code for: ${emptyStarterCode.map(sc => sc.language).join(', ')}`);
        return;
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
      points: Number(points),
      difficulty,
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      constraints: serializeToHTML(constraints),
      examples: examples.map(ex => serializeToHTML(ex)).filter(ex => ex.trim()),
      explanation: serializeToHTML(explanation),
      maxAttempts: maxAttempts ? Number(maxAttempts) : undefined,
      classIds,
    };

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
      }));
      questionData.timeLimit = Number(timeLimit);
      questionData.memoryLimit = Number(memoryLimit);
    } else if (type === 'coding') {
      questionData.languages = languages;
      questionData.templateCode = starterCode.map(sc => ({
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

    console.log('QuestionForm: Submitting', questionData);
    onSubmit(questionData);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
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
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="text-lg font-semibold text-gray-900" dangerouslySetInnerHTML={{ __html: serializeToHTML(title) || 'No content' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
            <RichTextEditor
              key={`description-${editorResetKey}`}
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Explanation</label>
            <RichTextEditor
              key={`explanation-${editorResetKey}`}
              value={explanation}
              onChange={setExplanation}
              placeholder="Provide explanation for the correct answer"
              className="w-full"
            />
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
              <div className="text-gray-800 prose max-w-none" dangerouslySetInnerHTML={{ __html: serializeToHTML(explanation) || 'No content' }} />
            </div>
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
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview Options</h3>
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center mb-2">
                  <input
                    type={type === 'singleCorrectMcq' ? 'radio' : 'checkbox'}
                    checked={type === 'singleCorrectMcq' ? correctOption === idx : correctOptions.includes(idx)}
                    disabled
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-800" dangerouslySetInnerHTML={{ __html: serializeToHTML(opt) || 'No content' }} />
                </div>
              ))}
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
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Preview</h3>
                <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: serializeToHTML(correctAnswer) || 'No content' }} />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Fill in the Blanks (Coding) or Coding Problem */}
      {(type === 'fillInTheBlanksCoding' || type === 'coding') && (
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
                  key={`constraints-${editorResetKey}`}
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
                      key={`example-${idx}-${editorResetKey}`}
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

      {/* Submit Button */}
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

export default QuestionForm;