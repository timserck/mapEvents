import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "../leafletFix.js";
import { createNumberedIcon, myPositionIcon } from "../leaflet.js";
import AdminPanel from "../components/AdminPanel";
import { API_URL } from "../config";
import LazyImage from "../components/LazyImage";
import { formatDate } from "../utils.js";
import { DEFAULT_IMAGE, CACHE_TTL, setCache, getCache } from "../cache.js";

// 🔁 Recenter map when center changes
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Interpolation for animation
function interpolatePoints(p1, p2, steps) {
  const points = [];
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;
  for (let i = 0; i <= steps; i++) {
    points.push([lat1 + ((lat2 - lat1) * i) / steps, lng1 + ((lng2 - lng1) * i) / steps]);
  }
  return points;
}

// Smooth path for animation
function smoothPath(path, step = 5) {
  if (!path || path.length < 2) return path;
  let smoothed = [];
  for (let i = 0; i < path.length - 1; i++) {
    smoothed.push(...interpolatePoints(path[i], path[i + 1], step));
  }
  smoothed.push(path[path.length - 1]);
  return smoothed;
}

// Animated marker
function AnimatedMarker({ path, speed = 50 }) {
  const [index, setIndex] = useState(0);
  const smoothedPath = smoothPath(path, 5);

  useEffect(() => {
    if (!smoothedPath || smoothedPath.length < 2) return;
    const interval = setInterval(() => setIndex(prev => (prev + 1 < smoothedPath.length ? prev + 1 : prev)), speed);
    return () => clearInterval(interval);
  }, [smoothedPath, speed]);

  if (!smoothedPath || smoothedPath.length === 0) return null;
  return <Marker position={smoothedPath[index]} icon={myPositionIcon} />;
}

// Debounce helper
function debounce(fn, delay) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

// Snap a point to nearest road using GraphHopper Nearest API
async function snapPoint([lat, lon]) {
  try {
    const res = await fetch(`${API_URL}/gh-nearest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ point: [lat, lon] })
    });
    const data = await res.json();
    if (data && data.snapped_point) return data.snapped_point;
  } catch (err) {
    console.error("GraphHopper nearest error:", err);
  }
  return [lat, lon]; // fallback
}

// GraphHopper route fetch (segment-by-segment)
async function fetchGraphHopperRoute(points) {
  if (!points || points.length < 2) return [];
  const allCoords = [];

  // Snap points first
  const snappedPoints = [];
  for (let p of points) {
    const snapped = await snapPoint(p);
    snappedPoints.push(snapped);
  }

  const cacheKeyBase = "gh_segment_";

  const requestRoute = async (segment) => {
    const key = cacheKeyBase + segment.map(p => p?.join(",")).join("_"); // safe join
    const cached = getCache(key);
    if (cached) return cached;

    try {
      const res = await fetch(`${API_URL}/gh-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: segment, profile: "foot" })
      });
      const data = await res.json();
      let coords = [];
      if (data.paths?.[0]?.points?.coordinates) {
        coords = data.paths[0].points.coordinates.map(([lon, lat]) => [lat, lon]);
      } else if (data.points?.coordinates) {
        coords = data.points.coordinates.map(([lon, lat]) => [lat, lon]);
      } else if (data.coordinates) {
        coords = data.coordinates.map(([lon, lat]) => [lat, lon]);
      } else {
        console.warn("GraphHopper subroute missing coordinates:", data);
      }
      if (coords.length) setCache(key, coords, CACHE_TTL);
      return coords;
    } catch (err) {
      console.error("GraphHopper fetch error:", err);
      return [];
    }
  };

  for (let i = 0; i < snappedPoints.length - 1; i++) {
    const segment = [snappedPoints[i], snappedPoints[i + 1]];
    const routePart = await requestRoute(segment);
    if (routePart.length > 0) {
      if (allCoords.length > 0) routePart.shift();
      allCoords.push(...routePart);
    }
  }

  return allCoords;
}

