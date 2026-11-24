export type SpeedUnit = 'Kbps' | 'Mbps' | 'Gbps';

/**
 * Parses package speed text into Mbps (decimal: 1 Mbps = 1000 Kbps, 1 Gbps = 1000 Mbps).
 * Examples:
 * - "512 Kbps" or "512k" -> 0.512
 * - "10 Mbps" or "Turbo 20M" -> 10 or 20
 * - "1 Gbps" or "1G" -> 1000
 * If no unit present, assumes Mbps. Default 10 when nothing can be parsed.
 */
export function parsePackageSpeedMbps(text?: string): number {
  if (!text) return 10;
  const str = text.trim().toLowerCase();

  // Match pattern: number optionally followed by unit
  const match = str.match(/(\d+(?:\.\d+)?)\s*([a-z]+)?/);
  if (!match) return 10;

  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return 10;

  const unitPart = match[2] || '';

  // Check unit in full string or matched unit part
  if (str.includes('gbps') || str.includes('gb') || unitPart === 'g' || unitPart === 'gbps') {
    return num * 1000;
  }
  if (str.includes('kbps') || str.includes('kb') || unitPart === 'k' || unitPart === 'kbps') {
    return num / 1000;
  }
  // Default / Mbps
  return num;
}

/**
 * Formats bandwidth speed in Mbps into decimal speed string:
 * - 0 -> "0 Kbps"
 * - Below 1 Mbps -> Kbps with no decimals (max "999 Kbps")
 * - 1 Mbps up to below 1000 Mbps -> Mbps with 2 decimals under 10 and 1 decimal from 10 to 999.9 (strip trailing zeros: 2.50 -> 2.5)
 * - 1000 Mbps and above -> Gbps with 2 decimals
 * Rounding transitions seamlessly: 999.6 Kbps -> "1 Mbps", 999.96 Mbps -> "1 Gbps"
 */
export function formatSpeed(mbps: number): string {
  if (!Number.isFinite(mbps) || mbps <= 0) {
    return '0 Kbps';
  }

  // 1. Check for Gbps transition (>= 999.95 Mbps rounds to >= 1.00 Gbps)
  if (mbps >= 999.95) {
    const gbps = mbps / 1000;
    const formatted = gbps.toFixed(2);
    const clean = parseFloat(formatted).toString();
    return `${clean.includes('.') ? clean : formatted} Gbps`;
  }

  // 2. Check for Mbps transition (>= 0.9995 Mbps = 999.5 Kbps rounds to 1 Mbps)
  if (mbps >= 0.9995) {
    if (mbps < 10) {
      const val = parseFloat(mbps.toFixed(2));
      if (val >= 10) {
        return `${parseFloat(val.toFixed(1))} Mbps`;
      }
      return `${val} Mbps`;
    }
    const val = parseFloat(mbps.toFixed(1));
    if (val >= 1000) {
      return `${(val / 1000).toFixed(2)} Gbps`;
    }
    return `${val} Mbps`;
  }

  // 3. Below 1 Mbps -> Kbps with no decimals (max "999 Kbps")
  const kbps = Math.round(mbps * 1000);
  if (kbps >= 1000) {
    return '1 Mbps';
  }
  if (kbps <= 0) {
    return '0 Kbps';
  }
  return `${kbps} Kbps`;
}

/**
 * Selects chart speed unit with hysteresis to prevent flickering on boundary values:
 * - Go up to Mbps when max >= 1, up to Gbps when max >= 1000
 * - Go back down to Kbps only when max < 0.8, back down to Mbps only when max < 800
 */
export function pickUnit(maxMbps: number, previous: SpeedUnit): SpeedUnit {
  const val = Number.isFinite(maxMbps) ? maxMbps : 0;

  if (previous === 'Gbps') {
    if (val < 800) {
      return val < 0.8 ? 'Kbps' : 'Mbps';
    }
    return 'Gbps';
  }

  if (previous === 'Mbps') {
    if (val >= 1000) return 'Gbps';
    if (val < 0.8) return 'Kbps';
    return 'Mbps';
  }

  // previous === 'Kbps' (or initial)
  if (val >= 1000) return 'Gbps';
  if (val >= 1) return 'Mbps';
  return 'Kbps';
}

/**
 * Converts Mbps to the target SpeedUnit value:
 * - Kbps: * 1000
 * - Mbps: * 1
 * - Gbps: / 1000
 */
export function toUnit(mbps: number, unit: SpeedUnit): number {
  if (!Number.isFinite(mbps) || mbps <= 0) return 0;
  if (unit === 'Kbps') return mbps * 1000;
  if (unit === 'Gbps') return mbps / 1000;
  return mbps;
}

/**
 * Returns a rounded top chart value from step multiples [1, 2, 2.5, 5, 10] * 10^n
 * that is at least maxValue * 1.15 (minimum 1), along with 5 evenly spaced ticks from 0 to max.
 */
export function niceScale(maxValue: number): { max: number; ticks: number[] } {
  const target = Math.max(1, maxValue * 1.15);

  // Find power of 10
  const exponent = Math.floor(Math.log10(target));
  const magnitude = Math.pow(10, exponent);
  const normalized = target / magnitude;

  // Step multipliers
  const steps = [1, 2, 2.5, 5, 10];
  let chosenStep = 10;

  for (let i = 0; i < steps.length; i++) {
    if (steps[i] >= normalized - 1e-9) {
      chosenStep = steps[i];
      break;
    }
  }

  let top = chosenStep * magnitude;

  // Clean precision issues e.g. 2.5000000000000004 -> 2.5
  top = parseFloat(top.toFixed(4));

  // Generate 5 evenly spaced ticks: 0, 0.25*max, 0.5*max, 0.75*max, max
  const ticks = [
    0,
    parseFloat((top * 0.25).toFixed(4)),
    parseFloat((top * 0.5).toFixed(4)),
    parseFloat((top * 0.75).toFixed(4)),
    top,
  ];

  return { max: top, ticks };
}
