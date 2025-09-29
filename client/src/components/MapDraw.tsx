import { useEffect, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import * as turf from '@turf/turf';
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
}

export interface MapDrawRef {
  clearMap: () => void;
}

const MapDraw = forwardRef<MapDrawRef, MapDrawProps>(({ onShapeComplete, shouldClear, onClear }, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  
  // Store callback functions in refs to avoid re-initializing map
  const onShapeCompleteRef = useRef(onShapeComplete);
  const onClearRef = useRef(onClear);
  
  // Update refs when props change
  useEffect(() => {
    onShapeCompleteRef.current = onShapeComplete;
  }, [onShapeComplete]);
  
  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useImperativeHandle(ref, () => ({
    clearMap: () => {
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
    }
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

    // Handle draw events
    map.on('draw:created', (event: any) => {
      const layer = event.layer;
      const layerType = event.layerType;
      
      if (!layerType) {
        console.error('Layer type is undefined, event:', event);
        return;
      }
      
      drawnItems.addLayer(layer);

      // Get coordinates
      let coordinates: string[] = [];
      let area = 0;

      if (layerType === 'rectangle') {
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const nw = L.latLng(ne.lat, sw.lng);
        const se = L.latLng(sw.lat, ne.lng);
        
        coordinates = [
          `${ne.lat},${ne.lng}`,
          `${se.lat},${se.lng}`,
          `${sw.lat},${sw.lng}`,
          `${nw.lat},${nw.lng}`,
          `${ne.lat},${ne.lng}` // Close the polygon
        ];

        // Calculate area using Turf
        const polygon = turf.polygon([[
          [ne.lng, ne.lat],
          [se.lng, se.lat],
          [sw.lng, sw.lat],
          [nw.lng, nw.lat],
          [ne.lng, ne.lat]
        ]]);
        area = turf.area(polygon) / 1000000; // Convert to km²
      } else if (layerType === 'polygon') {
        const latlngs = layer.getLatLngs()[0];
        coordinates = latlngs.map((latlng: L.LatLng) => `${latlng.lat},${latlng.lng}`);
        coordinates.push(coordinates[0]); // Close the polygon

        // Convert to Turf polygon format
        const coords = latlngs.map((latlng: L.LatLng) => [latlng.lng, latlng.lat]);
        coords.push(coords[0]); // Close the polygon
        const polygon = turf.polygon([coords]);
        area = turf.area(polygon) / 1000000; // Convert to km²
      }

      const cost = Math.ceil(area / 5) * 10; // $10 per 5km²

      onShapeCompleteRef.current({
        type: layerType === 'rectangle' ? 'square' : 'polygon',
        area,
        cost,
        coordinates,
        imageData: '' // No image for now
      });
    });

    // Helper function to calculate layer data
    const calculateLayerData = (layer: any, layerType: string) => {
      let coordinates: string[] = [];
      let area = 0;

      if (layerType === 'rectangle') {
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const nw = L.latLng(ne.lat, sw.lng);
        const se = L.latLng(sw.lat, ne.lng);
        
        coordinates = [
          `${ne.lat},${ne.lng}`,
          `${se.lat},${se.lng}`,
          `${sw.lat},${sw.lng}`,
          `${nw.lat},${nw.lng}`,
          `${ne.lat},${ne.lng}` // Close the polygon
        ];

        // Calculate area using Turf
        const polygon = turf.polygon([[
          [ne.lng, ne.lat],
          [se.lng, se.lat],
          [sw.lng, sw.lat],
          [nw.lng, nw.lat],
          [ne.lng, ne.lat]
        ]]);
        area = turf.area(polygon) / 1000000; // Convert to km²
      } else if (layerType === 'polygon') {
        const latlngs = layer.getLatLngs()[0];
        coordinates = latlngs.map((latlng: L.LatLng) => `${latlng.lat},${latlng.lng}`);
        coordinates.push(coordinates[0]); // Close the polygon

        // Convert to Turf polygon format
        const coords = latlngs.map((latlng: L.LatLng) => [latlng.lng, latlng.lat]);
        coords.push(coords[0]); // Close the polygon
        const polygon = turf.polygon([coords]);
        area = turf.area(polygon) / 1000000; // Convert to km²
      }

      return { coordinates, area };
    };

    // Helper function to sync all remaining layers
    const syncRemainingLayers = () => {
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
      } else {
        // Calculate data for all remaining layers
        const geofences = remainingLayers.map((layer: any) => {
          // Determine layer type - this is tricky as we need to infer it from the layer
          const latLngs = layer.getLatLngs ? layer.getLatLngs() : null;
          const bounds = layer.getBounds ? layer.getBounds() : null;
          
          let layerType = 'polygon';
          if (bounds && latLngs && latLngs[0] && latLngs[0].length === 4) {
            // Check if it's a rectangle (4 corners forming a rectangle)
            const corners = latLngs[0];
            const isRectangle = corners.length === 4 && 
              corners[0].lat === corners[3].lat && corners[1].lat === corners[2].lat &&
              corners[0].lng === corners[1].lng && corners[2].lng === corners[3].lng;
            if (isRectangle) layerType = 'rectangle';
          }
          
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
      }
    };

    // Handle layer deletion
    map.on('draw:deleted', syncRemainingLayers);
    
    // Handle layer editing
    map.on('draw:edited', syncRemainingLayers);

    mapInstanceRef.current = map;

    return () => {
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
    }
  }, [shouldClear]);

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
      </div>
    </div>
  );
});

MapDraw.displayName = 'MapDraw';

export default memo(MapDraw);