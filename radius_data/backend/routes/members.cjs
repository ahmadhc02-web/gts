const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission } = require('../rbac.cjs');

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
    let query = supabase.from('radius_access').select('*').eq('radius_role', 'Member');
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
    res.json({ members: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('members.manage'), async (req, res, next) => {
  try {
    const { uid, username, permissions, scope } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid required' });

    const resolvedUsername = username || (await resolveUsernameForUid(uid)) || uid;

    const { data, error } = await supabase.from('radius_access').upsert([{
      uid,
      username: resolvedUsername,
      permissions: permissions || [],
      scope: scope || null,
      radius_role: 'Member',
      parent_uid: req.user.sub || null,
      line_id: req.user.lineId || null,
      status: 'Active',
      created_at: new Date().toISOString()
    }], { onConflict: 'uid' }).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:uid', authenticateToken, requirePermission('members.manage'), async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { permissions, scope, status } = req.body;
    const patch = {};
    if (permissions !== undefined) patch.permissions = permissions;
    if (scope !== undefined) patch.scope = scope;
    if (status !== undefined) patch.status = status;

    const { data, error } = await supabase
      .from('radius_access')
      .update(patch)
      .eq('uid', uid)
      .eq('radius_role', 'Member')
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/:uid', authenticateToken, requirePermission('members.manage'), async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { error } = await supabase
      .from('radius_access')
      .delete()
      .eq('uid', uid)
      .eq('radius_role', 'Member');
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
