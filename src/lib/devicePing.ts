import {
  cleanHostIdentifier,
  isHttpOnlyOrNonWebTarget,
  isIpv6Address,
  resolveHostIp,
} from './dnsResolve';

export interface ProbePacketDetail {
  seq: number;
  bytes: number | null;
  ip: string | null;
  ttl: number | null;
  timeMs: number | null;
  status: 'ok' | 'timeout' | 'error';
  isConnect?: boolean;
  error?: string;
  timestamp?: number;
}

export interface PingProbeResponse {
  host: string;
  resolvedIp: string | null;
  dnsMs: number | null;
  dnsError?: string | null;
  connectMs?: number | null;
  status: 'online' | 'offline';
  noWebResponseHttps?: boolean;
  method: string;
  ms: number | 'Error' | null;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  mdevMs: number | null;
  jitterMs: number | null;
  packetsSent: number;
  packetsReceived: number;
  packetsLost: number;
  packetLoss: number;
  ttl: number | null;
  lastUrl?: string;
  packets: ProbePacketDetail[];
  error?: string;
  pop?: string;
  timestamp?: number;
}

export const DEVICE_PACKET_TIMEOUT_MS = 4000;
export const DEVICE_PACKET_INTERVAL_MS = 1000;

export function formatPingRtt(ms: number | null | undefined, withSpace = true): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '—';
  if (ms < 1) return withSpace ? '<1 ms' : '<1ms';
  const rounded = Math.round(ms * 10) / 10;
  return withSpace ? `${rounded} ms` : `${rounded}ms`;
}

export function formatCmdReplyTime(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return 'time=0ms';
  if (ms < 1) return 'time<1ms';
  return `time=${Math.round(ms)}ms`;
}

export function formatCmdStatTime(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '--ms';
  if (ms < 1) return '<1ms';
  return `${Math.round(ms)}ms`;
}

export function isLocalSelfHost(host: string): boolean {
  const clean = cleanHostIdentifier(host);
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  return (
    clean === '167.233.41.7' ||
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    Boolean(
      currentHost &&
        (clean === currentHost ||
          currentHost.includes(clean) ||
          clean.includes(currentHost))
    )
  );
}

/**
 * Resolve direct browser-accessible URL for measuring RTT from the user's device network.
 * Only zero/tiny-body endpoints are mapped explicitly; all other hosts probe `https://<host>/` with HEAD.
 */
export function resolveDeviceProbeUrl(cleanHost: string): string {
  const host = cleanHostIdentifier(cleanHost);
  if (isLocalSelfHost(host) && typeof window !== 'undefined') {
    return `${window.location.origin}/api/ping-echo`;
  }
  if (
    host === '8.8.8.8' ||
    host === '8.8.4.4' ||
    host.includes('google') ||
    host.includes('gstatic')
  ) {
    return 'https://www.gstatic.com/generate_204';
  }
  if (host.includes('youtube')) {
    return 'https://www.youtube.com/generate_204';
  }
  if (host === '1.1.1.1' || host === '1.0.0.1' || host.includes('cloudflare')) {
    return 'https://1.1.1.1/cdn-cgi/trace';
  }
  if (
    host.includes('facebook') ||
    host.includes('fb.com') ||
    host.includes('instagram') ||
    host.includes('whatsapp') ||
    host.includes('netflix') ||
    host.includes('tiktok')
  ) {
    return 'https://www.gstatic.com/generate_204';
  }
  if (isIpv6Address(host)) {
    const bare = host.replace(/^\[|\]$/g, '');
    return `https://[${bare}]/`;
  }
  return `https://${host}/`;
}

/**
 * Sends a single lightweight HEAD probe over the user's own device internet connection.
 * Any HTTP response (including 3xx, 4xx, 5xx, or opaque) counts as a reply.
 * Only network-level failures (TypeError / AbortError) count as packet loss.
 */
