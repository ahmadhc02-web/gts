const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { authenticateToken } = require('../auth.cjs');

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('radius_audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) {
      return res.json({ logs: [] });
    }
    res.json({ logs: data || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
