export interface DnsResolveResult {
  host: string;
  ip: string | null;
  recordType: 'A' | 'AAAA' | 'literal' | null;
  dnsMs: number | null;
  source: 'cloudflare-doh' | 'google-doh' | 'system-dns' | 'literal' | 'failed';
  error?: string;
  resolvedAt: number;
}

const DNS_CACHE_TTL_MS = 5 * 60 * 1000;
const DNS_FAIL_CACHE_TTL_MS = 30 * 1000;
const DNS_TIMEOUT_MS = 3000;

const dnsCache = new Map<string, DnsResolveResult>();
const inFlightLookups = new Map<string, Promise<DnsResolveResult>>();

const IPV4_REGEX =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const VALID_DOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function cleanHostIdentifier(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  if (/^ping\s+/i.test(s)) {
    const tokens = s.split(/\s+/).slice(1);
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if ((tok === '-c' || tok === '-n' || tok === '-W' || tok === '-w' || tok === '-i' || tok === '-s') && i + 1 < tokens.length) {
        i++;
        continue;
      }
      if (tok.startsWith('-')) continue;
      s = tok;
    }
  }
  s = s.replace(/^[a-zA-Z]+:\/\//i, '');
  s = s.split('/')[0].split('?')[0].split('#')[0];
  if (s.startsWith('[')) {
    const endBracket = s.indexOf(']');
    if (endBracket !== -1) {
      s = s.slice(1, endBracket);
    }
  } else if ((s.match(/:/g) || []).length === 1) {
    s = s.split(':')[0];
  }
  return s.trim().toLowerCase().replace(/\.+$/, '');
}

export function isIpv4Address(host: string): boolean {
  return IPV4_REGEX.test(host.trim());
}

export function isIpv6Address(host: string): boolean {
  const clean = host.trim().replace(/^\[|\]$/g, '');
  if (!clean.includes(':')) return false;
  return /^[0-9a-fA-F:]+$/.test(clean);
}

export function isIpAddress(host: string): boolean {
  return isIpv4Address(host) || isIpv6Address(host);
}

export function isPrivateOrLocalIp(host: string): boolean {
  const clean = cleanHostIdentifier(host);
  if (clean === 'localhost' || clean === '::1') return true;
  if (!isIpv4Address(clean)) return false;
  const parts = clean.split('.').map(Number);
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 0) return true;
  return false;
}

export function isKnownHttpsBareIp(host: string): boolean {
  const clean = cleanHostIdentifier(host);
  return clean === '8.8.8.8' || clean === '8.8.4.4' || clean === '1.1.1.1' || clean === '1.0.0.1';
}

export function isHttpOnlyOrNonWebTarget(rawHost: string, cleanHost?: string): boolean {
  const raw = (rawHost || '').trim().toLowerCase();
  const clean = cleanHost || cleanHostIdentifier(rawHost);
  if (!clean) return false;
  if (/^http:\/\//i.test(raw)) return true;
  if (isPrivateOrLocalIp(clean)) return true;
  if (/\.(local|lan|home|internal|arpa)$/i.test(clean)) return true;
  if (isIpAddress(clean) && !isKnownHttpsBareIp(clean)) return true;
  return false;
}

interface DohJsonResponse {
  Status?: number;
  Answer?: Array<{
    name?: string;
    type?: number;
    TTL?: number;
    data?: string;
  }>;
}

async function queryDohEndpoint(
  provider: 'cloudflare' | 'google',
  host: string,
  recordType: 'A' | 'AAAA'
): Promise<{ ip: string | null; statusCode?: number; error?: string }> {
  const url =
    provider === 'cloudflare'
      ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${recordType}`
      : `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=${recordType}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/dns-json',
      },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ip: null, error: `DoH HTTP ${res.status}` };
    }

    const json = (await res.json()) as DohJsonResponse;
    const expectedTypeNum = recordType === 'A' ? 1 : 28;
    const answers = Array.isArray(json?.Answer) ? json.Answer : [];
    const match = answers.find(
      (a) => a && a.type === expectedTypeNum && typeof a.data === 'string' && isIpAddress(a.data.trim())
    );

    if (match && match.data) {
      return { ip: match.data.trim(), statusCode: json.Status };
    }

    if (json?.Status === 3) {
      return { ip: null, statusCode: 3, error: 'Domain does not exist (NXDOMAIN)' };
    }
    if (typeof json?.Status === 'number' && json.Status !== 0) {
      return { ip: null, statusCode: json.Status, error: `DNS status ${json.Status}` };
    }
    return { ip: null, statusCode: json?.Status ?? 0, error: `No ${recordType} record` };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ip: null, error: 'DNS lookup timed out' };
    }
    return { ip: null, error: 'DoH lookup failed' };
  } finally {
    clearTimeout(timer);
  }
}

