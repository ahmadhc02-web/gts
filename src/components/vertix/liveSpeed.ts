import { RadiusUser } from './radiusStore';

export type SpeedSample = { t: number; down: number; up: number }; // t = Date.now(), down/up stored in Mbps (decimal network units: 1 Mbps = 1000 Kbps)

export interface LiveSpeedSource {
  next(): SpeedSample;
}

// Deterministic seed helper so each user ID has a unique, stable traffic signature
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Creates a simulated real-time speed data source.
 * Simulates a smooth random walk adhering to user package limit and online status.
 */
export function createSimulatedSource(user: RadiusUser, packageSpeedMbps: number): LiveSpeedSource {
  const limit = Number.isFinite(packageSpeedMbps) && packageSpeedMbps > 0 ? packageSpeedMbps : 10;
  const seed = hashString(user.id || user.username || 'user');

  // Pseudo-random initial state seeded by user
  let currentDown = limit * (0.3 + ((seed % 35) / 100));
  let currentUp = limit * (0.08 + ((seed % 15) / 100));
  let targetDown = currentDown;
  let targetUp = currentUp;
  let tick = 0;

  // LCG pseudo-random generator
  let randState = (seed ^ 0x5deece66) + 1;
  const nextRand = () => {
    randState = (randState * 1664525 + 1013904223) % 4294967296;
    return randState / 4294967296;
  };

  return {
    next(): SpeedSample {
      const now = Date.now();
      // If user is offline, bandwidth is zero
      if (!user.online) {
        return { t: now, down: 0, up: 0 };
      }

      tick++;

      // Shift target every ~5 samples
      if (tick % 5 === 0) {
        const isBurst = nextRand() < 0.12;
        if (isBurst) {
          // Occasional download burst up to ~92%
          targetDown = limit * (0.75 + nextRand() * 0.18);
          targetUp = limit * (0.2 + nextRand() * 0.12);
        } else {
          // Standard drift: down targets 25-85%, up targets 5-35%
          targetDown = limit * (0.25 + nextRand() * 0.6);
          targetUp = limit * (0.05 + nextRand() * 0.3);
        }
      }

      // Smooth drift with minor jitter noise
      const downNoise = (nextRand() - 0.5) * limit * 0.08;
      const upNoise = (nextRand() - 0.5) * limit * 0.04;

      currentDown += (targetDown - currentDown) * 0.28 + downNoise;
      currentUp += (targetUp - currentUp) * 0.28 + upNoise;

      // Strict clamping with 4 decimal places (0.1 Kbps precision)
      const down = Math.max(0, Math.min(limit, Number(currentDown.toFixed(4))));
      const up = Math.max(0, Math.min(limit, Number(currentUp.toFixed(4))));

      return {
        t: now,
        down,
        up,
      };
    },
  };
}

/**
 * Placeholder for future router / RADIUS live accounting integration.
 * In production, this function will query the router (e.g. MikroTik RouterOS API / REST,
 * RADIUS Acct-Input-Octets & Acct-Output-Octets, SNMP bandwidth counters, or Prometheus / NetFlow)
 * to retrieve real-time byte counters and compute delta Mbps for the specific subscriber.
 *
 * To switch to real data:
 * 1. Implement this function to call your backend / API endpoint with the subscriber's userId or username.
 * 2. Return { t: Date.now(), down: number, up: number } where down and up are computed Mbps.
 */
export async function fetchRealSample(userId: string): Promise<SpeedSample | null> {
  // TODO: Call router or RADIUS accounting API
  return null;
}
