const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('radius_packages').select('*');
    if (error) throw error;
    res.json({ packages: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('packages.manage'), async (req, res, next) => {
  try {
    const { name, speed, pricePerMonth, price_per_month, dealerPrice, dataLimitGB, status } = req.body;
    if (!name || !speed) return res.status(400).json({ error: 'Name and speed required' });

    const dbRow = {
      id: `pkg-${Date.now()}`,
      name: name.trim(),
      speed: speed.trim(),
      price_per_month: Number(pricePerMonth ?? price_per_month ?? 1500),
      dealer_price: dealerPrice ? Number(dealerPrice) : null,
      data_limit_gb: dataLimitGB ? Number(dataLimitGB) : null,
      status: status || 'Active',
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('radius_packages').insert([dbRow]).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, requirePermission('packages.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    if (patch.pricePerMonth !== undefined) {
      patch.price_per_month = patch.pricePerMonth;
      delete patch.pricePerMonth;
    }
    if (patch.dealerPrice !== undefined) {
      patch.dealer_price = patch.dealerPrice;
      delete patch.dealerPrice;
    }
    if (patch.dataLimitGB !== undefined) {
      patch.data_limit_gb = patch.dataLimitGB;
      delete patch.dataLimitGB;
    }

    const { data, error } = await supabase.from('radius_packages').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, requirePermission('packages.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check if used by any user
    const { count } = await supabase.from('radius_users').select('*', { count: 'exact', head: true }).eq('package_id', id);
    if (count && count > 0) {
      return res.status(400).json({ error: `Cannot delete package: ${count} active subscriber(s) assigned.` });
    }

    const { error } = await supabase.from('radius_packages').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
