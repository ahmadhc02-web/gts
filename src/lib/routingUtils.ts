export function getTabFromPathname(pathname: string): string {
  if (pathname.startsWith('/billingmod')) return 'billing';
  if (pathname === '/clients') return 'clients';
  if (pathname === '/users') return 'users';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/nodes') return 'nodes';
  if (pathname === '/dealers/analytics') return 'dealers_data';
  if (pathname === '/dealers') return 'dealers';
  if (pathname === '/submit') return 'submit';
  if (pathname === '/config') return 'config';
  if (pathname === '/map') return 'map';
  if (pathname === '/monitor') return 'monitor';
  if (pathname === '/mypc' || pathname.startsWith('/mypc/')) return 'mypc';
  if (pathname === '/branding') return 'branding';
  if (pathname === '/integrations') return 'integrations';
  if (pathname === '/critical') return 'critical';
  if (pathname === '/top10') return 'top10';
  if (pathname === '/recyclebin' || pathname === '/recycle_bin') return 'recycle_bin';
  if (pathname === '/' || pathname === '/dashboard') return 'complaints';
  return 'complaints';
}

export function getPathnameFromTab(tabId: string): string {
  switch (tabId) {
    case 'billing': return '/billingmod';
    case 'clients': return '/clients';
    case 'users': return '/users';
    case 'settings':
    case 'profile': return '/settings';
    case 'nodes': return '/nodes';
    case 'dealers_data': return '/dealers/analytics';
    case 'dealers': return '/dealers';
    case 'submit': return '/submit';
    case 'config': return '/config';
    case 'map': return '/map';
    case 'monitor': return '/monitor';
    case 'mypc': return '/mypc';
    case 'branding': return '/branding';
    case 'integrations': return '/integrations';
    case 'critical': return '/critical';
    case 'top10': return '/top10';
    case 'recycle_bin': return '/recyclebin';
    case 'complaints':
    case 'ops':
    default:
      return '/dashboard';
  }
}
