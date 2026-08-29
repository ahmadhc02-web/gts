export function getTabFromPathname(pathname: string, search?: string): string {
  // If search query has ?tab=... (e.g., /admin?tab=billing or /dashboard?tab=billing)
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const tabParam = params.get('tab');
      if (tabParam) {
        if (tabParam === 'billing' || tabParam === 'billingmod') return 'billing';
        if (tabParam === 'clients') return 'clients';
        if (tabParam === 'users') return 'users';
        if (tabParam === 'settings' || tabParam === 'profile') return 'settings';
        if (tabParam === 'nodes') return 'nodes';
        if (tabParam === 'dealers_data' || tabParam === 'analytics') return 'dealers_data';
        if (tabParam === 'dealers') return 'dealers';
        if (tabParam === 'submit' || tabParam === 'servicerequest') return 'submit';
        if (tabParam === 'config') return 'config';
        if (tabParam === 'map') return 'map';
        if (tabParam === 'monitor') return 'monitor';
        if (tabParam === 'mypc') return 'mypc';
        if (tabParam === 'branding') return 'branding';
        if (tabParam === 'integrations') return 'integrations';
        if (tabParam === 'critical') return 'critical';
        if (tabParam === 'top10') return 'top10';
        if (tabParam === 'recycle_bin' || tabParam === 'recyclebin') return 'recycle_bin';
        if (tabParam === 'complaints' || tabParam === 'dashboard') return 'complaints';
        return tabParam;
      }
    } catch (e) {}
  }

  if (pathname.startsWith('/billingmod') || pathname === '/billing' || pathname.startsWith('/billing/')) return 'billing';
  if (pathname === '/clients') return 'clients';
  if (pathname === '/users') return 'users';
  if (pathname === '/settings') return 'settings';
  if (pathname === '/nodes') return 'nodes';
  if (pathname === '/dealers/analytics') return 'dealers_data';
  if (pathname === '/dealers') return 'dealers';
  if (pathname === '/servicerequest' || pathname === '/submit') return 'submit';
  if (pathname === '/config') return 'config';
  if (pathname === '/map') return 'map';
  if (pathname === '/monitor') return 'monitor';
  if (pathname === '/mypc' || pathname.startsWith('/mypc/')) return 'mypc';
  if (pathname === '/branding') return 'branding';
  if (pathname === '/integrations') return 'integrations';
  if (pathname === '/critical') return 'critical';
  if (pathname === '/top10') return 'top10';
  if (pathname === '/recyclebin' || pathname === '/recycle_bin') return 'recycle_bin';
  if (pathname === '/' || pathname === '/dashboard' || pathname === '/admin') return 'complaints';
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
    case 'submit': return '/servicerequest';
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
