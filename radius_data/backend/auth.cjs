const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { supabase, createDbUnreachableError, isTimeoutOrNetworkError } = require('./db.cjs');

function isMissingRelationError(res) {
  if (!res || !res.error) return false;
  if (res.status === 404) return true;
  const code = String(res.error.code || '');
  if (code === 'PGRST205' || code === '42P01') return true;
  const msg = String(res.error.message || '');
  return /could not find the table|relation .* does not exist/i.test(msg);
}

function isConnectivityOrOutageError(res) {
  if (!res || !res.error) return false;
  if (!res.status || res.status >= 500) return true;
  return isTimeoutOrNetworkError(res.error);
}

function formatSupabaseQueryError(res) {
  if (isConnectivityOrOutageError(res)) {
    return createDbUnreachableError(res.error);
  }
  const err = new Error(res?.error?.message || 'Database query failed');
  err.status = res?.status || 500;
  err.cause = res?.error;
  return err;
}

const EXAMPLE_JWT_SECRET = 'super_secret_jwt_key_must_be_at_least_32_chars_long';
const JWT_SECRET = process.env.RADIUS_JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === EXAMPLE_JWT_SECRET) {
  console.error("FATAL: RADIUS_JWT_SECRET must be configured, at least 32 characters long, and not the example value.");
  process.exit(1);
}

const SAFE_IDENTIFIER_REGEX = /^[a-zA-Z0-9_.@+-]{1,128}$/;

function timingSafePasswordMatch(inputPassword, storedPassword) {
  const stored = String(storedPassword || '');
  if (!stored) return false;
  if (stored.startsWith('$2')) {
    return bcrypt.compareSync(String(inputPassword), stored);
  }
  const inputDigest = crypto.createHash('sha256').update(String(inputPassword)).digest();
  const storedDigest = crypto.createHash('sha256').update(stored).digest();
  return crypto.timingSafeEqual(inputDigest, storedDigest);
}

async function verifyMainUserCredentials(uidOrUsername, password) {
  const safeId = typeof uidOrUsername === 'string' ? uidOrUsername.trim() : '';
  if (!safeId || !SAFE_IDENTIFIER_REGEX.test(safeId)) {
    return null;
  }
  if (typeof password !== 'string' || password.length === 0) {
    return null;
  }

  const tables = ['users', 'users_data', 'login_profiles'];
  const filter = `username.eq.${safeId},email.eq.${safeId},uid.eq.${safeId}`;

  const results = await Promise.all(
    tables.map((t) =>
      supabase
        .from(t)
        .select('*')
        .or(filter)
        .limit(2)
    )
  );

  let reachableTables = 0;
  for (const res of results) {
    if (!res.error) {
      reachableTables += 1;
    } else if (!isMissingRelationError(res)) {
      throw formatSupabaseQueryError(res);
    }
  }

  if (reachableTables === 0) {
    throw createDbUnreachableError(new Error('No user lookup tables accessible'));
  }

  const allMatches = [];
  const distinctUserKeys = new Set();

  results.forEach((res, tableIdx) => {
    if (res.error) return;
    const rows = Array.isArray(res.data) ? res.data : [];
    rows.forEach((row, rowIdx) => {
      allMatches.push(row);
      const distinctKey = row.uid
        ? `uid:${String(row.uid)}`
        : row.id !== undefined && row.id !== null
          ? `id:${tables[tableIdx]}:${String(row.id)}`
          : `row:${tables[tableIdx]}:${rowIdx}`;
      distinctUserKeys.add(distinctKey);
    });
  });

  if (distinctUserKeys.size > 1) {
    const err = new Error('Username is not unique, use the main login');
    err.status = 409;
    throw err;
  }

  const foundUser = allMatches[0] || null;
  if (!foundUser) return null;

  const status = foundUser.status || foundUser.state || 'Active';
  if (['blocked', 'disabled', 'pending', 'suspended'].includes(String(status).toLowerCase())) {
    return null;
  }

  const storedPass = foundUser.password || foundUser.pass || foundUser.pin || '';
  if (!timingSafePasswordMatch(password, storedPass)) {
    return null;
  }
  return foundUser;
}

async function resolveRadiusAccess(userUid, username) {
  const uidRes = await supabase
    .from('radius_access')
    .select('*')
    .eq('uid', userUid)
    .maybeSingle();

  if (uidRes.error) {
    if (isMissingRelationError(uidRes)) return null;
    throw formatSupabaseQueryError(uidRes);
  }
  if (uidRes.data) return uidRes.data;

  if (username) {
    const userRes = await supabase
      .from('radius_access')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (userRes.error) {
      if (isMissingRelationError(userRes)) return null;
      throw formatSupabaseQueryError(userRes);
    }
    return userRes.data;
  }

  return null;
}

async function buildAuthMe(userRecord, accessRecord) {
  const uid = userRecord.uid || userRecord.id || userRecord.username;
  const username = userRecord.username || userRecord.uid;
  const isSuper = userRecord.role === 'super_admin' || accessRecord?.radius_role === 'SuperAdmin';

  let radiusRole = 'Member';
  let lineId = accessRecord?.line_id || null;
  let lineCode = accessRecord?.line_code || null;
  let parentUid = accessRecord?.parent_uid || null;
  let dealerUid = accessRecord?.dealer_uid || null;
  let permissions = accessRecord?.permissions || [];
  let scope = accessRecord?.scope || null;

  if (isSuper) {
    radiusRole = 'SuperAdmin';
    permissions = ['*'];
  } else if (accessRecord) {
    radiusRole = accessRecord.radius_role || 'Member';
  } else {
    throw new Error("No Green Radius access for this account");
  }

  return {
    sub: uid,
    username,
    fullName: userRecord.full_name || userRecord.name || username,
    radiusRole,
    lineId,
    lineCode,
    parentUid,
    dealerUid,
    balance: userRecord.balance || accessRecord?.balance || 0,
    creditLimit: accessRecord?.credit_limit || 0,
    permissions,
    scope,
    status: 'Active'
  };
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    req.user = user;
    next();
  });
}

module.exports = { verifyMainUserCredentials, resolveRadiusAccess, buildAuthMe, generateToken, authenticateToken };
