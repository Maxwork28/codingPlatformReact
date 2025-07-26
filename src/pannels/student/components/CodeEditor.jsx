import React, { useState, useEffect, useRef } from 'react';
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
  const [editorValue, setEditorValue] = useState(safeValue);
  const [editableRanges, setEditableRanges] = useState([]);
  const markersRef = useRef([]);
  const [blanks, setBlanks] = useState([]); // For fill-in-the-blanks mode
  const [templateParts, setTemplateParts] = useState([]); // For fill-in-the-blanks mode

  useEffect(() => {
    if (!isFillInTheBlanks) {
      setEditorValue(safeValue);
      setBlanks([]);
      setTemplateParts([]);
      return;
    }
    // Parse template into static and blank parts
    const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let idx = 0;
    const blanksArr = [];
    while ((match = placeholderRegex.exec(defaultCode)) !== null) {
      parts.push(defaultCode.slice(lastIndex, match.index));
      blanksArr.push('');
      lastIndex = match.index + match[0].length;
      idx++;
    }
    parts.push(defaultCode.slice(lastIndex));
    setTemplateParts(parts);
    setBlanks(blanksArr);
    // Set editor value for display (show blanks as 'Write your code here')
    let display = '';
    for (let i = 0; i < parts.length - 1; i++) {
      display += parts[i] + '// Write your code here';
    }
    display += parts[parts.length - 1];
    setEditorValue(display);
  }, [defaultCode, isFillInTheBlanks]);

  // Helper: reconstruct template with user blanks
  const reconstructTemplate = (userBlanks) => {
    let result = '';
    for (let i = 0; i < templateParts.length - 1; i++) {
      result += templateParts[i] + (userBlanks[i] || '');
    }
    result += templateParts[templateParts.length - 1];
    return result;
  };

  // Handle change for fill-in-the-blanks
  const handleFillInTheBlanksChange = (newValue) => {
    // Split newValue by '// Write your code here' to extract user input
    const splitRegex = /\/\/ Write your code here/g;
    const userParts = newValue.split(splitRegex);
    // userParts.length = blanks.length + 1
    const newBlanks = [];
    for (let i = 0; i < blanks.length; i++) {
      // Extract what user typed between the static parts
      const before = templateParts[i];
      const after = templateParts[i + 1];
      // Find the start/end index in newValue
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
    // Reconstruct template for parent
    const templateWithUserInput = reconstructTemplate(newBlanks);
    setEditorValue(newValue);
    onChange(templateWithUserInput);
  };

  useEffect(() => {
    // Parse the code to identify editable sections
    const placeholderRegex = /___FILL_IN_THE_BLANK___/g;
    const lines = safeValue.split('\n');
    const ranges = [];
    let currentLine = 0;
    let currentCol = 0;

    lines.forEach((line, lineIndex) => {
      const matches = [...line.matchAll(placeholderRegex)];
      if (matches.length > 0) {
        matches.forEach(match => {
          const startCol = match.index;
          const endCol = startCol + match[0].length;
          ranges.push({
            start: { row: lineIndex, column: startCol },
            end: { row: lineIndex, column: endCol },
          });
        });
      }
      currentLine++;
      currentCol = 0;
    });

    setEditableRanges(ranges);

    // Replace placeholders with a visual indicator
    const displayValue = safeValue.replace(placeholderRegex, '// Write your code here');
    setEditorValue(displayValue);

    // Update editor markers
    const editor = editorRef.current?.editor;
    if (editor) {
      // Remove existing markers
      markersRef.current.forEach(marker => editor.session.removeMarker(marker));
      markersRef.current = [];

      // Add markers for non-editable sections
      const Range = window.ace.acequire('ace/range').Range;
      let lastEnd = { row: 0, column: 0 };

      ranges.forEach((range, index) => {
        // Mark non-editable section before this editable range
        if (index === 0 && (range.start.row > 0 || range.start.column > 0)) {
          const nonEditableRange = new Range(0, 0, range.start.row, range.start.column);
          const markerId = editor.session.addMarker(
            nonEditableRange,
            'ace_non_editable',
            'line',
            false
          );
          markersRef.current.push(markerId);
        }

        // Mark non-editable section between editable ranges
        if (index > 0) {
          const prevRange = ranges[index - 1];
          const nonEditableRange = new Range(
            prevRange.end.row,
            prevRange.end.column,
            range.start.row,
            range.start.column
          );
          const markerId = editor.session.addMarker(
            nonEditableRange,
            'ace_non_editable',
            'line',
            false
          );
          markersRef.current.push(markerId);
        }

        // Mark editable section
        const editableRange = new Range(
          range.start.row,
          range.start.column,
          range.end.row,
          range.end.column
        );
        const markerId = editor.session.addMarker(
          editableRange,
          'ace_editable',
          'text',
          false
        );
        markersRef.current.push(markerId);

        lastEnd = range.end;
      });

      // Mark non-editable section after the last editable range
      if (ranges.length > 0) {
        const lastLine = lines.length - 1;
        const lastCol = lines[lastLine].length;
        if (lastEnd.row < lastLine || lastEnd.column < lastCol) {
          const nonEditableRange = new Range(lastEnd.row, lastEnd.column, lastLine, lastCol);
          const markerId = editor.session.addMarker(
            nonEditableRange,
            'ace_non_editable',
            'line',
            false
          );
          markersRef.current.push(markerId);
        }
      } else {
        // If no editable ranges, mark entire document as non-editable
        const nonEditableRange = new Range(0, 0, lines.length - 1, lines[lines.length - 1].length);
        const markerId = editor.session.addMarker(
          nonEditableRange,
          'ace_non_editable',
          'line',
          false
        );
        markersRef.current.push(markerId);
      }
    }

    return () => {
      // Cleanup markers on unmount
      const editor = editorRef.current?.editor;
      if (editor) {
        markersRef.current.forEach(marker => editor.session.removeMarker(marker));
        markersRef.current = [];
      }
    };
  }, [safeValue]);

  const handleChange = (newValue) => {
    if (isFillInTheBlanks) {
      handleFillInTheBlanksChange(newValue);
      return;
    }
    const editor = editorRef.current.editor;
    const cursorPosition = editor.getCursorPosition();
    const isInEditableRange = editableRanges.some(range => {
      const { start, end } = range;
      return (
        (cursorPosition.row > start.row || (cursorPosition.row === start.row && cursorPosition.column >= start.column)) &&
        (cursorPosition.row < end.row || (cursorPosition.row === end.row && cursorPosition.column <= end.column))
      );
    });

    if (isInEditableRange || editableRanges.length === 0) {
      setEditorValue(newValue);
      onChange(newValue.replace(/\/\/ Write your code here/g, '___FILL_IN_THE_BLANK___'));
    } else {
      // Revert to previous value if trying to edit non-editable section
      editor.session.setValue(editorValue);
    }
  };

  const handleReset = () => {
    const resetValue = defaultCode.replace(/___FILL_IN_THE_BLANK___/g, '// Write your code here');
    setEditorValue(resetValue);
    onChange(defaultCode);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editorValue).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-md bg-gray-900">
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
      <AceEditor
        ref={editorRef}
        mode={mode}
        theme="monokai"
        name="code-editor"
        width="100%"
        height={height}
        value={editorValue}
        onChange={handleChange}
        fontSize={14}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={!disabled}
        readOnly={disabled}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
        editorProps={{ $blockScrolling: true }}
        className="rounded-b-xl"
        onPaste={isFillInTheBlanks ? (e) => e.preventDefault() : undefined}
      />
      <style jsx global>{`
        .ace-monokai .ace_gutter {
          background-color: #2F3129;
          color: #A0A1A7;
          border-right: 1px solid #3C3F41;
        }
        .ace-monokai {
          background-color: #272822;
          color: #F8F8F2;
        }
        .ace_gutter-active-line {
          background-color: #3E3D32 !important;
        }
        .ace_active-line {
          background-color: #3E3D32 !important;
        }
        .ace-monokai .ace_cursor {
          color: #F8F8F0;
        }
        .ace-monokai .ace_selection {
          background: #49483E;
        }
        .ace_non_editable {
          background-color: #2F3129 !important;
          opacity: 0.8;
        }
        .ace_editable {
          background-color: #3E3D32 !important;
          border-left: 4px solid #66D9EF;
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