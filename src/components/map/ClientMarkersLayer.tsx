import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Supercluster, { type PointFeature, type ClusterProperties } from 'supercluster';
import type { BBox } from 'geojson';
import { Client } from '../../types';
import {
  SHARED_CLIENT_PIN_ICON,
  getLabeledClientPinIcon,
  getClusterIcon,
} from './mapIcons';

export interface ClientMapItem {
  client: Client;
  id: string;
  lat: number;
  lng: number;
  name: string;
  displayId: string;
  searchText: string;
}

interface ClientPointProps {
  id: string;
}

interface ClientPinProps {
  id: string;
  lat: number;
  lng: number;
  icon: L.DivIcon;
  onSelect: (clientId: string) => void;
}

const ClientPin = React.memo<ClientPinProps>(({ id, lat, lng, icon, onSelect }) => {
  const eventHandlers = useMemo(
    () => ({
      click: (e: L.LeafletMouseEvent) => {
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
        }
        L.DomEvent.stopPropagation(e);
        onSelect(id);
      },
    }),
    [id, onSelect]
  );

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      keyboard={false}
      riseOnHover={false}
      interactive={true}
      eventHandlers={eventHandlers}
    />
  );
});

interface ClusterPinProps {
  clusterId: number;
  lat: number;
  lng: number;
  count: number;
  abbreviated: string | number;
  onSelect: (clusterId: number, lat: number, lng: number) => void;
}

const ClusterPin = React.memo<ClusterPinProps>(
  ({ clusterId, lat, lng, count, abbreviated, onSelect }) => {
    const icon = useMemo(() => getClusterIcon(count, abbreviated), [count, abbreviated]);

    const eventHandlers = useMemo(
      () => ({
        click: (e: L.LeafletMouseEvent) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          L.DomEvent.stopPropagation(e);
          onSelect(clusterId, lat, lng);
        },
      }),
      [clusterId, lat, lng, onSelect]
    );

    return (
      <Marker
        position={[lat, lng]}
        icon={icon}
        keyboard={false}
        riseOnHover={false}
        interactive={true}
        eventHandlers={eventHandlers}
      />
    );
  }
);

export interface ClientMarkersLayerProps {
  clients: ClientMapItem[];
  totalClientsCount?: number;
  filterText: string;
  selectedClientId: string | null;
  onMarkerClick: (clientId: string) => void;
}

const MAX_RENDERED_ITEMS = 300;
const UNCLUSTERED_SEARCH_LIMIT = 200;
const LABEL_ZOOM_THRESHOLD = 18;
const LABEL_MAX_PINS = 60;

function boundsToBBox(bounds: L.LatLngBounds): BBox {
  return [
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ];
}

