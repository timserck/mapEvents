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

// 🔁 Recentre la carte quand le "center" change
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center)) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Convert [lat, lng] => "lng,lat" pour OSRM
const coordsToOSRM = points => points.map(p => `${p[1]},${p[0]}`).join(";");

// Fetch route multi-stop OSRM
async function fetchOSRMRoutes(start, points) {
  if (!start || points.length === 0) return [];
  const allPoints = [start, ...points];
  const coords = coordsToOSRM(allPoints);
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  } catch (err) { console.error("OSRM multi-stop error", err); }
  return [];
}

// Batch OSRM "shortest trip" pour éviter les 429
async function fetchShortestTripBatched(start, points, batchSize = 3, delay = 500) {
  if (!start || points.length === 0) return [];
  const allPoints = [start, ...points];
  let fullRoute = [];

  for (let i = 0; i < allPoints.length - 1; i += batchSize) {
    const batch = allPoints.slice(i, i + batchSize + 1); // +1 pour le point de départ
    const coords = coordsToOSRM(batch);
    try {
      const res = await fetch(`https://router.project-osrm.org/trip/v1/foot/${coords}?overview=full&geometries=geojson&source=first&roundtrip=false`);
      if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
      const data = await res.json();
      if (data.trips && data.trips.length > 0) {
        fullRoute.push(...data.trips[0].geometry.coordinates.map(c => [c[1], c[0]]));
      }
    } catch (err) {
      console.error("OSRM shortest trip batch error", err);
      // fallback linéaire si OSRM rate
      for (let j = 0; j < batch.length - 1; j++) fullRoute.push(batch[j], batch[j + 1]);
    }
    await new Promise(r => setTimeout(r, delay));
  }
  return fullRoute;
}

// Interpolation linéaire entre deux points
function interpolatePoints(p1, p2, steps) {
  const points = [];
  const [lat1, lng1] = p1;
  const [lat2, lng2] = p2;
  for (let i = 0; i <= steps; i++) {
    points.push([lat1 + ((lat2 - lat1) * i) / steps, lng1 + ((lng2 - lng1) * i) / steps]);
  }
  return points;
}

// Génère un chemin lissé pour animation
function smoothPath(path, step = 5) {
  if (!path || path.length < 2) return path;
  let smoothed = [];
  for (let i = 0; i < path.length - 1; i++) {
    smoothed.push(...interpolatePoints(path[i], path[i + 1], step));
  }
  smoothed.push(path[path.length - 1]);
  return smoothed;
}

