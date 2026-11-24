/// <reference types="vite/client" />
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

export const DefaultIcon = L.icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const CLIENT_PIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 26" width="30" height="32">' +
  '<ellipse cx="12" cy="23.5" rx="5" ry="1.6" fill="rgba(15,23,42,0.28)"/>' +
  '<path fill="#10b981" stroke="#065f46" stroke-width="1.6" d="M12 1.5C8.13 1.5 5 4.63 5 8.5c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6 12 6s2.5 1.12 2.5 2.5S13.38 11 12 11z"/>' +
  '</svg>';

export const SHARED_CLIENT_PIN_ICON: L.DivIcon = L.divIcon({
  className: 'custom-client-marker',
  html: `<div style="position:relative;width:30px;height:32px;display:flex;justify-content:center;align-items:flex-end;">${CLIENT_PIN_SVG}</div>`,
  iconSize: [30, 32],
  iconAnchor: [15, 30],
});

const MAX_LABELED_ICON_CACHE = 200;
const labeledIconCache = new Map<string, L.DivIcon>();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getLabeledClientPinIcon(name: string, displayId: string): L.DivIcon {
  const safeName = name || 'Unknown';
  const safeId = displayId || '';
  const key = `${safeName}\u0000${safeId}`;

  const cached = labeledIconCache.get(key);
  if (cached) {
    labeledIconCache.delete(key);
    labeledIconCache.set(key, cached);
    return cached;
  }

  const labelHtml =
    `<div style="position:absolute;top:31px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.95);padding:3px 6px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);white-space:nowrap;display:flex;flex-direction:column;align-items:center;pointer-events:none;border:1px solid #e2e8f0;z-index:100;">` +
    `<span style="font-size:11px;font-weight:900;color:#0f172a;line-height:1.2;">${escapeHtml(safeName)}</span>` +
    `<span style="font-size:9px;font-family:monospace;font-weight:bold;color:#64748b;line-height:1;margin-top:2px;">${escapeHtml(safeId)}</span>` +
    `</div>`;

  const icon = L.divIcon({
    className: 'custom-client-marker',
    html: `<div style="position:relative;width:30px;height:32px;display:flex;justify-content:center;align-items:flex-end;">${CLIENT_PIN_SVG}${labelHtml}</div>`,
    iconSize: [30, 32],
    iconAnchor: [15, 30],
  });

  if (labeledIconCache.size >= MAX_LABELED_ICON_CACHE) {
    const oldestKey = labeledIconCache.keys().next().value;
    if (oldestKey !== undefined) {
      labeledIconCache.delete(oldestKey);
    }
  }
  labeledIconCache.set(key, icon);
  return icon;
}

type ClusterBucket = 'small' | 'medium' | 'large';

const CLUSTER_BUCKET_CONFIG: Record<
  ClusterBucket,
  { size: number; bg: string; ring: string; fontSize: number }
> = {
  small: {
    size: 32,
    bg: '#10b981',
    ring: 'rgba(16,185,129,0.28)',
    fontSize: 11,
  },
  medium: {
    size: 38,
    bg: '#059669',
    ring: 'rgba(5,150,105,0.32)',
    fontSize: 12,
  },
  large: {
    size: 44,
    bg: '#047857',
    ring: 'rgba(4,120,87,0.36)',
    fontSize: 12,
  },
};

const MAX_CLUSTER_ICON_CACHE = 300;
const clusterIconCache = new Map<string, L.DivIcon>();

export function getClusterIcon(count: number, abbreviated?: string | number): L.DivIcon {
  const bucket: ClusterBucket = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
  const label = String(abbreviated ?? count);
  const cacheKey = `${bucket}:${label}`;

  const cached = clusterIconCache.get(cacheKey);
  if (cached) {
    clusterIconCache.delete(cacheKey);
    clusterIconCache.set(cacheKey, cached);
    return cached;
  }

  const cfg = CLUSTER_BUCKET_CONFIG[bucket];
  const half = cfg.size / 2;

  const icon = L.divIcon({
    className: 'custom-cluster-marker',
    html:
      `<div style="width:${cfg.size}px;height:${cfg.size}px;border-radius:50%;` +
      `background:${cfg.bg};border:3px solid #ffffff;` +
      `box-shadow:0 0 0 4px ${cfg.ring},0 2px 6px rgba(15,23,42,0.28);` +
      `color:#ffffff;font-weight:900;font-size:${cfg.fontSize}px;` +
      `display:flex;align-items:center;justify-content:center;line-height:1;">` +
      `${escapeHtml(label)}</div>`,
    iconSize: [cfg.size, cfg.size],
    iconAnchor: [half, half],
  });

  if (clusterIconCache.size >= MAX_CLUSTER_ICON_CACHE) {
    const oldestKey = clusterIconCache.keys().next().value;
    if (oldestKey !== undefined) {
      clusterIconCache.delete(oldestKey);
    }
  }
  clusterIconCache.set(cacheKey, icon);
  return icon;
}

export const TargetIcon: L.DivIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f59e0b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 12px rgba(245, 158, 11, 0.6); animation: pulse 2s infinite;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export const LiveLocationIcon: L.DivIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 20px rgba(239, 68, 68, 0.8); position: relative;">
          <div style="position: absolute; inset: -8px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
         </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export const MeasureDotIcon: L.DivIcon = L.divIcon({
  className: 'measure-dot',
  html: `<div style="background-color: #f59e0b; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});
