const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

function mapPaymentRow(row) {
  if (!row) return row;
  return {
    ...row,
    userId: row.user_id,
    packageName: row.package_name,
    date: row.date || (row.created_at ? String(row.created_at).split('T')[0] : ''),
  };
}

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = supabase.from('radius_payments').select('*').order('created_at', { ascending: false });
    if (req.user.radiusRole === 'SuperAdmin') {
      const selectedLine = req.headers['x-radius-line'];
      if (selectedLine && selectedLine !== 'all') {
        query = query.eq('line_id', selectedLine);
      }
    } else if (req.user.lineId) {
      query = query.eq('line_id', req.user.lineId);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ payments: (data || []).map(mapPaymentRow) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('payments.create'), async (req, res, next) => {
  try {
    const { user_id, userId, username, amount, type, method, note, packageName } = req.body;
    const uId = user_id || userId;
    const payRow = {
      id: `pay-${Date.now()}`,
      user_id: uId || '',
      username: username || 'subscriber',
      amount: Number(amount || 0),
      type: type || 'Manual',
      method: method || 'Cash',
      note: note || '',
      package_name: packageName || '',
      line_id: req.user.lineId || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase.from('radius_payments').insert([payRow]).select().single();
    if (error) throw error;
    res.json(mapPaymentRow(data));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
