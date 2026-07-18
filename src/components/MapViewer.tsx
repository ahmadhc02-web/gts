import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { X, Map as MapIcon, Layers, Satellite, Crosshair, RefreshCw, ZoomIn, ZoomOut, Search, MapPin, Save, Plus, Ruler, Trash2, Navigation, ClipboardList, Globe } from 'lucide-react';
import { UserProfile, Client, MonitorTarget } from '../types';
import { pocketbaseService } from '../lib/pocketbaseService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Polyline } from 'react-leaflet';

// Fix for default marker icons in Leaflet with React
// Using standard CDN URLs for marker icons (this also bypasses build system path issues)
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Cache to avoid creating thousands of identical Leaflet divIcon objects
const iconCache = new Map<string, L.DivIcon>();

const ClientIcon = (client: any, zoomLevel: number) => {
  const displayId = client.username || (client.id || '').slice(0,6);
  const showLabel = zoomLevel >= 18;
  const cacheKey = `${displayId}-${showLabel}`;
  
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const labelHtml = showLabel ? `<div style="position: absolute; top: 30px; left: 50%; transform: translateX(-50%); background: rgba(255, 255, 255, 0.95); padding: 3px 6px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); white-space: nowrap; display: flex; flex-direction: column; align-items: center; pointer-events: none; border: 1px solid #e2e8f0; z-index: 100;"><span style="font-size: 11px; font-weight: 900; color: #0f172a; line-height: 1.2;">${client.name || 'Unknown'}</span><span style="font-size: 9px; font-family: monospace; font-weight: bold; color: #64748b; line-height: 1; margin-top: 2px;">${displayId}</span></div>` : '';
  const pinSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="30" style="filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.4));"><path fill="#10b981" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
  
  const newIcon = L.divIcon({
    className: 'custom-client-marker',
    html: '<div style="position: relative; width: 30px; height: 30px; display: flex; justify-content: center; align-items: flex-end;">' + pinSvg + labelHtml + '</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
  
  iconCache.set(cacheKey, newIcon);
  return newIcon;
};

const TargetIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #f59e0b; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 12px rgba(245, 158, 11, 0.6); animation: pulse 2s infinite;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const LiveLocationIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 20px rgba(239, 68, 68, 0.8); position: relative;">
          <div style="position: absolute; inset: -8px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
         </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const DomainTargetIcon = (status: string) => {
  let color = '#6366f1'; // blue-indigo
  if (status === 'excellent') color = '#10b981'; // green
  if (status === 'good') color = '#22c55e'; // light-green
  if (status === 'fair') color = '#f59e0b'; // amber
  if (status === 'poor') color = '#ef4444'; // red
  if (status === 'loading') color = '#64748b'; // slate
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 18px; height: 18px; border-radius: 50%; border: 3.5px solid white; box-shadow: 0 0 16px ${color}; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.3s ease;">
            <div style="position: absolute; inset: -6px; background: ${color}20; border-radius: 50%; animation: pulse 2s infinite;"></div>
            <div style="width: 5px; height: 5px; background-color: white; border-radius: 50%;"></div>
           </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

interface MapViewerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  focusedClientId?: string | null;
}

// Sadiqabad center
const SADIQABAD_CENTER: [number, number] = [28.3006, 70.1302];
const INITIAL_ZOOM = 14;
const PAKISTAN_BOUNDS: L.LatLngBoundsExpression = [
  [23.695, 60.872], 
  [37.084, 77.805]
];

const MapViewer: React.FC<MapViewerProps> = ({ isOpen, onClose, user, focusedClientId }) => {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCoord, setSelectedCoord] = useState<{lat: number, lng: number} | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [mapSearchText, setMapSearchText] = useState('');
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(INITIAL_ZOOM);
  const [purgeTarget, setPurgeTarget] = useState<Client | null>(null);
  const [selectedPopupClient, setSelectedPopupClient] = useState<Client | null>(null);
  
  // Custom Web Domain Monitoring Targets States
  const [isTargetsPanelOpen, setIsTargetsPanelOpen] = useState(false);
  const [monitorTargets, setMonitorTargets] = useState<MonitorTarget[]>([]);
  const [newTargetDomain, setNewTargetDomain] = useState('');
  const [newTargetLabel, setNewTargetLabel] = useState('');
  const [targetLatencies, setTargetLatencies] = useState<Record<string, { ms: number | 'Error'; status: 'excellent' | 'good' | 'fair' | 'poor' | 'loading' }>>({});
  const [isPingingTargets, setIsPingingTargets] = useState(false);
  const [positioningTargetId, setPositioningTargetId] = useState<string | null>(null);
  
  // Direction & Geolocation State
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);
  const [targetClient, setTargetClient] = useState<Client | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const lastUpdateRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (isTracking) {
      if ("geolocation" in navigator) {
        // Immediate update for better UX when starting
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            lastUpdateRef.current = Date.now();
            if (mapRef.current) {
              mapRef.current.flyTo([latitude, longitude], 18, { duration: 1.5 });
            }
          },
          (err) => console.error("Initial location error:", err),
          { enableHighAccuracy: true }
        );

        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const now = Date.now();
            // Throttle to 10 seconds as requested
            if (now - lastUpdateRef.current < 10000) return;
            
            const { latitude, longitude } = position.coords;
            setUserLocation([latitude, longitude]);
            lastUpdateRef.current = now;
            
            // Note: We removed auto-centering on every update to prevent vibration
          },
          (error) => {
            toast.error("Location access denied or failed.");
            setIsTracking(false);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        toast.error("Geolocation not supported on this device.");
        setIsTracking(false);
      }
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setUserLocation(null);
      setTargetClient(null);
      setRoutePolyline([]);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isTracking]);

  // Route calculation when target changes
  useEffect(() => {
    if (userLocation && targetClient?.lat && targetClient?.lng) {
      const getRoute = async () => {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${targetClient.lng},${targetClient.lat}?overview=full&geometries=geojson`
          );
          const data = await response.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map((coord: any) => [coord[1], coord[0]]) as [number, number][];
            setRoutePolyline(coords);
          }
        } catch (err) {
          console.error("Routing error:", err);
        }
      };
      getRoute();
    }
  }, [userLocation, targetClient]);

  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    const tenantId = pocketbaseService.getReadTenantId(user);
    
    const unsubscribe = pocketbaseService.subscribeClients((allClients) => {
      setClients(allClients);
      setLoading(false);
    }, tenantId);
    
    return () => unsubscribe();
  }, [isOpen, user]);

  // Subscribe to custom targets matching active tenant
  useEffect(() => {
    if (!isOpen || !user) return;
    const tenantId = pocketbaseService.getReadTenantId(user);
    
    const unsubscribe = pocketbaseService.subscribeMonitorTargets((allTargets) => {
      setMonitorTargets(allTargets);
    }, tenantId);
    
    return () => unsubscribe();
  }, [isOpen, user]);

  // Dynamic ping latency estimator via non-CORS fetch
  const measurePing = useCallback(async (url: string) => {
    const start = performance.now();
    try {
      const cleanUrl = url.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      await fetch(`https://${cleanUrl}/favicon.ico?t=${Date.now()}`, { 
        mode: 'no-cors', 
        cache: 'no-store' 
      });
      const end = performance.now();
      const duration = Math.max(1, Math.round((end - start) / 3));
      
      let status: 'excellent' | 'good' | 'fair' | 'poor' | 'loading' = 'excellent';
      if (duration > 80) status = 'good';
      if (duration > 150) status = 'fair';
      if (duration > 300) status = 'poor';

      return { ms: duration, status };
    } catch (e) {
      // Fallback request to domain root
      try {
        const cleanUrl = url.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        const rootStart = performance.now();
        await fetch(`https://${cleanUrl}/?t=${Date.now()}`, { 
          mode: 'no-cors', 
          cache: 'no-store'
        });
        const rootEnd = performance.now();
        const duration = Math.max(1, Math.round((rootEnd - rootStart) / 3));
        let status: 'excellent' | 'good' | 'fair' | 'poor' | 'loading' = 'excellent';
        if (duration > 80) status = 'good';
        if (duration > 150) status = 'fair';
        if (duration > 350) status = 'poor';
        return { ms: duration, status };
      } catch (err) {
        return { ms: 'Error' as const, status: 'poor' as const };
      }
    }
  }, []);

  // Ping sequence for all active custom targets
  const pingAllTargets = useCallback(async () => {
    if (monitorTargets.length === 0 || isPingingTargets) return;
    setIsPingingTargets(true);
    
    const loadingState: typeof targetLatencies = {};
    monitorTargets.forEach(t => {
      loadingState[t.id] = { ms: 'loading' as any, status: 'loading' };
    });
    setTargetLatencies(prev => ({ ...prev, ...loadingState }));

    for (const target of monitorTargets) {
      const result = await measurePing(target.domain);
      setTargetLatencies(prev => ({
        ...prev,
        [target.id]: result
      }));
    }
    
    setIsPingingTargets(false);
  }, [monitorTargets, isPingingTargets, measurePing]);

  // Initial trigger for target pings
  useEffect(() => {
    if (isOpen && monitorTargets.length > 0 && Object.keys(targetLatencies).length === 0) {
      pingAllTargets();
    }
  }, [isOpen, monitorTargets, targetLatencies, pingAllTargets]);

  // Create custom monitoring target
  const handleAddMonitorTarget = async () => {
    if (!newTargetDomain.trim() || !user) return;
    const domainVal = newTargetDomain.trim();
    const labelVal = newTargetLabel.trim() || domainVal.split('.')[0].toUpperCase();
    
    try {
      // Set an initial position with a randomized offset near Sadiqabad
      const latOffset = (Math.random() - 0.5) * 0.012;
      const lngOffset = (Math.random() - 0.5) * 0.012;
      const initialLat = SADIQABAD_CENTER[0] + latOffset;
      const initialLng = SADIQABAD_CENTER[1] + lngOffset;
      
      const newTarget = await pocketbaseService.createMonitorTarget(
        domainVal, 
        user, 
        labelVal, 
        initialLat, 
        initialLng
      );
      
      setNewTargetDomain('');
      setNewTargetLabel('');
      toast.success("🎯 Custom Target Configured", { description: `${labelVal} is deployed on map.` });
      
      // Ping immediately
      const result = await measurePing(domainVal);
      setTargetLatencies(prev => ({
        ...prev,
        [newTarget.id]: result
      }));
    } catch (err) {
      toast.error("Failed to add target website.");
    }
  };

  // Reposition customized server target on click
  const handleSetTargetPosition = async (id: string, lat: number, lng: number) => {
    try {
      const target = monitorTargets.find(t => t.id === id);
      if (!target) return;
      await pocketbaseService.updateMonitorTarget(id, { lat, lng });
      setPositioningTargetId(null);
      toast.success("📡 Node Repositioned", { description: `${target.label || target.domain} moved to chosen coordinates.` });
    } catch (err) {
      toast.error("Deployment failed");
    }
  };

  useEffect(() => {
    if (focusedClientId && mapRef.current && clients.length > 0) {
      const client = clients.find(c => c.id === focusedClientId);
      if (client && client.lat && client.lng) {
        mapRef.current.flyTo([client.lat, client.lng], 20, { duration: 1.5 });
      } else {
        toast.warning("Location data not available for this client yet.");
      }
    }
  }, [focusedClientId, clients, isOpen]);

  const handleZoomToUser = (val: string) => {
    setMapSearchText(val);
    const client = clients.find(c => 
      c.id === val || 
      (c.username || '').toLowerCase() === val.toLowerCase() ||
      (c.name || '').toLowerCase() === val.toLowerCase()
    );
    if (client && client.lat && client.lng && mapRef.current) {
      mapRef.current.flyTo([client.lat, client.lng], 21, { duration: 1.5 });
      setMapSearchText(''); // Clear search after finding
      toast.success(`Zooming to ${client.name}`);
    }
  };

  const filteredClients = clients.filter(c => 
    !filterText || 
    (c.name || '').toLowerCase().includes(filterText.toLowerCase()) ||
    (c.username || '').toLowerCase().includes(filterText.toLowerCase())
  );

  const handleSaveLocation = async () => {
    if (!selectedCoord || !selectedClientId || !user) return;
    const client = clients.find(c => c.id === selectedClientId || (c.username || '').toLowerCase() === selectedClientId.toLowerCase());
    if (!client) {
      toast.error('User not found. Check the ID or Username.');
      return;
    }

    try {
      await pocketbaseService.updateClient(
        client.id, 
        { lat: selectedCoord.lat, lng: selectedCoord.lng }, 
        client.name, 
        user.fullName || user.username
      );
      toast.success(`Location saved for ${client.name}`);
      setSelectedCoord(null);
      setSelectedClientId('');
    } catch (e) {
      toast.error('Failed to save location');
    }
  };

  const handleRemoveLocation = async (client: Client) => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
       toast.error('Unauthorized access');
       return;
    }

    try {
      await pocketbaseService.updateClient(
        client.id, 
        { lat: null, lng: null }, 
        client.name, 
        user.fullName || user.username
      );
      toast.success(`Location removed for ${client.name}`);
      setPurgeTarget(null);
    } catch (e) {
      toast.error('Failed to remove location');
    }
  };

  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  const MapClickHandler = () => {
    const map = useMapEvents({
      click(e) {
        if (selectedPopupClient) {
          setSelectedPopupClient(null); // Close popup when clicking on the map
          return; // Don't do other click actions if we were just closing the popup
        }
        if (positioningTargetId) {
          handleSetTargetPosition(positioningTargetId, e.latlng.lat, e.latlng.lng);
        } else if (isMeasuring) {
          setMeasurePoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
        } else {
          setSelectedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      },
      zoomend(e) {
        setZoomLevel(e.target.getZoom());
        setMapBounds(e.target.getBounds());
      },
      moveend(e) {
        setMapBounds(e.target.getBounds());
      },
      popupclose() {
        if (!isMeasuring) {
          setSelectedCoord(null);
          setSelectedClientId('');
        }
      }
    });

    // Initialize bounds on first load
    useEffect(() => {
      if (!mapBounds) {
        setMapBounds(map.getBounds());
      }
    }, [map, mapBounds]);

    return null;
  };

  const calculateDistance = () => {
    if (measurePoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      const p1 = L.latLng(measurePoints[i][0], measurePoints[i][1]);
      const p2 = L.latLng(measurePoints[i+1][0], measurePoints[i+1][1]);
      total += p1.distanceTo(p2);
    }
    return total;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 md:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Purge Confirmation Modal */}
        <AnimatePresence>
          {purgeTarget && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPurgeTarget(null)}
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-rose-500/20 overflow-hidden"
              >
                <div className="p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-500">
                    <Trash2 size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Purge Location?</h3>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-loose">
                      Are you sure you want to remove all coordinate data for <span className="text-rose-500 font-extrabold">{purgeTarget.name}</span>? This action is permanent.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleRemoveLocation(purgeTarget)}
                      className="w-full py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95"
                    >
                      Confirm Purge
                    </button>
                    <button
                      onClick={() => setPurgeTarget(null)}
                      className="w-full py-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-7xl h-full md:h-[85vh] bg-white dark:bg-slate-950 rounded-3xl md:rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col"
        >
          <div className="absolute top-0 inset-x-0 p-3 md:p-6 flex items-center justify-between z-10 pointer-events-none">
            <div className="flex flex-col gap-1.5 md:gap-2 pointer-events-auto bg-slate-950/40 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl md:rounded-3xl shadow-2xl min-w-[160px] md:min-w-[200px]">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white/10 flex items-center justify-center text-white">
                  <MapIcon size={12} className="md:w-5 md:h-5" />
                </div>
                <div>
                  <h2 className="text-[10px] md:text-sm font-black text-white tracking-widest uppercase opacity-80 leading-none mb-0.5 md:mb-1">Active MAP</h2>
                  <div className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-emerald-400">
                    <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {loading ? 'Booting...' : `${clients.filter(c => c.lat).length} Nodes`}
                  </div>
                </div>
              </div>

              <div className="relative mt-0.5 md:mt-1">
                <Search size={12} className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-300 pointer-events-none",
                  mapSearchText ? "text-emerald-500 scale-110" : "text-white/40"
                )} />
                <input 
                  placeholder="Scan Segment..."
                  value={mapSearchText}
                  onChange={(e) => setMapSearchText(e.target.value)}
                  className="w-full h-8 md:h-11 bg-slate-900/40 dark:bg-black/20 border border-white/10 rounded-xl md:rounded-2xl pl-9 pr-3 md:pl-11 md:pr-4 text-[9px] md:text-xs text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-black uppercase tracking-widest"
                />
                
                <AnimatePresence>
                  {mapSearchText.length >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.98, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(10px)' }}
                      transition={{ type: "spring", damping: 25, stiffness: 300 }}
                      className="absolute top-full left-0 right-0 mt-3 p-1 bg-white border border-slate-200 rounded-3xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.4)] overflow-hidden z-[1001] origin-top"
                    >
                      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100/50 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Matrix Scan</span>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                          {clients.filter(c => 
                            c.lat && (
                              (c.name || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                              (c.username || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                              (c.id || '').toLowerCase().includes(mapSearchText.toLowerCase())
                            )
                          ).length} Match
                        </span>
                      </div>
                      
                      <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-1 p-1">
                        {clients
                          .filter(c => c.lat && (
                            (c.name || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                            (c.username || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                            (c.id || '').toLowerCase().includes(mapSearchText.toLowerCase())
                          ))
                          .slice(0, 10)
                          .map((c, i) => (
                            <motion.button
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              key={`search-res-${c.id}-${i}`}
                              onClick={() => {
                                handleZoomToUser(c.username || c.id);
                                setMapSearchText('');
                              }}
                              className="w-full flex items-center gap-4 p-3 rounded-[1.25rem] bg-slate-50 hover:bg-emerald-600 group transition-all text-left border border-transparent hover:border-emerald-400/50 shadow-sm"
                            >
                              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-emerald-600 font-black text-sm group-hover:bg-white group-hover:scale-110 transition-all shadow-md">
                                {(c.name || 'U').charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-black text-slate-900 group-hover:text-white transition-colors uppercase tracking-tight leading-tight">
                                  {c.name || 'Unknown'}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[8px] font-black text-slate-400 group-hover:text-emerald-100 uppercase tracking-widest">USER_ID:</span>
                                  <span className="text-[10px] font-mono font-bold text-emerald-600 group-hover:text-white bg-emerald-100/50 group-hover:bg-white/20 px-1.5 py-0.5 rounded transition-all">
                                    {c.username || c.id}
                                  </span>
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all">
                                <MapPin size={16} className="text-white" />
                              </div>
                            </motion.button>
                          ))}
                        
                        {clients.filter(c => c.lat && (
                          (c.name || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                          (c.username || '').toLowerCase().includes(mapSearchText.toLowerCase()) ||
                          (c.id || '').toLowerCase().includes(mapSearchText.toLowerCase())
                        )).length === 0 && (
                          <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center mb-3 text-slate-300">
                              <Search size={20} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Zero Target Signal Detected</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Targets Monitor panel toggle buttons hidden by request */}
              {/* <button 
                onClick={() => {
                  setIsTargetsPanelOpen(!isTargetsPanelOpen);
                  if (!isTargetsPanelOpen) {
                    setIsMeasuring(false);
                  }
                }}
                className={cn(
                  "px-3 h-10 md:px-4 md:h-12 rounded-xl md:rounded-2xl bg-slate-950/40 backdrop-blur-md border border-white/10 flex items-center gap-2 text-white hover:bg-slate-950/60 transition-all text-[9px] md:text-xs font-black uppercase tracking-widest relative overflow-hidden group",
                  isTargetsPanelOpen && "border-indigo-500/50 text-indigo-400 bg-indigo-950/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                )}
                title="Toggle Monitoring Targets Panel"
              >
                <Globe size={16} className={cn("animate-pulse shrink-0", isTargetsPanelOpen ? "text-indigo-400" : "text-white")} />
                <span className="hidden sm:inline">Targets Monitor</span>
                {monitorTargets.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-500 text-white font-mono text-[9px] font-black flex items-center justify-center shrink-0">
                    {monitorTargets.length}
                  </span>
                )}
              </button> */}

              <button 
                onClick={onClose}
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-950/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-slate-950/60 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Leaflet Map Section */}
          <div className="flex-1 relative z-0 bg-slate-100 dark:bg-slate-900">
            <MapContainer
              center={SADIQABAD_CENTER}
              zoom={INITIAL_ZOOM}
              minZoom={3}
              maxZoom={28}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              attributionControl={false}
              ref={mapRef as any}
              className="z-0"
            >
              <MapUpdater mapType={mapType} />
              <MapClickHandler />
              
              {/* Tile Layers */}
              {mapType === 'roadmap' ? (
                <TileLayer
                  key="roadmap"
                  url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  maxNativeZoom={22}
                  maxZoom={28}
                />
              ) : (
                <TileLayer
                  key="satellite"
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxNativeZoom={22}
                  maxZoom={28}
                />
              )}

              {/* Measurement Polyline */}
              {measurePoints.length > 0 && (
                <>
                  <Polyline positions={measurePoints} color="#f59e0b" weight={4} dashArray="10, 10" />
                  {measurePoints.map((pt, i) => (
                    <Marker 
                      key={`measure-pt-${i}`} 
                      position={pt} 
                      icon={L.divIcon({
                        className: 'measure-dot',
                        html: `<div style="background-color: #f59e0b; width: 8px; height: 8px; border-radius: 50%; border: 2px solid white;"></div>`,
                        iconSize: [8, 8],
                        iconAnchor: [4, 4],
                      })}
                    >
                      {i === measurePoints.length - 1 && measurePoints.length > 1 && (
                        <Tooltip permanent direction="top" offset={[0, -10]} className="measure-tooltip">
                          <div className="font-black text-[10px] uppercase tracking-tighter">
                            {calculateDistance() < 1000 
                              ? `${Math.round(calculateDistance())} Meters` 
                              : `${(calculateDistance() / 1000).toFixed(2)} KM`}
                          </div>
                        </Tooltip>
                      )}
                    </Marker>
                  ))}
                </>
              )}

              {/* Live Location Marker (Red Dot) */}
              {userLocation && (
                <Marker 
                  position={userLocation} 
                  icon={LiveLocationIcon}
                  eventHandlers={{
                    click: () => setIsSelectingTarget(true)
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -10]} className="user-label-tooltip">
                    <span className="text-[10px] font-black uppercase text-rose-600">LIVE: YOUR_SIGNAL</span>
                  </Tooltip>
                </Marker>
              )}

              {/* Routing Polyline */}
              {routePolyline.length > 0 && (
                <Polyline positions={routePolyline} color="#3b82f6" weight={6} opacity={0.8} lineCap="round" lineJoin="round" />
              )}

              {/* Custom Target Markers (Hidden by request) */}
              {/* {monitorTargets.map((target, idx) => {
                if (!target.lat || !target.lng) return null;
                const latencyInfo = targetLatencies[target.id];
                const latencyStr = latencyInfo 
                  ? (latencyInfo.ms === 'loading' ? 'Checking...' : (latencyInfo.ms === 'Error' ? 'Offline' : `${latencyInfo.ms} ms`))
                  : 'Ping Node';
                const status = latencyInfo ? latencyInfo.status : 'loading';
                
                return (
                  <Marker 
                    key={`target-${target.id}-${idx}`}
                    position={[target.lat, target.lng]}
                    icon={DomainTargetIcon(status)}
                  >
                    <Tooltip direction="top" offset={[0, -10]} permanent className="user-label-tooltip">
                      <div className="flex flex-col items-center leading-none py-0.5">
                        <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1">
                          🌐 {target.label || target.domain}
                        </span>
                        <span className={cn(
                          "text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded mt-0.5 border shadow-sm",
                          status === 'excellent' && "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/10",
                          status === 'good' && "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-905/10",
                          status === 'fair' && "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/10",
                          status === 'poor' && "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-100 dark:border-rose-900/10",
                          status === 'loading' && "bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800"
                        )}>
                          {latencyStr}
                        </span>
                      </div>
                    </Tooltip>
                    
                    <Popup className="custom-popup">
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm bg-indigo-500 uppercase tracking-widest">
                            Node
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-sm leading-tight">{target.label || target.domain}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{target.domain}</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-2 rounded-lg border border-indigo-100/50 dark:border-indigo-900/20 flex flex-col gap-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Web Speed Test</span>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Latency:</span>
                              <span className={cn(
                                "text-[11px] font-black tracking-tight",
                                status === 'excellent' && "text-emerald-500",
                                status === 'good' && "text-green-500",
                                status === 'fair' && "text-amber-500",
                                status === 'poor' && "text-rose-500"
                              )}>
                                {latencyStr}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPositioningTargetId(target.id);
                                toast.info(`Shield terminal active. Click coordinates on map to relocate ${target.label}.`);
                              }}
                              className="flex-1 py-1.5 text-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 text-[9px] font-black uppercase tracking-wider transition-colors"
                            >
                              Reposition
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Remove custom target ${target.label || target.domain}?`)) {
                                  try {
                                    await pocketbaseService.deleteMonitorTarget(target.id);
                                    toast.success("Target discarded successfully.");
                                  } catch (err) {
                                    toast.error("Failed to delete target");
                                  }
                                }
                              }}
                              className="px-2.5 py-1.5 text-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-[9px] font-black uppercase tracking-wider transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })} */}

              {/* Client Markers */}
              {filteredClients.map((client, markerIdx) => {
                if (!client.lat || !client.lng) return null;
                
                // Viewport culling to prevent lag
                if (mapBounds) {
                  const latLng = L.latLng(client.lat, client.lng);
                  // Add a small buffer to avoid popping in/out right at the edge
                  if (!mapBounds.pad(0.2).contains(latLng)) {
                    return null;
                  }
                }
                
                return (
                  <Marker 
                    key={`marker-${client.id || markerIdx}-${markerIdx}`} 
                    position={[client.lat, client.lng]}
                    icon={ClientIcon(client, zoomLevel)}
                    eventHandlers={{ click: () => setSelectedPopupClient(client) }}
                  >
                  </Marker>
                );
              })}

              {/* Centralized Popup for selected client */}
              {selectedPopupClient && selectedPopupClient.lat && selectedPopupClient.lng && (
                <Popup 
                  position={[selectedPopupClient.lat, selectedPopupClient.lng]} 
                  className="custom-popup"
                  onClose={() => setSelectedPopupClient(null)}
                  eventHandlers={{ 
                    remove: () => setSelectedPopupClient(null)
                  }}
                >
                  <div className="p-2 min-w-[180px]">
                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm bg-emerald-500">
                        {selectedPopupClient.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-sm leading-tight">{selectedPopupClient.name}</div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{selectedPopupClient.username || selectedPopupClient.id.slice(0,6)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-[10px] text-slate-600">
                        <MapPin size={12} className="text-slate-400 mt-0.5 flex-shrink-0" /> 
                        <span className="font-medium">{selectedPopupClient.area}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="block text-[7px] font-black text-slate-400 uppercase tracking-tighter">Package</span>
                          <span className="block text-[9px] font-bold text-slate-700 truncate">{selectedPopupClient.pkgDetails || 'N/A'}</span>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <span className="block text-[7px] font-black text-slate-400 uppercase tracking-tighter">Panel Info</span>
                          <span className="block text-[9px] font-bold text-slate-700 truncate">{selectedPopupClient.panelDetails || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100/50 flex items-center justify-between">
                         <div className="flex items-center gap-1.5">
                           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                           <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Contact</span>
                         </div>
                         <span className="text-[9px] font-mono font-bold text-emerald-700">{selectedPopupClient.mobileNumber || selectedPopupClient.number || 'No Contact'}</span>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[8px] text-slate-400 font-bold uppercase">
                        <span>Status</span>
                        <span className="text-emerald-500">Node Active</span>
                      </div>

                      {(user?.role === 'admin' || user?.role === 'super_admin') && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setPurgeTarget(selectedPopupClient);
                          }}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[9px] font-black uppercase tracking-widest border border-red-100/50"
                        >
                          <Trash2 size={10} />
                          Purge Location
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              )}

              {/* Selected Coordinate Marker */}
              {selectedCoord && (
                <Marker position={[selectedCoord.lat, selectedCoord.lng]} icon={TargetIcon}>
                  <Popup className="custom-popup" autoPan>
                    <div className="w-56 p-1 flex flex-col gap-2">
                      <h3 className="font-black text-xs text-slate-800 border-b border-slate-100 pb-1">Set Node Location</h3>
                      <p className="text-[9px] text-slate-500 leading-tight">Assign these coordinates to a specific user.</p>
                      
                      <div>
                        <input 
                          type="text"
                          autoFocus
                          list="users-list"
                          placeholder="Type User ID or Name..."
                          className="w-full text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          value={selectedClientId}
                          onChange={(e) => setSelectedClientId(e.target.value)}
                        />
                        <datalist id="users-list">
                          {clients.map((c, optIdx) => (
                            <option key={`opt-${c.id}-${optIdx}`} value={c.username || c.id}>{c.name || 'Unknown'} ({c.username || c.id.slice(0, 6)})</option>
                          ))}
                        </datalist>
                      </div>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSaveLocation(); }}
                        disabled={!selectedClientId}
                        className="w-full mt-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:bg-slate-300 text-white text-[10px] font-bold rounded p-1.5 flex justify-center items-center gap-1 transition-colors"
                      >
                        <Save size={10} />
                        Save Location
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Tactical Control Matrix */}
            <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-3 items-end">
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 bg-slate-950/40 backdrop-blur-xl p-1.5 sm:p-2 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 shadow-2xl">
                {/* Mode: Roadmap */}
                <button 
                  onClick={() => setMapType('roadmap')}
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] transition-all relative overflow-hidden group",
                    mapType === 'roadmap' ? "ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="absolute inset-0 bg-[url('https://mt1.google.com/vt/lyrs=m&x=1&y=1&z=4')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all opacity-20" />
                  <div className={cn(
                    "relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center mb-1 sm:mb-2 transition-all",
                    mapType === 'roadmap' ? "bg-emerald-500 text-white" : "bg-white/10 text-white"
                  )}>
                    <Layers size={14} className="sm:hidden" />
                    <Layers size={18} className="hidden sm:block" />
                  </div>
                  <span className="relative z-10 text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white">Road</span>
                </button>

                {/* Mode: Satellite */}
                <button 
                  onClick={() => setMapType('satellite')}
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] transition-all relative overflow-hidden group",
                    mapType === 'satellite' ? "ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="absolute inset-0 bg-[url('https://mt1.google.com/vt/lyrs=s&x=1&y=1&z=4')] bg-cover bg-center grayscale group-hover:grayscale-0 transition-all opacity-20" />
                  <div className={cn(
                    "relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center mb-1 sm:mb-2 transition-all",
                    mapType === 'satellite' ? "bg-emerald-500 text-white" : "bg-white/10 text-white"
                  )}>
                    <Satellite size={14} className="sm:hidden" />
                    <Satellite size={18} className="hidden sm:block" />
                  </div>
                  <span className="relative z-10 text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white">Sat</span>
                </button>

                {/* Tool: Measure */}
                <button 
                  onClick={() => {
                    if (isMeasuring) {
                      setMeasurePoints([]);
                      setIsMeasuring(false);
                    } else {
                      setIsMeasuring(true);
                      toast.info("Measure Protocol Engaged");
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] transition-all relative overflow-hidden group",
                    isMeasuring ? "ring-2 ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]" : "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent transition-all" />
                  <div className={cn(
                    "relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center mb-1 sm:mb-2 transition-all",
                    isMeasuring ? "bg-amber-500 text-white" : "bg-white/10 text-white"
                  )}>
                    <Ruler size={14} className="sm:hidden" />
                    <Ruler size={18} className="hidden sm:block" />
                  </div>
                  <span className="relative z-10 text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white">Rule</span>
                </button>

                {/* Tool: Directions */}
                <button 
                  onClick={() => setIsTracking(!isTracking)}
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl sm:rounded-2xl md:rounded-[1.5rem] transition-all relative overflow-hidden group",
                    isTracking ? "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" : "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent transition-all" />
                  <div className={cn(
                    "relative z-10 w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center mb-1 sm:mb-2 transition-all",
                    isTracking ? "bg-blue-500 text-white" : "bg-white/10 text-white"
                  )}>
                    <Navigation size={14} className={cn("sm:hidden", isTracking ? "fill-white" : "")} />
                    <Navigation size={18} className={cn("hidden sm:block", isTracking ? "fill-white" : "")} />
                  </div>
                  <span className="relative z-10 text-[7px] sm:text-[9px] font-black uppercase tracking-widest text-white">Nav</span>
                </button>
              </div>

              {/* Quick Actions (Floating) */}
              <div className="flex flex-col sm:flex-row gap-2 justify-end items-end">
                {measurePoints.length > 0 && (
                  <button 
                    onClick={() => setMeasurePoints([])}
                    className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl bg-rose-500 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
                  >
                    <Trash2 size={12} className="sm:size-14" />
                    Clear
                  </button>
                )}
                
                <div className="flex gap-1.5 p-1 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl">
                  <button 
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setZoom(mapRef.current.getZoom() - 1);
                      }
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all font-black"
                  >
                    <ZoomOut size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setZoom(mapRef.current.getZoom() + 1);
                      }
                    }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all font-black"
                  >
                    <ZoomIn size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[4px] flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <RefreshCw className="text-emerald-400 animate-spin" size={48} />
                    <MapIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white" size={20} />
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-white text-xs font-black tracking-[0.3em] uppercase">Constructing Matrix</div>
                    <div className="text-emerald-400/50 text-[10px] font-bold mt-1 tracking-widest">MAP-PAK-01-SECURE</div>
                  </div>
              </div>
            </div>
          )}

          {/* Target Selection Overlay for Directions (Refined Swipe Drawer) */}
          <AnimatePresence>
            {isSelectingTarget && (
              <div className="absolute inset-x-0 bottom-0 z-[1010] p-0 sm:p-4 flex justify-center pointer-events-none">
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 150) setIsSelectingTarget(false);
                  }}
                  className="w-full max-w-lg bg-white dark:bg-slate-950 rounded-t-[3rem] sm:rounded-3xl p-6 shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.3)] border-t sm:border border-slate-200 dark:border-slate-800 pointer-events-auto h-[80vh] sm:h-auto flex flex-col"
                >
                  <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6 sm:hidden cursor-grab active:cursor-grabbing" />
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Navigation size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-widest">Select Node Target</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Navigation Protocol</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSelectingTarget(false)} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-500 hover:bg-slate-900 hover:text-white transition-all">
                      <X size={18} />
                    </button>
                  </div>
                  
                  <div className="relative mb-6">
                    <Search className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 transition-colors",
                      filterText ? "text-blue-500" : "text-slate-400"
                    )} size={18} />
                    <input 
                      placeholder="ENTER NODE ID OR ALIAS..."
                      value={filterText}
                      className="w-full h-11 sm:h-14 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 text-[10px] sm:text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                      onChange={(e) => setFilterText(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar pb-10">
                    {clients
                      .filter(c => c.lat && (!filterText || (c.name || '').toLowerCase().includes(filterText.toLowerCase()) || (c.id || '').toLowerCase().includes(filterText.toLowerCase())))
                      .map((c, i) => {
                        const dist = userLocation && c.lat && c.lng 
                          ? L.latLng(userLocation[0], userLocation[1]).distanceTo(L.latLng(c.lat, c.lng))
                          : null;
                        
                        return (
                          <button
                            key={`nav-target-${c.id}-${i}`}
                            onClick={() => {
                              setTargetClient(c);
                              setIsSelectingTarget(false);
                              toast.success(`Routing to ${c.name || 'Unknown'} initiated.`);
                            }}
                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white hover:bg-blue-50 border border-slate-100 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold group-hover:bg-blue-500 group-hover:text-white transition-all">
                                 {(c.name || 'U').charAt(0)}
                               </div>
                               <div className="text-left">
                                 <div className="text-[13px] font-black uppercase text-slate-900">{c.name || 'Unknown'}</div>
                                 <div className="flex items-center gap-2 mt-0.5">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{c.username || c.id}</span>
                                   {dist !== null && (
                                     <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
                                       {dist < 1000 ? `${Math.round(dist)}m` : `${(dist/1000).toFixed(1)}km`}
                                     </span>
                                   )}
                                 </div>
                               </div>
                            </div>
                            <Navigation size={16} className="text-slate-200 group-hover:text-blue-500 transition-all" />
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Measurements Guidance Overlay Card */}
          <AnimatePresence>
            {isMeasuring && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                className="absolute top-24 left-6 z-[1000] p-4 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-amber-500/30 text-white space-y-2.5 max-w-xs shadow-2xl pointer-events-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ruler size={14} className="text-amber-500 animate-pulse shrink-0" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Ruler Protocol</span>
                  </div>
                  <button 
                    onClick={() => {
                      setIsMeasuring(false);
                      setMeasurePoints([]);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <X size={12} className="text-white/60" />
                  </button>
                </div>
                
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wide leading-relaxed">
                  Click on the map to add nodes and calculate physical distance paths dynamically.
                </p>
                
                <div className="pt-2 flex items-center justify-between border-t border-white/10">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Nodes Placed:</span>
                  <span className="text-[10px] font-mono font-black text-amber-400">{measurePoints.length}</span>
                </div>
                
                {measurePoints.length >= 2 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Total Distance:</span>
                    <span className="text-xs font-mono font-black text-amber-400">
                      {calculateDistance() < 1000 
                        ? `${Math.round(calculateDistance())} Meters` 
                        : `${(calculateDistance() / 1000).toFixed(3)} KM`}
                    </span>
                  </div>
                )}
                
                {measurePoints.length > 0 && (
                  <div className="flex gap-1.5 pt-1.5">
                    <button
                      onClick={() => setMeasurePoints(prev => prev.slice(0, prev.length - 1))}
                      className="flex-1 py-1.5 bg-slate-900 border border-white/10 hover:bg-slate-800 text-[8px] font-black uppercase tracking-widest rounded-lg transition-colors"
                    >
                      Undo point
                    </button>
                    <button
                      onClick={() => setMeasurePoints([])}
                      className="flex-1 py-1.5 bg-rose-950/40 border border-rose-500/20 text-rose-405 text-[8px] font-black uppercase tracking-widest rounded-lg transition-colors"
                    >
                      Clear path
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Node Placement Assistance Overlay Card */}
          <AnimatePresence>
            {positioningTargetId && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                className="absolute top-24 left-6 z-[1000] p-4 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-indigo-500/30 text-white space-y-2 max-w-xs shadow-2xl pointer-events-auto"
              >
                <div className="flex items-center gap-2">
                  <Crosshair size={14} className="text-indigo-400 animate-spin shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Positioning Mode</span>
                </div>
                <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wide leading-relaxed">
                  Click coordinates on the map screen to Deploy or Reposition server: <b className="text-indigo-450">{monitorTargets.find(t => t.id === positioningTargetId)?.label || 'Loading target'}</b>.
                </p>
                <div className="flex gap-1.5 pt-1.5 border-t border-white/10 mt-1">
                  <button
                    onClick={() => setPositioningTargetId(null)}
                    className="w-full py-1.5 bg-rose-950/40 border border-rose-500/20 text-rose-400 text-[8px] font-black uppercase tracking-widest rounded-lg transition-colorsHover hover:bg-rose-950/60"
                  >
                    Cancel Deployment
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Custom Web Domains Monitor sliding drawer */}
          <AnimatePresence>
            {isTargetsPanelOpen && (
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute left-0 top-0 bottom-0 w-full sm:w-[380px] bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl z-[1005] flex flex-col p-6 pt-24 pointer-events-auto"
              >
                {/* Header info */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/10">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-widest leading-none mb-1">Web Domains</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Custom servers monitoring</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={pingAllTargets}
                      disabled={isPingingTargets || monitorTargets.length === 0}
                      className={cn(
                        "p-2 rounded-xl border flex items-center justify-center transition-all",
                        isPingingTargets
                          ? "bg-slate-100 dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800 animate-spin"
                          : "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100"
                      )}
                      title="Run latency speed checks"
                    >
                      <RefreshCw size={13} />
                    </button>
                    <button 
                      onClick={() => setIsTargetsPanelOpen(false)} 
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 transition-all border border-transparent"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Insertion Form */}
                <div className="py-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Deploy Custom Monitor Beacon</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400">Target URL / Host</label>
                      <input
                        type="text"
                        placeholder="google.com"
                        value={newTargetDomain}
                        onChange={(e) => setNewTargetDomain(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTargetDomain) {
                            handleAddMonitorTarget();
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400">Custom Alias</label>
                      <input
                        type="text"
                        placeholder="Google Main Gateway"
                        value={newTargetLabel}
                        onChange={(e) => setNewTargetLabel(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTargetDomain) {
                            handleAddMonitorTarget();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddMonitorTarget}
                    disabled={!newTargetDomain}
                    className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-45 disabled:hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex justify-center items-center gap-1 border-none cursor-pointer"
                  >
                    <Plus size={12} /> Place Terminal Node
                  </button>
                </div>

                {/* Scrollable list targets */}
                <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-2.5 custom-scrollbar pb-6">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">
                    <span>Active Monitors ({monitorTargets.length})</span>
                    {isPingingTargets && <span className="text-[8px] text-indigo-500 animate-pulse font-extrabold">Scanning Web packets...</span>}
                  </div>
                  
                  {monitorTargets.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full border border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center">
                        <Globe size={18} className="text-slate-300" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">No custom targets monitored</span>
                    </div>
                  ) : (
                    monitorTargets.map((target, idx) => {
                      const latencyInfo = targetLatencies[target.id];
                      const latencyStr = latencyInfo 
                        ? (latencyInfo.ms === 'loading' ? 'Loading' : (latencyInfo.ms === 'Error' ? 'Offline' : `${latencyInfo.ms} ms`))
                        : 'Ping Host';
                      const status = latencyInfo ? latencyInfo.status : 'loading';

                      return (
                        <div 
                          key={`drawer-target-${target.id}-${idx}`}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col gap-2.5"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full border border-white dark:border-slate-950 shadow-sm shrink-0 animate-pulse",
                                status === 'excellent' && "bg-emerald-500",
                                status === 'good' && "bg-green-500",
                                status === 'fair' && "bg-amber-500",
                                status === 'poor' && "bg-rose-500",
                                status === 'loading' && "bg-slate-400"
                              )} />
                              <div>
                                <h4 className="text-slate-800 dark:text-slate-255 font-extrabold text-xs uppercase tracking-wide leading-none">{target.label || target.domain}</h4>
                                <span className="text-[8px] font-lexend text-slate-400 mt-0.5 block">{target.domain}</span>
                              </div>
                            </div>

                            <span className={cn(
                              "text-[9px] font-lexend font-black tracking-tighter px-2 py-0.5 rounded-full border shadow-sm shrink-0",
                              status === 'excellent' && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/10",
                              status === 'good' && "bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900/10",
                              status === 'fair' && "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/10",
                              status === 'poor' && "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-450 border-rose-200 dark:border-rose-900/10",
                              status === 'loading' && "bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 animate-pulse"
                            )}>
                              {latencyStr}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Global Matrix Action</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (target.lat && target.lng && mapRef.current) {
                                    mapRef.current.flyTo([target.lat, target.lng], 19, { duration: 1.5 });
                                  } else {
                                    toast.error("Coordinates not found for this monitor");
                                  }
                                }}
                                className="px-2 py-1 text-[8px] font-black bg-white dark:bg-slate-950 hover:bg-slate-100 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-850 rounded-lg transition-colors cursor-pointer"
                              >
                                Locate
                              </button>
                              <button
                                onClick={() => {
                                  setPositioningTargetId(target.id);
                                  toast.info(`Shield terminal active. Click anywhere on native Map screen.`);
                                }}
                                className="px-2 py-1 text-[8px] font-black bg-white dark:bg-slate-950 hover:bg-slate-100 text-indigo-650 dark:text-indigo-400 border border-slate-200 dark:border-slate-850 rounded-lg transition-colors cursor-pointer"
                              >
                                Deploy Node
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Remove custom target ${target.label || target.domain}?`)) {
                                    try {
                                      await pocketbaseService.deleteMonitorTarget(target.id);
                                      toast.success("Target discarded successfully.");
                                    } catch (err) {
                                      toast.error("Failed to delete target");
                                    }
                                  }
                                }}
                                className="px-1.5 py-1 text-[8px] font-black bg-rose-50 text-rose-600 border border-rose-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Discard
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 10px 25px -10px rgba(0,0,0,0.3);
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.95);
        }
        .custom-tooltip {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          padding: 4px 8px;
          font-weight: 800;
          font-size: 10px;
          color: #0f172a;
          white-space: nowrap;
        }
        .custom-tooltip::before {
          display: none;
        }
        .user-label-tooltip {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(4px);
          border: 1.5px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          color: #0f172a;
          padding: 3px 8px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .user-label-tooltip::before {
          display: none;
        }
        .measure-tooltip {
          background: #f59e0b;
          border: 2px solid white;
          color: white;
          border-radius: 6px;
          padding: 2px 6px;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }
        .measure-tooltip::before {
          border-top-color: #f59e0b;
        }
        .leaflet-container {
          background: #f1f5f9;
        }
        .dark .leaflet-container {
          background: #0f172a;
        }
        .leaflet-marker-icon {
          transition: transform 0.3s linear;
        }
      `}</style>
    </AnimatePresence>
  );
};

// Helper component to handle map updates
const MapUpdater = ({ mapType }: { mapType: string }) => {
  const map = useMap();
  useEffect(() => {
    // When map type changes, we might want to adjust colors or something
    // but standard tile layer swaps are handled by react-leaflet state
  }, [mapType, map]);
  return null;
};

export default MapViewer;

