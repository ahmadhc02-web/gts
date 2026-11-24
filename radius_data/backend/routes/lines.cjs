const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');
const { requirePermission, getScopedQuery } = require('../rbac.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = supabase.from('radius_lines').select('*');
    query = await getScopedQuery(req, query);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ lines: data || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { name, line_code, owner_uid } = req.body;
    if (!name || !line_code) return res.status(400).json({ error: 'Name and line_code required' });

    const { data, error } = await supabase.from('radius_lines').insert([{
      name,
      line_code: line_code.toUpperCase(),
      owner_uid: owner_uid || req.user.sub,
      status: 'Active',
      created_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateToken, requirePermission('settings.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, line_code, owner_uid, status } = req.body;
    const patch = {};
    if (name) patch.name = name;
    if (line_code) patch.line_code = line_code.toUpperCase();
    if (owner_uid) patch.owner_uid = owner_uid;
    if (status) patch.status = status;

    const { data, error } = await supabase.from('radius_lines').update(patch).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/overview', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('radius_lines').select('*');
    if (error) throw error;
    res.json({ lines: data || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