export const ClientMarkersLayer = React.memo<ClientMarkersLayerProps>(
  ({ clients, totalClientsCount, filterText, selectedClientId, onMarkerClick }) => {
    const map = useMap();

    const [viewState, setViewState] = useState<{ bbox: BBox; zoom: number }>(() => ({
      bbox: boundsToBBox(map.getBounds()),
      zoom: map.getZoom(),
    }));

    const rafRef = useRef<number | null>(null);
    const shouldDebugLogRef = useRef<boolean>(false);

    const scheduleViewUpdate = useCallback(() => {
      shouldDebugLogRef.current = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const b = map.getBounds();
        const z = map.getZoom();
        setViewState({
          bbox: boundsToBBox(b),
          zoom: z,
        });
      });
    }, [map]);

    useMapEvents({
      moveend: scheduleViewUpdate,
      zoomend: scheduleViewUpdate,
    });

    useEffect(() => {
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, []);

    const { baseIndex, clientById } = useMemo(() => {
      const byId = new Map<string, ClientMapItem>();
      const points: PointFeature<ClientPointProps>[] = [];
      for (let i = 0; i < clients.length; i++) {
        const item = clients[i];
        if (byId.has(item.id)) continue;
        byId.set(item.id, item);
        points.push({
          type: 'Feature',
          properties: { id: item.id },
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat],
          },
        });
      }
      const index = new Supercluster<ClientPointProps>({
        radius: 60,
        maxZoom: 19,
        minPoints: 3,
      });
      index.load(points);
      return { baseIndex: index, clientById: byId };
    }, [clients]);

    const normalizedFilter = filterText.trim().toLowerCase();

    const filteredItems = useMemo(() => {
      if (!normalizedFilter) return clients;
      return clients.filter((item) => item.searchText.includes(normalizedFilter));
    }, [clients, normalizedFilter]);

    const activeIndex = useMemo(() => {
      if (!normalizedFilter) return baseIndex;
      if (filteredItems.length <= UNCLUSTERED_SEARCH_LIMIT) return null;
      const index = new Supercluster<ClientPointProps>({
        radius: 60,
        maxZoom: 19,
        minPoints: 3,
      });
      const seen = new Set<string>();
      const points: PointFeature<ClientPointProps>[] = [];
      for (let i = 0; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        points.push({
          type: 'Feature',
          properties: { id: item.id },
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat],
          },
        });
      }
      index.load(points);
      return index;
    }, [normalizedFilter, filteredItems, baseIndex]);

    const { clusters, pins, computeMs } = useMemo(() => {
      const t0 = performance.now();
      const clusterList: Array<{
        clusterId: number;
        lat: number;
        lng: number;
        count: number;
        abbreviated: string | number;
      }> = [];
      const pinList: ClientMapItem[] = [];
      const renderedIds = new Set<string>();
      const seenClusterIds = new Set<number>();

      if (normalizedFilter && filteredItems.length <= UNCLUSTERED_SEARCH_LIMIT) {
        for (let i = 0; i < filteredItems.length && pinList.length < MAX_RENDERED_ITEMS; i++) {
          const item = filteredItems[i];
          if (renderedIds.has(item.id)) continue;
          pinList.push(item);
          renderedIds.add(item.id);
        }
      } else if (activeIndex) {
        const clusterZoom = Math.round(viewState.zoom);
        const raw = activeIndex.getClusters(viewState.bbox, clusterZoom);
        const limit = Math.min(raw.length, MAX_RENDERED_ITEMS);

        for (let i = 0; i < limit; i++) {
          const feature = raw[i];
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties as
            | (ClusterProperties & ClientPointProps)
            | ClientPointProps;

          if ('cluster' in props && props.cluster) {
            if (seenClusterIds.has(props.cluster_id)) continue;
            seenClusterIds.add(props.cluster_id);
            clusterList.push({
              clusterId: props.cluster_id,
              lat,
              lng,
              count: props.point_count,
              abbreviated: props.point_count_abbreviated,
            });
          } else {
            if (renderedIds.has(props.id)) continue;
            const item = clientById.get(props.id);
            if (item) {
              pinList.push(item);
              renderedIds.add(item.id);
            }
          }
        }
      }

      if (selectedClientId && !renderedIds.has(selectedClientId)) {
        const selectedItem = clientById.get(selectedClientId);
        if (selectedItem) {
          pinList.push(selectedItem);
          renderedIds.add(selectedItem.id);
        }
      }

      const t1 = performance.now();
      return {
        clusters: clusterList,
        pins: pinList,
        computeMs: t1 - t0,
      };
    }, [
      normalizedFilter,
      filteredItems,
      activeIndex,
      viewState.bbox,
      viewState.zoom,
      clientById,
      selectedClientId,
    ]);

    useEffect(() => {
      if (!shouldDebugLogRef.current) return;
      shouldDebugLogRef.current = false;
      try {
        if (localStorage.getItem('gp_debug_map') === '1') {
          const renderedCount = clusters.length + pins.length;
          console.log(
            `[Map] clients=${totalClientsCount ?? clients.length} withCoords=${clients.length} items=${renderedCount} clusters=${clusters.length} ms=${computeMs.toFixed(2)}`
          );
        }
      } catch {
        // ignore storage access issues
      }
    }, [clusters.length, pins.length, computeMs, clients.length, totalClientsCount]);

    const handleClusterClick = useCallback(
      (clusterId: number, lat: number, lng: number) => {
        if (!activeIndex) return;
        const expansionZoom = Math.min(activeIndex.getClusterExpansionZoom(clusterId), 21);
        map.flyTo([lat, lng], expansionZoom, { duration: 0.6 });
      },
      [activeIndex, map]
    );

    const showLabels = viewState.zoom >= LABEL_ZOOM_THRESHOLD && pins.length <= LABEL_MAX_PINS;

    return (
      <>
        {clusters.map((cluster) => (
          <ClusterPin
            key={`cluster-${cluster.clusterId}`}
            clusterId={cluster.clusterId}
            lat={cluster.lat}
            lng={cluster.lng}
            count={cluster.count}
            abbreviated={cluster.abbreviated}
            onSelect={handleClusterClick}
          />
        ))}
        {pins.map((item) => (
          <ClientPin
            key={`pin-${item.id}`}
            id={item.id}
            lat={item.lat}
            lng={item.lng}
            icon={showLabels ? getLabeledClientPinIcon(item.name, item.displayId) : SHARED_CLIENT_PIN_ICON}
            onSelect={onMarkerClick}
          />
        ))}
      </>
    );
  }
);