async function performDohLookup(cleanHost: string): Promise<DnsResolveResult> {
  const t0 = performance.now();

  // 0. Primary: Query server system DNS resolver (/api/dns-resolve) for 100% parity with local OS resolution
  if (typeof window !== 'undefined') {
    try {
      const srvRes = await fetch(`/api/dns-resolve?host=${encodeURIComponent(cleanHost)}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData?.ip) {
          return {
            host: cleanHost,
            ip: srvData.ip,
            recordType: srvData.family === 6 ? 'AAAA' : 'A',
            dnsMs: typeof srvData.dnsMs === 'number' ? srvData.dnsMs : Math.round((performance.now() - t0) * 10) / 10,
            source: 'system-dns',
            resolvedAt: Date.now(),
          };
        }
      }
    } catch {
      // Fallback to DoH if server endpoint is unreachable
    }
  }

  // 1. Try Cloudflare DoH A record, fallback to Google DoH A record
  let cfA = await queryDohEndpoint('cloudflare', cleanHost, 'A');
  if (cfA.ip) {
    return {
      host: cleanHost,
      ip: cfA.ip,
      recordType: 'A',
      dnsMs: Math.round((performance.now() - t0) * 10) / 10,
      source: 'cloudflare-doh',
      resolvedAt: Date.now(),
    };
  }

  let ggA = await queryDohEndpoint('google', cleanHost, 'A');
  if (ggA.ip) {
    return {
      host: cleanHost,
      ip: ggA.ip,
      recordType: 'A',
      dnsMs: Math.round((performance.now() - t0) * 10) / 10,
      source: 'google-doh',
      resolvedAt: Date.now(),
    };
  }

  // 2. Fallback to AAAA (Cloudflare then Google)
  const cfAAAA = await queryDohEndpoint('cloudflare', cleanHost, 'AAAA');
  if (cfAAAA.ip) {
    return {
      host: cleanHost,
      ip: cfAAAA.ip,
      recordType: 'AAAA',
      dnsMs: Math.round((performance.now() - t0) * 10) / 10,
      source: 'cloudflare-doh',
      resolvedAt: Date.now(),
    };
  }

  const ggAAAA = await queryDohEndpoint('google', cleanHost, 'AAAA');
  if (ggAAAA.ip) {
    return {
      host: cleanHost,
      ip: ggAAAA.ip,
      recordType: 'AAAA',
      dnsMs: Math.round((performance.now() - t0) * 10) / 10,
      source: 'google-doh',
      resolvedAt: Date.now(),
    };
  }

  const reason =
    cfA.statusCode === 3 || ggA.statusCode === 3
      ? 'NXDOMAIN (host not found)'
      : ggA.error || cfA.error || 'DNS resolution failed';

  return {
    host: cleanHost,
    ip: null,
    recordType: null,
    dnsMs: Math.round((performance.now() - t0) * 10) / 10,
    source: 'failed',
    error: reason,
    resolvedAt: Date.now(),
  };
}

export function getCachedDnsIp(host: string): DnsResolveResult | null {
  const clean = cleanHostIdentifier(host);
  if (!clean) return null;
  if (isIpAddress(clean)) {
    return {
      host: clean,
      ip: clean.replace(/^\[|\]$/g, ''),
      recordType: 'literal',
      dnsMs: 0,
      source: 'literal',
      resolvedAt: Date.now(),
    };
  }
  const entry = dnsCache.get(clean);
  if (!entry) return null;
  const ttl = entry.ip ? DNS_CACHE_TTL_MS : DNS_FAIL_CACHE_TTL_MS;
  if (Date.now() - entry.resolvedAt >= ttl) return null;
  return entry;
}

export async function resolveHostIp(
  host: string,
  options?: { forceRefresh?: boolean }
): Promise<DnsResolveResult> {
  const clean = cleanHostIdentifier(host);
  if (!clean) {
    return {
      host: '',
      ip: null,
      recordType: null,
      dnsMs: null,
      source: 'failed',
      error: 'Invalid host',
      resolvedAt: Date.now(),
    };
  }

  if (isIpAddress(clean)) {
    const literalIp = clean.replace(/^\[|\]$/g, '');
    const res: DnsResolveResult = {
      host: clean,
      ip: literalIp,
      recordType: 'literal',
      dnsMs: 0,
      source: 'literal',
      resolvedAt: Date.now(),
    };
    dnsCache.set(clean, res);
    return res;
  }

  if (clean === 'localhost') {
    return {
      host: clean,
      ip: '127.0.0.1',
      recordType: 'literal',
      dnsMs: 0,
      source: 'literal',
      resolvedAt: Date.now(),
    };
  }

  if (/\.(local|lan|home|internal)$/i.test(clean)) {
    return {
      host: clean,
      ip: null,
      recordType: null,
      dnsMs: null,
      source: 'failed',
      error: 'Local LAN name (not in public DNS)',
      resolvedAt: Date.now(),
    };
  }

  if (!VALID_DOMAIN_REGEX.test(clean)) {
    return {
      host: clean,
      ip: null,
      recordType: null,
      dnsMs: null,
      source: 'failed',
      error: 'Invalid hostname',
      resolvedAt: Date.now(),
    };
  }

  const cached = dnsCache.get(clean);
  const now = Date.now();
  if (cached && !options?.forceRefresh) {
    const ttl = cached.ip ? DNS_CACHE_TTL_MS : DNS_FAIL_CACHE_TTL_MS;
    if (now - cached.resolvedAt < ttl) {
      return cached;
    }
    // Stale entry with an existing IP: return cached immediately while re-resolving in background
    if (cached.ip && !inFlightLookups.has(clean)) {
      void refreshDnsEntry(clean);
      return cached;
    }
  }

  return refreshDnsEntry(clean);
}

function refreshDnsEntry(cleanHost: string): Promise<DnsResolveResult> {
  const existing = inFlightLookups.get(cleanHost);
  if (existing) return existing;

  const p = performDohLookup(cleanHost)
    .then((result) => {
      dnsCache.set(cleanHost, result);
      return result;
    })
    .finally(() => {
      inFlightLookups.delete(cleanHost);
    });

  inFlightLookups.set(cleanHost, p);
  return p;
}

export function startDnsBackgroundRefresh(
  getHosts: () => string[],
  onResolved?: (host: string, result: DnsResolveResult) => void
): () => void {
  const timer = setInterval(() => {
    const hosts = Array.from(new Set(getHosts().map(cleanHostIdentifier).filter(Boolean)));
    hosts.forEach((h) => {
      if (isIpAddress(h) || h === 'localhost') return;
      void resolveHostIp(h, { forceRefresh: true }).then((res) => {
        onResolved?.(h, res);
      });
    });
  }, DNS_CACHE_TTL_MS);

  return () => clearInterval(timer);
}