export default function MapPage({ role, isPanelOpen, onCloseAdminPanel }) {
  const [events, setEvents] = useState([]);
  const [eventImages, setEventImages] = useState({});
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("all");
  const [userPosition, setUserPosition] = useState(null);
  const [userAddress, setUserAddress] = useState(null);
  const [userHasMovedMap, setUserHasMovedMap] = useState(false);
  const [center, setCenter] = useState([48.8566, 2.3522]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [ghRoute, setGhRoute] = useState([]);
  const [animatedRoute, setAnimatedRoute] = useState([]);
  const [loading, setLoading] = useState(false);

  const mapRef = useRef();
  const isAdmin = role === "admin";

  // Fetch events
  const fetchEvents = async (newEvent) => {
    if (newEvent) {
      setEvents(prev => [newEvent, ...prev]);
      if (!userHasMovedMap) setCenter([newEvent.latitude, newEvent.longitude]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data);
      if (!userHasMovedMap && data.length > 0) setCenter([data[0].latitude, data[0].longitude]);
    } catch (err) {
      console.error("Fetch events error:", err);
    }
  };

  // Fetch images
  const fetchImagesForEvents = async (eventsList) => {
    const updatedImages = {};
    for (let ev of eventsList) {
      const cacheKey = `event_image_${ev.id}`;
      let imageUrl = getCache(cacheKey) || DEFAULT_IMAGE;
      if (imageUrl === DEFAULT_IMAGE) {
        try {
          const query = encodeURIComponent(ev.title);
          const res = await fetch(`https://source.unsplash.com/400x300/?${query}`);
          if (res.ok && res.url) imageUrl = res.url;
        } catch {}
      }
      setCache(cacheKey, imageUrl, CACHE_TTL);
      updatedImages[ev.id] = imageUrl;
    }
    setEventImages(prev => ({ ...prev, ...updatedImages }));
  };

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { if (events.length > 0) fetchImagesForEvents(events); }, [events]);

  // Track map movements
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => map.off("movestart", onMove);
  }, [mapRef.current]);

  // Filters
  const filteredEvents = events.filter(
    e => (filterType === "all" || e.type === filterType) &&
         (filterDate === "all" || e.date === filterDate)
  );
  const uniqueTypes = ["all", ...new Set(events.map(e => e.type))];
  const uniqueDates = ["all", ...new Set(events.map(e => e.date))];

  // Fetch route (debounced, 5000ms)
  useEffect(() => {
    if (filteredEvents.length === 0) {
      setGhRoute([]);
      setAnimatedRoute([]);
      return;
    }

    const points = filteredEvents.map(e => [e.latitude, e.longitude]);
    const fetchRouteDebounced = debounce(async (pts) => {
      setLoading(true);
      let route = [];
      try {
        route = showRoutes ? await fetchGraphHopperRoute(pts) : [];
      } catch (err) {
        console.error("GraphHopper route fetch failed:", err);
      }

      if (route.length === 0 && pts.length > 1) {
        route = pts; // fallback straight line
      }

      setGhRoute(route);
      setAnimatedRoute([]);
      setLoading(false);
    }, 5000);

    fetchRouteDebounced(points);
    return () => fetchRouteDebounced.cancel?.();
  }, [filteredEvents, showRoutes]);

  // Animate route step by step
  useEffect(() => {
    if (!ghRoute || ghRoute.length === 0) return;
    let idx = 0;
    setAnimatedRoute([]);
    const interval = setInterval(() => {
      idx++;
      if (idx > ghRoute.length) {
        clearInterval(interval);
        return;
      }
      setAnimatedRoute(ghRoute.slice(0, idx));
    }, 50);
    return () => clearInterval(interval);
  }, [ghRoute]);

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        {/* Filters */}
        <div className="p-2 bg-gray-100 md:hidden">
          <details>
            <summary className="cursor-pointer select-none">Filtres</summary>
            <div className="mt-2 flex flex-col gap-2">
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2">{uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded p-2">{uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}</select>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />Afficher les tracés</label>
            </div>
          </details>
        </div>

        <div className="hidden md:flex p-2 gap-2 bg-gray-100">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2">{uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded p-2">{uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />Afficher les tracés</label>
        </div>

        {/* MAP */}
        <MapContainer ref={mapRef} center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <MapCenterUpdater center={center} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker key={e.id} position={[e.latitude, e.longitude]} icon={createNumberedIcon(index + 1, e.type)}>
                <Popup minWidth={250}>
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div className="mt-2" dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage src={eventImages[e.id] || DEFAULT_IMAGE} alt={e.title} style={{ width: "100%", height: "auto", marginTop: "6px", borderRadius: "6px" }} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`} target="_blank" rel="noreferrer" className="text-blue-500 underline block mt-2">🚶 Itinéraire</a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {showRoutes && animatedRoute.length > 1 && <Polyline positions={animatedRoute} color="blue" weight={4} opacity={0.6} dashArray="8,8" />}
          {userPosition && <Marker position={userPosition} icon={myPositionIcon}><Popup>📍 Vous êtes ici {userAddress && <div>{userAddress}</div>}</Popup></Marker>}
          {loading && <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/30 text-white font-semibold text-lg">Chargement du tracé...</div>}
        </MapContainer>
      </div>

      {/* Admin panel */}
      {isAdmin && isPanelOpen && (
        <div className="fixed inset-0 md:static z-[3000] md:z-auto">
          <div className="absolute inset-0 bg-black/40 md:hidden" onClick={onCloseAdminPanel} />
          <div className="absolute inset-y-0 right-0 w-full bg-white md:bg-transparent md:relative md:h-full flex flex-col">
            <div className="md:hidden flex items-center justify-between p-3 border-b bg-white">
              <h3 className="font-semibold">Panel Admin</h3>
              <button onClick={onCloseAdminPanel} className="text-gray-600">Fermer</button>
            </div>
            <div className="flex-1 overflow-y-auto"><AdminPanel refreshEvents={fetchEvents} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
