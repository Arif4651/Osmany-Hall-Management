/**
 * Shapes the one-time credentials the backend returns after creating an account or resetting a
 * password. Always sourced from the response rather than assumed here — the backend currently
 * issues the student's own ID as the initial password, but this call site should not hardcode
 * that assumption in case the policy changes again.
 */
export function toCredentials(loginId, temporaryPassword) {
  return {
    defaultLoginId: loginId,
    defaultPassword: temporaryPassword,
    mustChangePassword: true,
  };
}
