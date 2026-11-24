const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

function applyAccessScope(req, query) {
  const user = req.user;
  if (!user) return query;
  if (user.radiusRole === 'SuperAdmin') {
    const selectedLine = req.headers['x-radius-line'];
    if (selectedLine && selectedLine !== 'all') {
      return query.eq('line_id', selectedLine);
    }
    return query;
  }
  if (user.radiusRole === 'Dealer') {
    return query.eq('uid', user.sub);
  }
  if (user.radiusRole === 'DealerStaff' && user.parentUid) {
    return query.eq('uid', user.parentUid);
  }
  if (user.lineId) {
    return query.eq('line_id', user.lineId);
  }
  return query;
}

function mapDealerRow(row) {
  if (!row) return row;
  return {
    ...row,
    wallet_balance: Number(row.wallet_balance ?? row.balance ?? 0),
  };
}

async function resolveUsernameForUid(uid) {
  for (const table of ['users_data', 'users']) {
    const res = await supabase.from(table).select('username').eq('uid', uid).maybeSingle();
    if (!res.error && res.data && res.data.username) {
      return res.data.username;
    }
  }
  return null;
}

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = supabase.from('radius_access').select('*').eq('radius_role', 'Dealer');
    query = applyAccessScope(req, query);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ dealers: (data || []).map(mapDealerRow) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('dealers.manage'), async (req, res, next) => {
  try {
    const { uid, username, company_name, phone, credit_limit, commission_pct } = req.body;
    if (!uid || !company_name) return res.status(400).json({ error: 'uid and company_name required' });

    const resolvedUsername = username || (await resolveUsernameForUid(uid)) || uid;

    const { data, error } = await supabase.from('radius_access').upsert([{
      uid,
      username: resolvedUsername,
      radius_role: 'Dealer',
      company_name,
      phone: phone || '',
      credit_limit: Number(credit_limit || 0),
      commission_pct: Number(commission_pct || 0),
      balance: 0,
      status: 'Active',
      line_id: req.user.lineId || null,
      parent_uid: req.user.sub || null,
      permissions: [],
      created_at: new Date().toISOString()
    }], { onConflict: 'uid' }).select().single();

    if (error) throw error;
    res.json(mapDealerRow(data));
  } catch (err) {
    next(err);
  }
});

router.patch('/:uid', authenticateToken, requirePermission('dealers.manage'), async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { company_name, phone, credit_limit, commission_pct, status } = req.body;
    const patch = {};
    if (company_name !== undefined) patch.company_name = company_name;
    if (phone !== undefined) patch.phone = phone;
    if (credit_limit !== undefined) patch.credit_limit = Number(credit_limit);
    if (commission_pct !== undefined) patch.commission_pct = Number(commission_pct);
    if (status !== undefined) patch.status = status;

    const { data, error } = await supabase
      .from('radius_access')
      .update(patch)
      .eq('uid', uid)
      .eq('radius_role', 'Dealer')
      .select()
      .single();
    if (error) throw error;
    res.json(mapDealerRow(data));
  } catch (err) {
    next(err);
  }
});

router.post('/:uid/wallet/topup', authenticateToken, requirePermission('dealers.manage'), async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { amount, method, reference, note } = req.body;
    const topupAmt = Number(amount || 0);

    const { data: dealer, error: dealerErr } = await supabase
      .from('radius_access')
      .select('*')
      .eq('uid', uid)
      .eq('radius_role', 'Dealer')
      .maybeSingle();
    if (dealerErr) throw dealerErr;
    if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

    const newBalance = Number(dealer.balance || 0) + topupAmt;
    const { error: updateErr } = await supabase
      .from('radius_access')
      .update({ balance: newBalance })
      .eq('uid', uid)
      .eq('radius_role', 'Dealer');
    if (updateErr) throw updateErr;

    const noteParts = [method, reference, note].filter(Boolean);
    const ledgerEntry = {
      id: `ledger-${Date.now()}`,
      dealer_uid: uid,
      amount: topupAmt,
      balance_after: newBalance,
      type: 'topup',
      note: noteParts.join(' | '),
      created_at: new Date().toISOString()
    };

    const { error: ledgerErr } = await supabase.from('radius_wallet_ledger').insert([ledgerEntry]);
    if (ledgerErr) throw ledgerErr;

    res.json({
      dealer: mapDealerRow({ ...dealer, balance: newBalance }),
      entry: { ...ledgerEntry, method: method || 'Cash', reference: reference || '', created_by: req.user.username },
      wallet_balance: newBalance
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/wallet/ledger', authenticateToken, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { data, error } = await supabase
      .from('radius_wallet_ledger')
      .select('*')
      .eq('dealer_uid', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ ledger: data || [] });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/prices', authenticateToken, async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { data, error } = await supabase.from('radius_dealer_prices').select('*').eq('dealer_uid', uid);
    if (error) throw error;
    const prices = (data || []).map(row => ({
      ...row,
      dealer_price: Number(row.dealer_price ?? row.price_per_month ?? 0),
    }));
    res.json({ prices });
  } catch (err) {
    next(err);
  }
});

router.put('/:uid/prices', authenticateToken, requirePermission('dealers.manage'), async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { prices } = req.body; // array of { package_id, dealer_price }
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'Prices array required' });

    for (const p of prices) {
      const { error } = await supabase.from('radius_dealer_prices').upsert([{
        dealer_uid: uid,
        package_id: p.package_id,
        price_per_month: Number(p.dealer_price ?? p.price_per_month ?? 0)
      }], { onConflict: 'dealer_uid,package_id' });
      if (error) throw error;
    }

    const { data, error } = await supabase.from('radius_dealer_prices').select('*').eq('dealer_uid', uid);
    if (error) throw error;
    const mapped = (data || []).map(row => ({
      ...row,
      dealer_price: Number(row.dealer_price ?? row.price_per_month ?? 0),
    }));
    res.json({ prices: mapped });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
