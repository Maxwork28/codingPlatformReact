export const parseOptionalPoints = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

export const pointsFieldValue = (value) =>
  value === undefined || value === null ? '' : value;
