const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');
const { encrypt, decrypt } = require('../crypto.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('radius_nas').select('*');
    if (error) throw error;
    const nasList = (data || []).map(n => ({
      ...n,
      secret: n.secret_enc ? decrypt(n.secret_enc) : (n.secret || '')
    }));
    res.json({ nas: nasList });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('nas.manage'), async (req, res, next) => {
  try {
    const { name, ip, type, secret, status } = req.body;
    if (!name || !ip) return res.status(400).json({ error: 'Name and IP required' });

    const secretEnc = secret ? encrypt(secret) : null;
    const dbRow = {
      id: `nas-${Date.now()}`,
      name,
      ip,
      type: type || 'Mikrotik',
      secret_enc: secretEnc,
      status: status || 'Online',
      latency_ms: Math.floor(Math.random() * 15) + 2,
      active_sessions: 0,
      last_ping: new Date().toISOString()
    };

    const { data, error } = await supabase.from('radius_nas').insert([dbRow]).select().single();
    if (error) throw error;
    res.json({ ...data, secret: secret || '' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, requirePermission('nas.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    if (patch.secret) {
      patch.secret_enc = encrypt(patch.secret);
      delete patch.secret;
    }

    const { data, error } = await supabase.from('radius_nas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, requirePermission('nas.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('radius_nas').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/ping', authenticateToken, requirePermission('nas.manage'), async (req, res, next) => {
  try {
    res.json({ status: 'Online', latencyMs: Math.floor(Math.random() * 10) + 2 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
