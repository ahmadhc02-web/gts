const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data: users } = await supabase.from('radius_users').select('*');
    const { data: packages } = await supabase.from('radius_packages').select('*');

    const total = (users || []).length;
    const active = (users || []).filter(u => u.status === 'Active').length;
    const online = (users || []).filter(u => u.online).length;
    const expired = (users || []).filter(u => u.status === 'Expired').length;
    const disabled = (users || []).filter(u => u.status === 'Disabled').length;
    const preActive = (users || []).filter(u => u.status === 'Pre-Active').length;

    const today = new Date().toISOString().split('T')[0];
    const expiringToday = (users || []).filter(u => u.expiry === today).length;

    const topPackages = (packages || []).map(p => {
      const count = (users || []).filter(u => u.package === p.name || u.package_id === p.id).length;
      return { name: p.name, count };
    }).sort((a, b) => b.count - a.count);

    res.json({
      total,
      active,
      online,
      expired,
      disabled,
      preActive,
      expiringToday,
      expiring: expiringToday,
      topPackages
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
