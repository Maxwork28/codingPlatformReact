import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-java';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-ruby';
import 'ace-builds/src-noconflict/mode-php';
import 'ace-builds/src-noconflict/mode-golang';
import 'ace-builds/src-noconflict/theme-monokai';

/** Normalize newlines so parent/child string compare matches (fixes echo + unwanted Ace resets). */
const norm = (s) => (s == null ? '' : String(s)).replace(/\r\n/g, '\n');

const CodeEditor = ({ value, onChange, defaultValue, language, height = '400px', disabled, isFillInTheBlanks = false }) => {
  const languageModeMap = {
    javascript: 'javascript',
    python: 'python',
    c: 'c_cpp',
    cpp: 'c_cpp',
    java: 'java',
    php: 'php',
    ruby: 'ruby',
    go: 'golang',
  };

  const getDefaultCode = (lang) => {
    const templates = {
      javascript: `// Write your code here`,
      python: `# Write your code here`,
      java: `// Write your code here`,
      c: `// Write your code here`,
      cpp: `// Write your code here`,
      php: `// Write your code here`,
      ruby: `# Write your code here`,
      go: `// Write your code here`,
    };
    return templates[lang] || '// Write your code here';
  };

  const mode = languageModeMap[language] || 'javascript';
  const defaultCode = typeof defaultValue === 'string' ? defaultValue : getDefaultCode(language);
  const safeValue = typeof value === 'string' ? value : defaultCode;
  const editorRef = useRef(null);
  /** Last payload sent to parent; used to tell external prop updates from local typing. */
  const lastEmittedToParentRef = useRef(null);
  /** Last good editor text (display) for revert / copy when uncontrolled. */
  const lastDisplayRef = useRef(norm(safeValue).replace(/___FILL_IN_THE_BLANK___/g, '// Write your code here'));
  const [editorValue, setEditorValue] = useState(() =>
    safeValue.replace(/___FILL_IN_THE_BLANK___/g, '// Write your code here')
  );
  const [editableRanges, setEditableRanges] = useState([]);
  const markersRef = useRef([]);
  const [blanks, setBlanks] = useState([]);
  const [templateParts, setTemplateParts] = useState([]);

  const toDisplay = useCallback(
    (stored) => (typeof stored === 'string' ? stored : '').replace(/___FILL_IN_THE_BLANK___/g, '// Write your code here'),
    []
  );

  const applyMarkersToSession = useCallback((editor, storedValue) => {
    const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
    const lines = storedValue.split('\n');
    const ranges = [];

    lines.forEach((line, lineIndex) => {
      const matches = [...line.matchAll(placeholderRegex)];
      matches.forEach((match) => {
        ranges.push({
          start: { row: lineIndex, column: match.index },
          end: { row: lineIndex, column: match.index + match[0].length },
        });
      });
    });

    markersRef.current.forEach((m) => editor.session.removeMarker(m));
    markersRef.current = [];

    if (ranges.length === 0) return;

    const Range = window.ace.acequire('ace/range').Range;
    let lastEnd = { row: 0, column: 0 };

    ranges.forEach((range, index) => {
      if (index === 0 && (range.start.row > 0 || range.start.column > 0)) {
        const nonEditableRange = new Range(0, 0, range.start.row, range.start.column);
        markersRef.current.push(editor.session.addMarker(nonEditableRange, 'ace_non_editable', 'line', false));
      }
      if (index > 0) {
        const prevRange = ranges[index - 1];
        const nonEditableRange = new Range(
          prevRange.end.row,
          prevRange.end.column,
          range.start.row,
          range.start.column
        );
        markersRef.current.push(editor.session.addMarker(nonEditableRange, 'ace_non_editable', 'line', false));
      }
      const editableRange = new Range(range.start.row, range.start.column, range.end.row, range.end.column);
      markersRef.current.push(editor.session.addMarker(editableRange, 'ace_editable', 'text', false));
      lastEnd = range.end;
    });

    const lastLine = lines.length - 1;
    const lastCol = lines[lastLine].length;
    if (lastEnd.row < lastLine || lastEnd.column < lastCol) {
      const nonEditableRange = new Range(lastEnd.row, lastEnd.column, lastLine, lastCol);
      markersRef.current.push(editor.session.addMarker(nonEditableRange, 'ace_non_editable', 'line', false));
    }
  }, []);

  const parseEditableRanges = useCallback((storedValue) => {
    const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
    const lines = storedValue.split('\n');
    const ranges = [];
    lines.forEach((line, lineIndex) => {
      const matches = [...line.matchAll(placeholderRegex)];
      matches.forEach((match) => {
        ranges.push({
          start: { row: lineIndex, column: match.index },
          end: { row: lineIndex, column: match.index + match[0].length },
        });
      });
    });
    return ranges;
  }, []);

  useEffect(() => {
    if (!isFillInTheBlanks) {
      setBlanks([]);
      setTemplateParts([]);
      return;
    }
    const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    const blanksArr = [];
    while ((match = placeholderRegex.exec(defaultCode)) !== null) {
      parts.push(defaultCode.slice(lastIndex, match.index));
      blanksArr.push('');
      lastIndex = match.index + match[0].length;
    }
    parts.push(defaultCode.slice(lastIndex));
    setTemplateParts(parts);
    setBlanks(blanksArr);
    let display = '';
    for (let i = 0; i < parts.length - 1; i++) {
      display += parts[i] + '// Write your code here';
    }
    display += parts[parts.length - 1];
    setEditorValue(display);
  }, [defaultCode, isFillInTheBlanks]);

  const reconstructTemplate = (userBlanks) => {
    let result = '';
    for (let i = 0; i < templateParts.length - 1; i++) {
      result += templateParts[i] + (userBlanks[i] || '');
    }
    result += templateParts[templateParts.length - 1];
    return result;
  };

  const handleFillInTheBlanksChange = (newValue) => {
    const newBlanks = [];
    for (let i = 0; i < blanks.length; i++) {
      const before = templateParts[i];
      const after = templateParts[i + 1];
      const startIdx = newValue.indexOf(before) + before.length;
      let endIdx;
      if (after) {
        endIdx = newValue.indexOf(after, startIdx);
      } else {
        endIdx = newValue.length;
      }
      let blankVal = newValue.slice(startIdx, endIdx);
      if (blankVal === '// Write your code here') blankVal = '';
      newBlanks.push(blankVal);
    }
    setBlanks(newBlanks);
    const templateWithUserInput = norm(reconstructTemplate(newBlanks));
    setEditorValue(newValue);
    lastEmittedToParentRef.current = templateWithUserInput;
    onChange(templateWithUserInput);
  };

  /** External `value` changed (starter load, reset from parent, language switch). Sync Ace without controlled re-renders on each key. */
  useEffect(() => {
    if (isFillInTheBlanks) {
      if (norm(safeValue) === norm(lastEmittedToParentRef.current)) {
        return undefined;
      }
      const sv = norm(safeValue);
      lastEmittedToParentRef.current = sv;

      const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
      const lines = sv.split('\n');
      const ranges = [];
      lines.forEach((line, lineIndex) => {
        const matches = [...line.matchAll(placeholderRegex)];
        matches.forEach((match) => {
          ranges.push({
            start: { row: lineIndex, column: match.index },
            end: { row: lineIndex, column: match.index + match[0].length },
          });
        });
      });
      setEditableRanges(ranges);
      const displayValue = sv.replace(placeholderRegex, '// Write your code here');
      setEditorValue(displayValue);

      const editor = editorRef.current?.editor;
      if (editor) {
        applyMarkersToSession(editor, sv);
      }
      return () => {
        const ed = editorRef.current?.editor;
        if (ed) {
          markersRef.current.forEach((m) => ed.session.removeMarker(m));
          markersRef.current = [];
        }
      };
    }

    if (norm(safeValue) === norm(lastEmittedToParentRef.current)) {
      return;
    }

    lastEmittedToParentRef.current = norm(safeValue);
    const stored = norm(safeValue);
    const ranges = parseEditableRanges(stored);
    setEditableRanges(ranges);
    const displayValue = toDisplay(stored);
    lastDisplayRef.current = displayValue;

    const editor = editorRef.current?.editor;
    if (editor) {
      const cursor = editor.getCursorPosition();
      editor.session.setValue(displayValue);
      try {
        editor.moveCursorToPosition(cursor);
      } catch {
        /* ignore */
      }
      applyMarkersToSession(editor, stored);
    }

    return () => {
      const ed = editorRef.current?.editor;
      if (ed) {
        markersRef.current.forEach((m) => ed.session.removeMarker(m));
        markersRef.current = [];
      }
    };
  }, [safeValue, isFillInTheBlanks, applyMarkersToSession, parseEditableRanges, toDisplay]);

  const handleChangePlain = (newValue) => {
    const editor = editorRef.current?.editor;
    if (!editor) return;

    const cursorPosition = editor.getCursorPosition();
    const isInEditableRange = editableRanges.some((range) => {
      const { start, end } = range;
      return (
        (cursorPosition.row > start.row || (cursorPosition.row === start.row && cursorPosition.column >= start.column)) &&
        (cursorPosition.row < end.row || (cursorPosition.row === end.row && cursorPosition.column <= end.column))
      );
    });

    if (isInEditableRange || editableRanges.length === 0) {
      const payload = norm(newValue.replace(/\/\/ Write your code here/g, '___FILL_IN_THE_BLANK___'));
      lastEmittedToParentRef.current = payload;
      lastDisplayRef.current = norm(newValue);
      onChange(payload);
    } else {
      editor.session.setValue(lastDisplayRef.current);
    }
  };

  const handleChange = (newValue) => {
    if (isFillInTheBlanks) {
      handleFillInTheBlanksChange(newValue);
      return;
    }
    handleChangePlain(newValue);
  };

  const handleReset = () => {
    const resetStored = norm(defaultCode);
    const resetDisplay = resetStored.replace(/___FILL_IN_THE_BLANK___/g, '// Write your code here');
    lastEmittedToParentRef.current = resetStored;
    lastDisplayRef.current = resetDisplay;

    if (isFillInTheBlanks) {
      setEditorValue(resetDisplay);
    } else {
      const ed = editorRef.current?.editor;
      if (ed) {
        ed.session.setValue(resetDisplay);
      }
    }
    onChange(resetStored);
  };

  const handleCopy = () => {
    const text = isFillInTheBlanks ? editorValue : editorRef.current?.editor?.getValue() ?? lastDisplayRef.current;
    navigator.clipboard.writeText(text).catch((err) => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleEditorLoad = (editor) => {
    if (isFillInTheBlanks) {
      applyMarkersToSession(editor, norm(safeValue));
      return;
    }
    const sv = norm(safeValue);
    if (sv !== norm(lastEmittedToParentRef.current)) {
      const displayValue = toDisplay(sv);
      editor.session.setValue(displayValue);
      lastEmittedToParentRef.current = sv;
    }
    applyMarkersToSession(editor, sv);
    lastDisplayRef.current = editor.getValue();
  };

  const aceSetOptions = useMemo(
    () => ({
      enableBasicAutocompletion: true,
      enableLiveAutocompletion: false,
      enableSnippets: false,
      showLineNumbers: true,
      tabSize: 2,
    }),
    []
  );

  const displayForDefault = toDisplay(norm(safeValue));

  const fillParent = height === '100%';

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-gray-200 shadow-md bg-gray-900 ${
        fillParent ? 'h-full min-h-0 flex flex-col' : ''
      }`}
    >
      <div className="px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
          {language.charAt(0).toUpperCase() + language.slice(1) || 'Code'}
        </span>
        <div className="flex space-x-4">
          <button
            type="button"
            className="text-sm font-medium text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
            onClick={handleReset}
            disabled={disabled}
          >
            Reset
          </button>
          <button
            type="button"
            className="text-sm font-medium text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
            onClick={handleCopy}
            disabled={disabled}
          >
            Copy
          </button>
        </div>
      </div>
      {isFillInTheBlanks ? (
        <AceEditor
          ref={editorRef}
          mode={mode}
          theme="monokai"
          name="code-editor"
          width="100%"
          height={fillParent ? '100%' : height}
          style={fillParent ? { flex: '1 1 auto', minHeight: 0 } : undefined}
          value={editorValue}
          onChange={handleChange}
          onLoad={handleEditorLoad}
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={!disabled}
          readOnly={disabled}
          setOptions={aceSetOptions}
          editorProps={{ $blockScrolling: true }}
          className="rounded-b-xl"
          onPaste={(e) => e.preventDefault()}
        />
      ) : (
        <AceEditor
          ref={editorRef}
          mode={mode}
          theme="monokai"
          name="code-editor-plain"
          width="100%"
          height={fillParent ? '100%' : height}
          style={fillParent ? { flex: '1 1 auto', minHeight: 0 } : undefined}
          defaultValue={displayForDefault}
          onChange={handleChange}
          onLoad={handleEditorLoad}
          fontSize={14}
          showPrintMargin={false}
          showGutter={true}
          highlightActiveLine={!disabled}
          readOnly={disabled}
          setOptions={aceSetOptions}
          editorProps={{ $blockScrolling: true }}
          className="rounded-b-xl"
        />
      )}
      <style jsx global>{`
        .ace-monokai .ace_gutter {
          background-color: #2f3129;
          color: #a0a1a7;
          border-right: 1px solid #3c3f41;
        }
        .ace-monokai {
          background-color: #272822;
          color: #f8f8f2;
        }
        .ace_gutter-active-line {
          background-color: #3e3d32 !important;
        }
        .ace_active-line {
          background-color: #3e3d32 !important;
        }
        .ace-monokai .ace_cursor {
          color: #f8f8f0;
        }
        .ace-monokai .ace_selection {
          background: #49483e;
        }
        .ace_non_editable {
          background-color: #2f3129 !important;
          opacity: 0.8;
        }
        .ace_editable {
          background-color: #3e3d32 !important;
          border-left: 4px solid #66d9ef;
        }
      `}</style>
    </div>
  );
};

CodeEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  defaultValue: PropTypes.string,
  language: PropTypes.oneOf(['javascript', 'python', 'c', 'cpp', 'java', 'php', 'ruby', 'go']),
  height: PropTypes.string,
  disabled: PropTypes.bool,
  isFillInTheBlanks: PropTypes.bool,
};

export default CodeEditor;
