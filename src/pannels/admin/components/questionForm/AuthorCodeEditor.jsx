import React from 'react';
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
import 'ace-builds/src-noconflict/theme-github';
import { useTheme } from '../../../../common/context/ThemeContext';

const MODES = { javascript: 'javascript', python: 'python', java: 'java', c: 'c_cpp', cpp: 'c_cpp', ruby: 'ruby', php: 'php', go: 'golang' };

/**
 * Plain code editor for authors. Unlike the student editor it stores text exactly as typed
 * (no blank-placeholder rewriting, no clipboard blocking, no locked ranges).
 */
export default function AuthorCodeEditor({ value, onChange, language, height = '320px', name }) {
  const { isDark } = useTheme();
  return (
    <AceEditor
      name={name}
      mode={MODES[language] || 'javascript'}
      theme={isDark ? 'monokai' : 'github'}
      width="100%"
      height={height}
      value={value}
      onChange={onChange}
      fontSize={13}
      tabSize={4}
      showPrintMargin={false}
      highlightActiveLine
      setOptions={{ useWorker: false, enableBasicAutocompletion: true, enableLiveAutocompletion: false, showLineNumbers: true }}
      editorProps={{ $blockScrolling: true }}
    />
  );
}
