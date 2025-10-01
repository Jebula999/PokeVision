import { useEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapDrawProps {
  onShapeComplete: (shape: {
    type: string;
    area: number;
    cost: number;
    coordinates: string[];
    imageData: string;
    geofences?: any[];
  }) => void;
  shouldClear: boolean;
  onClear: () => void;
  onCoverageChange?: (counts: { gyms: number; pokestops: number }) => void;
  showGyms?: boolean;
  showPokestops?: boolean;
  onReady?: () => void;
}

type MapPointFeature = {
  lat: number;
  lon: number;
  type: string;
  teamId?: number | null;
};

export interface MapDrawRef {
  clearMap: () => void;
  getSnapshot: () => MapSnapshot | null;
  loadSnapshot: (snapshot: MapSnapshot) => void;
}

export interface SerializedGeofence {
  type: 'square' | 'polygon';
  coordinates: string[];
}

export interface MapSnapshot {
  zoom: number;
  center: { lat: number; lon: number };
  geofences: SerializedGeofence[];
}

const MapDraw = forwardRef<MapDrawRef, MapDrawProps>(
  (
    {
      onShapeComplete,
      shouldClear,
      onClear,
      onCoverageChange,
      showGyms = true,
      showPokestops = true,
      onReady,
    },
    ref,
  ) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const pointsLayerRef = useRef<L.LayerGroup | null>(null);
  const markerFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markerAbortControllerRef = useRef<AbortController | null>(null);
  const activePointsRef = useRef<MapPointFeature[]>([]);
  const pokestopLayerRef = useRef<L.LayerGroup | null>(null);
  const gymLayerRef = useRef<L.LayerGroup | null>(null);
  const showGymsRef = useRef<boolean>(showGyms);
  const showPokestopsRef = useRef<boolean>(showPokestops);
  const schedulePointFetchRef = useRef<((immediate?: boolean) => void) | null>(null);
  const updateCoverageRef = useRef<(() => void) | null>(null);
  const syncLayersRef = useRef<(() => void) | null>(null);
  const onReadyRef = useRef(onReady);
  
  // Store callback functions in refs to avoid re-initializing map
  const onShapeCompleteRef = useRef(onShapeComplete);
  const onClearRef = useRef(onClear);
  const onCoverageChangeRef = useRef(onCoverageChange);
  
  // Update refs when props change
  useEffect(() => {
    onShapeCompleteRef.current = onShapeComplete;
  }, [onShapeComplete]);
  
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => {
    onCoverageChangeRef.current = onCoverageChange;
  }, [onCoverageChange]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const inferLayerType = (layer: any): 'rectangle' | 'polygon' => {
    if (layer instanceof (L.Rectangle as any)) {
      return 'rectangle';
    }
    return 'polygon';
  };

  const buildPolygonCoords = (layer: any, layerType: string): [number, number][] => {
    if (layerType === 'rectangle') {
      const bounds = layer.getBounds();
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const nw = L.latLng(ne.lat, sw.lng);
      const se = L.latLng(sw.lat, ne.lng);

      return [
        [ne.lng, ne.lat],
        [se.lng, se.lat],
        [sw.lng, sw.lat],
        [nw.lng, nw.lat],
        [ne.lng, ne.lat],
      ];
    }

    const latlngs = layer.getLatLngs?.()[0] ?? [];
    const coords = (latlngs as L.LatLng[]).map((latlng) => [latlng.lng, latlng.lat] as [number, number]);
    if (coords.length === 0) {
      return [];
    }
    coords.push(coords[0]);
    return coords;
  };

  const calculateLayerData = (layer: any, layerType: string) => {
    const polygonCoords = buildPolygonCoords(layer, layerType);

    const coordinates = polygonCoords.map(([lng, lat]) => `${lat},${lng}`);
    const area = polygonCoords.length >= 4
      ? turf.area(turf.polygon([polygonCoords])) / 1000000
      : 0;

    return { coordinates, area, polygonCoords };
  };

  const parseCoordinateString = (coordinate: string): L.LatLng | null => {
    const parts = coordinate.split(",").map((part) => part.trim());
    if (parts.length < 2) {
      return null;
    }
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return L.latLng(lat, lon);
  };

  const createLayerFromSerializedGeofence = (geofence: SerializedGeofence): L.Layer | null => {
    const shapeOptions = {
      color: '#FFD700',
      weight: 3,
      fillOpacity: 0.2,
    };

    const latlngs = geofence.coordinates
      .map(parseCoordinateString)
      .filter((point): point is L.LatLng => point !== null);

    if (latlngs.length < 3) {
      return null;
    }

    if (geofence.type === 'square') {
      const latitudes = latlngs.map((pt) => pt.lat);
      const longitudes = latlngs.map((pt) => pt.lng);

      const bounds = L.latLngBounds(
        L.latLng(Math.min(...latitudes), Math.min(...longitudes)),
        L.latLng(Math.max(...latitudes), Math.max(...longitudes)),
      );

      return L.rectangle(bounds, shapeOptions);
    }

    return L.polygon(latlngs, shapeOptions);
  };

  const collectSerializedGeofences = (layers: any[]): SerializedGeofence[] => {
    return layers
      .map((layer: any) => {
        const layerType = inferLayerType(layer);
        const { coordinates } = calculateLayerData(layer, layerType);
        if (coordinates.length === 0) {
          return null;
        }
        return {
          type: layerType === 'rectangle' ? 'square' : 'polygon',
          coordinates,
        } satisfies SerializedGeofence;
      })
      .filter((value): value is SerializedGeofence => value !== null);
  };

  useImperativeHandle(ref, () => ({
    clearMap: () => {
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      onShapeCompleteRef.current({
        type: 'sync',
        area: 0,
        cost: 0,
        coordinates: [],
        imageData: '',
        geofences: [],
      });
      if (onCoverageChangeRef.current) {
        onCoverageChangeRef.current({ gyms: 0, pokestops: 0 });
      }
      syncLayersRef.current?.();
    },
    getSnapshot: () => {
      if (!mapInstanceRef.current) {
        return null;
      }

      const layers = drawnItemsRef.current?.getLayers() ?? [];
      const geofences = collectSerializedGeofences(layers);

      const center = mapInstanceRef.current.getCenter();
      const zoom = mapInstanceRef.current.getZoom();

      return {
        zoom,
        center: { lat: center.lat, lon: center.lng },
        geofences,
      } satisfies MapSnapshot;
    },
    loadSnapshot: (snapshot: MapSnapshot) => {
      if (!mapInstanceRef.current || !drawnItemsRef.current) {
        return;
      }

      if (snapshot.center) {
        mapInstanceRef.current.setView(
          [snapshot.center.lat, snapshot.center.lon],
          snapshot.zoom,
          { animate: false },
        );
      } else if (Number.isFinite(snapshot.zoom)) {
        mapInstanceRef.current.setZoom(snapshot.zoom);
      }

      drawnItemsRef.current.clearLayers();

      const geofences = snapshot.geofences ?? [];

      geofences.forEach((geofence) => {
        const layer = createLayerFromSerializedGeofence(geofence);
        if (layer) {
          drawnItemsRef.current?.addLayer(layer);
        }
      });

      syncLayersRef.current?.();
    },
  }));

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Default fallback: world view with lower zoom to see more area
    const defaultCenter: [number, number] = [0, 0]; // World center
    const defaultZoom = 2; // Much more zoomed out to see continents
    
    // Initialize map with default world view
    const map = L.map(mapRef.current).setView(defaultCenter, defaultZoom);

    // Try to get user's location and zoom to their area
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Set view to user's location with a reasonable zoom level for area selection
          map.setView([latitude, longitude], 8);
        },
        (error) => {
          // If geolocation fails, keep the default world view
          console.log('Geolocation not available or permission denied, using world view');
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // 5 minutes cache
        }
      );
    }

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Add draw control
    const drawControl = new (L.Control as any).Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false, // Disable area display to prevent type error
          drawError: {
            color: '#e1e100',
            message: '<strong>Error:</strong> Shape edges cannot cross!'
          },
          shapeOptions: {
            color: '#FFD700',
            weight: 3,
            fillOpacity: 0.2
          },
          showLength: false, // Disable length display too
          metric: false // Disable metric calculations that might reference 'type'
        },
        rectangle: {
          showArea: false, // Disable area display to prevent type error
          shapeOptions: {
            color: '#FFD700',
            weight: 3,
            fillOpacity: 0.2
          },
          metric: false // Disable metric calculations
        },
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    map.addControl(drawControl);

    // Create layer group for gyms/pokestops
    const pokestopLayer = L.layerGroup().addTo(map);
    const gymLayer = L.layerGroup().addTo(map);
    pokestopLayerRef.current = pokestopLayer;
    gymLayerRef.current = gymLayer;
    const combinedLayer = L.layerGroup([pokestopLayer, gymLayer]);
    pointsLayerRef.current = combinedLayer;

    const updateCoverage = () => {
      if (!onCoverageChangeRef.current) {
        return;
      }

      const layers = drawnItemsRef.current?.getLayers() ?? [];
      if (layers.length === 0) {
        onCoverageChangeRef.current({ gyms: 0, pokestops: 0 });
        return;
      }

      const includeGyms = showGymsRef.current !== false;
      const includePokestops = showPokestopsRef.current !== false;

      if (!includeGyms && !includePokestops) {
        onCoverageChangeRef.current({ gyms: 0, pokestops: 0 });
        return;
      }

      const polygons = layers
        .map((layer: any) => {
          const layerType = inferLayerType(layer);
          const { polygonCoords } = calculateLayerData(layer, layerType);
          if (polygonCoords.length < 4) {
            return null;
          }
          return turf.polygon([polygonCoords]);
        })
        .filter(Boolean) as Feature<Polygon>[];

      if (polygons.length === 0) {
        onCoverageChangeRef.current({ gyms: 0, pokestops: 0 });
        return;
      }

      let gyms = 0;
      let pokestops = 0;

      activePointsRef.current.forEach((point) => {
        if (point.type === 'gym' && !includeGyms) {
          return;
        }
        if (point.type === 'pokestop' && !includePokestops) {
          return;
        }
        const pt = turf.point([point.lon, point.lat]);
        const isInside = polygons.some((poly) => turf.booleanPointInPolygon(pt, poly));

        if (isInside) {
          if (point.type === 'gym') {
            gyms += 1;
          } else {
            pokestops += 1;
          }
        }
      });

      onCoverageChangeRef.current({ gyms, pokestops });
    };

    const fetchPoints = async () => {
      if (!pointsLayerRef.current) return;

      const zoomLevel = map.getZoom();
      if (zoomLevel < 11) {
        pokestopLayer.clearLayers();
        gymLayer.clearLayers();
        activePointsRef.current = [];
        updateCoverage();
        return;
      }

      const includeGymsBeforeFetch = showGymsRef.current !== false;
      const includePokestopsBeforeFetch = showPokestopsRef.current !== false;

      if (!includeGymsBeforeFetch && !includePokestopsBeforeFetch) {
        pokestopLayer.clearLayers();
        gymLayer.clearLayers();
        activePointsRef.current = [];
        updateCoverage();
        return;
      }

      const bounds = map.getBounds();
      const params = new URLSearchParams({
        north: bounds.getNorth().toString(),
        south: bounds.getSouth().toString(),
        east: bounds.getEast().toString(),
        west: bounds.getWest().toString(),
        zoom: zoomLevel.toString(),
      });

      if (markerAbortControllerRef.current) {
        markerAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      markerAbortControllerRef.current = controller;

      try {
        const response = await fetch(`/api/map-points?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load points (${response.status})`);
        }

        const data = await response.json();
        const points: MapPointFeature[] = data?.points ?? [];

        activePointsRef.current = points;

        pokestopLayer.clearLayers();
        gymLayer.clearLayers();

        const includeGyms = showGymsRef.current !== false;
        const includePokestops = showPokestopsRef.current !== false;

        const minZoomLevel = 11;
        const maxZoomLevel = 18;
        const normalized = Math.min(
          1,
          Math.max(0, (zoomLevel - minZoomLevel) / (maxZoomLevel - minZoomLevel)),
        );

        points.forEach((point) => {
          if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
            return;
          }

          if (point.type === 'gym' && !includeGyms) {
            return;
          }

          if (point.type === 'pokestop' && !includePokestops) {
            return;
          }

          const baseRadius = point.type === 'gym' ? 6 : 3;
          const minRadius = point.type === 'gym' ? 3 : 1.5;
          const maxRadius = baseRadius;
          const scaledRadius = minRadius + (maxRadius - minRadius) * normalized;

          const teamColor = (() => {
            if (point.type !== 'gym') {
              return '#D4AF37';
            }

            switch (point.teamId) {
              case 1:
                return '#3B82F6';
              case 2:
                return '#EF4444';
              case 3:
                return '#FACC15';
              case 4:
                return '#9CA3AF';
              default:
                return '#D4AF37';
            }
          })();

          const circle = L.circleMarker([point.lat, point.lon], {
            radius: scaledRadius,
            color: '#000000',
            weight: 0.8,
            opacity: 1,
            fillColor: teamColor,
            fillOpacity: 0.85,
            pane: 'markerPane',
          });

          circle.addTo(point.type === 'gym' ? gymLayer : pokestopLayer);
        });

        updateCoverage();
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch map points', error);
      }
    };

    updateCoverageRef.current = updateCoverage;

    const schedulePointFetch = () => {
      if (markerFetchTimeoutRef.current) {
        clearTimeout(markerFetchTimeoutRef.current);
      }
      markerFetchTimeoutRef.current = setTimeout(() => {
        fetchPoints();
      }, 250);
    };

    const triggerPointFetch = (immediate = false) => {
      if (markerFetchTimeoutRef.current) {
        clearTimeout(markerFetchTimeoutRef.current);
        markerFetchTimeoutRef.current = null;
      }
      if (immediate) {
        fetchPoints();
      } else {
        schedulePointFetch();
      }
    };

    schedulePointFetchRef.current = triggerPointFetch;

    map.on('moveend', schedulePointFetch);
    map.on('zoomend', schedulePointFetch);

    // Trigger initial fetch once the map has settled
    map.whenReady(() => {
      schedulePointFetch();
      onReadyRef.current?.();
    });

    // Handle draw events
    map.on('draw:created', (event: any) => {
      const layer = event.layer;
      const layerType = event.layerType;
      
      if (!layerType) {
        console.error('Layer type is undefined, event:', event);
        return;
      }
      
      drawnItems.addLayer(layer);

      const { coordinates, area } = calculateLayerData(layer, layerType);

      const cost = Math.ceil(area / 5) * 10; // $10 per 5km²

      onShapeCompleteRef.current({
        type: layerType === 'rectangle' ? 'square' : 'polygon',
        area,
        cost,
        coordinates,
        imageData: '' // No image for now
      });

      updateCoverage();
    });

    // Helper function to sync all remaining layers
    const syncLayers = () => {
      const remainingLayers = drawnItems.getLayers();
      
      if (remainingLayers.length === 0) {
        // No layers left, reset everything
        onShapeCompleteRef.current({
          type: 'sync',
          area: 0,
          cost: 0,
          coordinates: [],
          imageData: '',
          geofences: []
        });
        updateCoverage();
      } else {
        // Calculate data for all remaining layers
        const geofences = remainingLayers.map((layer: any) => {
          const layerType = inferLayerType(layer);
          const layerData = calculateLayerData(layer, layerType);
          
          return {
            type: layerType === 'rectangle' ? 'square' : 'polygon',
            area: layerData.area,
            coordinates: layerData.coordinates,
            imageData: ''
          };
        });

        onShapeCompleteRef.current({
          type: 'sync',
          area: 0, // Parent will calculate total
          cost: 0, // Parent will calculate total
          coordinates: [],
          imageData: '',
          geofences
        });
        updateCoverage();
      }
    };

    syncLayersRef.current = syncLayers;

    // Handle layer deletion
    map.on('draw:deleted', syncLayers);
    
    // Handle layer editing
    map.on('draw:edited', syncLayers);

    mapInstanceRef.current = map;

    return () => {
      map.off('draw:deleted', syncLayers);
      map.off('draw:edited', syncLayers);
      map.off('moveend', schedulePointFetch);
      map.off('zoomend', schedulePointFetch);

      if (markerFetchTimeoutRef.current) {
        clearTimeout(markerFetchTimeoutRef.current);
        markerFetchTimeoutRef.current = null;
      }

      if (markerAbortControllerRef.current) {
        markerAbortControllerRef.current.abort();
        markerAbortControllerRef.current = null;
      }

      pokestopLayer.clearLayers();
      gymLayer.clearLayers();
      pokestopLayer.remove();
      gymLayer.remove();
      pointsLayerRef.current = null;
      activePointsRef.current = [];
      schedulePointFetchRef.current = null;
      updateCoverageRef.current = null;
      pokestopLayerRef.current = null;
      gymLayerRef.current = null;
      syncLayersRef.current = null;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Initialize map only once

  // Handle external clear requests
  useEffect(() => {
    if (shouldClear && drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
      onClearRef.current();
      if (onCoverageChangeRef.current) {
        onCoverageChangeRef.current({ gyms: 0, pokestops: 0 });
      }
    }
  }, [shouldClear]);

  useEffect(() => {
    showGymsRef.current = showGyms;
    showPokestopsRef.current = showPokestops;

    if (!showGyms && !showPokestops) {
      pokestopLayerRef.current?.clearLayers();
      gymLayerRef.current?.clearLayers();
      activePointsRef.current = [];
      if (updateCoverageRef.current) {
        updateCoverageRef.current();
      }
      return;
    }

    if (schedulePointFetchRef.current) {
      schedulePointFetchRef.current(true);
    } else if (updateCoverageRef.current) {
      updateCoverageRef.current();
    }
  }, [showGyms, showPokestops]);

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        className="w-full h-[500px] md:h-[600px] border border-border rounded-lg bg-card"
        data-testid="map-canvas"
      />
      <div className="absolute top-2 left-2 bg-card/90 backdrop-blur-sm rounded p-2 text-xs text-muted-foreground">
        <p>🖱️ Use tools on the right to draw areas</p>
        <p>📐 Rectangle or custom polygon</p>
        <p>🔍 Zoom to level 11+ to see gyms & pokestops</p>
      </div>
    </div>
  );
});

MapDraw.displayName = 'MapDraw';

export default memo(MapDraw);
