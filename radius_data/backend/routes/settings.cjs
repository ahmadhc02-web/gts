const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data } = await supabase.from('radius_settings').select('*').eq('id', 'main').maybeSingle();
    res.json(data || {
      companyName: 'Green Pro Network Solutions',
      logoInitials: 'G',
      defaultCurrency: 'PKR',
      defaultPackage: '',
      defaultMonths: 1,
      expiryReminderDays: 3,
      radiusServerIp: '127.0.0.1',
      radiusAuthPort: 1812,
      radiusAcctPort: 1813,
      themeDefault: 'light'
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', authenticateToken, requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const payload = req.body;
    const { data, error } = await supabase.from('radius_settings').upsert([{
      id: 'main',
      ...payload,
      updated_at: new Date().toISOString()
    }], { onConflict: 'id' }).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
