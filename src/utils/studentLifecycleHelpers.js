export function canBePermanentlyDeleted(student) {
  return ['archived', 'inactive', 'graduated'].includes(student.status) || student.permanentDeleteEligible;
}

export function evaluateLifecycleTransition(student, nowDate = new Date()) {
  const validity = student.hallValidityEndDate ? new Date(student.hallValidityEndDate) : null;

  if (!validity || Number.isNaN(validity.getTime())) {
    return student;
  }

  const hasValidityExpired = nowDate > validity;

  if (!hasValidityExpired) {
    return {
      ...student,
      reactivationEligible: ['inactive', 'archived', 'graduated', 'pending_clearance'].includes(student.status),
      permanentDeleteEligible: canBePermanentlyDeleted(student),
    };
  }

  if (student.hasDue) {
    return {
      ...student,
      status: 'pending_clearance',
      loginAccessEnabled: true,
      reactivationEligible: true,
      permanentDeleteEligible: false,
    };
  }

  return {
    ...student,
    status: 'graduated',
    loginAccessEnabled: false,
    reactivationEligible: true,
    permanentDeleteEligible: true,
  };
}

export function toStatusLabel(status) {
  return String(status || '')
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function getDueStatus(student) {
  return student.hasDue ? 'Has Due' : 'Clear';
}