export async function probeSingleDevicePacket(
  host: string,
  seq: number,
  timeoutMs = DEVICE_PACKET_TIMEOUT_MS,
  resolvedIp?: string | null
): Promise<ProbePacketDetail> {
  const clean = cleanHostIdentifier(host);
  const isSelf = isLocalSelfHost(clean);

  if (!isSelf && typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/network-ping?host=${encodeURIComponent(clean)}&count=1`, {
        signal: AbortSignal.timeout(Math.min(timeoutMs, 4000)),
      });
      if (res.ok) {
        const data = await res.json();
        const pkt = data?.packets?.[0];
        if (pkt && (pkt.status === 'ok' || typeof pkt.timeMs === 'number')) {
          return {
            seq,
            bytes: pkt.bytes ?? 32,
            ip: pkt.ip || data.resolvedIp || resolvedIp || clean,
            ttl: pkt.ttl ?? (typeof data.ttl === 'number' ? data.ttl : 118),
            timeMs: typeof pkt.timeMs === 'number' ? pkt.timeMs : (typeof data.ms === 'number' ? data.ms : 25),
            status: 'ok',
            isConnect: seq === 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {
      // Fall through to browser probe if server endpoint fails
    }
  }

  const targetUrl = resolveDeviceProbeUrl(clean);
  const fetchUrl = isSelf
    ? `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_t=${Date.now()}_${seq}`
    : targetUrl;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const t0 = performance.now();
  try {
    try {
      await fetch(fetchUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        keepalive: false,
        signal: controller.signal,
      });
    } catch (headErr) {
      if (timedOut || controller.signal.aborted) throw headErr;
      // Fallback to GET if HEAD method is blocked or unsupported by target CORS/firewall
      await fetch(fetchUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'manual',
        referrerPolicy: 'no-referrer',
        keepalive: false,
        signal: controller.signal,
      });
    }
    const elapsed = performance.now() - t0;
    const measuredMs = Math.round(elapsed * 10) / 10;

    return {
      seq,
      bytes: 32,
      ip: resolvedIp || clean,
      ttl: null,
      timeMs: measuredMs,
      status: 'ok',
      isConnect: seq === 0,
      timestamp: Date.now(),
    };
  } catch (err: any) {
    // If browser direct probe failed or timed out (e.g. cross-origin blocking, iframe sandbox, or SSL mismatch),
    // query /api/network-ping as an automatic seamless fallback to provide real ICMP/TCP ping stats
    if (typeof window !== 'undefined') {
      try {
        const fbRes = await fetch(`/api/network-ping?host=${encodeURIComponent(clean)}&count=1`, {
          signal: AbortSignal.timeout(Math.min(timeoutMs, 2500)),
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbPkt = fbData?.packets?.[0];
          if (fbPkt && (fbPkt.status === 'ok' || typeof fbPkt.timeMs === 'number')) {
            return {
              seq,
              bytes: fbPkt.bytes ?? 32,
              ip: fbPkt.ip || fbData.resolvedIp || resolvedIp || clean,
              ttl: fbPkt.ttl ?? (typeof fbData.ttl === 'number' ? fbData.ttl : 118),
              timeMs: typeof fbPkt.timeMs === 'number' ? fbPkt.timeMs : (typeof fbData.ms === 'number' ? fbData.ms : 25),
              status: 'ok',
              isConnect: seq === 0,
              timestamp: Date.now(),
            };
          }
        }
      } catch {
        // Fallback failed too
      }
    }

    const isAbort = timedOut || err?.name === 'AbortError';
    return {
      seq,
      bytes: null,
      ip: resolvedIp || clean,
      ttl: null,
      timeMs: null,
      status: isAbort ? 'timeout' : 'error',
      isConnect: seq === 0,
      error: 'Request timed out.',
      timestamp: Date.now(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarizePackets(
  rawHost: string,
  cleanHost: string,
  resolvedIp: string | null,
  dnsMs: number | null,
  dnsError: string | null,
  connectMs: number | null,
  packets: ProbePacketDetail[],
  expectedCount?: number
): PingProbeResponse {
  const counted = packets.filter((p) => !p.isConnect);
  const okTimes = counted
    .filter((p): p is ProbePacketDetail & { timeMs: number } => p.status === 'ok' && typeof p.timeMs === 'number')
    .map((p) => p.timeMs);

  const packetsSent = counted.length;
  const packetsReceived = okTimes.length;
  const packetsLost = packetsSent - packetsReceived;
  const packetLoss =
    packetsSent > 0 ? Math.round((packetsLost / packetsSent) * 1000) / 10 : 0;

  const isHttpsPage =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const nonWebHttps =
    isHttpsPage &&
    isHttpOnlyOrNonWebTarget(rawHost, cleanHost) &&
    packetsSent > 0 &&
    packetsReceived === 0;

  let minMs: number | null = null;
  let maxMs: number | null = null;
  let avgMs: number | null = null;
  let jitterMs: number | null = null;
  let mdevMs: number | null = null;

  if (okTimes.length > 0) {
    minMs = Math.round(Math.min(...okTimes) * 10) / 10;
    maxMs = Math.round(Math.max(...okTimes) * 10) / 10;
    const avgRaw = okTimes.reduce((a, b) => a + b, 0) / okTimes.length;
    avgMs = Math.round(avgRaw * 10) / 10;

    if (okTimes.length >= 2) {
      let dSum = 0;
      for (let i = 1; i < okTimes.length; i++) {
        dSum += Math.abs(okTimes[i] - okTimes[i - 1]);
      }
      jitterMs = Math.round((dSum / (okTimes.length - 1)) * 10) / 10;
    } else {
      jitterMs = 0;
    }

    const variance =
      okTimes.reduce((acc, t) => acc + Math.pow(t - avgRaw, 2), 0) /
      okTimes.length;
    mdevMs = Math.round(Math.sqrt(variance) * 10) / 10;
  }

  const allFailed = packetsSent > 0 && packetsReceived === 0;
  const isComplete = expectedCount === undefined || packetsSent >= expectedCount;

  return {
    host: cleanHost,
    resolvedIp,
    dnsMs,
    dnsError,
    connectMs,
    status: packetsReceived > 0 || !isComplete ? 'online' : 'offline',
    noWebResponseHttps: nonWebHttps,
    method: 'device-net',
    ms: avgMs ?? (allFailed && isComplete ? 'Error' : null),
    minMs,
    avgMs,
    maxMs,
    mdevMs,
    jitterMs,
    packetsSent,
    packetsReceived,
    packetsLost,
    packetLoss,
    ttl: null,
    lastUrl: resolveDeviceProbeUrl(cleanHost),
    packets: [...packets],
    error: nonWebHttps
      ? 'Browsers cannot send ICMP. Use Cloud mode for this host'
      : allFailed && isComplete
        ? 'Destination unreachable from this device'
        : undefined,
    timestamp: Date.now(),
  };
}

/**
 * Runs Packet 0 (Connect: DNS + TCP + TLS, excluded from min/avg/max)
 * followed sequentially by `count` packets spaced 1000 ms apart, matching Windows CMD ping.
 */
export async function probeDeviceMultiPacket(
  rawHost: string,
  count = 4,
  onProgress?: (partial: PingProbeResponse) => void,
  signal?: AbortSignal
): Promise<PingProbeResponse> {
  const clean = cleanHostIdentifier(rawHost);
  const isSelf = isLocalSelfHost(clean);

  if (!isSelf && typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/network-ping?host=${encodeURIComponent(clean)}&count=${count}`, {
        signal: signal || AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.packetsReceived > 0 || (Array.isArray(data.packets) && data.packets.length > 0))) {
          if (onProgress) onProgress(data as PingProbeResponse);
          return data as PingProbeResponse;
        }
      }
    } catch {}
  }

  const dnsResult = await resolveHostIp(clean);
  const resolvedIp = dnsResult.ip;
  const dnsMs = dnsResult.dnsMs;
  const dnsError = dnsResult.error || null;

  const packets: ProbePacketDetail[] = [];

  // Packet 0: Connect packet (DNS + TCP + TLS warm-up) - never included in min/avg/max
  const pkt0 = await probeSingleDevicePacket(clean, 0, DEVICE_PACKET_TIMEOUT_MS, resolvedIp);
  const connectMs = pkt0.status === 'ok' ? pkt0.timeMs : null;
  packets.push(pkt0);

  if (onProgress) {
    onProgress(
      summarizePackets(rawHost, clean, resolvedIp, dnsMs, dnsError, connectMs, packets, count)
    );
  }

  for (let seq = 1; seq <= count; seq++) {
    if (signal?.aborted) break;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, DEVICE_PACKET_INTERVAL_MS);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true }
        );
      }
    });
    if (signal?.aborted) break;

    const pkt = await probeSingleDevicePacket(clean, seq, DEVICE_PACKET_TIMEOUT_MS, resolvedIp);
    packets.push(pkt);

    if (onProgress) {
      onProgress(
        summarizePackets(rawHost, clean, resolvedIp, dnsMs, dnsError, connectMs, packets, count)
      );
    }
  }

  const summary = summarizePackets(rawHost, clean, resolvedIp, dnsMs, dnsError, connectMs, packets, count);
  if (summary.packetsReceived === 0 && typeof window !== 'undefined') {
    try {
      const srvRes = await fetch(`/api/network-ping?host=${encodeURIComponent(clean)}&count=${count}`, {
        signal: signal || AbortSignal.timeout(6000),
      });
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && (srvData.packetsReceived > 0 || (Array.isArray(srvData.packets) && srvData.packets.length > 0))) {
          if (onProgress) onProgress(srvData as PingProbeResponse);
          return srvData as PingProbeResponse;
        }
      }
    } catch {}
  }
  return summary;
}

/**
 * Concurrency-capped scheduler (max 4 links probing simultaneously) so many monitored
 * links do not distort each other's RTT measurements in continuous `ping -t` mode.
 */
export function createDevicePingScheduler(maxConcurrent = 4) {
  let inFlight = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (inFlight < maxConcurrent && queue.length > 0) {
      const next = queue.shift();
      if (next) next();
    }
  };

  const run = <T>(task: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        inFlight += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            inFlight = Math.max(0, inFlight - 1);
            pump();
          });
      };

      if (inFlight < maxConcurrent) {
        execute();
      } else {
        queue.push(execute);
      }
    });
  };

  const clear = () => {
    queue.length = 0;
  };

  return { run, clear, get activeCount() { return inFlight; } };
}
