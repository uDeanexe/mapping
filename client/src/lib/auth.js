// Auth is handled by Supabase. Keep helpers for role label + gating.

export function roleLabel(role) {
  switch (role) {
    case 'superadmin':
      return 'Superadmin';
    case 'admin':
      return 'Admin';
    case 'supervisor_noc':
      return 'Supervisor NOC';
    case 'teknisi':
      return 'Teknisi';
    default:
      return role || '-';
  }
}

export function canManageUsers(user) {
  return ['superadmin', 'admin'].includes(user?.role);
}