// Composant pour animer un marqueur sur un tracé
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
  const [showShortestPath, setShowShortestPath] = useState(true);
  const [osrmRoute, setOsrmRoute] = useState([]);
  const [shortestRoute, setShortestRoute] = useState([]);
  const [loading, setLoading] = useState(false);

  const mapRef = useRef();
  const isAdmin = role === "admin";

  // ---- Fetch events ----
  const fetchEvents = async (newEvent) => {
    if (newEvent) { setEvents(prev => [newEvent, ...prev]); if (!userHasMovedMap) setCenter([newEvent.latitude, newEvent.longitude]); return; }
    try {
      const res = await fetch(`${API_URL}/events`);
      const data = await res.json();
      setEvents(data);
      if (!userHasMovedMap && data.length > 0) setCenter([data[0].latitude, data[0].longitude]);
    } catch (err) { console.error("Fetch events error:", err); }
  };

  // ---- Fetch images ----
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

  // ---- Geolocation ----
  const goToCurrentPosition = async () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => { const { latitude, longitude } = pos.coords; setUserPosition([latitude, longitude]); setCenter([latitude, longitude]); setUserHasMovedMap(true); },
        async () => await fallbackGeoAPI(),
        { enableHighAccuracy: true }
      );
    } else { await fallbackGeoAPI(); }
  };

  const fallbackGeoAPI = async () => {
    try {
      const res = await fetch("https://timserck.duckdns.org/geoapi/");
      const data = await res.json();
      const { latitude, longitude, address } = data;
      setUserPosition([parseFloat(latitude), parseFloat(longitude)]);
      setUserAddress(address);
      setCenter([parseFloat(latitude), parseFloat(longitude)]);
      setUserHasMovedMap(true);
    } catch (e) { console.error("Fallback geo fail:", e); }
  };

  // ---- Track map movements ----
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const onMove = () => setUserHasMovedMap(true);
    map.on("movestart", onMove);
    return () => map.off("movestart", onMove);
  }, [mapRef.current]);

  // ---- Filters ----
  const filteredEvents = events.filter(
    e => (filterType === "all" || e.type === filterType) &&
         (filterDate === "all" || e.date === filterDate)
  );
  const uniqueTypes = ["all", ...new Set(events.map(e => e.type))];
  const uniqueDates = ["all", ...new Set(events.map(e => e.date))];

  // ---- Fetch routes OSRM ----
  useEffect(() => {
    const fetchRoutes = async () => {
      if (!userPosition || filteredEvents.length === 0) { setOsrmRoute([]); setShortestRoute([]); return; }
      setLoading(true);
      const points = filteredEvents.map(e => [e.latitude, e.longitude]);
      setOsrmRoute(showRoutes ? await fetchOSRMRoutes(userPosition, points) : []);
      setShortestRoute(showShortestPath ? await fetchShortestTripBatched(userPosition, points, 3, 500) : []);
      setLoading(false);
    };
    fetchRoutes();
  }, [userPosition, filteredEvents, showRoutes, showShortestPath]);

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
              <label className="flex items-center gap-2"><input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />Afficher les tracés OSRM</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showShortestPath} onChange={e => setShowShortestPath(e.target.checked)} />Afficher le tracé animé</label>
              <button onClick={goToCurrentPosition} className="bg-blue-500 text-white px-3 py-2 rounded">Ma position</button>
            </div>
          </details>
        </div>

        <div className="hidden md:flex p-2 gap-2 bg-gray-100">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border rounded p-2">{uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border rounded p-2">{uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />Afficher les tracés OSRM</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showShortestPath} onChange={e => setShowShortestPath(e.target.checked)} />Afficher le tracé animé</label>
          <button onClick={goToCurrentPosition} className="bg-blue-500 text-white px-3 py-2 rounded">Ma position</button>
        </div>

        <MapContainer ref={mapRef} center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <MapCenterUpdater center={center} />
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <MarkerClusterGroup>
            {filteredEvents.map((e, index) => (
              <Marker
                key={e.id}
                position={[e.latitude, e.longitude]}
                icon={createNumberedIcon(index + 1, e.type)}
                eventHandlers={{ click: (ev) => ev.target.openPopup() }} // 🔑 Popup fix
              >
                <Popup minWidth={250}>
                  <strong>{index + 1}. {e.title}</strong>
                  <p>{e.type} - {formatDate(e.date)}</p>
                  <p>{e.address}</p>
                  <div className="mt-2" dangerouslySetInnerHTML={{ __html: e.description }} />
                  <LazyImage src={eventImages[e.id] || DEFAULT_IMAGE} alt={e.title} style={{ width: "100%", height: "auto", marginTop: "6px", borderRadius: "6px" }} />
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.address)}`} target="_blank" rel="noreferrer" className="text-blue-500 underline block mt-2">
                    🚗 Itinéraire Google Maps
                  </a>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>

          {showRoutes && osrmRoute.length > 1 && <Polyline positions={osrmRoute} color="blue" weight={4} opacity={0.5} dashArray="10,10" />}
          {showShortestPath && shortestRoute.length > 1 && <AnimatedMarker path={shortestRoute} speed={50} />}
          {userPosition && <Marker position={userPosition} icon={myPositionIcon}><Popup>📍 Vous êtes ici {userAddress && <div>{userAddress}</div>}</Popup></Marker>}
          {loading && <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/30 text-white font-semibold text-lg">Chargement des tracés...</div>}
        </MapContainer>
      </div>

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
