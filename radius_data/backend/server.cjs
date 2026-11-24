const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

dotenv.config();

const EXAMPLE_JWT_SECRET = 'super_secret_jwt_key_must_be_at_least_32_chars_long';
const EXAMPLE_ENC_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function validateStartupEnv() {
  const jwtSecret = process.env.RADIUS_JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret === EXAMPLE_JWT_SECRET) {
    console.error('FATAL: RADIUS_JWT_SECRET must be set, at least 32 characters long, and not equal to the example value.');
    process.exit(1);
  }

  const encKey = process.env.RADIUS_ENC_KEY;
  if (!encKey || !/^[0-9a-fA-F]{64}$/.test(encKey)) {
    console.error('FATAL: RADIUS_ENC_KEY must be set and be exactly 64 hex characters.');
    process.exit(1);
  }
  const lowerEnc = encKey.toLowerCase();
  if (lowerEnc === EXAMPLE_ENC_KEY || /^(.)\1{63}$/.test(lowerEnc)) {
    console.error('FATAL: RADIUS_ENC_KEY must not be the example value or all the same character.');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
    process.exit(1);
  }
}

validateStartupEnv();

const { supabase } = require('./db.cjs');

const app = express();
const RADIUS_PORT = process.env.RADIUS_PORT || 3002;

app.use((req, res, next) => {
  const startNs = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startNs) / 1e6;
    console.log(`[Radius] ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
});

app.use(helmet());
app.use(express.json({ limit: '200kb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health/deep', async (_req, res) => {
  const start = Date.now();
  try {
    const { error } = await supabase.from('radius_lines').select('id').limit(1);
    const ms = Date.now() - start;
    if (error) {
      console.error('Radius Health Check Error:', error.message || 'Database error');
      return res.status(503).json({ ok: false, ms, error: 'Database unreachable' });
    }
    return res.json({ ok: true, ms });
  } catch (err) {
    const ms = Date.now() - start;
    console.error('Radius Health Check Error:', err && err.message ? err.message : 'Database error');
    return res.status(503).json({ ok: false, ms, error: 'Database unreachable' });
  }
});

// Mount routes
app.use('/auth', require('./routes/auth.cjs'));
app.use('/lines', require('./routes/lines.cjs'));
app.use('/dealers', require('./routes/dealers.cjs'));
app.use('/staff', require('./routes/staff.cjs'));
app.use('/members', require('./routes/members.cjs'));
app.use('/vlans', require('./routes/vlans.cjs'));
app.use('/users', require('./routes/users.cjs'));
app.use('/packages', require('./routes/packages.cjs'));
app.use('/vouchers', require('./routes/vouchers.cjs'));
app.use('/payments', require('./routes/payments.cjs'));
app.use('/nas', require('./routes/nas.cjs'));
app.use('/stats', require('./routes/stats.cjs'));
app.use('/logs', require('./routes/logs.cjs'));
app.use('/sms', require('./routes/sms.cjs'));
app.use('/settings', require('./routes/settings.cjs'));

// Expiry background job every 60s
setInterval(async () => {
  try {
    const { supabase } = require('./db.cjs');
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('radius_users')
      .update({ status: 'Expired' })
      .lt('expiry', today)
      .eq('status', 'Active');
  } catch (e) {}
}, 60000);

// Generic error handler without stack traces
app.use((err, req, res, next) => {
  const detail = err && err.cause && err.cause.message ? ` (${err.cause.message})` : '';
  console.error("Radius Service Error:", `${err.message || err}${detail}`);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(Number(RADIUS_PORT), '127.0.0.1', () => {
  console.log(`Green Radius backend listening on http://127.0.0.1:${RADIUS_PORT}`);
});
