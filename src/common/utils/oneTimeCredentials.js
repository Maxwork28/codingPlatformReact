/**
 * True when a bulk-add / import / class-create response carries passwords the admin must hand out
 * because the accounts could not be emailed. The server sends them exactly once.
 */
export function hasOneTimeCredentials(result) {
  return Boolean(result && result.credentialsEmailed === false && Array.isArray(result.credentials) && result.credentials.length > 0);
}
