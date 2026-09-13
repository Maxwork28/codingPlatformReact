export function normalizeLang(lang) {
  return String(lang || '').trim().toLowerCase();
}

export function buildSolutionCodesFromQuestion(q) {
  const langs = Array.isArray(q?.languages) && q.languages.length > 0 ? q.languages : [];
  const fromApi = Array.isArray(q?.solutionCodes)
    ? q.solutionCodes.map((s) => ({ language: s.language, code: s.code || '' }))
    : [];

  let usedLegacy = false;
  const codeFor = (lang) => {
    const hit = fromApi.find(
      (s) => normalizeLang(s.language) === normalizeLang(lang) && String(s.code || '').trim()
    );
    if (hit) return hit.code;
    if (String(q?.solutionCode || '').trim()) {
      if (q.solutionLanguage && normalizeLang(q.solutionLanguage) === normalizeLang(lang)) {
        return q.solutionCode;
      }
      if (!q.solutionLanguage && !usedLegacy) {
        usedLegacy = true;
        return q.solutionCode;
      }
    }
    return '';
  };

  if (langs.length > 0) {
    return langs.map((lang) => ({ language: lang, code: codeFor(lang) }));
  }
  if (fromApi.length) {
    return fromApi.map((s) => ({ language: s.language, code: s.code || '' }));
  }
  const primaryLang = q?.solutionLanguage || 'javascript';
  const primaryCode = q?.solutionCode || '';
  return primaryCode
    ? [{ language: primaryLang, code: primaryCode }]
    : [{ language: 'javascript', code: '' }];
}

export function hasSavedSolution(solutionCodes, lang) {
  return Boolean(
    (solutionCodes || []).find(
      (s) => normalizeLang(s.language) === normalizeLang(lang) && String(s.code || '').trim()
    )
  );
}

export function solutionCodeForLanguage(solutionCodes, lang) {
  return (
    (solutionCodes || []).find((s) => normalizeLang(s.language) === normalizeLang(lang))?.code ?? ''
  );
}
