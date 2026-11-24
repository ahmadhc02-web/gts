const express = require('express');
const router = express.Router();
const { supabase } = require('../db.cjs');
const { verifyMainUserCredentials, resolveRadiusAccess, buildAuthMe, generateToken, authenticateToken } = require('../auth.cjs');
const { undiciFetch } = require('undici');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const userRecord = await verifyMainUserCredentials(username, password);
    if (!userRecord) {
      return res.status(401).json({ error: 'Invalid credentials or account disabled' });
    }

    const uid = userRecord.uid || userRecord.id || userRecord.username;
    const accessRecord = await resolveRadiusAccess(uid, username);

    const authMe = await buildAuthMe(userRecord, accessRecord);
    const token = generateToken(authMe);

    res.json({ token, user: authMe });
  } catch (err) {
    next(err);
  }
});

router.post('/session', async (req, res, next) => {
  try {
    const { uid, password, provider, accessToken } = req.body;
    let userRecord = null;

    if (provider === 'google' && accessToken) {
      // Verify google token via userinfo
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const gInfo = await r.json();
        if (gInfo && gInfo.email_verified && gInfo.email) {
          // lookup in users
          const { data } = await supabase.from('users').select('*').eq('email', gInfo.email).maybeSingle();
          userRecord = data;
        }
      } catch (e) {}
    } else if (uid && password) {
      userRecord = await verifyMainUserCredentials(uid, password);
    }

    if (!userRecord) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const userUid = userRecord.uid || userRecord.id || userRecord.username;
    const username = userRecord.username || userRecord.uid;
    const accessRecord = await resolveRadiusAccess(userUid, username);

    const authMe = await buildAuthMe(userRecord, accessRecord);
    const token = generateToken(authMe);

    res.json({ token, user: authMe });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const sub = req.user.sub;
    const username = req.user.username;
    const { data: primaryUser } = await supabase.from('users').select('*').eq('uid', sub).maybeSingle();
    const userRecord = primaryUser ||
      (await supabase.from('users_data').select('*').eq('username', username).maybeSingle()).data;
    
    if (!userRecord) {
      return res.json(req.user);
    }

    const accessRecord = await resolveRadiusAccess(sub, username);
    const authMe = await buildAuthMe(userRecord, accessRecord);
    res.json(authMe);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', authenticateToken, async (req, res, next) => {
  try {
    const newToken = generateToken(req.user);
    res.json({ token: newToken, user: req.user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
