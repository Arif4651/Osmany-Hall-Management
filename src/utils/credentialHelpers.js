export function generateInitialCredentials(studentId) {
  return {
    defaultLoginId: studentId,
    defaultPassword: studentId,
    mustChangePassword: true,
  };
}

export function getCredentialNotice(studentId) {
  return {
    title: 'Student created successfully',
    lines: [
      'Initial login credentials generated.',
      `Default username: ${studentId}`,
      `Default password: ${studentId}`,
      'Student must change password after first login.',
    ],
  };
}
