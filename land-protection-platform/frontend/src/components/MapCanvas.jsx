import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import L from 'leaflet';
import 'leaflet-draw';

const DEFAULT_CENTER = { lat: 23.5, lng: 78.5 };

const amberStyle = {
  color: '#d4a574',
  weight: 2.5,
  fillColor: '#d4a574',
  fillOpacity: 0.15,
};

function extractLayerCoordinates(layer) {
  if (!layer) return null;

  if (layer instanceof L.Rectangle || layer instanceof L.Polygon) {
    const latlngs = layer.getLatLngs();
    if (!latlngs || !latlngs.length) return null;

    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    if (!ring || ring.length < 3) return null;

    const cleaned = ring.map((ll) => ({
      lat: Number(ll.lat),
      lng: Number(ll.lng),
    }));

    const deduped = [];
    for (const point of cleaned) {
      const prev = deduped[deduped.length - 1];
      if (!prev || prev.lat !== point.lat || prev.lng !== point.lng) {
        deduped.push(point);
      }
    }

    if (deduped.length > 1) {
      const first = deduped[0];
      const last = deduped[deduped.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) {
        deduped.pop();
      }
    }

    return deduped.length >= 3 ? deduped : null;
  }

  return null;
}

const MapCanvas = forwardRef(({ onPolygonChange }, ref) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawnItemsRef = useRef(null);
  const searchMarkerRef = useRef(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [polygonCount, setPolygonCount] = useState(0);
  const [drawMode, setDrawMode] = useState('none');

  const debounceRef = useRef(null);
  const activeDrawerRef = useRef(null);

  const syncFromLayers = () => {
    const group = drawnItemsRef.current;
    if (!group) {
      setPolygonCount(0);
      onPolygonChange(null);
      return;
    }

    const layers = group.getLayers();
    if (!layers.length) {
      setPolygonCount(0);
      onPolygonChange(null);
      return;
    }

    const coords = extractLayerCoordinates(layers[layers.length - 1]);
    if (!coords || coords.length < 3) {
      setPolygonCount(0);
      onPolygonChange(null);
      return;
    }

    setPolygonCount(coords.length);
    setDrawMode('none');
    onPolygonChange(coords);
  };

  const clearDrawings = () => {
    if (activeDrawerRef.current) {
      try {
        activeDrawerRef.current.disable();
      } catch {}
      activeDrawerRef.current = null;
    }

    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }

    setPolygonCount(0);
    setDrawMode('none');
    onPolygonChange(null);
  };

  useImperativeHandle(ref, () => ({
    clearDrawings,
  }));

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: 5,
      zoomControl: false,
      preferCanvas: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri · Maxar · Earthstar Geographics',
        maxZoom: 19,
      }
    ).addTo(map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        opacity: 0.7,
      }
    ).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    map.on(L.Draw.Event.DRAWSTART, (e) => {
      setDrawMode(e.layerType === 'rectangle' ? 'rectangle' : 'polygon');
    });

    map.on(L.Draw.Event.DRAWSTOP, () => {
      setDrawMode('none');
      activeDrawerRef.current = null;
    });

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);

      const bounds = e.layer.getBounds?.();
      if (bounds?.isValid?.()) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      syncFromLayers();
    });

    map.on(L.Draw.Event.EDITED, syncFromLayers);
    map.on(L.Draw.Event.DELETED, syncFromLayers);

    mapRef.current = map;
    drawnItemsRef.current = drawnItems;

    return () => {
      if (activeDrawerRef.current) {
        try {
          activeDrawerRef.current.disable();
        } catch {}
      }
      map.remove();
      mapRef.current = null;
      drawnItemsRef.current = null;
      activeDrawerRef.current = null;
    };
  }, [onPolygonChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
          headers: { 'Accept-Language': 'en' },
        });
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const flyTo = (place) => {
    if (!mapRef.current) return;

    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    if (place.boundingbox?.length === 4) {
      const [south, north, west, east] = place.boundingbox.map(parseFloat);
      mapRef.current.flyToBounds(
        [
          [south, west],
          [north, east],
        ],
        { duration: 1.1, padding: [40, 40] }
      );
    } else {
      mapRef.current.flyTo([lat, lon], 16, { duration: 1.1 });
    }

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    searchMarkerRef.current = L.circleMarker([lat, lon], {
      radius: 7,
      color: '#e8bc87',
      weight: 2,
      fillColor: '#d4a574',
      fillOpacity: 0.8,
    }).addTo(mapRef.current);

    setQuery(place.display_name.split(',')[0]);
    setShowSuggestions(false);
  };

  const startPolygonDraw = () => {
    if (!mapRef.current) return;
    clearDrawings();

    const drawer = new L.Draw.Polygon(mapRef.current, {
      allowIntersection: false,
      showArea: false,
      metric: false,
      repeatMode: false,
      shapeOptions: amberStyle,
    });

    activeDrawerRef.current = drawer;
    setDrawMode('polygon');
    drawer.enable();
  };

  const startRectangleDraw = () => {
    if (!mapRef.current) return;
    clearDrawings();

    const drawer = new L.Draw.Rectangle(mapRef.current, {
      showArea: false,
      metric: false,
      repeatMode: false,
      shapeOptions: amberStyle,
    });

    activeDrawerRef.current = drawer;
    setDrawMode('rectangle');
    drawer.enable();
  };

  return (
    <div className="map-canvas-wrapper">
      <div ref={containerRef} className="map-canvas" />

      <div className="map-search">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="search-icon">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <input
            type="text"
            placeholder="Search any place - city, village, landmark..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />

          {searching && <span className="search-spinner" />}

          {query && !searching && (
            <button
              className="search-clear"
              onClick={() => {
                setQuery('');
                setSuggestions([]);
              }}
              type="button"
            >
              ×
            </button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <ul className="search-results">
            {suggestions.map((s) => {
              const parts = s.display_name.split(',');
              const primary = parts[0];
              const secondary = parts.slice(1, 4).join(',').trim();

              return (
                <li key={s.place_id}>
                  <button type="button" onMouseDown={() => flyTo(s)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="pin-icon">
                      <path
                        d="M7 1C4.8 1 3 2.8 3 5c0 3 4 8 4 8s4-5 4-8c0-2.2-1.8-4-4-4z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                      <circle cx="7" cy="5" r="1.5" fill="currentColor" />
                    </svg>

                    <span className="result-text">
                      <strong>{primary}</strong>
                      <em>{secondary}</em>
                    </span>

                    <span className="result-type">{s.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="map-actions">
        <button className="draw-cta" onClick={startPolygonDraw} type="button">
          Draw polygon
        </button>

        <button className="map-secondary-button" onClick={startRectangleDraw} type="button">
          Square / rectangle
        </button>

        <button className="map-secondary-button" onClick={clearDrawings} type="button">
          Clear
        </button>
      </div>

      <div className="map-overlay">
        <div className="map-hint">
          {drawMode === 'rectangle'
            ? 'Drag on the map to draw a square/rectangle.'
            : drawMode === 'polygon'
            ? 'Click points on the map. Click the first point to close.'
            : polygonCount >= 3
            ? `Parcel ready · ${polygonCount} vertices`
            : 'Search a place, then draw polygon or rectangle above.'}
        </div>

        <div className="map-provider-badge">ESRI SATELLITE</div>
      </div>
    </div>
  );
});

MapCanvas.displayName = 'MapCanvas';

export default MapCanvas;