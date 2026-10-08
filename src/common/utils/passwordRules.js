/** Shared password policy for the reset / change password screens. Mirrors the server rule. */
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with letters and numbers.`;

/** Returns an error message, or '' when the password is acceptable. */
export function passwordProblem(password) {
  const value = typeof password === 'string' ? password : '';
  if (value.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(value)) return 'Include at least one letter.';
  if (!/\d/.test(value)) return 'Include at least one number.';
  return '';
}
