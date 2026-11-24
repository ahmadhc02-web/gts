const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('radius_vouchers').select('*');
    if (error) throw error;
    res.json({ vouchers: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/generate', authenticateToken, requirePermission('vouchers.manage'), async (req, res, next) => {
  try {
    const { count, packageId, months, prefix } = req.body;
    const numCount = Number(count || 1);
    const customMonths = Number(months || 1);
    const pref = prefix || 'VTX';

    const { data: pkg } = await supabase.from('radius_packages').select('*').eq('id', packageId).single();
    const pkgName = pkg ? pkg.name : 'Standard';
    const price = pkg ? (pkg.price_per_month * customMonths) : (1500 * customMonths);

    const createdVouchers = [];
    for (let i = 0; i < numCount; i++) {
      const code = `${pref}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const vRow = {
        id: `vouch-${Date.now()}-${i}`,
        code,
        package_id: packageId,
        package_name: pkgName,
        price,
        months: customMonths,
        status: 'Active',
        created_at: new Date().toISOString()
      };
      createdVouchers.push(vRow);
    }

    const { error } = await supabase.from('radius_vouchers').insert(createdVouchers);
    if (error) throw error;

    res.json(createdVouchers);
  } catch (err) {
    next(err);
  }
});

router.post('/redeem', authenticateToken, requirePermission('vouchers.manage'), async (req, res, next) => {
  try {
    const { code, userId } = req.body;
    const { data: voucher } = await supabase.from('radius_vouchers').select('*').eq('code', code).eq('status', 'Active').single();
    if (!voucher) return res.status(404).json({ error: 'Active voucher not found' });

    await supabase.from('radius_vouchers').update({
      status: 'Redeemed',
      redeemed_by: userId,
      redeemed_at: new Date().toISOString()
    }).eq('id', voucher.id);

    res.json({ success: true, voucher });
  } catch (err) {
    next(err);
  }
});

router.post('/delete', authenticateToken, requirePermission('vouchers.manage'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });

    const { error } = await supabase.from('radius_vouchers').delete().in('id', ids);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
