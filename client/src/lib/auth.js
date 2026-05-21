export function getStoredUser() {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function getToken() {
  return localStorage.getItem('auth_token');
}

export function setAuth(token, user) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

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
