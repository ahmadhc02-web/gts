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
        if (tabParam === 'security') return 'settings';
        if (tabParam === 'settings' || tabParam === 'profile' || tabParam === 'mypc') return 'mypc';
        if (tabParam === 'nodes') return 'nodes';
        if (tabParam === 'dealers_data' || tabParam === 'analytics') return 'dealers_data';
        if (tabParam === 'dealers') return 'dealers';
        if (tabParam === 'submit' || tabParam === 'servicerequest' || tabParam === 'registry' || tabParam === 'complain-reg') return 'submit';
        if (tabParam === 'config') return 'config';
        if (tabParam === 'map') return 'map';
        if (tabParam === 'monitor' || tabParam === 'latency') return 'latency';
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

  if (pathname === '/conversation' || pathname.startsWith('/conversation')) return 'complaints';
  if (pathname.startsWith('/billingmod') || pathname === '/billing' || pathname.startsWith('/billing/')) return 'billing';
  if (pathname === '/clients') return 'clients';
  if (pathname === '/users') return 'users';
  if (pathname === '/security') return 'settings';
  if (pathname === '/settings' || pathname.startsWith('/settings/') || pathname === '/mypc' || pathname.startsWith('/mypc/')) return 'mypc';
  if (pathname === '/nodes') return 'nodes';
  if (pathname === '/dealers/analytics') return 'dealers_data';
  if (pathname === '/dealers') return 'dealers';
  if (pathname === '/registry' || pathname === '/submit' || pathname === '/servicerequest' || pathname === '/complain-reg') return 'submit';
  if (pathname === '/config') return 'config';
  if (pathname === '/map') return 'map';
  if (pathname === '/latency' || pathname === '/monitor') return 'latency';
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
    case 'submit':
    case 'registry':
      return '/registry';
    case 'billing': return '/billingmod';
    case 'clients': return '/clients';
    case 'users': return '/users';
    case 'settings': return '/security';
    case 'mypc': return '/settings';
    case 'nodes': return '/nodes';
    case 'branding': return '/branding';
    case 'integrations': return '/integrations';
    case 'critical': return '/critical';
    case 'top10': return '/top10';
    case 'recycle_bin': return '/recyclebin';
    case 'dealers_data': return '/dealers/analytics';
    case 'dealers': return '/dealers';
    case 'complaints':
    case 'ops':
    default:
      return '/dashboard';
  }
}
