const { createClient } = require('@supabase/supabase-js');
const { Agent, fetch: undiciFetch } = require('undici');
const dotenv = require('dotenv');

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  process.exit(1);
}

const DB_TIMEOUT_MS = 10000;

let insecureAgent = null;
if (process.env.RADIUS_SUPABASE_INSECURE_TLS === '1') {
  console.warn("WARNING: RADIUS_SUPABASE_INSECURE_TLS is enabled. TLS certificate validation is disabled for Supabase client.");
  insecureAgent = new Agent({
    connect: { rejectUnauthorized: false }
  });
}

function createDbUnreachableError(cause) {
  const err = new Error('Database unreachable');
  err.status = 503;
  if (cause) err.cause = cause;
  return err;
}

function isTimeoutOrNetworkError(err) {
  if (!err) return false;
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true;
  if (err.name === 'TypeError' && /fetch/i.test(String(err.message || ''))) return true;
  const code = err.code || (err.cause && err.cause.code) || '';
  if (/^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|EPIPE|UND_ERR_)/i.test(String(code))) {
    return true;
  }
  const msg = String(err.message || '') + ' ' + String((err.cause && err.cause.message) || '');
  if (/timeout|timed out|aborted|fetch failed|network|socket hang up|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg)) {
    return true;
  }
  return false;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutSignal = AbortSignal.timeout(DB_TIMEOUT_MS);
  const signal = options && options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const fetchOpts = { ...options, signal };
  if (insecureAgent) {
    fetchOpts.dispatcher = insecureAgent;
  }

  try {
    return await undiciFetch(url, fetchOpts);
  } catch (err) {
    if (isTimeoutOrNetworkError(err)) {
      throw createDbUnreachableError(err);
    }
    throw err;
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout }
});

module.exports = { supabase, createDbUnreachableError, isTimeoutOrNetworkError };
