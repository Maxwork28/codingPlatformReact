import{g as le,r as l,j as g}from"./vendor-react-CxGpZCJY.js";import{r as ue,A as Y}from"./vendor-ace-ywUJi4NT.js";import{ag as de}from"./index--aY83Kmt.js";var pe=ue();const b=le(pe),u=R=>(R==null?"":String(R)).replace(/\r\n/g,`
`),fe=({value:R,onChange:M,defaultValue:$,language:W,height:K="400px",disabled:C,isFillInTheBlanks:m=!1,copyPasteDisabled:j=!1,fontSize:O=14})=>{const{isDark:k}=de(),B=`code-editor-${l.useId().replace(/[^a-zA-Z0-9_-]/g,"")}`,D=k?"monokai":"github",ee={javascript:"javascript",python:"python",c:"c_cpp",cpp:"c_cpp",java:"java",php:"php",ruby:"ruby",go:"golang"},te=e=>({javascript:"// Write your code here",python:"# Write your code here",java:"// Write your code here",c:"// Write your code here",cpp:"// Write your code here",php:"// Write your code here",ruby:"# Write your code here",go:"// Write your code here"})[e]||"// Write your code here",F=ee[W]||"javascript",E=typeof $=="string"?$:te(W),p=typeof R=="string"?R:E,v=l.useRef(null),h=l.useRef(null),L=l.useRef(u(p).replace(/___FILL_IN_THE_BLANK___/g,"// Write your code here")),[q,P]=l.useState(()=>p.replace(/___FILL_IN_THE_BLANK___/g,"// Write your code here")),[z,G]=l.useState([]),f=l.useRef([]),[oe,H]=l.useState([]),[N,U]=l.useState([]),T=l.useCallback(e=>(typeof e=="string"?e:"").replace(/___FILL_IN_THE_BLANK___/g,"// Write your code here"),[]),A=l.useCallback((e,t)=>{const o=/___FILL_IN_THE_BLANK___/g,r=t.split(`
`),c=[];if(r.forEach((s,x)=>{[...s.matchAll(o)].forEach(d=>{c.push({start:{row:x,column:d.index},end:{row:x,column:d.index+d[0].length}})})}),f.current.forEach(s=>e.session.removeMarker(s)),f.current=[],c.length===0)return;const a=window.ace.acequire("ace/range").Range;let n={row:0,column:0};c.forEach((s,x)=>{if(x===0&&(s.start.row>0||s.start.column>0)){const d=new a(0,0,s.start.row,s.start.column);f.current.push(e.session.addMarker(d,"ace_non_editable","line",!1))}if(x>0){const d=c[x-1],S=new a(d.end.row,d.end.column,s.start.row,s.start.column);f.current.push(e.session.addMarker(S,"ace_non_editable","line",!1))}const w=new a(s.start.row,s.start.column,s.end.row,s.end.column);f.current.push(e.session.addMarker(w,"ace_editable","text",!1)),n=s.end});const i=r.length-1,y=r[i].length;if(n.row<i||n.column<y){const s=new a(n.row,n.column,i,y);f.current.push(e.session.addMarker(s,"ace_non_editable","line",!1))}},[]),X=l.useCallback(e=>{const t=/___FILL_IN_THE_BLANK___/g,o=e.split(`
`),r=[];return o.forEach((c,a)=>{[...c.matchAll(t)].forEach(i=>{r.push({start:{row:a,column:i.index},end:{row:a,column:i.index+i[0].length}})})}),r},[]);l.useEffect(()=>{if(!m){H([]),U([]);return}const e=/___FILL_IN_THE_BLANK___/g,t=[];let o=0,r;const c=[];for(;(r=e.exec(E))!==null;)t.push(E.slice(o,r.index)),c.push(""),o=r.index+r[0].length;t.push(E.slice(o)),U(t),H(c);let a="";for(let n=0;n<t.length-1;n++)a+=t[n]+"// Write your code here";a+=t[t.length-1],P(a)},[E,m]);const re=e=>{let t="";for(let o=0;o<N.length-1;o++)t+=N[o]+(e[o]||"");return t+=N[N.length-1],t},ne=e=>{const t=[];for(let r=0;r<oe.length;r++){const c=N[r],a=N[r+1],n=e.indexOf(c)+c.length;let i;a?i=e.indexOf(a,n):i=e.length;let y=e.slice(n,i);y==="// Write your code here"&&(y=""),t.push(y)}H(t);const o=u(re(t));P(e),h.current=o,M(o)};l.useEffect(()=>{var c,a;if(m){if(u(p)===u(h.current))return;const n=u(p);h.current=n;const i=/___FILL_IN_THE_BLANK___/g,y=n.split(`
`),s=[];y.forEach((d,S)=>{[...d.matchAll(i)].forEach(V=>{s.push({start:{row:S,column:V.index},end:{row:S,column:V.index+V[0].length}})})}),G(s);const x=n.replace(i,"// Write your code here");P(x);const w=(c=v.current)==null?void 0:c.editor;return w&&A(w,n),()=>{w&&(f.current.forEach(d=>w.session.removeMarker(d)),f.current=[])}}if(u(p)===u(h.current))return;h.current=u(p);const e=u(p),t=X(e);G(t);const o=T(e);L.current=o;const r=(a=v.current)==null?void 0:a.editor;if(r){const n=r.getCursorPosition();r.session.setValue(o);try{r.moveCursorToPosition(n)}catch{}A(r,e)}return()=>{r&&(f.current.forEach(n=>r.session.removeMarker(n)),f.current=[])}},[p,m,A,X,T]);const ae=e=>{var c;const t=(c=v.current)==null?void 0:c.editor;if(!t)return;const o=t.getCursorPosition();if(z.some(a=>{const{start:n,end:i}=a;return(o.row>n.row||o.row===n.row&&o.column>=n.column)&&(o.row<i.row||o.row===i.row&&o.column<=i.column)})||z.length===0){const a=u(e.replace(/\/\/ Write your code here/g,"___FILL_IN_THE_BLANK___"));h.current=a,L.current=u(e),M(a)}else t.session.setValue(L.current)},Z=e=>{if(m){ne(e);return}ae(e)},se=()=>{var o;const e=u(E),t=e.replace(/___FILL_IN_THE_BLANK___/g,"// Write your code here");if(h.current=e,L.current=t,m)P(t);else{const r=(o=v.current)==null?void 0:o.editor;r&&r.session.setValue(t)}M(e)},ce=()=>{var t,o;if(j)return;const e=m?q:((o=(t=v.current)==null?void 0:t.editor)==null?void 0:o.getValue())??L.current;navigator.clipboard.writeText(e).catch(r=>{})},_=l.useCallback(e=>{j&&(e.preventDefault(),e.stopPropagation())},[j]),J=e=>{if(j&&(e.container.addEventListener("copy",_,!0),e.container.addEventListener("cut",_,!0),e.container.addEventListener("paste",_,!0),e.commands.addCommand({name:"disableCopy",bindKey:{win:"Ctrl-C|Ctrl-Insert",mac:"Cmd-C"},exec:()=>{}}),e.commands.addCommand({name:"disableCut",bindKey:{win:"Ctrl-X|Shift-Delete",mac:"Cmd-X"},exec:()=>{}}),e.commands.addCommand({name:"disablePaste",bindKey:{win:"Ctrl-V|Shift-Insert",mac:"Cmd-V"},exec:()=>{}})),m){A(e,u(p));return}const t=u(p);if(t!==u(h.current)){const o=T(t);e.session.setValue(o),h.current=t}A(e,t),L.current=e.getValue()},Q=l.useMemo(()=>({useWorker:!1,enableBasicAutocompletion:!0,enableLiveAutocompletion:!1,enableSnippets:!1,showLineNumbers:!0,tabSize:2}),[]),ie=T(u(p)),I=K==="100%";return g.jsxs("div",{className:`relative rounded-xl overflow-hidden border shadow-md ${I?"h-full min-h-0 flex flex-col":""} ${k?"bg-gray-900 border-line":"bg-surface border-line"}`,children:[g.jsxs("div",{className:`px-4 py-2 border-b flex justify-between items-center ${k?"bg-gradient-to-r from-gray-800 to-gray-900 border-line":"bg-inset border-line"}`,children:[g.jsx("span",{className:`text-sm font-semibold uppercase tracking-wider ${k?"text-gray-200":"text-body"}`,children:W.charAt(0).toUpperCase()+W.slice(1)||"Code"}),g.jsxs("div",{className:"flex space-x-4",children:[g.jsx("button",{type:"button",className:`text-sm font-medium disabled:cursor-not-allowed transition-colors duration-200 ${k?"text-gray-300 hover:text-fg disabled:text-muted":"text-muted hover:text-fg disabled:text-muted"}`,onClick:se,disabled:C,children:"Reset"}),!j&&g.jsx("button",{type:"button",className:`text-sm font-medium disabled:cursor-not-allowed transition-colors duration-200 ${k?"text-gray-300 hover:text-fg disabled:text-muted":"text-muted hover:text-fg disabled:text-muted"}`,onClick:ce,disabled:C,children:"Copy"})]})]}),m?g.jsx(Y,{ref:v,mode:F,theme:D,name:B,width:"100%",height:I?"100%":K,style:I?{flex:"1 1 auto",minHeight:0}:void 0,value:q,onChange:Z,onLoad:J,fontSize:O,showPrintMargin:!1,showGutter:!0,highlightActiveLine:!C,readOnly:C,setOptions:Q,editorProps:{$blockScrolling:!0},className:"rounded-b-xl",onCopy:_,onCut:_,onPaste:_}):g.jsx(Y,{ref:v,mode:F,theme:D,name:`${B}-plain`,width:"100%",height:I?"100%":K,style:I?{flex:"1 1 auto",minHeight:0}:void 0,defaultValue:ie,onChange:Z,onLoad:J,fontSize:O,showPrintMargin:!1,showGutter:!0,highlightActiveLine:!C,readOnly:C,setOptions:Q,editorProps:{$blockScrolling:!0},className:"rounded-b-xl",onCopy:_,onCut:_,onPaste:_}),g.jsx("style",{children:`
        .ace-monokai .ace_gutter {
          background-color: #2f3129;
          color: #a0a1a7;
          border-right: 1px solid #3c3f41;
        }
        .ace-monokai {
          background-color: #272822;
          color: #f8f8f2;
        }
        .ace-monokai .ace_gutter-active-line,
        .ace-monokai .ace_active-line,
        .ace-monokai .ace_marker-layer .ace_active-line {
          background-color: #3e3d32 !important;
        }
        .ace-monokai .ace_cursor {
          color: #f8f8f0;
          border-left: 2px solid #f8f8f0;
        }
        .ace-monokai .ace_selection {
          background: #49483e;
        }
        .ace-monokai .ace_non_editable {
          background-color: #2f3129 !important;
          opacity: 0.8;
        }
        .ace-monokai .ace_editable {
          background-color: #3e3d32 !important;
          border-left: 4px solid #66d9ef;
        }
        .ace-github .ace_gutter-active-line,
        .ace-github .ace_active-line,
        .ace-github .ace_marker-layer .ace_active-line {
          background-color: #e8f1ff !important;
        }
        .ace-github .ace_cursor {
          color: #2563eb !important;
          border-left: 2px solid #2563eb !important;
        }
        .ace-github .ace_non_editable {
          background-color: #f1f5f9 !important;
          opacity: 0.9;
        }
        .ace-github .ace_editable {
          background-color: #e0edff !important;
          border-left: 4px solid #2563eb;
        }
      `})]})};fe.propTypes={value:b.string,onChange:b.func.isRequired,defaultValue:b.string,language:b.oneOf(["javascript","python","c","cpp","java","php","ruby","go"]),height:b.string,disabled:b.bool,isFillInTheBlanks:b.bool,copyPasteDisabled:b.bool,fontSize:b.number};export{fe as C};
