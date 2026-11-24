const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../auth.cjs');

router.post('/send', authenticateToken, async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    res.json({ success: true, dispatchedTo: phone, message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
