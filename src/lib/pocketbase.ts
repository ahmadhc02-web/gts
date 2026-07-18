import PocketBase from 'pocketbase';

// Determine PocketBase URL from environment or default to local/Hetzner server
// In the browser, we proxy through our secure backend to bypass mixed-content (HTTP/HTTPS) and CORS blocks.
export const PB_URL = (typeof window !== 'undefined')
  ? `${window.location.origin}/api/pb`
  : ((typeof import.meta !== 'undefined' && (import.meta as any).env)
      ? (import.meta as any).env.VITE_POCKETBASE_URL
      : (process.env.VITE_POCKETBASE_URL || 'http://167.233.41.7:8090'));

export const pb = new PocketBase(PB_URL);

// Automatically disable auto-cancellation for parallel requests if needed
pb.autoCancellation(false);
