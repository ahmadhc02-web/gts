const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission, getScopedQuery } = require('../rbac.cjs');
const { encrypt, decrypt } = require('../crypto.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = supabase.from('radius_users').select('*');
    query = await getScopedQuery(req, query);
    const { data, error } = await query;
    if (error) throw error;
    
    const users = (data || []).map(u => ({
      ...u,
      password: u.password_enc ? decrypt(u.password_enc) : u.password
    }));

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/main-users', authenticateToken, async (req, res, next) => {
  try {
    const [usersRes, usersDataRes] = await Promise.all([
      supabase.from('users').select('uid, username, full_name, role, email, phone, status'),
      supabase.from('users_data').select('uid, username, full_name, role, email, company_name, status'),
    ]);
    const byKey = new Map();
    for (const row of (usersDataRes.data || []).concat(usersRes.data || [])) {
      const key = String(row.uid || row.username || '');
      if (key && !byKey.has(key)) byKey.set(key, row);
    }
    res.json({ users: Array.from(byKey.values()) });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('users.create'), async (req, res, next) => {
  try {
    const { username, name, mobile, package: packageName, package_id, password, dealer_uid, vlan_id, status, email, city, address, notes } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const cleanUsername = String(username).toLowerCase().trim();
    if (cleanUsername.length < 4) {
      return res.status(400).json({ error: 'Username must be at least 4 characters' });
    }
    const usernameRegex = /^[A-Za-z0-9._@-]{4,64}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const { data: existing } = await supabase.from('radius_users').select('id').eq('username', cleanUsername).maybeSingle();
    if (existing) {
      return res.status(409).json({ error: `Username "${cleanUsername}" is already taken.` });
    }

    const passwordEnc = password ? encrypt(password) : null;
    const now = new Date().toISOString().split('T')[0];

    const dbRow = {
      id: `user-${Date.now()}`,
      username: cleanUsername,
      name: name || cleanUsername,
      mobile: mobile || '',
      package: packageName || 'Standard 10M',
      package_id: package_id || null,
      dealer_uid: dealer_uid || req.user.dealerUid || null,
      vlan_id: vlan_id ? Number(vlan_id) : null,
      line_id: req.user.lineId,
      status: status || 'Pre-Active',
      online: false,
      ip: '',
      expiry: 'Not Activated',
      balance: 0,
      password_enc: passwordEnc,
      email: email || '',
      city: city || '',
      address: address || '',
      notes: notes || '',
      created_at: now
    };

    const { data, error } = await supabase.from('radius_users').insert([dbRow]).select().single();
    if (error) throw error;

    res.json({ ...data, password: password || '' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, requirePermission('users.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    if (patch.password) {
      patch.password_enc = encrypt(patch.password);
      delete patch.password;
    }

    const { data, error } = await supabase.from('radius_users').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, requirePermission('users.delete'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('radius_users').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/renew', authenticateToken, requirePermission('users.renew'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { package: pkgName, package_id, new_expiry, amount, months, payment_method } = req.body;

    const { data: user } = await supabase.from('radius_users').select('*').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const chargeAmount = Number(amount || 0);

    // If dealer role, check dealer wallet balance & deduct
    if (req.user.radiusRole === 'Dealer' && req.user.sub) {
      const { data: dealer } = await supabase
        .from('radius_access')
        .select('*')
        .eq('uid', req.user.sub)
        .eq('radius_role', 'Dealer')
        .maybeSingle();
      if (dealer) {
        const currentBal = Number(dealer.balance || 0);
        const creditLimit = Number(dealer.credit_limit || 0);
        if (currentBal - chargeAmount < -creditLimit) {
          return res.status(400).json({ error: 'Insufficient dealer wallet balance & credit limit exceeded.' });
        }
        const newBal = currentBal - chargeAmount;
        await supabase
          .from('radius_access')
          .update({ balance: newBal })
          .eq('uid', req.user.sub)
          .eq('radius_role', 'Dealer');
        await supabase.from('radius_wallet_ledger').insert([{
          id: `ledger-${Date.now()}`,
          dealer_uid: req.user.sub,
          amount: -chargeAmount,
          balance_after: newBal,
          type: 'debit',
          note: `Renewal for subscriber ${user.username}`,
          created_at: new Date().toISOString()
        }]);
      }
    }

    const patch = {
      package_id: package_id || user.package_id,
      expiry: new_expiry,
      status: 'Active'
    };

    const { data, error } = await supabase.from('radius_users').update(patch).eq('id', id).select().single();
    if (error) throw error;

    // Record payment
    await supabase.from('radius_payments').insert([{
      id: `pay-${Date.now()}`,
      user_id: id,
      username: user.username,
      amount: chargeAmount,
      type: 'Renewal',
      method: payment_method || 'Cash',
      note: `Renewed by ${req.user.username}`,
      package_name: pkgName || user.package || '',
      line_id: req.user.lineId || null,
      created_at: new Date().toISOString()
    }]);

    res.json({
      success: true,
      newExpiry: data.expiry,
      newBalance: 0,
      chargedAmount: chargeAmount
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/toggle', authenticateToken, requirePermission('users.toggle'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data: user } = await supabase.from('radius_users').select('status').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const nextStatus = user.status === 'Active' ? 'Disabled' : 'Active';
    const { data, error } = await supabase.from('radius_users').update({ status: nextStatus }).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/disconnect', authenticateToken, requirePermission('users.disconnect'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('radius_users').update({ online: false, ip: '' }).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, user: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
